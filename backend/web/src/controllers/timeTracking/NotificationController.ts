import { Request, Response } from 'express';
import { NotificationService } from '../../services/timeTracking/NotificationService';
import { AuthRequest } from '../../types';

/**
 * Notification Controller
 * Handles HTTP requests for notification management operations
 */

/**
 * Get notifications for current user
 * GET /api/time/notifications?showCleared=false
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const showCleared = req.query.showCleared === 'true';
    const notifications = await NotificationService.getUserNotifications(user, showCleared);
    res.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications' 
    });
  }
};

/**
 * Mark notification as read
 * PUT /api/time/notifications/:id/read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid notification ID' 
      });
    }

    const result = await NotificationService.markAsRead(user, notificationId);
    res.json(result);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    
    if (error.message === 'Notification not found') {
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read' 
    });
  }
};

/**
 * Clear notification (hide from default view)
 * PUT /api/time/notifications/:id/clear
 */
export const clearNotification = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid notification ID' 
      });
    }

    const result = await NotificationService.clearNotification(user, notificationId);
    res.json(result);
  } catch (error: any) {
    console.error('Error clearing notification:', error);
    
    if (error.message === 'Notification not found') {
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear notification' 
    });
  }
};

/**
 * Clear all notifications for the user
 * PUT /api/time/notifications/clear-all
 */
export const clearAllNotifications = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await NotificationService.clearAllNotifications(user);
    res.json(result);
  } catch (error: any) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear all notifications' 
    });
  }
};