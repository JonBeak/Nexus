// File Clean up Finished: 2025-11-15

/**
 * Standard Service Layer Result Types
 *
 * Provides consistent result/error handling across all services.
 * All service methods should return ServiceResult<T> for type safety.
 *
 * @module types/serviceResults
 * @created 2025-11-15
 */

/**
 * Standard error response structure
 */
export interface ServiceError {
  error: string;
  code?: string;
  details?: any;
}

/**
 * Standard service result - either success with data or error
 *
 * @example
 * // Success case
 * const result: ServiceResult<User> = { success: true, data: user };
 *
 * // Error case
 * const result: ServiceResult<User> = {
 *   success: false,
 *   error: 'User not found',
 *   code: 'USER_NOT_FOUND'
 * };
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | ({ success: false } & ServiceError);

/**
 * Type guard to check if result is successful
 *
 * @param result - Service result to check
 * @returns true if result is successful
 *
 * @example
 * const result = await userService.getUser(id);
 * if (isSuccess(result)) {
 *   console.log(result.data.username); // TypeScript knows data exists
 * }
 */
export function isSuccess<T>(result: ServiceResult<T>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if result is an error
 *
 * @param result - Service result to check
 * @returns true if result is an error
 *
 * @example
 * const result = await userService.getUser(id);
 * if (isError(result)) {
 *   console.error(result.error, result.code); // TypeScript knows error exists
 * }
 */
export function isError<T>(result: ServiceResult<T>): result is { success: false } & ServiceError {
  return result.success === false;
}
