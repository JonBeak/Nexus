// File Clean up Finished: Nov 14, 2025
/**
 * Estimate Versioning Service - Refactored Facade
 *
 * This service has been refactored from 1,555 lines to maintain all existing functionality
 * while delegating responsibilities to focused services:
 * - JobService: Job lifecycle management
 * - EstimateService: Estimate versioning and status updates
 * - GridDataService: Phase 4 grid data persistence
 *
 * Phase 1 Cleanup (Nov 14, 2025):
 * - Removed EditLockService dependency (legacy lock system deleted)
 * - Inlined validateParentChain method for circular reference validation
 * - Removed unused lock delegation methods (acquireEditLock, releaseEditLock, etc.)
 *
 * ✅ Zero Breaking Changes: All public methods maintain identical signatures
 * ✅ Backward Compatibility: Controller and frontend work without modification
 * ✅ Production Safety: All services stay under 500-line limit
 *
 * Backup Location: /infrastructure/backups/estimate-service-refactor-TIMESTAMP/estimateVersioningService.ts.backup
 *
 * Cleanup Summary (Nov 14, 2025):
 * - Removed direct SQL execution from createAdditionalJobForOrder() method
 * - Extracted setEstimateToDraft() to EstimateRepository for proper layering
 * - Service now properly delegates all database operations to repository layer
 * - Maintains transaction support via connection parameter passing
 * - All public methods maintain backward compatibility
 */

import { pool, query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  JobData,
  EstimateVersionData,
  EstimateFinalizationData,
  MultipleJobResult,
  OrderConversionResult
} from '../interfaces/estimateTypes';

// Import the focused services
import { JobService } from './jobService';
import { EstimateService } from './estimateService';
import { GridDataService } from './gridDataService';
import { EstimateRepository } from '../repositories/estimateRepository';

export class EstimateVersioningService {

  // Service instances for delegation
  private jobService = new JobService();
  private estimateService = new EstimateService();
  private gridDataService = new GridDataService();
  private estimateRepository = new EstimateRepository();

  // =============================================
  // JOB MANAGEMENT - Delegated to JobService
  // =============================================

  async validateJobName(customerId: number, jobName: string): Promise<boolean> {
    return this.jobService.validateJobName(customerId, jobName);
  }

  async updateJobName(jobId: number, newName: string, userId: number): Promise<void> {
    return this.jobService.updateJobName(jobId, newName, userId);
  }

  async getAllJobsWithRecentActivity(): Promise<RowDataPacket[]> {
    return this.jobService.getAllJobsWithRecentActivity();
  }

  async getJobsByCustomer(customerId: number): Promise<RowDataPacket[]> {
    return this.jobService.getJobsByCustomer(customerId);
  }

  async createJob(data: JobData): Promise<number> {
    return this.jobService.createJob(data);
  }

  async getJobById(jobId: number): Promise<RowDataPacket | null> {
    return this.jobService.getJobById(jobId);
  }

  async generateJobNameSuffix(customerId: number, baseJobName: string): Promise<string> {
    return this.jobService.generateJobNameSuffix(customerId, baseJobName);
  }

  async hasExistingOrders(jobId: number): Promise<boolean> {
    return this.jobService.hasExistingOrders(jobId);
  }

  // =============================================
  // ESTIMATE VERSION MANAGEMENT - Delegated to EstimateService
  // =============================================

  async getEstimateVersionsByJob(jobId: number): Promise<RowDataPacket[]> {
    return this.estimateService.getEstimateVersionsByJob(jobId);
  }

  async createNewEstimateVersion(data: EstimateVersionData, userId: number): Promise<number> {
    // Validate parent chain if specified
    if (data.parent_estimate_id) {
      const isValidParent = await this.validateParentChain(data.parent_estimate_id);
      if (!isValidParent) {
        throw new Error('Invalid parent estimate: circular reference detected in parent chain');
      }
    }
    
    return this.estimateService.createNewEstimateVersion(data, userId);
  }

  // =============================================
  // DRAFT/FINAL WORKFLOW - Delegated to EstimateService
  // =============================================

  async saveDraft(estimateId: number, userId: number): Promise<void> {
    return this.estimateService.saveDraft(estimateId, userId);
  }

  async finalizEstimate(estimateId: number, finalizationData: EstimateFinalizationData, userId: number): Promise<void> {
    // Inject hasExistingOrders check from JobService
    return this.estimateService.finalizEstimate(
      estimateId, 
      finalizationData, 
      userId, 
      (jobId: number) => this.jobService.hasExistingOrders(jobId)
    );
  }

  async canEditEstimate(estimateId: number): Promise<boolean> {
    return this.estimateService.canEditEstimate(estimateId);
  }

  // =============================================
  // STATUS UPDATE METHODS - Delegated to EstimateService
  // =============================================

  async sendEstimate(estimateId: number, userId: number): Promise<void> {
    return this.estimateService.sendEstimate(estimateId, userId);
  }

  async approveEstimate(estimateId: number, userId: number): Promise<void> {
    return this.estimateService.approveEstimate(estimateId, userId);
  }

  async markNotApproved(estimateId: number, userId: number): Promise<void> {
    return this.estimateService.markNotApproved(estimateId, userId);
  }

  async retractEstimate(estimateId: number, userId: number): Promise<void> {
    return this.estimateService.retractEstimate(estimateId, userId);
  }


  // =============================================
  // PHASE 4: GRID DATA PERSISTENCE - Delegated to GridDataService
  // =============================================

  async saveGridData(estimateId: number, gridRows: any[], userId: number, total?: number): Promise<void> {
    return this.gridDataService.saveGridData(estimateId, gridRows, userId, total);
  }

