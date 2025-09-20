import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// Get all material categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active_only = 'true', include_fields = 'false' } = req.query;
    
    let sql = `
      SELECT 
        mc.*,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name,
        COUNT(ps.id) as product_count
      FROM material_categories mc
      LEFT JOIN users cu ON mc.created_by = cu.user_id
      LEFT JOIN users uu ON mc.updated_by = uu.user_id
      LEFT JOIN product_standards ps ON mc.id = ps.category_id AND ps.is_active = TRUE
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (active_only === 'true') {
      sql += ' AND mc.is_active = TRUE';
    }
    
    sql += ' GROUP BY mc.id ORDER BY mc.sort_order, mc.name';
    
    const categories = await query(sql, params) as any[];
    
    // Include field definitions if requested
    if (include_fields === 'true') {
      for (const category of categories) {
        const fields = await query(
          `SELECT * FROM category_fields 
           WHERE category_id = ? 
           ORDER BY sort_order, field_name`,
          [category.id]
        ) as any[];
        category.fields = fields;
      }
    }
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category with fields
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const categories = await query(
      `SELECT 
        mc.*,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM material_categories mc
      LEFT JOIN users cu ON mc.created_by = cu.user_id
      LEFT JOIN users uu ON mc.updated_by = uu.user_id
      WHERE mc.id = ?`,
      [id]
    ) as any[];
    
    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const category = categories[0];
    
    // Get category fields
    const fields = await query(
      `SELECT * FROM category_fields 
       WHERE category_id = ? 
       ORDER BY sort_order, field_name`,
      [id]
    ) as any[];
    
    category.fields = fields;
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create new category
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { name, description, icon, sort_order = 0, fields = [] } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Create category
    const result = await query(
      `INSERT INTO material_categories 
       (name, description, icon, sort_order, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), description || null, icon || null, sort_order, user.user_id, user.user_id]
    ) as any;
    
    const categoryId = result.insertId;
    
    // Create category fields
    if (fields && fields.length > 0) {
      for (const field of fields) {
        const {
          field_name,
          field_label,
          field_type,
          field_options,
          is_required = false,
          sort_order: fieldSortOrder = 0,
          validation_rules
        } = field;
        
        if (!field_name?.trim() || !field_label?.trim() || !field_type) {
          continue; // Skip invalid fields
        }
        
        await query(
          `INSERT INTO category_fields 
           (category_id, field_name, field_label, field_type, field_options, 
            is_required, sort_order, validation_rules)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            categoryId,
            field_name.trim(),
            field_label.trim(),
            field_type,
            field_options ? JSON.stringify(field_options) : null,
            is_required,
            fieldSortOrder,
            validation_rules ? JSON.stringify(validation_rules) : null
          ]
        );
      }
    }
    
    res.json({ 
      message: 'Category created successfully', 
      category_id: categoryId 
    });
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

// Update category
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { name, description, icon, sort_order, is_active, fields } = req.body;
    
    // Update category
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    const allowedFields = ['name', 'description', 'icon', 'sort_order', 'is_active'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(req.body[field]);
      }
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_by = ?');
      updateValues.push(user.user_id);
      updateValues.push(id);
      
      await query(
        `UPDATE material_categories SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    // Update category fields if provided
    if (fields !== undefined) {
      // Delete existing fields
      await query('DELETE FROM category_fields WHERE category_id = ?', [id]);
      
      // Create new fields
      for (const field of fields) {
        const {
          field_name,
          field_label,
          field_type,
          field_options,
          is_required = false,
          sort_order: fieldSortOrder = 0,
          validation_rules
        } = field;
        
        if (!field_name?.trim() || !field_label?.trim() || !field_type) {
          continue;
        }
        
        await query(
          `INSERT INTO category_fields 
           (category_id, field_name, field_label, field_type, field_options, 
            is_required, sort_order, validation_rules)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            field_name.trim(),
            field_label.trim(),
            field_type,
            field_options ? JSON.stringify(field_options) : null,
            is_required,
            fieldSortOrder,
            validation_rules ? JSON.stringify(validation_rules) : null
          ]
        );
      }
    }
    
    res.json({ message: 'Category updated successfully' });
  } catch (error: any) {
    console.error('Error updating category:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check if category is in use
    const productCount = await query(
      'SELECT COUNT(*) as count FROM product_standards WHERE category_id = ?',
      [id]
    ) as any[];
    
    if (productCount[0].count > 0) {
      // Soft delete if in use
      await query(
        'UPDATE material_categories SET is_active = FALSE, updated_by = ? WHERE id = ?',
        [user.user_id, id]
      );
      res.json({ message: 'Category deactivated successfully (products exist)' });
    } else {
      // Hard delete if not in use (this will cascade to category_fields)
      await query('DELETE FROM material_categories WHERE id = ?', [id]);
      res.json({ message: 'Category deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get category statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_categories,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_categories,
        COUNT(CASE WHEN icon IS NOT NULL AND icon != '' THEN 1 END) as categories_with_icons
      FROM material_categories
    `) as any[];
    
    // Get product counts per category
    const productCounts = await query(`
      SELECT 
        mc.name as category_name,
        COUNT(ps.id) as product_count
      FROM material_categories mc
      LEFT JOIN product_standards ps ON mc.id = ps.category_id AND ps.is_active = TRUE
      WHERE mc.is_active = TRUE
      GROUP BY mc.id, mc.name
      ORDER BY product_count DESC
    `) as any[];
    
    const result = {
      ...stats[0],
      category_breakdown: productCounts
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching category statistics:', error);
    res.status(500).json({ error: 'Failed to fetch category statistics' });
  }
});

// Reorder categories
router.put('/reorder', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { category_orders } = req.body;
    
    if (!Array.isArray(category_orders)) {
      return res.status(400).json({ error: 'Invalid category orders format' });
    }
    
    // Update sort orders
    for (const item of category_orders) {
      if (item.id && typeof item.sort_order === 'number') {
        await query(
          'UPDATE material_categories SET sort_order = ?, updated_by = ? WHERE id = ?',
          [item.sort_order, user.user_id, item.id]
        );
      }
    }
    
    res.json({ message: 'Category order updated successfully' });
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});

export default router;