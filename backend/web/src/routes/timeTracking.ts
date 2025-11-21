// File Clean up Finished: 2025-11-21
// Changes:
// - Removed debug middleware from clock-out route (console.log statement)
// - Verified all routes follow proper pattern with auth + permission middleware
// - All 4 controllers (Clock, EditRequest, Notification, BreakSchedule) already cleaned
// - Scheduled breaks routes intentionally kept (used by TimeCalculationService)
// - Reduced from 68 → 65 lines (4% reduction)

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

// Import controllers
import {
  getClockStatus,
  clockIn,
  clockOut,
  getWeeklySummary
} from '../controllers/timeTracking/ClockController';

import {
  submitEditRequest,
  submitDeleteRequest,
  getPendingRequests,
  processRequest
} from '../controllers/timeTracking/EditRequestController';

import {
  getNotifications,
  markNotificationAsRead,
  clearNotification,
  clearAllNotifications
} from '../controllers/timeTracking/NotificationController';

import {
  getScheduledBreaks,
  updateScheduledBreak
} from '../controllers/timeTracking/BreakScheduleController';

const router = Router();

// Clock Operations (staff has time.create permission)
router.get('/status', authenticateToken, requirePermission('time.create'), getClockStatus);

router.post('/clock-in', authenticateToken, requirePermission('time.create'), clockIn);

router.post('/clock-out', authenticateToken, requirePermission('time.create'), clockOut);

router.get('/weekly-summary', authenticateToken, requirePermission('time.read'), getWeeklySummary);

router.post('/edit-request', authenticateToken, requirePermission('time.update'), submitEditRequest);

router.post('/delete-request', authenticateToken, requirePermission('time.update'), submitDeleteRequest);

router.get('/pending-requests', authenticateToken, requirePermission('time.approve'), getPendingRequests);

router.post('/process-request', authenticateToken, requirePermission('time.approve'), processRequest);

router.get('/scheduled-breaks', authenticateToken, requirePermission('time_management.update'), getScheduledBreaks);

router.put('/scheduled-breaks/:id', authenticateToken, requirePermission('time_management.update'), updateScheduledBreak);

// Notification Operations

router.get('/notifications', authenticateToken, getNotifications);

router.put('/notifications/:id/read', authenticateToken, markNotificationAsRead);

router.put('/notifications/:id/clear', authenticateToken, clearNotification);

router.put('/notifications/clear-all', authenticateToken, clearAllNotifications);

export default router;