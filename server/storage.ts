import { Storage } from '@google-cloud/storage';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import path from 'path';

// Initialize storage client with credentials from JSON file
const credentialsPath = path.join(process.cwd(), 'attached_assets', 'loopedin-446520-c3e0d129ffce.json');
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  credentials,
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'loop-media-storage';

// Ensure bucket exists
async function initializeBucket() {
  try {
    const [exists] = await storage.bucket(bucketName).exists();
    if (!exists) {
      await storage.createBucket(bucketName, {
        location: 'US',
        storageClass: 'STANDARD',
      });
      console.log(`Bucket ${bucketName} created.`);
    }
  } catch (error) {
    console.error('Error initializing bucket:', error);
    throw error;
  }
}

// Upload media from URL to Google Cloud Storage
export async function uploadMediaFromUrl(mediaUrl: string, userId: number): Promise<string> {
  try {
    // Download the media from Twilio
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from ${mediaUrl}`);
    }

    const buffer = await response.buffer();
    const fileName = `user-${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const file = storage.bucket(bucketName).file(fileName);

    // Upload to Google Cloud Storage
    await file.save(buffer, {
      metadata: {
        contentType: response.headers.get('content-type') || 'application/octet-stream',
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Return the public URL
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

// Initialize bucket when the module loads
initializeBucket().catch(console.error);