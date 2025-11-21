/**
 * Test Authentication Helpers
 * Provides utilities for generating test JWT tokens
 */

import jwt, { SignOptions } from 'jsonwebtoken';

export interface TestUser {
  userId: number;
  role: 'owner' | 'manager' | 'designer' | 'production_staff';
  permissions?: string[];
}

/**
 * Generate a test JWT token for a given user
 * @param user - Test user configuration
 * @param expiresIn - Token expiration (default: 1 hour)
 * @returns JWT token string
 */
export function generateTestToken(user: TestUser, expiresIn: string = '1h'): string {
  const jwtSecret = process.env.JWT_SECRET!;

  const payload = {
    userId: user.userId,
    role: user.role
  };

  const options: SignOptions = {
    expiresIn
  };

  return jwt.sign(payload, jwtSecret, options);
}

/**
 * Pre-configured test users for common scenarios
 * These correspond to actual users in the database
 */
export const TEST_USERS = {
  manager: {
    userId: 10,  // manager user in database
    role: 'manager' as const,
    permissions: [
      'time_tracking.list',
      'time_tracking.create',
      'time_tracking.update',
      'time_tracking.export',
      'time_management.update',
      'time_management.view_reports',
      'time.approve'
    ]
  },
  designer: {
    userId: 3,  // designer user in database
    role: 'designer' as const,
    permissions: []
  },
  production_staff: {
    userId: 2,  // staff user in database
    role: 'production_staff' as const,
    permissions: []
  }
};

/**
 * Generate tokens for common test scenarios
 */
export const TEST_TOKENS = {
  manager: generateTestToken(TEST_USERS.manager),
  designer: generateTestToken(TEST_USERS.designer),
  production_staff: generateTestToken(TEST_USERS.production_staff)
};
