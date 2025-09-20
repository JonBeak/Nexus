import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// Get all jobs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status, customer_id, limit = 50 } = req.query;
    
    let sql = `
      SELECT 
        j.job_id,
        j.job_number,
        j.job_name,
        j.status,
        j.created_at,
        j.updated_at,
        c.company_name as customer_name
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.customer_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (search) {
      sql += ` AND (j.job_number LIKE ? OR j.job_name LIKE ? OR c.company_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (status) {
      sql += ` AND j.status = ?`;
      params.push(status);
    }
    
    if (customer_id) {
      sql += ` AND j.customer_id = ?`;
      params.push(customer_id);
    }
    
    sql += ` ORDER BY j.created_at DESC LIMIT ${parseInt(limit as string)}`;
    
    const jobs = await query(sql, params);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

export default router;