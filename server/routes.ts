import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { type User, newsletters, users, loopMembers } from "@db/schema";
import { eq } from "drizzle-orm";
import { sendSMS } from "./twilio";
import { nanoid } from 'nanoid';

// Basic middleware for checking privileged access
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
  // Basic health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Create newsletter
  app.post("/api/newsletters", async (req: Request, res: Response) => {
    try {
      // Save the newsletter with a unique URL ID
      const [newsletter] = await db
        .insert(newsletters)
        .values({
          loopId: req.body.loopId,
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

  // Send newsletter to all members
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

  // View newsletter content
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

  const httpServer = createServer(app);
  return httpServer;
}