// File Clean up Finished: Nov 13, 2025
import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Estimate Repository
 *
 * Handles database access for job_estimates table following 3-layer architecture.
 * Part of the estimate versioning system refactoring.
 *
 * Related:
 * - EstimateService: Business logic layer
 * - estimateController: HTTP request handling
 */
export class EstimateRepository {

  /**
   * Update estimate notes
   * @param estimateId - The estimate ID
   * @param notes - New notes content (null to clear)
   * @param userId - User making the update
   * @returns True if update successful
   */
  async updateEstimateNotes(estimateId: number, notes: string | null, userId: number): Promise<boolean> {
    const rows = await query(
      'UPDATE job_estimates SET notes = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [notes, userId, estimateId]
    ) as ResultSetHeader;

    return rows.affectedRows > 0;
  }

  /**
   * Get job ID associated with an estimate
   * @param estimateId - The estimate ID to lookup
   * @returns Job ID or null if estimate not found
   */
  async getJobIdByEstimateId(estimateId: number): Promise<number | null> {
    const rows = await query(
      'SELECT job_id FROM job_estimates WHERE id = ?',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].job_id : null;
  }

  /**
   * Check if estimate exists
   * @param estimateId - The estimate ID to check
   * @returns True if estimate exists
   */
  async estimateExists(estimateId: number): Promise<boolean> {
    const rows = await query(
      'SELECT id FROM job_estimates WHERE id = ?',
      [estimateId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }
}
