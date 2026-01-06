/**
 * Estimate Workflow Service
 * Phase 4c - Estimate Workflow Redesign
 * Phase 4d - Refactored to delegate to specialized services
 *
 * Orchestrates the two-step workflow:
 * 1. Prepare to Send - Locks estimate, cleans empty rows, saves email content
 * 2. Send to Customer - Creates QB estimate, downloads PDF, sends email
 *
 * Delegates to:
 * - EstimateEmailService: Email HTML building, templates, formatting, preview
 * - EstimateQBDescriptionService: QB description generation
 * - EstimateRowManagementService: Row insertion, cleanup, reordering
 */

import { pool, query } from '../../config/database';
import { RowDataPacket } from 'mysql2';
import { promises as fs } from 'fs';
import { EstimateRepository } from '../../repositories/estimateRepository';
import { estimatePointPersonRepository } from '../../repositories/estimatePointPersonRepository';
import { estimatePreparationRepository, CreatePreparationItemData } from '../../repositories/estimatePreparationRepository';
import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { quickbooksService } from '../../services/quickbooksService';
import { downloadEstimatePDF } from '../../services/qbEstimateService';
import { sendEstimateEmail } from '../../services/gmailService';

// Import specialized services
import { estimateEmailService, EmailPreviewContent } from './estimateEmailService';
import { estimateQBDescriptionService } from './estimateQBDescriptionService';
import { estimateRowManagementService, JobHeaderResult } from './estimateRowManagementService';

// PDF cache directory (must match controller cache location)
const PDF_CACHE_DIR = '/tmp/estimate-pdf-cache';

import {
  PrepareEstimateRequest,
  PrepareEstimateResult,
  SendEstimateResult,
  EstimatePointPersonInput,
  EmailSummaryConfig
} from '../../types/estimatePointPerson';
import { EstimateLineItem } from '../../types/orders';

export class EstimateWorkflowService {
  private estimateRepository = new EstimateRepository();

  /**
   * Prepare an estimate for sending
   * - Validates estimate is in draft mode
   * - Cleans empty input rows (keeps structural rows)
   * - Saves point persons and email content
   * - Sets is_prepared=true, is_draft=false (locks the estimate)
   */
  async prepareEstimateForSending(
    estimateId: number,
    userId: number,
    request: PrepareEstimateRequest
  ): Promise<PrepareEstimateResult> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Validate estimate is in draft mode
      const estimate = await this.estimateRepository.getEstimateWithDraftCheck(estimateId);
      if (!estimate) {
        throw new Error('Estimate not found or is not in draft mode');
      }

      // 2. Clean empty rows (keep structural rows) - DELEGATED
      const cleanResult = await estimateRowManagementService.cleanEmptyRows(estimateId, connection);

      // 2.5. Insert job header row at position 1 FIRST (or detect existing) - DELEGATED
      const headerResult = await estimateRowManagementService.insertJobHeaderRow(estimateId, connection);

      // 2.7. Auto-fill QB descriptions (offset depends on whether header was inserted) - DELEGATED
      if (request.estimatePreviewData) {
        const offset = headerResult?.wasInserted ? 1 : 0;
        await estimateQBDescriptionService.autoFillQBDescriptions(
          estimateId,
          request.estimatePreviewData,
          connection,
          offset
        );
      }

      // 2.8. Add QB description for the header row
      if (headerResult?.wasInserted) {
        await connection.execute(
          `INSERT INTO estimate_line_descriptions (estimate_id, line_index, qb_description, is_auto_filled)
           VALUES (?, 0, ?, 1)`,
          [estimateId, headerResult.headerText]
        );
        console.log(`[Prepare] Added header QB description: "${headerResult.headerText}"`);
      }

      // 2.9. Create preparation table snapshot
      if (request.estimatePreviewData?.items) {
        await this.createPreparationSnapshot(
          estimateId,
          request.estimatePreviewData.items,
          headerResult,
          connection
        );
      }

      // 3. Save point persons if provided
      if (request.pointPersons && request.pointPersons.length > 0) {
        await estimatePointPersonRepository.updatePointPersons(
          estimateId,
          request.pointPersons,
          connection
        );
      }

