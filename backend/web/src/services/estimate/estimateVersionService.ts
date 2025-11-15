// File Clean up Finished: 2025-11-15
// Changes:
//   - Migrated createNewEstimateVersion() to use repository method
//   - Removed direct connection.execute() call (architectural violation)
//   - Removed unused ResultSetHeader import
//   - All SQL queries now properly delegated to repository layer
//   - Maintains transaction orchestration at service level

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
import { RowDataPacket } from 'mysql2';
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

      // Get current date for job code
      const dateStr = JobCodeGenerator.getCurrentDateString();

      // Get next sequence number for today (transaction-safe)
      const sequence = await this.estimateRepository.getNextSequenceForDate(connection, dateStr);

      // Generate new job code with sequence and version
      const jobCode = JobCodeGenerator.generateVersionedJobCode(dateStr, sequence, nextVersion);

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
        const newEstimateId = await this.estimateRepository.createNewEstimateVersion(
          connection,
          jobCode,
          data.job_id,
          nextVersion,
          userId,
          data.notes
        );

        // No template creation here - handled by parent service

        await connection.commit();
        return newEstimateId;
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

      // Prepare status flags based on finalization type
      const statusFlags: { is_sent?: boolean; is_approved?: boolean } = {};

      switch (finalizationData.status) {
        case 'sent':
          statusFlags.is_sent = true;
          break;
        case 'approved':
          statusFlags.is_approved = true;
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
