import { Storage } from '@google-cloud/storage';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

// Read and parse the credentials file
const credentialsPath = path.join(process.cwd(), 'attached_assets', 'loopedin-446520-c3e0d129ffce.json');
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));

// Initialize storage with credentials from file
const storage = new Storage({
  projectId: credentials.project_id,
  credentials,
});

const bucketName = 'loop-media-storage';
let bucket = storage.bucket(bucketName);

// Process and save media from Twilio
export async function processAndSaveMedia(mediaUrl: string, contentType: string): Promise<string> {
  console.log(`Processing media from URL: ${mediaUrl}`);
  console.log(`Content type: ${contentType}`);

  try {
    // Download the media from Twilio URL with authentication
    const authString = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const response = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }

    // Convert the response to a buffer
    const mediaBuffer = await response.buffer();

    // Create a unique filename
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const file = bucket.file(`media/${filename}`);

    // Upload the file
    await new Promise((resolve, reject) => {
      const stream = file.createWriteStream({
        metadata: {
          contentType: contentType,
        },
        resumable: false
      });

      stream.on('error', (err) => reject(err));
      stream.on('finish', () => resolve(true));
      stream.end(mediaBuffer);
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Return the public URL
    return `https://storage.googleapis.com/${bucketName}/media/${filename}`;
  } catch (error) {
    console.error('Media processing failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error;
  }
}

// Initialize the bucket if it doesn't exist
export async function initializeStorage() {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log('Creating storage bucket:', bucketName);
      [bucket] = await storage.createBucket(bucketName, {
        location: 'US',
        storageClass: 'STANDARD'
      });
    }
    console.log('Storage initialized successfully');
  } catch (error) {
    console.error('Error initializing storage:', error);
    throw error;
  }
}

// Initialize storage when the module loads
initializeStorage().catch(console.error);