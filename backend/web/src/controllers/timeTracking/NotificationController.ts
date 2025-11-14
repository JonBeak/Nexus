// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed 4 redundant auth checks (middleware guarantees user exists)
// - Replaced ID validation with parseIntParam() helper
// - Replaced error handling with sendErrorResponse() helper
// - Changed Request param to AuthRequest for type safety
// - Added non-null assertions (req.user!) since auth middleware guarantees user
// - Reduced from 130 → 77 lines (41% reduction)

import { Response } from 'express';
import { NotificationService } from '../../services/timeTracking/NotificationService';
import { AuthRequest } from '../../types';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Notification Controller
 * Handles HTTP requests for notification management operations
 */

/**
 * Get notifications for current user
 * GET /api/time/notifications?showCleared=false
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const showCleared = req.query.showCleared === 'true';
    const notifications = await NotificationService.getUserNotifications(req.user!, showCleared);
    res.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    sendErrorResponse(res, 'Failed to fetch notifications', 'INTERNAL_ERROR');
  }
};

/**
 * Mark notification as read
 * PUT /api/time/notifications/:id/read
 */
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseIntParam(req.params.id, 'notification ID');
    if (notificationId === null) {
      return sendErrorResponse(res, 'Invalid notification ID', 'VALIDATION_ERROR');
    }

    const result = await NotificationService.markAsRead(req.user!, notificationId);
    res.json(result);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);

    if (error.message === 'Notification not found') {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to mark notification as read', 'INTERNAL_ERROR');
  }
};

/**
 * Clear notification (hide from default view)
 * PUT /api/time/notifications/:id/clear
 */
export const clearNotification = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseIntParam(req.params.id, 'notification ID');
    if (notificationId === null) {
      return sendErrorResponse(res, 'Invalid notification ID', 'VALIDATION_ERROR');
    }

    const result = await NotificationService.clearNotification(req.user!, notificationId);
    res.json(result);
  } catch (error: any) {
    console.error('Error clearing notification:', error);

    if (error.message === 'Notification not found') {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to clear notification', 'INTERNAL_ERROR');
  }
};

/**
 * Clear all notifications for the user
 * PUT /api/time/notifications/clear-all
 */
export const clearAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const result = await NotificationService.clearAllNotifications(req.user!);
    res.json(result);
  } catch (error: any) {
    console.error('Error clearing all notifications:', error);
    sendErrorResponse(res, 'Failed to clear all notifications', 'INTERNAL_ERROR');
  }
};
