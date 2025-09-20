/**
 * Estimate Duplication Service
 *
 * Extracted from estimateService.ts during refactoring
 * Handles estimate duplication and copying logic
 *
 * Responsibilities:
 * - Estimate duplication within same job
 * - Cross-job estimate copying
 * - Legacy and Phase 4 data structure handling
 */

import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { JobCodeGenerator } from '../../utils/jobCodeGenerator';

export class EstimateDuplicationService {

  // =============================================
  // ESTIMATE DUPLICATION METHODS
  // =============================================

  async duplicateEstimateToNewJob(
    connection: any,
    sourceEstimateId: number,
    targetJobId: number,
    targetVersion: number,
    userId: number
  ): Promise<number> {
    // Get source estimate data
    const [sourceRows] = await connection.execute(
      `SELECT * FROM job_estimates WHERE id = ?`,
      [sourceEstimateId]
    ) as [RowDataPacket[]];

    if (sourceRows.length === 0) {
      throw new Error('Source estimate not found');
    }

    const source = sourceRows[0];

    // Generate new job code for the target version
    const newJobCode = JobCodeGenerator.generateVersionedJobCode(targetVersion);

    // Create new estimate in target job
    const [newEstimateResult] = await connection.execute(
      `INSERT INTO job_estimates (
        job_code, job_id, customer_id, version_number, parent_estimate_id,
        subtotal, tax_rate, tax_amount, total_amount, notes,
        created_by, updated_by, is_draft
       )
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        newJobCode, targetJobId, source.customer_id, targetVersion,
        source.subtotal, source.tax_rate, source.tax_amount, source.total_amount, source.notes,
        userId, userId
      ]
    ) as [ResultSetHeader];

    const newEstimateId = newEstimateResult.insertId;

    // Duplicate the estimate items and groups
    await this.duplicateEstimateData(connection, sourceEstimateId, newEstimateId);

    return newEstimateId;
  }

  async duplicateEstimate(
    connection: any,
    sourceEstimateId: number,
    jobId: number,
    version: number,
    jobCode: string,
    userId: number
  ): Promise<number> {
    try {
      // Create new estimate record
      const [result] = await connection.execute(
        `INSERT INTO job_estimates (
          job_code, job_id, customer_id, version_number, parent_estimate_id,
          subtotal, tax_rate, tax_amount, total_amount, notes,
          created_by, updated_by, is_draft
         )
         SELECT ?, ?, customer_id, ?, ?, subtotal, tax_rate, tax_amount, total_amount, notes, ?, ?, TRUE
         FROM job_estimates
         WHERE id = ?`,
        [jobCode, jobId, version, sourceEstimateId, userId, userId, sourceEstimateId]
      ) as [ResultSetHeader];

      const newEstimateId = result.insertId;

      // Duplicate the estimate items and groups
      await this.duplicateEstimateData(connection, sourceEstimateId, newEstimateId);

      return newEstimateId;
    } catch (error) {
      console.error('Error duplicating estimate:', error);
      throw new Error('Failed to duplicate estimate');
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  /**
   * Duplicates estimate data (items and groups) from source to target estimate
   * Handles both Phase 4 (job_estimate_items) and legacy (groups-based) structures
   */
  private async duplicateEstimateData(connection: any, sourceEstimateId: number, newEstimateId: number): Promise<void> {
    try {
      // Check if source estimate has Phase 4 grid data (job_estimate_items with estimate_id)
      const [phase4Items] = await connection.execute(
        `SELECT COUNT(*) as count FROM job_estimate_items WHERE estimate_id = ?`,
        [sourceEstimateId]
      ) as [RowDataPacket[]];

      if (phase4Items[0].count > 0) {
        // NEW: Phase 4 duplication - copy items directly with preserved item_index
        await this.duplicatePhase4Data(connection, sourceEstimateId, newEstimateId);
      } else {
        // Legacy duplication for old estimates with groups
        await this.duplicateLegacyData(connection, sourceEstimateId, newEstimateId);
      }
    } catch (error) {
      console.error('Error duplicating estimate data:', error);
      throw new Error('Failed to duplicate estimate data');
    }
  }

  /**
   * Duplicates Phase 4 estimate data (direct item structure)
   */
  private async duplicatePhase4Data(connection: any, sourceEstimateId: number, newEstimateId: number): Promise<void> {
    await connection.execute(
      `INSERT INTO job_estimate_items (
        estimate_id, assembly_group_id, parent_item_id,
        product_type_id, item_name, item_order, item_index, grid_data,
        unit_price, extended_price, customer_description, internal_notes
       )
       SELECT
        ?, assembly_group_id, parent_item_id,
        product_type_id, item_name, item_order, item_index, grid_data,
        unit_price, extended_price, customer_description, internal_notes
       FROM job_estimate_items
       WHERE estimate_id = ?
       ORDER BY item_order`,
      [newEstimateId, sourceEstimateId]
    );
  }

  /**
   * Duplicates legacy estimate data (group-based structure)
   */
  private async duplicateLegacyData(connection: any, sourceEstimateId: number, newEstimateId: number): Promise<void> {
    // First, duplicate groups
    await connection.execute(
      `INSERT INTO job_estimate_groups (estimate_id, group_name, assembly_cost, assembly_description, group_order)
       SELECT ?, group_name, assembly_cost, assembly_description, group_order
       FROM job_estimate_groups
       WHERE estimate_id = ?`,
      [newEstimateId, sourceEstimateId]
    );

    // Then, duplicate items (legacy group-based approach)
    await connection.execute(
      `INSERT INTO job_estimate_items (
        group_id, product_type_id, item_name, customer_description,
        internal_notes, unit_price, extended_price, item_order
       )
       SELECT
        ng.id, i.product_type_id, i.item_name, i.customer_description,
        i.internal_notes, i.unit_price, i.extended_price, i.item_order
       FROM job_estimate_items i
       JOIN job_estimate_groups og ON i.group_id = og.id
       JOIN job_estimate_groups ng ON ng.estimate_id = ? AND ng.group_order = og.group_order
       WHERE og.estimate_id = ?`,
      [newEstimateId, sourceEstimateId]
    );
  }
}