      // 4. Lock the estimate and save email content
      await connection.execute(
        `UPDATE job_estimates
         SET is_prepared = TRUE,
             is_draft = FALSE,
             uses_preparation_table = TRUE,
             email_subject = ?,
             email_beginning = ?,
             email_end = ?,
             email_summary_config = ?,
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          request.emailSubject || null,
          request.emailBeginning || null,
          request.emailEnd || null,
          request.emailSummaryConfig ? JSON.stringify(request.emailSummaryConfig) : null,
          userId,
          estimateId
        ]
      );

      await connection.commit();

      return {
        success: true,
        estimateId,
        deletedRowCount: cleanResult.deletedCount,
        remainingRowCount: cleanResult.remainingCount
      };

    } catch (error) {
      await connection.rollback();
      console.error('Error preparing estimate for sending:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Create preparation table snapshot from estimate preview data
   */
  private async createPreparationSnapshot(
    estimateId: number,
    items: EstimateLineItem[],
    headerResult: JobHeaderResult | null,
    connection: any
  ): Promise<void> {
    try {
      console.log(`[Prepare] Creating preparation table snapshot for estimate ${estimateId}`);

      await estimatePreparationRepository.clearByEstimateId(estimateId, connection);

      const itemNames = items.map(item => item.itemName);
      const qbMap = await quickbooksRepository.getBatchQBItemMappings(itemNames, connection);

      const snapshotItems: CreatePreparationItemData[] = [];

      // Add header row if it was inserted
      if (headerResult?.wasInserted && headerResult.headerText) {
        snapshotItems.push({
          item_name: 'Job Header',
          qb_description: headerResult.headerText,
          calculation_display: null,
          quantity: 0,
          unit_price: 0,
          extended_price: 0,
          is_description_only: true,
          qb_item_id: null,
          qb_item_name: null,
          source_row_id: null,
          source_product_type_id: 27
        });
      }

      // Convert each item to preparation item
      for (const item of items) {
        const isDescOnly = estimateQBDescriptionService.isDescriptionOnlyItem(item);

        let qbItemId: string | null = null;
        let qbItemName: string | null = null;
        if (!isDescOnly) {
          const qbItemData = qbMap.get(item.itemName.toLowerCase());
          if (qbItemData) {
            qbItemId = qbItemData.qb_item_id;
            qbItemName = qbItemData.name;
          }
        }

        const qbDescription = estimateQBDescriptionService.generateQBDescription(item, qbMap);

        snapshotItems.push({
          item_name: item.itemName || '',
          qb_description: qbDescription || null,
          calculation_display: (item as any).calculationDisplay || null,
          quantity: isDescOnly ? 0 : (item.quantity || 1),
          unit_price: isDescOnly ? 0 : (item.unitPrice || 0),
          extended_price: isDescOnly ? 0 : (item.extendedPrice || 0),
          is_description_only: isDescOnly,
          qb_item_id: qbItemId,
          qb_item_name: qbItemName,
          source_row_id: item.rowId || null,
          source_product_type_id: item.productTypeId || null
        });
      }

      const insertedCount = await estimatePreparationRepository.createSnapshot(
        estimateId,
        snapshotItems,
        connection
      );

      console.log(`[Prepare] Created ${insertedCount} preparation items`);

    } catch (error) {
      console.error('[Prepare] Error creating preparation snapshot:', error);
    }
  }

  /**
   * Send estimate to customer
   */
  async sendEstimateToCustomer(
    estimateId: number,
    userId: number,
    estimatePreviewData?: any,
    recipients?: { to: string[]; cc: string[]; bcc: string[] }
  ): Promise<SendEstimateResult> {
    console.log(`📧 [SendEstimate] Starting for estimate ${estimateId}`);
    console.log(`📧 [SendEstimate] Recipients received:`, JSON.stringify(recipients));

    const estimate = await this.estimateRepository.getEstimateWithPreparedCheck(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found or not prepared');
    }

    if (estimate.is_sent) {
      console.log(`⚠️ Estimate ${estimateId} is being resent`);
    }

    const estimateData = await this.estimateRepository.getEstimateForSending(estimateId);
    if (!estimateData) {
      throw new Error('Could not load estimate data');
    }

    // Determine recipients
    let toRecipients: string[];
    let ccRecipients: string[] = [];
    let bccRecipients: string[] = [];

    if (recipients && recipients.to && recipients.to.length > 0) {
      console.log(`📧 [SendEstimate] Using provided recipients`);
      toRecipients = recipients.to;
      ccRecipients = recipients.cc || [];
      bccRecipients = recipients.bcc || [];
    } else {
      // Fallback to point persons if no recipients specified
      console.log(`📧 [SendEstimate] Falling back to point persons`);
      const pointPersons = await estimatePointPersonRepository.getPointPersonsByEstimateId(estimateId);
      toRecipients = pointPersons.filter(p => p.contact_email).map(p => p.contact_email);
    }
    console.log(`📧 [SendEstimate] To: ${toRecipients.join(', ')}`);
    console.log(`📧 [SendEstimate] CC: ${ccRecipients.join(', ')}`);
    console.log(`📧 [SendEstimate] BCC: ${bccRecipients.join(', ')}`);

    // For backwards compatibility, create combined list for validation
    const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];

    let qbEstimateId: string | undefined;
    let qbEstimateUrl: string | undefined;
    let qbDocNumber: string | undefined;
    let qbEstimateDateStr: string | undefined;

    try {
      if (toRecipients.length === 0) {
        throw new Error('No recipients specified in To: field');
      }

      // Create QB estimate if needed
      if (!estimate.qb_estimate_id) {
        const qbResult = await quickbooksService.createEstimateInQuickBooks(
          estimateId,
          estimatePreviewData,
          userId
        );
        qbEstimateId = qbResult.qbEstimateId;
        qbEstimateUrl = qbResult.qbEstimateUrl;
        qbDocNumber = qbResult.qbDocNumber;
        qbEstimateDateStr = qbResult.estimateDate;
      } else {
        qbEstimateId = estimate.qb_estimate_id;
        qbEstimateUrl = estimate.qb_estimate_url;
        qbDocNumber = estimate.qb_doc_number;
        qbEstimateDateStr = estimate.estimate_date;
      }

      // Get PDF (check cache first, then download with retry)
      let pdfPath: string | null = null;
      const cachePath = `${PDF_CACHE_DIR}/estimate-${estimateId}.pdf`;

      try {
        await fs.access(cachePath);
        pdfPath = cachePath;
        console.log(`📎 Using cached PDF for estimate ${estimateId}`);
      } catch {
        // Cache miss - need to download from QB
        if (!qbEstimateId) {
          throw new Error('Cannot send estimate email: No QuickBooks estimate exists. Please sync to QuickBooks first.');
        }

        // Retry logic with exponential backoff
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`📎 Downloading PDF (attempt ${attempt}/${MAX_RETRIES})...`);
            const pdfResult = await downloadEstimatePDF(qbEstimateId, estimate.job_id || 0);
            pdfPath = pdfResult.pdfPath;
            console.log(`✅ PDF downloaded successfully: ${pdfPath}`);
            break;
          } catch (pdfError) {
            lastError = pdfError instanceof Error ? pdfError : new Error(String(pdfError));
            console.error(`⚠️ PDF download attempt ${attempt} failed:`, lastError.message);

            if (attempt < MAX_RETRIES) {
              const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
              console.log(`   Retrying in ${delayMs/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

        if (!pdfPath) {
          throw new Error(`Failed to attach PDF after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}. Please try again.`);
        }
      }

      // Build email using email service
      const emailVariables = {
        customerName: estimateData.customer_name,
        jobName: estimateData.job_name,
        customerJobNumber: estimateData.customer_job_number,
        versionDescription: estimateData.version_description,
        qbEstimateNumber: qbDocNumber || estimateData.qb_doc_number,
        estimateNumber: estimateData.job_code,
        total: estimateData.total_amount
          ? estimateEmailService.formatCurrency(estimateData.total_amount)
          : ''
      };

      const finalSubject = estimateEmailService.substituteEmailVariables(
        estimateData.email_subject || '',
        emailVariables
      );
      const finalBeginning = estimateEmailService.substituteEmailVariables(
        estimateData.email_beginning || '',
        emailVariables
      );
      const finalEnd = estimateEmailService.substituteEmailVariables(
        estimateData.email_end || '',
        emailVariables
      );

      let summaryConfig: EmailSummaryConfig | null = null;
      if (estimateData.email_summary_config) {
        summaryConfig = typeof estimateData.email_summary_config === 'string'
          ? JSON.parse(estimateData.email_summary_config)
          : estimateData.email_summary_config;
      }

      const estimateDate = estimateData.estimate_date ? new Date(estimateData.estimate_date) : new Date();
      const validUntilDate = new Date(estimateDate);
      validUntilDate.setDate(validUntilDate.getDate() + 30);

      const summaryHtml = estimateEmailService.buildSummaryBoxHtml(summaryConfig, {
        jobName: estimateData.job_name,
        customerJobNumber: estimateData.customer_job_number,
        qbEstimateNumber: qbDocNumber || estimateData.qb_doc_number,
        subtotal: estimateEmailService.formatCurrency(estimateData.subtotal),
        tax: estimateEmailService.formatCurrency(estimateData.tax_amount),
        total: estimateEmailService.formatCurrency(estimateData.total_amount),
        estimateDate: estimateEmailService.formatDate(qbEstimateDateStr || estimateData.estimate_date),
        validUntilDate: estimateEmailService.formatDate(validUntilDate)
      });

      const companySettings = await estimateEmailService.loadCompanySettings();
      const footerHtml = estimateEmailService.buildEmailFooterHtml(companySettings);

      const finalBody = estimateEmailService.buildEmailHtml(
        finalBeginning,
        summaryHtml,
        finalEnd,
        footerHtml,
        companySettings.company_logo_base64
      );

      // Send email
      const emailResult = await sendEstimateEmail({
        recipients: toRecipients,
        ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
        bccRecipients: bccRecipients.length > 0 ? bccRecipients : undefined,
        estimateId,
        estimateNumber: estimateData.job_code,
        estimateName: estimateData.job_name,
        customerName: estimateData.customer_name,
        subject: finalSubject,
        body: finalBody,
        qbEstimateUrl: qbEstimateUrl || null,
        pdfPath
      });

      if (!emailResult.success) {
        throw new Error(`Email sending failed: ${emailResult.error}`);
      }

      await this.estimateRepository.markEstimateAsSent(
        estimateId,
        userId,
        qbEstimateId,
        qbEstimateUrl,
        qbDocNumber
      );

      return {
        success: true,
        estimateId,
        qbEstimateId,
        qbEstimateUrl,
        estimateDate: qbEstimateDateStr,
        emailSentTo: allRecipients,
        message: estimate.is_sent ? '⚠️ This estimate was previously sent.' : undefined
      };

    } catch (error) {
      console.error('Error sending estimate to customer:', error);
      throw error;
    }
  }

  /**
   * Update point persons for an estimate
   */
  async updatePointPersons(
    estimateId: number,
    pointPersons: EstimatePointPersonInput[],
    userId: number
  ): Promise<void> {
    const estimate = await this.estimateRepository.getEstimateById(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    const customerId = estimate.customer_id;
    const { CustomerContactService } = await import('../customerContactService');
    const customerContactService = new CustomerContactService();

    for (const person of pointPersons) {
      if (person.saveToDatabase && !person.contact_id && person.contact_email) {
        try {
          const result = await customerContactService.createContact({
            customer_id: customerId,
            contact_email: person.contact_email,
            contact_name: person.contact_name || person.contact_email,
            contact_phone: person.contact_phone || undefined,
            contact_role: person.contact_role || undefined
          }, userId);

          if (result.success && result.data) {
            person.contact_id = result.data;
          }
        } catch (err) {
          console.warn(`⚠️ Failed to save contact: ${person.contact_email}`);
        }
      }
    }

    await estimatePointPersonRepository.updatePointPersons(estimateId, pointPersons);
    await query('UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?', [userId, estimateId]);
  }

  /**
   * Get point persons for an estimate
   */
  async getPointPersons(estimateId: number) {
    return estimatePointPersonRepository.getPointPersonsByEstimateId(estimateId);
  }

  /**
   * Update email content for an estimate
   */
  async updateEmailContent(
    estimateId: number,
    subject: string | null,
    beginning: string | null,
    end: string | null,
    summaryConfig: any | null,
    userId: number
  ): Promise<void> {
    await this.estimateRepository.updateEmailContent(estimateId, subject, beginning, end, summaryConfig, userId);
  }

  /**
   * Get email content for an estimate
   */
  async getEmailContent(estimateId: number) {
    return this.estimateRepository.getEstimateEmailContent(estimateId);
  }

  /**
   * Get estimate send template - DELEGATED to email service
   */
  async getEstimateSendTemplate() {
    return estimateEmailService.getEstimateSendTemplate();
  }

  /**
   * Get email preview HTML - DELEGATED to email service
   */
  async getEmailPreviewHtml(
    estimateId: number,
    recipients: string[],
    emailContent?: EmailPreviewContent
  ): Promise<{ subject: string; html: string }> {
    const estimate = await this.estimateRepository.getEstimateForSending(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    return estimateEmailService.generateEmailPreviewHtml(estimate, emailContent);
  }
}

export const estimateWorkflowService = new EstimateWorkflowService();
