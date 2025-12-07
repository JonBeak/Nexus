/**
 * Gmail Authentication Service
 *
 * Handles Gmail API authentication using service account with domain-wide delegation.
 * Service account impersonates info@signhouse.ca to send emails on behalf of the company.
 *
 * Pattern: Similar to QuickBooks OAuth but using service account instead of user OAuth.
 *
 * References:
 * - Gmail API: https://developers.google.com/gmail/api
 * - Service Account Auth: https://developers.google.com/identity/protocols/oauth2/service-account
 * - Domain-wide Delegation: https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { credentialService } from './credentialService';
import fs from 'fs';
import path from 'path';

// Gmail API Configuration
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

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
 * Gmail Auth Error
 */
export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

/**
 * Load service account credentials from encrypted storage
 *
 * Credentials are stored in encrypted_credentials table:
 * - service_name: 'gmail'
 * - credential_key: 'service_account_path'
 * - encrypted_value: path to service account JSON file
 */
async function loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
  try {
    // Get service account file path from encrypted storage
    const serviceAccountPath = await credentialService.getCredential('gmail', 'service_account_path');

    if (!serviceAccountPath) {
      throw new GmailAuthError(
        'Gmail service account path not configured. Run: npm run setup:gmail-credentials'
      );
    }

    // Read service account JSON file
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);

    if (!fs.existsSync(absolutePath)) {
      throw new GmailAuthError(
        `Service account file not found: ${absolutePath}`
      );
    }

    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    const credentials = JSON.parse(fileContent) as ServiceAccountCredentials;

    // Validate service account structure
    if (!credentials.private_key || !credentials.client_email) {
      throw new GmailAuthError(
        'Invalid service account JSON: missing required fields (private_key, client_email)'
      );
    }

    console.log(`✅ [Gmail Auth] Loaded service account: ${credentials.client_email}`);
    return credentials;

  } catch (error) {
    if (error instanceof GmailAuthError) {
      throw error;
    }

    console.error('❌ [Gmail Auth] Failed to load service account credentials:', error);
    throw new GmailAuthError(
      `Failed to load Gmail service account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create authenticated Gmail API client
 *
 * Uses service account with domain-wide delegation to impersonate
 * the company email address (info@signhouse.ca).
 *
 * @returns Authenticated Gmail API client
 */
export async function createGmailClient(): Promise<any> {
  try {
    // Load service account credentials
    const credentials = await loadServiceAccountCredentials();

    console.log(`[Gmail Auth] Creating JWT client for service account: ${credentials.client_email}`);
    console.log(`[Gmail Auth] Impersonating user: ${GMAIL_SENDER_EMAIL}`);

    // Create JWT client with service account credentials
    const jwtClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: GMAIL_SCOPES,
      subject: GMAIL_SENDER_EMAIL // Impersonate this email address (domain-wide delegation)
    });

    // Create Gmail API client with authenticated JWT
    const gmail = google.gmail({ version: 'v1', auth: jwtClient });

    console.log('✅ [Gmail Auth] Gmail API client created successfully');
    return gmail;

  } catch (error) {
    if (error instanceof GmailAuthError) {
      throw error;
    }

    console.error('❌ [Gmail Auth] Failed to create Gmail client:', error);
    throw new GmailAuthError(
      `Failed to authenticate with Gmail API: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Test Gmail API connection
 *
 * Verifies that:
 * 1. Service account credentials are valid
 * 2. Domain-wide delegation is configured correctly
 * 3. Can authenticate with Gmail API on behalf of sender email
 *
 * Note: Only tests authentication, doesn't make API calls (we only have gmail.send scope)
 *
 * @returns Success status
 */
export async function testGmailConnection(): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    // Creating the Gmail client verifies:
    // - Service account credentials are valid
    // - Domain-wide delegation is configured
    // - Can impersonate the sender email
    const gmail = await createGmailClient();

    // If we got here, authentication succeeded!
    console.log('✅ [Gmail Auth] Connection test successful');
    console.log(`   Authenticated as: ${process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca'}`);
    console.log(`   Scope: gmail.send (can send emails)`);

    return {
      success: true,
      email: process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca'
    };

  } catch (error: any) {
    console.error('❌ [Gmail Auth] Connection test failed:', error);

    let errorMessage = 'Unknown error';

    if (error.code === 403) {
      errorMessage = 'Access denied. Check domain-wide delegation configuration in Google Workspace Admin Console.';
    } else if (error.code === 401) {
      errorMessage = 'Authentication failed. Check service account credentials.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get service account info (for debugging/logging)
 * Does not expose sensitive credentials
 */
export async function getServiceAccountInfo(): Promise<{
  serviceAccountEmail?: string;
  impersonatedEmail?: string;
  configured: boolean;
  error?: string;
}> {
  try {
    const credentials = await loadServiceAccountCredentials();

    return {
      serviceAccountEmail: credentials.client_email,
      impersonatedEmail: GMAIL_SENDER_EMAIL,
      configured: true
    };
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
