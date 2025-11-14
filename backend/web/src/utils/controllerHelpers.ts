/**
 * Controller Helper Utilities
 *
 * Reusable utilities for controller HTTP request handling.
 * Created to eliminate code duplication across controllers.
 *
 * @module utils/controllerHelpers
 * @created 2025-11-14
 */

import { Response } from 'express';

/**
 * Parse and validate integer ID from request params
 *
 * @param paramValue - The parameter value to parse
 * @param paramName - Name of the parameter (for error messages)
 * @returns Parsed integer ID or null if invalid
 *
 * @example
 * const id = parseIntParam(req.params.id, 'ID');
 * if (id === null) {
 *   return res.status(400).json({ success: false, error: 'Invalid ID' });
 * }
 */
export function parseIntParam(paramValue: string, paramName: string = 'ID'): number | null {
  const parsed = parseInt(paramValue);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Map service result error codes to HTTP status codes
 *
 * Provides consistent HTTP status code mapping across all controllers.
 *
 * @param errorCode - Service layer error code
 * @returns HTTP status code
 *
 * @example
 * const statusCode = mapErrorCodeToStatus(result.code);
 */
export function mapErrorCodeToStatus(errorCode?: string): number {
  if (!errorCode) return 500;

  const errorCodeMap: Record<string, number> = {
    // Not Found errors
    'NOT_FOUND': 404,
    'VINYL_NOT_FOUND': 404,
    'PRODUCT_NOT_FOUND': 404,
    'ORDER_NOT_FOUND': 404,
    'USER_NOT_FOUND': 404,
    'CUSTOMER_NOT_FOUND': 404,
    'ENTRY_NOT_FOUND': 404,
    'REQUEST_NOT_FOUND': 404,
    'NOTIFICATION_NOT_FOUND': 404,
    'BREAK_NOT_FOUND': 404,

    // Validation errors
    'VALIDATION_ERROR': 400,
    'INVALID_INPUT': 400,
    'INVALID_DISPOSITION': 400,
    'INVALID_STATUS': 400,
    'INVALID_DATE_RANGE': 400,
    'MISSING_REQUIRED_FIELD': 400,

    // Permission/Authorization errors
    'PERMISSION_DENIED': 403,
    'UNAUTHORIZED': 403,
    'FORBIDDEN': 403,

    // Conflict errors
    'DUPLICATE_PRODUCT': 409,
    'DUPLICATE_ENTRY': 409,
    'ALREADY_EXISTS': 409,
    'CONFLICT': 409,

    // Database errors
    'DATABASE_ERROR': 500,
    'INTERNAL_ERROR': 500,
    'QUERY_ERROR': 500
  };

  return errorCodeMap[errorCode] || 500;
}

/**
 * Send standardized error response
 *
 * @param res - Express response object
 * @param error - Error message
 * @param code - Service error code (optional)
 * @param details - Additional error details (optional)
 *
 * @example
 * sendErrorResponse(res, 'Failed to fetch item', result.code);
 */
export function sendErrorResponse(
  res: Response,
  error: string,
  code?: string,
  details?: any
): void {
  const statusCode = mapErrorCodeToStatus(code);

  const response: any = {
    success: false,
    error
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.details = details;
  }

  res.status(statusCode).json(response);
}

/**
 * Send standardized success response
 *
 * @param res - Express response object
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 *
 * @example
 * sendSuccessResponse(res, { id: 123 }, 201);
 */
export function sendSuccessResponse(
  res: Response,
  data: any,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data
  });
}

/**
 * Handle service result and send appropriate response
 *
 * Automatically handles both success and error cases from service layer.
 *
 * @param res - Express response object
 * @param result - Service result object
 * @param options - Optional configuration
 *
 * @example
 * const result = await service.getItem(id);
 * return handleServiceResult(res, result);
 */
export function handleServiceResult(
  res: Response,
  result: {
    success: boolean;
    data?: any;
    error?: string;
    code?: string;
  },
  options?: {
    successStatus?: number;
    errorMessage?: string;
  }
): void {
  if (result.success) {
    const statusCode = options?.successStatus || 200;
    sendSuccessResponse(res, result.data, statusCode);
  } else {
    const errorMessage = options?.errorMessage || result.error || 'Operation failed';
    sendErrorResponse(res, errorMessage, result.code);
  }
}
