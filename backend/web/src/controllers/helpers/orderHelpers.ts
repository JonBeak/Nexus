// File Clean up Finished: 2025-11-18
// Status: NEW FILE - Clean from creation
// Purpose: Extract repeated validation pattern from order controllers
// Usage: Used by orderPreparationController.ts (7 of 9 functions)
// Pattern: Parse order number → Get order ID → Validate existence → Send errors if needed
// Benefits: Eliminated ~49 lines of code duplication across 7 controller functions
// Architecture: Lives in controllers layer (not utils) to avoid circular dependencies
// File size: 58 lines - Well-documented, single responsibility, reusable

/**
 * Order Controller Helpers
 *
 * Reusable helper functions for order-related controllers.
 * Handles common validation and lookup patterns.
 *
 * @module controllers/helpers/orderHelpers
 * @created 2025-11-18
 */

import { Response } from 'express';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';
import { orderService } from '../../services/orderService';

/**
 * Validate order number parameter and get order ID
 *
 * Common pattern used across order preparation endpoints:
 * - Parse and validate order number
 * - Look up order ID from order number
 * - Send error response if invalid or not found
 *
 * @param orderNumber - Order number from request params
 * @param res - Express response object (for sending errors)
 * @returns Order ID if valid and found, null otherwise
 *
 * @example
 * const orderId = await validateOrderAndGetId(req.params.orderNumber, res);
 * if (!orderId) return; // Error already sent to client
 *
 * // Continue with orderId...
 */
export async function validateOrderAndGetId(
  orderNumber: string,
  res: Response
): Promise<number | null> {
  // Parse and validate order number
  const orderNumberNum = parseIntParam(orderNumber, 'order number');
  if (orderNumberNum === null) {
    sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    return null;
  }

  // Look up order ID
  const orderId = await orderService.getOrderIdFromOrderNumber(orderNumberNum);
  if (!orderId) {
    sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    return null;
  }

  return orderId;
}
