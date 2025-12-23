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
import { promises as fs } from 'fs';
import { EstimateRepository } from '../../repositories/estimateRepository';
import { estimatePointPersonRepository } from '../../repositories/estimatePointPersonRepository';
import { estimateLineDescriptionRepository } from '../../repositories/estimateLineDescriptionRepository';
import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { quickbooksService } from '../../services/quickbooksService';
import { downloadEstimatePDF } from '../../services/qbEstimateService';
import { sendEstimateEmail } from '../../services/gmailService';

// PDF cache directory (must match controller cache location)
const PDF_CACHE_DIR = '/tmp/estimate-pdf-cache';
import {
  PrepareEstimateRequest,
  PrepareEstimateResult,
  SendEstimateResult,
  EstimatePointPersonInput,
  EmailSummaryConfig,
  DEFAULT_EMAIL_SUMMARY_CONFIG
} from '../../types/estimatePointPerson';
import { EstimatePreviewData, EstimateLineItem } from '../../types/orders';

/**
 * Company settings for email footer
 */
interface CompanySettings {
  company_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  company_website: string | null;
  company_business_hours: string | null;
  company_logo_base64: string | null;
}

// Structural row types that should never be deleted
const STRUCTURAL_ROW_TYPES = [
  21, // Subtotal
  27, // Empty Row (spacer)
  // Add other structural types like Divider if they exist
];

/**
 * Substitute template variables in email subject/body
 * Variables: {{customerName}}, {{jobName}}, {{customerJobNumber}},
 *            {{jobNameWithRef}}, {{qbEstimateNumber}}, {{estimateNumber}}, {{total}}
 */
function substituteEmailVariables(
  template: string,
  variables: {
    customerName?: string;
    jobName?: string;
    customerJobNumber?: string;
    qbEstimateNumber?: string;
    estimateNumber?: string;
    total?: string;
  }
): string {
  // Build jobNameWithRef: "Job Name - Customer Ref" or just "Job Name"
  const jobNameWithRef = variables.customerJobNumber
    ? `${variables.jobName || ''} - ${variables.customerJobNumber}`
    : (variables.jobName || '');

  const allVariables: Record<string, string> = {
    customerName: variables.customerName || '',
    jobName: variables.jobName || '',
    customerJobNumber: variables.customerJobNumber || '',
    jobNameWithRef,
    qbEstimateNumber: variables.qbEstimateNumber || '',
    estimateNumber: variables.estimateNumber || '',
    total: variables.total || ''
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return allVariables[key] ?? match;
  });
}

/**
 * Load company settings from rbac_settings table
 */
async function loadCompanySettings(): Promise<CompanySettings> {
  const rows = await query(
    `SELECT setting_name, setting_value FROM rbac_settings
     WHERE setting_name IN ('company_name', 'company_phone', 'company_email', 'company_address', 'company_website', 'company_business_hours', 'company_logo_base64')`,
    []
  ) as RowDataPacket[];

  const settings: CompanySettings = {
    company_name: null,
    company_phone: null,
    company_email: null,
    company_address: null,
    company_website: null,
    company_business_hours: null,
    company_logo_base64: null
  };

  for (const row of rows) {
    if (row.setting_name === 'company_name') settings.company_name = row.setting_value;
    if (row.setting_name === 'company_phone') settings.company_phone = row.setting_value;
    if (row.setting_name === 'company_email') settings.company_email = row.setting_value;
    if (row.setting_name === 'company_address') settings.company_address = row.setting_value;
    if (row.setting_name === 'company_website') settings.company_website = row.setting_value;
    if (row.setting_name === 'company_business_hours') settings.company_business_hours = row.setting_value;
    if (row.setting_name === 'company_logo_base64') settings.company_logo_base64 = row.setting_value;
  }

  return settings;
}

/**
 * Build the summary box HTML based on config checkboxes
 */
