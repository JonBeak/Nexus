/**
 * Material Requirements Repository
 * Data access layer for material requirements tracking
 * Created: 2025-01-27
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  MaterialRequirement,
  MaterialRequirementStatus,
  MaterialRequirementSearchParams,
  CreateMaterialRequirementRequest,
  UpdateMaterialRequirementRequest,
} from '../types/materialRequirements';

export interface MaterialRequirementRow extends RowDataPacket, MaterialRequirement {}

export class MaterialRequirementRepository {
  /**
   * Build enriched material requirement query with joined data
   */
  private buildMaterialRequirementQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        mr.*,
        (mr.quantity_ordered - mr.quantity_received) as quantity_remaining,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        pa.name as archetype_name,
        pa.category as archetype_category,
        pa.unit_of_measure,
        sp.product_name as supplier_product_name,
        sp.sku as supplier_product_sku,
        s.name as supplier_name,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM material_requirements mr
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN product_archetypes pa ON mr.archetype_id = pa.archetype_id
      LEFT JOIN supplier_products sp ON mr.supplier_product_id = sp.supplier_product_id
      LEFT JOIN suppliers s ON mr.supplier_id = s.supplier_id
      LEFT JOIN users cu ON mr.created_by = cu.user_id
      LEFT JOIN users uu ON mr.updated_by = uu.user_id
      WHERE ${whereClause}
    `;
  }

  /**
   * Get all material requirements with optional filtering
   */
  async findAll(params: MaterialRequirementSearchParams = {}): Promise<MaterialRequirementRow[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    // Filter by order
    if (params.order_id !== undefined) {
      conditions.push('mr.order_id = ?');
      queryParams.push(params.order_id);
    }

    // Filter by supplier
    if (params.supplier_id !== undefined) {
      conditions.push('mr.supplier_id = ?');
      queryParams.push(params.supplier_id);
    }

    // Filter by archetype
    if (params.archetype_id !== undefined) {
      conditions.push('mr.archetype_id = ?');
      queryParams.push(params.archetype_id);
    }

    // Filter by status (single or array)
    if (params.status !== undefined) {
      if (Array.isArray(params.status)) {
        const placeholders = params.status.map(() => '?').join(',');
        conditions.push(`mr.status IN (${placeholders})`);
        queryParams.push(...params.status);
      } else {
        conditions.push('mr.status = ?');
        queryParams.push(params.status);
      }
    }

    // Filter by stock item
    if (params.is_stock_item !== undefined) {
      conditions.push('mr.is_stock_item = ?');
      queryParams.push(params.is_stock_item ? 1 : 0);
    }

    // Filter by entry date range
    if (params.entry_date_from) {
      conditions.push('mr.entry_date >= ?');
      queryParams.push(params.entry_date_from);
    }
    if (params.entry_date_to) {
      conditions.push('mr.entry_date <= ?');
      queryParams.push(params.entry_date_to);
    }

    // Search in multiple fields
    if (params.search) {
      conditions.push(`(
        o.order_number LIKE ? OR
        o.order_name LIKE ? OR
        c.company_name LIKE ? OR
        pa.name LIKE ? OR
        mr.custom_product_type LIKE ? OR
        s.name LIKE ? OR
        mr.notes LIKE ?
      )`);
      const searchTerm = `%${params.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    let sql = this.buildMaterialRequirementQuery(conditions.join(' AND '));
    sql += ' ORDER BY mr.entry_date DESC, mr.requirement_id DESC';

    // Pagination
    if (params.limit !== undefined) {
      sql += ' LIMIT ?';
      queryParams.push(params.limit);
      if (params.offset !== undefined) {
        sql += ' OFFSET ?';
        queryParams.push(params.offset);
      }
    }

    return await query(sql, queryParams) as MaterialRequirementRow[];
  }

  /**
   * Get single material requirement by ID
   */
  async findById(id: number): Promise<MaterialRequirementRow | null> {
    const sql = this.buildMaterialRequirementQuery('mr.requirement_id = ?');
    const rows = await query(sql, [id]) as MaterialRequirementRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all requirements for a specific order
   */
  async findByOrderId(orderId: number): Promise<MaterialRequirementRow[]> {
    const sql = this.buildMaterialRequirementQuery('mr.order_id = ?') +
      ' ORDER BY mr.entry_date DESC, mr.requirement_id DESC';
    return await query(sql, [orderId]) as MaterialRequirementRow[];
  }

  /**
   * Get actionable requirements (pending or backordered)
   */
  async findActionable(): Promise<MaterialRequirementRow[]> {
    const sql = this.buildMaterialRequirementQuery(
      "mr.status IN ('pending', 'backordered')"
    ) + ' ORDER BY mr.entry_date ASC, mr.requirement_id ASC';
    return await query(sql) as MaterialRequirementRow[];
  }

  /**
   * Get count of requirements by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    const sql = `
      SELECT status, COUNT(*) as count
      FROM material_requirements
      GROUP BY status
    `;
    const rows = await query(sql) as RowDataPacket[];

    const counts: Record<string, number> = {
      pending: 0,
      ordered: 0,
      backordered: 0,
      partial_received: 0,
      received: 0,
      cancelled: 0,
    };

    rows.forEach(row => {
      counts[row.status] = Number(row.count);
    });

    return counts;
  }

  /**
   * Create new material requirement
   */
  async create(data: CreateMaterialRequirementRequest, userId?: number): Promise<number> {
    const sql = `
      INSERT INTO material_requirements (
        order_id, is_stock_item, archetype_id, custom_product_type,
        supplier_product_id, size_description, quantity_ordered,
        supplier_id, entry_date, expected_delivery_date,
        delivery_method, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const entryDate = data.entry_date
      ? new Date(data.entry_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const expectedDeliveryDate = data.expected_delivery_date
      ? new Date(data.expected_delivery_date).toISOString().split('T')[0]
      : null;

    const result = await query(sql, [
      data.order_id ?? null,
      data.is_stock_item ? 1 : 0,
      data.archetype_id ?? null,
      data.custom_product_type?.trim() ?? null,
      data.supplier_product_id ?? null,
      data.size_description?.trim() ?? null,
      data.quantity_ordered,
      data.supplier_id ?? null,
      entryDate,
      expectedDeliveryDate,
      data.delivery_method ?? 'shipping',
      data.notes?.trim() ?? null,
      userId ?? null,
    ]) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update material requirement
   */
  async update(id: number, data: UpdateMaterialRequirementRequest, userId?: number): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (data.order_id !== undefined) {
      setClauses.push('order_id = ?');
      values.push(data.order_id);
    }
    if (data.is_stock_item !== undefined) {
      setClauses.push('is_stock_item = ?');
      values.push(data.is_stock_item ? 1 : 0);
    }
    if (data.archetype_id !== undefined) {
      setClauses.push('archetype_id = ?');
      values.push(data.archetype_id);
    }
    if (data.custom_product_type !== undefined) {
      setClauses.push('custom_product_type = ?');
      values.push(data.custom_product_type?.trim() ?? null);
    }
    if (data.supplier_product_id !== undefined) {
      setClauses.push('supplier_product_id = ?');
      values.push(data.supplier_product_id);
    }
    if (data.size_description !== undefined) {
      setClauses.push('size_description = ?');
      values.push(data.size_description?.trim() ?? null);
    }
    if (data.quantity_ordered !== undefined) {
      setClauses.push('quantity_ordered = ?');
      values.push(data.quantity_ordered);
    }
    if (data.supplier_id !== undefined) {
      setClauses.push('supplier_id = ?');
      values.push(data.supplier_id);
    }
    if (data.entry_date !== undefined) {
      setClauses.push('entry_date = ?');
      values.push(new Date(data.entry_date).toISOString().split('T')[0]);
    }
    if (data.ordered_date !== undefined) {
      setClauses.push('ordered_date = ?');
      values.push(data.ordered_date ? new Date(data.ordered_date).toISOString().split('T')[0] : null);
    }
    if (data.expected_delivery_date !== undefined) {
      setClauses.push('expected_delivery_date = ?');
      values.push(data.expected_delivery_date ? new Date(data.expected_delivery_date).toISOString().split('T')[0] : null);
    }
    if (data.received_date !== undefined) {
      setClauses.push('received_date = ?');
      values.push(data.received_date ? new Date(data.received_date).toISOString().split('T')[0] : null);
    }
    if (data.delivery_method !== undefined) {
      setClauses.push('delivery_method = ?');
      values.push(data.delivery_method);
    }
    if (data.status !== undefined) {
      setClauses.push('status = ?');
      values.push(data.status);
    }
    if (data.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(data.notes?.trim() ?? null);
    }
    if (data.cart_id !== undefined) {
      setClauses.push('cart_id = ?');
      values.push(data.cart_id);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_by = ?');
    values.push(userId ?? null);

    values.push(id);

    const sql = `UPDATE material_requirements SET ${setClauses.join(', ')} WHERE requirement_id = ?`;
    await query(sql, values);
  }

  /**
   * Receive quantity for a requirement
   */
  async receiveQuantity(
    id: number,
    quantityToReceive: number,
    receivedDate: Date | string,
    userId?: number
  ): Promise<{ newQuantityReceived: number; status: MaterialRequirementStatus }> {
    // Get current requirement
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Requirement not found');
    }

    const newQuantityReceived = Number(existing.quantity_received) + quantityToReceive;
    const quantityOrdered = Number(existing.quantity_ordered);

    // Determine new status
    let newStatus: MaterialRequirementStatus;
    if (newQuantityReceived >= quantityOrdered) {
      newStatus = 'received';
    } else if (newQuantityReceived > 0) {
      newStatus = 'partial_received';
    } else {
      newStatus = existing.status;
    }

    const dateStr = typeof receivedDate === 'string'
      ? receivedDate.split('T')[0]
      : receivedDate.toISOString().split('T')[0];

    const sql = `
      UPDATE material_requirements
      SET quantity_received = ?,
          status = ?,
          received_date = ?,
          updated_by = ?
      WHERE requirement_id = ?
    `;

    await query(sql, [newQuantityReceived, newStatus, dateStr, userId ?? null, id]);

    return { newQuantityReceived, status: newStatus };
  }

  /**
   * Bulk update requirements (e.g., mark as ordered from cart)
   */
  async bulkUpdateStatus(
    ids: number[],
    status: MaterialRequirementStatus,
    orderedDate?: Date | string,
    cartId?: string,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const values: any[] = [status];

    let sql = `UPDATE material_requirements SET status = ?`;

    if (orderedDate) {
      sql += ', ordered_date = ?';
      const dateStr = typeof orderedDate === 'string'
        ? orderedDate.split('T')[0]
        : orderedDate.toISOString().split('T')[0];
      values.push(dateStr);
    }

    if (cartId) {
      sql += ', cart_id = ?';
      values.push(cartId);
    }

    sql += ', updated_by = ?';
    values.push(userId ?? null);

    sql += ` WHERE requirement_id IN (${placeholders})`;
    values.push(...ids);

    const result = await query(sql, values) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Delete material requirement
   */
  async delete(id: number): Promise<boolean> {
    const sql = 'DELETE FROM material_requirements WHERE requirement_id = ?';
    const result = await query(sql, [id]) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Check if order has any requirements
   */
  async orderHasRequirements(orderId: number): Promise<boolean> {
    const sql = 'SELECT COUNT(*) as count FROM material_requirements WHERE order_id = ?';
    const rows = await query(sql, [orderId]) as RowDataPacket[];
    return rows[0]?.count > 0;
  }

  /**
   * Get recent orders for dropdown (with or without requirements)
   */
  async getRecentOrders(limit: number = 50): Promise<RowDataPacket[]> {
    const sql = `
      SELECT
        o.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.status NOT IN ('shipped', 'cancelled', 'completed')
      ORDER BY o.created_at DESC
      LIMIT ?
    `;
    return await query(sql, [limit]) as RowDataPacket[];
  }
}
