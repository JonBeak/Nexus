// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Analysis completed - route file is clean (30 lines, well-structured)
//   - All 7 endpoints actively used by frontend lockService
//   - Registered in server.ts at /api/locks
//   - Database: resource_locks table has 331 active estimate locks
// Cleanup Opportunities Found:
//   - lockController uses pool.execute() - should migrate to query() helper
//   - No 3-layer architecture - should create LockRepository + LockService
//   - DUPLICATE LOCK SYSTEM DETECTED:
//     * Active: resource_locks table (331 locks) - THIS ONE
//     * Legacy: job_estimates columns (0 locks, never used) - REMOVE
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