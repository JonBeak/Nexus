// Phase 4.c: Supplier Product Repository
// Purpose: Data access layer for supplier products with pricing
// Created: 2025-12-19

import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface SupplierProductRow extends RowDataPacket {
  supplier_product_id: number;
  archetype_id: number;
  supplier_id: number;
  brand_name: string | null;
  sku: string | null;
  product_name: string | null;
  min_order_quantity: number | null;
  lead_time_days: number | null;
  unit_of_measure: string | null;
  specifications: Record<string, any> | null;
  notes: string | null;
  is_active: boolean;
  is_preferred: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  updated_by: number | null;

  // Joined fields
  archetype_name?: string;
  archetype_category?: string;
  archetype_unit_of_measure?: string;
  supplier_name?: string;
  supplier_default_lead_days?: number | null;
  created_by_name?: string;
  updated_by_name?: string;

  // Computed fields
  current_price?: number | null;
  cost_currency?: string;
  price_effective_date?: Date | null;
  effective_lead_time?: number;
  effective_unit_of_measure?: string;
}

export interface PriceRangeRow extends RowDataPacket {
  min_price: number;
  max_price: number;
  supplier_count: number;
  currency: string;
}

export interface SupplierProductSearchParams {
  archetype_id?: number;
  supplier_id?: number;
  search?: string;
  active_only?: boolean;
  has_price?: boolean;
}

export class SupplierProductRepository {
  /** Convert MySQL tinyint booleans to JS booleans */
  private mapBooleans(row: SupplierProductRow): SupplierProductRow {
    return { ...row, is_active: !!row.is_active, is_preferred: !!row.is_preferred };
  }

  /**
   * Build enriched supplier product query with joined data
   */
  private buildSupplierProductQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        sp.*,
        pa.name as archetype_name,
        mc.name as archetype_category,
        pa.unit_of_measure as archetype_unit_of_measure,
        COALESCE(sp.unit_of_measure, pa.unit_of_measure) as effective_unit_of_measure,
        s.name as supplier_name,
        s.default_lead_days as supplier_default_lead_days,
        COALESCE(sp.lead_time_days, s.default_lead_days) as effective_lead_time,
        ph.unit_price as current_price,
        ph.cost_currency,
        ph.effective_start_date as price_effective_date,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM supplier_products sp
      INNER JOIN product_archetypes pa ON sp.archetype_id = pa.archetype_id
      INNER JOIN material_categories mc ON pa.category_id = mc.id
      INNER JOIN suppliers s ON sp.supplier_id = s.supplier_id
      LEFT JOIN supplier_product_pricing_history ph
        ON sp.supplier_product_id = ph.supplier_product_id
        AND ph.effective_end_date IS NULL
      LEFT JOIN users cu ON sp.created_by = cu.user_id
      LEFT JOIN users uu ON sp.updated_by = uu.user_id
      WHERE ${whereClause}
    `;
  }

  /**
   * Get all supplier products with optional filtering
   */
  async findAll(params: SupplierProductSearchParams = {}): Promise<SupplierProductRow[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    // Filter by archetype
    if (params.archetype_id) {
      conditions.push('sp.archetype_id = ?');
      queryParams.push(params.archetype_id);
    }

    // Filter by supplier
    if (params.supplier_id) {
      conditions.push('sp.supplier_id = ?');
      queryParams.push(params.supplier_id);
    }

    // Filter by active status
    if (params.active_only !== false) {
      conditions.push('sp.is_active = TRUE');
    }

    // Search in brand name or SKU
    if (params.search) {
      conditions.push('(sp.brand_name LIKE ? OR sp.sku LIKE ? OR pa.name LIKE ?)');
      const searchTerm = `%${params.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter by has price
    if (params.has_price === true) {
      conditions.push('ph.unit_price IS NOT NULL');
    } else if (params.has_price === false) {
      conditions.push('ph.unit_price IS NULL');
    }

    const sql = this.buildSupplierProductQuery(conditions.join(' AND ')) +
      ' ORDER BY pa.name, sp.supplier_id, sp.sku';

    const rows = await query(sql, queryParams) as SupplierProductRow[];
    return rows.map(r => this.mapBooleans(r));
  }

