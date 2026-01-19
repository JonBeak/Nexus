/**
 * Google Drive Service
 *
 * Handles file uploads to Google Drive using service account with domain-wide delegation.
 * Used for storing feedback screenshots externally instead of in the database.
 *
 * Created: 2026-01-16
 */

import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { credentialService } from './credentialService';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Drive API Configuration
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file' // Only access files created by this app
];

// Folder name for feedback screenshots in Drive
const FEEDBACK_FOLDER_NAME = 'Nexus Feedback Screenshots';

// =============================================================================
// Screenshot Cache
// =============================================================================

interface CacheEntry {
  data: string;
  mimeType: string;
  expiresAt: number;
}

// In-memory cache for screenshots (reduces Drive API calls)
const screenshotCache = new Map<string, CacheEntry>();

// Cache TTL: 15 minutes
const CACHE_TTL_MS = 15 * 60 * 1000;

// Max cache size (to prevent memory bloat) - approx 50 screenshots
const MAX_CACHE_ENTRIES = 50;

/**
 * Clean expired entries from cache
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of screenshotCache.entries()) {
    if (entry.expiresAt < now) {
      screenshotCache.delete(key);
    }
  }
}

/**
 * Add entry to cache with size management
 */
function addToCache(fileId: string, data: string, mimeType: string): void {
  // Clean expired first
  cleanExpiredCache();

  // If still at max, remove oldest entries
  if (screenshotCache.size >= MAX_CACHE_ENTRIES) {
    const entriesToRemove = screenshotCache.size - MAX_CACHE_ENTRIES + 1;
    const keys = screenshotCache.keys();
    for (let i = 0; i < entriesToRemove; i++) {
      const key = keys.next().value;
      if (key) screenshotCache.delete(key);
    }
  }

  screenshotCache.set(fileId, {
    data,
    mimeType,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

/**
 * Get entry from cache if not expired
 */
function getFromCache(fileId: string): { data: string; mimeType: string } | null {
  const entry = screenshotCache.get(fileId);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    screenshotCache.delete(fileId);
    return null;
  }

  return { data: entry.data, mimeType: entry.mimeType };
}

/**
 * Remove entry from cache (called when screenshot is deleted)
 */
function removeFromCache(fileId: string): void {
  screenshotCache.delete(fileId);
}

// =============================================================================

/**
 * Service account credentials structure
 */
interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Drive Service Error
 */
export class DriveServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveServiceError';
  }
}

// Cache for folder ID to avoid repeated lookups
let cachedFolderId: string | null = null;

/**
 * Load service account credentials from encrypted storage
 */
