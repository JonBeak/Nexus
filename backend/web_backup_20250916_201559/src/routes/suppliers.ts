import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// Get all suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, active_only } = req.query;
    
    let sql = `
      SELECT 
        s.*,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM suppliers s
      LEFT JOIN users cu ON s.created_by = cu.user_id
      LEFT JOIN users uu ON s.updated_by = uu.user_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Filter by active status (default to active only)
    if (active_only !== 'false') {
      sql += ' AND s.is_active = TRUE';
    }
    
    if (search) {
      sql += ` AND (
        s.name LIKE ? OR 
        s.contact_email LIKE ? OR
        s.website LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY s.name';
    
    const suppliers = await query(sql, params) as any[];
    
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Get single supplier
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const suppliers = await query(
      `SELECT 
        s.*,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM suppliers s
      LEFT JOIN users cu ON s.created_by = cu.user_id
      LEFT JOIN users uu ON s.updated_by = uu.user_id
      WHERE s.supplier_id = ?`,
      [id]
    ) as any[];
    
    if (suppliers.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(suppliers[0]);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// Create new supplier
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check if user has permission (manager or owner)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { name, contact_email, contact_phone, website, notes } = req.body;
    
    const result = await query(
      `INSERT INTO suppliers (name, contact_email, contact_phone, website, notes, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, contact_email, contact_phone, website, notes, user.user_id, user.user_id]
    ) as any;
    
    res.json({ 
      message: 'Supplier created successfully', 
      supplier_id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check if user has permission (manager or owner)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const updates = req.body;
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    const allowedFields = ['name', 'contact_email', 'contact_phone', 'website', 'notes', 'is_active'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    // Add updated_by
    updateFields.push('updated_by = ?');
    updateValues.push(user.user_id);
    
    // Add id for WHERE clause
    updateValues.push(id);
    
    await query(
      `UPDATE suppliers SET ${updateFields.join(', ')} WHERE supplier_id = ?`,
      updateValues
    );
    
    res.json({ message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete supplier (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check if user has permission (manager or owner)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check if supplier is in use
    const productCount = await query(
      'SELECT COUNT(*) as count FROM product_suppliers WHERE supplier_id = ?',
      [id]
    ) as any[];
    
    if (productCount[0].count > 0) {
      // Soft delete if in use
      await query(
        'UPDATE suppliers SET is_active = FALSE, updated_by = ? WHERE supplier_id = ?',
        [user.user_id, id]
      );
      res.json({ message: 'Supplier deactivated successfully (products exist)' });
    } else {
      // Hard delete if not in use
      await query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
      res.json({ message: 'Supplier deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Get supplier statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_suppliers,
        COUNT(CASE WHEN contact_email IS NOT NULL AND contact_email != '' THEN 1 END) as suppliers_with_email,
        COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as suppliers_with_website
      FROM suppliers
    `) as any[];
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching supplier statistics:', error);
    res.status(500).json({ error: 'Failed to fetch supplier statistics' });
  }
});

export default router;