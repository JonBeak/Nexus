/**
 * Vinyl Holds Repository
 * Data access layer for vinyl inventory holds
 * Created: 2026-02-04
 *
 * Manages holds placed on vinyl inventory items for material requirements.
 * Holds are temporary records linking a vinyl piece to a material requirement.
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface VinylHold extends RowDataPacket {
  hold_id: number;
  vinyl_id: number;
  material_requirement_id: number;
  quantity_held: string;
  created_at: Date;
  created_by: number | null;
}

export interface VinylHoldWithDetails extends VinylHold {
  // Vinyl item details
  vinyl_brand?: string;
  vinyl_series?: string;
  vinyl_colour_number?: string;
  vinyl_colour_name?: string;
  vinyl_width?: number;
  vinyl_length_yards?: number;
  vinyl_location?: string;
  vinyl_disposition?: string;

  // Material requirement details
  order_id?: number;
  order_number?: string;
  order_name?: string;
  customer_name?: string;
  unit?: string;

  // User details
  created_by_name?: string;
}

export interface CreateVinylHoldData {
  vinyl_id: number;
  material_requirement_id: number;
  quantity_held: string;
  created_by?: number | null;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class VinylHoldsRepository {
  /**
   * Create a new vinyl hold
   * @param data Hold data including vinyl_id, requirement_id, quantity
   * @returns The created hold ID
   */
  static async createHold(data: CreateVinylHoldData): Promise<number> {
    const sql = `
      INSERT INTO vinyl_holds (vinyl_id, material_requirement_id, quantity_held, created_by)
      VALUES (?, ?, ?, ?)
    `;

    const result = await query(sql, [
      data.vinyl_id,
      data.material_requirement_id,
      data.quantity_held,
      data.created_by || null
    ]) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Get hold by ID
   * @param holdId Hold ID
   * @returns Hold record or null
   */
  static async getHoldById(holdId: number): Promise<VinylHold | null> {
    const sql = `SELECT * FROM vinyl_holds WHERE hold_id = ?`;
    const rows = await query(sql, [holdId]) as VinylHold[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get hold by material requirement ID
   * @param requirementId Material requirement ID
   * @returns Hold record with details or null
   */
  static async getHoldByRequirementId(requirementId: number): Promise<VinylHoldWithDetails | null> {
    const sql = `
      SELECT
        vh.*,
        vi.brand as vinyl_brand,
        vi.series as vinyl_series,
        vi.colour_number as vinyl_colour_number,
        vi.colour_name as vinyl_colour_name,
        vi.width as vinyl_width,
        vi.length_yards as vinyl_length_yards,
        vi.location as vinyl_location,
        vi.disposition as vinyl_disposition,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM vinyl_holds vh
      JOIN vinyl_inventory vi ON vh.vinyl_id = vi.id
      JOIN material_requirements mr ON vh.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON vh.created_by = u.user_id
      WHERE vh.material_requirement_id = ?
    `;
    const rows = await query(sql, [requirementId]) as VinylHoldWithDetails[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all holds for a specific vinyl item
   * Includes order and requirement details for display
   * @param vinylId Vinyl inventory ID
   * @returns Array of holds with details
   */
  static async getHoldsByVinylId(vinylId: number): Promise<VinylHoldWithDetails[]> {
    const sql = `
      SELECT
        vh.*,
        vi.brand as vinyl_brand,
        vi.series as vinyl_series,
        vi.colour_number as vinyl_colour_number,
        vi.colour_name as vinyl_colour_name,
        vi.width as vinyl_width,
        vi.length_yards as vinyl_length_yards,
        vi.location as vinyl_location,
        vi.disposition as vinyl_disposition,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM vinyl_holds vh
      JOIN vinyl_inventory vi ON vh.vinyl_id = vi.id
      JOIN material_requirements mr ON vh.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON vh.created_by = u.user_id
      WHERE vh.vinyl_id = ?
      ORDER BY vh.created_at DESC
    `;
    return await query(sql, [vinylId]) as VinylHoldWithDetails[];
  }

  /**
   * Get holds for multiple vinyl items (batch query to avoid N+1)
   * @param vinylIds Array of vinyl inventory IDs
   * @returns Map of vinyl_id to array of holds
   */
  static async getHoldsForVinylItems(vinylIds: number[]): Promise<Map<number, VinylHoldWithDetails[]>> {
    if (vinylIds.length === 0) {
      return new Map();
    }

    const placeholders = vinylIds.map(() => '?').join(',');
    const sql = `
      SELECT
        vh.*,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM vinyl_holds vh
      JOIN material_requirements mr ON vh.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON vh.created_by = u.user_id
      WHERE vh.vinyl_id IN (${placeholders})
      ORDER BY vh.created_at DESC
    `;

    const rows = await query(sql, vinylIds) as VinylHoldWithDetails[];

    // Group by vinyl_id
    const holdsMap = new Map<number, VinylHoldWithDetails[]>();
    for (const row of rows) {
      if (!holdsMap.has(row.vinyl_id)) {
        holdsMap.set(row.vinyl_id, []);
      }
      holdsMap.get(row.vinyl_id)!.push(row);
    }

    return holdsMap;
  }

  /**
   * Get other holds on the same vinyl (excludes the current requirement's hold)
   * Used for multi-hold receive flow
   * @param vinylId Vinyl inventory ID
   * @param excludeRequirementId The requirement ID to exclude
   * @returns Array of other holds with details
   */
  static async getOtherHoldsOnVinyl(vinylId: number, excludeRequirementId: number): Promise<VinylHoldWithDetails[]> {
    const sql = `
      SELECT
        vh.*,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM vinyl_holds vh
      JOIN material_requirements mr ON vh.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON vh.created_by = u.user_id
      WHERE vh.vinyl_id = ? AND vh.material_requirement_id != ?
      ORDER BY vh.created_at DESC
    `;
    return await query(sql, [vinylId, excludeRequirementId]) as VinylHoldWithDetails[];
  }

  /**
   * Delete hold by hold ID
   * @param holdId Hold ID
   * @returns True if deleted, false if not found
   */
  static async deleteHold(holdId: number): Promise<boolean> {
    const sql = `DELETE FROM vinyl_holds WHERE hold_id = ?`;
    const result = await query(sql, [holdId]) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Delete all holds for a requirement
   * Used when vendor changes or requirement is deleted
   * @param requirementId Material requirement ID
   * @returns Number of holds deleted
   */
  static async deleteHoldsByRequirementId(requirementId: number): Promise<number> {
    const sql = `DELETE FROM vinyl_holds WHERE material_requirement_id = ?`;
    const result = await query(sql, [requirementId]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Delete all holds for a vinyl item
   * Used when vinyl is marked as used
   * @param vinylId Vinyl inventory ID
   * @returns Number of holds deleted
   */
  static async deleteHoldsByVinylId(vinylId: number): Promise<number> {
    const sql = `DELETE FROM vinyl_holds WHERE vinyl_id = ?`;
    const result = await query(sql, [vinylId]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Check if a requirement already has a vinyl hold
   * @param requirementId Material requirement ID
   * @returns True if hold exists
   */
  static async requirementHasHold(requirementId: number): Promise<boolean> {
    const sql = `SELECT 1 FROM vinyl_holds WHERE material_requirement_id = ? LIMIT 1`;
    const rows = await query(sql, [requirementId]) as RowDataPacket[];
    return rows.length > 0;
  }

  /**
   * Get count of holds on a vinyl item
   * @param vinylId Vinyl inventory ID
   * @returns Number of holds
   */
  static async getHoldCount(vinylId: number): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM vinyl_holds WHERE vinyl_id = ?`;
    const rows = await query(sql, [vinylId]) as RowDataPacket[];
    return rows[0]?.count || 0;
  }
}
