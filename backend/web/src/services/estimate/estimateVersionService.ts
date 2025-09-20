/**
 * Estimate Version Service
 *
 * Extracted from estimateService.ts during refactoring
 * Handles core estimate version lifecycle management
 *
 * Responsibilities:
 * - Version retrieval and creation
 * - Draft/final workflow management
 * - Edit permission validation
 */

import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { EstimateVersionData, EstimateFinalizationData } from '../../interfaces/estimateTypes';
import { JobCodeGenerator } from '../../utils/jobCodeGenerator';
import { EstimateDuplicationService } from './estimateDuplicationService';

export class EstimateVersionService {
  private duplicationService = new EstimateDuplicationService();

  // =============================================
  // VERSION RETRIEVAL AND CREATION
  // =============================================

  async getEstimateVersionsByJob(jobId: number): Promise<RowDataPacket[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT
          e.id,
          e.job_id,
          e.job_code,
          e.version_number,
          e.parent_estimate_id,
          pe.version_number as parent_version,
          e.is_draft,
          e.status,
          e.finalized_at,
          fu.username as finalized_by_name,
          e.subtotal,
          e.tax_amount,
          e.total_amount,
          e.created_at,
          e.updated_at,
          cu.username as created_by_name,
          e.is_sent,
          e.is_approved,
          e.is_retracted,
          j.job_name,
          j.job_number,
          c.company_name as customer_name
         FROM job_estimates e
         LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
         LEFT JOIN users fu ON e.finalized_by_user_id = fu.user_id
         LEFT JOIN users cu ON e.created_by = cu.user_id
         LEFT JOIN jobs j ON e.job_id = j.job_id
         LEFT JOIN customers c ON j.customer_id = c.customer_id
         WHERE e.job_id = ?
         ORDER BY e.version_number ASC`,
        [jobId]
      );

      return rows;
    } catch (error) {
      console.error('Service error fetching estimate versions:', error);
      throw new Error('Failed to fetch estimate versions');
    }
  }

  async createNewEstimateVersion(data: EstimateVersionData, userId: number, duplicateFromId?: number): Promise<number> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get next version number for this job
      const [versionRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM job_estimates WHERE job_id = ?',
        [data.job_id]
      );
      const nextVersion = versionRows[0].next_version;

      // Generate new job code with version
      const jobCode = JobCodeGenerator.generateVersionedJobCode(nextVersion);

      if (data.parent_estimate_id || duplicateFromId) {
        // Create version by duplicating existing estimate
        const sourceId = data.parent_estimate_id || duplicateFromId;
        const newEstimateId = await this.duplicationService.duplicateEstimate(
          connection,
          sourceId!,
          data.job_id,
          nextVersion,
          jobCode,
          userId
        );

        // No template creation here - handled by parent service

        await connection.commit();
        return newEstimateId;
      } else {
        // Create brand new estimate version
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO job_estimates (
            job_code, job_id, customer_id, version_number,
            is_draft, created_by, updated_by, notes
           )
           SELECT ?, ?, customer_id, ?, TRUE, ?, ?, ?
           FROM jobs WHERE job_id = ?`,
          [jobCode, data.job_id, nextVersion, userId, userId, data.notes || null, data.job_id]
        );

        // No template creation here - handled by parent service

        await connection.commit();
        return result.insertId;
      }
    } catch (error) {
      await connection.rollback();
      console.error('Service error creating estimate version:', error);
      throw new Error('Failed to create estimate version');
    } finally {
      connection.release();
    }
  }

  // =============================================
  // DRAFT/FINAL WORKFLOW
  // =============================================

  async saveDraft(estimateId: number, userId: number): Promise<void> {
    try {
      // Check if estimate is still a draft
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT is_draft FROM job_estimates WHERE id = ? AND is_draft = TRUE',
        [estimateId]
      );

      if (rows.length === 0) {
        throw new Error('Cannot save - estimate is already finalized');
      }

      // Update timestamp to show it was saved
      await pool.execute(
        'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, estimateId]
      );

    } catch (error) {
      console.error('Service error saving draft:', error);
      throw new Error('Failed to save draft');
    }
  }

  async finalizEstimate(estimateId: number, finalizationData: EstimateFinalizationData, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<void> {
    try {
      // Check if estimate is still a draft and get job info for multiple orders check
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT e.id, e.is_draft, e.job_id FROM job_estimates e WHERE e.id = ? AND e.is_draft = TRUE',
        [estimateId]
      );

      if (rows.length === 0) {
        throw new Error('Cannot finalize - estimate is already finalized or does not exist');
      }

      const jobId = rows[0].job_id;

      // Check for multiple orders scenario when finalizing as ordered
      if (finalizationData.status === 'ordered' && hasExistingOrdersCheck) {
        const hasExisting = await hasExistingOrdersCheck(jobId);
        if (hasExisting) {
          throw new Error('This job already has ordered estimates. Please use the multiple orders workflow to create a new job.');
        }
      }

      // Prepare status flag updates based on finalization type
      let statusUpdates = '';

      switch (finalizationData.status) {
        case 'sent':
          statusUpdates = ', is_sent = 1';
          break;
        case 'approved':
          statusUpdates = ', is_approved = 1';
          break;
        case 'ordered':
          statusUpdates = '';  // No additional flags for ordered
          break;
        case 'deactivated':
          statusUpdates = '';  // No additional flags for deactivated
          break;
      }

      // Finalize the estimate (make it immutable) with proper boolean flags
      await pool.execute(
        `UPDATE job_estimates
         SET status = ?,
             is_draft = FALSE,
             finalized_at = NOW(),
             finalized_by_user_id = ?,
             updated_by = ?
             ${statusUpdates}
         WHERE id = ?`,
        [finalizationData.status, userId, userId, estimateId]
      );

      // Update job status based on estimate status
      if (finalizationData.status === 'approved') {
        await pool.execute(
          `UPDATE jobs j
           JOIN job_estimates e ON j.job_id = e.job_id
           SET j.status = 'active'
           WHERE e.id = ?`,
          [estimateId]
        );
      } else if (finalizationData.status === 'ordered') {
        await pool.execute(
          `UPDATE jobs j
           JOIN job_estimates e ON j.job_id = e.job_id
           SET j.status = 'production'
           WHERE e.id = ?`,
          [estimateId]
        );
      }

    } catch (error) {
      console.error('Service error finalizing estimate:', error);
      throw new Error('Failed to finalize estimate');
    }
  }

  async canEditEstimate(estimateId: number): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT is_draft FROM job_estimates WHERE id = ?',
        [estimateId]
      );

      return rows.length > 0 && rows[0].is_draft === 1;
    } catch (error) {
      console.error('Service error checking edit permission:', error);
      return false;
    }
  }

}