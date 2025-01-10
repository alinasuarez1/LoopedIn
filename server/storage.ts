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

// Ensure bucket exists and is properly configured
async function initializeBucket() {
  try {
    console.log('Checking if bucket exists:', bucketName);
    const [exists] = await storage.bucket(bucketName).exists();

    if (!exists) {
      console.log('Bucket does not exist, creating...');
      await storage.createBucket(bucketName, {
        location: 'US',
        storageClass: 'STANDARD',
      });
      console.log(`Bucket ${bucketName} created successfully`);
    } else {
      console.log('Bucket already exists');
    }

    // Configure CORS
    try {
      console.log('Configuring CORS for bucket');
      await storage.bucket(bucketName).setCorsConfiguration([
        {
          maxAgeSeconds: 3600,
          method: ['GET', 'HEAD', 'OPTIONS'],
          origin: ['*'],
          responseHeader: ['Content-Type'],
        },
      ]);
      console.log('CORS configuration successful');
    } catch (corsError) {
      console.warn('CORS configuration failed:', corsError);
      // Continue even if CORS fails as the bucket might still work
    }

    // Make bucket public
    try {
      console.log('Setting bucket public access');
      await storage.bucket(bucketName).makePublic();
      console.log('Bucket public access configured successfully');
    } catch (publicError) {
      console.warn('Failed to make bucket public:', publicError);
      // Continue as the bucket might already be public
    }

  } catch (error) {
    console.error('Error during bucket initialization:', error);
    // Log error but don't throw - the bucket might still be usable
  }
}

// Upload media from URL to Google Cloud Storage
export async function uploadMediaFromUrl(mediaUrl: string, userId: number): Promise<string> {
  try {
    console.log(`Starting upload process for media from URL: ${mediaUrl}`);

    // Download the media from Twilio
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from ${mediaUrl}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log(`Media content type: ${contentType}`);

    const buffer = await response.buffer();
    const fileName = `user-${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log(`Uploading to GCS with filename: ${fileName}`);

    const file = storage.bucket(bucketName).file(fileName);

    // Upload to Google Cloud Storage with proper content type
    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
      public: true,
      validation: 'md5',
    });

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log(`Successfully uploaded media. Public URL: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

// Initialize bucket when the module loads
console.log('Starting storage service initialization');
initializeBucket().catch(console.error);