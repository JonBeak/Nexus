/**
 * Credential Management Routes
 * Secure API endpoints for managing encrypted credentials
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { credentialService } from '../services/credentialService';
import { EncryptionService } from '../services/encryptionService';
import { QuickBooksCredentials } from '../types/credentials';

const router = Router();

// All credential routes require authentication and Manager+ permissions
router.use(authenticateToken);
router.use(requirePermission('manage_settings'));

// =============================================
// QUICKBOOKS CREDENTIAL ROUTES
// =============================================

/**
 * POST /api/credentials/quickbooks/setup
 * Set up or update QuickBooks credentials
 */
router.post('/quickbooks/setup', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, client_secret, redirect_uri, environment } = req.body;

    // Validate required fields
    if (!client_id || !client_secret) {
      return res.status(400).json({
        success: false,
        error: 'client_id and client_secret are required',
      });
    }

    // Validate environment if provided
    if (environment && !['sandbox', 'production'].includes(environment)) {
      return res.status(400).json({
        success: false,
        error: 'environment must be either "sandbox" or "production"',
      });
    }

    // Store encrypted credentials
    const credentials: QuickBooksCredentials = {
      client_id,
      client_secret,
      redirect_uri: redirect_uri || process.env.QB_REDIRECT_URI,
      environment: environment || 'sandbox',
    };

    await credentialService.setQuickBooksCredentials(credentials, req.user?.user_id);

    console.log(`✅ QuickBooks credentials stored securely by user ${req.user?.user_id}`);

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
});

/**
 * GET /api/credentials/quickbooks/status
 * Check if QuickBooks credentials are configured (without exposing them)
 */
router.get('/quickbooks/status', async (req: AuthRequest, res: Response) => {
  try {
    const credentials = await credentialService.getQuickBooksCredentials(req.user?.user_id);

    if (!credentials) {
      return res.json({
        configured: false,
        message: 'QuickBooks credentials not configured',
      });
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
});

/**
 * PUT /api/credentials/quickbooks/update
 * Update specific QuickBooks credential fields
 */
router.put('/quickbooks/update', async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;

    // Get existing credentials
    const existing = await credentialService.getQuickBooksCredentials(req.user?.user_id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'No QuickBooks credentials found to update',
      });
    }

    // Merge updates with existing
    const updated: QuickBooksCredentials = {
      client_id: updates.client_id || existing.client_id,
      client_secret: updates.client_secret || existing.client_secret,
      redirect_uri: updates.redirect_uri || existing.redirect_uri,
      environment: updates.environment || existing.environment,
    };

    await credentialService.setQuickBooksCredentials(updated, req.user?.user_id);

    console.log(`✅ QuickBooks credentials updated by user ${req.user?.user_id}`);

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
});

/**
 * DELETE /api/credentials/quickbooks
 * Remove QuickBooks credentials
 */
router.delete('/quickbooks', async (req: AuthRequest, res: Response) => {
  try {
    const credentials = await credentialService.getQuickBooksCredentials(req.user?.user_id);

    if (!credentials) {
      return res.status(404).json({
        success: false,
        error: 'No QuickBooks credentials found',
      });
    }

    // Delete all QuickBooks credentials
    await credentialService.deleteCredential('quickbooks', 'client_id', req.user?.user_id);
    await credentialService.deleteCredential('quickbooks', 'client_secret', req.user?.user_id);
    await credentialService.deleteCredential('quickbooks', 'redirect_uri', req.user?.user_id);
    await credentialService.deleteCredential('quickbooks', 'environment', req.user?.user_id);

    console.log(`✅ QuickBooks credentials deleted by user ${req.user?.user_id}`);

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
});

// =============================================
// ENCRYPTION SERVICE ROUTES
// =============================================

/**
 * POST /api/credentials/test-encryption
 * Test that encryption is working correctly
 */
router.post('/test-encryption', async (req: AuthRequest, res: Response) => {
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
});

/**
 * POST /api/credentials/rotate-keys
 * Rotate encryption keys (requires Owner permission)
 * WARNING: This will re-encrypt all credentials
 */
router.post('/rotate-keys', requirePermission('manage_company'), async (req: AuthRequest, res: Response) => {
  try {
    // This would need implementation of key rotation logic
    // Including re-encrypting all existing credentials

    res.status(501).json({
      success: false,
      message: 'Key rotation not yet implemented',
    });
  } catch (error) {
    console.error('Key rotation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate encryption keys',
    });
  }
});

/**
 * GET /api/credentials/services
 * List all services with configured credentials (names only, no values)
 */
router.get('/services', async (req: AuthRequest, res: Response) => {
  try {
    // For now, just check QuickBooks
    const qbCreds = await credentialService.getQuickBooksCredentials(req.user?.user_id);

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
});

export default router;