// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Analysis completed - no cleanup needed
//   - Well-structured facade pattern (166 lines)
//   - All 17 methods actively used by EstimateVersioningService
//   - Delegates to 4 focused services + EstimateRepository
//   - Architecture follows 3-layer pattern correctly
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
import { EstimateWorkflowService } from './estimate/estimateWorkflowService';
import { EstimateRepository } from '../repositories/estimateRepository';
import { estimateLineDescriptionRepository } from '../repositories/estimateLineDescriptionRepository';
import { PrepareEstimateRequest, EstimatePointPersonInput } from '../types/estimatePointPerson';

export class EstimateService {

  // Service instances for delegation
  private versionService = new EstimateVersionService();
  private statusService = new EstimateStatusService();
  private templateService = new EstimateTemplateService();
  private duplicationService = new EstimateDuplicationService();
  private workflowService = new EstimateWorkflowService();
  private estimateRepository = new EstimateRepository();

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

  // =============================================
  // ESTIMATE DATA ACCESS - Repository layer
  // =============================================

  /**
   * Update estimate notes
   * @param estimateId - The estimate ID
   * @param notes - New notes content (null to clear)
   * @param userId - User making the update
   */
  async updateEstimateNotes(estimateId: number, notes: string | null, userId: number): Promise<void> {
    const updated = await this.estimateRepository.updateEstimateNotes(estimateId, notes, userId);
    if (!updated) {
      throw new Error('Failed to update estimate notes');
    }
  }

  /**
   * Get job ID associated with an estimate
   * @param estimateId - The estimate ID
   * @returns Job ID
   * @throws Error if estimate not found
   */
  async getJobIdByEstimateId(estimateId: number): Promise<number> {
    const jobId = await this.estimateRepository.getJobIdByEstimateId(estimateId);
    if (jobId === null) {
      throw new Error('Estimate not found');
    }
    return jobId;
  }

  // =============================================
  // ESTIMATE WORKFLOW - Delegated to EstimateWorkflowService
  // Phase 4c: Prepare to Send / Send to Customer workflow
  // =============================================

  /**
   * Prepare estimate for sending
   * - Cleans empty rows
   * - Saves point persons and email content
   * - Locks the estimate (is_prepared=true, is_draft=false)
   */
  async prepareEstimateForSending(
    estimateId: number,
    userId: number,
    request: PrepareEstimateRequest
  ) {
    return this.workflowService.prepareEstimateForSending(estimateId, userId, request);
  }

  /**
   * Send estimate to customer
   * - Creates QB estimate
   * - Downloads PDF
   * - Sends email to point persons
   * - Marks estimate as sent
   */
  async sendEstimateToCustomer(
    estimateId: number,
    userId: number,
    estimatePreviewData?: any,
    recipientEmails?: string[]
  ) {
    return this.workflowService.sendEstimateToCustomer(estimateId, userId, estimatePreviewData, recipientEmails);
  }

  /**
   * Get point persons for an estimate
   */
  async getEstimatePointPersons(estimateId: number) {
    return this.workflowService.getPointPersons(estimateId);
  }

  /**
   * Update point persons for an estimate
   */
  async updateEstimatePointPersons(
    estimateId: number,
    pointPersons: EstimatePointPersonInput[],
    userId: number
  ) {
    return this.workflowService.updatePointPersons(estimateId, pointPersons, userId);
  }

  /**
   * Get email content for an estimate
   */
  async getEstimateEmailContent(estimateId: number) {
    return this.workflowService.getEmailContent(estimateId);
  }

  /**
   * Update email content for an estimate
   */
  async updateEstimateEmailContent(
    estimateId: number,
    subject: string | null,
    beginning: string | null,
    end: string | null,
    summaryConfig: any | null,
    userId: number
  ) {
    return this.workflowService.updateEmailContent(estimateId, subject, beginning, end, summaryConfig, userId);
  }

  /**
   * Get estimate send email template
   */
  async getEstimateSendTemplate() {
    return this.workflowService.getEstimateSendTemplate();
  }

  /**
   * Get email preview HTML for modal display
   */
  async getEmailPreviewHtml(
    estimateId: number,
    recipients: string[],
    emailContent?: {
      subject?: string;
      beginning?: string;
      end?: string;
      summaryConfig?: {
        includeJobName?: boolean;
        includeCustomerRef?: boolean;
        includeQbEstimateNumber?: boolean;
        includeSubtotal?: boolean;
        includeTax?: boolean;
        includeTotal?: boolean;
        includeEstimateDate?: boolean;
        includeValidUntilDate?: boolean;
      };
      estimateData?: {
        jobName?: string;
        customerJobNumber?: string;
        qbEstimateNumber?: string;
        subtotal?: number;
        tax?: number;
        total?: number;
        estimateDate?: string;
      };
    }
  ) {
    return this.workflowService.getEmailPreviewHtml(estimateId, recipients, emailContent);
  }

  /**
   * Get QB line descriptions for an estimate
   */
  async getLineDescriptions(estimateId: number) {
    return estimateLineDescriptionRepository.getDescriptionsByEstimateId(estimateId);
  }

  /**
   * Update QB line descriptions for an estimate
   */
  async updateLineDescriptions(
    estimateId: number,
    updates: Array<{ line_index: number; qb_description: string }>
  ) {
    for (const update of updates) {
      await estimateLineDescriptionRepository.upsertLineDescription(
        estimateId,
        update.line_index,
        update.qb_description || null,
        false // is_auto_filled = false (user edit)
      );
    }
  }
}