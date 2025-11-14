export interface User {
  user_id: number;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  is_active: boolean;
  refresh_token?: string;
  refresh_token_expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  user_group?: string;
  hourly_rate?: number;
  overtime_rate_multiplier?: number;
  vacation_pay_percent?: number;
  holiday_rate_multiplier?: number;
  hourly_wage?: number;
  auto_clock_in?: string;
  auto_clock_out?: string;
  last_login?: Date;
  hire_date?: Date;
  production_roles?: string[];
}

export type UserRole = 'production_staff' | 'designer' | 'manager' | 'owner';

import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: User;
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

export interface JWTPayload {
  userId: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Extract user ID from authenticated user object
 * @param user - User object from AuthRequest (set by authenticateToken middleware)
 * @returns User ID
 * @throws Error if user is undefined or missing user_id
 */
export const extractUserId = (user: User | undefined): number => {
  if (!user?.user_id) {
    throw new Error('User authentication required');
  }
  return user.user_id;
};

export interface Customer {
  customer_id: number;
  original_customer_id: string;
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  primary_phone?: string;
  secondary_phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  tax_exempt: boolean;
  credit_limit?: number;
  payment_terms?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}