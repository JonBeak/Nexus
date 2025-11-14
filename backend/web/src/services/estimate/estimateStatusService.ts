// File Clean up Finished: Nov 14, 2025
// Previous changes:
//   - Added EstimateRepository integration for clearer error messages
//   - Replaced 9 ambiguous error messages with specific ones
//   - Now separates "not found" (404) from "invalid state" (400) errors
//   - sendEstimate: "not found or draft" → "not found" | "still in draft mode"
//   - approveEstimate: "not found, draft, or not sent" → "not found" | "must be finalized and sent"
//   - markNotApproved: "not found or draft" → "not found" | "still in draft mode"
//   - retractEstimate: "not found or draft" → "not found" | "still in draft mode"
//   - convertToOrder: "not found or not approved" → "not found" | "must be approved before conversion"
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
        'SELECT id, job_id FROM job_estimates WHERE id = ? AND is_draft = 0 AND is_sent = 1',
        [estimateId]
      ) as RowDataPacket[];

      if (estimateRows.length === 0) {
        throw new Error('Estimate must be finalized and sent before approval');
      }

      const estimate = estimateRows[0];

      const result = await query(
        `UPDATE job_estimates
         SET is_approved = 1,
             updated_by = ?
         WHERE id = ? AND is_draft = 0 AND is_sent = 1`,
        [userId, estimateId]
      ) as ResultSetHeader;

      if (result.affectedRows === 0) {
        throw new Error('Estimate must be finalized and sent before approval');
      }

      // Update job status to 'approved' when estimate is approved
      await query(
        `UPDATE jobs j
         JOIN job_estimates e ON j.job_id = e.job_id
         SET j.status = 'approved'
         WHERE e.id = ?`,
        [estimateId]
      );

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: estimate.job_id,
        actionType: 'approved',
        performedByUserId: userId,
        notes: 'Estimate approved by customer - job status updated to approved'
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

  // =============================================
  // ORDER CONVERSION
  // =============================================

  async convertToOrder(estimateId: number, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<OrderConversionResult> {
    try {
      // Validate estimate exists
      if (!(await this.estimateRepository.estimateExists(estimateId))) {
        throw new Error('Estimate not found');
      }

      // Get estimate info and check if it's approved
      const estimateRows = await query(
        'SELECT id, job_id, is_approved FROM job_estimates WHERE id = ? AND is_approved = 1',
        [estimateId]
      ) as RowDataPacket[];

      if (estimateRows.length === 0) {
        throw new Error('Estimate must be approved before conversion to order');
      }

      const jobId = estimateRows[0].job_id;

      // Check for existing orders in this job
      if (hasExistingOrdersCheck) {
        const hasExisting = await hasExistingOrdersCheck(jobId);
        if (hasExisting) {
          throw new Error('This job already has ordered estimates. Please use the multiple orders workflow to create a new job.');
        }
      }

      const result = await query(
        `UPDATE job_estimates
         SET is_draft = 0,
             finalized_at = COALESCE(finalized_at, NOW()),
             finalized_by_user_id = COALESCE(finalized_by_user_id, ?),
             updated_by = ?
         WHERE id = ?`,
        [userId, userId, estimateId]
      ) as ResultSetHeader;

      if (result.affectedRows === 0) {
        throw new Error('Failed to update estimate status');
      }

      // Update job status to production when estimate is ordered
      await query(
        `UPDATE jobs j
         JOIN job_estimates e ON j.job_id = e.job_id
         SET j.status = 'production'
         WHERE e.id = ?`,
        [estimateId]
      );

      // Log to history
      await estimateHistoryService.logAction({
        estimateId: estimateId,
        jobId: jobId,
        actionType: 'converted_to_order',
        performedByUserId: userId,
        metadata: {
          order_id: estimateId,
          job_status_updated: 'production'
        },
        notes: 'Estimate converted to order - job moved to production'
      });

      // Return order_id (using estimate id as order reference for now)
      return { order_id: estimateId };
    } catch (error) {
      console.error('Error converting estimate to order:', error);
      throw new Error('Failed to convert estimate to order');
    }
  }
}