/**
 * Vinyl Inventory Controller
 * HTTP layer for vinyl inventory management
 */

import { Request, Response } from 'express';
import { VinylInventoryService } from '../../services/vinyl/vinylInventoryService';
import { AuthRequest } from '../../types';
import {
  VinylInventoryFilters,
  CreateVinylItemRequest,
  UpdateVinylItemRequest,
  MarkVinylAsUsedRequest,
  StatusChangeRequest
} from '../../types/vinyl';

/**
 * Get all vinyl inventory items with optional filters
 */
export const getVinylItems = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const filters: VinylInventoryFilters = {
      disposition: req.query.disposition as any,
      search: req.query.search as string,
      brand: req.query.brand as string,
      series: req.query.series as string,
      location: req.query.location as string,
      supplier_id: req.query.supplier_id ? parseInt(req.query.supplier_id as string) : undefined,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await VinylInventoryService.getVinylItems(user, filters);

    if (result.success) {
      res.json(result.data);
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vinyl inventory',
      details: error.message
    });
  }
};

/**
 * Get single vinyl item by ID
 */
export const getVinylItemById = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vinyl item ID'
      });
    }

    const result = await VinylInventoryService.getVinylItemById(user, id);

    if (result.success) {
      res.json(result.data);
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vinyl item',
      details: error.message
    });
  }
};

/**
 * Create new vinyl inventory item
 */
export const createVinylItem = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const data: CreateVinylItemRequest = req.body;
    const result = await VinylInventoryService.createVinylItem(user, data);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VALIDATION_ERROR' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create vinyl item',
      details: error.message
    });
  }
};

/**
 * Update vinyl inventory item
 */
export const updateVinylItem = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vinyl item ID'
      });
    }

    const data: UpdateVinylItemRequest = req.body;
    const result = await VinylInventoryService.updateVinylItem(user, id, data);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 :
                        result.code === 'VALIDATION_ERROR' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update vinyl item',
      details: error.message
    });
  }
};

/**
 * Mark vinyl as used with optional job associations
 */
export const markVinylAsUsed = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vinyl item ID'
      });
    }

    const data: MarkVinylAsUsedRequest = req.body;
    const result = await VinylInventoryService.markVinylAsUsed(user, id, data);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 :
                        result.code === 'INVALID_DISPOSITION' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark vinyl as used',
      details: error.message
    });
  }
};

/**
 * Update job associations for vinyl item
 */
export const updateJobLinks = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vinyl item ID'
      });
    }

    const { job_ids } = req.body;
    if (!Array.isArray(job_ids)) {
      return res.status(400).json({
        success: false,
        error: 'job_ids must be an array'
      });
    }

    const result = await VinylInventoryService.updateJobLinks(user, id, job_ids);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update job associations',
      details: error.message
    });
  }
};

/**
 * Delete vinyl inventory item
 */
export const deleteVinylItem = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vinyl item ID'
      });
    }

    const result = await VinylInventoryService.deleteVinylItem(user, id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete vinyl item',
      details: error.message
    });
  }
};

/**
 * Get vinyl inventory statistics
 */
export const getVinylStats = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const result = await VinylInventoryService.getVinylStats(user);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vinyl statistics',
      details: error.message
    });
  }
};

/**
 * Get recent vinyl items for copying
 */
export const getRecentVinylForCopying = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const result = await VinylInventoryService.getRecentVinylForCopying(user, limit);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent vinyl items',
      details: error.message
    });
  }
};

/**
 * Handle status changes (used, waste, returned)
 */
export const changeVinylStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const data: StatusChangeRequest = req.body;

    // Validate required fields
    if (!data.vinyl_id || !data.disposition) {
      return res.status(400).json({
        success: false,
        error: 'vinyl_id and disposition are required'
      });
    }

    const result = await VinylInventoryService.changeVinylStatus(user, data);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 :
                        result.code === 'VALIDATION_ERROR' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to change vinyl status',
      details: error.message
    });
  }
};

/**
 * Get job links for a vinyl item
 */
export const getJobLinks = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vinyl item ID'
      });
    }

    // Get the vinyl item which includes job associations
    const result = await VinylInventoryService.getVinylItemById(user, id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data.job_associations || []
      });
    } else {
      const statusCode = result.code === 'VINYL_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job associations',
      details: error.message
    });
  }
};