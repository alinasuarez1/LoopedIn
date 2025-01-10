import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { loops, loopMembers, updates, newsletters, users, type User } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { generateNewsletter, analyzeUpdatesForHighlights } from "./anthropic";
import { sendWelcomeMessage } from "./twilio";
import { randomBytes } from "crypto";

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Twilio Webhook for incoming messages
  app.post("/api/webhooks/twilio", async (req, res) => {
    try {
      const { From, Body, MediaUrl0 } = req.body;

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
        ? userLoops.filter(membership => membership.loop!.name === loopNameMatch[1])
        : userLoops;

      if (loopNameMatch && !targetLoops.length) {
        console.warn(`Specified loop not found: ${loopNameMatch[1]}`);
        return res.status(404).send("Specified loop not found");
      }

      // Save update to each relevant loop
      const savedUpdates = await Promise.all(
        targetLoops.map(membership =>
          db
            .insert(updates)
            .values({
              loopId: membership.loop!.id,
              userId: user.id,
              content: Body,
              mediaUrl: MediaUrl0 || null,
            })
            .returning()
        )
      );

      console.log(`Saved ${savedUpdates.length} updates for user ${user.id}`);

      // Return a TwiML response
      res.type('text/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Thanks for your update${targetLoops.length > 1 ? 's' : ''}!</Message>
        </Response>
      `);
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
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
      try {
        await sendWelcomeMessage(user.phoneNumber, loop.name);
      } catch (smsError) {
        console.warn('Failed to send welcome SMS:', smsError);
        // Continue with loop creation even if SMS fails
      }

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

    try {
      // First check if user already exists with this phone number
      let memberUser = await db.query.users.findFirst({
        where: eq(users.phoneNumber, phoneNumber),
      });

      if (!memberUser) {
        // Generate a random temporary password for new users
        const tempPassword = randomBytes(16).toString('hex');

        // Create new user if they don't exist
        [memberUser] = await db
          .insert(users)
          .values({
            firstName,
            lastName,
            email: email || null,
            phoneNumber,
            password: tempPassword, // They'll need to reset this later
          })
          .returning();
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

      // Create loop membership
      const [member] = await db
        .insert(loopMembers)
        .values({
          loopId: parseInt(req.params.id),
          userId: memberUser.id,
          context,
        })
        .returning();

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

    // Generate newsletter content using Anthropic
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

    // Save the newsletter
    const [newsletter] = await db
      .insert(newsletters)
      .values({
        loopId,
        content: newsletterContent,
      })
      .returning();

    res.json(newsletter);
  });

  const httpServer = createServer(app);
  return httpServer;
}