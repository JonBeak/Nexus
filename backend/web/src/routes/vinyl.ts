import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
const router = Router();

// Get all vinyl inventory items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { disposition, search } = req.query;
    
    let sql = `
      SELECT 
        v.*,
        CONCAT(su.first_name, ' ', su.last_name) as storage_user_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as usage_user_name
      FROM vinyl_inventory v
      LEFT JOIN users su ON v.storage_user = su.user_id
      LEFT JOIN users uu ON v.usage_user = uu.user_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (disposition) {
      sql += ' AND v.disposition = ?';
      params.push(disposition);
    }
    
    if (search) {
      sql += ` AND (
        v.brand LIKE ? OR 
        v.series LIKE ? OR
        v.colour_number LIKE ? OR
        v.colour_name LIKE ? OR
        v.location LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY v.created_at DESC';
    
    const items = await query(sql, params) as any[];
    
    // Get job links for each vinyl
    for (const item of items) {
      const jobLinks = await query(
        `SELECT 
          vjl.*,
          j.job_number,
          j.job_name,
          c.company_name as customer_name
        FROM vinyl_job_links vjl
        JOIN jobs j ON vjl.job_id = j.job_id
        LEFT JOIN customers c ON j.customer_id = c.customer_id
        WHERE vjl.vinyl_id = ?
        ORDER BY vjl.sequence_order`,
        [item.id]
      ) as any[];
      
      item.job_associations = jobLinks;
      
      // Get supplier information
      if (item.supplier_id) {
        const supplier = await query(
          'SELECT * FROM suppliers WHERE supplier_id = ?',
          [item.supplier_id]
        ) as any[];
        
        item.supplier = supplier[0] || null;
        item.supplier_name = supplier[0]?.name || null;
      } else {
        item.supplier = null;
        item.supplier_name = null;
      }
    }
    
    // Transform for frontend compatibility
    const transformedItems = items.map(item => ({
      ...item,
      current_stock: item.disposition === 'in_stock' ? item.length_yards : 0,
      minimum_stock: 0, // Not used in new structure
      unit: 'yards',
      last_updated: item.updated_at,
      // Computed display colour from separate fields
      display_colour: item.colour_number && item.colour_name ? `${item.colour_number} ${item.colour_name}` : (item.colour_number || item.colour_name || '')
    }));
    
    res.json(transformedItems);
  } catch (error) {
    console.error('Error fetching vinyl inventory:', error);
    res.status(500).json({ error: 'Failed to fetch vinyl inventory' });
  }
});

// Get single vinyl item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Vinyl Route] Fetching vinyl item with ID: ${id}`);
    
    const items = await query(
      `SELECT 
        v.*,
        CONCAT(su.first_name, ' ', su.last_name) as storage_user_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as usage_user_name
      FROM vinyl_inventory v
      LEFT JOIN users su ON v.storage_user = su.user_id
      LEFT JOIN users uu ON v.usage_user = uu.user_id
      WHERE v.id = ?`,
      [id]
    ) as any[];
    
    console.log(`[Vinyl Route] Query returned ${items.length} items`);
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Vinyl item not found' });
    }
    
    const item = items[0];
    
    // Get job links
    const jobLinks = await query(
      `SELECT 
        vjl.*,
        j.job_number,
        j.job_name,
        c.company_name as customer_name
      FROM vinyl_job_links vjl
      JOIN jobs j ON vjl.job_id = j.job_id
      LEFT JOIN customers c ON j.customer_id = c.customer_id
      WHERE vjl.vinyl_id = ?
      ORDER BY vjl.sequence_order`,
      [id]
    ) as any[];
    
    item.job_associations = jobLinks;
    
    // Get supplier information
    if (item.supplier_id) {
      const supplier = await query(
        'SELECT * FROM suppliers WHERE supplier_id = ?',
        [item.supplier_id]
      ) as any[];
      
      item.supplier = supplier[0] || null;
      item.supplier_name = supplier[0]?.name || null;
    } else {
      item.supplier = null;
      item.supplier_name = null;
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching vinyl item:', error);
    res.status(500).json({ error: 'Failed to fetch vinyl item' });
  }
});

