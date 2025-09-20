import { pool } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface InventoryData {
  product_standard_id: number;
  quantity: number;
  reserved_quantity?: number;
  location?: string;
  lot_number?: string;
  serial_number?: string;
  received_date?: string;
  expiry_date?: string;
  cost_per_unit?: number;
  supplier_order_id?: number;
  condition_status?: 'new' | 'used' | 'damaged' | 'returned';
  notes?: string;
  created_by?: number;
  updated_by?: number;
}

export class InventoryRepository {
  /**
   * Get inventory items with optional filters
   */
  static async getInventory(filters: {
    category_id?: number;
    location?: string;
    low_stock?: boolean;
  } = {}): Promise<RowDataPacket[]> {
    let whereClause = 'WHERE ps.is_active = TRUE';
    const params: any[] = [];

    if (filters.category_id) {
      whereClause += ' AND ps.category_id = ?';
      params.push(filters.category_id);
    }

    if (filters.location) {
      whereClause += ' AND i.location LIKE ?';
      params.push(`%${filters.location}%`);
    }

    if (filters.low_stock === true) {
      whereClause += ' AND i.available_quantity <= ps.reorder_point';
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        i.*, ps.name as product_name, ps.reorder_point, ps.unit_of_measure,
        mc.name as category_name, s.name as supplier_name
      FROM inventory i
      JOIN product_standards ps ON i.product_standard_id = ps.id
      JOIN material_categories mc ON ps.category_id = mc.id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      ${whereClause}
      ORDER BY mc.sort_order, ps.name, i.location`,
      params
    );

    return rows;
  }

  /**
   * Get inventory availability for a specific product
   */
  static async getInventoryAvailability(productStandardId: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        COALESCE(SUM(i.reserved_quantity), 0) as total_reserved,
        COALESCE(SUM(i.available_quantity), 0) as total_available,
        ps.reorder_point, ps.reorder_quantity, ps.unit_of_measure
      FROM product_standards ps
      LEFT JOIN inventory i ON ps.id = i.product_standard_id
      WHERE ps.id = ? AND ps.is_active = TRUE
      GROUP BY ps.id`,
      [productStandardId]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create new inventory item
   */
  static async createInventoryItem(data: InventoryData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO inventory 
       (product_standard_id, quantity, location, lot_number, serial_number,
        received_date, expiry_date, cost_per_unit, notes, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.product_standard_id,
        data.quantity,
        data.location,
        data.lot_number,
        data.serial_number,
        data.received_date,
        data.expiry_date,
        data.cost_per_unit,
        data.notes,
        data.created_by,
        data.updated_by
      ]
    );

    return result.insertId;
  }

  /**
   * Update inventory item
   */
  static async updateInventoryItem(id: number, data: Partial<InventoryData>): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE inventory 
       SET quantity = ?, reserved_quantity = ?, location = ?, lot_number = ?, 
           serial_number = ?, received_date = ?, expiry_date = ?, cost_per_unit = ?,
           condition_status = ?, notes = ?, updated_by = ?
       WHERE id = ?`,
      [
        data.quantity,
        data.reserved_quantity,
        data.location,
        data.lot_number,
        data.serial_number,
        data.received_date,
        data.expiry_date,
        data.cost_per_unit,
        data.condition_status,
        data.notes,
        data.updated_by,
        id
      ]
    );

    return result.affectedRows;
  }

  /**
   * Check if inventory has active allocations
   */
  static async getInventoryAllocationCount(id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM inventory_allocations WHERE inventory_id = ? AND status = "reserved"',
      [id]
    );
    return rows[0].count;
  }

  /**
   * Delete inventory item
   */
  static async deleteInventoryItem(id: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM inventory WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(filters: { category_id?: number } = {}): Promise<RowDataPacket[]> {
    let whereClause = '';
    const params: any[] = [];

    if (filters.category_id) {
      whereClause = 'WHERE category_id = ?';
      params.push(filters.category_id);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM low_stock_items ${whereClause} ORDER BY 
       CASE stock_status 
         WHEN 'out_of_stock' THEN 1
         WHEN 'critical' THEN 2  
         WHEN 'low' THEN 3
         ELSE 4 
       END,
       category_name, name`,
      params
    );

    return rows;
  }
}