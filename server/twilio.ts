import twilio from 'twilio';

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

  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  try {
    // Query all loops that have reminders scheduled for today
    const loopsToRemind = await db.query.loops.findMany({
      where: (loops) => contains(loops.reminderSchedule, currentDay),
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

    console.log(`Sent reminders for ${loopsToRemind.length} loops on ${currentDay}`);
  } catch (error) {
    console.error('Error sending scheduled reminders:', error);
  }
}