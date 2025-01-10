import { Storage } from '@google-cloud/storage';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import path from 'path';

// Initialize storage client with credentials from JSON file
const credentialsPath = path.join(process.cwd(), 'attached_assets', 'loopedin-446520-c3e0d129ffce.json');
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));

const storage = new Storage({
  projectId: credentials.project_id,
  credentials,
});

const bucketName = 'loop-media-storage';
let bucket = storage.bucket(bucketName);

// Ensure bucket exists and is properly configured
async function initializeBucket() {
  try {
    console.log('Checking if bucket exists:', bucketName);
    const [exists] = await bucket.exists();

    if (!exists) {
      console.log('Creating storage bucket:', bucketName);
      [bucket] = await storage.createBucket(bucketName, {
        location: 'US',
        storageClass: 'STANDARD'
      });
    }

    // Configure CORS
    try {
      console.log('Configuring CORS for bucket');
      await bucket.setCorsConfiguration([
        {
          maxAgeSeconds: 3600,
          method: ['GET', 'HEAD', 'OPTIONS'],
          origin: ['*'],
          responseHeader: ['Content-Type', 'Content-Length', 'Accept-Ranges'],
        },
      ]);
      console.log('CORS configuration successful');
    } catch (corsError) {
      console.error('CORS configuration failed:', corsError);
    }

    // Make bucket public
    try {
      console.log('Making bucket public');
      await bucket.makePublic();
      console.log('Bucket public access configured successfully');
    } catch (publicError) {
      console.error('Failed to make bucket public:', publicError);
    }

    console.log('Storage initialized successfully');
  } catch (error) {
    console.error('Error initializing storage:', error);
    throw error;
  }
}

// Upload media from URL to Google Cloud Storage
export async function uploadMediaFromUrl(mediaUrl: string, userId: number): Promise<string> {
  try {
    console.log('Starting upload from URL:', mediaUrl);

    // Download the media from Twilio
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from ${mediaUrl}: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type');

    // Create a unique filename with proper extension based on content type
    const extension = contentType?.split('/')[1] || 'jpg';
    const filename = `media/user-${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const file = bucket.file(filename);

    console.log('Uploading to GCS with filename:', filename);

    // Upload to Google Cloud Storage
    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000',
      },
      resumable: false,
      validation: 'md5'
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Return the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
    console.log('Successfully uploaded media. Public URL:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

// Initialize storage when the module loads
console.log('Starting storage service initialization');
initializeBucket().catch(console.error);