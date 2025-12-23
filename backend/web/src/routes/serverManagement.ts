/**
 * Server Management Routes
 * Created: Dec 23, 2025
 *
 * Routes for the Server Management GUI - owner only.
 * Provides endpoints for managing builds, restarts, and backups.
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as controller from '../controllers/serverManagementController';

const router = Router();

// All routes require owner role
const ownerOnly = [authenticateToken, requireRole('owner')];

// Status endpoint
router.get('/status', ...ownerOnly, controller.getStatus);

// Backend operations
router.post('/backend/rebuild-dev', ...ownerOnly, controller.rebuildBackendDev);
router.post('/backend/rebuild-prod', ...ownerOnly, controller.rebuildBackendProd);
router.post('/backend/restart-dev', ...ownerOnly, controller.restartBackendDev);
router.post('/backend/restart-prod', ...ownerOnly, controller.restartBackendProd);

// Frontend operations
router.post('/frontend/rebuild-dev', ...ownerOnly, controller.rebuildFrontendDev);
router.post('/frontend/rebuild-prod', ...ownerOnly, controller.rebuildFrontendProd);

// Combined operations
router.post('/rebuild-all-dev', ...ownerOnly, controller.rebuildAllDev);
router.post('/rebuild-all-prod', ...ownerOnly, controller.rebuildAllProd);

// Backup operations
router.get('/backups', ...ownerOnly, controller.listBackups);
router.post('/backups/create', ...ownerOnly, controller.createBackup);
router.post('/backups/database', ...ownerOnly, controller.backupDatabase);
router.post('/backups/restore', ...ownerOnly, controller.restoreBackup);
router.post('/backups/note', ...ownerOnly, controller.saveBackupNote);
router.post('/backups/cleanup', ...ownerOnly, controller.cleanupBackups);

export default router;
