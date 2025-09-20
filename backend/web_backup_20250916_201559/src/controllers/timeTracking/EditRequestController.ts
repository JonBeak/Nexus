import { Request, Response } from 'express';
import { EditRequestService } from '../../services/timeTracking/EditRequestService';
import { AuthRequest } from '../../types';

/**
 * Edit Request Controller
 * Handles HTTP requests for edit request submission, processing, and retrieval
 */

/**
 * Submit time edit request
 * POST /api/time/edit-request
 */
export const submitEditRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      entry_id, 
      requested_clock_in, 
      requested_clock_out, 
      requested_break_minutes,
      reason 
    } = req.body;

    // Basic validation
    if (!entry_id || !requested_clock_in || !requested_clock_out || requested_break_minutes === undefined || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const result = await EditRequestService.submitEditRequest(user, {
      entry_id,
      requested_clock_in,
      requested_clock_out,
      requested_break_minutes,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error submitting edit request:', error);
    
    if (error.message === 'Time entry not found') {
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit edit request' 
    });
  }
};

/**
 * Submit time delete request
 * POST /api/time/delete-request
 */
export const submitDeleteRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { entry_id, reason } = req.body;

    // Basic validation
    if (!entry_id || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'Entry ID and reason are required' 
      });
    }

    const result = await EditRequestService.submitDeleteRequest(user, {
      entry_id,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error submitting delete request:', error);
    
    if (error.message === 'Time entry not found') {
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit delete request' 
    });
  }
};

/**
 * Get pending edit requests (managers only)
 * GET /api/time/pending-requests
 */
export const getPendingRequests = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const requests = await EditRequestService.getPendingRequests(user);
    res.json(requests);
  } catch (error: any) {
    console.error('Error fetching pending requests:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pending requests' 
    });
  }
};

/**
 * Process edit request (approve/reject/modify) - managers only
 * POST /api/time/process-request
 */
export const processRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      request_id, 
      action, 
      modified_clock_in,
      modified_clock_out,
      modified_break_minutes,
      reviewer_notes 
    } = req.body;

    // Basic validation
    if (!request_id || !action || !['approve', 'reject', 'modify'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request: request_id and valid action required' 
      });
    }

    const result = await EditRequestService.processRequest(user, {
      request_id,
      action,
      modified_clock_in,
      modified_clock_out,
      modified_break_minutes,
      reviewer_notes
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error processing request:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process request' 
    });
  }
};