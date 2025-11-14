/**
 * File Clean up Finished: Nov 14, 2025
 * Changes:
 *   - Removed duplicate AuthRequest interface definition, now imported from ../types (Nov 13)
 *   - Migrated pool.execute() to query() helper for standardization (Nov 14)
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
