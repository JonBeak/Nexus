/**
 * Estimate Email Service
 * Handles all email composition, HTML building, and template operations
 *
 * Extracted from estimateWorkflowService.ts during Phase 4.d refactoring
 * Responsibilities:
 * - Email HTML building (3-part structure: beginning, summary, end)
 * - Template variable substitution
 * - Company settings loading for footer
 * - Summary box HTML generation
 * - Email preview HTML generation
 * - Formatting utilities (currency, date, HTML escaping)
 *
 * IMPORTANT: Summary field definitions (SUMMARY_FIELDS) are the single source of truth.
 * Frontend (EstimateEmailComposer.tsx) must stay in sync with these definitions.
 */

import { query } from '../../config/database';
import { RowDataPacket } from 'mysql2';
import { EmailSummaryConfig } from '../../types/estimatePointPerson';

// =============================================
// SHARED SUMMARY FIELD DEFINITIONS
// Single source of truth for summary fields
// Frontend (EstimateEmailComposer.tsx) must match this order and labels
// =============================================

/**
 * Summary field definition
 * Used to generate both HTML and ensure consistency between backend/frontend
 */
export interface SummaryFieldDefinition {
  key: keyof EmailSummaryConfig;
  label: string;
  dataKey: keyof SummaryDataNumeric;
  isTotal?: boolean;  // Special styling for total row
  requiresValue?: boolean;  // Only show if value exists (e.g., QB Estimate #)
}

/**
 * Ordered list of summary fields
 * This defines the order and labels for email summary rendering
 * MUST be kept in sync with frontend EstimateEmailComposer.tsx
 */
export const SUMMARY_FIELDS: SummaryFieldDefinition[] = [
  { key: 'includeJobName', label: 'Job Name:', dataKey: 'jobName' },
  { key: 'includeCustomerRef', label: 'Customer Ref #:', dataKey: 'customerJobNumber' },
  { key: 'includeQbEstimateNumber', label: 'QB Estimate #:', dataKey: 'qbEstimateNumber', requiresValue: true },
  { key: 'includeEstimateDate', label: 'Estimate Date:', dataKey: 'estimateDate' },
  { key: 'includeValidUntilDate', label: 'Valid Until:', dataKey: 'validUntilDate' },
  { key: 'includeSubtotal', label: 'Subtotal:', dataKey: 'subtotal' },
  { key: 'includeTax', label: 'Tax:', dataKey: 'tax' },
  { key: 'includeTotal', label: 'Total:', dataKey: 'total', isTotal: true }
];

// =============================================
// INTERFACES
// =============================================

/**
 * Company settings for email footer
 */
export interface CompanySettings {
  company_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  company_website: string | null;
  company_business_hours: string | null;
  company_logo_base64: string | null;
}

/**
 * Variables available for template substitution
 */
export interface EmailVariables {
  customerName?: string;
  jobName?: string;
  customerJobNumber?: string;
  qbEstimateNumber?: string;
  estimateNumber?: string;
  total?: string;
}

/**
 * Data for building the summary box (pre-formatted strings)
 */
export interface SummaryData {
  jobName?: string;
  customerJobNumber?: string;
  qbEstimateNumber?: string;
  subtotal?: string;
  tax?: string;
  total?: string;
  estimateDate?: string;
  validUntilDate?: string;
}

/**
 * Data for building summary with numeric values (auto-formatted)
 */
export interface SummaryDataNumeric {
  jobName?: string;
  customerJobNumber?: string;
  qbEstimateNumber?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  estimateDate?: string;
  validUntilDate?: string;
}

/**
 * Email preview input data (from estimate repository)
 */
export interface EmailPreviewEstimateData {
  customer_name?: string;
  job_name?: string;
  job_code?: string;
  customer_job_number?: string;
  qb_doc_number?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  estimate_date?: string;
}

/**
 * Email content from frontend (all fields optional for flexibility)
 */
