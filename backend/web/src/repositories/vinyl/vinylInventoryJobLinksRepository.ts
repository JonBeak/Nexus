// File Clean up Finished: 2025-11-15
/**
 * Vinyl Inventory Job Links Repository
 * Data access layer for vinyl-to-job associations
 *
 * Created: 2025-11-15
 * Extracted from vinylInventoryRepository during refactoring to reduce file size
 *
 * Handles:
 * - Fetching job associations for vinyl items (optimized to prevent N+1 queries)
 * - Creating/updating job links with sequence ordering
 * - Deleting job associations
 *
 * Database Tables:
 * - vinyl_job_links: Many-to-many relationship between vinyl_inventory and jobs
 *   - vinyl_id: FK to vinyl_inventory.id
 *   - job_id: FK to jobs.job_id
 *   - sequence_order: Display order for multi-job associations
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../../config/database';
import { JobLink } from '../../types/vinyl';

export class VinylInventoryJobLinksRepository {
  /**
   * Get job links for multiple vinyl items (optimized to fix N+1 problem)
   *
   * Instead of querying once per vinyl item, fetches all associations
   * in a single query and groups them by vinyl_id
   *
   * @param vinylIds - Array of vinyl inventory IDs
   * @returns Object mapping vinyl_id to array of job links
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
   *
   * Replaces all existing job associations with new set
   * Maintains sequence order for display purposes
   *
   * @param vinylId - Vinyl inventory ID
   * @param jobIds - Array of job IDs to associate
   */
  static async updateJobLinks(vinylId: number, jobIds: number[]): Promise<void> {
    try {
      // Delete existing links first
      await query('DELETE FROM vinyl_job_links WHERE vinyl_id = ?', [vinylId]);

      // Insert new links with sequence order
      if (jobIds.length > 0) {
        const insertPromises = jobIds.map((jobId, index) =>
          query('INSERT INTO vinyl_job_links (vinyl_id, job_id, sequence_order) VALUES (?, ?, ?)',
                [vinylId, jobId, index + 1])
        );
        await Promise.all(insertPromises);
      }
    } catch (error) {
      console.error('Error updating job links:', error);
      throw error;
    }
  }

  /**
   * Delete all job links for a vinyl item
   *
   * Called when deleting vinyl inventory item to clean up associations
   *
   * @param vinylId - Vinyl inventory ID
   */
  static async deleteJobLinksForItem(vinylId: number): Promise<void> {
    await query('DELETE FROM vinyl_job_links WHERE vinyl_id = ?', [vinylId]);
  }
}
