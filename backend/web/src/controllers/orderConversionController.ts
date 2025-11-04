/**
 * Order Conversion Controller
 * HTTP Request Handlers for Estimate → Order Conversion
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { orderConversionService } from '../services/orderConversionService';
import { ConvertEstimateRequest } from '../types/orders';

/**
 * Convert approved estimate to order
 * POST /api/orders/convert-estimate
 * Permission: orders.create (Manager+ only)
 */
export const convertEstimateToOrder = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const conversionRequest: ConvertEstimateRequest = req.body;

    // Validate required fields
    if (!conversionRequest.estimateId || !conversionRequest.orderName) {
      return res.status(400).json({
        success: false,
        message: 'estimateId and orderName are required'
      });
    }

    // Validate estimateId is a number
    const estimateId = parseInt(conversionRequest.estimateId.toString());
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'estimateId must be a valid number'
      });
    }

    // Convert estimate to order
    const result = await orderConversionService.convertEstimateToOrder(
      {
        ...conversionRequest,
        estimateId
      },
      user.user_id
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    if (errorMessage.includes('approved')) {
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

/**
 * Validate estimate can be converted (preview)
 * GET /api/orders/convert-estimate/validate/:estimateId
 * Permission: orders.create (Manager+ only)
 */
export const validateEstimateForConversion = async (req: Request, res: Response) => {
  try {
    const { estimateId } = req.params;
    const estimateIdNum = parseInt(estimateId);

    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    const validation = await orderConversionService.validateEstimateForConversion(estimateIdNum);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating estimate for conversion:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to validate estimate'
    });
  }
};
