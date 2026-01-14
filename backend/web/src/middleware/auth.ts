/**
 * File Clean up Finished: Nov 14, 2025
 * Changes:
 *   - Removed duplicate AuthRequest interface definition, now imported from ../types (Nov 13)
 *   - Migrated pool.execute() to query() helper for standardization (Nov 14)
 *   - Added authenticateTokenFromQuery middleware (extracted from routes/quickbooks.ts) (Nov 15)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { User, UserRole, JWTPayload, AuthRequest } from '../types';

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Get user from database
    const rows = await query(
      'SELECT * FROM users WHERE user_id = ? AND is_active = true',
      [decoded.userId]
    ) as User[];

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Custom auth middleware that accepts token from query parameter OR header
 * Used for OAuth flows where headers cannot be set (e.g., window.open() popups)
 * Note: Does NOT fetch full user from database - only validates JWT
 */
export const authenticateTokenFromQuery = async (req: Request, res: Response, next: NextFunction) => {
  // Check query parameter first (for OAuth popup), then fall back to header
  const token = (req.query.token as string) ||
                (req.headers['authorization'] && (req.headers['authorization'] as string).split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Simple validation - just check token is valid
    // Attach minimal user info for OAuth flow (no database lookup needed)
    (req as AuthRequest).user = { userId: decoded.userId } as any;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireManager = requireRole('manager');
export const requireDesignerOrManager = requireRole('designer', 'manager');

/**
 * Middleware to block restricted roles from production environment.
 * Staff and designers must use the development environment (connect through Wifi).
 */
const PRODUCTION_RESTRICTED_ROLES: UserRole[] = ['designer', 'production_staff'];

export const isProductionEnvironment = (): boolean => {
  return process.env.PORT === '3001';
};

export const isRestrictedRole = (role: UserRole): boolean => {
  return PRODUCTION_RESTRICTED_ROLES.includes(role);
};

export const requireProductionAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (isProductionEnvironment() && isRestrictedRole(req.user.role)) {
    return res.status(403).json({
      error: 'Connect through Wifi',
      code: 'PROD_ACCESS_RESTRICTED'
    });
  }

  next();
};
