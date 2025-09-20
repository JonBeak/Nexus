import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// Get all vinyl products
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, brand, series, colour_number, colour_name, active_only } = req.query;
    
    let sql = `
      SELECT 
        vp.*,
        GROUP_CONCAT(s.name SEPARATOR ', ') as suppliers,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM vinyl_products vp
      LEFT JOIN users cu ON vp.created_by = cu.user_id
      LEFT JOIN users uu ON vp.updated_by = uu.user_id
      LEFT JOIN product_suppliers ps ON vp.product_id = ps.product_id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id AND s.is_active = TRUE
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Filter by active status (default to active only)
    if (active_only !== 'false') {
      sql += ' AND vp.is_active = TRUE';
    }
    
    if (search) {
      sql += ` AND (
        vp.brand LIKE ? OR 
        vp.series LIKE ? OR
        vp.colour_number LIKE ? OR
        vp.colour_name LIKE ? OR
        s.name LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (brand) {
      sql += ' AND vp.brand = ?';
      params.push(brand);
    }
    
    if (series) {
      sql += ' AND vp.series = ?';
      params.push(series);
    }
    
    // Handle colour filtering using new separate fields
    if (colour_number) {
      sql += ' AND vp.colour_number = ?';
      params.push(colour_number);
    }
    if (colour_name) {
      sql += ' AND vp.colour_name = ?';
      params.push(colour_name);
    }
    
    
    sql += ' GROUP BY vp.product_id ORDER BY vp.brand, vp.series, vp.colour_number, vp.colour_name';
    
    const products = await query(sql, params) as any[];
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching vinyl products:', error);
    res.status(500).json({ error: 'Failed to fetch vinyl products' });
  }
});

// Get single vinyl product
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const products = await query(
      `SELECT 
        vp.*,
        GROUP_CONCAT(s.name SEPARATOR ', ') as suppliers,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM vinyl_products vp
      LEFT JOIN users cu ON vp.created_by = cu.user_id
      LEFT JOIN users uu ON vp.updated_by = uu.user_id
      LEFT JOIN product_suppliers ps ON vp.product_id = ps.product_id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id AND s.is_active = TRUE
      WHERE vp.product_id = ?
      GROUP BY vp.product_id`,
      [id]
    ) as any[];
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get detailed supplier info
    const suppliers = await query(
      `SELECT s.*, ps.is_primary 
       FROM suppliers s 
       JOIN product_suppliers ps ON s.supplier_id = ps.supplier_id 
       WHERE ps.product_id = ? AND s.is_active = TRUE`,
      [id]
    ) as any[];
    
    const product = products[0];
    product.supplier_details = suppliers;
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching vinyl product:', error);
    res.status(500).json({ error: 'Failed to fetch vinyl product' });
  }
});

