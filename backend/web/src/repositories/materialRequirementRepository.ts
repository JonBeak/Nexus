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
import { getLocalDateString } from '../utils/dateUtils';

export interface MaterialRequirementRow extends RowDataPacket, MaterialRequirement {}

export class MaterialRequirementRepository {
  /**
   * Build enriched material requirement query with joined data
   * Includes vinyl_products join when archetype_id = -1 (vinyl selection)
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
        mc.name as archetype_category,
        pa.unit_of_measure,
        sp.product_name as supplier_product_name,
        sp.sku as supplier_product_sku,
        CASE
          WHEN mr.supplier_id = -1 THEN 'In Stock'
          WHEN mr.supplier_id = -2 THEN 'In House'
          WHEN mr.supplier_id = -3 THEN 'Customer Provided'
          ELSE s.name
        END as supplier_name,
        vp.brand as vinyl_product_brand,
        vp.series as vinyl_product_series,
        vp.colour_number as vinyl_product_colour_number,
        vp.colour_name as vinyl_product_colour_name,
        CASE
          WHEN mr.vinyl_product_id IS NOT NULL THEN
            CONCAT(COALESCE(vp.series, ''), '-', COALESCE(vp.colour_number, ''), ' ', COALESCE(vp.colour_name, ''))
          ELSE NULL
        END as vinyl_product_display,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name,
        vi.width as held_vinyl_width,
        vi.length_yards as held_vinyl_length_yards,
        vh.quantity_held as held_vinyl_quantity,
        gih.quantity_held as held_general_quantity
      FROM material_requirements mr
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN product_archetypes pa ON mr.archetype_id = pa.archetype_id
      LEFT JOIN material_categories mc ON pa.category_id = mc.id
      LEFT JOIN supplier_products sp ON mr.supplier_product_id = sp.supplier_product_id
      LEFT JOIN suppliers s ON mr.supplier_id = s.supplier_id
      LEFT JOIN vinyl_products vp ON mr.vinyl_product_id = vp.product_id
      LEFT JOIN users cu ON mr.created_by = cu.user_id
      LEFT JOIN users uu ON mr.updated_by = uu.user_id
      LEFT JOIN vinyl_inventory vi ON mr.held_vinyl_id = vi.id
      LEFT JOIN vinyl_holds vh ON mr.requirement_id = vh.material_requirement_id
      LEFT JOIN general_inventory_holds gih ON mr.requirement_id = gih.material_requirement_id
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
        supplier_product_id, vinyl_product_id, unit, quantity_ordered,
        supplier_id, entry_date, expected_delivery_date,
        delivery_method, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const entryDate = data.entry_date
      ? new Date(data.entry_date).toISOString().split('T')[0]
      : getLocalDateString();

    const expectedDeliveryDate = data.expected_delivery_date
      ? new Date(data.expected_delivery_date).toISOString().split('T')[0]
      : null;

    const result = await query(sql, [
      data.order_id ?? null,
      data.is_stock_item ? 1 : 0,
      data.archetype_id ?? null,
      data.custom_product_type?.trim() ?? null,
      data.supplier_product_id ?? null,
      data.vinyl_product_id ?? null,
      data.unit?.trim() ?? null,
      data.quantity_ordered,
      data.supplier_id ?? null,
      entryDate,
      expectedDeliveryDate,
      data.delivery_method ?? null,
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
    if (data.vinyl_product_id !== undefined) {
      setClauses.push('vinyl_product_id = ?');
      values.push(data.vinyl_product_id);
    }
    if (data.unit !== undefined) {
      setClauses.push('unit = ?');
      values.push(data.unit?.trim() ?? null);
    }
    if (data.quantity_ordered !== undefined) {
      setClauses.push('quantity_ordered = ?');
      values.push(data.quantity_ordered);
    }
    if (data.quantity_received !== undefined) {
      setClauses.push('quantity_received = ?');
      values.push(data.quantity_received);
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
    // Sanitize limit - ensure positive integer (LIMIT ? doesn't work with mysql2 prepared statements)
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Math.abs(limit || 50))));

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
      LIMIT ${safeLimit}
    `;
    return await query(sql) as RowDataPacket[];
  }

  // ==========================================
  // HOLD FIELD METHODS (Added 2026-02-06)
  // These update hold-specific columns that the generic update() intentionally doesn't expose.
  // ==========================================

  /**
   * Set the held_vinyl_id reference on a material requirement
   */
  async setHeldVinylId(requirementId: number, vinylId: number): Promise<void> {
    await query(
      'UPDATE material_requirements SET held_vinyl_id = ? WHERE requirement_id = ?',
      [vinylId, requirementId]
    );
  }

  /**
   * Set the held_supplier_product_id reference on a material requirement
   */
  async setHeldSupplierProductId(requirementId: number, supplierProductId: number): Promise<void> {
    await query(
      'UPDATE material_requirements SET held_supplier_product_id = ? WHERE requirement_id = ?',
      [supplierProductId, requirementId]
    );
  }

  /**
   * Clear all hold-related fields and revert supplier fields to defaults
   * Used when releasing a hold entirely
   */
  async clearHoldFields(requirementId: number): Promise<void> {
    await query(
      `UPDATE material_requirements
       SET held_vinyl_id = NULL,
           held_supplier_product_id = NULL,
           supplier_id = NULL,
           ordered_date = NULL,
           delivery_method = 'shipping'
       WHERE requirement_id = ?`,
      [requirementId]
    );
  }

  /**
   * Clear only the held_vinyl_id reference (used after receiving vinyl)
   */
  async clearHeldVinylId(requirementId: number): Promise<void> {
    await query(
      'UPDATE material_requirements SET held_vinyl_id = NULL WHERE requirement_id = ?',
      [requirementId]
    );
  }

  /**
   * Find requirements eligible for draft PO view:
   * supplier_id > 0, ordered_date IS NULL, status = 'pending'
   * Optionally filter by a single supplier.
   */
  async findForDraftPO(supplierId?: number): Promise<MaterialRequirementRow[]> {
    const conditions = [
      'mr.supplier_id > 0',
      'mr.ordered_date IS NULL',
      "mr.status IN ('pending', 'ordered')",
    ];
    const params: any[] = [];

    if (supplierId !== undefined) {
      conditions.push('mr.supplier_id = ?');
      params.push(supplierId);
    }

    const sql = this.buildMaterialRequirementQuery(conditions.join(' AND '))
      + ' ORDER BY mr.supplier_id, mr.entry_date ASC, mr.requirement_id ASC';

    return await query(sql, params) as MaterialRequirementRow[];
  }

  /**
   * Stamp ordered_date and delivery_method on a set of MR IDs.
   * Used when a PO is placed (snapshot created).
   */
  async stampOrdered(
    requirementIds: number[],
    orderedDate: string,
    deliveryMethod: string,
    supplierOrderId: number,
    userId?: number
  ): Promise<void> {
    if (requirementIds.length === 0) return;

    const placeholders = requirementIds.map(() => '?').join(',');
    const sql = `
      UPDATE material_requirements
      SET ordered_date = ?,
          delivery_method = ?,
          supplier_order_id = ?,
          status = 'ordered',
          updated_by = ?
      WHERE requirement_id IN (${placeholders})
    `;
    await query(sql, [
      orderedDate,
      deliveryMethod,
      supplierOrderId,
      userId ?? null,
      ...requirementIds,
    ]);
  }
}
