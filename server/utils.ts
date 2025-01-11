import { db } from "@db";
import { newsletters, loopMembers, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { sendSMS } from "./twilio";

export async function sendNewsletterToMembers(newsletterId: number, baseUrl: string) {
  // Get newsletter details
  const [newsletter] = await db
    .select()
    .from(newsletters)
    .where(eq(newsletters.id, newsletterId))
    .limit(1);

  if (!newsletter) {
    throw new Error("Newsletter not found");
  }

  // Get member phone numbers
  const members = await db
    .select({
      phoneNumber: users.phoneNumber,
    })
    .from(loopMembers)
    .innerJoin(users, eq(loopMembers.userId, users.id))
    .where(eq(loopMembers.loopId, newsletter.loopId));

  if (!members.length) {
    throw new Error("No members found");
  }

  const newsletterUrl = `https://${baseUrl}/newsletters/${newsletter.urlId}`;
  let successCount = 0;
  let failureCount = 0;

  // Send SMS to each member
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

  // Update newsletter status
  await db
    .update(newsletters)
    .set({ 
      status: 'sent',
      sentAt: new Date()
    })
    .where(eq(newsletters.id, newsletterId));

  return { successCount, failureCount, total: members.length };
}
