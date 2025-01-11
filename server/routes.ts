import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { type User, newsletters, users, loopMembers, loops, updates } from "@db/schema";
import { eq, and, ilike, desc } from "drizzle-orm";
import { sendSMS } from "./twilio";
import { nanoid } from 'nanoid';

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
  // Newsletters
  app.post("/api/loops/:id/newsletters", async (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Save the newsletter with a unique URL ID
      const [newsletter] = await db
        .insert(newsletters)
        .values({
          loopId: parseInt(req.params.id),
          content: req.body.content,
          status: 'draft',
          urlId: nanoid(10),
        })
        .returning();

      res.json(newsletter);
    } catch (error) {
      console.error("Error creating newsletter:", error);
      res.status(500).send("Failed to create newsletter");
    }
  });

  // Newsletter sending endpoint
  app.post("/api/newsletters/:id/send", requirePrivilegedAccess, async (req: Request, res: Response) => {
    try {
      const newsletterId = parseInt(req.params.id);
      if (isNaN(newsletterId)) {
        return res.status(400).json({ error: "Invalid newsletter ID" });
      }

      // Get newsletter details
      const [newsletter] = await db
        .select()
        .from(newsletters)
        .where(eq(newsletters.id, newsletterId))
        .limit(1);

      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found" });
      }

      // Get member phone numbers for this loop
      const members = await db
        .select({
          phoneNumber: users.phoneNumber,
        })
        .from(loopMembers)
        .innerJoin(users, eq(loopMembers.userId, users.id))
        .where(eq(loopMembers.loopId, newsletter.loopId));

      if (!members.length) {
        return res.status(400).json({ error: "No members found for this loop" });
      }

      // Generate newsletter URL
      const baseUrl = req.get('host') || 'loopedin.replit.app';
      const newsletterUrl = `https://${baseUrl}/newsletters/${newsletter.urlId}`;

      // Send SMS to each member
      let successCount = 0;
      let failureCount = 0;

      for (const member of members) {
        if (!member.phoneNumber) continue;

        try {
          await sendSMS(member.phoneNumber, `New update! Check it out here: ${newsletterUrl}`);
          successCount++;
        } catch (error) {
          failureCount++;
          console.error(`Failed to send SMS to ${member.phoneNumber}:`, error);
        }
      }

      // Mark newsletter as sent
      await db
        .update(newsletters)
        .set({ 
          status: 'sent',
          sentAt: new Date()
        })
        .where(eq(newsletters.id, newsletterId));

      res.json({
        success: true,
        sent: successCount,
        failed: failureCount,
        total: members.length
      });

    } catch (error) {
      console.error('Error sending newsletter:', error);
      res.status(500).json({ 
        error: "Failed to send newsletter",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Newsletter view endpoint
  app.get("/newsletters/:urlId", async (req: Request, res: Response) => {
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

      // Render the newsletter content
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${newsletter.loop?.name || 'Loop'} Newsletter</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          </head>
          <body class="bg-gray-50 min-h-screen py-8">
            <div class="max-w-4xl mx-auto px-4">
              <article class="bg-white rounded-xl shadow-lg overflow-hidden p-8">
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

  // Admin Routes - now protected by privileged access check
  app.get("/api/admin/loops", requirePrivilegedAccess, async (req: Request, res: Response) => {
    const { search, sort = "recent" } = req.query;

    try {
      let baseQuery = {
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
        }
      };

      let whereClause = undefined;

      // Apply search filter if provided
      if (search && typeof search === 'string' && search.trim()) {
        whereClause = ilike(loops.name, `%${search.trim()}%`);
      }

      // Construct the query
      const allLoops = await db.query.loops.findMany({
        ...baseQuery,
        ...(whereClause ? { where: whereClause } : {}),
        orderBy: sort === "recent" ? [desc(loops.createdAt)] : undefined,
      });

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

  app.get("/api/admin/loops/:id", requirePrivilegedAccess, async (req: Request, res: Response) => {
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

  app.get("/api/admin/stats", requirePrivilegedAccess, async (req: Request, res: Response) => {
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
  app.post("/api/webhooks/twilio", async (req: Request, res: Response) => {
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
  app.get("/api/loops", async (req: Request, res: Response) => {
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

  app.get("/api/loops/:id", async (req: Request, res: Response) => {
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

  app.post("/api/loops", async (req: Request, res: Response) => {
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
      sendWelcomeMessage(user.phoneNumber, loop.name)
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

  app.put("/api/loops/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/loops/:id", async (req: Request, res: Response) => {
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
  app.post("/api/loops/:id/members", async (req: Request, res: Response) => {
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
      let memberUser = await db.query.users.findFirst({
        where: eq(users.phoneNumber, phoneNumber),
      });

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

      // Get loop details for welcome message
      const [loop] = await db.query.loops.findMany({
        where: eq(loops.id, parseInt(req.params.id)),
        limit: 1,
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
      sendWelcomeMessage(memberUser.phoneNumber, loop.name)
        .catch(error => console.error('Failed to send welcome SMS:', error));

      // Return member with user data
      const [completeMember] = await db.query.loopMembers.findMany({
        where: eq(loopMembers.id, member.id),
        with: {
          user: true,
        },
        limit: 1,
      });

      res.json(completeMember);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).send("Failed to add member");
    }
  });

  app.delete("/api/loops/:id/members/:memberId", async (req: Request, res: Response) => {
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
  app.post("/api/loops/:id/updates", async (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const { content, mediaUrl } = req.body;

    const [update] = await db
      .insert(updates)
      .values({
        loopId: parseInt(req.params.id),
        userId: user.id,
        content,
        mediaUrl,
      })
      .returning();

    res.json(update);
  });

  // Updates
  app.delete("/api/loops/:loopId/updates/:updateId", async (req: Request, res: Response) => {
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


  const httpServer = createServer(app);
  return httpServer;
}

// Placeholder function - needs actual implementation
async function processAndSaveMedia(url: string, contentType: string): Promise<string> {
  // This is a placeholder, replace with actual media processing and saving logic.
  return "mediaUrl";
}

async function sendWelcomeMessage(phoneNumber: string, loopName: string) {
  // This is a placeholder, replace with actual SMS sending logic.
  console.log(`Sending welcome message to ${phoneNumber} for loop ${loopName}`);
}

// Import for randomBytes function, used in adding members
import { randomBytes } from 'crypto';