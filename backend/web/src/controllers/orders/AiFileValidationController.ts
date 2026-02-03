/**
 * AI File Validation Controller
 * HTTP Request Handlers for AI File Validation - simplified, no database
 */

import { Request, Response } from 'express';
import { aiFileValidationService } from '../../services/aiFileValidationService';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * List AI files in order folder
 * GET /api/orders/:orderNumber/ai-files
 */
export const listAiFiles = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNum = parseIntParam(orderNumber, 'order number');

    if (orderNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    const result = await aiFileValidationService.listAiFiles(orderNum);

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to list files', result.code || 'LIST_ERROR');
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error listing AI files:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to list AI files',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Run validation on AI files
 * POST /api/orders/:orderNumber/ai-files/validate
 */
export const validateAiFiles = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNum = parseIntParam(orderNumber, 'order number');

    if (orderNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    const result = await aiFileValidationService.validateFiles(orderNum);

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Validation failed', result.code || 'VALIDATION_ERROR');
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error validating AI files:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to validate AI files',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Approve files - just returns success (no database tracking)
 * POST /api/orders/:orderNumber/ai-files/approve
 */
export const approveAiFiles = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNum = parseIntParam(orderNumber, 'order number');

    if (orderNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    // No database - just acknowledge the approval
    res.json({
      success: true,
      data: { approved: true },
      message: 'Files approved',
    });
  } catch (error) {
    console.error('Error approving AI files:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to approve AI files',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Get expected files comparison
 * Compares files expected by rules against actual files in order folder
 * GET /api/orders/:orderNumber/expected-files/compare
 */
export const getExpectedFilesComparison = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNum = parseIntParam(orderNumber, 'order number');

    if (orderNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    const result = await aiFileValidationService.getExpectedFilesComparison(orderNum);

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to compare expected files', result.code || 'COMPARISON_ERROR');
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error getting expected files comparison:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to compare expected files',
      'INTERNAL_ERROR'
    );
  }
};
