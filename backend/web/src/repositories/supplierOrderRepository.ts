/**
 * Supplier Order Repository
 * Data access layer for supplier orders and order items
 * Created: 2026-02-02
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderWithItems,
  SupplierOrderStatus,
  SupplierOrderSearchParams,
  CreateSupplierOrderRequest,
  CreateSupplierOrderItemRequest,
  UpdateSupplierOrderRequest,
  UpdateSupplierOrderItemRequest,
  SupplierOrderStatusHistory,
} from '../types/supplierOrders';

export interface SupplierOrderRow extends RowDataPacket, SupplierOrder {}
export interface SupplierOrderItemRow extends RowDataPacket, SupplierOrderItem {}
export interface SupplierOrderStatusHistoryRow extends RowDataPacket, SupplierOrderStatusHistory {}

export class SupplierOrderRepository {
  /**
   * Build enriched supplier order query with joined data
   */
  private buildOrderQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        so.*,
        s.name as supplier_name,
        (SELECT email FROM supplier_contacts sc WHERE sc.supplier_id = s.supplier_id AND sc.is_primary = 1 LIMIT 1) as supplier_contact_email,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name,
        CONCAT(su.first_name, ' ', su.last_name) as submitted_by_name,
        (SELECT COUNT(*) FROM supplier_order_items WHERE order_id = so.order_id) as item_count,
        (SELECT COUNT(*) FROM supplier_order_items WHERE order_id = so.order_id AND quantity_received >= quantity_ordered) as items_received_count
      FROM supplier_orders so
      JOIN suppliers s ON so.supplier_id = s.supplier_id
      LEFT JOIN users cu ON so.created_by = cu.user_id
      LEFT JOIN users uu ON so.updated_by = uu.user_id
      LEFT JOIN users su ON so.submitted_by = su.user_id
      WHERE ${whereClause}
    `;
  }

  /**
   * Build order item query with joined data
   */
  private buildItemQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        soi.*,
        CONCAT(ru.first_name, ' ', ru.last_name) as received_by_name,
        o.order_number as material_requirement_order_number
      FROM supplier_order_items soi
      LEFT JOIN users ru ON soi.received_by = ru.user_id
      LEFT JOIN material_requirements mr ON soi.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      WHERE ${whereClause}
    `;
  }

  // ============================================================================
  // ORDER OPERATIONS
  // ============================================================================

  /**
   * Get all supplier orders with optional filtering
   */
  async findAll(params: SupplierOrderSearchParams = {}): Promise<SupplierOrderRow[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.supplier_id !== undefined) {
      conditions.push('so.supplier_id = ?');
      queryParams.push(params.supplier_id);
    }

    if (params.status !== undefined) {
      if (Array.isArray(params.status)) {
        const placeholders = params.status.map(() => '?').join(',');
        conditions.push(`so.status IN (${placeholders})`);
        queryParams.push(...params.status);
      } else {
        conditions.push('so.status = ?');
        queryParams.push(params.status);
      }
    }

    if (params.order_date_from) {
      conditions.push('so.order_date >= ?');
      queryParams.push(params.order_date_from);
    }
    if (params.order_date_to) {
      conditions.push('so.order_date <= ?');
      queryParams.push(params.order_date_to);
    }

    if (params.expected_delivery_from) {
      conditions.push('so.expected_delivery_date >= ?');
      queryParams.push(params.expected_delivery_from);
    }
    if (params.expected_delivery_to) {
      conditions.push('so.expected_delivery_date <= ?');
      queryParams.push(params.expected_delivery_to);
    }

    if (params.search) {
      conditions.push(`(
        so.order_number LIKE ? OR
        s.name LIKE ? OR
        so.supplier_reference LIKE ? OR
        so.notes LIKE ?
      )`);
      const searchTerm = `%${params.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    let sql = this.buildOrderQuery(conditions.join(' AND '));
    sql += ' ORDER BY so.created_at DESC';

    if (params.limit !== undefined) {
      sql += ' LIMIT ?';
      queryParams.push(params.limit);
      if (params.offset !== undefined) {
        sql += ' OFFSET ?';
        queryParams.push(params.offset);
      }
    }

    return await query(sql, queryParams) as SupplierOrderRow[];
  }

  /**
   * Get single supplier order by ID
   */
  async findById(id: number): Promise<SupplierOrderRow | null> {
    const sql = this.buildOrderQuery('so.order_id = ?');
    const rows = await query(sql, [id]) as SupplierOrderRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get order with all items
   */
  async findByIdWithItems(id: number): Promise<SupplierOrderWithItems | null> {
    const order = await this.findById(id);
    if (!order) return null;

    const items = await this.getOrderItems(id);
    return { ...order, items };
  }

  /**
   * Generate next order number (legacy format, kept for backwards compat)
   */
  async getNextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    const sql = `
      SELECT order_number FROM supplier_orders
      WHERE order_number LIKE ?
      ORDER BY order_number DESC
      LIMIT 1
    `;

    const rows = await query(sql, [`${prefix}%`]) as RowDataPacket[];

    let nextNum = 1;
    if (rows.length > 0) {
      const lastNum = rows[0].order_number.replace(prefix, '');
      nextNum = parseInt(lastNum, 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Generate PO number in new format: YYYYMMDD-VVV-NN
   * VVV = supplier_id zero-padded to 3 digits
   * NN = daily increment per vendor (01-99)
   */
  async generatePONumber(supplierId: number, date: string): Promise<string> {
    const dateStr = date.replace(/-/g, ''); // YYYYMMDD
    const vendorStr = String(supplierId).padStart(3, '0');
    const prefix = `${dateStr}-${vendorStr}-`;

    const sql = `
      SELECT order_number FROM supplier_orders
      WHERE order_number LIKE ?
      ORDER BY order_number DESC
      LIMIT 1
    `;

    const rows = await query(sql, [`${prefix}%`]) as RowDataPacket[];

    let nextNum = 1;
    if (rows.length > 0) {
      const lastPart = rows[0].order_number.split('-').pop();
      nextNum = parseInt(lastPart, 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(2, '0')}`;
  }

  /**
   * Create a snapshot PO from material requirements (for Place Order flow).
   * Returns the new order ID.
   */
  async createSnapshot(
    orderNumber: string,
    supplierId: number,
    orderDate: string,
    deliveryMethod: string,
    notes: string | null,
    items: Array<{
      product_description: string;
      sku: string | null;
      quantity_ordered: number;
      unit_of_measure: string;
      unit_price: number;
      material_requirement_id: number;
      supplier_product_id: number | null;
      notes: string | null;
    }>,
    userId?: number
  ): Promise<number> {
    // Create the order header as 'submitted'
    const headerSql = `
      INSERT INTO supplier_orders (
        order_number, supplier_id, status, order_date,
        delivery_method, notes, created_by, submitted_by, submitted_at
      ) VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, NOW())
    `;

    const headerResult = await query(headerSql, [
      orderNumber,
      supplierId,
      orderDate,
      deliveryMethod,
      notes,
      userId ?? null,
      userId ?? null,
    ]) as ResultSetHeader;

    const orderId = headerResult.insertId;

    // Insert line items
    for (const item of items) {
      await this.addItem(orderId, {
        product_description: item.product_description,
        sku: item.sku,
        quantity_ordered: item.quantity_ordered,
        unit_of_measure: item.unit_of_measure,
        unit_price: item.unit_price,
        material_requirement_id: item.material_requirement_id,
        supplier_product_id: item.supplier_product_id,
        notes: item.notes,
      });
    }

    // Record status history
    await this.recordStatusChange(orderId, null, 'submitted', userId, 'Order placed from draft PO');

    return orderId;
  }

  /**
   * Create new supplier order
   */
  async create(data: CreateSupplierOrderRequest, userId?: number): Promise<number> {
    const orderNumber = await this.getNextOrderNumber();

    const sql = `
      INSERT INTO supplier_orders (
        order_number, supplier_id, expected_delivery_date,
        delivery_method, shipping_address, notes, internal_notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const expectedDate = data.expected_delivery_date
      ? new Date(data.expected_delivery_date).toISOString().split('T')[0]
      : null;

    const result = await query(sql, [
      orderNumber,
      data.supplier_id,
      expectedDate,
      data.delivery_method ?? 'shipping',
      data.shipping_address ?? null,
      data.notes ?? null,
      data.internal_notes ?? null,
      userId ?? null,
    ]) as ResultSetHeader;

    const orderId = result.insertId;

    // Record initial status in history
    await this.recordStatusChange(orderId, null, 'submitted', userId);

    return orderId;
  }

  /**
   * Update supplier order
   */
  async update(id: number, data: UpdateSupplierOrderRequest, userId?: number): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (data.supplier_id !== undefined) {
      setClauses.push('supplier_id = ?');
      values.push(data.supplier_id);
    }
    if (data.expected_delivery_date !== undefined) {
      setClauses.push('expected_delivery_date = ?');
      values.push(data.expected_delivery_date ? new Date(data.expected_delivery_date).toISOString().split('T')[0] : null);
    }
    if (data.actual_delivery_date !== undefined) {
      setClauses.push('actual_delivery_date = ?');
      values.push(data.actual_delivery_date ? new Date(data.actual_delivery_date).toISOString().split('T')[0] : null);
    }
    if (data.delivery_method !== undefined) {
      setClauses.push('delivery_method = ?');
      values.push(data.delivery_method);
    }
    if (data.shipping_address !== undefined) {
      setClauses.push('shipping_address = ?');
      values.push(data.shipping_address);
    }
    if (data.supplier_reference !== undefined) {
      setClauses.push('supplier_reference = ?');
      values.push(data.supplier_reference);
    }
    if (data.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(data.notes);
    }
    if (data.internal_notes !== undefined) {
      setClauses.push('internal_notes = ?');
      values.push(data.internal_notes);
    }
    if (data.tax_amount !== undefined) {
      setClauses.push('tax_amount = ?');
      values.push(data.tax_amount);
    }
    if (data.shipping_cost !== undefined) {
      setClauses.push('shipping_cost = ?');
      values.push(data.shipping_cost);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_by = ?');
    values.push(userId ?? null);
    values.push(id);

    const sql = `UPDATE supplier_orders SET ${setClauses.join(', ')} WHERE order_id = ?`;
    await query(sql, values);

    // Recalculate totals
    await this.recalculateTotals(id);
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: number,
    newStatus: SupplierOrderStatus,
    userId?: number,
    notes?: string
  ): Promise<void> {
    // Get current status
    const order = await this.findById(id);
    if (!order) throw new Error('Order not found');

    const oldStatus = order.status;

    const sql = `UPDATE supplier_orders SET status = ?, updated_by = ? WHERE order_id = ?`;
    await query(sql, [newStatus, userId ?? null, id]);

    // Record status change
    await this.recordStatusChange(id, oldStatus, newStatus, userId, notes);
  }

  /**
   * Submit order (set to submitted status)
   */
  async submit(id: number, orderDate: Date | string, userId?: number, notes?: string): Promise<void> {
    const dateStr = typeof orderDate === 'string'
      ? orderDate.split('T')[0]
      : orderDate.toISOString().split('T')[0];

    const sql = `
      UPDATE supplier_orders
      SET status = 'submitted',
          order_date = ?,
          submitted_by = ?,
          submitted_at = NOW(),
          updated_by = ?
      WHERE order_id = ?
    `;
    await query(sql, [dateStr, userId ?? null, userId ?? null, id]);

    // Get current order for old status
    const order = await this.findById(id);
    if (order) {
      await this.recordStatusChange(id, null, 'submitted', userId, notes);
    }
  }

  /**
   * Delete supplier order (only non-submitted orders)
   */
  async delete(id: number): Promise<boolean> {
    const order = await this.findById(id);
    if (!order) return false;
    if (order.status === 'delivered') {
      throw new Error('Cannot delete delivered orders');
    }

    // Items are cascade deleted
    const sql = 'DELETE FROM supplier_orders WHERE order_id = ?';
    const result = await query(sql, [id]) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Recalculate order totals from line items
   */
  async recalculateTotals(orderId: number): Promise<void> {
    const sql = `
      UPDATE supplier_orders so
      SET subtotal = (
        SELECT COALESCE(SUM(line_total), 0)
        FROM supplier_order_items
        WHERE order_id = so.order_id
      ),
      total_amount = (
        SELECT COALESCE(SUM(line_total), 0)
        FROM supplier_order_items
        WHERE order_id = so.order_id
      ) + COALESCE(so.tax_amount, 0) + COALESCE(so.shipping_cost, 0)
      WHERE order_id = ?
    `;
    await query(sql, [orderId]);
  }

  // ============================================================================
  // ORDER ITEM OPERATIONS
  // ============================================================================

  /**
   * Get all items for an order
   */
  async getOrderItems(orderId: number): Promise<SupplierOrderItemRow[]> {
    const sql = this.buildItemQuery('soi.order_id = ?') + ' ORDER BY soi.item_id';
    return await query(sql, [orderId]) as SupplierOrderItemRow[];
  }

  /**
   * Get single order item
   */
  async getItem(itemId: number): Promise<SupplierOrderItemRow | null> {
    const sql = this.buildItemQuery('soi.item_id = ?');
    const rows = await query(sql, [itemId]) as SupplierOrderItemRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Add item to order
   */
  async addItem(orderId: number, data: CreateSupplierOrderItemRequest): Promise<number> {
    const sql = `
      INSERT INTO supplier_order_items (
        order_id, supplier_product_id, product_description, sku,
        quantity_ordered, unit_of_measure, unit_price,
        material_requirement_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      orderId,
      data.supplier_product_id ?? null,
      data.product_description,
      data.sku ?? null,
      data.quantity_ordered,
      data.unit_of_measure ?? 'each',
      data.unit_price ?? 0,
      data.material_requirement_id ?? null,
      data.notes ?? null,
    ]) as ResultSetHeader;

    // Recalculate order totals
    await this.recalculateTotals(orderId);

    return result.insertId;
  }

  /**
   * Update order item
   */
  async updateItem(itemId: number, data: UpdateSupplierOrderItemRequest): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (data.supplier_product_id !== undefined) {
      setClauses.push('supplier_product_id = ?');
      values.push(data.supplier_product_id);
    }
    if (data.product_description !== undefined) {
      setClauses.push('product_description = ?');
      values.push(data.product_description);
    }
    if (data.sku !== undefined) {
      setClauses.push('sku = ?');
      values.push(data.sku);
    }
    if (data.quantity_ordered !== undefined) {
      setClauses.push('quantity_ordered = ?');
      values.push(data.quantity_ordered);
    }
    if (data.unit_of_measure !== undefined) {
      setClauses.push('unit_of_measure = ?');
      values.push(data.unit_of_measure);
    }
    if (data.unit_price !== undefined) {
      setClauses.push('unit_price = ?');
      values.push(data.unit_price);
    }
    if (data.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(data.notes);
    }

    if (setClauses.length === 0) return;

    values.push(itemId);

    const sql = `UPDATE supplier_order_items SET ${setClauses.join(', ')} WHERE item_id = ?`;
    await query(sql, values);

    // Get order ID and recalculate totals
    const item = await this.getItem(itemId);
    if (item) {
      await this.recalculateTotals(item.order_id);
    }
  }

  /**
   * Remove item from order
   */
  async removeItem(itemId: number): Promise<boolean> {
    // Get order ID before deletion
    const item = await this.getItem(itemId);
    if (!item) return false;

    const sql = 'DELETE FROM supplier_order_items WHERE item_id = ?';
    const result = await query(sql, [itemId]) as ResultSetHeader;

    // Recalculate order totals
    await this.recalculateTotals(item.order_id);

    return result.affectedRows > 0;
  }

  /**
   * Receive quantity for an item
   */
  async receiveItem(
    itemId: number,
    quantityReceived: number,
    receivedDate: Date | string,
    receivedBy?: number
  ): Promise<{ newQuantityReceived: number; fullyReceived: boolean }> {
    const item = await this.getItem(itemId);
    if (!item) throw new Error('Item not found');

    const newQuantityReceived = Number(item.quantity_received) + quantityReceived;
    const fullyReceived = newQuantityReceived >= Number(item.quantity_ordered);

    const dateStr = typeof receivedDate === 'string'
      ? receivedDate.split('T')[0]
      : receivedDate.toISOString().split('T')[0];

    const sql = `
      UPDATE supplier_order_items
      SET quantity_received = ?,
          received_date = ?,
          received_by = ?
      WHERE item_id = ?
    `;
    await query(sql, [newQuantityReceived, dateStr, receivedBy ?? null, itemId]);

    return { newQuantityReceived, fullyReceived };
  }

  // ============================================================================
  // STATUS HISTORY
  // ============================================================================

  /**
   * Record status change in history
   */
  async recordStatusChange(
    orderId: number,
    oldStatus: SupplierOrderStatus | null,
    newStatus: SupplierOrderStatus,
    userId?: number,
    notes?: string
  ): Promise<void> {
    const sql = `
      INSERT INTO supplier_order_status_history (order_id, old_status, new_status, changed_by, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    await query(sql, [orderId, oldStatus, newStatus, userId ?? null, notes ?? null]);
  }

  /**
   * Get status history for an order
   */
  async getStatusHistory(orderId: number): Promise<SupplierOrderStatusHistoryRow[]> {
    const sql = `
      SELECT
        sosh.*,
        CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
      FROM supplier_order_status_history sosh
      LEFT JOIN users u ON sosh.changed_by = u.user_id
      WHERE sosh.order_id = ?
      ORDER BY sosh.changed_at ASC
    `;
    return await query(sql, [orderId]) as SupplierOrderStatusHistoryRow[];
  }

  // ============================================================================
  // REQUIREMENT LINKING
  // ============================================================================

  /**
   * Link material requirements to an order
   */
  async linkRequirements(orderId: number, requirementIds: number[], userId?: number): Promise<void> {
    if (requirementIds.length === 0) return;

    const placeholders = requirementIds.map(() => '?').join(',');
    const sql = `
      UPDATE material_requirements
      SET supplier_order_id = ?,
          status = 'ordered',
          ordered_date = CURDATE(),
          updated_by = ?
      WHERE requirement_id IN (${placeholders})
    `;
    await query(sql, [orderId, userId ?? null, ...requirementIds]);
  }

  /**
   * Unlink material requirements from an order
   */
  async unlinkRequirements(orderId: number): Promise<void> {
    const sql = `
      UPDATE material_requirements
      SET supplier_order_id = NULL,
          status = 'pending',
          ordered_date = NULL
      WHERE supplier_order_id = ?
    `;
    await query(sql, [orderId]);
  }

  /**
   * Find a supplier order item by its linked material_requirement_id
   */
  async findItemByRequirementId(requirementId: number): Promise<SupplierOrderItemRow | null> {
    const sql = this.buildItemQuery('soi.material_requirement_id = ?');
    const rows = await query(sql, [requirementId]) as SupplierOrderItemRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get the number of items on an order
   */
  async getItemCount(orderId: number): Promise<number> {
    const sql = 'SELECT COUNT(*) as cnt FROM supplier_order_items WHERE order_id = ?';
    const rows = await query(sql, [orderId]) as RowDataPacket[];
    return Number(rows[0].cnt);
  }

  /**
   * Get all orders by supplier
   */
  async findBySupplier(supplierId: number): Promise<SupplierOrderRow[]> {
    const sql = this.buildOrderQuery('so.supplier_id = ?') + ' ORDER BY so.created_at DESC';
    return await query(sql, [supplierId]) as SupplierOrderRow[];
  }

  /**
   * Update email_sent_at timestamp for an order
   */
  async updateEmailSentAt(orderId: number): Promise<void> {
    const sql = `UPDATE supplier_orders SET email_sent_at = NOW() WHERE order_id = ?`;
    await query(sql, [orderId]);
  }

  /**
   * Get count by status
   */
  async getCountByStatus(): Promise<Record<SupplierOrderStatus, number>> {
    const sql = `
      SELECT status, COUNT(*) as count
      FROM supplier_orders
      GROUP BY status
    `;
    const rows = await query(sql) as RowDataPacket[];

    const counts: Record<SupplierOrderStatus, number> = {
      submitted: 0,
      acknowledged: 0,
      partial_received: 0,
      delivered: 0,
      cancelled: 0,
    };

    rows.forEach(row => {
      counts[row.status as SupplierOrderStatus] = Number(row.count);
    });

    return counts;
  }
}
