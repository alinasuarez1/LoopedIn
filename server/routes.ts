import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { loops, loopMembers, updates, newsletters, users, type User } from "@db/schema";
import { and, eq, desc, ilike } from "drizzle-orm";
import { generateNewsletter } from "./openai";
import { sendWelcomeMessage, sendSMS } from "./twilio";
import { nanoid } from 'nanoid';
import { processAndSaveMedia } from "./storage";
import { randomBytes } from 'node:crypto';

// Middleware to check if user has privileged access
const requirePrivilegedAccess = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as User | undefined;
  if (!user?.id) {
    return res.status(401).send("Not authenticated");
  }

  if (!user.isPrivileged) {
    return res.status(403).send("Not authorized. Privileged access required.");
  }

  next();
};

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Admin Routes - now protected by privileged access check
  app.get("/api/admin/loops", requirePrivilegedAccess, async (req, res) => {
    const { search, sort = "recent" } = req.query;

    try {
      let query = db.query.loops.findMany({
        with: {
          creator: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          members: {
            with: {
              user: true
            }
          },
          updates: {
            with: {
              user: true
            }
          },
          newsletters: true
        },
        orderBy: sort === "recent" ? [desc(loops.createdAt)] : undefined,
      });

      // Apply search filter if provided
      if (search && typeof search === 'string' && search.trim()) {
        query = db.query.loops.findMany({
          ...query,
          where: ilike(loops.name, `%${search.trim()}%`),
        });
      }

      const allLoops = await query;

      // Transform data for the frontend
      const loopsWithStats = allLoops.map(loop => ({
        ...loop,
        memberCount: loop.members?.length || 0,
        lastNewsletter: loop.newsletters?.[0]?.sentAt || null,
        updateCount: loop.updates?.length || 0,
      }));

      res.json(loopsWithStats);
    } catch (error) {
      console.error('Error fetching loops:', error);
      res.status(500).json({ error: 'Failed to fetch loops' });
    }
  });

  app.get("/api/admin/loops/:id", requirePrivilegedAccess, async (req, res) => {
    const [loop] = await db.query.loops.findMany({
      where: eq(loops.id, parseInt(req.params.id)),
      with: {
        creator: true,
        members: {
          with: {
            user: true,
          },
        },
        updates: {
          with: {
            user: true,
          },
          orderBy: desc(updates.createdAt),
        },
        newsletters: {
          orderBy: desc(newsletters.sentAt),
        },
      },
      limit: 1,
    });

    if (!loop) {
      return res.status(404).send("Loop not found");
    }

    res.json(loop);
  });

  app.get("/api/admin/stats", requirePrivilegedAccess, async (req, res) => {
    const { startDate, endDate } = req.query;

    // Get all loops with their creation dates
    const allLoops = await db.query.loops.findMany({
      orderBy: desc(loops.createdAt),
      with: {
        members: true,
      },
    });

    // Calculate statistics
    const stats = {
      totalLoops: allLoops.length,
      totalMembers: allLoops.reduce((acc, loop) => acc + (loop.members?.length || 0), 0),
      loopGrowth: allLoops.map(loop => ({
        date: loop.createdAt,
        count: 1,
      })),
      memberGrowth: allLoops.map(loop => ({
        date: loop.createdAt,
        count: loop.members?.length || 0,
      })),
    };

    res.json(stats);
  });

  // Twilio Webhook for incoming messages
  app.post("/api/webhooks/twilio", async (req, res) => {
    try {
      const { From, Body } = req.body;

      // Extract all media URLs and content types
      const mediaUrls: { url: string; contentType: string }[] = [];
      for (let i = 0; i <= 9; i++) {
        const url = req.body[`MediaUrl${i}`];
        const contentType = req.body[`MediaContentType${i}`];
        if (url && contentType) {
          mediaUrls.push({ url, contentType });
        }
      }

      console.log('Received Twilio webhook:', {
        from: From,
        mediaCount: mediaUrls.length,
        messageBody: Body,
        rawBody: req.body
      });

      // Clean up the phone number (remove the '+' prefix if present)
      const phoneNumber = From.startsWith('+') ? From.substring(1) : From;

      // Find the user by phone number
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, phoneNumber))
        .limit(1);

      if (!user) {
        console.warn(`Received message from unknown number: ${phoneNumber}`);
        return res.status(404).send("User not found");
      }

      // Find all loops this user is a member of
      const userLoops = await db.query.loopMembers.findMany({
        where: eq(loopMembers.userId, user.id),
        with: {
          loop: true,
        },
      });

      if (!userLoops.length) {
        console.warn(`User ${user.id} is not a member of any loops`);
        return res.status(404).send("No loops found for user");
      }

      // Extract loop name from message if specified
      const loopNameMatch = Body.match(/\[(.*?)\]/);
      const targetLoops = loopNameMatch
        ? userLoops.filter(membership => membership.loop!.name.toLowerCase() === loopNameMatch[1].toLowerCase())
        : userLoops;

      if (loopNameMatch && !targetLoops.length) {
        console.warn(`Specified loop not found: ${loopNameMatch[1]}`);
        return res.status(404).send("Specified loop not found");
      }

      // Process all media files
      let processedMediaUrls: string[] = [];
      if (mediaUrls.length > 0) {
        try {
          console.log(`Processing ${mediaUrls.length} media files`);
          processedMediaUrls = await Promise.all(
            mediaUrls.map(async ({ url, contentType }) => {
              console.log('Processing media:', {
                url,
                contentType,
                userId: user.id
              });
              return processAndSaveMedia(url, contentType);
            })
          );
          console.log('Successfully processed all media:', processedMediaUrls);
        } catch (error) {
          console.error('Failed to process media:', error);
          if (error instanceof Error) {
            console.error('Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
          }
          // Continue without the media if upload fails
        }
      }

      // Save update to each relevant loop
      const savedUpdates = await Promise.all(
        targetLoops.map(async membership => {
          const update = await db
            .insert(updates)
            .values({
              loopId: membership.loop!.id,
              userId: user.id,
              content: Body,
              mediaUrls: processedMediaUrls,
            })
            .returning();

          console.log('Saved update:', {
            updateId: update[0].id,
            loopId: membership.loop!.id,
            userId: user.id,
            mediaCount: processedMediaUrls.length,
            mediaUrls: processedMediaUrls
          });
          return update[0];
        })
      );

      console.log(`Saved ${savedUpdates.length} updates for user ${user.id}`);

      // Return a TwiML response with appropriate message
      let responseMessage = "Thanks for your update";
      if (loopNameMatch) {
        // Use the original loop name from the matched loop for the response
        const matchedLoop = targetLoops[0].loop!;
        responseMessage += ` to ${matchedLoop.name}`;
      } else if (savedUpdates.length > 1) {
        responseMessage += `s to all your loops`;
      }
      responseMessage += "!";

      // Return a TwiML response
      res.type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${responseMessage}</Message>
        </Response>
      `);
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      res.status(500).send("Internal server error");
    }
  });

  // Loops
  app.get("/api/loops", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const userLoops = await db.query.loops.findMany({
      where: eq(loops.creatorId, user.id),
      with: {
        creator: true,
        members: {
          with: {
            user: true,
          },
        },
        updates: {
          with: {
            user: true,
          },
        },
        newsletters: true,
      },
    });

    res.json(userLoops);
  });

  app.get("/api/loops/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const [loop] = await db.query.loops.findMany({
      where: eq(loops.id, parseInt(req.params.id)),
      with: {
        members: {
          with: {
            user: true,
          },
        },
        updates: {
          with: {
            user: true,
          },
        },
        newsletters: true,
      },
      limit: 1,
    });

    if (!loop) {
      return res.status(404).send("Loop not found");
    }

    if (loop.creatorId !== user.id) {
      return res.status(403).send("Not authorized");
    }

    res.json(loop);
  });

  app.post("/api/loops", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const { name, frequency, vibe, context, reminderSchedule } = req.body;

    try {
      // Start a transaction to ensure both operations succeed or fail together
      const [loop] = await db
        .insert(loops)
        .values({
          name,
          frequency,
          vibe,
          context,
          reminderSchedule,
          creatorId: user.id,
        })
        .returning();

      // Add the creator as a member
      await db
        .insert(loopMembers)
        .values({
          loopId: loop.id,
          userId: user.id,
          context: "Loop Creator",
        });

      // Try to send welcome message, but don't block on failure
      sendWelcomeMessage(user.phoneNumber, loop.name, user.firstName, "Loop Creator")
        .catch(error => console.warn('Failed to send welcome SMS:', error));

      // Fetch the complete loop with members
      const [completeLoop] = await db.query.loops.findMany({
        where: eq(loops.id, loop.id),
        with: {
          members: {
            with: {
              user: true,
            },
          },
          updates: {
            with: {
              user: true,
            },
          },
          newsletters: true,
        },
        limit: 1,
      });

      res.json({
        ...completeLoop,
        smsStatus: process.env.TWILIO_ACCOUNT_SID ? 'enabled' : 'disabled'
      });
    } catch (error) {
      console.error("Error creating loop:", error);
      res.status(500).send("Failed to create loop");
    }
  });

  app.put("/api/loops/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const { name, frequency, vibe, context, reminderSchedule } = req.body;

    const [loop] = await db
      .update(loops)
      .set({
        name,
        frequency,
        vibe,
        context,
        reminderSchedule,
      })
      .where(
        and(
          eq(loops.id, parseInt(req.params.id)),
          eq(loops.creatorId, user.id)
        )
      )
      .returning();

    if (!loop) {
      return res.status(404).send("Loop not found");
    }

    res.json(loop);
  });

  app.delete("/api/loops/:id", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Delete all associated data in a transaction
      const [deletedLoop] = await db.transaction(async (tx) => {
        // First verify the user owns this loop
        const [loop] = await tx
          .select()
          .from(loops)
          .where(
            and(
              eq(loops.id, parseInt(req.params.id)),
              eq(loops.creatorId, user.id)
            )
          )
          .limit(1);

        if (!loop) {
          throw new Error("Loop not found or not authorized");
        }

        // Delete all members
        await tx
          .delete(loopMembers)
          .where(eq(loopMembers.loopId, loop.id));

        // Delete all updates
        await tx
          .delete(updates)
          .where(eq(updates.loopId, loop.id));

        // Delete all newsletters
        await tx
          .delete(newsletters)
          .where(eq(newsletters.loopId, loop.id));

        // Finally delete the loop itself
        const [deletedLoop] = await tx
          .delete(loops)
          .where(eq(loops.id, loop.id))
          .returning();

        return [deletedLoop];
      });

      if (!deletedLoop) {
        return res.status(404).send("Loop not found");
      }

      res.json({ message: "Loop and all associated data deleted" });
    } catch (error) {
      console.error("Error deleting loop:", error);
      res.status(500).send(error instanceof Error ? error.message : "Failed to delete loop");
    }
  });

  // Loop Members
  app.post("/api/loops/:id/members", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const { firstName, lastName, email, phoneNumber, context } = req.body;

    if (!phoneNumber) {
      return res.status(400).send("Phone number is required");
    }

    try {
      // First check if user already exists with this phone number
      const existingUser = await db.query.users.findFirst({
        where: eq(users.phoneNumber, phoneNumber),
      });

      let memberUser = existingUser;

      if (!memberUser) {
        // Generate a random temporary password for new users
        const tempPassword = randomBytes(16).toString('hex');

        // Create new user if they don't exist
        const [newUser] = await db
          .insert(users)
          .values({
            firstName,
            lastName,
            email: email || null,
            phoneNumber,
            password: tempPassword,
          })
          .returning();

        if (!newUser) {
          throw new Error("Failed to create user");
        }

        memberUser = newUser;
      }

      // Check if they're already a member of this loop
      const existingMembership = await db.query.loopMembers.findFirst({
        where: and(
          eq(loopMembers.loopId, parseInt(req.params.id)),
          eq(loopMembers.userId, memberUser.id)
        ),
      });

      if (existingMembership) {
        return res.status(400).send("User is already a member of this loop");
      }

      // Get loop details and creator info for welcome message
      const loop = await db.query.loops.findFirst({
        where: eq(loops.id, parseInt(req.params.id)),
        with: {
          creator: true,
        },
      });

      if (!loop) {
        return res.status(404).send("Loop not found");
      }

      // Create loop membership
      const [member] = await db
        .insert(loopMembers)
        .values({
          loopId: parseInt(req.params.id),
          userId: memberUser.id,
          context,
        })
        .returning();

      if (!member) {
        throw new Error("Failed to create loop membership");
      }

      // Send welcome message without waiting for response
      const creatorName = loop.creator ? `${loop.creator.firstName} ${loop.creator.lastName}` : "your loop admin";
      sendWelcomeMessage(memberUser.phoneNumber, loop.name, memberUser.firstName, creatorName)
        .catch(error => console.error('Failed to send welcome SMS:', error));

      // Return member with user data
      const completeMember = await db.query.loopMembers.findFirst({
        where: eq(loopMembers.id, member.id),
        with: {
          user: true,
        },
      });

      res.json(completeMember);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).send("Failed to add member");
    }
  });

  app.delete("/api/loops/:id/members/:memberId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // First verify the user owns this loop
      const [loop] = await db
        .select()
        .from(loops)
        .where(
          and(
            eq(loops.id, parseInt(req.params.id)),
            eq(loops.creatorId, user.id)
          )
        )
        .limit(1);

      if (!loop) {
        return res.status(404).send("Loop not found or not authorized");
      }

      // Delete the membership
      await db
        .delete(loopMembers)
        .where(
          and(
            eq(loopMembers.loopId, parseInt(req.params.id)),
            eq(loopMembers.id, parseInt(req.params.memberId))
          )
        );

      res.json({ message: "Member removed successfully" });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).send("Failed to remove member");
    }
  });

  // Updates
  app.post("/api/loops/:id/updates", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const { content, mediaUrls } = req.body;

    const [update] = await db
      .insert(updates)
      .values({
        content,
        mediaUrls: mediaUrls || [],
        userId: user.id,
        loopId: parseInt(req.params.id),
      })
      .returning();

    res.json(update);
  });

  // Updates
  app.delete("/api/loops/:loopId/updates/:updateId", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Verify the user owns this update or is the loop creator
      const [update] = await db
        .select()
        .from(updates)
        .where(eq(updates.id, parseInt(req.params.updateId)))
        .limit(1);

      if (!update) {
        return res.status(404).send("Update not found");
      }

      // Check if user owns the update or is the loop creator
      const [loop] = await db
        .select()
        .from(loops)
        .where(eq(loops.id, parseInt(req.params.loopId)))
        .limit(1);

      if (!loop) {
        return res.status(404).send("Loop not found");
      }

      if (update.userId !== user.id && loop.creatorId !== user.id) {
        return res.status(403).send("Not authorized to delete this update");
      }

      // Delete the update
      await db
        .delete(updates)
        .where(eq(updates.id, parseInt(req.params.updateId)));

      res.json({ message: "Update deleted successfully" });
    } catch (error) {
      console.error("Error deleting update:", error);
      res.status(500).send("Failed to delete update");
    }
  });


  // Newsletters
  app.post("/api/loops/:id/newsletters", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const loopId = parseInt(req.params.id);

    // Get all updates for this loop
    const loop = await db.query.loops.findFirst({
      where: eq(loops.id, loopId),
      with: {
        updates: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!loop) {
      return res.status(404).send("Loop not found");
    }

    if (!loop.updates.length) {
      return res.status(400).send("No updates available for newsletter generation");
    }

    // Generate newsletter content using OpenAI
    const updatesForAI = loop.updates.map(update => {
      const user = update.user;
      if (!user) {
        throw new Error("Update missing user information");
      }
      return {
        content: update.content,
        userName: `${user.firstName} ${user.lastName}`,
      };
    });

    const newsletterContent = await generateNewsletter(
      loop.name,
      updatesForAI,
      loop.vibe
    );

    // Generate a unique URL ID
    const urlId = nanoid(10);

    // Save the newsletter
    const [newsletter] = await db
      .insert(newsletters)
      .values({
        content: newsletterContent,
        loopId,
        urlId,
        status: 'draft'
      })
      .returning();

    res.json(newsletter);
  });

  // Newsletter Management Routes
  app.post("/api/loops/:id/newsletters/generate", requirePrivilegedAccess, async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const loopId = parseInt(req.params.id);
    const { customHeader, customClosing } = req.body;

    try {
      // Get all updates for this loop
      const loop = await db.query.loops.findFirst({
        where: eq(loops.id, loopId),
        with: {
          updates: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!loop) {
        return res.status(404).send("Loop not found");
      }

      if (!loop.updates.length) {
        return res.status(400).send("No updates available for newsletter generation");
      }

      // Generate newsletter content using OpenAI
      const updatesForAI = loop.updates.map(update => {
        const user = update.user;
        if (!user) {
          throw new Error("Update missing user information");
        }
        return {
          content: update.content,
          userName: `${user.firstName} ${user.lastName}`,
          mediaUrls: update.mediaUrls || [],
        };
      });

      const newsletterContent = await generateNewsletter(
        loop.name,
        updatesForAI,
        loop.vibe,
        { customHeader, customClosing }
      );

      // Generate a unique URL ID
      const urlId = nanoid(10);

      // Save the draft newsletter
      const [newsletter] = await db
        .insert(newsletters)
        .values({
          loopId,
          content: newsletterContent,
          status: 'draft',
          urlId,
        })
        .returning();

      if (!newsletter) {
        throw new Error("Failed to create newsletter");
      }

      // Return consistent response format
      res.json({
        newsletter: {
          id: newsletter.id,
          loopId: newsletter.loopId,
          content: newsletter.content,
          status: newsletter.status,
          urlId: newsletter.urlId,
          sentAt: newsletter.sentAt,
          createdAt: newsletter.createdAt,
          updatedAt: newsletter.updatedAt
        },
        url: `/newsletters/${urlId}`
      });
    } catch (error) {
      console.error("Error generating newsletter:", error);
      res.status(500).send(error instanceof Error ? error.message : "Failed to generate newsletter");
    }
  });

  // Add a new route to serve newsletters by URL ID
  app.get("/newsletters/:urlId", async (req, res) => {
    try {
      const [newsletter] = await db.query.newsletters.findMany({
        where: eq(newsletters.urlId, req.params.urlId),
        with: {
          loop: true,
        },
        limit: 1,
      });

      if (!newsletter) {
        return res.status(404).send("Newsletter not found");
      }

      // Render the newsletter content with improved image handling
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${newsletter.loop?.name || 'Loop'} Newsletter</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            .newsletter-content {
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
            }
            .newsletter-content img {
              max-width: 100%;
              height: auto;
              margin: 1.5rem auto;
              border-radius: 0.5rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              display: block;
            }
            .newsletter-content figure {
              margin: 2rem 0;
            }
            .newsletter-content h1 {
              font-size: 2.25rem;
              font-weight: bold;
              margin-bottom: 1.5rem;
              color: #1a1a1a;
              text-align: center;
            }
            .newsletter-content h2 {
              font-size: 1.5rem;
              font-weight: bold;
              margin-top: 2rem;
              margin-bottom: 1rem;
              color: #2d3748;
            }
            .newsletter-content h3 {
              font-size: 1.25rem;
              font-weight: bold;
              margin-top: 1.5rem;
              margin-bottom: 0.75rem;
              color: #4a5568;
            }
            .newsletter-content p {
              margin-bottom: 1rem;
              line-height: 1.6;
            }
            .newsletter-content hr {
              margin: 2rem 0;
              border: 0;
              height: 1px;
              background-color: #e2e8f0;
            }
            .newsletter-content ul {
              list-style-type: disc;
              margin-left: 1.5rem;
              margin-bottom: 1rem;
            }
            .newsletter-content li {
              margin-bottom: 0.5rem;
            }
            .update-block {
              border: 1px solid #e2e8f0;
              border-radius: 0.5rem;
              padding: 1.5rem;
              margin-bottom: 2rem;
              background-color: #f8fafc;
            }
            .update-content {
              margin: 1rem 0;
            }
          </style>
        </head>
        <body class="bg-gray-50 min-h-screen py-8">
          <div class="max-w-4xl mx-auto px-4">
            <article class="bg-white rounded-xl shadow-lg overflow-hidden">
              ${newsletter.content}
            </article>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error serving newsletter:", error);
      res.status(500).send("Failed to load newsletter");
    }
  });

  // Get newsletter preview
  app.get("/api/loops/:id/newsletters/:newsletterId/preview", requirePrivilegedAccess, async (req, res) => {
    try {
      const [newsletter] = await db.query.newsletters.findMany({
        where: and(
          eq(newsletters.id, parseInt(req.params.newsletterId)),
          eq(newsletters.loopId, parseInt(req.params.id))
        ),
        limit: 1,
      });

      if (!newsletter) {
        return res.status(404).send("Newsletter not found");
      }

      res.json(newsletter);
    } catch (error) {
      console.error("Error fetching newsletter:", error);
      res.status(500).send("Failed to fetch newsletter");
    }
  });

  app.put("/api/loops/:id/newsletters/:newsletterId", requirePrivilegedAccess, async (req, res) => {
    try {
      const { content } = req.body;

      const [updatedNewsletter] = await db
        .update(newsletters)
        .set({
          content,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(newsletters.id, parseInt(req.params.newsletterId)),
            eq(newsletters.loopId, parseInt(req.params.id))
          )
        )
        .returning();

      if (!updatedNewsletter) {
        return res.status(404).send("Newsletter not found");
      }

      res.json(updatedNewsletter);
    } catch (error) {
        console.error("Error updating newsletter:", error);
      res.status(500).send("Failed to update newsletter");
    }
  });

  app.post("/api/loops/:id/newsletters/:newsletterId/send", requirePrivilegedAccess, async (req, res) => {
    try {
      const loopId = parseInt(req.params.id);
      const newsletterId = parseInt(req.params.newsletterId);

      // Get the newsletter and verify it exists
      const [newsletter] = await db
        .select()
        .from(newsletters)
        .where(
                    and(
            eq(newsletters.id, newsletterId),
            eq(newsletters.loopId, loopId)
          )
        )
        .limit(1);

      if (!newsletter) {
        return res.status(404).send("Newsletter not found");
      }

      // Update the newsletter status to 'sent'
      const [updatedNewsletter] = await db
        .update(newsletters)
        .set({
          status: 'sent',
          sentAt: new Date(),
        })
        .where(eq(newsletters.id, newsletterId))
        .returning();

      res.json(updatedNewsletter);
    } catch (error) {
      console.error("Error sending newsletter:", error);
      res.status(500).send("Failed to send newsletter");
    }
  });

  app.post("/api/admin/loops/:id/bulk-sms", requirePrivilegedAccess, async (req, res) => {
    try {
      const { message } = req.body;
      const loopId = parseInt(req.params.id);

      if (!message?.trim()) {
        return res.status(400).send("Message is required");
      }

      if (isNaN(loopId)) {
        return res.status(400).send("Invalid loop ID");
      }

      // Get the loop with its members
      const loop = await db.query.loops.findFirst({
        where: eq(loops.id, loopId),
        with: {
          members: {
            with: {
              user: {
                columns: {
                  phoneNumber: true,
                }
              }
            }
          }
        },
        columns: {
          id: true,
          name: true,
        }
      });

      if (!loop) {
        return res.status(404).send("Loop not found");
      }

      // Get all members with valid phone numbers
      const validMembers = loop.members.filter((member) =>
        member.user?.phoneNumber && member.user.phoneNumber.trim()
      );

      if (validMembers.length === 0) {
        return res.status(400).send("No members with valid phone numbers found");
      }

      // Send SMS to each member
      const results = await Promise.allSettled(
        validMembers.map(member =>
          member.user?.phoneNumber ? sendSMS(member.user.phoneNumber, message) : Promise.reject()
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      res.json({
        message: `Successfully sent ${succeeded} messages${failed > 0 ? `, ${failed} failed` : ''}`,
        succeeded,
        failed,
        total: validMembers.length
      });

    } catch (error) {
      console.error("Error sending bulk SMS:", error);
      res.status(500).send(error instanceof Error ? error.message : "Failed to send messages");
    }
  });

  // Create HTTP server and return it
  const httpServer = createServer(app);
  return httpServer;
}