// File Clean up Finished: Nov 14, 2025
// Changes (Initial):
// - Added IP address and user agent extraction from request
// - Now passes audit trail info (clientIp, userAgent) to service layer
// - Enhanced logging to include IP address
//
// Changes (Final Cleanup):
// - Removed dead code endpoints and methods (35 lines)
// - Fixed missing clientIp/userAgent in listServices() method
// - Reduced file size from 302 lines to 274 lines (9.3% reduction)
/**
 * Credential Controller
 *
 * HTTP request/response handlers for credential management
 * Created: Nov 14, 2025 during routes/credentials.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { CredentialService } from '../services/credentialService';
import { EncryptionService } from '../services/encryptionService';
import { QuickBooksCredentials } from '../types/credentials';

const credentialService = CredentialService.getInstance();

// =============================================
// QUICKBOOKS CREDENTIAL ENDPOINTS
// =============================================

/**
 * POST /api/credentials/quickbooks/setup
 * Set up or update QuickBooks credentials
 */
export const setupQuickBooksCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { client_id, client_secret, redirect_uri, environment } = req.body;

    // Extract client info for audit trail
    const clientIp = req.ip || req.socket.remoteAddress || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Validate required fields
    if (!client_id || !client_secret) {
      res.status(400).json({
        success: false,
        error: 'client_id and client_secret are required',
      });
      return;
    }

    // Validate environment if provided
    if (environment && !['sandbox', 'production'].includes(environment)) {
      res.status(400).json({
        success: false,
        error: 'environment must be either "sandbox" or "production"',
      });
      return;
    }

    // Store encrypted credentials
    const credentials: QuickBooksCredentials = {
      client_id,
      client_secret,
      redirect_uri: redirect_uri || process.env.QB_REDIRECT_URI,
      environment: environment || 'sandbox',
    };

    await credentialService.setQuickBooksCredentials(credentials, req.user?.user_id, clientIp, userAgent);

    console.log(`✅ QuickBooks credentials stored securely by user ${req.user?.user_id} from ${clientIp}`);

    res.json({
      success: true,
      message: 'QuickBooks credentials stored securely',
      environment: credentials.environment,
    });
  } catch (error) {
    console.error('Error storing QuickBooks credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store credentials',
    });
  }
};

/**
 * GET /api/credentials/quickbooks/status
 * Check if QuickBooks credentials are configured (without exposing them)
 */
export const getQuickBooksStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Extract client info for audit trail
    const clientIp = req.ip || req.socket.remoteAddress || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const credentials = await credentialService.getQuickBooksCredentials(req.user?.user_id, clientIp, userAgent);

    if (!credentials) {
      res.json({
        configured: false,
        message: 'QuickBooks credentials not configured',
      });
      return;
    }

    // Never expose actual credentials, just configuration status
    res.json({
      configured: true,
      environment: credentials.environment || 'sandbox',
      hasClientId: !!credentials.client_id,
      hasClientSecret: !!credentials.client_secret,
      hasRedirectUri: !!credentials.redirect_uri,
      message: 'QuickBooks credentials are configured',
    });
  } catch (error) {
    console.error('Error checking QuickBooks credential status:', error);
    res.status(500).json({
      configured: false,
      error: 'Failed to check credential status',
    });
  }
};

/**
 * PUT /api/credentials/quickbooks/update
 * Update specific QuickBooks credential fields
 */
export const updateQuickBooksCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = req.body;

    // Extract client info for audit trail
    const clientIp = req.ip || req.socket.remoteAddress || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Get existing credentials
    const existing = await credentialService.getQuickBooksCredentials(req.user?.user_id, clientIp, userAgent);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'No QuickBooks credentials found to update',
      });
      return;
    }

    // Merge updates with existing
    const updated: QuickBooksCredentials = {
      client_id: updates.client_id || existing.client_id,
      client_secret: updates.client_secret || existing.client_secret,
      redirect_uri: updates.redirect_uri || existing.redirect_uri,
      environment: updates.environment || existing.environment,
    };

    await credentialService.setQuickBooksCredentials(updated, req.user?.user_id, clientIp, userAgent);

    console.log(`✅ QuickBooks credentials updated by user ${req.user?.user_id} from ${clientIp}`);

    res.json({
      success: true,
      message: 'QuickBooks credentials updated',
      environment: updated.environment,
    });
  } catch (error) {
    console.error('Error updating QuickBooks credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update credentials',
    });
  }
};

/**
 * DELETE /api/credentials/quickbooks
 * Remove QuickBooks credentials
 */
export const deleteQuickBooksCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Extract client info for audit trail
    const clientIp = req.ip || req.socket.remoteAddress || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const credentials = await credentialService.getQuickBooksCredentials(req.user?.user_id, clientIp, userAgent);

    if (!credentials) {
      res.status(404).json({
        success: false,
        error: 'No QuickBooks credentials found',
      });
      return;
    }

    // Delete all QuickBooks credentials
    await credentialService.deleteCredential('quickbooks', 'client_id', req.user?.user_id, clientIp, userAgent);
    await credentialService.deleteCredential('quickbooks', 'client_secret', req.user?.user_id, clientIp, userAgent);
    await credentialService.deleteCredential('quickbooks', 'redirect_uri', req.user?.user_id, clientIp, userAgent);
    await credentialService.deleteCredential('quickbooks', 'environment', req.user?.user_id, clientIp, userAgent);

    console.log(`✅ QuickBooks credentials deleted by user ${req.user?.user_id} from ${clientIp}`);

    res.json({
      success: true,
      message: 'QuickBooks credentials removed',
    });
  } catch (error) {
    console.error('Error deleting QuickBooks credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete credentials',
    });
  }
};

// =============================================
// ENCRYPTION SERVICE ENDPOINTS
// =============================================

/**
 * POST /api/credentials/test-encryption
 * Test that encryption is working correctly
 */
export const testEncryption = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const encryptionService = EncryptionService.getInstance();
    const testResult = encryptionService.selfTest();

    res.json({
      success: testResult,
      message: testResult ? 'Encryption service is working correctly' : 'Encryption test failed',
    });
  } catch (error) {
    console.error('Encryption test error:', error);
    res.status(500).json({
      success: false,
      error: 'Encryption service error',
    });
  }
};

/**
 * GET /api/credentials/services
 * List all services with configured credentials (names only, no values)
 */
export const listServices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Extract client info for audit trail
    const clientIp = req.ip || req.socket.remoteAddress || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // For now, just check QuickBooks
    const qbCreds = await credentialService.getQuickBooksCredentials(req.user?.user_id, clientIp, userAgent);

    const services = [];
    if (qbCreds) {
      services.push({
        service: 'quickbooks',
        configured: true,
        environment: qbCreds.environment,
      });
    }

    res.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Error listing credential services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list services',
    });
  }
};
