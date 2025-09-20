import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { JobEstimationService } from '../services/jobEstimationService';
import { createBulkEstimate } from '../services/bulkEstimateService';
import { dynamicTemplateService } from '../services/dynamicTemplateService';

const jobEstimationService = new JobEstimationService();

/**
 * Get field prompts for all product types
 */
export const getAllFieldPrompts = async (req: Request, res: Response) => {
  try {
    const allFieldPrompts = await dynamicTemplateService.getAllFieldPrompts();

    res.json({
      success: true,
      data: allFieldPrompts
    });
  } catch (error) {
    console.error('Controller error fetching all field prompts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all field prompts'
    });
  }
};

/**
 * Get field prompts for a product type
 */
export const getFieldPrompts = async (req: Request, res: Response) => {
  try {
    const productTypeId = parseInt(req.params.productTypeId);

    if (isNaN(productTypeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product type ID'
      });
    }

    const fieldPrompts = await dynamicTemplateService.getFieldPrompts(productTypeId);

    res.json({
      success: true,
      data: fieldPrompts
    });
  } catch (error) {
    console.error('Controller error fetching field prompts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field prompts'
    });
  }
};

// Get all job estimates with summary info
export const getEstimates = async (req: Request, res: Response) => {
  try {
    const { status, customer_id, search, limit = 50 } = req.query;
    
    const filters = {
      status: status as string,
      customer_id: customer_id as string,
      search: search as string,
      limit: parseInt(limit as string)
    };
    
    const data = await jobEstimationService.getEstimates(filters);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Controller error fetching job estimates:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch job estimates'
    });
  }
};

// Get complete job estimate with all components
export const getEstimateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const estimateId = parseInt(id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
    const data = await jobEstimationService.getEstimateById(estimateId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Controller error fetching job estimate:', error);
    const statusCode = error instanceof Error && error.message === 'Job estimate not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch job estimate'
    });
  }
};

// Create new job estimate
export const createEstimate = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { customer_id, estimate_name } = req.body;
    
    // Validate required fields
    const errors = jobEstimationService.validateEstimateData({ customer_id, estimate_name });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', ')
      });
    }
    
    const data = await jobEstimationService.createEstimate(
      { customer_id, estimate_name }, 
      user.user_id
    );
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Controller error creating job estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create job estimate'
    });
  }
};

// Update job estimate
export const updateEstimate = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    const { customer_id, estimate_name, status, notes } = req.body;
    
    const estimateId = parseInt(id);
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
    await jobEstimationService.updateEstimate(
      estimateId,
      { customer_id, estimate_name, status, notes },
      user.user_id
    );
    
    res.json({ success: true, message: 'Job estimate updated successfully' });
  } catch (error) {
    console.error('Controller error updating job estimate:', error);
    const statusCode = error instanceof Error && error.message === 'Job estimate not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update job estimate'
    });
  }
};

// Delete job estimate
export const deleteEstimate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const estimateId = parseInt(id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
    await jobEstimationService.deleteEstimate(estimateId);
    res.json({ success: true, message: 'Job estimate deleted successfully' });
  } catch (error) {
    console.error('Controller error deleting job estimate:', error);
    const statusCode = error instanceof Error && error.message === 'Job estimate not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete job estimate'
    });
  }
};

// Get product types
export const getProductTypes = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const data = await jobEstimationService.getProductTypes(category as string);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Controller error fetching product types:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch product types'
    });
  }
};


// Bulk create complete estimate with groups and items
export const bulkCreateEstimate = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const bulkData = req.body;

    // Validate required data
    if (!bulkData.estimate || !bulkData.estimate.estimate_name) {
      return res.status(400).json({
        success: false,
        message: 'Estimate name is required'
      });
    }

    if (!Array.isArray(bulkData.groups)) {
      return res.status(400).json({
        success: false,
        message: 'Groups array is required'
      });
    }

    const result = await createBulkEstimate(bulkData, user.user_id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Controller error creating bulk estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create estimate'
    });
  }
};