// File Clean up Finished: Nov 21, 2025
/**
 * Validation utilities for estimate-related operations
 * Extracted from estimateController.ts to reduce code duplication
 * Created: Nov 13, 2025
 * Updated: Nov 21, 2025 - Added combined request validators for controller use
 *
 * Provides reusable validation functions for:
 * - Estimate ID validation and parsing
 * - Job ID validation and parsing
 * - User authentication validation
 * - Combined request validators (estimateId + userId, jobId + userId)
 */

import { Response } from 'express';
import { AuthRequest } from '../types';

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

// =============================================
// COMBINED REQUEST VALIDATORS
// For use in controllers that need both ID + user validation
// =============================================

/**
 * Combined validation result for estimate requests
 */
export interface EstimateRequestValidation {
  estimateId: number;
  userId: number;
}

/**
 * Combined validation result for job requests
 */
export interface JobRequestValidation {
  jobId: number;
  userId: number;
}

/**
 * Validates and extracts estimateId and userId from request
 * Sends error response if validation fails
 * @param req - Express AuthRequest
 * @param res - Express Response
 * @returns { estimateId, userId } or null if validation failed (error already sent)
 *
 * Usage:
 * const validated = validateEstimateRequest(req, res);
 * if (!validated) return; // Error response already sent
 * // Use validated.estimateId and validated.userId
 */
export function validateEstimateRequest(req: AuthRequest, res: Response): EstimateRequestValidation | null {
  const estimateId = parseInt(req.params.estimateId);

  if (!estimateId || isNaN(estimateId)) {
    res.status(400).json({
      success: false,
      message: 'Valid estimate ID is required'
    });
    return null;
  }

  if (!req.user?.user_id) {
    res.status(401).json({
      success: false,
      message: 'User authentication required'
    });
    return null;
  }

  return { estimateId, userId: req.user.user_id };
}

/**
 * Validates and extracts jobId and userId from request
 * Sends error response if validation fails
 * @param req - Express AuthRequest
 * @param res - Express Response
 * @returns { jobId, userId } or null if validation failed (error already sent)
 *
 * Usage:
 * const validated = validateJobRequest(req, res);
 * if (!validated) return; // Error response already sent
 * // Use validated.jobId and validated.userId
 */
export function validateJobRequest(req: AuthRequest, res: Response): JobRequestValidation | null {
  const jobId = parseInt(req.params.jobId);

  if (!jobId || isNaN(jobId)) {
    res.status(400).json({
      success: false,
      message: 'Valid job ID is required'
    });
    return null;
  }

  if (!req.user?.user_id) {
    res.status(401).json({
      success: false,
      message: 'User authentication required'
    });
    return null;
  }

  return { jobId, userId: req.user.user_id };
}
