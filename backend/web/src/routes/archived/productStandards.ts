import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// Get all product standards
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      category_id, 
      supplier_id, 
      active_only = 'true',
      include_inventory = 'false',
      search 
    } = req.query;
    
    let sql = `
      SELECT 
        ps.*,
        mc.name as category_name,
        mc.icon as category_icon,
        s.name as supplier_name,
        s.contact_email as supplier_email,
        s.lead_time_days,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM product_standards ps
      JOIN material_categories mc ON ps.category_id = mc.id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      LEFT JOIN users cu ON ps.created_by = cu.user_id
      LEFT JOIN users uu ON ps.updated_by = uu.user_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (active_only === 'true') {
      sql += ' AND ps.is_active = TRUE AND mc.is_active = TRUE';
    }
    
    if (category_id) {
      sql += ' AND ps.category_id = ?';
      params.push(category_id);
    }
    
    if (supplier_id) {
      sql += ' AND ps.supplier_id = ?';
      params.push(supplier_id);
    }
    
    if (search) {
      sql += ` AND (
        ps.name LIKE ? OR 
        ps.description LIKE ? OR
        ps.supplier_part_number LIKE ? OR
        mc.name LIKE ? OR
        s.name LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY mc.sort_order, ps.name';
    
    const products = await query(sql, params) as any[];
    
    // Include inventory data if requested
    if (include_inventory === 'true') {
      for (const product of products) {
        const inventory = await query(
          `SELECT 
            SUM(quantity) as total_quantity,
            SUM(reserved_quantity) as total_reserved,
            SUM(quantity - reserved_quantity) as available_quantity,
            COUNT(*) as inventory_items,
            MIN(expiration_date) as earliest_expiration
          FROM unified_inventory 
          WHERE product_standard_id = ? AND status = 'available'`,
          [product.id]
        ) as any[];
        
        product.inventory = inventory[0] || {
          total_quantity: 0,
          total_reserved: 0,
          available_quantity: 0,
          inventory_items: 0,
          earliest_expiration: null
        };
        
        // Calculate stock status
        const available = product.inventory.available_quantity || 0;
        const reorderPoint = product.reorder_point || 0;
        
        if (available <= reorderPoint && reorderPoint > 0) {
          product.stock_status = 'critical';
        } else if (available <= reorderPoint * 1.5 && reorderPoint > 0) {
          product.stock_status = 'low';
        } else {
          product.stock_status = 'ok';
        }
      }
    }
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching product standards:', error);
    res.status(500).json({ error: 'Failed to fetch product standards' });
  }
});

// Get single product standard with full details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const products = await query(
      `SELECT 
        ps.*,
        mc.name as category_name,
        mc.icon as category_icon,
        s.name as supplier_name,
        s.contact_email as supplier_email,
        s.lead_time_days,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM product_standards ps
      JOIN material_categories mc ON ps.category_id = mc.id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      LEFT JOIN users cu ON ps.created_by = cu.user_id
      LEFT JOIN users uu ON ps.updated_by = uu.user_id
      WHERE ps.id = ?`,
      [id]
    ) as any[];
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product standard not found' });
    }
    
    const product = products[0];
    
    // Get category fields for validation
    const categoryFields = await query(
      'SELECT * FROM category_fields WHERE category_id = ? ORDER BY sort_order',
      [product.category_id]
    ) as any[];
    
    product.category_fields = categoryFields;
    
    // Get inventory summary
    const inventory = await query(
      `SELECT 
        SUM(quantity) as total_quantity,
        SUM(reserved_quantity) as total_reserved,
        SUM(quantity - reserved_quantity) as available_quantity,
        COUNT(*) as inventory_items,
        MIN(expiration_date) as earliest_expiration,
        status,
        COUNT(*) as status_count
      FROM unified_inventory 
      WHERE product_standard_id = ?
      GROUP BY status`,
      [id]
    ) as any[];
    
    product.inventory_breakdown = inventory;
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product standard:', error);
    res.status(500).json({ error: 'Failed to fetch product standard' });
  }
});

