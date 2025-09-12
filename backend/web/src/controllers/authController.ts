import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database';
import { User } from '../types';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get user from database
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = true',
      [username]
    );

    const users = rows as User[];
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Generate refresh token (long-lived)
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30); // 30 days

    // Store refresh token in database
    await pool.execute(
      'UPDATE users SET refresh_token = ?, refresh_token_expires_at = ?, last_login = NOW() WHERE user_id = ?',
      [refreshToken, refreshTokenExpiresAt, user.user_id]
    );

    // Log the login activity
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await pool.execute(
      'INSERT INTO login_logs (user_id, ip_address, user_agent, login_time) VALUES (?, ?, ?, NOW())',
      [user.user_id, clientIp, userAgent]
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
    const newAccessToken = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Optionally rotate refresh token (more secure)
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30); // 30 days

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