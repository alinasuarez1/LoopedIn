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
    return;
  }

  try {
    await client!.messages.create({
      body: `Welcome to ${loopName}! 🎉 You're now connected with your group through LoopedIn. Share your updates by replying to this message, and we'll include them in the next newsletter!`,
      from: fromNumber!,
      to: phoneNumber
    });
    console.log(`Welcome message sent to ${phoneNumber} for loop ${loopName}`);
  } catch (error) {
    console.error('Error sending welcome message:', error);
    // Don't throw the error as SMS sending shouldn't block the main flow
  }
}

export async function sendMessage(phoneNumber: string, message: string) {
  if (!hasCredentials) {
    console.warn('Twilio credentials not configured. SMS features are disabled.');
    return;
  }

  try {
    await client!.messages.create({
      body: message,
      from: fromNumber!,
      to: phoneNumber
    });
    console.log(`Message sent to ${phoneNumber}: ${message}`);
  } catch (error) {
    console.error('Error sending message:', error);
    // Don't throw the error as SMS sending shouldn't block the main flow
  }
}