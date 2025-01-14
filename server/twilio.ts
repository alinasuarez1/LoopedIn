import twilio from 'twilio';
import { db } from "@db";
import { loops } from "@db/schema";
import { sql } from "drizzle-orm";
import { formatInTimeZone } from 'date-fns-tz';

const hasCredentials = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
let client: ReturnType<typeof twilio> | null = null;
let fromNumber: string | null = null;

if (hasCredentials) {
  console.log('Initializing Twilio client with credentials');
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
  fromNumber = process.env.TWILIO_PHONE_NUMBER!;
  console.log('Twilio client initialized successfully');
} else {
  console.warn('Twilio credentials not configured. SMS features are disabled.');
}

export async function sendWelcomeMessage(phoneNumber: string, loopName: string, memberFirstName: string, inviterName: string) {
  if (!hasCredentials || !client || !fromNumber) {
    console.warn('Twilio not configured, skipping welcome message');
    return;
  }

  try {
    await client.messages.create({
      body: `Hi ${memberFirstName}! 🎉 Looks like you've been LoopedIn to ${loopName} by ${inviterName}—welcome!

No need to sign up, all you have to do is reply to this message with your updates, photos, or even your random shower thoughts—no pressure, no perfection required.

In a couple weeks, we'll transform everyones updates into a delightful newsletter for everyone to enjoy.

📌 Pro Tip: Save this number as LoopedIn in your contacts so you don't miss a thing! Reply STOP to opt out.

Still confused? Check out our quick getting started guide:
https://docs.google.com/document/d/e/2PACX-1vTluWn3opUaUj9_Zfz08vc0aHR13ipH7tGwvXDFBvgYHuHUWpG-yk3_EXJRlli2zfVXkph23GlBQ9us/pub`,
      from: fromNumber,
      to: phoneNumber
    });
    console.log(`Sent welcome message to ${phoneNumber} for ${loopName}`);
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
}

export async function sendSMS(phoneNumber: string, message: string) {
  if (!hasCredentials || !client || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS');
    return;
  }

  try {
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: phoneNumber
    });
    console.log(`Sent message to ${phoneNumber}`);
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

export async function sendReminder(phoneNumber: string, loopName: string) {
  const message = `Hi! Share your updates for ${loopName}'s newsletter! Reply to this message with text or photos.`;
  await sendSMS(phoneNumber, message);
}

// Reminder scheduler
export async function sendScheduledReminders() {
  if (!hasCredentials) {
    console.warn('Twilio not configured, skipping reminders');
    return;
  }

  const now = new Date();
  const currentDay = formatInTimeZone(now, 'America/New_York', 'EEEE');
  const currentTime = formatInTimeZone(now, 'America/New_York', 'HH:mm');

  console.log(`Checking for reminders on ${currentDay} at ${currentTime} Eastern Time`);

  try {
    const loopsToRemind = await db.query.loops.findMany({
      where: sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(CAST(${loops.reminderSchedule} AS JSONB)) as schedule
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

    console.log(`Found ${loopsToRemind.length} loops scheduled for reminders`);

    for (const loop of loopsToRemind) {
      console.log(`Processing reminders for loop: ${loop.name}`);
      for (const member of loop.members) {
        if (member.user?.phoneNumber) {
          await sendReminder(member.user.phoneNumber, loop.name);
        }
      }
    }

    console.log(`Sent reminders for ${loopsToRemind.length} loops`);
  } catch (error) {
    console.error('Error sending scheduled reminders:', error);
  }
}

// Check for reminders every minute
setInterval(sendScheduledReminders, 1000 * 60);
// Initial check
sendScheduledReminders();