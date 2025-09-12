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
}

export type UserRole = 'production_staff' | 'designer' | 'manager' | 'owner';

import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: User;
}

export interface JWTPayload {
  userId: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

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