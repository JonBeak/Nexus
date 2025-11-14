// File Clean up Finished: Nov 14, 2025
import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface SupplierRow extends RowDataPacket {
  supplier_id: number;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  supplier_type: 'general' | 'vinyl' | 'both';
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  updated_by: number | null;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface SupplierStatsRow extends RowDataPacket {
  total_suppliers: number;
  active_suppliers: number;
  suppliers_with_email: number;
  suppliers_with_website: number;
}

export interface SupplierSearchParams {
  search?: string;
  active_only?: boolean;
}

export class SupplierRepository {
  /**
   * Build enriched supplier query with user names
   */
  private buildSupplierQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        s.*,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM suppliers s
      LEFT JOIN users cu ON s.created_by = cu.user_id
      LEFT JOIN users uu ON s.updated_by = uu.user_id
      WHERE ${whereClause}
    `;
  }

  /**
   * Get all suppliers with optional filtering
   */
  async findAll(params: SupplierSearchParams): Promise<SupplierRow[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    // Filter by active status (default to active only)
    if (params.active_only !== false) {
      conditions.push('s.is_active = TRUE');
    }

    // Search filter
    if (params.search) {
      conditions.push(`(
        s.name LIKE ? OR
        s.contact_email LIKE ? OR
        s.website LIKE ?
      )`);
      const searchTerm = `%${params.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const sql = this.buildSupplierQuery(conditions.join(' AND ')) + ' ORDER BY s.name';

    return await query(sql, queryParams) as SupplierRow[];
  }

  /**
   * Get single supplier by ID
   */
  async findById(id: number): Promise<SupplierRow | null> {
    const sql = this.buildSupplierQuery('s.supplier_id = ?');
    const rows = await query(sql, [id]) as SupplierRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create new supplier
   */
  async create(data: {
    name: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
    notes?: string;
    created_by: number;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO suppliers (name, contact_email, contact_phone, website, notes, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.contact_email || null,
        data.contact_phone || null,
        data.website || null,
        data.notes || null,
        data.created_by,
        data.created_by
      ]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update supplier
   */
  async update(id: number, updates: {
    name?: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
    notes?: string;
    is_active?: boolean;
    updated_by: number;
  }): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    const allowedFields = ['name', 'contact_email', 'contact_phone', 'website', 'notes', 'is_active'];

    for (const field of allowedFields) {
      if (updates[field as keyof typeof updates] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof typeof updates]);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_by
    updateFields.push('updated_by = ?');
    updateValues.push(updates.updated_by);

    // Add id for WHERE clause
    updateValues.push(id);

    await query(
      `UPDATE suppliers SET ${updateFields.join(', ')} WHERE supplier_id = ?`,
      updateValues
    );
  }

  /**
   * Soft delete supplier (deactivate)
   */
  async softDelete(id: number, updated_by: number): Promise<void> {
    await query(
      'UPDATE suppliers SET is_active = FALSE, updated_by = ? WHERE supplier_id = ?',
      [updated_by, id]
    );
  }

  /**
   * Hard delete supplier
   */
  async hardDelete(id: number): Promise<void> {
    await query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
  }

  /**
   * Check if supplier has associated products
   */
  async getProductCount(id: number): Promise<number> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM product_suppliers WHERE supplier_id = ?',
      [id]
    ) as RowDataPacket[];

    return rows[0].count;
  }

  /**
   * Get supplier statistics
   */
  async getStatistics(): Promise<SupplierStatsRow> {
    const rows = await query(`
      SELECT
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_suppliers,
        COUNT(CASE WHEN contact_email IS NOT NULL AND contact_email != '' THEN 1 END) as suppliers_with_email,
        COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as suppliers_with_website
      FROM suppliers
    `) as SupplierStatsRow[];

    return rows[0];
  }
}