// Create new vinyl item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    const {
      brand = null, 
      series = null, 
      colour_number = null,
      colour_name = null,
      width,
      length_yards, 
      location = null, 
      supplier_id = null,
      purchase_date = null, 
      storage_date = null, 
      storage_note = null, 
      notes = null,
      source_vinyl_id = null, // For copying job links
      job_ids = [] // For linking to jobs
    } = req.body;
    
    // Use the provided colour fields directly
    const finalColourNumber = colour_number;
    const finalColourName = colour_name;
    
    // Calculate expiration date (e.g., 2 years from storage date)
    const storageDate = storage_date ? new Date(storage_date) : new Date();
    const expirationDate = new Date(storageDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 2);
    
    // Generate label ID
    const year = new Date().getFullYear();
    const countResult = await query(
      'SELECT COUNT(*) as count FROM vinyl_inventory WHERE YEAR(created_at) = ?',
      [year]
    ) as any[];
    const labelId = `VIN-${year}-${String(countResult[0].count + 1).padStart(3, '0')}`;
    
    
    const result = await query(
      `INSERT INTO vinyl_inventory (
        brand, series, colour_number, colour_name, width,
        length_yards, location, supplier_id,
        purchase_date, storage_date, expiration_date,
        storage_user, storage_note, notes, label_id,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        brand || null, 
        series || null, 
        finalColourNumber || null,
        finalColourName || null,
        width || null,
        length_yards || null, 
        location || null, 
        supplier_id || null,
        purchase_date || null, 
        storage_date || null, 
        expirationDate,
        user.user_id, 
        storage_note || null, 
        notes || null, 
        labelId,
        user.user_id, 
        user.user_id
      ]
    ) as any;
    
    const vinylId = result.insertId;
    
    // Add this combination to the product catalog if it doesn't exist
    // Width is not considered - products are brand+series+colour only
    if (brand && series && (finalColourNumber || finalColourName)) {
      try {
        // Check if product already exists
        const existingProduct = await query(
          'SELECT product_id FROM vinyl_products WHERE brand = ? AND series = ? AND colour_number = ? AND colour_name = ?',
          [brand, series, finalColourNumber, finalColourName]
        ) as any[];
        
        // Only insert if product doesn't exist
        if (existingProduct.length === 0) {
          await query(
            `INSERT INTO vinyl_products (
              brand, series, colour_number, colour_name, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [brand, series, finalColourNumber, finalColourName, user.user_id, user.user_id]
          );
        }
      } catch (catalogError) {
        // Log but don't fail the vinyl creation if catalog update fails
        console.warn('Failed to update product catalog:', catalogError);
      }
    }
    
    // Copy job links from source vinyl if specified
    if (source_vinyl_id) {
      await query(
        `INSERT INTO vinyl_job_links (vinyl_id, job_id, sequence_order)
        SELECT ?, job_id, sequence_order
        FROM vinyl_job_links
        WHERE vinyl_id = ?`,
        [vinylId, source_vinyl_id]
      );
    }
    
    // Link to jobs if specified
    if (job_ids && job_ids.length > 0) {
      for (let i = 0; i < job_ids.length; i++) {
        await query(
          `INSERT INTO vinyl_job_links (vinyl_id, job_id, sequence_order)
          VALUES (?, ?, ?)`,
          [vinylId, job_ids[i], i + 1]
        );
      }
    }
    
    res.json({ 
      message: 'Vinyl item created successfully', 
      id: vinylId,
      label_id: labelId 
    });
  } catch (error) {
    console.error('Error creating vinyl item:', error);
    res.status(500).json({ error: 'Failed to create vinyl item' });
  }
});

// Update vinyl item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    const allowedFields = [
      'brand', 'series', 'colour_number', 'colour_name', 'width',
      'length_yards', 'location', 'supplier_id',
      'disposition', 'waste_reason', 'return_date', 'return_reference',
      'purchase_date', 'storage_date', 'usage_date', 'status_change_date', 'expiration_date',
      'storage_user', 'usage_user', 'notes'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        
        // Handle date fields - convert empty strings to null
        const dateFields = ['purchase_date', 'storage_date', 'usage_date', 'expiration_date', 'return_date'];
        if (dateFields.includes(field) && updates[field] === '') {
          updateValues.push(null);
        } else {
          updateValues.push(updates[field]);
        }
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
    
    const sqlQuery = `UPDATE vinyl_inventory SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await query(sqlQuery, updateValues);
    
    // Add new product combination to catalog if brand/series/colour were updated
    if (updates.brand || updates.series || updates.colour_number || updates.colour_name) {
      // Get the current vinyl item to check the final values
      const currentItem = await query(
        'SELECT brand, series, colour_number, colour_name FROM vinyl_inventory WHERE id = ?',
        [id]
      ) as any[];
      
      if (currentItem.length > 0) {
        const item = currentItem[0];
        if (item.brand && item.series && (item.colour_number || item.colour_name)) {
          try {
            // Check if product already exists
            const existingProduct = await query(
              'SELECT product_id FROM vinyl_products WHERE brand = ? AND series = ? AND colour_number = ? AND colour_name = ?',
              [item.brand, item.series, item.colour_number, item.colour_name]
            ) as any[];
            
            // Only insert if product doesn't exist
            if (existingProduct.length === 0) {
              await query(
                `INSERT INTO vinyl_products (
                  brand, series, colour_number, colour_name, created_by, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [item.brand, item.series, item.colour_number, item.colour_name, user.user_id, user.user_id]
              );
            }
          } catch (catalogError) {
            // Log but don't fail the vinyl update if catalog update fails
            console.warn('Failed to update product catalog during update:', catalogError);
          }
        }
      }
    }
    
    res.json({ message: 'Vinyl item updated successfully' });
  } catch (error) {
    console.error('Error updating vinyl item:', error, {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ error: 'Failed to update vinyl item' });
  }
});

