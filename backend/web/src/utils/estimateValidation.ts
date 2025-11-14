// File Clean up Finished: Nov 13, 2025
/**
 * Validation utilities for estimate-related operations
 * Extracted from estimateController.ts to reduce code duplication
 * Created: Nov 13, 2025
 *
 * Provides reusable validation functions for:
 * - Estimate ID validation and parsing
 * - Job ID validation and parsing
 * - User authentication validation
 */

import { Response } from 'express';

/**
 * Validation result that can be used to return early from controllers
 */
export interface ValidationResult {
  isValid: boolean;
  value?: number;
  errorSent?: boolean;
}

/**
 * Validates and parses estimate ID from request parameters
 * @param estimateId - String estimate ID from request params
 * @param res - Express response object for sending error
 * @returns Validation result with parsed number if valid
 *
 * Usage:
 * const validation = validateEstimateId(estimateId, res);
 * if (!validation.isValid) return; // Error response already sent
 * const estimateIdNum = validation.value!;
 */
export function validateEstimateId(estimateId: string, res: Response): ValidationResult {
  const estimateIdNum = parseInt(estimateId);

  if (isNaN(estimateIdNum)) {
    res.status(400).json({
      success: false,
      message: 'Invalid estimate ID'
    });
    return { isValid: false, errorSent: true };
  }

  return { isValid: true, value: estimateIdNum };
}

/**
 * Validates and parses job ID from request parameters
 * @param jobId - String job ID from request params
 * @param res - Express response object for sending error
 * @returns Validation result with parsed number if valid
 *
 * Usage:
 * const validation = validateJobId(jobId, res);
 * if (!validation.isValid) return; // Error response already sent
 * const jobIdNum = validation.value!;
 */
export function validateJobId(jobId: string, res: Response): ValidationResult {
  const jobIdNum = parseInt(jobId);

  if (isNaN(jobIdNum)) {
    res.status(400).json({
      success: false,
      message: 'Invalid job ID'
    });
    return { isValid: false, errorSent: true };
  }

  return { isValid: true, value: jobIdNum };
}

/**
 * Validates that a user is authenticated and has a user_id
 * @param userId - User ID from authenticated request
 * @param res - Express response object for sending error
 * @returns Validation result
 *
 * Usage:
 * const user = (req as AuthRequest).user;
 * const validation = validateUserAuthentication(user?.user_id, res);
 * if (!validation.isValid) return; // Error response already sent
 */
export function validateUserAuthentication(userId: number | undefined, res: Response): ValidationResult {
  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
    return { isValid: false, errorSent: true };
  }

  return { isValid: true, value: userId };
}
