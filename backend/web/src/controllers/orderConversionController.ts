// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed dead code: validateEstimateForConversion() controller method (unused route)
//   - Removed redundant auth check (middleware guarantees user exists)
//   - Replaced error handling with sendErrorResponse() helper
//   - Changed Request param to AuthRequest for type safety
//   - Added non-null assertion (req.user!) since auth middleware guarantees user
//   - Reduced from 118 → 62 lines (47% reduction)

/**
 * Order Conversion Controller
 * HTTP Request Handlers for Estimate → Order Conversion
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import { orderConversionService } from '../services/orderConversionService';
import { ConvertEstimateRequest } from '../types/orders';
import { sendErrorResponse } from '../utils/controllerHelpers';

/**
 * Convert approved estimate to order
 * POST /api/orders/convert-estimate
 * Permission: orders.create (Manager+ only)
 */
export const convertEstimateToOrder = async (req: AuthRequest, res: Response) => {
  try {
    const conversionRequest: ConvertEstimateRequest = req.body;

    // Validate required fields
    if (!conversionRequest.estimateId || !conversionRequest.orderName) {
      return sendErrorResponse(res, 'estimateId and orderName are required', 'VALIDATION_ERROR');
    }

    // Validate estimateId is a number
    const estimateId = parseInt(conversionRequest.estimateId.toString());
    if (isNaN(estimateId)) {
      return sendErrorResponse(res, 'estimateId must be a valid number', 'VALIDATION_ERROR');
    }

    // Convert estimate to order
    const result = await orderConversionService.convertEstimateToOrder(
      {
        ...conversionRequest,
        estimateId
      },
      req.user!.user_id
    );

    res.json({
      success: true,
      data: result,
      message: `Order ${result.order_number} created successfully from estimate ${estimateId}`
    });
  } catch (error) {
    console.error('Error converting estimate to order:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to convert estimate to order';

    // Check for specific error types
    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    if (errorMessage.includes('approved')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }

    sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};
