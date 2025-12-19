/**
 * Estimate Workflow Service
 * Phase 4c - Estimate Workflow Redesign
 *
 * Handles the two-step workflow:
 * 1. Prepare to Send - Locks estimate, cleans empty rows, saves email content
 * 2. Send to Customer - Creates QB estimate, downloads PDF, sends email
 */

import { pool, query } from '../../config/database';
import { RowDataPacket } from 'mysql2';
import { EstimateRepository } from '../../repositories/estimateRepository';
import { estimatePointPersonRepository } from '../../repositories/estimatePointPersonRepository';
import { estimateLineDescriptionRepository } from '../../repositories/estimateLineDescriptionRepository';
import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { quickbooksService } from '../../services/quickbooksService';
import { downloadEstimatePDF } from '../../services/qbEstimateService';
import { sendEstimateEmail } from '../../services/gmailService';
import {
  PrepareEstimateRequest,
  PrepareEstimateResult,
  SendEstimateResult,
  EstimatePointPersonInput
} from '../../types/estimatePointPerson';
import { EstimatePreviewData } from '../../types/orders';

// Structural row types that should never be deleted
const STRUCTURAL_ROW_TYPES = [
  21, // Subtotal
  27, // Empty Row (spacer)
  // Add other structural types like Divider if they exist
];

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

      // 2. Clean empty rows (keep structural rows)
      const cleanResult = await this.cleanEmptyRows(estimateId, connection);

      // 2.5. Auto-fill QB descriptions (if preview data provided)
      if (request.estimatePreviewData) {
        await this.autoFillQBDescriptions(
          estimateId,
          request.estimatePreviewData,
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

      // 4. Lock the estimate (is_prepared=true, is_draft=false)
      await connection.execute(
        `UPDATE job_estimates
         SET is_prepared = TRUE,
             is_draft = FALSE,
             email_subject = ?,
             email_body = ?,
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          request.emailSubject || null,
          request.emailBody || null,
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
   * Auto-fill QB descriptions when preparing estimate
   * - Product rows: Lookup from qb_item_mappings
   * - Description-only rows: Use calculationDisplay
   */
  private async autoFillQBDescriptions(
    estimateId: number,
    estimatePreviewData: EstimatePreviewData,
    connection: any
  ): Promise<void> {
    try {
      console.log(`[Auto-fill QB Descriptions] Starting for estimate ${estimateId}...`);

      // 1. Fetch QB item mappings in batch
      const productTypes = estimatePreviewData.items
        .filter(item => !item.isDescriptionOnly)
        .map(item => item.itemName);

      const qbMap = await quickbooksRepository.getBatchQBItemMappings(
        productTypes,
        connection
      );

      console.log(`[Auto-fill QB Descriptions] Fetched ${qbMap.size} QB mappings`);

      // 2. Build descriptions array
      const descriptions = estimatePreviewData.items.map((item, index) => {
        let qbDescription = '';

        // Description-only rows: use calculationDisplay
        if (item.isDescriptionOnly) {
          qbDescription = item.calculationDisplay || '';
        }
        // Product rows: lookup from qb_item_mappings
        else {
          const qbItemData = qbMap.get(item.itemName.toLowerCase());
          qbDescription = qbItemData?.description || '';
        }

        return {
          lineIndex: index,
          qbDescription,
          isAutoFilled: true
        };
      });

      // 3. Batch save (only non-empty descriptions to save space)
      const nonEmptyDescriptions = descriptions.filter(d => d.qbDescription.length > 0);

      if (nonEmptyDescriptions.length > 0) {
        await estimateLineDescriptionRepository.batchUpsertDescriptions(
          estimateId,
          nonEmptyDescriptions,
          connection
        );
        console.log(`[Auto-fill QB Descriptions] ✓ Saved ${nonEmptyDescriptions.length} descriptions`);
      } else {
        console.log(`[Auto-fill QB Descriptions] ⚠ No descriptions to save (all empty)`);
      }

    } catch (error) {
      console.error('[Auto-fill QB Descriptions] Error:', error);
      // Don't fail the entire prepare operation if QB description auto-fill fails
      // Log and continue - user can manually fill descriptions
    }
  }

  /**
   * Clean empty rows from an estimate
   * Keeps:
   * - Structural rows (Empty Row, Subtotal, Divider)
   * - Rows with a product type selected
   * - Rows with data in field1-field10 or qty
   *
   * Deletes:
   * - Rows with no product type and no field data
   */
  private async cleanEmptyRows(
    estimateId: number,
    connection: any
  ): Promise<{ deletedCount: number; remainingCount: number }> {
    // Get all estimate items
    const [rows] = await connection.execute(
      `SELECT id, product_type_id, grid_data
       FROM job_estimate_items
       WHERE estimate_id = ?
       ORDER BY item_order`,
      [estimateId]
    ) as [RowDataPacket[], any];

    const rowsToDelete: number[] = [];

    for (const row of rows) {
      const productTypeId = row.product_type_id;

      // Keep structural rows (Empty Row, Subtotal, etc.)
      if (STRUCTURAL_ROW_TYPES.includes(productTypeId)) {
        continue;
      }

      // Keep rows with a product type selected (even if no field data)
      if (productTypeId && productTypeId > 0) {
        continue;
      }

      // Check if row has any field data
      let hasFieldData = false;
      if (row.grid_data) {
        try {
          const gridData = typeof row.grid_data === 'string'
            ? JSON.parse(row.grid_data)
            : row.grid_data;

          // Check for quantity
          if (gridData.quantity && String(gridData.quantity).trim()) {
            hasFieldData = true;
          }

          // Check field1-field12
          for (let i = 1; i <= 12; i++) {
            const fieldValue = gridData[`field${i}`];
            if (fieldValue && String(fieldValue).trim()) {
              hasFieldData = true;
              break;
            }
          }
        } catch (e) {
          // If we can't parse grid_data, keep the row to be safe
          hasFieldData = true;
        }
      }

      // No product type and no field data = delete this row
      if (!hasFieldData) {
        rowsToDelete.push(row.id);
      }
    }

    // Delete empty rows
    if (rowsToDelete.length > 0) {
      await connection.execute(
        `DELETE FROM job_estimate_items WHERE id IN (${rowsToDelete.join(',')})`,
        []
      );

      // Reorder remaining items
      await this.reorderEstimateItems(estimateId, connection);
    }

    return {
      deletedCount: rowsToDelete.length,
      remainingCount: rows.length - rowsToDelete.length
    };
  }

  /**
   * Reorder estimate items after deletion to maintain sequential item_order
   */
  private async reorderEstimateItems(estimateId: number, connection: any): Promise<void> {
    // Get remaining items in order
    const [rows] = await connection.execute(
      `SELECT id FROM job_estimate_items WHERE estimate_id = ? ORDER BY item_order`,
      [estimateId]
    ) as [RowDataPacket[], any];

    // Update item_order for each row
    for (let i = 0; i < rows.length; i++) {
      await connection.execute(
        `UPDATE job_estimate_items SET item_order = ? WHERE id = ?`,
        [i + 1, rows[i].id]
      );
    }
  }

  /**
   * Send estimate to customer
   * - Validates estimate is prepared but not yet sent
   * - Creates QB estimate
   * - Downloads PDF
   * - Sends email to point persons
   * - Marks estimate as sent
   */
  async sendEstimateToCustomer(
    estimateId: number,
    userId: number,
    estimatePreviewData?: any
  ): Promise<SendEstimateResult> {
    // 1. Validate estimate is prepared (allow resending)
    const estimate = await this.estimateRepository.getEstimateWithPreparedCheck(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found or not prepared');
    }

    // Check if already sent (for user notification)
    if (estimate.is_sent) {
      console.log(`⚠️ Estimate ${estimateId} is being resent (was already sent previously)`);
    }

    // Get full estimate data for QB and email
    const estimateData = await this.estimateRepository.getEstimateForSending(estimateId);
    if (!estimateData) {
      throw new Error('Could not load estimate data');
    }

    // Get point persons for email recipients
    const pointPersons = await estimatePointPersonRepository.getPointPersonsByEstimateId(estimateId);
    const recipientEmails = pointPersons
      .filter(p => p.contact_email)
      .map(p => p.contact_email);

    let qbEstimateId: string | undefined;
    let qbEstimateUrl: string | undefined;

    try {
      // 2. Validate recipients exist
      if (recipientEmails.length === 0) {
        throw new Error('No point persons with email addresses configured');
      }

      // 3. Create QB estimate (ONLY if qb_estimate_id doesn't exist)
      if (!estimate.qb_estimate_id) {
        const qbResult = await quickbooksService.createEstimateInQuickBooks(
          estimateId,
          estimatePreviewData,
          userId
        );
        qbEstimateId = qbResult.qbEstimateId;
        qbEstimateUrl = qbResult.qbEstimateUrl;
      } else {
        // Reuse existing QB estimate for resends
        qbEstimateId = estimate.qb_estimate_id;
        qbEstimateUrl = estimate.qb_estimate_url;
      }

      // 4. Download QB estimate PDF (non-blocking)
      let pdfPath: string | null = null;
      if (qbEstimateId) {
        try {
          const pdfResult = await downloadEstimatePDF(
            qbEstimateId,
            estimate.job_id
          );
          pdfPath = pdfResult.pdfPath;
        } catch (pdfError) {
          console.error('⚠️ Failed to download QB PDF:', pdfError);
          // Continue - PDF can be downloaded manually later
        }
      }

      // 5. Send email via Gmail
      const emailResult = await sendEstimateEmail({
        recipients: recipientEmails,
        estimateId,
        estimateNumber: estimateData.job_code,
        estimateName: estimateData.job_name,
        customerName: estimateData.customer_name,
        subject: estimateData.email_subject,
        body: estimateData.email_body,
        qbEstimateUrl: qbEstimateUrl || null,
        pdfPath
      });

      if (!emailResult.success) {
        throw new Error(`Email sending failed: ${emailResult.error}`);
      }

      // 6. Mark estimate as sent (update qb_estimate_id, qb_estimate_url, is_sent)
      await this.estimateRepository.markEstimateAsSent(
        estimateId,
        userId,
        qbEstimateId,
        qbEstimateUrl
      );

      return {
        success: true,
        estimateId,
        qbEstimateId,
        qbEstimateUrl,
        emailSentTo: recipientEmails,
        message: estimate.is_sent ? '⚠️ This estimate was previously sent. It has been sent again.' : undefined
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
    // Validate estimate exists
    if (!(await this.estimateRepository.estimateExists(estimateId))) {
      throw new Error('Estimate not found');
    }

    await estimatePointPersonRepository.updatePointPersons(estimateId, pointPersons);

    // Update timestamp
    await query(
      'UPDATE job_estimates SET updated_by = ?, updated_at = NOW() WHERE id = ?',
      [userId, estimateId]
    );
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
    body: string | null,
    userId: number
  ): Promise<void> {
    await this.estimateRepository.updateEmailContent(estimateId, subject, body, userId);
  }

  /**
   * Get email content for an estimate
   */
  async getEmailContent(estimateId: number) {
    return this.estimateRepository.getEstimateEmailContent(estimateId);
  }

  /**
   * Get estimate send template (for auto-filling email subject/body)
   */
  async getEstimateSendTemplate(): Promise<{ subject: string; body: string } | null> {
    const rows = await query(
      `SELECT subject, body FROM email_templates WHERE template_key = 'estimate_send' AND is_active = 1`,
      []
    ) as RowDataPacket[];

    return rows.length > 0 ? { subject: rows[0].subject, body: rows[0].body } : null;
  }

  /**
   * Substitute template variables in email content
   */
  substituteTemplateVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      variables[key] ?? match
    );
  }

  /**
   * Get email preview HTML for modal display
   * Generates estimate-specific email with estimate details
   */
  async getEmailPreviewHtml(estimateId: number, recipients: string[]): Promise<{ subject: string; html: string }> {
    // Load estimate data
    const estimate = await this.estimateRepository.getEstimateForSending(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    // Load point persons
    const pointPersons = await estimatePointPersonRepository.getPointPersonsByEstimateId(estimateId);

    // Build recipient list for display
    const recipientList = recipients
      .filter(r => r && r.trim())
      .map(r => r.trim());

    // Construct estimate-specific email subject
    const subject = `Estimate #${estimate.job_code} - ${estimate.job_name}`;

    // Build estimate-specific HTML email body
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 20px; }
            .greeting { font-size: 16px; margin-bottom: 15px; }
            .estimate-details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; }
            .footer { border-top: 1px solid #ddd; padding-top: 15px; margin-top: 30px; font-size: 12px; color: #666; }
            .qb-link { margin: 20px 0; padding: 15px; background: #e8f4f8; border-left: 4px solid #007bff; }
            .action-required { color: #d9534f; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Estimate for Review</h2>
              <p class="greeting">Hello,</p>
            </div>

            <p>Please review the attached estimate below for <strong>${estimate.customer_name || 'our valued customer'}</strong>.</p>

            <div class="estimate-details">
              <div class="detail-row">
                <span class="label">Estimate Number:</span>
                <span class="value">${estimate.job_code}</span>
              </div>
              <div class="detail-row">
                <span class="label">Estimate Name:</span>
                <span class="value">${estimate.job_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Customer:</span>
                <span class="value">${estimate.customer_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value">${estimate.status ? estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1) : 'Draft'}</span>
              </div>
            </div>

            ${estimate.qb_estimate_id ? `
              <div class="qb-link">
                <p><strong>QuickBooks Integration:</strong></p>
                <p>This estimate has been synced to QuickBooks. You can <a href="${estimate.qb_estimate_url || '#'}">view it in QuickBooks</a> for additional details and management.</p>
              </div>
            ` : ''}

            <p>If you have any questions or need clarification on any items in this estimate, please don't hesitate to reach out.</p>

            <div class="footer">
              <p><strong>Signhouse Manufacturing</strong></p>
              <p>Professional sign manufacturing and installation</p>
              <hr>
              <p style="font-size: 11px; margin-top: 10px;">This estimate is valid for 30 days from the date of issue. Please contact us if you have any questions.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return {
      subject,
      html: html.trim()
    };
  }
}

export const estimateWorkflowService = new EstimateWorkflowService();
