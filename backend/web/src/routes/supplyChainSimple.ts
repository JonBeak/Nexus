import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

const router = express.Router();

// All supply chain routes require authentication
router.use(authenticateToken);

// Simple dashboard stats endpoint
router.get('/dashboard-stats', async (req: Request, res: Response) => {
  try {
    const [stats] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        (SELECT COUNT(*) FROM material_categories WHERE is_active = TRUE) as total_categories,
        (SELECT COUNT(*) FROM product_standards WHERE is_active = TRUE) as total_products,
        (SELECT COUNT(*) FROM inventory) as total_inventory_items,
        (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory) as total_available_quantity,
        0 as critical_items,
        0 as low_items`
    );

    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

// Simple categories endpoint
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        id, name, description, icon, sort_order, is_active,
        created_at, updated_at
      FROM material_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order, name`
    );
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Simple low stock endpoint
router.get('/low-stock', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ps.id,
        ps.name,
        ps.category_id,
        mc.name as category_name,
        mc.icon as category_icon,
        ps.supplier_id,
        s.name as supplier_name,
        COALESCE(SUM(i.available_quantity), 0) as current_stock,
        ps.reorder_point,
        ps.reorder_quantity,
        ps.current_price,
        ps.unit_of_measure,
        CASE
          WHEN COALESCE(SUM(i.available_quantity), 0) = 0 THEN 'out_of_stock'
          WHEN COALESCE(SUM(i.available_quantity), 0) <= COALESCE(ps.reorder_point, 0) THEN 'critical'
          WHEN COALESCE(SUM(i.available_quantity), 0) <= COALESCE(ps.reorder_point, 0) * 1.5 THEN 'low'
          ELSE 'ok'
        END as stock_status
      FROM product_standards ps
      JOIN material_categories mc ON ps.category_id = mc.id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      LEFT JOIN inventory i ON ps.id = i.product_standard_id
      WHERE ps.is_active = TRUE
      GROUP BY ps.id
      HAVING stock_status IN ('out_of_stock', 'critical', 'low')
      ORDER BY 
        CASE stock_status 
          WHEN 'out_of_stock' THEN 1
          WHEN 'critical' THEN 2
          WHEN 'low' THEN 3
        END,
        ps.name`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
});

export default router;