function buildSummaryBoxHtml(
  config: EmailSummaryConfig | null,
  data: {
    jobName?: string;
    customerJobNumber?: string;
    qbEstimateNumber?: string;
    subtotal?: string;
    tax?: string;
    total?: string;
    estimateDate?: string;
    validUntilDate?: string;
  }
): string {
  // If no config or all disabled, return empty
  if (!config) return '';

  const rows: string[] = [];

  if (config.includeJobName && data.jobName) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; width: 40%; text-align: left;">Job Name:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.jobName}</td></tr>`);
  }
  if (config.includeCustomerRef && data.customerJobNumber) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; text-align: left;">Customer Ref #:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.customerJobNumber}</td></tr>`);
  }
  if (config.includeQbEstimateNumber && data.qbEstimateNumber) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; text-align: left;">QB Estimate #:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.qbEstimateNumber}</td></tr>`);
  }
  if (config.includeEstimateDate && data.estimateDate) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; text-align: left;">Estimate Date:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.estimateDate}</td></tr>`);
  }
  if (config.includeValidUntilDate && data.validUntilDate) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; text-align: left;">Valid Until:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.validUntilDate}</td></tr>`);
  }
  if (config.includeSubtotal && data.subtotal) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; text-align: left;">Subtotal:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.subtotal}</td></tr>`);
  }
  if (config.includeTax && data.tax) {
    rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; text-align: left;">Tax:</td><td style="padding: 6px 12px; color: #333; text-align: right;">${data.tax}</td></tr>`);
  }
  if (config.includeTotal && data.total) {
    rows.push(`<tr style="background-color: #87CEEB;"><td style="padding: 8px 12px; font-weight: 700; color: #333; text-align: left;">Total:</td><td style="padding: 8px 12px; font-weight: 700; color: #333; text-align: right;">${data.total}</td></tr>`);
  }

  // If no rows enabled, return empty
  if (rows.length === 0) return '';

  return `
    <div style="border: 1px solid #999; border-radius: 6px; padding: 0; margin: 20px auto; max-width: 350px; background: #F0F8FF; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Build the email footer HTML from company settings
 */
function buildEmailFooterHtml(settings: CompanySettings): string {
  const parts: string[] = [];

  if (settings.company_name) {
    parts.push(`<p style="margin: 0 0 5px 0;"><strong>${settings.company_name}</strong></p>`);
  }
  if (settings.company_phone) {
    parts.push(`<p style="margin: 0 0 5px 0;">${settings.company_phone}</p>`);
  }
  if (settings.company_email) {
    parts.push(`<p style="margin: 0 0 5px 0;">${settings.company_email}</p>`);
  }
  if (settings.company_address) {
    parts.push(`<p style="margin: 0 0 5px 0;">${settings.company_address}</p>`);
  }
  if (settings.company_website) {
    // Display website as a clickable link, strip https:// for cleaner display
    const displayUrl = settings.company_website.replace(/^https?:\/\//, '');
    parts.push(`<p style="margin: 0 0 5px 0;"><a href="${settings.company_website}" style="color: #0066cc;">${displayUrl}</a></p>`);
  }
  if (settings.company_business_hours) {
    parts.push(`<p style="margin: 0;">${settings.company_business_hours}</p>`);
  }

  if (parts.length === 0) return '';

  return `
    <hr style="border: none; border-top: 1px solid #ccc; margin: 30px auto 0; width: 80%;" />
    <div style="margin-top: 15px; font-size: 12px; color: #666;">
      ${parts.join('')}
    </div>
  `;
}

/**
 * Build full email HTML body from 3 parts + footer
 * Matches the format used in getEmailPreviewHtml for consistency
 */
function buildEmailHtml(
  beginning: string | null,
  summaryHtml: string,
  end: string | null,
  footerHtml: string,
  logoBase64: string | null = null
): string {
  // Convert plain text to HTML (convert newlines to <br> for email client compatibility)
  const beginningHtml = beginning
    ? `<div class="content">${escapeHtml(beginning).replace(/\n/g, '<br>')}</div>`
    : '';
  const endHtml = end
    ? `<div class="content">${escapeHtml(end).replace(/\n/g, '<br>')}</div>`
    : '';

  // Build logo HTML if base64 is provided
  const logoHtml = logoBase64
    ? `<div class="logo" style="margin-bottom: 20px;"><img src="data:image/png;base64,${logoBase64}" alt="Company Logo" style="max-width: 200px; height: auto;" /><hr style="border: none; border-top: 1px solid #ccc; margin: 15px auto 0; width: 80%;" /></div>`
    : '';

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 2px solid #87CEEB; border-radius: 24px; background-color: #f5f5f5; }
          .logo { text-align: center; }
          .content { margin: 20px 0; text-align: center; }
          .estimate-summary { background: #F0F8FF; padding: 0; border: 1px solid #999; border-radius: 6px; margin: 20px auto; max-width: 350px; overflow: hidden; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #ddd; }
          .summary-row:last-child { border-bottom: none; }
          .summary-row-total { background-color: #87CEEB; padding: 8px 12px; border-bottom: none; }
          .summary-label { font-weight: 600; color: #555; text-align: left; }
          .summary-value { color: #333; text-align: right; }
          .footer { border-top: 1px solid #ddd; padding-top: 15px; margin-top: 30px; font-size: 12px; color: #666; text-align: left; }
        </style>
      </head>
      <body>
        <div class="container">
          ${logoHtml}
          ${beginningHtml}
          ${summaryHtml}
          ${endHtml}
          ${footerHtml}
        </div>
      </body>
    </html>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format currency for display
 */
function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date for display (Jan. 1, 2025)
 */
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month}. ${day}, ${year}`;
}

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

      // 2.5. Insert job header row at position 1 FIRST
      const headerText = await this.insertJobHeaderRow(estimateId, connection);

      // 2.7. Auto-fill QB descriptions (with +1 offset for header row)
      if (request.estimatePreviewData) {
        await this.autoFillQBDescriptions(
          estimateId,
          request.estimatePreviewData,
          connection,
          1  // offset: header row is at index 0, so items start at index 1
        );
      }

      // 2.8. Add QB description for the header row (after auto-fill clears old ones)
      if (headerText) {
        await connection.execute(
          `INSERT INTO estimate_line_descriptions (estimate_id, line_index, qb_description, is_auto_filled)
           VALUES (?, 0, ?, 1)`,
          [estimateId, headerText]
        );
        console.log(`[Prepare] Added header QB description: "${headerText}"`);
      }

      // 3. Save point persons if provided
      if (request.pointPersons && request.pointPersons.length > 0) {
        await estimatePointPersonRepository.updatePointPersons(
          estimateId,
          request.pointPersons,
          connection
        );
      }

      // 4. Lock the estimate (is_prepared=true, is_draft=false) and save email content
      await connection.execute(
        `UPDATE job_estimates
         SET is_prepared = TRUE,
             is_draft = FALSE,
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
   * Insert a job header row at position 1
   * Contains the job name and optionally the customer reference number
   * Format: "Job Name" or "Job Name - Customer Ref #"
   */
  private async insertJobHeaderRow(
    estimateId: number,
    connection: any
  ): Promise<string | null> {
    try {
      // 1. Get job info via estimate
      const [jobRows] = await connection.execute(
        `SELECT j.job_name, j.customer_job_number
         FROM jobs j
         JOIN job_estimates e ON j.job_id = e.job_id
         WHERE e.id = ?`,
        [estimateId]
      ) as [RowDataPacket[], any];

      if (jobRows.length === 0) {
        console.warn(`[Insert Job Header] Could not find job for estimate ${estimateId}`);
        return null;
      }

      const { job_name, customer_job_number } = jobRows[0];

      // 2. Build the header text: "Job Name" or "Job Name - Customer Ref #"
      let headerText = job_name || 'Untitled Job';
      if (customer_job_number && customer_job_number.trim()) {
        headerText += ` - ${customer_job_number.trim()}`;
      }

      console.log(`[Insert Job Header] Adding header row: "${headerText}"`);

      // 3. Shift all existing item_order values by +1
      await connection.execute(
        `UPDATE job_estimate_items
         SET item_order = item_order + 1,
             item_index = item_index + 1
         WHERE estimate_id = ?`,
        [estimateId]
      );

      // 4. Insert the new header row at position 1
      // Product type 27 = Empty Row, field1 = "Label" (the description field)
      const gridData = JSON.stringify({
        quantity: '',
        field1: headerText,
        field2: '',
        field3: '',
        field4: '',
        field5: '',
        field6: '',
        field7: '',
        field8: '',
        field9: '',
        field10: '',
        field11: '',
        field12: ''
      });

      await connection.execute(
        `INSERT INTO job_estimate_items (
          estimate_id,
          product_type_id,
          item_name,
          item_order,
          item_index,
          grid_data,
          created_at,
          updated_at
        ) VALUES (?, 27, 'Job Header', 1, 1, ?, NOW(), NOW())`,
        [estimateId, gridData]
      );

      console.log(`[Insert Job Header] ✓ Header row inserted successfully`);
      return headerText;  // Return for QB description insertion later
    } catch (error) {
      console.error('[Insert Job Header] Error:', error);
      throw error;
    }
  }

  /**
   * Auto-fill QB descriptions when preparing estimate
   * Uses custom rules with fallback to qb_item_mappings lookup
   */
  private async autoFillQBDescriptions(
    estimateId: number,
    estimatePreviewData: EstimatePreviewData,
    connection: any,
    indexOffset: number = 0  // Offset for line indices (e.g., 1 if header row was inserted)
  ): Promise<void> {
    try {
      console.log(`[Auto-fill QB Descriptions] Starting for estimate ${estimateId} (offset: ${indexOffset})...`);

      // 0. Clear any existing QB descriptions (start fresh each time)
      await connection.execute(
        `DELETE FROM estimate_line_descriptions WHERE estimate_id = ?`,
        [estimateId]
      );
      console.log(`[Auto-fill QB Descriptions] Cleared existing descriptions`);

      // 1. Fetch QB item mappings in batch (for fallback)
      const productTypes = estimatePreviewData.items
        .filter(item => !item.isDescriptionOnly)
        .map(item => item.itemName);

      const qbMap = await quickbooksRepository.getBatchQBItemMappings(
        productTypes,
        connection
      );

      console.log(`[Auto-fill QB Descriptions] Fetched ${qbMap.size} QB mappings for fallback`);

      // 2. Build descriptions using custom rules with fallback
      // Apply indexOffset to account for header row insertion
      console.log(`[Auto-fill QB Descriptions] Processing ${estimatePreviewData.items.length} items from frontend`);
      const descriptions = estimatePreviewData.items.map((item, index) => {
        console.log(`[Auto-fill QB Descriptions] Item ${index}: productTypeId=${item.productTypeId}, name="${item.itemName}", calcDisplay="${item.calculationDisplay?.substring(0, 30)}"`);
        const qbDescription = this.generateQBDescription(item, qbMap);

        return {
          lineIndex: index + indexOffset,  // Apply offset
          qbDescription,
          isAutoFilled: true
        };
      });

      // 3. Batch save non-empty descriptions
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
   * Generate QB description using custom rules with fallback
   * Priority: 1) Custom rules, 2) qb_item_mappings lookup
   */
  private generateQBDescription(
    item: EstimateLineItem,
    qbMap: Map<string, { name: string; description: string | null; qb_item_id: string }>
  ): string {
    const { itemName, isDescriptionOnly, calculationDisplay, productTypeId, description } = item;

    // Special case: Empty Row (product type 27) - use field1 text as QB description
    if (productTypeId === 27) {
      console.log(`[QB Desc] Empty Row - description: "${description}", calculationDisplay: "${calculationDisplay}"`);
      return description || calculationDisplay || '';
    }

    // Special case: Description-only rows always use calculationDisplay
    if (isDescriptionOnly) {
      return calculationDisplay || '';
    }

    // Step 1: Try custom rules
    const customDescription = this.applyCustomRule(item);
    if (customDescription !== null) {
      return customDescription;
    }

    // Step 2: Fallback to qb_item_mappings lookup
    const qbItemData = qbMap.get(itemName.toLowerCase());
    if (qbItemData?.description) {
      return qbItemData.description;
    }

    // Step 3: Last resort - empty (user can manually fill)
    return '';
  }

  /**
   * Apply custom rule for QB description generation
   * Returns description string if rule matches, null otherwise (triggers fallback)
   *
   * Available data from item:
   * - productTypeId: number (1=Channel Letters, 5=Push Thru, etc.)
   * - productTypeName: string ("Channel Letters", "Vinyl", etc.)
   * - itemName: string ("3\" Channel Letters", "LEDs", etc.)
   * - calculationDisplay: string ("32\" @ $2.50/inch - [8 pcs]")
   * - calculationComponents: array of { name, price, type, calculationDisplay }
   * - quantity: number
   * - unitPrice: number
   * - extendedPrice: number
   * - isDescriptionOnly: boolean
   */
  private applyCustomRule(item: EstimateLineItem): string | null {
    // Destructure available data for rules
    // const { productTypeId, productTypeName, itemName, calculationDisplay, calculationComponents, quantity } = item;

    // =====================================================
    // CUSTOM RULES - Add new rules here
    // Return string to use as description, null to fallback
    // =====================================================

    // Example rule (disabled - for reference):
    // if (productTypeId === 1) { // Channel Letters
    //   // Parse calculationDisplay for dimensions
    //   // return `Channel Letters: ${extracted_dimensions}`;
    // }

    // =====================================================
    // END CUSTOM RULES
    // =====================================================

    // No custom rule matched - return null to trigger fallback
    return null;
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
    let qbDocNumber: string | undefined;
    let qbEstimateDateStr: string | undefined;  // TxnDate from QB as string

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
        qbDocNumber = qbResult.qbDocNumber;
        qbEstimateDateStr = qbResult.estimateDate;
      } else {
        // Reuse existing QB estimate for resends
        qbEstimateId = estimate.qb_estimate_id;
        qbEstimateUrl = estimate.qb_estimate_url;
        qbDocNumber = estimate.qb_doc_number;
        qbEstimateDateStr = estimate.estimate_date;
      }

      // 4. Get QB estimate PDF (check cache first, then download)
      let pdfPath: string | null = null;
      const cachePath = `${PDF_CACHE_DIR}/estimate-${estimateId}.pdf`;

      // Try to use cached PDF first (from preview modal)
      try {
        await fs.access(cachePath);
        pdfPath = cachePath;
        console.log(`📎 Using cached PDF for estimate ${estimateId}: ${cachePath}`);
      } catch {
        // Cache miss - download from QuickBooks
        if (qbEstimateId) {
          try {
            console.log(`📥 Cache miss - downloading QB PDF for estimate ${qbEstimateId}...`);
            const pdfResult = await downloadEstimatePDF(
              qbEstimateId,
              estimate.job_id
            );
            pdfPath = pdfResult.pdfPath;
            console.log(`✅ QB PDF downloaded successfully: ${pdfPath}`);
          } catch (pdfError) {
            console.error('⚠️ Failed to download QB PDF:', pdfError instanceof Error ? pdfError.message : pdfError);
            console.error('   Full error:', pdfError);
            // Continue - PDF can be downloaded manually later
          }
        } else {
          console.log('⚠️ No qbEstimateId available - skipping PDF download');
        }
      }

      // 5. Build email from 3-part structure
      const emailVariables = {
        customerName: estimateData.customer_name,
        jobName: estimateData.job_name,
        customerJobNumber: estimateData.customer_job_number,
        qbEstimateNumber: qbDocNumber || estimateData.qb_doc_number,
        estimateNumber: estimateData.job_code,
        total: estimateData.total_amount
          ? formatCurrency(estimateData.total_amount)
          : ''
      };

      // Substitute variables in subject, beginning, and end
      const finalSubject = substituteEmailVariables(estimateData.email_subject || '', emailVariables);
      const finalBeginning = substituteEmailVariables(estimateData.email_beginning || '', emailVariables);
      const finalEnd = substituteEmailVariables(estimateData.email_end || '', emailVariables);

      // Parse summary config (use default if not set)
      let summaryConfig: EmailSummaryConfig | null = null;
      if (estimateData.email_summary_config) {
        summaryConfig = typeof estimateData.email_summary_config === 'string'
          ? JSON.parse(estimateData.email_summary_config)
          : estimateData.email_summary_config;
      }

      // Calculate valid until date (30 days from estimate date)
      const estimateDate = estimateData.estimate_date ? new Date(estimateData.estimate_date) : new Date();
      const validUntilDate = new Date(estimateDate);
      validUntilDate.setDate(validUntilDate.getDate() + 30);

      // Build summary box HTML (use QB date for new sends, DB date for resends)
      const summaryHtml = buildSummaryBoxHtml(summaryConfig, {
        jobName: estimateData.job_name,
        customerJobNumber: estimateData.customer_job_number,
        qbEstimateNumber: qbDocNumber || estimateData.qb_doc_number,
        subtotal: formatCurrency(estimateData.subtotal),
        tax: formatCurrency(estimateData.tax_amount),
        total: formatCurrency(estimateData.total_amount),
        estimateDate: formatDate(qbEstimateDateStr || estimateData.estimate_date),
        validUntilDate: formatDate(validUntilDate)
      });

      // Load company settings for footer
      const companySettings = await loadCompanySettings();
      const footerHtml = buildEmailFooterHtml(companySettings);

      // Build final email HTML from 3 parts + footer + logo
      const finalBody = buildEmailHtml(
        finalBeginning,
        summaryHtml,
        finalEnd,
        footerHtml,
        companySettings.company_logo_base64
      );

      // 6. Send email via Gmail (body is already HTML)
      console.log(`📧 Sending estimate email with pdfPath: ${pdfPath || '(none)'}`);
      const emailResult = await sendEstimateEmail({
        recipients: recipientEmails,
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

      // 7. Mark estimate as sent (update qb_estimate_id, qb_estimate_url, qb_doc_number, is_sent)
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
    // Get estimate to retrieve customer_id
    const estimate = await this.estimateRepository.getEstimateById(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    const customerId = estimate.customer_id;

    // Import CustomerContactService dynamically to avoid circular dependency
    const { CustomerContactService } = await import('../customerContactService');
    const customerContactService = new CustomerContactService();

    // Process each point person - create customer contact if saveToDatabase is true
    for (const person of pointPersons) {
      if (person.saveToDatabase && !person.contact_id && person.contact_email) {
        try {
          const result = await customerContactService.createContact({
            customer_id: customerId,
            contact_email: person.contact_email,
            contact_name: person.contact_name || person.contact_email, // Use email as fallback name
            contact_phone: person.contact_phone || undefined,
            contact_role: person.contact_role || undefined
          }, userId);

          if (result.success && result.data) {
            // Update the point person with the new contact_id
            person.contact_id = result.data;
            console.log(`✅ Contact saved to database: ${person.contact_email} (ID: ${result.data})`);
          } else if (!result.success) {
            console.warn(`⚠️ Failed to save contact: ${(result as any).error}`);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to save contact (may already exist): ${person.contact_email}`);
        }
      }
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
   * Update email content for an estimate (3-part structure)
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
   * Generates email using the composed content from the frontend
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
  ): Promise<{ subject: string; html: string }> {
    // Load estimate data for customer name (for variable substitution)
    const estimate = await this.estimateRepository.getEstimateForSending(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    // Build template variables for substitution
    const templateVars: Record<string, string> = {
      customerName: estimate.customer_name || 'Valued Customer',
      jobName: emailContent?.estimateData?.jobName || estimate.job_name || '',
      qbEstimateNumber: emailContent?.estimateData?.qbEstimateNumber || estimate.qb_doc_number || '',
      customerRef: emailContent?.estimateData?.customerJobNumber || estimate.customer_job_number || '',
      jobNameWithRef: emailContent?.estimateData?.customerJobNumber
        ? `${emailContent?.estimateData?.jobName || estimate.job_name} - ${emailContent?.estimateData?.customerJobNumber}`
        : (emailContent?.estimateData?.jobName || estimate.job_name || '')
    };

    // Process subject with variable substitution
    const rawSubject = emailContent?.subject || `Estimate #${estimate.job_code} - ${estimate.job_name}`;
    const subject = this.substituteTemplateVariables(rawSubject, templateVars);

    // Process beginning text with variable substitution
    const beginningText = this.substituteTemplateVariables(
      emailContent?.beginning || '',
      templateVars
    );

    // Process end text with variable substitution
    const endText = this.substituteTemplateVariables(
      emailContent?.end || '',
      templateVars
    );

    // Build summary section based on summaryConfig and estimateData
    const summaryHtml = this.buildEmailSummaryHtml(
      emailContent?.summaryConfig,
      emailContent?.estimateData
    );

    // Load company settings and build footer
    const companySettings = await loadCompanySettings();
    const footerHtml = buildEmailFooterHtml(companySettings);

    // Build logo HTML if available
    const logoHtml = companySettings.company_logo_base64
      ? `<div class="logo" style="margin-bottom: 20px;"><img src="data:image/png;base64,${companySettings.company_logo_base64}" alt="Company Logo" style="max-width: 200px; height: auto;" /><hr style="border: none; border-top: 1px solid #ccc; margin: 15px auto 0; width: 80%;" /></div>`
      : '';

    // Build HTML email with composed content
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 2px solid #87CEEB; border-radius: 24px; background-color: #f5f5f5; }
            .logo { text-align: center; }
            .content { margin: 20px 0; white-space: pre-wrap; text-align: center; }
            .estimate-summary { background: #F0F8FF; padding: 0; border: 1px solid #999; border-radius: 6px; margin: 20px auto; max-width: 350px; overflow: hidden; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #ddd; }
            .summary-row:last-child { border-bottom: none; }
            .summary-row-total { background-color: #87CEEB; padding: 8px 12px; border-bottom: none; }
            .summary-label { font-weight: 600; color: #555; text-align: left; }
            .summary-value { color: #333; text-align: right; }
            .footer { border-top: 1px solid #ddd; padding-top: 15px; margin-top: 30px; font-size: 12px; color: #666; text-align: left; }
          </style>
        </head>
        <body>
          <div class="container">
            ${logoHtml}
            <div class="content">${this.escapeHtml(beginningText).replace(/\n/g, '<br>')}</div>
            ${summaryHtml}
            <div class="content">${this.escapeHtml(endText).replace(/\n/g, '<br>')}</div>
            ${footerHtml}
          </div>
        </body>
      </html>
    `;

    return {
      subject,
      html: html.trim()
    };
  }

  /**
   * Build the estimate summary HTML section based on config and data
   * Matches the frontend preview format in EstimateEmailComposer
   */
  private buildEmailSummaryHtml(
    config?: {
      includeJobName?: boolean;
      includeCustomerRef?: boolean;
      includeQbEstimateNumber?: boolean;
      includeSubtotal?: boolean;
      includeTax?: boolean;
      includeTotal?: boolean;
      includeEstimateDate?: boolean;
      includeValidUntilDate?: boolean;
    },
    data?: {
      jobName?: string;
      customerJobNumber?: string;
      qbEstimateNumber?: string;
      subtotal?: number;
      tax?: number;
      total?: number;
      estimateDate?: string;
    }
  ): string {
    if (!config) return '';

    const rows: string[] = [];

    // Match the exact order and labels from frontend EstimateEmailComposer preview
    if (config.includeJobName) {
      const value = data?.jobName || '-';
      rows.push(`<div class="summary-row"><span class="summary-label">Job Name:</span><span class="summary-value">${this.escapeHtml(value)}</span></div>`);
    }

    if (config.includeCustomerRef) {
      const value = data?.customerJobNumber || '-';
      rows.push(`<div class="summary-row"><span class="summary-label">Customer Ref #:</span><span class="summary-value">${this.escapeHtml(value)}</span></div>`);
    }

    if (config.includeQbEstimateNumber && data?.qbEstimateNumber) {
      rows.push(`<div class="summary-row"><span class="summary-label">QB Estimate #:</span><span class="summary-value">${this.escapeHtml(data.qbEstimateNumber)}</span></div>`);
    }

    if (config.includeEstimateDate) {
      const value = data?.estimateDate ? this.formatDate(data.estimateDate) : '-';
      rows.push(`<div class="summary-row"><span class="summary-label">Estimate Date:</span><span class="summary-value">${value}</span></div>`);
    }

    if (config.includeValidUntilDate) {
      // Calculate valid until date (30 days from estimate date)
      let value = '-';
      if (data?.estimateDate) {
        const d = new Date(data.estimateDate);
        d.setDate(d.getDate() + 30);
        value = this.formatDate(d.toISOString());
      }
      rows.push(`<div class="summary-row"><span class="summary-label">Valid Until:</span><span class="summary-value">${value}</span></div>`);
    }

    if (config.includeSubtotal) {
      const value = data?.subtotal !== undefined ? this.formatCurrency(data.subtotal) : '-';
      rows.push(`<div class="summary-row"><span class="summary-label">Subtotal:</span><span class="summary-value">${value}</span></div>`);
    }

    if (config.includeTax) {
      const value = data?.tax !== undefined ? this.formatCurrency(data.tax) : '-';
      rows.push(`<div class="summary-row"><span class="summary-label">Tax:</span><span class="summary-value">${value}</span></div>`);
    }

    if (config.includeTotal) {
      const value = data?.total !== undefined ? this.formatCurrency(data.total) : '-';
      rows.push(`<div class="summary-row summary-row-total"><span class="summary-label"><strong>Total:</strong></span><span class="summary-value"><strong>${value}</strong></span></div>`);
    }

    if (rows.length === 0) return '';

    return `<div class="estimate-summary">${rows.join('')}</div>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month}. ${day}, ${year}`;
  }
}

export const estimateWorkflowService = new EstimateWorkflowService();
