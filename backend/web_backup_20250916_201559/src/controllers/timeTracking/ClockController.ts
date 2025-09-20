import { Request, Response } from 'express';
import { ClockService } from '../../services/timeTracking/ClockService';
import { AuthRequest } from '../../types';

/**
 * Clock Controller
 * Handles HTTP requests for clock operations, status, and weekly summary
 */

/**
 * Get current clock status for a user
 * GET /api/time/status
 */
export const getClockStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await ClockService.getClockStatus(user);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching time status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch time status' 
    });
  }
};

/**
 * Clock in a user
 * POST /api/time/clock-in
 */
export const clockIn = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await ClockService.clockIn(user);
    res.json(result);
  } catch (error: any) {
    console.error('Error clocking in:', error);
    
    if (error.message === 'Already clocked in') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clock in' 
    });
  }
};

/**
 * Clock out a user
 * POST /api/time/clock-out
 */
export const clockOut = async (req: Request, res: Response) => {
  console.log('🎯 CONTROLLER DEBUG - Clock out request received');
  
  try {
    const user = (req as AuthRequest).user;
    console.log('🎯 User from token:', user);
    
    if (!user) {
      console.log('❌ CONTROLLER ERROR - No user in token');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log('🎯 Calling ClockService.clockOut...');
    const result = await ClockService.clockOut(user);
    console.log('🎯 ClockService result:', result);
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ CONTROLLER ERROR - Error clocking out:', error);
    console.error('❌ Stack trace:', error.stack);
    
    if (error.message === 'Not clocked in') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clock out' 
    });
  }
};

/**
 * Get weekly summary for a user
 * GET /api/time/weekly-summary?weekOffset=0
 */
export const getWeeklySummary = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const weekOffset = parseInt(req.query.weekOffset as string) || 0;
    const result = await ClockService.getWeeklySummary(user, weekOffset);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching weekly summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch weekly summary' 
    });
  }
};