import { pool } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface ProductStandardData {
  category_id: number;
  name: string;
  description?: string;
  supplier_id?: number;
  supplier_part_number?: string;
  current_price?: number;
  price_date?: string;
  minimum_order_qty?: number;
  unit_of_measure?: string;
  reorder_point?: number;
  reorder_quantity?: number;
  lead_time_days?: number;
  specifications?: string; // JSON string
  notes?: string;
  is_active?: boolean;
  created_by?: number;
  updated_by?: number;
}

export class ProductStandardRepository {
  /**
   * Get product standards with optional filters
   */
  static async getProductStandards(filters: {
    category_id?: number;
    supplier_id?: number;
    search?: string;
  } = {}): Promise<RowDataPacket[]> {
    let whereClause = 'WHERE ps.is_active = TRUE';
    const params: any[] = [];

    if (filters.category_id) {
      whereClause += ' AND ps.category_id = ?';
      params.push(filters.category_id);
    }

    if (filters.supplier_id) {
      whereClause += ' AND ps.supplier_id = ?';
      params.push(filters.supplier_id);
    }

    if (filters.search) {
      whereClause += ' AND (ps.name LIKE ? OR ps.description LIKE ? OR ps.supplier_part_number LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ps.*, mc.name as category_name, s.name as supplier_name,
        COALESCE(SUM(i.available_quantity), 0) as total_available
      FROM product_standards ps
      LEFT JOIN material_categories mc ON ps.category_id = mc.id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      LEFT JOIN inventory i ON ps.id = i.product_standard_id
      ${whereClause}
      GROUP BY ps.id
      ORDER BY mc.sort_order, ps.name`,
      params
    );

    return rows;
  }

  /**
   * Get single product standard by ID
   */
  static async getProductStandardById(id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ps.*, mc.name as category_name, s.name as supplier_name,
        COALESCE(SUM(i.available_quantity), 0) as total_available
      FROM product_standards ps
      LEFT JOIN material_categories mc ON ps.category_id = mc.id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      LEFT JOIN inventory i ON ps.id = i.product_standard_id
      WHERE ps.id = ? AND ps.is_active = TRUE
      GROUP BY ps.id`,
      [id]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create new product standard
   */
  static async createProductStandard(data: ProductStandardData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO product_standards 
       (category_id, name, description, supplier_id, supplier_part_number,
        current_price, price_date, minimum_order_qty, unit_of_measure,
        reorder_point, reorder_quantity, lead_time_days, specifications, notes,
        created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.category_id,
        data.name,
        data.description,
        data.supplier_id,
        data.supplier_part_number,
        data.current_price,
        data.price_date,
        data.minimum_order_qty || 1,
        data.unit_of_measure || 'each',
        data.reorder_point,
        data.reorder_quantity,
        data.lead_time_days || 7,
        data.specifications,
        data.notes,
        data.created_by,
        data.updated_by
      ]
    );

    return result.insertId;
  }

  /**
   * Update product standard
   */
  static async updateProductStandard(id: number, data: ProductStandardData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE product_standards 
       SET name = ?, description = ?, supplier_id = ?, supplier_part_number = ?,
           current_price = ?, price_date = ?, minimum_order_qty = ?, unit_of_measure = ?,
           reorder_point = ?, reorder_quantity = ?, lead_time_days = ?,
           specifications = ?, notes = ?, is_active = ?, updated_by = ?
       WHERE id = ?`,
      [
        data.name,
        data.description,
        data.supplier_id,
        data.supplier_part_number,
        data.current_price,
        data.price_date,
        data.minimum_order_qty,
        data.unit_of_measure,
        data.reorder_point,
        data.reorder_quantity,
        data.lead_time_days,
        data.specifications,
        data.notes,
        data.is_active,
        data.updated_by,
        id
      ]
    );

    return result.affectedRows;
  }

  /**
   * Check if product has inventory
   */
  static async getProductInventoryCount(id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM inventory WHERE product_standard_id = ?',
      [id]
    );
    return rows[0].count;
  }

  /**
   * Soft delete product standard
   */
  static async deleteProductStandard(id: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE product_standards SET is_active = FALSE WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  }

  /**
   * Update reorder settings for a product
   */
  static async updateReorderSettings(id: number, data: {
    reorder_point?: number;
    reorder_quantity?: number;
    updated_by: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE product_standards 
       SET reorder_point = ?, reorder_quantity = ?, updated_by = ?
       WHERE id = ?`,
      [data.reorder_point, data.reorder_quantity, data.updated_by, id]
    );
    return result.affectedRows;
  }
}