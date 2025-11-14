// File Clean up Finished: Nov 14, 2025
/**
 * Power Supply Repository
 *
 * Database access layer for power supply products
 * Created: Nov 14, 2025 during powerSuppliesController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface PowerSupply extends RowDataPacket {
  power_supply_id: number;
  transformer_type: string;
  price?: number;
  watts?: number;
  rated_watts?: number;
  volts?: number;
  warranty_labour_years?: number;
  warranty_product_years?: number;
  notes?: string;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PowerSupplyRepository {
  /**
   * Get all active power supplies for dropdown selections
   * Ordered by default status (UL first, then non-UL, then others), then alphabetically
   */
  async findAllActive(): Promise<PowerSupply[]> {
    const rows = await query(
      `SELECT
        power_supply_id,
        transformer_type,
        watts,
        rated_watts,
        volts,
        ul_listed,
        is_default_non_ul,
        is_default_ul
      FROM power_supplies
      WHERE is_active = 1
      ORDER BY
        CASE
          WHEN is_default_ul = 1 THEN 1
          WHEN is_default_non_ul = 1 THEN 2
          ELSE 3
        END,
        transformer_type ASC`
    ) as PowerSupply[];

    return rows;
  }

  /**
   * Find power supply by transformer type
   * Used for validation and lookups
   */
  async findByTransformerType(transformerType: string): Promise<PowerSupply | null> {
    const rows = await query(
      `SELECT * FROM power_supplies WHERE transformer_type = ? AND is_active = 1`,
      [transformerType]
    ) as PowerSupply[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find power supplies matching a fuzzy search pattern
   * Used by auto-fill service for power supply type matching
   *
   * @param searchPattern - Pattern to match against full power supply name format
   * @returns Array of matching power supplies with formatted names
   */
  async findByFuzzyMatch(searchPattern: string): Promise<Array<{ full_name: string }>> {
    const rows = await query(
      `SELECT CONCAT(transformer_type, ' (', watts, 'W, ', volts, 'V)') AS full_name
       FROM power_supplies
       WHERE is_active = 1
       AND CONCAT(transformer_type, ' (', watts, 'W, ', volts, 'V)') LIKE ?
       LIMIT 1`,
      [searchPattern]
    ) as Array<{ full_name: string }>;

    return rows;
  }

  /**
   * Get default UL-listed power supply
   * Returns the power supply marked as default for UL applications
   */
  async findDefaultUL(): Promise<PowerSupply | null> {
    const rows = await query(
      `SELECT * FROM power_supplies WHERE is_default_ul = 1 AND is_active = 1 LIMIT 1`
    ) as PowerSupply[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get default non-UL power supply
   * Returns the power supply marked as default for non-UL applications
   */
  async findDefaultNonUL(): Promise<PowerSupply | null> {
    const rows = await query(
      `SELECT * FROM power_supplies WHERE is_default_non_ul = 1 AND is_active = 1 LIMIT 1`
    ) as PowerSupply[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find power supplies by UL listing status
   * Used for filtering UL vs non-UL power supplies
   */
  async findByULStatus(ulListed: boolean): Promise<PowerSupply[]> {
    const rows = await query(
      `SELECT * FROM power_supplies WHERE ul_listed = ? AND is_active = 1 ORDER BY transformer_type ASC`,
      [ulListed ? 1 : 0]
    ) as PowerSupply[];

    return rows;
  }

  /**
   * Get total count of active power supplies
   * Useful for dashboard statistics
   */
  async countActive(): Promise<number> {
    const rows = await query(
      `SELECT COUNT(*) as count FROM power_supplies WHERE is_active = 1`
    ) as Array<{ count: number }>;

    return rows[0]?.count || 0;
  }

  /**
   * Get count by UL status
   * Returns count of UL vs non-UL power supplies
   */
  async countByULStatus(): Promise<{ ul: number; nonUl: number }> {
    const rows = await query(
      `SELECT
        SUM(CASE WHEN ul_listed = 1 THEN 1 ELSE 0 END) as ul,
        SUM(CASE WHEN ul_listed = 0 THEN 1 ELSE 0 END) as nonUl
       FROM power_supplies
       WHERE is_active = 1`
    ) as Array<{ ul: number; nonUl: number }>;

    return rows[0] || { ul: 0, nonUl: 0 };
  }
}
