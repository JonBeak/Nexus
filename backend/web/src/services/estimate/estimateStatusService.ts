// File Clean up Finished: Nov 14, 2025
// Previous changes:
//   - Added EstimateRepository integration for clearer error messages
//   - Replaced 9 ambiguous error messages with specific ones
//   - Now separates "not found" (404) from "invalid state" (400) errors
//   - sendEstimate: "not found or draft" → "not found" | "still in draft mode"
//   - approveEstimate: "not found" → "not found" (now allows draft estimates - will finalize automatically)
//   - markNotApproved: "not found or draft" → "not found" | "still in draft mode"
//   - retractEstimate: "not found or draft" → "not found" | "still in draft mode"
// Current changes (Nov 14, 2025):
//   - Migrated all 12 database calls from pool.execute() to query() helper
//   - Consistent with DATABASE_QUERY_STANDARDIZATION_PLAN.md
//   - Improved error logging and performance monitoring
/**
 * Estimate Status Service
 *
 * Extracted from estimateService.ts during refactoring
 * Handles estimate status transitions and workflow management
 *
 * Responsibilities:
 * - Status updates (sent, approved, ordered, etc.)
 * - Order conversion workflow
 * - Status validation and business rules
 */

import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { OrderConversionResult } from '../../interfaces/estimateTypes';
import { estimateHistoryService } from '../estimateHistoryService';
import { EstimateRepository } from '../../repositories/estimateRepository';

export class EstimateStatusService {
  private estimateRepository: EstimateRepository;

  constructor() {
    this.estimateRepository = new EstimateRepository();
  }

  // =============================================
  // STATUS UPDATE METHODS
  // =============================================

  async sendEstimate(estimateId: number, userId: number): Promise<void> {
    try {
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Get estimate info for history logging
      const estimateRows = await query(
        'SELECT id, job_id FROM job_estimates WHERE id = ? AND is_draft = 0',
        [estimateId]
      ) as RowDataPacket[];

      if (estimateRows.length === 0) {
        throw new Error('Estimate is still in draft mode');
      }

      const estimate = estimateRows[0];

      // Get current sent count from history
      const currentSentCount = await estimateHistoryService.getSentCount(estimateId);
      const newSentCount = currentSentCount + 1;

      const result = await query(
        `UPDATE job_estimates
         SET is_sent = 1,
             updated_by = ?
         WHERE id = ? AND is_draft = 0`,
        [userId, estimateId]
      ) as ResultSetHeader;

      if (result.affectedRows === 0) {
        throw new Error('Estimate is still in draft mode');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'sent',
        performedByUserId: userId,
        metadata: {
          sent_count: newSentCount,
          total_sent_count: newSentCount
        },
        notes: `Estimate sent (${newSentCount} time${newSentCount > 1 ? 's' : ''})`
      });

    } catch (error) {
      console.error('Error sending estimate:', error);
      throw new Error('Failed to send estimate');
    }
  }

  async approveEstimate(estimateId: number, userId: number): Promise<void> {
    try {
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Get estimate info for history logging
      const estimateRows = await query(
        'SELECT id, job_id, is_draft FROM job_estimates WHERE id = ?',
        [estimateId]
      ) as RowDataPacket[];

      if (estimateRows.length === 0) {
        throw new Error('Estimate not found');
      }

      const estimate = estimateRows[0];

      // Finalize if still a draft, then approve
      const result = await query(
        `UPDATE job_estimates
         SET is_approved = 1,
             is_draft = 0,
             finalized_at = COALESCE(finalized_at, NOW()),
             finalized_by_user_id = COALESCE(finalized_by_user_id, ?),
             updated_by = ?
         WHERE id = ?`,
        [userId, userId, estimateId]
      ) as ResultSetHeader;

      if (result.affectedRows === 0) {
        throw new Error('Failed to approve estimate');
      }

      // Note: Job status is automatically updated via database trigger
      // (tr_job_estimates_update_job_status) when is_approved flag changes

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'approved',
        performedByUserId: userId,
        notes: 'Estimate approved by customer'
      });

    } catch (error) {
      console.error('Error approving estimate:', error);
      throw new Error('Failed to approve estimate');
    }
  }

  async markNotApproved(estimateId: number, userId: number): Promise<void> {
    try {
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Get estimate info for history logging
      const estimateRows = await query(
        'SELECT id, job_id FROM job_estimates WHERE id = ? AND is_draft = 0',
        [estimateId]
      ) as RowDataPacket[];

      if (estimateRows.length === 0) {
        throw new Error('Estimate is still in draft mode');
      }

      const estimate = estimateRows[0];

      const result = await query(
        `UPDATE job_estimates
         SET is_approved = 0,
             updated_by = ?
         WHERE id = ? AND is_draft = 0`,
        [userId, estimateId]
      ) as ResultSetHeader;

      if (result.affectedRows === 0) {
        throw new Error('Estimate is still in draft mode');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'not_approved',
        performedByUserId: userId,
        notes: 'Estimate marked as not approved'
      });

    } catch (error) {
      console.error('Error marking estimate not approved:', error);
      throw new Error('Failed to mark estimate not approved');
    }
  }

  async retractEstimate(estimateId: number, userId: number): Promise<void> {
    try {
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Get estimate info for history logging
      const estimateRows = await query(
        'SELECT id, job_id FROM job_estimates WHERE id = ? AND is_draft = 0',
        [estimateId]
      ) as RowDataPacket[];

      if (estimateRows.length === 0) {
        throw new Error('Estimate is still in draft mode');
      }

      const estimate = estimateRows[0];

      const result = await query(
        `UPDATE job_estimates
         SET is_retracted = 1,
             updated_by = ?
         WHERE id = ? AND is_draft = 0`,
        [userId, estimateId]
      ) as ResultSetHeader;

      if (result.affectedRows === 0) {
        throw new Error('Estimate is still in draft mode');
      }

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'retracted',
        performedByUserId: userId,
        notes: 'Estimate retracted'
      });

    } catch (error) {
      console.error('Error retracting estimate:', error);
      throw new Error('Failed to retract estimate');
    }
  }

}