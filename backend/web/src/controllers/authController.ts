// File Clean up Finished: Nov 13, 2025
// Changes made:
// 1. Removed unused RBAC imports (getUserPermissions, hasPermission)
// 2. Implemented comprehensive failed login tracking with failure reasons
// 3. Added username_attempted field to successful login logs for consistency
// 4. Fixed deprecated req.connection.remoteAddress to req.socket.remoteAddress
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database';
import { User } from '../types';

const DEFAULT_REFRESH_TOKEN_TTL = 48 * 60 * 60 * 1000; // 48 hours fallback

const parseRefreshTokenDuration = (rawValue: string | undefined): number => {
  if (!rawValue) {
    return DEFAULT_REFRESH_TOKEN_TTL;
  }

  const value = rawValue.trim();
  if (!value) {
    return DEFAULT_REFRESH_TOKEN_TTL;
  }

  const match = value.match(/^([0-9]+)([smhd])?$/i);
  if (!match) {
    console.warn('Invalid REFRESH_TOKEN_EXPIRES_IN format, falling back to default (48h)');
    return DEFAULT_REFRESH_TOKEN_TTL;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 'h').toLowerCase();

  const unitToMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const multiplier = unitToMs[unit];
  if (!multiplier) {
    console.warn('Invalid REFRESH_TOKEN_EXPIRES_IN unit, falling back to default (48h)');
    return DEFAULT_REFRESH_TOKEN_TTL;
  }

  return amount * multiplier;
};

const buildRefreshTokenExpiry = () => {
  const durationMs = parseRefreshTokenDuration(process.env.REFRESH_TOKEN_EXPIRES_IN);
  return new Date(Date.now() + durationMs);
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get client info for logging
    const clientIp = req.ip || req.socket.remoteAddress || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Get user from database
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = true',
      [username]
    );

    const users = rows as User[];
    if (users.length === 0) {
      // Log failed login - user not found
      await pool.execute(
        'INSERT INTO login_logs (username_attempted, ip_address, user_agent, login_time, login_successful, failure_reason) VALUES (?, ?, ?, NOW(), 0, ?)',
        [username, clientIp, userAgent, 'User not found or inactive']
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Log failed login - invalid password
      await pool.execute(
        'INSERT INTO login_logs (user_id, username_attempted, ip_address, user_agent, login_time, login_successful, failure_reason) VALUES (?, ?, ?, ?, NOW(), 0, ?)',
        [user.user_id, username, clientIp, userAgent, 'Invalid password']
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate access token (short-lived)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const accessToken = jwt.sign(
      { userId: user.user_id, role: user.role },
      jwtSecret as jwt.Secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as any }
    );

    // Generate refresh token using configured lifetime
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresAt = buildRefreshTokenExpiry();

    // Store refresh token in database
    await pool.execute(
      'UPDATE users SET refresh_token = ?, refresh_token_expires_at = ?, last_login = NOW() WHERE user_id = ?',
      [refreshToken, refreshTokenExpiresAt, user.user_id]
    );

    // Log the successful login activity
    await pool.execute(
      'INSERT INTO login_logs (user_id, username_attempted, ip_address, user_agent, login_time, login_successful) VALUES (?, ?, ?, ?, NOW(), 1)',
      [user.user_id, username, clientIp, userAgent]
    );

    // Return user data without password and refresh token
    const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutPassword } = user;

    res.json({
      accessToken,
      refreshToken,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // User is already attached to request by auth middleware
    const user = (req as any).user;
    const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Find user with this refresh token
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE refresh_token = ? AND refresh_token_expires_at > NOW() AND is_active = true',
      [refreshToken]
    );

    const users = rows as User[];
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = users[0];

    // Generate new access token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const newAccessToken = jwt.sign(
      { userId: user.user_id, role: user.role },
      jwtSecret as jwt.Secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as any }
    );

    // Rotate refresh token for security using configured lifetime
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresAt = buildRefreshTokenExpiry();

    // Update refresh token in database
    await pool.execute(
      'UPDATE users SET refresh_token = ?, refresh_token_expires_at = ? WHERE user_id = ?',
      [newRefreshToken, refreshTokenExpiresAt, user.user_id]
    );

    const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutPassword } = user;

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
