import twilio from 'twilio';
import { db } from "@db";
import { loops } from "@db/schema";
import { sql } from "drizzle-orm";

const hasCredentials = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
let client: ReturnType<typeof twilio> | null = null;
let fromNumber: string | null = null;

if (hasCredentials) {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
  fromNumber = process.env.TWILIO_PHONE_NUMBER!;
}

export async function sendWelcomeMessage(phoneNumber: string, loopName: string) {
  if (!hasCredentials) {
    console.warn('Twilio credentials not configured. SMS features are disabled.');
    return { smsStatus: 'disabled' };
  }

  try {
    await client!.messages.create({
      body: `Welcome to ${loopName}! 🎉 You're now connected with your group through LoopedIn. Share your updates by replying to this message, and we'll include them in the next newsletter!`,
      from: fromNumber!,
      to: phoneNumber
    });
    console.log(`Welcome message sent to ${phoneNumber} for loop ${loopName}`);
    return { smsStatus: 'enabled' };
  } catch (error) {
    console.error('Error sending welcome message:', error);
    return { smsStatus: 'error', error };
  }
}

export async function sendMessage(phoneNumber: string, message: string) {
  if (!hasCredentials) {
    console.warn('Twilio credentials not configured. SMS features are disabled.');
    return { smsStatus: 'disabled' };
  }

  try {
    await client!.messages.create({
      body: message,
      from: fromNumber!,
      to: phoneNumber
    });
    console.log(`Message sent to ${phoneNumber}: ${message}`);
    return { smsStatus: 'enabled' };
  } catch (error) {
    console.error('Error sending message:', error);
    return { smsStatus: 'error', error };
  }
}

export async function sendReminder(phoneNumber: string, loopName: string) {
  const message = `Hi! Share your updates for ${loopName}'s newsletter! Reply to this message with text or photos.`;
  return sendMessage(phoneNumber, message);
}

export async function sendScheduledReminders() {
  if (!hasCredentials) {
    console.warn('Twilio credentials not configured. SMS reminders are disabled.');
    return;
  }

  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit'
  });

  try {
    // Query all loops that have reminders scheduled for current day and time
    const loopsToRemind = await db.query.loops.findMany({
      where: sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${loops.reminderSchedule}) as schedule
        WHERE schedule->>'day' = ${currentDay}
        AND schedule->>'time' = ${currentTime}
      )`,
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    for (const loop of loopsToRemind) {
      for (const member of loop.members) {
        if (member.user?.phoneNumber) {
          await sendReminder(member.user.phoneNumber, loop.name);
        }
      }
    }

    console.log(`Sent reminders for ${loopsToRemind.length} loops on ${currentDay} at ${currentTime}`);
  } catch (error) {
    console.error('Error sending scheduled reminders:', error);
  }
}

// Check for reminders every minute instead of every hour to be more precise
setInterval(sendScheduledReminders, 1000 * 60);
// Initial check
sendScheduledReminders();