/**
 * Estimate Service - Refactored Facade
 *
 * This service has been refactored from 1,167 lines to maintain all existing functionality
 * while delegating responsibilities to focused services:
 * - EstimateVersionService: Version lifecycle management
 * - EstimateStatusService: Status transitions and workflow
 * - EstimateTemplateService: Template creation and item management
 * - EstimateDuplicationService: Estimate copying logic
 *
 * ✅ Zero Breaking Changes: All public methods maintain identical signatures
 * ✅ Backward Compatibility: Controllers work without modification
 * ✅ Production Safety: All services stay under 500-line limit
 */

import { RowDataPacket } from 'mysql2';
import { EstimateVersionData, EstimateFinalizationData, OrderConversionResult } from '../interfaces/estimateTypes';

// Import the focused services
import { EstimateVersionService } from './estimate/estimateVersionService';
import { EstimateStatusService } from './estimate/estimateStatusService';
import { EstimateTemplateService } from './estimate/estimateTemplateService';
import { EstimateDuplicationService } from './estimate/estimateDuplicationService';

export class EstimateService {

  // Service instances for delegation
  private versionService = new EstimateVersionService();
  private statusService = new EstimateStatusService();
  private templateService = new EstimateTemplateService();
  private duplicationService = new EstimateDuplicationService();

  // =============================================
  // ESTIMATE VERSION MANAGEMENT - Delegated to EstimateVersionService
  // =============================================

  async getEstimateVersionsByJob(jobId: number): Promise<RowDataPacket[]> {
    return this.versionService.getEstimateVersionsByJob(jobId);
  }

  async createNewEstimateVersion(data: EstimateVersionData, userId: number): Promise<number> {
    // Create the version first
    const estimateId = await this.versionService.createNewEstimateVersion(data, userId);

    // If this is not a duplication, add template rows
    if (!data.parent_estimate_id) {
      await this.templateService.resetEstimateItems(estimateId, userId);
    }

    return estimateId;
  }

  // =============================================
  // DRAFT/FINAL WORKFLOW - Delegated to EstimateVersionService
  // =============================================

  async saveDraft(estimateId: number, userId: number): Promise<void> {
    return this.versionService.saveDraft(estimateId, userId);
  }

  async finalizEstimate(estimateId: number, finalizationData: EstimateFinalizationData, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<void> {
    return this.versionService.finalizEstimate(estimateId, finalizationData, userId, hasExistingOrdersCheck);
  }

  async canEditEstimate(estimateId: number): Promise<boolean> {
    return this.versionService.canEditEstimate(estimateId);
  }

  // =============================================
  // STATUS UPDATE METHODS - Delegated to EstimateStatusService
  // =============================================

  async sendEstimate(estimateId: number, userId: number): Promise<void> {
    return this.statusService.sendEstimate(estimateId, userId);
  }

  async approveEstimate(estimateId: number, userId: number): Promise<void> {
    return this.statusService.approveEstimate(estimateId, userId);
  }

  async markNotApproved(estimateId: number, userId: number): Promise<void> {
    return this.statusService.markNotApproved(estimateId, userId);
  }

  async retractEstimate(estimateId: number, userId: number): Promise<void> {
    return this.statusService.retractEstimate(estimateId, userId);
  }

  async convertToOrder(estimateId: number, userId: number, hasExistingOrdersCheck?: (jobId: number) => Promise<boolean>): Promise<OrderConversionResult> {
    return this.statusService.convertToOrder(estimateId, userId, hasExistingOrdersCheck);
  }

  // =============================================
  // TEMPLATE AND ITEM MANAGEMENT - Delegated to EstimateTemplateService
  // =============================================

  async resetEstimateItems(estimateId: number, userId: number): Promise<void> {
    return this.templateService.resetEstimateItems(estimateId, userId);
  }

  async clearAllEstimateItems(estimateId: number, userId: number): Promise<void> {
    return this.templateService.clearAllEstimateItems(estimateId, userId);
  }

  async clearEmptyItems(estimateId: number, userId: number): Promise<void> {
    return this.templateService.clearEmptyItems(estimateId, userId);
  }

  async addTemplateSection(estimateId: number, userId: number): Promise<void> {
    return this.templateService.addTemplateSection(estimateId, userId);
  }

  // =============================================
  // ESTIMATE DUPLICATION - Delegated to EstimateDuplicationService
  // =============================================

  async duplicateEstimateToNewJob(
    connection: any,
    sourceEstimateId: number,
    targetJobId: number,
    targetVersion: number,
    userId: number
  ): Promise<number> {
    return this.duplicationService.duplicateEstimateToNewJob(
      connection,
      sourceEstimateId,
      targetJobId,
      targetVersion,
      userId
    );
  }





}