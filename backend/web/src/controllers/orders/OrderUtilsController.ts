/**
 * Order Utils Controller
 * HTTP Request Handlers for Order Utility Operations
 *
 * Extracted from orderController.ts - 2025-11-21
 * Functions: calculateDueDate, calculateBusinessDays
 */

import { Request, Response } from 'express';
import { BusinessDaysCalculator } from '../../utils/businessDaysCalculator';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Calculate due date based on business days (Phase 1.5.a.5)
 * POST /api/orders/calculate-due-date
 * Body: { startDate: string (YYYY-MM-DD), turnaroundDays: number }
 * Permission: orders.create
 */
export const calculateDueDate = async (req: Request, res: Response) => {
  try {
    const { startDate, turnaroundDays } = req.body;

    // Validation
    if (!startDate || !turnaroundDays) {
      return sendErrorResponse(res, 'startDate and turnaroundDays are required', 'VALIDATION_ERROR');
    }

    const start = new Date(startDate);
    const days = parseIntParam(turnaroundDays, 'turnaroundDays');

    if (isNaN(start.getTime())) {
      return sendErrorResponse(res, 'Invalid startDate format. Use YYYY-MM-DD', 'VALIDATION_ERROR');
    }

    if (days === null || days <= 0) {
      return sendErrorResponse(res, 'turnaroundDays must be a positive number', 'VALIDATION_ERROR');
    }

    // Calculate due date
    const dueDate = await BusinessDaysCalculator.calculateDueDate(start, days);

    res.json({
      success: true,
      dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
      businessDaysCalculated: days
    });
  } catch (error) {
    console.error('Error calculating due date:', error);
    return sendErrorResponse(res, 'Failed to calculate due date', 'INTERNAL_ERROR');
  }
};

/**
 * Calculate business days between two dates (Phase 1.5.a.5)
 * POST /api/orders/calculate-business-days
 * Body: { startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD) }
 * Permission: orders.create
 */
export const calculateBusinessDays = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    // Validation
    if (!startDate || !endDate) {
      return sendErrorResponse(res, 'startDate and endDate are required', 'VALIDATION_ERROR');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendErrorResponse(res, 'Invalid date format. Use YYYY-MM-DD', 'VALIDATION_ERROR');
    }

    // If end is before start, return 0
    if (end < start) {
      return res.json({
        success: true,
        businessDays: 0
      });
    }

    // Calculate business days between dates
    const businessDays = await BusinessDaysCalculator.calculateBusinessDaysBetween(start, end);

    res.json({
      success: true,
      businessDays
    });
  } catch (error) {
    console.error('Error calculating business days:', error);
    return sendErrorResponse(res, 'Failed to calculate business days', 'INTERNAL_ERROR');
  }
};
