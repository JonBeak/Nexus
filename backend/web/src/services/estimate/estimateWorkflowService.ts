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
import {
  PrepareEstimateRequest,
  PrepareEstimateResult,
  SendEstimateResult,
  EstimatePointPersonInput
} from '../../types/estimatePointPerson';

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
    // 1. Validate estimate is prepared but not sent
    const estimate = await this.estimateRepository.getEstimateWithPreparedCheck(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found, not prepared, or already sent');
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
      // 2. Create QB estimate (if QB is configured)
      // This will be implemented when we integrate with the existing quickbooksService
      // For now, we'll just mark as sent and send email

      // TODO: Integrate with quickbooksService.createEstimateInQuickBooks()
      // const qbResult = await quickbooksService.createEstimateInQuickBooks(
      //   estimateId,
      //   estimatePreviewData,
      //   userId
      // );
      // qbEstimateId = qbResult.qbEstimateId;
      // qbEstimateUrl = qbResult.qbEstimateUrl;

      // 3. Download PDF
      // TODO: Integrate with qbEstimateService for PDF download

      // 4. Send email to point persons
      // TODO: Integrate with gmailService for email sending
      // const emailResult = await this.sendEstimateEmail(
      //   estimateData,
      //   pointPersons,
      //   estimate.email_subject,
      //   estimate.email_body
      // );

      // 5. Mark estimate as sent
      await this.estimateRepository.markEstimateAsSent(
        estimateId,
        userId,
        qbEstimateId
      );

      return {
        success: true,
        estimateId,
        qbEstimateId,
        qbEstimateUrl,
        emailSentTo: recipientEmails
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
}

export const estimateWorkflowService = new EstimateWorkflowService();
