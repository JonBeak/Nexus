// File Clean up Finished: 2025-11-15
/**
 * Vinyl Inventory Statistics Repository
 * Data access layer for vinyl inventory statistics and helper queries
 *
 * Created: 2025-11-15
 * Extracted from vinylInventoryRepository during refactoring to reduce file size
 *
 * Handles:
 * - Aggregate statistics (total items, yards, disposition counts, etc.)
 * - Recent items for copying (pre-fill forms with commonly used products)
 * - Supplier lookups for product combinations
 * - Existence checks
 * - Filtered queries by disposition
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../../config/database';
import { VinylItem, Supplier } from '../../types/vinyl';

export class VinylInventoryStatsRepository {
  /**
   * Get vinyl inventory statistics
   *
   * Returns aggregate data for dashboard/reporting:
   * - Total items and breakdown by disposition
   * - Total yards (all and by disposition)
   * - Unique brands, series, locations counts
   *
   * @returns Promise<any> - Statistics object
   */
  static async getVinylStats(): Promise<any> {
    const sql = `
      SELECT
        COUNT(*) as total_items,
        SUM(CASE WHEN disposition = 'in_stock' THEN 1 ELSE 0 END) as in_stock_count,
        SUM(CASE WHEN disposition = 'used' THEN 1 ELSE 0 END) as used_count,
        SUM(CASE WHEN disposition = 'waste' THEN 1 ELSE 0 END) as waste_count,
        SUM(CASE WHEN disposition = 'returned' THEN 1 ELSE 0 END) as returned_count,
        SUM(length_yards) as total_yards_all,
        SUM(CASE WHEN disposition = 'in_stock' THEN length_yards ELSE 0 END) as total_yards_in_stock,
        SUM(CASE WHEN disposition = 'used' THEN length_yards ELSE 0 END) as total_yards_used,
        SUM(CASE WHEN disposition = 'waste' THEN length_yards ELSE 0 END) as total_yards_waste,
        COUNT(DISTINCT brand) as brands_count,
        COUNT(DISTINCT CONCAT(brand, '-', series)) as series_count,
        COUNT(DISTINCT location) as locations_count
      FROM vinyl_inventory
    `;

    const stats = await query(sql) as any[];
    return stats[0] || {};
  }

  /**
   * Get recent vinyl items for copying
   *
   * Returns distinct product combinations from recently used items
   * Used for quick-add functionality to pre-fill common products
   *
   * @param limit - Maximum number of items to return (default: 10)
   * @returns Promise<VinylItem[]> - Recent vinyl product combinations
   */
  static async getRecentVinylForCopying(limit: number = 10): Promise<VinylItem[]> {
    const sql = `
      SELECT DISTINCT
        brand, series, colour_number, colour_name, width,
        location, supplier_id
      FROM vinyl_inventory
      WHERE disposition = 'used'
      ORDER BY usage_date DESC
      LIMIT ?
    `;

    return await query(sql, [limit]) as VinylItem[];
  }

  /**
   * Get suppliers for a product combination
   *
   * Finds suppliers who have provided a specific vinyl product
   * Used for supplier selection during inventory creation
   *
   * @param brand - Vinyl brand
   * @param series - Vinyl series
   * @param colourNumber - Optional colour number filter
   * @returns Promise<Supplier[]> - Active suppliers for this product
   */
  static async getSuppliersForProduct(brand: string, series: string, colourNumber?: string): Promise<Supplier[]> {
    let sql = `
      SELECT DISTINCT s.*
      FROM suppliers s
      JOIN vinyl_inventory v ON s.supplier_id = v.supplier_id
      WHERE v.brand = ? AND v.series = ?
    `;

    const params: any[] = [brand, series];

    if (colourNumber) {
      sql += ' AND v.colour_number = ?';
      params.push(colourNumber);
    }

    sql += ' AND s.is_active = 1 ORDER BY s.name';

    return await query(sql, params) as Supplier[];
  }

  /**
   * Check if vinyl item exists
   *
   * Quick existence check by ID
   * Used before update/delete operations
   *
   * @param id - Vinyl inventory ID
   * @returns Promise<boolean> - True if exists, false otherwise
   */
  static async vinylItemExists(id: number): Promise<boolean> {
    const sql = 'SELECT 1 FROM vinyl_inventory WHERE id = ? LIMIT 1';
    const result = await query(sql, [id]) as any[];
    return result.length > 0;
  }

  /**
   * Get vinyl items by disposition
   *
   * Alias for getVinylItems with disposition filter
   * Used for filtered views (in stock, used, waste, etc.)
   *
   * NOTE: This method imports from main repository to avoid duplication
   * Consider moving to service layer if circular dependency issues arise
   *
   * @param disposition - Disposition filter value
   * @returns Promise<VinylItem[]> - Filtered vinyl items
   */
  static async getVinylItemsByDisposition(disposition: string): Promise<VinylItem[]> {
    // Import here to avoid circular dependency
    const { VinylInventoryRepository } = require('./vinylInventoryRepository');
    return VinylInventoryRepository.getVinylItems({ disposition: disposition as any });
  }
}
