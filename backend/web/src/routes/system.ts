/**
 * System Routes - Owner-only system administration endpoints
 * Created: Dec 10, 2025
 */
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getBackupStatus } from '../controllers/systemController';

const router = Router();

/**
 * GET /api/system/backup-status
 * Returns backup status information for the dashboard
 * Owner only
 */
router.get('/backup-status', authenticateToken, requireRole('owner'), getBackupStatus);

export default router;
