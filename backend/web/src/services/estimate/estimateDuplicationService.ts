/**
 * Estimate Duplication Service
 *
 * Extracted from estimateService.ts during refactoring
 * Handles estimate duplication and copying logic
 *
 * File Clean up Finished: Nov 14, 2025 (Re-cleaned same day)
 * Changes:
 *   - Removed legacy duplicateLegacyData() method (job_estimate_groups table dropped)
 *   - Removed conditional logic in duplicateEstimateData() - always uses Phase 4
 *   - Simplified to only support grid-based duplication
 *   - Removed unused pool import (standardization - Nov 14, 2025)
 *
 * Responsibilities:
 * - Estimate duplication within same job
 * - Cross-job estimate copying
 * - Grid-based data structure handling (Phase 4+)
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { JobCodeGenerator } from '../../utils/jobCodeGenerator';
import { EstimateRepository } from '../../repositories/estimateRepository';

export class EstimateDuplicationService {
  private estimateRepository = new EstimateRepository();

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
    userId: number,
    notes?: string
  ): Promise<number> {
    try {
      // Validate source estimate exists
      if (!(await this.estimateRepository.estimateExists(sourceEstimateId))) {
        throw new Error('Source estimate not found');
      }

      // Create new estimate record
      const [result] = await connection.execute(
        `INSERT INTO job_estimates (
          job_code, job_id, customer_id, version_number, parent_estimate_id,
          subtotal, tax_rate, tax_amount, total_amount, notes,
          created_by, updated_by, is_draft
         )
         SELECT ?, ?, customer_id, ?, ?, subtotal, tax_rate, tax_amount, total_amount, ?, ?, ?, TRUE
         FROM job_estimates
         WHERE id = ?`,
        [jobCode, jobId, version, sourceEstimateId, notes || null, userId, userId, sourceEstimateId]
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
   * Duplicates estimate data (items) from source to target estimate
   * Uses grid-based structure (Phase 4+)
   */
  private async duplicateEstimateData(connection: any, sourceEstimateId: number, newEstimateId: number): Promise<void> {
    try {
      // Duplicate grid data directly (no groups)
      await this.duplicatePhase4Data(connection, sourceEstimateId, newEstimateId);
    } catch (error) {
      console.error('Error duplicating estimate data:', error);
      throw new Error('Failed to duplicate estimate data');
    }
  }

  /**
   * Duplicates grid-based estimate data (direct item structure)
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
}
