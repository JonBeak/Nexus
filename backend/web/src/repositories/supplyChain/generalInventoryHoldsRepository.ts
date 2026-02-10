/**
 * General Inventory Holds Repository
 * Data access layer for supplier product (general inventory) holds
 * Created: 2026-02-04
 *
 * Manages holds placed on supplier products for material requirements.
 * Holds are temporary records linking a supplier product to a material requirement.
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GeneralInventoryHold extends RowDataPacket {
  hold_id: number;
  supplier_product_id: number;
  material_requirement_id: number;
  quantity_held: string;
  created_at: Date;
  created_by: number | null;
}

export interface GeneralInventoryHoldWithDetails extends GeneralInventoryHold {
  // Supplier product details
  product_name?: string;
  sku?: string;
  brand_name?: string;
  quantity_on_hand?: number;
  quantity_reserved?: number;
  location?: string;

  // Archetype details
  archetype_id?: number;
  archetype_name?: string;

  // Supplier details
  supplier_id?: number;
  supplier_name?: string;

  // Material requirement details
  order_id?: number;
  order_number?: string;
  order_name?: string;
  customer_name?: string;
  unit?: string;

  // User details
  created_by_name?: string;
}

export interface CreateGeneralInventoryHoldData {
  supplier_product_id: number;
  material_requirement_id: number;
  quantity_held: string;
  created_by?: number | null;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class GeneralInventoryHoldsRepository {
  /**
   * Create a new general inventory hold
   * @param data Hold data including supplier_product_id, requirement_id, quantity
   * @returns The created hold ID
   */
  static async createHold(data: CreateGeneralInventoryHoldData): Promise<number> {
    const sql = `
      INSERT INTO general_inventory_holds (supplier_product_id, material_requirement_id, quantity_held, created_by)
      VALUES (?, ?, ?, ?)
    `;

    const result = await query(sql, [
      data.supplier_product_id,
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
  static async getHoldById(holdId: number): Promise<GeneralInventoryHold | null> {
    const sql = `SELECT * FROM general_inventory_holds WHERE hold_id = ?`;
    const rows = await query(sql, [holdId]) as GeneralInventoryHold[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get hold by material requirement ID
   * @param requirementId Material requirement ID
   * @returns Hold record with details or null
   */
  static async getHoldByRequirementId(requirementId: number): Promise<GeneralInventoryHoldWithDetails | null> {
    const sql = `
      SELECT
        gih.*,
        sp.product_name,
        sp.sku,
        sp.brand_name,
        sp.quantity_on_hand,
        sp.quantity_reserved,
        sp.location,
        sp.archetype_id,
        pa.name as archetype_name,
        sp.supplier_id,
        s.name as supplier_name,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM general_inventory_holds gih
      JOIN supplier_products sp ON gih.supplier_product_id = sp.supplier_product_id
      JOIN product_archetypes pa ON sp.archetype_id = pa.archetype_id
      JOIN suppliers s ON sp.supplier_id = s.supplier_id
      JOIN material_requirements mr ON gih.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON gih.created_by = u.user_id
      WHERE gih.material_requirement_id = ?
    `;
    const rows = await query(sql, [requirementId]) as GeneralInventoryHoldWithDetails[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all holds for a specific supplier product
   * Includes order and requirement details for display
   * @param supplierProductId Supplier product ID
   * @returns Array of holds with details
   */
  static async getHoldsBySupplierProductId(supplierProductId: number): Promise<GeneralInventoryHoldWithDetails[]> {
    const sql = `
      SELECT
        gih.*,
        sp.product_name,
        sp.sku,
        sp.brand_name,
        sp.quantity_on_hand,
        sp.quantity_reserved,
        sp.location,
        sp.archetype_id,
        pa.name as archetype_name,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM general_inventory_holds gih
      JOIN supplier_products sp ON gih.supplier_product_id = sp.supplier_product_id
      JOIN product_archetypes pa ON sp.archetype_id = pa.archetype_id
      JOIN material_requirements mr ON gih.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON gih.created_by = u.user_id
      WHERE gih.supplier_product_id = ?
      ORDER BY gih.created_at DESC
    `;
    return await query(sql, [supplierProductId]) as GeneralInventoryHoldWithDetails[];
  }

  /**
   * Get holds for multiple supplier products (batch query to avoid N+1)
   * @param supplierProductIds Array of supplier product IDs
   * @returns Map of supplier_product_id to array of holds
   */
  static async getHoldsForSupplierProducts(supplierProductIds: number[]): Promise<Map<number, GeneralInventoryHoldWithDetails[]>> {
    if (supplierProductIds.length === 0) {
      return new Map();
    }

    const placeholders = supplierProductIds.map(() => '?').join(',');
    const sql = `
      SELECT
        gih.*,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM general_inventory_holds gih
      JOIN material_requirements mr ON gih.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON gih.created_by = u.user_id
      WHERE gih.supplier_product_id IN (${placeholders})
      ORDER BY gih.created_at DESC
    `;

    const rows = await query(sql, supplierProductIds) as GeneralInventoryHoldWithDetails[];

    // Group by supplier_product_id
    const holdsMap = new Map<number, GeneralInventoryHoldWithDetails[]>();
    for (const row of rows) {
      if (!holdsMap.has(row.supplier_product_id)) {
        holdsMap.set(row.supplier_product_id, []);
      }
      holdsMap.get(row.supplier_product_id)!.push(row);
    }

    return holdsMap;
  }

  /**
   * Get other holds on the same supplier product (excludes the current requirement's hold)
   * Used for multi-hold receive flow
   * @param supplierProductId Supplier product ID
   * @param excludeRequirementId The requirement ID to exclude
   * @returns Array of other holds with details
   */
  static async getOtherHoldsOnProduct(supplierProductId: number, excludeRequirementId: number): Promise<GeneralInventoryHoldWithDetails[]> {
    const sql = `
      SELECT
        gih.*,
        mr.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        mr.unit,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM general_inventory_holds gih
      JOIN material_requirements mr ON gih.material_requirement_id = mr.requirement_id
      LEFT JOIN orders o ON mr.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON gih.created_by = u.user_id
      WHERE gih.supplier_product_id = ? AND gih.material_requirement_id != ?
      ORDER BY gih.created_at DESC
    `;
    return await query(sql, [supplierProductId, excludeRequirementId]) as GeneralInventoryHoldWithDetails[];
  }

  /**
   * Delete hold by hold ID
   * @param holdId Hold ID
   * @returns True if deleted, false if not found
   */
  static async deleteHold(holdId: number): Promise<boolean> {
    const sql = `DELETE FROM general_inventory_holds WHERE hold_id = ?`;
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
    const sql = `DELETE FROM general_inventory_holds WHERE material_requirement_id = ?`;
    const result = await query(sql, [requirementId]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Delete all holds for a supplier product
   * Used when product is consumed
   * @param supplierProductId Supplier product ID
   * @returns Number of holds deleted
   */
  static async deleteHoldsBySupplierProductId(supplierProductId: number): Promise<number> {
    const sql = `DELETE FROM general_inventory_holds WHERE supplier_product_id = ?`;
    const result = await query(sql, [supplierProductId]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Check if a requirement already has a general inventory hold
   * @param requirementId Material requirement ID
   * @returns True if hold exists
   */
  static async requirementHasHold(requirementId: number): Promise<boolean> {
    const sql = `SELECT 1 FROM general_inventory_holds WHERE material_requirement_id = ? LIMIT 1`;
    const rows = await query(sql, [requirementId]) as RowDataPacket[];
    return rows.length > 0;
  }

  /**
   * Get count of holds on a supplier product
   * @param supplierProductId Supplier product ID
   * @returns Number of holds
   */
  static async getHoldCount(supplierProductId: number): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM general_inventory_holds WHERE supplier_product_id = ?`;
    const rows = await query(sql, [supplierProductId]) as RowDataPacket[];
    return rows[0]?.count || 0;
  }

  /**
   * Get supplier products with stock for an archetype
   * Used for the general inventory selector modal
   * @param archetypeId Product archetype ID
   * @returns Array of supplier products with holds info
   */
  static async getSupplierProductsWithHoldsForArchetype(archetypeId: number): Promise<any[]> {
    const sql = `
      SELECT
        sp.supplier_product_id,
        sp.product_name,
        sp.sku,
        sp.brand_name,
        sp.quantity_on_hand,
        sp.quantity_reserved,
        sp.location,
        s.name as supplier_name,
        (
          SELECT GROUP_CONCAT(
            CONCAT(gih.quantity_held, ' - ', COALESCE(o.order_number, 'Stock'), ': ', COALESCE(o.order_name, 'N/A'))
            SEPARATOR '|'
          )
          FROM general_inventory_holds gih
          JOIN material_requirements mr ON gih.material_requirement_id = mr.requirement_id
          LEFT JOIN orders o ON mr.order_id = o.order_id
          WHERE gih.supplier_product_id = sp.supplier_product_id
        ) as holds_summary
      FROM supplier_products sp
      JOIN suppliers s ON sp.supplier_id = s.supplier_id
      WHERE sp.archetype_id = ?
        AND sp.is_active = 1
        AND sp.quantity_on_hand > 0
      ORDER BY sp.product_name
    `;
    return await query(sql, [archetypeId]) as any[];
  }
}
