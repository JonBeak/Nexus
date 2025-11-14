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
}
