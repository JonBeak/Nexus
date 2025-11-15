// File Clean up Finished: 2025-11-15
// Changes:
//   - Removed Customer interface (18 fields) - never imported, redundant with customerService.ts
//   - Removed extractUserId function (11 lines) - never called, controllers access req.user.user_id directly
//   - Removed duplicate hourly_rate field - database uses hourly_wage as source of truth
//   - File size reduced: 76 → 46 lines (30 lines removed, 39% reduction)
//   - Fixed architecture violation: removed utility function from types-only file

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
  hourly_wage?: number;
  overtime_rate_multiplier?: number;
  vacation_pay_percent?: number;
  holiday_rate_multiplier?: number;
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

