// File Clean up Finished: 2025-11-15
// Changes:
// - Split large file (579 lines → ~290 lines, 50% reduction)
// - Extracted order links to vinylInventoryOrderLinksRepository.ts
// - Extracted statistics to vinylInventoryStatsRepository.ts
// - Extracted label generation to vinylLabelGenerator.ts utility
// - Modernized TypeScript patterns (proper generics instead of 'as any')
// - Added status_change_date support to markVinylAsUsed()
// - Improved transaction consistency with proper destructuring
// - Maintained all computed fields (display_colour, current_stock, etc.) as documented in types

/**
 * Vinyl Inventory Repository
 * Data access layer for vinyl inventory core CRUD operations
 *
 * Responsibilities:
 * - Create, Read, Update, Delete vinyl inventory items
 * - Complex atomic transactions (inventory + product creation)
 * - Status changes with proper audit trail (status_change_date)
 * - Computed field population (display_colour, current_stock, etc.)
 *
 * Related Repositories:
 * - VinylInventoryOrderLinksRepository: Order associations
 * - VinylInventoryStatsRepository: Statistics and helper queries
 *
 * Utilities:
 * - vinylLabelGenerator: Label ID generation
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { pool, query } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  VinylItem,
  VinylInventoryData,
  VinylInventoryFilters
} from '../../types/vinyl';
import { generateVinylLabelId } from '../../utils/vinyl/vinylLabelGenerator';
import { VinylInventoryOrderLinksRepository } from './vinylInventoryOrderLinksRepository';

export class VinylInventoryRepository {
  /**
   * Get vinyl inventory items with filters and optimized joins
   *
   * Supports filtering by: disposition, search, brand, series, location, supplier, date range
   * Includes computed fields: display_colour, current_stock, minimum_stock, unit, last_updated
   * Optimized to prevent N+1 queries for job associations
   *
   * @param filters - Optional filter criteria
   * @returns Promise<VinylItem[]> - Array of vinyl items with computed fields
   */
  static async getVinylItems(filters: VinylInventoryFilters = {}): Promise<VinylItem[]> {
    const {
      disposition,
      search,
      brand,
      series,
      location,
      supplier_id,
      date_from,
      date_to
    } = filters;

    let sql = `
      SELECT
        v.*,
        CONCAT(su.first_name, ' ', su.last_name) as storage_user_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as usage_user_name,
        s.name as supplier_name
      FROM vinyl_inventory v
      LEFT JOIN users su ON v.storage_user = su.user_id
      LEFT JOIN users uu ON v.usage_user = uu.user_id
      LEFT JOIN suppliers s ON v.supplier_id = s.supplier_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (disposition) {
      sql += ' AND v.disposition = ?';
      params.push(disposition);
    }

    if (search) {
      sql += ` AND (
        v.brand LIKE ? OR
        v.series LIKE ? OR
        v.colour_number LIKE ? OR
        v.colour_name LIKE ? OR
        v.location LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (brand) {
      sql += ' AND v.brand = ?';
      params.push(brand);
    }

    if (series) {
      sql += ' AND v.series = ?';
      params.push(series);
    }

    if (location) {
      sql += ' AND v.location = ?';
      params.push(location);
    }

    if (supplier_id) {
      sql += ' AND v.supplier_id = ?';
      params.push(supplier_id);
    }

    if (date_from) {
      sql += ' AND v.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND v.created_at <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY v.created_at DESC';

    const items = await query(sql, params) as VinylItem[];

    // Get order associations for all items in one query (fix N+1 problem)
    if (items.length > 0) {
      const vinylIds = items.map(item => item.id);
      const orderLinksMap = await VinylInventoryOrderLinksRepository.getOrderLinksForItems(vinylIds);

      // Attach order associations and computed fields to items
      items.forEach(item => {
        item.order_associations = orderLinksMap[item.id] || [];

        // Create display_colour (documented computed field)
        item.display_colour = item.colour_number && item.colour_name
          ? `${item.colour_number} ${item.colour_name}`
          : (item.colour_number || item.colour_name || '');

        // Computed fields for frontend compatibility
        item.current_stock = item.disposition === 'in_stock' ? item.length_yards : 0;
        item.minimum_stock = 0;
        item.unit = 'yards';
        item.last_updated = item.updated_at;
      });
    }

    return items;
  }

  /**
   * Get single vinyl item by ID
   *
   * Includes all joins and computed fields
   *
   * @param id - Vinyl inventory ID
   * @returns Promise<VinylItem | null> - Vinyl item with computed fields or null if not found
   */
  static async getVinylItemById(id: number): Promise<VinylItem | null> {
    const sql = `
      SELECT
        v.*,
        CONCAT(su.first_name, ' ', su.last_name) as storage_user_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as usage_user_name,
        s.name as supplier_name
      FROM vinyl_inventory v
      LEFT JOIN users su ON v.storage_user = su.user_id
      LEFT JOIN users uu ON v.usage_user = uu.user_id
      LEFT JOIN suppliers s ON v.supplier_id = s.supplier_id
      WHERE v.id = ?
    `;

    const items = await query(sql, [id]) as VinylItem[];

    if (items.length === 0) {
      return null;
    }

    const item = items[0];

    // Get order associations
    const orderLinks = await VinylInventoryOrderLinksRepository.getOrderLinksForItems([item.id]);
    item.order_associations = orderLinks[item.id] || [];

    // Create display_colour and computed fields
    item.display_colour = item.colour_number && item.colour_name
      ? `${item.colour_number} ${item.colour_name}`
      : (item.colour_number || item.colour_name || '');

    item.current_stock = item.disposition === 'in_stock' ? item.length_yards : 0;
    item.minimum_stock = 0;
    item.unit = 'yards';
    item.last_updated = item.updated_at;

    return item;
  }

  /**
   * Create new vinyl inventory item
   *
   * Auto-generates label ID if not provided
   *
   * @param data - Vinyl inventory data
   * @returns Promise<number> - Inserted inventory ID
   */
  static async createVinylItem(data: VinylInventoryData): Promise<number> {
    // Generate label ID if not provided
    if (!data.label_id) {
      data.label_id = await generateVinylLabelId();
    }

    const sql = `
      INSERT INTO vinyl_inventory (
        brand, series, colour_number, colour_name, width, length_yards,
        location, supplier_id, purchase_date, storage_date, expiration_date,
        disposition, storage_user, created_by, updated_by, label_id,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.brand,
      data.series,
      data.colour_number || null,
      data.colour_name || null,
      data.width,
      data.length_yards,
      data.location || null,
      data.supplier_id || null,
      data.purchase_date || null,
      data.storage_date || new Date(),
      data.expiration_date || null,
      data.disposition || 'in_stock',
      data.storage_user || null,
      data.created_by || null,
      data.updated_by || null,
      data.label_id,
      data.notes || null
    ];

    const result = await query(sql, params) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Create new vinyl inventory item with atomic product creation
   *
   * Transaction ensures:
   * - Inventory item created
   * - Order associations created (if provided)
   * - Product found or created atomically
   *
   * @param inventoryData - Vinyl inventory data
   * @param orderIds - Optional order IDs to associate
   * @returns Promise<{inventoryId: number, productId?: number}> - Created IDs
   */
  static async createVinylItemWithProduct(
    inventoryData: VinylInventoryData,
    orderIds?: number[]
  ): Promise<{ inventoryId: number; productId?: number }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Generate label ID if not provided
      if (!inventoryData.label_id) {
        inventoryData.label_id = await generateVinylLabelId();
      }

      // Create inventory item
      const inventorySql = `
        INSERT INTO vinyl_inventory (
          brand, series, colour_number, colour_name, width, length_yards,
          location, supplier_id, purchase_date, storage_date, expiration_date,
          disposition, storage_user, created_by, updated_by, label_id,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const inventoryParams = [
        inventoryData.brand,
        inventoryData.series,
        inventoryData.colour_number || null,
        inventoryData.colour_name || null,
        inventoryData.width,
        inventoryData.length_yards,
        inventoryData.location || null,
        inventoryData.supplier_id || null,
        inventoryData.purchase_date || null,
        inventoryData.storage_date || new Date(),
        inventoryData.expiration_date || null,
        inventoryData.disposition || 'in_stock',
        inventoryData.storage_user || null,
        inventoryData.created_by || null,
        inventoryData.updated_by || null,
        inventoryData.label_id,
        inventoryData.notes || null
      ];

      const [inventoryResult] = await connection.execute<ResultSetHeader>(inventorySql, inventoryParams);
      const inventoryId = inventoryResult.insertId;

      // Handle order associations if provided
      if (orderIds && orderIds.length > 0) {
        // Delete existing associations (shouldn't be any for new item, but for consistency)
        await connection.execute('DELETE FROM vinyl_order_links WHERE vinyl_id = ?', [inventoryId]);

        // Insert new associations with sequence order
        for (let i = 0; i < orderIds.length; i++) {
          await connection.execute(
            'INSERT INTO vinyl_order_links (vinyl_id, order_id, sequence_order) VALUES (?, ?, ?)',
            [inventoryId, orderIds[i], i + 1]
          );
        }
      }

      // Find or create product
      let productId: number | undefined;

      // Try to find existing product
      const productSearchSql = `
        SELECT product_id
        FROM vinyl_products
        WHERE brand = ? AND series = ?
          AND (colour_number = ? OR (colour_number IS NULL AND ? IS NULL))
          AND (colour_name = ? OR (colour_name IS NULL AND ? IS NULL))
        LIMIT 1
      `;

      const searchParams = [
        inventoryData.brand,
        inventoryData.series,
        inventoryData.colour_number || null,
        inventoryData.colour_number || null,
        inventoryData.colour_name || null,
        inventoryData.colour_name || null
      ];

      const [existingProducts] = await connection.execute<RowDataPacket[]>(productSearchSql, searchParams);

      if (existingProducts.length > 0) {
        productId = existingProducts[0].product_id;
      } else {
        // Create new product
        const productSql = `
          INSERT INTO vinyl_products (
            brand, series, colour_number, colour_name, default_width,
            is_active, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const productParams = [
          inventoryData.brand,
          inventoryData.series,
          inventoryData.colour_number || null,
          inventoryData.colour_name || null,
          inventoryData.width || null,
          true,
          inventoryData.created_by || null,
          inventoryData.updated_by || null
        ];

        const [productResult] = await connection.execute<ResultSetHeader>(productSql, productParams);
        productId = productResult.insertId;
      }

      await connection.commit();
      return { inventoryId, productId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update vinyl inventory item
   *
   * Dynamically builds update query from provided fields
   * Always updates updated_at timestamp
   *
   * @param id - Vinyl inventory ID
   * @param data - Partial vinyl inventory data to update
   * @returns Promise<boolean> - True if updated, false if not found
   */
  static async updateVinylItem(id: number, data: Partial<VinylInventoryData>): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) {
      return true; // Nothing to update
    }

    // Always update the updated_at timestamp
    fields.push('updated_at = NOW()');
    params.push(id);

    const sql = `UPDATE vinyl_inventory SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  /**
   * Delete vinyl inventory item
   *
   * Also deletes associated order links
   *
   * @param id - Vinyl inventory ID
   * @returns Promise<boolean> - True if deleted, false if not found
   */
  static async deleteVinylItem(id: number): Promise<boolean> {
    // First, delete order associations
    await VinylInventoryOrderLinksRepository.deleteOrderLinksForItem(id);

    // Then delete the item
    const sql = 'DELETE FROM vinyl_inventory WHERE id = ?';
    const result = await query(sql, [id]) as ResultSetHeader;

    return result.affectedRows > 0;
  }

  /**
   * Mark vinyl as used with order associations
   *
   * Updates:
   * - disposition → 'used'
   * - usage_date → NOW()
   * - status_change_date → NOW() (NEW: proper audit trail)
   * - usage_user → provided user ID
   * - notes → usage note
   * - order associations → provided order IDs
   *
   * @param vinylId - Vinyl inventory ID
   * @param usageData - Usage information (user, note, order IDs)
   */
  static async markVinylAsUsed(vinylId: number, usageData: {
    usage_user?: number;
    usage_note?: string;
    order_ids?: number[];
  }): Promise<void> {
    // Update vinyl item status with proper status_change_date tracking
    const updateSql = `
      UPDATE vinyl_inventory
      SET disposition = 'used',
          usage_date = NOW(),
          status_change_date = NOW(),
          usage_user = ?,
          notes = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    await query(updateSql, [
      usageData.usage_user || null,
      usageData.usage_note || null,
      vinylId
    ]);

    // Update order associations if provided
    if (usageData.order_ids && usageData.order_ids.length > 0) {
      await VinylInventoryOrderLinksRepository.updateOrderLinks(vinylId, usageData.order_ids);
    }
  }
}
