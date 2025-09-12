import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  acquireLock,
  releaseLock,
  checkLock,
  overrideLock,
  getResourceLocks,
  getAllActiveLocks,
  cleanupExpiredLocks
} from '../controllers/lockController';

const router = express.Router();

// All lock routes require authentication
router.use(authenticateToken);

// Core lock operations
router.post('/acquire', acquireLock);
router.post('/release', releaseLock);
router.get('/check/:resource_type/:resource_id', checkLock);
router.post('/override', overrideLock);

// Admin functions
router.get('/resource/:resource_type', getResourceLocks);
router.get('/active', getAllActiveLocks);
router.post('/cleanup', cleanupExpiredLocks);

export default router;