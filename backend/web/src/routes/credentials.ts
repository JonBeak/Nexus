// File Clean up Finished: Nov 14, 2025
/**
 * Credential Management Routes
 *
 * Changes:
 * - Refactored to 3-layer architecture (Route → Controller → Service → Repository)
 * - Moved all HTTP handlers to CredentialController
 * - Reduced from 267 lines to ~50 lines (81% reduction)
 * - Eliminated code duplication (7x error handlers → standardized in controller)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as CredentialController from '../controllers/credentialController';

const router = Router();

// All credential routes require authentication and Manager+ permissions
router.use(authenticateToken);
router.use(requirePermission('manage_settings'));

// =============================================
// QUICKBOOKS CREDENTIAL ROUTES
// =============================================

// Set up or update QuickBooks credentials
router.post('/quickbooks/setup', CredentialController.setupQuickBooksCredentials);

// Check if QuickBooks credentials are configured (without exposing values)
router.get('/quickbooks/status', CredentialController.getQuickBooksStatus);

// Update specific QuickBooks credential fields
router.put('/quickbooks/update', CredentialController.updateQuickBooksCredentials);

// Remove QuickBooks credentials
router.delete('/quickbooks', CredentialController.deleteQuickBooksCredentials);

// =============================================
// ENCRYPTION SERVICE ROUTES
// =============================================

// Test that encryption is working correctly
router.post('/test-encryption', CredentialController.testEncryption);

// List all services with configured credentials (names only, no values)
router.get('/services', CredentialController.listServices);

export default router;