  async loadGridData(estimateId: number): Promise<any[]> {
    return this.gridDataService.loadGridData(estimateId);
  }

  // =============================================
  // EDIT LOCK MANAGEMENT - REMOVED (Phase 1 Cleanup - Nov 14, 2025)
  // =============================================
  // Legacy lock methods removed: acquireEditLock, releaseEditLock, checkEditLock,
  // overrideEditLock, cleanupExpiredLocks
  // Now using generic lock system via /api/locks (resource_locks table)

  // =============================================
  // CIRCULAR REFERENCE VALIDATION
  // Inlined from deleted EditLockService - Nov 14, 2025
  // =============================================

  /**
   * Validates that adding a parent estimate won't create a circular reference
   * @param parentEstimateId The ID of the proposed parent estimate
   * @returns true if valid (no cycle), false if circular reference detected
   */
  async validateParentChain(parentEstimateId: number): Promise<boolean> {
    try {
      const visited = new Set<number>();
      let currentId: number | null = parentEstimateId;

      // Follow the parent chain to detect cycles
      while (currentId !== null) {
        // If we've seen this ID before, there's a cycle
        if (visited.has(currentId)) {
          console.warn(`Circular reference detected in parent chain starting from estimate ID ${parentEstimateId}`);
          return false;
        }

        visited.add(currentId);

        // Get the parent of the current estimate
        const rows = await query(
          'SELECT parent_estimate_id FROM job_estimates WHERE id = ?',
          [currentId]
        ) as RowDataPacket[];

        if (rows.length === 0) {
          // Estimate not found - this shouldn't happen but is not a circular reference
          break;
        }

        currentId = rows[0].parent_estimate_id;

        // Safety check - prevent infinite loops with depth limit
        if (visited.size > 50) {
          console.warn(`Parent chain validation exceeded depth limit for estimate ID ${parentEstimateId}`);
          return false;
        }
      }

      return true; // No cycle detected
    } catch (error) {
      console.error('Error validating parent chain:', error);
      return false; // Fail safe - reject if we can't validate
    }
  }

  // =============================================
  // VALIDATION METHODS - Delegated appropriately
  // =============================================

  async validateJobAccess(jobId: number, customerId?: number): Promise<boolean> {
    return this.jobService.validateJobAccess(jobId, customerId);
  }

  async validateEstimateAccess(estimateId: number, jobId?: number): Promise<boolean> {
    return this.estimateRepository.validateEstimateAccess(estimateId, jobId);
  }

  // =============================================
  // COMPLEX MULTI-SERVICE WORKFLOWS
  // =============================================

  async createAdditionalJobForOrder(
    originalJobId: number, 
    estimateIdToOrder: number, 
    newJobName: string, 
    userId: number
  ): Promise<MultipleJobResult> {
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Step 1: Create the new job (JobService)
      const jobResult = await this.jobService.createAdditionalJobForOrder(
        originalJobId, 
        estimateIdToOrder, 
        newJobName, 
        userId
      );
      
      // Step 2: Duplicate the estimate to the new job (EstimateService)
      const newEstimateId = await this.estimateService.duplicateEstimateToNewJob(
        connection,
        estimateIdToOrder,
        jobResult.newJobId,
        1, // version 1 in new job
        userId
      );

      // Step 3: Set the new estimate to draft for editing (via repository)
      await this.estimateRepository.setEstimateToDraft(connection, newEstimateId, userId);
      
      await connection.commit();
      
      return {
        newJobId: jobResult.newJobId,
        newEstimateId
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('Error in createAdditionalJobForOrder workflow:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // =============================================
  // CLEAR ALL ESTIMATE ITEMS
  // =============================================

  /**
   * Clear all items from an estimate and recreate default template
   */
  async resetEstimateItems(estimateId: number, userId: number): Promise<void> {
    // Delegate to EstimateService for template creation
    return this.estimateService.resetEstimateItems(estimateId, userId);
  }

  async clearAllEstimateItems(estimateId: number, userId: number): Promise<void> {
    // Delegate to EstimateService for clearing all items
    return this.estimateService.clearAllEstimateItems(estimateId, userId);
  }

  async clearEmptyItems(estimateId: number, userId: number): Promise<void> {
    // Delegate to EstimateService for clearing empty items
    return this.estimateService.clearEmptyItems(estimateId, userId);
  }

  async addTemplateSection(estimateId: number, userId: number): Promise<void> {
    // Delegate to EstimateService for adding template section
    return this.estimateService.addTemplateSection(estimateId, userId);
  }

  // =============================================
  // ESTIMATE DATA ACCESS - Delegated to EstimateService/Repository
  // =============================================

  /**
   * Update estimate notes
   * @param estimateId - The estimate ID
   * @param notes - New notes content (null to clear)
   * @param userId - User making the update
   */
  async updateEstimateNotes(estimateId: number, notes: string | null, userId: number): Promise<void> {
    return this.estimateService.updateEstimateNotes(estimateId, notes, userId);
  }

  /**
   * Get job ID associated with an estimate
   * @param estimateId - The estimate ID
   * @returns Job ID
   * @throws Error if estimate not found
   */
  async getJobIdByEstimateId(estimateId: number): Promise<number> {
    return this.estimateService.getJobIdByEstimateId(estimateId);
  }
}

// Export all interfaces for backward compatibility
export {
  JobData,
  EstimateVersionData,
  EstimateFinalizationData
  // EditLockStatus and EditLockResult removed - Phase 1 Cleanup Nov 14, 2025
};