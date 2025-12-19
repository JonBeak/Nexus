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
  archetype_specification_template?: string[] | null;
  supplier_name?: string;
  supplier_default_lead_days?: number | null;
  created_by_name?: string;
  updated_by_name?: string;

  // Computed fields
  current_price?: number | null;
  cost_currency?: string;
  price_effective_date?: Date | null;
  effective_lead_time?: number;
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
  /**
   * Build enriched supplier product query with joined data
   */
  private buildSupplierProductQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        sp.*,
        pa.name as archetype_name,
        pa.category as archetype_category,
        pa.unit_of_measure as archetype_unit_of_measure,
        pa.specifications_v2 as archetype_specification_template,
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

    return await query(sql, queryParams) as SupplierProductRow[];
  }

  /**
   * Get single supplier product by ID
   */
  async findById(id: number): Promise<SupplierProductRow | null> {
    const sql = this.buildSupplierProductQuery('sp.supplier_product_id = ?');
    const rows = await query(sql, [id]) as SupplierProductRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all supplier products for a specific archetype
   */
  async findByArchetype(archetypeId: number): Promise<SupplierProductRow[]> {
    const sql = this.buildSupplierProductQuery('sp.archetype_id = ?') +
      ' ORDER BY sp.is_preferred DESC, sp.sku';
    return await query(sql, [archetypeId]) as SupplierProductRow[];
  }

  /**
   * Get all supplier products for a specific supplier
   */
  async findBySupplier(supplierId: number): Promise<SupplierProductRow[]> {
    const sql = this.buildSupplierProductQuery('sp.supplier_id = ?') +
      ' ORDER BY pa.name, sp.sku';
    return await query(sql, [supplierId]) as SupplierProductRow[];
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
    specifications?: Record<string, any> | null;
    notes?: string | null;
    is_preferred?: boolean;
    created_by?: number;
  }): Promise<number> {
    const sql = `
      INSERT INTO supplier_products
      (archetype_id, supplier_id, brand_name, sku, product_name, min_order_quantity, lead_time_days, specifications, notes, is_preferred, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      data.archetype_id,
      data.supplier_id,
      data.brand_name || null,
      data.sku || null,
      data.product_name || null,
      data.min_order_quantity || null,
      data.lead_time_days || null,
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
    brand_name?: string | null;
    sku?: string | null;
    product_name?: string | null;
    min_order_quantity?: number | null;
    lead_time_days?: number | null;
    specifications?: Record<string, any> | null;
    notes?: string | null;
    is_active?: boolean;
    is_preferred?: boolean;
    updated_by?: number;
  }): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

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
      const products = result.get(row.archetype_id) || [];
      products.push(row);
      result.set(row.archetype_id, products);
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
}
