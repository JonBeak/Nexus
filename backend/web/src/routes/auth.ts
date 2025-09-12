import { Router } from 'express';
import { login, getCurrentUser, refreshToken } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticateToken, getCurrentUser);

// Get all users (for managers only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Only managers and owners can access this
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const users = await query(
      `SELECT user_id, username, first_name, last_name, email, role, user_group 
       FROM users 
       WHERE is_active = 1 
       ORDER BY first_name, last_name`
    ) as any[];
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;