  /**
   * Get single supplier product by ID
   */
  async findById(id: number): Promise<SupplierProductRow | null> {
    const sql = this.buildSupplierProductQuery('sp.supplier_product_id = ?');
    const rows = await query(sql, [id]) as SupplierProductRow[];
    return rows.length > 0 ? this.mapBooleans(rows[0]) : null;
  }

  /**
   * Get all supplier products for a specific archetype
   */
  async findByArchetype(archetypeId: number): Promise<SupplierProductRow[]> {
    const sql = this.buildSupplierProductQuery('sp.archetype_id = ?') +
      ' ORDER BY sp.is_preferred DESC, sp.sku';
    const rows = await query(sql, [archetypeId]) as SupplierProductRow[];
    return rows.map(r => this.mapBooleans(r));
  }

  /**
   * Get all supplier products for a specific supplier
   */
  async findBySupplier(supplierId: number): Promise<SupplierProductRow[]> {
    const sql = this.buildSupplierProductQuery('sp.supplier_id = ?') +
      ' ORDER BY pa.name, sp.sku';
    const rows = await query(sql, [supplierId]) as SupplierProductRow[];
    return rows.map(r => this.mapBooleans(r));
  }

  /**
   * Create new supplier product
   */
  async create(data: {
    archetype_id: number;
    supplier_id: number;
    brand_name?: string | null;
    sku?: string | null;
    product_name?: string | null;
    min_order_quantity?: number | null;
    lead_time_days?: number | null;
    unit_of_measure?: string | null;
    specifications?: Record<string, any> | null;
    notes?: string | null;
    is_preferred?: boolean;
    created_by?: number;
  }): Promise<number> {
    const sql = `
      INSERT INTO supplier_products
      (archetype_id, supplier_id, brand_name, sku, product_name, min_order_quantity, lead_time_days, unit_of_measure, specifications, notes, is_preferred, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      data.archetype_id,
      data.supplier_id,
      data.brand_name || null,
      data.sku || null,
      data.product_name || null,
      data.min_order_quantity || null,
      data.lead_time_days || null,
      data.unit_of_measure || null,
      data.specifications ? JSON.stringify(data.specifications) : null,
      data.notes || null,
      data.is_preferred ? 1 : 0,
      data.created_by || null
    ]) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update supplier product
   */
  async update(id: number, updates: {
    supplier_id?: number;
    brand_name?: string | null;
    sku?: string | null;
    product_name?: string | null;
    min_order_quantity?: number | null;
    lead_time_days?: number | null;
    unit_of_measure?: string | null;
    specifications?: Record<string, any> | null;
    notes?: string | null;
    is_active?: boolean;
    is_preferred?: boolean;
    updated_by?: number;
  }): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.supplier_id !== undefined) {
      setClauses.push('supplier_id = ?');
      values.push(updates.supplier_id);
    }
    if (updates.brand_name !== undefined) {
      setClauses.push('brand_name = ?');
      values.push(updates.brand_name);
    }
    if (updates.sku !== undefined) {
      setClauses.push('sku = ?');
      values.push(updates.sku);
    }
    if (updates.product_name !== undefined) {
      setClauses.push('product_name = ?');
      values.push(updates.product_name);
    }
    if (updates.min_order_quantity !== undefined) {
      setClauses.push('min_order_quantity = ?');
      values.push(updates.min_order_quantity);
    }
    if (updates.lead_time_days !== undefined) {
      setClauses.push('lead_time_days = ?');
      values.push(updates.lead_time_days);
    }
    if (updates.unit_of_measure !== undefined) {
      setClauses.push('unit_of_measure = ?');
      values.push(updates.unit_of_measure);
    }
    if (updates.specifications !== undefined) {
      setClauses.push('specifications = ?');
      values.push(updates.specifications ? JSON.stringify(updates.specifications) : null);
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.is_active !== undefined) {
      setClauses.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }
    if (updates.is_preferred !== undefined) {
      setClauses.push('is_preferred = ?');
      values.push(updates.is_preferred ? 1 : 0);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_by = ?');
    values.push(updates.updated_by || null);

    values.push(id);

    const sql = `UPDATE supplier_products SET ${setClauses.join(', ')} WHERE supplier_product_id = ?`;
    await query(sql, values);
  }

  /**
   * Soft delete supplier product
   */
  async softDelete(id: number, userId?: number): Promise<void> {
    const sql = 'UPDATE supplier_products SET is_active = FALSE, updated_by = ? WHERE supplier_product_id = ?';
    await query(sql, [userId || null, id]);
  }

  /**
   * Hard delete supplier product
   */
  async hardDelete(id: number): Promise<void> {
    const sql = 'DELETE FROM supplier_products WHERE supplier_product_id = ?';
    await query(sql, [id]);
  }

  /**
   * Get current price for supplier product (where effective_end_date IS NULL)
   */
  async getCurrentPrice(supplierProductId: number): Promise<any> {
    const sql = `
      SELECT * FROM supplier_product_pricing_history
      WHERE supplier_product_id = ? AND effective_end_date IS NULL
      LIMIT 1
    `;
    const rows = await query(sql, [supplierProductId]) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get price range (min/max) for all supplier products of an archetype
   */
  async getPriceRange(archetypeId: number): Promise<PriceRangeRow | null> {
    const sql = `
      SELECT
        MIN(ph.unit_price) as min_price,
        MAX(ph.unit_price) as max_price,
        COUNT(DISTINCT sp.supplier_id) as supplier_count,
        ph.cost_currency as currency
      FROM supplier_products sp
      INNER JOIN supplier_product_pricing_history ph
        ON sp.supplier_product_id = ph.supplier_product_id
      WHERE sp.archetype_id = ?
        AND sp.is_active = TRUE
        AND ph.effective_end_date IS NULL
      GROUP BY ph.cost_currency
    `;
    const rows = await query(sql, [archetypeId]) as PriceRangeRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all supplier products with prices for given archetype IDs
   * Prevents N+1 queries by fetching all in one go
   */
  async getProductsWithPricesForArchetypes(archetypeIds: number[]): Promise<Map<number, SupplierProductRow[]>> {
    if (archetypeIds.length === 0) return new Map();

    const placeholders = archetypeIds.map(() => '?').join(',');
    const sql = this.buildSupplierProductQuery(`sp.archetype_id IN (${placeholders})`) +
      ' ORDER BY sp.archetype_id, sp.is_preferred DESC, sp.sku';

    const rows = await query(sql, archetypeIds) as SupplierProductRow[];

    const result = new Map<number, SupplierProductRow[]>();
    archetypeIds.forEach(id => result.set(id, []));

    rows.forEach(row => {
      const mapped = this.mapBooleans(row);
      const products = result.get(mapped.archetype_id) || [];
      products.push(mapped);
      result.set(mapped.archetype_id, products);
    });

    return result;
  }

  /**
   * Check if supplier product exists with same archetype + supplier + sku
   */
  async isDuplicate(archetype_id: number, supplier_id: number, sku: string | null, excludeId?: number): Promise<boolean> {
    const conditions = ['archetype_id = ? AND supplier_id = ?'];
    const params: any[] = [archetype_id, supplier_id];

    if (sku) {
      conditions.push('sku = ?');
      params.push(sku);
    } else {
      conditions.push('sku IS NULL');
    }

    if (excludeId) {
      conditions.push('supplier_product_id != ?');
      params.push(excludeId);
    }

    const sql = `SELECT COUNT(*) as count FROM supplier_products WHERE ${conditions.join(' AND ')}`;
    const rows = await query(sql, params) as RowDataPacket[];
    return rows[0]?.count > 0;
  }

  // ==========================================
  // INVENTORY METHODS (Added 2026-02-02)
  // ==========================================

  /**
   * Get stock levels from v_supplier_product_stock view
   */
  async getStockLevels(params: {
    archetype_id?: number;
    supplier_id?: number;
    category?: string;
    stock_status?: 'out_of_stock' | 'critical' | 'low' | 'ok';
    search?: string;
  } = {}): Promise<RowDataPacket[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.archetype_id) {
      conditions.push('archetype_id = ?');
      queryParams.push(params.archetype_id);
    }
    if (params.supplier_id) {
      conditions.push('supplier_id = ?');
      queryParams.push(params.supplier_id);
    }
    if (params.category) {
      conditions.push('category = ?');
      queryParams.push(params.category);
    }
    if (params.stock_status) {
      conditions.push('stock_status = ?');
      queryParams.push(params.stock_status);
    }
    if (params.search) {
      conditions.push('(product_name LIKE ? OR sku LIKE ? OR archetype_name LIKE ?)');
      const term = `%${params.search}%`;
      queryParams.push(term, term, term);
    }

    const sql = `
      SELECT * FROM v_supplier_product_stock
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE stock_status
          WHEN 'out_of_stock' THEN 0
          WHEN 'critical' THEN 1
          WHEN 'low' THEN 2
          ELSE 3
        END,
        category, archetype_name, supplier_name
    `;

    return await query(sql, queryParams) as RowDataPacket[];
  }

  /**
   * Get aggregated archetype stock levels
   */
  async getArchetypeStockLevels(params: {
    category?: string;
    stock_status?: 'out_of_stock' | 'critical' | 'low' | 'ok';
    search?: string;
  } = {}): Promise<RowDataPacket[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.category) {
      conditions.push('category = ?');
      queryParams.push(params.category);
    }
    if (params.stock_status) {
      conditions.push('stock_status = ?');
      queryParams.push(params.stock_status);
    }
    if (params.search) {
      conditions.push('archetype_name LIKE ?');
      queryParams.push(`%${params.search}%`);
    }

    const sql = `
      SELECT * FROM v_archetype_stock_levels
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE stock_status
          WHEN 'out_of_stock' THEN 0
          WHEN 'critical' THEN 1
          WHEN 'low' THEN 2
          ELSE 3
        END,
        category, archetype_name
    `;

    return await query(sql, queryParams) as RowDataPacket[];
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(params: {
    category?: string;
    supplier_id?: number;
    alert_level?: 'out_of_stock' | 'critical' | 'low';
  } = {}): Promise<RowDataPacket[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.category) {
      conditions.push('category = ?');
      queryParams.push(params.category);
    }
    if (params.supplier_id) {
      conditions.push('supplier_id = ?');
      queryParams.push(params.supplier_id);
    }
    if (params.alert_level) {
      conditions.push('alert_level = ?');
      queryParams.push(params.alert_level);
    }

    const sql = `
      SELECT * FROM v_low_stock_alerts
      WHERE ${conditions.join(' AND ')}
    `;

    return await query(sql, queryParams) as RowDataPacket[];
  }

  /**
   * Update stock quantity for a supplier product
   */
  async updateStock(
    supplierProductId: number,
    updates: {
      quantity_on_hand?: number;
      quantity_reserved?: number;
      location?: string;
      unit_cost?: number;
      last_count_date?: string;
      reorder_point?: number;
    }
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.quantity_on_hand !== undefined) {
      setClauses.push('quantity_on_hand = ?');
      values.push(updates.quantity_on_hand);
    }
    if (updates.quantity_reserved !== undefined) {
      setClauses.push('quantity_reserved = ?');
      values.push(updates.quantity_reserved);
    }
    if (updates.location !== undefined) {
      setClauses.push('location = ?');
      values.push(updates.location);
    }
    if (updates.unit_cost !== undefined) {
      setClauses.push('unit_cost = ?');
      values.push(updates.unit_cost);
    }
    if (updates.last_count_date !== undefined) {
      setClauses.push('last_count_date = ?');
      values.push(updates.last_count_date);
    }
    if (updates.reorder_point !== undefined) {
      setClauses.push('reorder_point = ?');
      values.push(updates.reorder_point);
    }

    if (setClauses.length === 0) return;

    values.push(supplierProductId);
    const sql = `UPDATE supplier_products SET ${setClauses.join(', ')} WHERE supplier_product_id = ?`;
    await query(sql, values);
  }

  /**
   * Adjust stock quantity (add or subtract)
   * Returns the new quantity_on_hand
   */
  async adjustStock(
    supplierProductId: number,
    adjustment: number
  ): Promise<{ quantity_before: number; quantity_after: number }> {
    // Get current quantity
    const currentSql = 'SELECT quantity_on_hand FROM supplier_products WHERE supplier_product_id = ?';
    const currentRows = await query(currentSql, [supplierProductId]) as RowDataPacket[];

    if (currentRows.length === 0) {
      throw new Error(`Supplier product ${supplierProductId} not found`);
    }

    const quantity_before = Number(currentRows[0].quantity_on_hand);
    const quantity_after = quantity_before + adjustment;

    if (quantity_after < 0) {
      throw new Error(`Insufficient stock. Current: ${quantity_before}, Requested adjustment: ${adjustment}`);
    }

    // Update quantity
    const updateSql = 'UPDATE supplier_products SET quantity_on_hand = ? WHERE supplier_product_id = ?';
    await query(updateSql, [quantity_after, supplierProductId]);

    return { quantity_before, quantity_after };
  }

  /**
   * Reserve stock for an order
   */
  async reserveStock(
    supplierProductId: number,
    quantity: number
  ): Promise<void> {
    // Check available quantity
    const checkSql = `
      SELECT quantity_on_hand, quantity_reserved,
             (quantity_on_hand - quantity_reserved) as available
      FROM supplier_products WHERE supplier_product_id = ?
    `;
    const rows = await query(checkSql, [supplierProductId]) as RowDataPacket[];

    if (rows.length === 0) {
      throw new Error(`Supplier product ${supplierProductId} not found`);
    }

    const available = Number(rows[0].available);
    if (quantity > available) {
      throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
    }

    // Update reserved quantity
    const updateSql = `
      UPDATE supplier_products
      SET quantity_reserved = quantity_reserved + ?
      WHERE supplier_product_id = ?
    `;
    await query(updateSql, [quantity, supplierProductId]);
  }

  /**
   * Release reserved stock
   */
  async releaseReservation(
    supplierProductId: number,
    quantity: number
  ): Promise<void> {
    const updateSql = `
      UPDATE supplier_products
      SET quantity_reserved = GREATEST(0, quantity_reserved - ?)
      WHERE supplier_product_id = ?
    `;
    await query(updateSql, [quantity, supplierProductId]);
  }

  /**
   * Check if any active supplier product has stock for a given archetype
   */
  async hasInStockForArchetype(archetypeId: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as count FROM supplier_products
      WHERE archetype_id = ? AND is_active = 1 AND quantity_on_hand > 0
    `;
    const rows = await query(sql, [archetypeId]) as RowDataPacket[];
    return rows[0]?.count > 0;
  }

  /**
   * Get stock summary by category
   */
  async getStockSummaryByCategory(): Promise<RowDataPacket[]> {
    const sql = `
      SELECT
        category,
        COUNT(DISTINCT archetype_id) as archetype_count,
        SUM(total_on_hand) as total_on_hand,
        SUM(total_reserved) as total_reserved,
        SUM(total_available) as total_available,
        SUM(CASE WHEN stock_status = 'out_of_stock' THEN 1 ELSE 0 END) as out_of_stock_count,
        SUM(CASE WHEN stock_status = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN stock_status = 'low' THEN 1 ELSE 0 END) as low_count
      FROM v_archetype_stock_levels
      GROUP BY category
      ORDER BY category
    `;
    return await query(sql) as RowDataPacket[];
  }
}
