// File Clean up Finished: Nov 21, 2025
// Changes:
//   - Nov 14, 2025: Removed 6 legacy CRUD methods
//   - Nov 21, 2025: Added getProductTemplate (moved from estimateController.ts)
//
// Remaining methods support template/field prompt system used by dynamic form generation

import { Request, Response } from 'express';
import { JobEstimationService } from '../services/jobEstimationService';
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

// =============================================
// DYNAMIC TEMPLATE ENDPOINTS
// Moved from estimateController.ts - Nov 21, 2025
// =============================================

/**
 * Get product template by product type ID
 * @route GET /product-types/:id/template
 */
export const getProductTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productTypeId = parseInt(id);

    if (isNaN(productTypeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product type ID'
      });
    }

    const template = await dynamicTemplateService.getProductTemplate(productTypeId);
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Controller error getting product template:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get product template'
    });
  }
};