// Create new product standard
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const {
      category_id,
      name,
      description,
      supplier_id,
      supplier_part_number,
      current_price,
      minimum_order_qty = 1,
      reorder_point,
      reorder_quantity,
      specifications = {},
      notes
    } = req.body;
    
    // Validate required fields
    if (!category_id || !name?.trim()) {
      return res.status(400).json({ error: 'Category and name are required' });
    }
    
    // Validate category exists and is active
    const category = await query(
      'SELECT id FROM material_categories WHERE id = ? AND is_active = TRUE',
      [category_id]
    ) as any[];
    
    if (category.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive category' });
    }
    
    // Validate specifications against category fields
    const categoryFields = await query(
      'SELECT * FROM category_fields WHERE category_id = ?',
      [category_id]
    ) as any[];
    
    const validatedSpecs = await validateSpecifications(specifications, categoryFields);
    if (validatedSpecs.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid specifications', 
        details: validatedSpecs.errors 
      });
    }
    
    const result = await query(
      `INSERT INTO product_standards 
       (category_id, name, description, supplier_id, supplier_part_number,
        current_price, minimum_order_qty, reorder_point, reorder_quantity,
        specifications, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id,
        name.trim(),
        description || null,
        supplier_id || null,
        supplier_part_number || null,
        current_price || null,
        minimum_order_qty,
        reorder_point || null,
        reorder_quantity || null,
        JSON.stringify(validatedSpecs.specifications),
        notes || null,
        user.user_id,
        user.user_id
      ]
    ) as any;
    
    res.json({ 
      message: 'Product standard created successfully', 
      product_id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating product standard:', error);
    res.status(500).json({ error: 'Failed to create product standard' });
  }
});

// Update product standard
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const updates = req.body;
    
    // Get current product to validate category changes
    const currentProduct = await query(
      'SELECT category_id FROM product_standards WHERE id = ?',
      [id]
    ) as any[];
    
    if (currentProduct.length === 0) {
      return res.status(404).json({ error: 'Product standard not found' });
    }
    
    const categoryId = updates.category_id || currentProduct[0].category_id;
    
    // Validate specifications if provided
    if (updates.specifications !== undefined) {
      const categoryFields = await query(
        'SELECT * FROM category_fields WHERE category_id = ?',
        [categoryId]
      ) as any[];
      
      const validatedSpecs = await validateSpecifications(updates.specifications, categoryFields);
      if (validatedSpecs.errors.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid specifications', 
          details: validatedSpecs.errors 
        });
      }
      updates.specifications = JSON.stringify(validatedSpecs.specifications);
    }
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    const allowedFields = [
      'category_id', 'name', 'description', 'supplier_id', 'supplier_part_number',
      'current_price', 'minimum_order_qty', 'reorder_point', 'reorder_quantity',
      'specifications', 'notes', 'is_active'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    // Add price_date if price was updated
    if (updates.current_price !== undefined) {
      updateFields.push('price_date = CURRENT_DATE');
    }
    
    updateFields.push('updated_by = ?');
    updateValues.push(user.user_id);
    updateValues.push(id);
    
    await query(
      `UPDATE product_standards SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({ message: 'Product standard updated successfully' });
  } catch (error) {
    console.error('Error updating product standard:', error);
    res.status(500).json({ error: 'Failed to update product standard' });
  }
});

// Delete product standard
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check if product has inventory
    const inventoryCount = await query(
      'SELECT COUNT(*) as count FROM unified_inventory WHERE product_standard_id = ?',
      [id]
    ) as any[];
    
    if (inventoryCount[0].count > 0) {
      // Soft delete if has inventory
      await query(
        'UPDATE product_standards SET is_active = FALSE, updated_by = ? WHERE id = ?',
        [user.user_id, id]
      );
      res.json({ message: 'Product standard deactivated successfully (inventory exists)' });
    } else {
      // Hard delete if no inventory
      await query('DELETE FROM product_standards WHERE id = ?', [id]);
      res.json({ message: 'Product standard deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting product standard:', error);
    res.status(500).json({ error: 'Failed to delete product standard' });
  }
});

// Get low stock items
router.get('/low-stock/items', authenticateToken, async (req, res) => {
  try {
    const { status_filter = 'all', category_id, supplier_id } = req.query;
    
    let sql = 'SELECT * FROM low_stock_items WHERE 1=1';
    const params: any[] = [];
    
    if (status_filter === 'critical') {
      sql += ' AND stock_status = "critical"';
    } else if (status_filter === 'low') {
      sql += ' AND stock_status IN ("critical", "low")';
    }
    
    if (category_id) {
      sql += ' AND category_id = ?';
      params.push(category_id);
    }
    
    if (supplier_id) {
      sql += ' AND supplier_id = ?';
      params.push(supplier_id);
    }
    
    const items = await query(sql, params) as any[];
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Helper function to validate specifications
async function validateSpecifications(specifications: any, categoryFields: any[]) {
  const errors: string[] = [];
  const validatedSpecs: any = {};
  
  for (const field of categoryFields) {
    const value = specifications[field.field_name];
    
    // Check required fields
    if (field.is_required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.field_label} is required`);
      continue;
    }
    
    // Skip validation if field is not provided and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    // Type validation
    switch (field.field_type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(`${field.field_label} must be a number`);
        } else {
          validatedSpecs[field.field_name] = Number(value);
        }
        break;
        
      case 'decimal':
        if (isNaN(Number(value))) {
          errors.push(`${field.field_label} must be a decimal number`);
        } else {
          validatedSpecs[field.field_name] = Number(value);
        }
        break;
        
      case 'boolean':
        validatedSpecs[field.field_name] = Boolean(value);
        break;
        
      case 'select':
        if (field.field_options) {
          const options = JSON.parse(field.field_options);
          if (!options.includes(value)) {
            errors.push(`${field.field_label} must be one of: ${options.join(', ')}`);
          } else {
            validatedSpecs[field.field_name] = value;
          }
        } else {
          validatedSpecs[field.field_name] = value;
        }
        break;
        
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`${field.field_label} must be a valid date`);
        } else {
          validatedSpecs[field.field_name] = value;
        }
        break;
        
      default: // 'text'
        validatedSpecs[field.field_name] = String(value);
    }
    
    // Additional validation rules
    if (field.validation_rules && value !== undefined && value !== null && value !== '') {
      try {
        const rules = JSON.parse(field.validation_rules);
        
        if (rules.min !== undefined && Number(value) < rules.min) {
          errors.push(`${field.field_label} must be at least ${rules.min}`);
        }
        
        if (rules.max !== undefined && Number(value) > rules.max) {
          errors.push(`${field.field_label} must be at most ${rules.max}`);
        }
        
        if (rules.regex && !new RegExp(rules.regex).test(String(value))) {
          errors.push(`${field.field_label} format is invalid`);
        }
      } catch (e) {
        console.warn('Invalid validation rules for field:', field.field_name);
      }
    }
  }
  
  return { specifications: validatedSpecs, errors };
}

export default router;