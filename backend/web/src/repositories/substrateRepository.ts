// File Clean up Finished: Nov 14, 2025
/**
 * Substrate Repository
 *
 * Database access layer for substrate materials and pricing
 * Created: Nov 14, 2025 during materialsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface SubstratePricing extends RowDataPacket {
  id: number;
  substrate_name: string;
  material_cost_per_sheet: number;
  cutting_rate_per_sheet: number;
  sheet_size_sqft: number;
  effective_date: Date;
  is_active: boolean;
}

export class SubstrateRepository {
  /**
   * Get all unique active substrate names for dropdown selections
   * Returns distinct substrate names ordered alphabetically
   */
  async findAllActiveNames(): Promise<string[]> {
    const rows = await query(
      `SELECT DISTINCT substrate_name
       FROM substrate_cut_pricing
       WHERE is_active = 1
       ORDER BY substrate_name ASC`
    ) as Array<{ substrate_name: string }>;

    // Extract just the names into a simple array
    return rows.map(row => row.substrate_name);
  }

  /**
   * Get full pricing details for a specific substrate
   * Returns the most recent active pricing entry
   *
   * @param substrateName - Name of the substrate material
   * @returns Latest pricing info or null if not found
   */
  async findByName(substrateName: string): Promise<SubstratePricing | null> {
    const rows = await query(
      `SELECT *
       FROM substrate_cut_pricing
       WHERE substrate_name = ? AND is_active = 1
       ORDER BY effective_date DESC
       LIMIT 1`,
      [substrateName]
    ) as SubstratePricing[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all pricing records for a substrate (including historical)
   * Useful for price history tracking
   *
   * @param substrateName - Name of the substrate material
   * @returns All pricing records for the substrate
   */
  async findPricingHistory(substrateName: string): Promise<SubstratePricing[]> {
    const rows = await query(
      `SELECT *
       FROM substrate_cut_pricing
       WHERE substrate_name = ? AND is_active = 1
       ORDER BY effective_date DESC`,
      [substrateName]
    ) as SubstratePricing[];

    return rows;
  }

  /**
   * Get all active substrate pricing records
   * Returns complete pricing information for all substrates
   */
  async findAllActivePricing(): Promise<SubstratePricing[]> {
    const rows = await query(
      `SELECT *
       FROM substrate_cut_pricing
       WHERE is_active = 1
       ORDER BY substrate_name ASC, effective_date DESC`
    ) as SubstratePricing[];

    return rows;
  }

  /**
   * Get total count of unique active substrates
   * Useful for dashboard statistics
   */
  async countUniqueActive(): Promise<number> {
    const rows = await query(
      `SELECT COUNT(DISTINCT substrate_name) as count
       FROM substrate_cut_pricing
       WHERE is_active = 1`
    ) as Array<{ count: number }>;

    return rows[0]?.count || 0;
  }

  /**
   * Check if a substrate exists and is active
   * Quick validation without returning full data
   */
  async exists(substrateName: string): Promise<boolean> {
    const rows = await query(
      `SELECT 1
       FROM substrate_cut_pricing
       WHERE substrate_name = ? AND is_active = 1
       LIMIT 1`,
      [substrateName]
    ) as RowDataPacket[];

    return rows.length > 0;
  }
}
