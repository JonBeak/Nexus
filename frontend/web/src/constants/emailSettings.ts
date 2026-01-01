/**
 * Email Settings Constants
 *
 * Frontend constants for email-related functionality.
 * Must match backend configuration in gmailService.ts (GMAIL_BCC_EMAIL env var).
 */

// Company BCC email - all outgoing emails are BCC'd to this address
// This matches the backend GMAIL_BCC_EMAIL environment variable
export const COMPANY_BCC_EMAIL = 'info@signhouse.ca';

// Email recipient types
export type RecipientType = 'to' | 'cc' | 'bcc';

// Interface for tracking recipient selections with type
export interface RecipientSelection {
  email: string;
  name?: string;
  type: RecipientType;
}