export interface EmailPreviewContent {
  subject?: string;
  beginning?: string;
  end?: string;
  summaryConfig?: Partial<EmailSummaryConfig>;
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

// =============================================
// SERVICE CLASS
// =============================================

export class EstimateEmailService {
  /**
   * Load company settings from rbac_settings table
   */
  async loadCompanySettings(): Promise<CompanySettings> {
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
   * Substitute template variables in email subject/body
   * Variables: {{customerName}}, {{jobName}}, {{customerJobNumber}},
   *            {{jobNameWithRef}}, {{qbEstimateNumber}}, {{estimateNumber}}, {{total}}
   */
  substituteEmailVariables(template: string, variables: EmailVariables): string {
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
   * Build the summary box HTML based on config checkboxes
   * Uses pre-formatted string values (for actual email sending)
   */
  buildSummaryBoxHtml(config: Partial<EmailSummaryConfig> | null, data: SummaryData): string {
    if (!config) return '';

    const rows: string[] = [];

    // Use SUMMARY_FIELDS for consistent ordering and labels
    for (const field of SUMMARY_FIELDS) {
      if (!config[field.key]) continue;

      const value = data[field.dataKey as keyof SummaryData];
      if (field.requiresValue && !value) continue;

      const displayValue = value || '-';

      if (field.isTotal) {
        rows.push(`<tr style="background-color: #87CEEB;"><td style="padding: 8px 12px; font-weight: 700; color: #333; text-align: left;">${field.label}</td><td style="padding: 8px 12px; font-weight: 700; color: #333; text-align: right;">${displayValue}</td></tr>`);
      } else {
        rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; width: 40%; text-align: left;">${field.label}</td><td style="padding: 6px 12px; color: #333; text-align: right;">${displayValue}</td></tr>`);
      }
    }

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
   * Build summary HTML with numeric values (auto-formats currency/dates)
   * Used by email preview modal
   */
  buildSummaryHtmlFromNumeric(config: Partial<EmailSummaryConfig> | null, data: SummaryDataNumeric): string {
    if (!config) return '';

    // Calculate valid until date if needed
    let validUntilDate: string | undefined;
    if (config.includeValidUntilDate && data.estimateDate) {
      // Extract date part from string (handles YYYY-MM-DD and ISO formats)
      const dateMatch = data.estimateDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed
        const day = parseInt(dateMatch[3], 10);
        // Create local date and add 30 days
        const d = new Date(year, month, day);
        d.setDate(d.getDate() + 30);
        const monthName = d.toLocaleDateString('en-US', { month: 'short' });
        validUntilDate = `${monthName}. ${d.getDate()}, ${d.getFullYear()}`;
      }
    }

    // Convert numeric data to formatted strings
    const formattedData: SummaryData = {
      jobName: data.jobName,
      customerJobNumber: data.customerJobNumber,
      qbEstimateNumber: data.qbEstimateNumber,
      subtotal: data.subtotal !== undefined ? this.formatCurrency(data.subtotal) : undefined,
      tax: data.tax !== undefined ? this.formatCurrency(data.tax) : undefined,
      total: data.total !== undefined ? this.formatCurrency(data.total) : undefined,
      estimateDate: data.estimateDate ? this.formatDate(data.estimateDate) : undefined,
      validUntilDate
    };

    return this.buildSummaryBoxHtml(config, formattedData);
  }

  /**
   * Build the email footer HTML from company settings
   */
  buildEmailFooterHtml(settings: CompanySettings): string {
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
   */
  buildEmailHtml(
    beginning: string | null,
    summaryHtml: string,
    end: string | null,
    footerHtml: string,
    logoBase64: string | null = null
  ): string {
    const beginningHtml = beginning
      ? `<div class="content">${this.escapeHtml(beginning).replace(/\n/g, '<br>')}</div>`
      : '';
    const endHtml = end
      ? `<div class="content">${this.escapeHtml(end).replace(/\n/g, '<br>')}</div>`
      : '';

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
   * Generate email preview HTML for modal display
   * Moved from EstimateWorkflowService for better separation
   * Accepts any object with the required estimate fields (for repository compatibility)
   */
  async generateEmailPreviewHtml(
    estimate: EmailPreviewEstimateData | Record<string, any>,
    emailContent?: EmailPreviewContent
  ): Promise<{ subject: string; html: string }> {
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

    // Process beginning/end text with variable substitution
    const beginningText = this.substituteTemplateVariables(emailContent?.beginning || '', templateVars);
    const endText = this.substituteTemplateVariables(emailContent?.end || '', templateVars);

    // Build summary data using database-calculated totals
    const summaryData: SummaryDataNumeric = {
      jobName: emailContent?.estimateData?.jobName || estimate.job_name,
      customerJobNumber: emailContent?.estimateData?.customerJobNumber || estimate.customer_job_number,
      qbEstimateNumber: emailContent?.estimateData?.qbEstimateNumber || estimate.qb_doc_number,
      subtotal: Number(estimate.subtotal) || 0,
      tax: Number(estimate.tax_amount) || 0,
      total: Number(estimate.total_amount) || 0,
      estimateDate: emailContent?.estimateData?.estimateDate || estimate.estimate_date
    };

    // Build summary HTML
    const summaryHtml = this.buildSummaryHtmlFromNumeric(
      emailContent?.summaryConfig || null,
      summaryData
    );

    // Load company settings and build footer
    const companySettings = await this.loadCompanySettings();
    const footerHtml = this.buildEmailFooterHtml(companySettings);

    // Build logo HTML
    const logoHtml = companySettings.company_logo_base64
      ? `<div class="logo" style="margin-bottom: 20px;"><img src="data:image/png;base64,${companySettings.company_logo_base64}" alt="Company Logo" style="max-width: 200px; height: auto;" /><hr style="border: none; border-top: 1px solid #ccc; margin: 15px auto 0; width: 80%;" /></div>`
      : '';

    // Build full HTML
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 2px solid #87CEEB; border-radius: 24px; background-color: #f5f5f5; }
            .logo { text-align: center; }
            .content { margin: 20px 0; white-space: pre-wrap; text-align: center; }
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

    return { subject, html: html.trim() };
  }

  /**
   * Substitute template variables (generic version)
   */
  substituteTemplateVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      variables[key] ?? match
    );
  }

  /**
   * Get estimate send template (for auto-filling email subject/body)
   */
  async getEstimateSendTemplate(): Promise<{
    subject: string;
    body: string;
    body_beginning: string | null;
    body_end: string | null;
  } | null> {
    const rows = await query(
      `SELECT subject, body, body_beginning, body_end FROM email_templates WHERE template_key = 'estimate_send' AND is_active = 1`,
      []
    ) as RowDataPacket[];

    return rows.length > 0 ? {
      subject: rows[0].subject,
      body: rows[0].body,
      body_beginning: rows[0].body_beginning,
      body_end: rows[0].body_end
    } : null;
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string): string {
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
  formatCurrency(amount: string | number | null | undefined): string {
    if (amount === null || amount === undefined) return '';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format date for display (Jan. 1, 2025)
   *
   * IMPORTANT: Database DATE columns are returned as Date objects by mysql2
   * at UTC midnight (e.g., 2025-12-23T00:00:00.000Z). We extract the UTC date
   * components to avoid timezone issues.
   * MUST match frontend emailFormatUtils.formatDate()
   */
  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';

    let year: number, month: number, day: number;

    if (date instanceof Date) {
      // Date objects from mysql2 are at UTC midnight - use UTC getters
      if (isNaN(date.getTime())) return '';
      year = date.getUTCFullYear();
      month = date.getUTCMonth(); // 0-indexed
      day = date.getUTCDate();
    } else if (typeof date === 'string') {
      // Extract date part from string (handles YYYY-MM-DD and ISO formats)
      const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dateMatch) return '';
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10) - 1; // Convert to 0-indexed
      day = parseInt(dateMatch[3], 10);
    } else {
      return '';
    }

    // Create a local date just for month name formatting
    const d = new Date(year, month, day);
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    return `${monthName}. ${day}, ${year}`;
  }
}

export const estimateEmailService = new EstimateEmailService();
