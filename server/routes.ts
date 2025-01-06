import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { loops, loopMembers, updates, newsletters, type User } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { generateNewsletter, analyzeUpdatesForHighlights } from "./anthropic";
import { sendWelcomeMessage } from "./twilio";

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Loops
  app.get("/api/loops", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const userLoops = await db.query.loops.findMany({
      where: eq(loops.creatorId, user.id),
      with: {
        members: true,
        updates: true,
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
        members: true,
        updates: true,
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
          members: true,
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

    const [loop] = await db
      .delete(loops)
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

    res.json({ message: "Loop deleted" });
  });

  // Loop Members
  app.post("/api/loops/:id/members", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const { userId, context } = req.body;

    const [member] = await db
      .insert(loopMembers)
      .values({
        loopId: parseInt(req.params.id),
        userId,
        context,
      })
      .returning();

    res.json(member);
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