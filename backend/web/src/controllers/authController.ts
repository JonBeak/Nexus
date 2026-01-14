// File Clean up Finished: Nov 14, 2025
// Previous cleanup: Nov 13, 2025
// Changes made:
// 1. Removed unused RBAC imports (getUserPermissions, hasPermission)
// 2. Implemented comprehensive failed login tracking with failure reasons
// 3. Added username_attempted field to successful login logs for consistency
// 4. Fixed deprecated req.connection.remoteAddress to req.socket.remoteAddress
// Current cleanup (Nov 14, 2025):
// 5. Migrated all 7 database calls from pool.execute() to query() helper for consistency and performance monitoring
// File Clean up Finished: 2025-11-15
// Refactored login log writes to use loginLogService for proper 3-layer architecture:
// - Replaced 3 direct INSERT INTO login_logs queries with service layer calls
// - Now uses loginLogService.logFailedLogin() and loginLogService.logSuccessfulLogin()
// - Architectural violation fixed: Controller no longer accesses database directly for login logs
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database';
import { User } from '../types';
import { RowDataPacket } from 'mysql2';
import { loginLogService } from '../services/loginLogService';
import { isProductionEnvironment, isRestrictedRole } from '../middleware/auth';

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
    const users = await query(
      'SELECT * FROM users WHERE username = ? AND is_active = true',
      [username]
    ) as User[];
    if (users.length === 0) {
      // Log failed login - user not found
      await loginLogService.logFailedLogin(
        username,
        clientIp,
        userAgent,
        'User not found or inactive'
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Log failed login - invalid password
      await loginLogService.logFailedLogin(
        username,
        clientIp,
        userAgent,
        'Invalid password',
        user.user_id
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Block restricted roles from production environment
    if (isProductionEnvironment() && isRestrictedRole(user.role)) {
      await loginLogService.logFailedLogin(
        username,
        clientIp,
        userAgent,
        'Production access restricted - must use Wifi',
        user.user_id
      );
      return res.status(403).json({
        error: 'Connect through Wifi',
        code: 'PROD_ACCESS_RESTRICTED'
      });
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
    await query(
      'UPDATE users SET refresh_token = ?, refresh_token_expires_at = ?, last_login = NOW() WHERE user_id = ?',
      [refreshToken, refreshTokenExpiresAt, user.user_id]
    );

    // Log the successful login activity
    await loginLogService.logSuccessfulLogin(
      user.user_id,
      username,
      clientIp,
      userAgent
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
    const users = await query(
      'SELECT * FROM users WHERE refresh_token = ? AND refresh_token_expires_at > NOW() AND is_active = true',
      [refreshToken]
    ) as User[];
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = users[0];

    // Block restricted roles from production environment
    if (isProductionEnvironment() && isRestrictedRole(user.role)) {
      return res.status(403).json({
        error: 'Connect through Wifi',
        code: 'PROD_ACCESS_RESTRICTED'
      });
    }

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
    await query(
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

export const updateThemePreference = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { theme } = req.body;

    // Validate theme value
    if (!theme || !['industrial', 'light'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme. Must be "industrial" or "light"' });
    }

    // Update theme preference in database
    await query(
      'UPDATE users SET theme_preference = ? WHERE user_id = ?',
      [theme, user.user_id]
    );

    res.json({ success: true, theme_preference: theme });
  } catch (error) {
    console.error('Update theme preference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
