/**
 * Vinyl Inventory Order Links Repository
 * Data access layer for vinyl-to-order associations
 *
 * Created: 2025-01-28
 * Replaces vinylInventoryJobLinksRepository - vinyl is now associated with orders (production) not jobs (estimates)
 *
 * Handles:
 * - Fetching order associations for vinyl items (optimized to prevent N+1 queries)
 * - Creating/updating order links with sequence ordering
 * - Deleting order associations
 *
 * Database Tables:
 * - vinyl_order_links: Many-to-many relationship between vinyl_inventory and orders
 *   - vinyl_id: FK to vinyl_inventory.id
 *   - order_id: FK to orders.order_id
 *   - sequence_order: Display order for multi-order associations
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../../config/database';
import { OrderLink } from '../../types/vinyl';

export class VinylInventoryOrderLinksRepository {
  /**
   * Get order links for multiple vinyl items (optimized to fix N+1 problem)
   *
   * Instead of querying once per vinyl item, fetches all associations
   * in a single query and groups them by vinyl_id
   *
   * @param vinylIds - Array of vinyl inventory IDs
   * @returns Object mapping vinyl_id to array of order links
   */
  static async getOrderLinksForItems(vinylIds: number[]): Promise<{ [vinylId: number]: OrderLink[] }> {
    if (vinylIds.length === 0) {
      return {};
    }

    const placeholders = vinylIds.map(() => '?').join(',');
    const sql = `
      SELECT
        vol.link_id,
        vol.vinyl_id,
        vol.order_id,
        vol.sequence_order,
        vol.created_at,
        o.order_number,
        o.order_name,
        c.company_name as customer_name
      FROM vinyl_order_links vol
      JOIN orders o ON vol.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE vol.vinyl_id IN (${placeholders})
      ORDER BY vol.vinyl_id, vol.sequence_order
    `;

    const orderLinks = await query(sql, vinylIds) as OrderLink[];

    // Group by vinyl_id
    const groupedLinks: { [vinylId: number]: OrderLink[] } = {};
    orderLinks.forEach(link => {
      if (!groupedLinks[link.vinyl_id]) {
        groupedLinks[link.vinyl_id] = [];
      }
      groupedLinks[link.vinyl_id].push(link);
    });

    return groupedLinks;
  }

  /**
   * Update order links for a vinyl item
   *
   * Replaces all existing order associations with new set
   * Maintains sequence order for display purposes
   *
   * @param vinylId - Vinyl inventory ID
   * @param orderIds - Array of order IDs to associate
   */
  static async updateOrderLinks(vinylId: number, orderIds: number[]): Promise<void> {
    try {
      // Delete existing links first
      await query('DELETE FROM vinyl_order_links WHERE vinyl_id = ?', [vinylId]);

      // Insert new links with sequence order
      if (orderIds.length > 0) {
        const insertPromises = orderIds.map((orderId, index) =>
          query('INSERT INTO vinyl_order_links (vinyl_id, order_id, sequence_order) VALUES (?, ?, ?)',
                [vinylId, orderId, index + 1])
        );
        await Promise.all(insertPromises);
      }
    } catch (error) {
      console.error('Error updating order links:', error);
      throw error;
    }
  }

  /**
   * Delete all order links for a vinyl item
   *
   * Called when deleting vinyl inventory item to clean up associations
   *
   * @param vinylId - Vinyl inventory ID
   */
  static async deleteOrderLinksForItem(vinylId: number): Promise<void> {
    await query('DELETE FROM vinyl_order_links WHERE vinyl_id = ?', [vinylId]);
  }
}
