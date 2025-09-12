import { Request, Response } from 'express';
import { BreakScheduleService } from '../../services/timeTracking/BreakScheduleService';
import { AuthRequest } from '../../types';

/**
 * Break Schedule Controller
 * Handles HTTP requests for scheduled breaks management
 */

/**
 * Get scheduled breaks (for settings page)
 * GET /api/time/scheduled-breaks
 */
export const getScheduledBreaks = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const breaks = await BreakScheduleService.getScheduledBreaks(user);
    res.json(breaks);
  } catch (error: any) {
    console.error('Error fetching scheduled breaks:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch scheduled breaks' 
    });
  }
};

/**
 * Update scheduled break (managers only)
 * PUT /api/time/scheduled-breaks/:id
 */
export const updateScheduledBreak = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const breakId = parseInt(req.params.id);
    if (isNaN(breakId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid break ID' 
      });
    }

    const { start_time, end_time, duration_minutes, days_of_week } = req.body;

    const result = await BreakScheduleService.updateScheduledBreak(user, breakId, {
      start_time,
      end_time,
      duration_minutes,
      days_of_week
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error updating scheduled break:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    if (error.message.includes('required') || 
        error.message.includes('Invalid') || 
        error.message.includes('Duration')) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update scheduled break' 
    });
  }
};