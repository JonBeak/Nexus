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
 *
 * Refactored: Nov 14, 2025 (Phase 2: Architectural refactoring)
 * Changes:
 *   - Removed all direct pool.execute() calls
 *   - Database queries moved to estimateRepository
 *   - Maintained transaction support
 */

import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { EstimateVersionData, EstimateFinalizationData } from '../../interfaces/estimateTypes';
import { JobCodeGenerator } from '../../utils/jobCodeGenerator';
import { EstimateDuplicationService } from './estimateDuplicationService';
import { EstimateRepository } from '../../repositories/estimateRepository';

export class EstimateVersionService {
  private duplicationService = new EstimateDuplicationService();
  private estimateRepository = new EstimateRepository();

  // =============================================
  // VERSION RETRIEVAL AND CREATION
  // =============================================

  async getEstimateVersionsByJob(jobId: number): Promise<RowDataPacket[]> {
    try {
      return await this.estimateRepository.getEstimateVersionsByJobId(jobId);
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
      const nextVersion = await this.estimateRepository.getNextVersionNumber(data.job_id, connection);

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
          userId,
          data.notes
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
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Check if estimate is still a draft
      const isDraft = await this.estimateRepository.checkEstimateIsDraft(estimateId);

      if (!isDraft) {
        throw new Error('Cannot save - estimate is already finalized');
      }

      // Update timestamp to show it was saved
      await this.estimateRepository.updateEstimateDraftTimestamp(estimateId, userId);

    } catch (error) {
      console.error('Service error saving draft:', error);
      throw new Error('Failed to save draft');
    }
  }

  async finalizEstimate(estimateId: number, finalizationData: EstimateFinalizationData, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<void> {
    try {
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Check if estimate is still a draft and get job info for multiple orders check
      const estimate = await this.estimateRepository.getEstimateWithJobId(estimateId);

      if (!estimate) {
        throw new Error('Cannot finalize - estimate is already finalized');
      }

      const jobId = estimate.job_id;

      // Check for multiple orders scenario when finalizing as ordered
      if (finalizationData.status === 'ordered' && hasExistingOrdersCheck) {
        const hasExisting = await hasExistingOrdersCheck(jobId);
        if (hasExisting) {
          throw new Error('This job already has ordered estimates. Please use the multiple orders workflow to create a new job.');
        }
      }

      // Prepare status flags based on finalization type
      const statusFlags: { is_sent?: boolean; is_approved?: boolean } = {};

      switch (finalizationData.status) {
        case 'sent':
          statusFlags.is_sent = true;
          break;
        case 'approved':
          statusFlags.is_approved = true;
          break;
        case 'ordered':
          // No additional flags for ordered
          break;
        case 'deactivated':
          // No additional flags for deactivated
          break;
      }

      // Finalize the estimate (make it immutable) with proper boolean flags
      await this.estimateRepository.updateEstimateFinalization(
        estimateId,
        finalizationData.status,
        userId,
        statusFlags
      );

      // Update job status based on estimate status
      if (finalizationData.status === 'approved') {
        await this.estimateRepository.updateJobStatusByEstimate(estimateId, 'active');
      } else if (finalizationData.status === 'ordered') {
        await this.estimateRepository.updateJobStatusByEstimate(estimateId, 'production');
      }

    } catch (error) {
      console.error('Service error finalizing estimate:', error);
      throw new Error('Failed to finalize estimate');
    }
  }

  async canEditEstimate(estimateId: number): Promise<boolean> {
    try {
      // Check existence first
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        return false;
      }

      return await this.estimateRepository.checkEstimateIsDraft(estimateId);
    } catch (error) {
      console.error('Service error checking edit permission:', error);
      return false;
    }
  }

}
