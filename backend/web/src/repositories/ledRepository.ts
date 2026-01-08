// File Clean up Finished: Nov 14, 2025
// File Clean up Finished: Nov 14, 2025 (standardized fields - removed unused 'model' from findAllActive query)
/**
 * LED Repository
 *
 * Database access layer for LED products
 * Created: Nov 14, 2025 during ledsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface LED extends RowDataPacket {
  led_id: number;
  product_code: string;
  price?: number;
  watts?: number;
  colour?: string;
  lumens?: string;
  volts?: number;
  brand?: string;
  model?: string;
  supplier?: string;
  low_stock?: number;
  full_stock?: number;
  warranty?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class LEDRepository {
  /**
   * Get all active LEDs for dropdown selections
   * Ordered by default status, then brand and product code
   * Returns standardized field set used across all features
   */
  async findAllActive(): Promise<LED[]> {
    const rows = await query(
      `SELECT
        led_id,
        product_code,
        colour,
        watts,
        volts,
        brand,
        is_default
      FROM leds
      WHERE is_active = 1
      ORDER BY is_default DESC, brand ASC, product_code ASC`
    ) as LED[];

    return rows;
  }

  /**
   * Find LED by product code
   * Used for validation and lookups
   */
  async findByProductCode(productCode: string): Promise<LED | null> {
    const rows = await query(
      `SELECT * FROM leds WHERE product_code = ? AND is_active = 1`,
      [productCode]
    ) as LED[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find LEDs matching a fuzzy search pattern
   * Used by auto-fill service for LED type matching
   *
   * @param searchPattern - Pattern to match against full LED name format
   * @returns Array of matching LEDs with formatted names
   */
  async findByFuzzyMatch(searchPattern: string): Promise<Array<{ full_name: string }>> {
    const rows = await query(
      `SELECT CONCAT(product_code, ' - ', colour, ' (', watts, 'W, ', volts, 'V)') AS full_name
       FROM leds
       WHERE is_active = 1
       AND CONCAT(product_code, ' - ', colour, ' (', watts, 'W, ', volts, 'V)') LIKE ?
       LIMIT 1`,
      [searchPattern]
    ) as Array<{ full_name: string }>;

    return rows;
  }

  /**
   * Get default LED
   * Returns the LED marked as default for auto-fill purposes
   */
  async findDefault(): Promise<LED | null> {
    const rows = await query(
      `SELECT * FROM leds WHERE is_default = 1 AND is_active = 1 LIMIT 1`
    ) as LED[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get total count of active LEDs
   * Useful for dashboard statistics
   */
  async countActive(): Promise<number> {
    const rows = await query(
      `SELECT COUNT(*) as count FROM leds WHERE is_active = 1`
    ) as Array<{ count: number }>;

    return rows[0]?.count || 0;
  }

  /**
   * Get all LEDs including inactive ones
   * Used for admin management UI
   */
  async findAll(includeInactive = false): Promise<LED[]> {
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
    const rows = await query(
      `SELECT
        led_id,
        product_code,
        colour,
        watts,
        volts,
        brand,
        model,
        supplier,
        price,
        lumens,
        low_stock,
        full_stock,
        warranty,
        is_default,
        is_active,
        created_at,
        updated_at
      FROM leds
      ${whereClause}
      ORDER BY is_default DESC, brand ASC, product_code ASC`
    ) as LED[];

    return rows;
  }

  /**
   * Find LED by ID
   */
  async findById(ledId: number): Promise<LED | null> {
    const rows = await query(
      `SELECT * FROM leds WHERE led_id = ?`,
      [ledId]
    ) as LED[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create a new LED type
   */
  async create(led: {
    product_code: string;
    colour?: string;
    watts?: number;
    volts?: number;
    brand?: string;
    model?: string;
    supplier?: string;
    price?: number;
    lumens?: string;
    is_default?: boolean;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO leds (product_code, colour, watts, volts, brand, model, supplier, price, lumens, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        led.product_code,
        led.colour || null,
        led.watts || null,
        led.volts || null,
        led.brand || null,
        led.model || null,
        led.supplier || null,
        led.price || null,
        led.lumens || null,
        led.is_default ? 1 : 0
      ]
    ) as { insertId: number };

    return result.insertId;
  }

  /**
   * Update an LED type
   */
  async update(ledId: number, updates: {
    product_code?: string;
    colour?: string;
    watts?: number;
    volts?: number;
    brand?: string;
    model?: string;
    supplier?: string;
    price?: number;
    lumens?: string;
    is_default?: boolean;
    is_active?: boolean;
  }): Promise<boolean> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.product_code !== undefined) {
      fields.push('product_code = ?');
      values.push(updates.product_code);
    }
    if (updates.colour !== undefined) {
      fields.push('colour = ?');
      values.push(updates.colour || null);
    }
    if (updates.watts !== undefined) {
      fields.push('watts = ?');
      values.push(updates.watts || null);
    }
    if (updates.volts !== undefined) {
      fields.push('volts = ?');
      values.push(updates.volts || null);
    }
    if (updates.brand !== undefined) {
      fields.push('brand = ?');
      values.push(updates.brand || null);
    }
    if (updates.model !== undefined) {
      fields.push('model = ?');
      values.push(updates.model || null);
    }
    if (updates.supplier !== undefined) {
      fields.push('supplier = ?');
      values.push(updates.supplier || null);
    }
    if (updates.price !== undefined) {
      fields.push('price = ?');
      values.push(updates.price || null);
    }
    if (updates.lumens !== undefined) {
      fields.push('lumens = ?');
      values.push(updates.lumens || null);
    }
    if (updates.is_default !== undefined) {
      fields.push('is_default = ?');
      values.push(updates.is_default ? 1 : 0);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (fields.length === 0) return false;

    values.push(ledId);
    const result = await query(
      `UPDATE leds SET ${fields.join(', ')} WHERE led_id = ?`,
      values
    ) as { affectedRows: number };

    return result.affectedRows > 0;
  }

  /**
   * Clear default flag from all LEDs (used before setting a new default)
   */
  async clearAllDefaults(): Promise<void> {
    await query(`UPDATE leds SET is_default = 0 WHERE is_default = 1`);
  }

  /**
   * Check if product code already exists (for validation)
   */
  async productCodeExists(productCode: string, excludeId?: number): Promise<boolean> {
    const params: (string | number)[] = [productCode];
    let sql = `SELECT COUNT(*) as count FROM leds WHERE product_code = ?`;

    if (excludeId) {
      sql += ` AND led_id != ?`;
      params.push(excludeId);
    }

    const rows = await query(sql, params) as Array<{ count: number }>;
    return rows[0].count > 0;
  }
}
