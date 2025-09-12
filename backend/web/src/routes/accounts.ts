import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import bcrypt from 'bcrypt';

const router = Router();

// Get all users (managers and owners only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const users = await query(`
      SELECT 
        user_id,
        username,
        first_name,
        last_name,
        email,
        role,
        user_group,
        hourly_wage,
        is_active,
        auto_clock_in,
        auto_clock_out,
        created_at,
        last_login
      FROM users 
      ORDER BY first_name, last_name
    `) as any[];

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { 
      first_name, 
      last_name, 
      email, 
      password, 
      role,
      user_group, 
      hourly_wage,
      auto_clock_in,
      auto_clock_out
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only owners can create owner accounts
    if (role === 'owner' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can create owner accounts' });
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create username from email (before @ symbol)
    const username = email.split('@')[0];

    // Create user
    const result = await query(`
      INSERT INTO users (
        username,
        first_name, 
        last_name, 
        email, 
        password_hash, 
        role,
        user_group, 
        hourly_wage,
        auto_clock_in,
        auto_clock_out,
        is_active,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `, [
      username,
      first_name,
      last_name,
      email,
      hashedPassword,
      role,
      user_group || null,
      hourly_wage || null,
      auto_clock_in || null,
      auto_clock_out || null
    ]) as any;

    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'create', 'user', ?, ?)`,
      [user.user_id, result.insertId, JSON.stringify({ first_name, last_name, email, role })]
    );

    res.json({ message: 'User created successfully', user_id: result.insertId });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.params;
    const { 
      username,
      first_name, 
      last_name, 
      email, 
      role,
      user_group, 
      hourly_wage,
      auto_clock_in,
      auto_clock_out,
      is_active
    } = req.body;

    // Check if user exists and get current role
    const existingUser = await query(
      'SELECT user_id, role, is_active FROM users WHERE user_id = ?',
      [userId]
    ) as any[];

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = existingUser[0];

    // Only owners can create owner accounts or change roles to owner
    if (role === 'owner' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can create owner accounts' });
    }

    // If trying to deactivate an owner, check if it's the last one
    if (is_active === 0 && (currentUser.role === 'owner' || role === 'owner')) {
      const activeOwnerCount = await query(
        'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1',
        ['owner']
      ) as any[];

      if (activeOwnerCount[0].count <= 1) {
        return res.status(400).json({ 
          error: 'Cannot deactivate the last owner account. At least one owner must remain active.' 
        });
      }
    }

    // Update user
    await query(`
      UPDATE users SET 
        username = ?,
        first_name = ?,
        last_name = ?,
        email = ?,
        role = ?,
        user_group = ?,
        hourly_wage = ?,
        auto_clock_in = ?,
        auto_clock_out = ?,
        is_active = ?,
        updated_at = NOW()
      WHERE user_id = ?
    `, [
      username,
      first_name,
      last_name,
      email,
      role,
      user_group || null,
      hourly_wage || null,
      auto_clock_in || null,
      auto_clock_out || null,
      is_active,
      userId
    ]);

    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'update', 'user', ?, ?)`,
      [user.user_id, userId, JSON.stringify({ first_name, last_name, email, role, hourly_wage, is_active })]
    );

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user password
router.put('/users/:userId/password', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password
    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [hashedPassword, userId]
    );

    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'update', 'user_password', ?, ?)`,
      [user.user_id, userId, JSON.stringify({ action: 'password_reset' })]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Get all login logs
router.get('/login-logs', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const sql = `
      SELECT 
        ll.log_id,
        ll.user_id,
        ll.ip_address,
        ll.login_time,
        ll.user_agent,
        u.username,
        u.first_name,
        u.last_name
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.user_id
      ORDER BY ll.login_time DESC LIMIT 100
    `;

    const logs = await query(sql) as any[];
    res.json(logs);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: 'Failed to fetch login logs' });
  }
});

// Get login logs for specific user
router.get('/login-logs/user/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.params;
    
    const sql = `
      SELECT 
        ll.log_id,
        ll.user_id,
        ll.ip_address,
        ll.login_time,
        ll.user_agent,
        u.username,
        u.first_name,
        u.last_name
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.user_id
      WHERE ll.user_id = ?
      ORDER BY ll.login_time DESC LIMIT 100
    `;

    const logs = await query(sql, [userId]) as any[];
    res.json(logs);
  } catch (error) {
    console.error('Error fetching user login logs:', error);
    res.status(500).json({ error: 'Failed to fetch user login logs' });
  }
});

// Get all vacation periods
router.get('/vacations', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const sql = `
      SELECT 
        vp.vacation_id,
        vp.user_id,
        vp.start_date,
        vp.end_date,
        vp.description,
        vp.created_at,
        u.first_name,
        u.last_name
      FROM vacation_periods vp
      JOIN users u ON vp.user_id = u.user_id
      ORDER BY vp.start_date DESC
    `;

    const vacations = await query(sql) as any[];
    res.json(vacations);
  } catch (error) {
    console.error('Error fetching vacation periods:', error);
    res.status(500).json({ error: 'Failed to fetch vacation periods' });
  }
});

// Get vacation periods for specific user
router.get('/vacations/user/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.params;
    
    const sql = `
      SELECT 
        vp.vacation_id,
        vp.user_id,
        vp.start_date,
        vp.end_date,
        vp.description,
        vp.created_at,
        u.first_name,
        u.last_name
      FROM vacation_periods vp
      JOIN users u ON vp.user_id = u.user_id
      WHERE vp.user_id = ?
      ORDER BY vp.start_date DESC
    `;

    const vacations = await query(sql, [userId]) as any[];
    res.json(vacations);
  } catch (error) {
    console.error('Error fetching user vacation periods:', error);
    res.status(500).json({ error: 'Failed to fetch user vacation periods' });
  }
});

// Create vacation period
router.post('/vacations', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { user_id, start_date, end_date, description } = req.body;

    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create vacation period
    const result = await query(`
      INSERT INTO vacation_periods (user_id, start_date, end_date, description, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [user_id, start_date, end_date, description || null]) as any;

    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'create', 'vacation_period', ?, ?)`,
      [user.user_id, result.insertId, JSON.stringify({ user_id, start_date, end_date, description })]
    );

    res.json({ message: 'Vacation period created successfully', vacation_id: result.insertId });
  } catch (error) {
    console.error('Error creating vacation period:', error);
    res.status(500).json({ error: 'Failed to create vacation period' });
  }
});

// Delete vacation period
router.delete('/vacations/:vacationId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { vacationId } = req.params;

    // Delete vacation period
    await query('DELETE FROM vacation_periods WHERE vacation_id = ?', [vacationId]);

    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'delete', 'vacation_period', ?, ?)`,
      [user.user_id, vacationId, JSON.stringify({ action: 'delete_vacation' })]
    );

    res.json({ message: 'Vacation period deleted successfully' });
  } catch (error) {
    console.error('Error deleting vacation period:', error);
    res.status(500).json({ error: 'Failed to delete vacation period' });
  }
});

export default router;