// Mark vinyl as used
router.put('/:id/use', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { usage_note, job_ids } = req.body;
    
    console.log(`[Vinyl Route] Marking vinyl ${id} as used. User: ${user.user_id}, Note: ${usage_note}`);
    
    // Update vinyl as used - use single notes field
    console.log(`[Vinyl Route] Executing UPDATE query for vinyl ${id}`);
    await query(
      `UPDATE vinyl_inventory 
      SET disposition = 'used', 
          usage_date = CURRENT_DATE,
          usage_user = ?,
          notes = ?,
          updated_by = ?
      WHERE id = ?`,
      [user.user_id, usage_note, user.user_id, id]
    );
    console.log(`[Vinyl Route] UPDATE query completed for vinyl ${id}`);
    
    // Add job links (additive approach - preserve existing associations)
    if (job_ids && job_ids.length > 0) {
      // Get current max sequence order for this vinyl
      const maxSeqResult = await query(
        'SELECT COALESCE(MAX(sequence_order), 0) as max_seq FROM vinyl_job_links WHERE vinyl_id = ?',
        [id]
      ) as any[];
      
      let startSeq = maxSeqResult[0].max_seq + 1;
      console.log(`[Vinyl Route] Starting sequence for new jobs: ${startSeq}`);
      
      for (let i = 0; i < job_ids.length; i++) {
        console.log(`[Vinyl Route] Processing job_id: ${job_ids[i]} for vinyl ${id}`);
        
        // Check if job association already exists
        const existingLink = await query(
          'SELECT 1 FROM vinyl_job_links WHERE vinyl_id = ? AND job_id = ?',
          [id, job_ids[i]]
        ) as any[];
        
        // Only add if doesn't exist
        if (existingLink.length === 0) {
          await query(
            `INSERT INTO vinyl_job_links (vinyl_id, job_id, sequence_order)
            VALUES (?, ?, ?)`,
            [id, job_ids[i], startSeq + i]
          );
          console.log(`[Vinyl Route] Added job link: vinyl ${id} -> job ${job_ids[i]} (seq: ${startSeq + i})`);
        } else {
          console.log(`[Vinyl Route] Job link already exists: vinyl ${id} -> job ${job_ids[i]}`);
        }
      }
    } else {
      console.log(`[Vinyl Route] No job_ids provided or empty array for vinyl ${id}`);
    }
    
    res.json({ message: 'Vinyl marked as used successfully' });
  } catch (error) {
    console.error('Error marking vinyl as used:', error);
    res.status(500).json({ error: 'Failed to mark vinyl as used' });
  }
});

// Delete vinyl item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Check if user has permission (manager or owner)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    await query('DELETE FROM vinyl_inventory WHERE id = ?', [id]);
    
    res.json({ message: 'Vinyl item deleted successfully' });
  } catch (error) {
    console.error('Error deleting vinyl item:', error);
    res.status(500).json({ error: 'Failed to delete vinyl item' });
  }
});

// Get recent vinyl items (for copying)
router.get('/recent/for-copying', authenticateToken, async (req, res) => {
  try {
    const recentItems = await query(
      `SELECT 
        v.id, v.brand, v.series, v.colour_number, v.colour_name, v.width,
        v.location
      FROM vinyl_inventory v
      WHERE v.disposition = 'used' 
        AND v.usage_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
      ORDER BY v.usage_date DESC
      LIMIT 20`
    ) as any[];
    
    res.json(recentItems);
  } catch (error) {
    console.error('Error fetching recent vinyl items:', error);
    res.status(500).json({ error: 'Failed to fetch recent vinyl items' });
  }
});