async function loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
  try {
    const serviceAccountPath = await credentialService.getCredential('gmail', 'service_account_path');

    if (!serviceAccountPath) {
      throw new DriveServiceError(
        'Service account path not configured. Run: npm run setup:gmail-credentials'
      );
    }

    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);

    if (!fs.existsSync(absolutePath)) {
      throw new DriveServiceError(`Service account file not found: ${absolutePath}`);
    }

    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    const credentials = JSON.parse(fileContent) as ServiceAccountCredentials;

    if (!credentials.private_key || !credentials.client_email) {
      throw new DriveServiceError('Invalid service account JSON');
    }

    return credentials;
  } catch (error) {
    if (error instanceof DriveServiceError) throw error;
    throw new DriveServiceError(
      `Failed to load service account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create authenticated Google Drive API client
 */
async function createDriveClient(): Promise<drive_v3.Drive> {
  const credentials = await loadServiceAccountCredentials();

  const jwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: DRIVE_SCOPES,
    subject: GMAIL_SENDER_EMAIL
  });

  return google.drive({ version: 'v3', auth: jwtClient });
}

/**
 * Get or create the feedback screenshots folder
 */
async function getFeedbackFolderId(drive: drive_v3.Drive): Promise<string> {
  // Return cached if available
  if (cachedFolderId) {
    return cachedFolderId;
  }

  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${FEEDBACK_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files && response.data.files.length > 0) {
      cachedFolderId = response.data.files[0].id!;
      console.log(`[Drive] Found existing folder: ${cachedFolderId}`);
      return cachedFolderId;
    }

    // Create folder if it doesn't exist
    const folderResponse = await drive.files.create({
      requestBody: {
        name: FEEDBACK_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    cachedFolderId = folderResponse.data.id!;
    console.log(`[Drive] Created feedback folder: ${cachedFolderId}`);
    return cachedFolderId;

  } catch (error) {
    console.error('[Drive] Error getting/creating folder:', error);
    throw new DriveServiceError('Failed to get or create feedback folder');
  }
}

/**
 * Upload a screenshot to Google Drive
 *
 * @param base64Data - Base64 encoded image data (without data: prefix)
 * @param filename - Original filename
 * @param mimeType - Image MIME type (e.g., 'image/png')
 * @param feedbackId - Associated feedback ID (for filename)
 * @returns Drive file ID
 */
export async function uploadScreenshot(
  base64Data: string,
  filename: string,
  mimeType: string,
  feedbackId: number
): Promise<string> {
  try {
    console.log(`[Drive] Uploading screenshot for feedback #${feedbackId}...`);

    const drive = await createDriveClient();
    const folderId = await getFeedbackFolderId(drive);

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    const stream = Readable.from(buffer);

    // Create unique filename with feedback ID
    const ext = filename.split('.').pop() || 'png';
    const driveFilename = `feedback_${feedbackId}_${Date.now()}.${ext}`;

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: driveFilename,
        parents: [folderId],
        description: `Feedback screenshot for request #${feedbackId}`
      },
      media: {
        mimeType: mimeType,
        body: stream
      },
      fields: 'id, webContentLink'
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new DriveServiceError('No file ID returned from Drive upload');
    }

    console.log(`[Drive] Screenshot uploaded: ${fileId} (${Math.round(buffer.length / 1024)}KB)`);
    return fileId;

  } catch (error) {
    console.error('[Drive] Upload error:', error);
    throw new DriveServiceError(
      `Failed to upload screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get screenshot data from Google Drive (with caching)
 *
 * @param fileId - Google Drive file ID
 * @returns Object with base64 data and mime type
 */
export async function getScreenshot(fileId: string): Promise<{
  data: string;
  mimeType: string;
} | null> {
  // Check cache first
  const cached = getFromCache(fileId);
  if (cached) {
    console.log(`[Drive] Screenshot served from cache: ${fileId}`);
    return cached;
  }

  try {
    const drive = await createDriveClient();

    // Get file metadata for mime type
    const metaResponse = await drive.files.get({
      fileId: fileId,
      fields: 'mimeType'
    });

    const mimeType = metaResponse.data.mimeType || 'image/png';

    // Download file content
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data as ArrayBuffer);
    const base64 = buffer.toString('base64');

    // Add to cache for future requests
    addToCache(fileId, base64, mimeType);
    console.log(`[Drive] Screenshot fetched and cached: ${fileId} (${Math.round(buffer.length / 1024)}KB)`);

    return {
      data: base64,
      mimeType: mimeType
    };

  } catch (error: any) {
    if (error.code === 404) {
      console.warn(`[Drive] File not found: ${fileId}`);
      return null;
    }
    console.error('[Drive] Error fetching screenshot:', error);
    throw new DriveServiceError(
      `Failed to get screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a screenshot from Google Drive
 *
 * @param fileId - Google Drive file ID
 */
export async function deleteScreenshot(fileId: string): Promise<void> {
  try {
    const drive = await createDriveClient();

    await drive.files.delete({
      fileId: fileId
    });

    // Remove from cache
    removeFromCache(fileId);

    console.log(`[Drive] Screenshot deleted: ${fileId}`);

  } catch (error: any) {
    if (error.code === 404) {
      // Still remove from cache if it was there
      removeFromCache(fileId);
      console.warn(`[Drive] File already deleted or not found: ${fileId}`);
      return;
    }
    console.error('[Drive] Delete error:', error);
    throw new DriveServiceError(
      `Failed to delete screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete multiple screenshots (for cleanup)
 *
 * @param fileIds - Array of Google Drive file IDs
 */
export async function deleteScreenshots(fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    try {
      await deleteScreenshot(fileId);
    } catch (error) {
      // Log but continue with other deletions
      console.error(`[Drive] Failed to delete ${fileId}:`, error);
    }
  }
}

/**
 * Test Drive API connection
 */
export async function testDriveConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const drive = await createDriveClient();

    // Try to list files (limited to 1)
    await drive.files.list({
      pageSize: 1,
      fields: 'files(id)'
    });

    console.log('[Drive] Connection test successful');
    return { success: true };

  } catch (error: any) {
    console.error('[Drive] Connection test failed:', error);

    let errorMessage = 'Unknown error';
    if (error.code === 403) {
      errorMessage = 'Access denied. Add Drive scope to domain-wide delegation.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}
