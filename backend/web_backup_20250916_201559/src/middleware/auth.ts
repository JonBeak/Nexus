import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { User, UserRole, JWTPayload } from '../types';

interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Get user from database
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE user_id = ? AND is_active = true',
      [decoded.userId]
    );
    
    const users = rows as User[];
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
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