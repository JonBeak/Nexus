/**
 * Vinyl Inventory Repository
 * Data access layer for vinyl inventory operations
 */

import { query } from '../../config/database';
import {
  VinylItem,
  VinylInventoryData,
  VinylInventoryFilters,
  JobLink,
  Supplier
} from '../../types/vinyl';

export class VinylInventoryRepository {
  /**
   * Get vinyl inventory items with filters and optimized joins
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

    // Get job associations for all items in one query (fix N+1 problem)
    if (items.length > 0) {
      const vinylIds = items.map(item => item.id);
      const jobLinksMap = await this.getJobLinksForItems(vinylIds);

      // Attach job associations to items
      items.forEach(item => {
        item.job_associations = jobLinksMap[item.id] || [];

        // Create display_colour
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

    // Get job associations
    item.job_associations = await this.getJobLinksForItems([item.id])[item.id] || [];

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
   */
  static async createVinylItem(data: VinylInventoryData): Promise<number> {
    // Generate label ID if not provided
    if (!data.label_id) {
      data.label_id = await this.generateLabelId();
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

    const result = await query(sql, params) as any;
    return result.insertId;
  }

  /**
   * Update vinyl inventory item
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
    const result = await query(sql, params) as any;

    return result.affectedRows > 0;
  }

  /**
   * Delete vinyl inventory item
   */
  static async deleteVinylItem(id: number): Promise<boolean> {
    // First, delete job associations
    await this.deleteJobLinksForItem(id);

    // Then delete the item
    const sql = 'DELETE FROM vinyl_inventory WHERE id = ?';
    const result = await query(sql, [id]) as any;

    return result.affectedRows > 0;
  }

  /**
   * Get job links for multiple vinyl items (optimized to fix N+1 problem)
   */
  static async getJobLinksForItems(vinylIds: number[]): Promise<{ [vinylId: number]: JobLink[] }> {
    if (vinylIds.length === 0) {
      return {};
    }

    const placeholders = vinylIds.map(() => '?').join(',');
    const sql = `
      SELECT
        vjl.*,
        j.job_number,
        j.job_name,
        c.company_name as customer_name
      FROM vinyl_job_links vjl
      JOIN jobs j ON vjl.job_id = j.job_id
      LEFT JOIN customers c ON j.customer_id = c.customer_id
      WHERE vjl.vinyl_id IN (${placeholders})
      ORDER BY vjl.vinyl_id, vjl.sequence_order
    `;

    const jobLinks = await query(sql, vinylIds) as JobLink[];

    // Group by vinyl_id
    const groupedLinks: { [vinylId: number]: JobLink[] } = {};
    jobLinks.forEach(link => {
      if (!groupedLinks[link.vinyl_id]) {
        groupedLinks[link.vinyl_id] = [];
      }
      groupedLinks[link.vinyl_id].push(link);
    });

    return groupedLinks;
  }

  /**
   * Update job links for a vinyl item
   */
  static async updateJobLinks(vinylId: number, jobIds: number[]): Promise<void> {
    // Start transaction
    await query('START TRANSACTION');

    try {
      // Delete existing links
      await query('DELETE FROM vinyl_job_links WHERE vinyl_id = ?', [vinylId]);

      // Insert new links
      if (jobIds.length > 0) {
        const insertSql = 'INSERT INTO vinyl_job_links (vinyl_id, job_id, sequence_order) VALUES ?';
        const values = jobIds.map((jobId, index) => [vinylId, jobId, index + 1]);
        await query(insertSql, [values]);
      }

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Delete job links for a vinyl item
   */
  static async deleteJobLinksForItem(vinylId: number): Promise<void> {
    await query('DELETE FROM vinyl_job_links WHERE vinyl_id = ?', [vinylId]);
  }

  /**
   * Get vinyl inventory statistics
   */
  static async getVinylStats(): Promise<any> {
    const sql = `
      SELECT
        COUNT(*) as total_items,
        SUM(CASE WHEN disposition = 'in_stock' THEN 1 ELSE 0 END) as in_stock_items,
        SUM(CASE WHEN disposition = 'used' THEN 1 ELSE 0 END) as used_items,
        SUM(CASE WHEN disposition = 'waste' THEN 1 ELSE 0 END) as waste_items,
        SUM(CASE WHEN disposition = 'returned' THEN 1 ELSE 0 END) as returned_items,
        SUM(length_yards) as total_yards,
        SUM(CASE WHEN disposition = 'in_stock' THEN length_yards ELSE 0 END) as in_stock_yards,
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
   * Generate next label ID (VIN-YYYY-###)
   */
  private static async generateLabelId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VIN-${year}-`;

    const sql = `
      SELECT label_id
      FROM vinyl_inventory
      WHERE label_id LIKE ?
      ORDER BY label_id DESC
      LIMIT 1
    `;

    const result = await query(sql, [`${prefix}%`]) as any[];

    let nextNumber = 1;
    if (result.length > 0) {
      const lastId = result[0].label_id;
      const match = lastId.match(/VIN-\d{4}-(\d{3})$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Check if vinyl item exists
   */
  static async vinylItemExists(id: number): Promise<boolean> {
    const sql = 'SELECT 1 FROM vinyl_inventory WHERE id = ? LIMIT 1';
    const result = await query(sql, [id]) as any[];
    return result.length > 0;
  }

  /**
   * Get vinyl items by disposition
   */
  static async getVinylItemsByDisposition(disposition: string): Promise<VinylItem[]> {
    return this.getVinylItems({ disposition: disposition as any });
  }

  /**
   * Mark vinyl as used with job associations
   */
  static async markVinylAsUsed(vinylId: number, usageData: {
    usage_user?: number;
    usage_note?: string;
    job_ids?: number[];
  }): Promise<void> {
    // Update vinyl item status
    const updateSql = `
      UPDATE vinyl_inventory
      SET disposition = 'used',
          usage_date = NOW(),
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

    // Update job associations if provided
    if (usageData.job_ids && usageData.job_ids.length > 0) {
      await this.updateJobLinks(vinylId, usageData.job_ids);
    }
  }
}