// Create new vinyl product
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check if user has permission (manager or owner)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { brand, series, colour_number, colour_name, supplier_ids, default_width } = req.body;
    
    // Check if product already exists
    const existingProduct = await query(
      `SELECT product_id FROM vinyl_products 
       WHERE brand = ? AND series = ? AND colour_number = ? AND colour_name = ?`,
      [brand, series, colour_number, colour_name]
    ) as any[];
    
    let productId;
    
    if (existingProduct.length > 0) {
      // Product exists, just return it
      productId = existingProduct[0].product_id;
    } else {
      // Create new product
      const result = await query(
        `INSERT INTO vinyl_products (
          brand, series, colour_number, colour_name, default_width, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [brand, series, colour_number, colour_name, default_width, user.user_id, user.user_id]
      ) as any;
      
      productId = result.insertId;
    }
    
    // Link suppliers if provided
    if (supplier_ids && supplier_ids.length > 0) {
      // Clear existing supplier links
      await query('DELETE FROM product_suppliers WHERE product_id = ?', [productId]);
      
      // Add new supplier links
      for (let i = 0; i < supplier_ids.length; i++) {
        await query(
          'INSERT INTO product_suppliers (product_id, supplier_id, is_primary) VALUES (?, ?, ?)',
          [productId, supplier_ids[i], i === 0] // First supplier is primary
        );
      }
    }
    
    res.json({ 
      message: existingProduct.length > 0 ? 'Product already exists' : 'Product created successfully', 
      product_id: productId 
    });
  } catch (error) {
    console.error('Error creating vinyl product:', error);
    res.status(500).json({ error: 'Failed to create vinyl product' });
  }
});

// Update vinyl product
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
    
    const allowedFields = [
      'brand', 'series', 'colour_number', 'colour_name', 'is_active', 'default_width'
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
    
    // Get original product values before updating to sync with vinyl items
    const originalProduct = await query(
      'SELECT brand, series, colour_number, colour_name FROM vinyl_products WHERE product_id = ?',
      [id]
    ) as any[];
    
    if (originalProduct.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const original = originalProduct[0];
    
    // Add updated_by
    updateFields.push('updated_by = ?');
    updateValues.push(user.user_id);
    
    // Add id for WHERE clause
    updateValues.push(id);
    
    await query(
      `UPDATE vinyl_products SET ${updateFields.join(', ')} WHERE product_id = ?`,
      updateValues
    );
    
    // Update corresponding vinyl items if brand, series, or colour changed
    if (updates.brand || updates.series || updates.colour_number || updates.colour_name) {
      const vinylUpdateFields: string[] = [];
      const vinylUpdateValues: any[] = [];
      
      if (updates.brand !== undefined) {
        vinylUpdateFields.push('brand = ?');
        vinylUpdateValues.push(updates.brand);
      }
      if (updates.series !== undefined) {
        vinylUpdateFields.push('series = ?');
        vinylUpdateValues.push(updates.series);
      }
      if (updates.colour_number !== undefined) {
        vinylUpdateFields.push('colour_number = ?');
        vinylUpdateValues.push(updates.colour_number);
      }
      if (updates.colour_name !== undefined) {
        vinylUpdateFields.push('colour_name = ?');
        vinylUpdateValues.push(updates.colour_name);
      }
      
      if (vinylUpdateFields.length > 0) {
        vinylUpdateFields.push('updated_by = ?');
        vinylUpdateValues.push(user.user_id);
        
        // Add WHERE clause values
        vinylUpdateValues.push(original.brand, original.series, original.colour_number, original.colour_name);
        
        await query(
          `UPDATE vinyl_inventory SET ${vinylUpdateFields.join(', ')} 
           WHERE brand = ? AND series = ? AND colour_number = ? AND colour_name = ?`,
          vinylUpdateValues
        );
      }
    }
    
    res.json({ message: 'Product and corresponding vinyl items updated successfully' });
  } catch (error) {
    console.error('Error updating vinyl product:', error);
    res.status(500).json({ error: 'Failed to update vinyl product' });
  }
});

// Delete vinyl product (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check if user has permission (manager or owner)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Get product details first
    const product = await query(
      'SELECT brand, series, colour_number, colour_name FROM vinyl_products WHERE product_id = ?',
      [id]
    ) as any[];
    
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check if product is in use by looking for vinyl items with matching brand/series/colour
    const vinylCount = await query(
      'SELECT COUNT(*) as count FROM vinyl_inventory WHERE brand = ? AND series = ? AND colour_number = ? AND colour_name = ?',
      [product[0].brand, product[0].series, product[0].colour_number, product[0].colour_name]
    ) as any[];
    
    if (vinylCount[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product',
        message: `Product is in use by ${vinylCount[0].count} vinyl item(s). Delete or mark vinyl items as used first.`,
        vinylCount: vinylCount[0].count
      });
    } else {
      // Mark as inactive instead of hard delete
      await query(
        'UPDATE vinyl_products SET is_active = FALSE, updated_by = ? WHERE product_id = ?',
        [user.user_id, id]
      );
      res.json({ message: 'Product marked as inactive successfully' });
    }
  } catch (error) {
    console.error('Error deleting vinyl product:', error);
    res.status(500).json({ error: 'Failed to delete vinyl product' });
  }
});

// Get product statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_products,
        COUNT(DISTINCT brand) as brand_count,
        COUNT(DISTINCT series) as series_count
      FROM vinyl_products
    `) as any[];
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching product statistics:', error);
    res.status(500).json({ error: 'Failed to fetch product statistics' });
  }
});

// Get autofill suggestions
router.get('/autofill/suggestions', authenticateToken, async (req, res) => {
  try {
    const { brand, series, colour_number, colour_name } = req.query;
    
    let whereConditions = ['vp.is_active = TRUE'];
    const params: any[] = [];
    
    if (brand) {
      whereConditions.push('vp.brand = ?');
      params.push(brand);
    }
    if (series) {
      whereConditions.push('vp.series = ?');
      params.push(series);
    }
    // Handle colour filtering using new separate fields
    if (colour_number) {
      whereConditions.push('vp.colour_number = ?');
      params.push(colour_number);
    }
    if (colour_name) {
      whereConditions.push('vp.colour_name = ?');
      params.push(colour_name);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const suggestions = await query(`
      SELECT DISTINCT
        vp.brand,
        vp.series,
        vp.colour_number,
        vp.colour_name,
        CASE 
          WHEN vp.colour_number IS NOT NULL AND vp.colour_name IS NOT NULL THEN CONCAT(vp.colour_number, ' ', vp.colour_name)
          WHEN vp.colour_number IS NOT NULL THEN vp.colour_number
          WHEN vp.colour_name IS NOT NULL THEN vp.colour_name
          ELSE ''
        END as display_colour,
        vp.default_width,
        GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') as suppliers
      FROM vinyl_products vp
      LEFT JOIN product_suppliers ps ON vp.product_id = ps.product_id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id AND s.is_active = TRUE
      ${whereClause}
      GROUP BY vp.brand, vp.series, vp.colour_number, vp.colour_name, vp.default_width
      ORDER BY vp.brand, vp.series, vp.colour_number, vp.colour_name
    `, params) as any[];
    
    // Extract unique values for each field
    const result = {
      brands: [...new Set(suggestions.map(s => s.brand).filter(Boolean))],
      series: [...new Set(suggestions.map(s => s.series).filter(Boolean))],
      colour_numbers: [...new Set(suggestions.map(s => s.colour_number).filter(Boolean))],
      colour_names: [...new Set(suggestions.map(s => s.colour_name).filter(Boolean))],
      combinations: suggestions
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching autofill suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch autofill suggestions' });
  }
});


export default router;