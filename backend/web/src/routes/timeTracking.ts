import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

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

// Clock Operations
router.get('/status', authenticateToken, getClockStatus);

router.post('/clock-in', authenticateToken, clockIn);

router.post('/clock-out', (req, res, next) => {
  console.log('🛣️ ROUTE DEBUG - Clock out route hit');
  next();
}, authenticateToken, clockOut);

router.get('/weekly-summary', authenticateToken, getWeeklySummary);

router.post('/edit-request', authenticateToken, submitEditRequest);

router.post('/delete-request', authenticateToken, submitDeleteRequest);

router.get('/pending-requests', authenticateToken, getPendingRequests);

router.post('/process-request', authenticateToken, processRequest);

router.get('/scheduled-breaks', authenticateToken, getScheduledBreaks);

router.put('/scheduled-breaks/:id', authenticateToken, updateScheduledBreak);

// Notification Operations

router.get('/notifications', authenticateToken, getNotifications);

router.put('/notifications/:id/read', authenticateToken, markNotificationAsRead);

router.put('/notifications/:id/clear', authenticateToken, clearNotification);

router.put('/notifications/clear-all', authenticateToken, clearAllNotifications);

export default router;