// Get vinyl statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN disposition = 'in_stock' THEN 1 END) as in_stock_count,
        COUNT(CASE WHEN disposition = 'used' THEN 1 END) as used_count,
        COUNT(CASE WHEN disposition = 'waste' THEN 1 END) as waste_count,
        SUM(CASE WHEN disposition = 'in_stock' THEN length_yards ELSE 0 END) as total_yards_in_stock,
        SUM(CASE WHEN disposition = 'used' THEN length_yards ELSE 0 END) as total_yards_used,
        SUM(CASE WHEN disposition = 'waste' THEN length_yards ELSE 0 END) as total_yards_waste,
        SUM(length_yards) as total_yards_all
      FROM vinyl_inventory
    `) as any[];
    
    // Get supplier count from vinyl items
    const supplierCountResult = await query(`
      SELECT COUNT(DISTINCT supplier_id) as supplier_count
      FROM vinyl_inventory
      WHERE supplier_id IS NOT NULL
    `) as any[];
    
    const finalStats = {
      ...stats[0],
      supplier_count: supplierCountResult[0]?.supplier_count || 0
    };
    
    res.json(finalStats);
  } catch (error) {
    console.error('Error fetching vinyl statistics:', error);
    res.status(500).json({ error: 'Failed to fetch vinyl statistics' });
  }
});

// Get suppliers available for a product combination
router.get('/suppliers/for-product', authenticateToken, async (req, res) => {
  try {
    const { brand, series, colour_number, colour_name } = req.query;
    
    // First try to find an exact product match
    let productQuery = `
      SELECT vp.product_id 
      FROM vinyl_products vp 
      WHERE vp.is_active = TRUE
    `;
    const params: any[] = [];
    
    if (brand) {
      productQuery += ' AND vp.brand = ?';
      params.push(brand);
    }
    if (series) {
      productQuery += ' AND vp.series = ?';
      params.push(series);
    }
    // Handle colour filtering using new separate fields
    if (colour_number) {
      productQuery += ' AND vp.colour_number = ?';
      params.push(colour_number);
    }
    if (colour_name) {
      productQuery += ' AND vp.colour_name = ?';
      params.push(colour_name);
    }
    
    const products = await query(productQuery, params) as any[];
    
    if (products.length === 0) {
      // No matching product found, return all active suppliers
      const allSuppliers = await query(
        'SELECT * FROM suppliers WHERE is_active = TRUE ORDER BY name',
        []
      ) as any[];
      
      return res.json(allSuppliers);
    }
    
    // Get suppliers for the matched products
    const suppliers = await query(`
      SELECT DISTINCT s.*
      FROM suppliers s
      JOIN product_suppliers ps ON s.supplier_id = ps.supplier_id
      WHERE ps.product_id IN (${products.map(() => '?').join(',')}) 
        AND s.is_active = TRUE
      ORDER BY s.name
    `, products.map(p => p.product_id)) as any[];
    
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers for product:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers for product' });
  }
});

// Manage job links for vinyl items
router.put('/:id/job-links', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { job_ids } = req.body;
    
    // Validate vinyl exists
    const vinyl = await query('SELECT id FROM vinyl_inventory WHERE id = ?', [id]) as any[];
    if (vinyl.length === 0) {
      return res.status(404).json({ error: 'Vinyl item not found' });
    }
    
    // Remove existing job links and replace with new ones
    await query(
      'DELETE FROM vinyl_job_links WHERE vinyl_id = ?',
      [id]
    );
    
    // Add new job links
    if (job_ids && job_ids.length > 0) {
      for (let i = 0; i < job_ids.length; i++) {
        await query(
          `INSERT INTO vinyl_job_links (vinyl_id, job_id, sequence_order)
          VALUES (?, ?, ?)`,
          [id, job_ids[i], i + 1]
        );
      }
    }
    
    res.json({ message: 'Job links updated successfully' });
  } catch (error) {
    console.error('Error updating inventory job links:', error);
    res.status(500).json({ error: 'Failed to update job links' });
  }
});

// Get job links for a vinyl item (unified endpoint)
router.get('/:id/job-links', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobLinks = await query(
      `SELECT 
        vjl.job_id,
        vjl.sequence_order,
        j.job_number,
        j.job_name,
        c.company_name as customer_name
      FROM vinyl_job_links vjl
      JOIN jobs j ON vjl.job_id = j.job_id
      LEFT JOIN customers c ON j.customer_id = c.customer_id
      WHERE vjl.vinyl_id = ?
      ORDER BY vjl.sequence_order`,
      [id]
    ) as any[];
    
    res.json(jobLinks);
  } catch (error) {
    console.error('Error fetching job links:', error);
    res.status(500).json({ error: 'Failed to fetch job links' });
  }
});

export default router;