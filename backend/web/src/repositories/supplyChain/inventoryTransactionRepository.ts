// Supply Chain: Inventory Transaction Repository
// Purpose: Data access layer for inventory transaction logging
// Created: 2026-02-02

import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type TransactionType = 'received' | 'used' | 'adjusted' | 'returned' | 'scrapped' | 'transferred';

export interface InventoryTransactionRow extends RowDataPacket {
  transaction_id: number;
  supplier_product_id: number;
  transaction_type: TransactionType;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reference_type: string | null;
  reference_id: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  location_from: string | null;
  location_to: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: Date;

  // Joined fields
  product_name?: string;
  sku?: string;
  archetype_name?: string;
  category?: string;
  supplier_name?: string;
  created_by_name?: string;
}

export interface CreateTransactionData {
  supplier_product_id: number;
  transaction_type: TransactionType;
  quantity: number;
  quantity_before?: number;
  quantity_after?: number;
  reference_type?: string;
  reference_id?: number;
  unit_cost?: number;
  location_from?: string;
  location_to?: string;
  notes?: string;
  created_by?: number;
}

export interface TransactionSearchParams {
  supplier_product_id?: number;
  archetype_id?: number;
  supplier_id?: number;
  transaction_type?: TransactionType;
  reference_type?: string;
  reference_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export class InventoryTransactionRepository {
  /**
   * Build enriched transaction query with joined data
   */
  private buildTransactionQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        it.*,
        sp.product_name,
        sp.sku,
        pa.name as archetype_name,
        pa.category,
        s.name as supplier_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM inventory_transactions it
      INNER JOIN supplier_products sp ON it.supplier_product_id = sp.supplier_product_id
      INNER JOIN product_archetypes pa ON sp.archetype_id = pa.archetype_id
      INNER JOIN suppliers s ON sp.supplier_id = s.supplier_id
      LEFT JOIN users u ON it.created_by = u.user_id
      WHERE ${whereClause}
    `;
  }

  /**
   * Create a new inventory transaction
   */
  async create(data: CreateTransactionData): Promise<number> {
    const sql = `
      INSERT INTO inventory_transactions
      (supplier_product_id, transaction_type, quantity, quantity_before, quantity_after,
       reference_type, reference_id, unit_cost, location_from, location_to, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      data.supplier_product_id,
      data.transaction_type,
      data.quantity,
      data.quantity_before ?? null,
      data.quantity_after ?? null,
      data.reference_type ?? null,
      data.reference_id ?? null,
      data.unit_cost ?? null,
      data.location_from ?? null,
      data.location_to ?? null,
      data.notes ?? null,
      data.created_by ?? null
    ]) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Get transaction by ID
   */
  async findById(id: number): Promise<InventoryTransactionRow | null> {
    const sql = this.buildTransactionQuery('it.transaction_id = ?');
    const rows = await query(sql, [id]) as InventoryTransactionRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find transactions with filtering
   */
  async findAll(params: TransactionSearchParams = {}): Promise<InventoryTransactionRow[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.supplier_product_id) {
      conditions.push('it.supplier_product_id = ?');
      queryParams.push(params.supplier_product_id);
    }
    if (params.archetype_id) {
      conditions.push('sp.archetype_id = ?');
      queryParams.push(params.archetype_id);
    }
    if (params.supplier_id) {
      conditions.push('sp.supplier_id = ?');
      queryParams.push(params.supplier_id);
    }
    if (params.transaction_type) {
      conditions.push('it.transaction_type = ?');
      queryParams.push(params.transaction_type);
    }
    if (params.reference_type) {
      conditions.push('it.reference_type = ?');
      queryParams.push(params.reference_type);
    }
    if (params.reference_id) {
      conditions.push('it.reference_id = ?');
      queryParams.push(params.reference_id);
    }
    if (params.start_date) {
      conditions.push('it.created_at >= ?');
      queryParams.push(params.start_date);
    }
    if (params.end_date) {
      conditions.push('it.created_at <= ?');
      queryParams.push(params.end_date);
    }

    let sql = this.buildTransactionQuery(conditions.join(' AND ')) +
      ' ORDER BY it.created_at DESC';

    if (params.limit) {
      sql += ` LIMIT ${params.limit}`;
      if (params.offset) {
        sql += ` OFFSET ${params.offset}`;
      }
    }

    return await query(sql, queryParams) as InventoryTransactionRow[];
  }

  /**
   * Get transactions for a specific supplier product
   */
  async findBySupplierProduct(
    supplierProductId: number,
    limit: number = 50
  ): Promise<InventoryTransactionRow[]> {
    const sql = this.buildTransactionQuery('it.supplier_product_id = ?') +
      ' ORDER BY it.created_at DESC LIMIT ?';
    return await query(sql, [supplierProductId, limit]) as InventoryTransactionRow[];
  }

  /**
   * Get transactions by reference (e.g., all transactions for a supplier order)
   */
  async findByReference(
    referenceType: string,
    referenceId: number
  ): Promise<InventoryTransactionRow[]> {
    const sql = this.buildTransactionQuery('it.reference_type = ? AND it.reference_id = ?') +
      ' ORDER BY it.created_at DESC';
    return await query(sql, [referenceType, referenceId]) as InventoryTransactionRow[];
  }

  /**
   * Get transaction summary for a date range
   */
  async getSummary(params: {
    start_date?: string;
    end_date?: string;
    supplier_id?: number;
    archetype_id?: number;
  } = {}): Promise<RowDataPacket[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.start_date) {
      conditions.push('it.created_at >= ?');
      queryParams.push(params.start_date);
    }
    if (params.end_date) {
      conditions.push('it.created_at <= ?');
      queryParams.push(params.end_date);
    }
    if (params.supplier_id) {
      conditions.push('sp.supplier_id = ?');
      queryParams.push(params.supplier_id);
    }
    if (params.archetype_id) {
      conditions.push('sp.archetype_id = ?');
      queryParams.push(params.archetype_id);
    }

    const sql = `
      SELECT
        it.transaction_type,
        COUNT(*) as transaction_count,
        SUM(it.quantity) as total_quantity,
        SUM(it.total_cost) as total_cost
      FROM inventory_transactions it
      INNER JOIN supplier_products sp ON it.supplier_product_id = sp.supplier_product_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY it.transaction_type
      ORDER BY it.transaction_type
    `;

    return await query(sql, queryParams) as RowDataPacket[];
  }

  /**
   * Get recent activity (last N transactions across all products)
   */
  async getRecentActivity(limit: number = 20): Promise<InventoryTransactionRow[]> {
    const sql = this.buildTransactionQuery('1=1') +
      ' ORDER BY it.created_at DESC LIMIT ?';
    return await query(sql, [limit]) as InventoryTransactionRow[];
  }

  /**
   * Get count of transactions
   */
  async getCount(params: TransactionSearchParams = {}): Promise<number> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.supplier_product_id) {
      conditions.push('it.supplier_product_id = ?');
      queryParams.push(params.supplier_product_id);
    }
    if (params.transaction_type) {
      conditions.push('it.transaction_type = ?');
      queryParams.push(params.transaction_type);
    }
    if (params.start_date) {
      conditions.push('it.created_at >= ?');
      queryParams.push(params.start_date);
    }
    if (params.end_date) {
      conditions.push('it.created_at <= ?');
      queryParams.push(params.end_date);
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM inventory_transactions it
      INNER JOIN supplier_products sp ON it.supplier_product_id = sp.supplier_product_id
      WHERE ${conditions.join(' AND ')}
    `;

    const rows = await query(sql, queryParams) as RowDataPacket[];
    return rows[0]?.count || 0;
  }
}
