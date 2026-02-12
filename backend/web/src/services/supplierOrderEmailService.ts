/**
 * Supplier Order Email Service
 * Sends PO emails to suppliers when orders are submitted via "Place Order"
 * Uses existing Gmail infrastructure (gmailAuthService)
 * Created: 2026-02-10
 */

import { createGmailClient } from './gmailAuthService';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { SupplierOrderRepository } from '../repositories/supplierOrderRepository';
import { escapeHtml, escapeHtmlWithLineBreaks } from '../utils/htmlUtils';

// Gmail API Configuration
const GMAIL_ENABLED = process.env.GMAIL_ENABLED === 'true';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'Sign House';
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';

// Navy blue color scheme (matches gmailService ORDER_COLORS)
const COLORS = {
  primary: '#1e3a5f',
  headerText: '#ffffff',
  border: '#1e3a5f',
  footer: '#f8fafc',
};

interface CompanySettings {
  company_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  company_website: string | null;
  company_logo_base64: string | null;
}

export interface POEmailResult {
  success: boolean;
  messageId?: string;
  reason?: string;
  error?: string;
}

/** Typed shape for the order object passed to buildHtmlBody / buildPlainText */
interface POEmailData {
  order_number: string;
  order_date: Date | string | null;
  delivery_method: string;
  supplier_name?: string;
  subtotal?: number;
  tax_amount?: number;
  shipping_cost?: number;
  total_amount?: number;
  notes?: string | null;
  items?: POEmailItem[];
}

interface POEmailItem {
  product_description: string;
  sku?: string | null;
  quantity_ordered: number;
  unit?: string | null;
  unit_of_measure?: string | null;
  unit_price?: number | null;
  line_total?: number | null;
  material_requirement_order_number?: string | null;
  material_requirement_order_name?: string | null;
  material_requirement_customer_name?: string | null;
}

interface JobRef {
  orderNumber: string;
  orderName: string | null;
  customerName: string | null;
}

interface ConsolidatedPOItem {
  product_description: string;
  sku: string | null;
  quantity_ordered: number;
  unit: string;
  unit_price: number | null;
  line_total: number | null;
  jobRefs: JobRef[];
  hasStock: boolean;
}

/**
 * Load company settings from rbac_settings table (same pattern as gmailService)
 */
async function loadCompanySettings(): Promise<CompanySettings> {
  try {
    const rows = await query(
      `SELECT setting_name, setting_value FROM rbac_settings
       WHERE setting_name IN ('company_name', 'company_phone', 'company_email', 'company_address', 'company_website', 'company_logo_base64')`,
      []
    ) as RowDataPacket[];

    const settings: CompanySettings = {
      company_name: process.env.COMPANY_NAME || null,
      company_phone: process.env.COMPANY_PHONE || null,
      company_email: process.env.COMPANY_EMAIL || null,
      company_address: process.env.COMPANY_ADDRESS || null,
      company_website: process.env.COMPANY_WEBSITE || null,
      company_logo_base64: null,
    };

    for (const row of rows) {
      const key = row.setting_name as keyof CompanySettings;
      if (row.setting_value) {
        settings[key] = row.setting_value;
      }
    }

    return settings;
  } catch (error) {
    console.error('[PO Email] Error loading company settings:', error);
    return {
      company_name: process.env.COMPANY_NAME || null,
      company_phone: process.env.COMPANY_PHONE || null,
      company_email: process.env.COMPANY_EMAIL || null,
      company_address: process.env.COMPANY_ADDRESS || null,
      company_website: process.env.COMPANY_WEBSITE || null,
      company_logo_base64: null,
    };
  }
}

/**
 * Send PO email with simple 2-attempt retry
 */
async function sendWithRetry(gmail: any, encodedMessage: string): Promise<any> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
    } catch (error: any) {
      if (attempt === 2 || error.code === 400 || error.code === 403) throw error;
      console.log(`⚠️ [PO Email] Send failed (attempt ${attempt}/2), retrying in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(dateStr: Date | string | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Consolidate identical items (same description + SKU + unit) into grouped lines.
 * Mirrors the frontend DraftPOCard grouping logic.
 */
function consolidateItems(items: POEmailItem[]): ConsolidatedPOItem[] {
  const map = new Map<string, ConsolidatedPOItem>();

  for (const item of items) {
    const desc = item.product_description || 'Unknown Product';
    const sku = item.sku || '';
    const unit = item.unit || item.unit_of_measure || 'each';
    const key = `${desc.toLowerCase()}|${sku.toLowerCase()}|${unit.toLowerCase()}`;
    const orderNum = item.material_requirement_order_number
      ? String(item.material_requirement_order_number)
      : null;

    const existing = map.get(key);
    if (existing) {
      existing.quantity_ordered += Number(item.quantity_ordered);
      if (existing.unit_price !== null) {
        existing.line_total = existing.unit_price * existing.quantity_ordered;
      }
      if (orderNum) {
        if (!existing.jobRefs.some(r => r.orderNumber === orderNum)) {
          existing.jobRefs.push({
            orderNumber: orderNum,
            orderName: item.material_requirement_order_name || null,
            customerName: item.material_requirement_customer_name || null,
          });
        }
      } else {
        existing.hasStock = true;
      }
    } else {
      const unitPrice = Number(item.unit_price) > 0 ? Number(item.unit_price) : null;
      map.set(key, {
        product_description: desc,
        sku: sku || null,
        quantity_ordered: Number(item.quantity_ordered),
        unit,
        unit_price: unitPrice,
        line_total: unitPrice ? unitPrice * Number(item.quantity_ordered) : null,
        jobRefs: orderNum ? [{
          orderNumber: orderNum,
          orderName: item.material_requirement_order_name || null,
          customerName: item.material_requirement_customer_name || null,
        }] : [],
        hasStock: !orderNum,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Build HTML email body for the PO
 */
function buildHtmlBody(
  order: POEmailData,
  items: POEmailItem[],
  settings: CompanySettings,
  customOpening?: string,
  customClosing?: string,
  showPricing: boolean = false,
  isInternal: boolean = false
): string {
  const companyName = escapeHtml(settings.company_name || 'Sign House');
  const orderNumber = escapeHtml(order.order_number);
  const deliveryMethod = order.delivery_method === 'pickup' ? 'Pickup' : 'Shipping';
  const orderDate = formatDate(order.order_date);

  // Consolidate identical items (group by description+SKU+unit, sum quantities)
  const consolidated = consolidateItems(items);
  const colSpan = showPricing ? 5 : 3;

  // Build items rows - conditionally show pricing columns
  const itemRows = consolidated.map((item) => {
    let row: string;
    if (showPricing) {
      row = `
    <tr style="border-bottom: ${isInternal ? 'none' : '1px solid #e5e7eb'};">
      <td style="padding: 10px 12px; font-size: 14px;">${escapeHtml(item.product_description)}</td>
      <td style="padding: 10px 12px; font-size: 14px; color: #6b7280;">${escapeHtml(item.sku || '—')}</td>
      <td style="padding: 10px 12px; font-size: 14px; text-align: center;">${item.quantity_ordered} ${escapeHtml(item.unit)}</td>
      <td style="padding: 10px 12px; font-size: 14px; text-align: right;">${item.unit_price !== null ? formatCurrency(item.unit_price) : '—'}</td>
      <td style="padding: 10px 12px; font-size: 14px; text-align: right; font-weight: 500;">${item.line_total !== null ? formatCurrency(item.line_total) : '—'}</td>
    </tr>`;
    } else {
      row = `
    <tr style="border-bottom: ${isInternal ? 'none' : '1px solid #e5e7eb'};">
      <td style="padding: 10px 12px; font-size: 14px;">${escapeHtml(item.product_description)}</td>
      <td style="padding: 10px 12px; font-size: 14px; color: #6b7280;">${escapeHtml(item.sku || '—')}</td>
      <td style="padding: 10px 12px; font-size: 14px; text-align: center;">${item.quantity_ordered} ${escapeHtml(item.unit)}</td>
    </tr>`;
    }

    // Internal email: append job reference subtext rows (one per job)
    if (isInternal) {
      const refLines: string[] = [];
      for (const job of item.jobRefs) {
        const parts = [`#${job.orderNumber}`];
        if (job.orderName) parts.push(job.orderName);
        if (job.customerName) parts.push(`(${job.customerName})`);
        refLines.push(`↳ ${escapeHtml(parts.join(' — '))}`);
      }
      if (item.hasStock) refLines.push('↳ Stock');

      refLines.forEach((line, idx) => {
        const isLast = idx === refLines.length - 1;
        row += `
    <tr style="border-bottom: ${isLast ? '1px solid #e5e7eb' : 'none'};">
      <td colspan="${colSpan}" style="padding: 0 12px ${isLast ? '8px' : '2px'} 24px; font-size: 12px; color: #9ca3af;">${line}</td>
    </tr>`;
      });
    }

    return row;
  }).join('');

  const subtotal = Number(order.subtotal || 0);
  const taxAmount = Number(order.tax_amount || 0);
  const shippingCost = Number(order.shipping_cost || 0);
  const totalAmount = Number(order.total_amount || 0);

  // Logo header — always use data URI (works in both Gmail and Outlook.com)
  let logoSrc = '';
  if (settings.company_logo_base64) {
    logoSrc = settings.company_logo_base64.startsWith('data:')
      ? settings.company_logo_base64
      : `data:image/png;base64,${settings.company_logo_base64}`;
  }
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${companyName}" style="max-height: 50px; max-width: 200px;" />`
    : `<span style="font-size: 20px; font-weight: bold; color: ${COLORS.headerText};">${companyName}</span>`;

  // Notes section
  const notesHtml = order.notes
    ? `<div style="margin-top: 20px; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
         <strong style="font-size: 13px; color: #374151;">Notes:</strong>
         <p style="margin: 4px 0 0; font-size: 14px; color: #4b5563;">${escapeHtml(order.notes)}</p>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background: #f3f4f6;">
  <div style="max-width: 640px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: ${COLORS.primary}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
      <table style="width: 100%;">
        <tr>
          <td style="text-align: left; vertical-align: middle; width: 100%;">
            <span style="font-size: 20px; font-weight: bold; color: ${COLORS.headerText};">Purchase Order</span>
          </td>
          <td style="text-align: right; vertical-align: middle; white-space: nowrap;">${logoHtml}</td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">

      <!-- Greeting -->
      ${customOpening
        ? `<div style="font-size: 14px; color: #374151; margin: 0 0 20px; line-height: 1.6;">${escapeHtmlWithLineBreaks(customOpening)}</div>`
        : `<p style="font-size: 14px; color: #374151; margin: 0 0 16px;">Hi${order.supplier_name ? ` ${escapeHtml(order.supplier_name)}` : ''},<br/><br/></p>
      <p style="font-size: 14px; color: #4b5563; margin: 0 0 20px;">Please find our purchase order details below.</p>`
      }

      <!-- PO Details -->
      <div style="margin-bottom: 20px; padding: 14px 16px; background: #f0f4f8; border-radius: 6px; border-left: 4px solid ${COLORS.primary};">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 3px 0;"><strong>PO Number:</strong> ${orderNumber}</td>
            <td style="padding: 3px 0; text-align: right;"><strong>Date:</strong> ${orderDate}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;"><strong>Delivery:</strong> ${deliveryMethod}</td>
            <td style="padding: 3px 0; text-align: right;">&nbsp;</td>
          </tr>
        </table>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: ${COLORS.primary}; color: ${COLORS.headerText};">
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600;">Description</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600;">SKU</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 13px; font-weight: 600;">Qty</th>
            ${showPricing ? `<th style="padding: 10px 12px; text-align: right; font-size: 13px; font-weight: 600;">Unit Price</th>` : ''}
            ${showPricing ? `<th style="padding: 10px 12px; text-align: right; font-size: 13px; font-weight: 600;">Total</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals (only show if pricing is enabled) -->
      ${showPricing ? `
      <div style="text-align: right; margin-bottom: 16px;">
        ${subtotal > 0 ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Subtotal: ${formatCurrency(subtotal)}</div>` : ''}
        ${taxAmount > 0 ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Tax: ${formatCurrency(taxAmount)}</div>` : ''}
        ${shippingCost > 0 ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Shipping: ${formatCurrency(shippingCost)}</div>` : ''}
        ${totalAmount > 0 ? `<div style="font-size: 16px; font-weight: bold; color: ${COLORS.primary};">Total: ${formatCurrency(totalAmount)}</div>` : ''}
      </div>
      ` : ''}

      ${notesHtml}

      <!-- Closing -->
      <div style="margin-top: 24px; font-size: 14px; color: #374151; line-height: 1.6;">
        ${customClosing
          ? escapeHtmlWithLineBreaks(customClosing)
          : `<p style="margin: 0 0 12px;">Thank you for your prompt attention to this order. Please don't hesitate to reach out if you have any questions.</p>
        <p style="margin: 0;">Best regards,<br/><strong>${companyName}</strong></p>`
        }
      </div>
    </div>

    <!-- Footer -->
    <div style="background: ${COLORS.footer}; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
      <div style="font-size: 13px; color: #6b7280;">
        ${companyName}
        ${settings.company_phone ? ` · ${escapeHtml(settings.company_phone)}` : ''}
        ${settings.company_email ? ` · ${escapeHtml(settings.company_email)}` : ''}
      </div>
      ${settings.company_address ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${escapeHtml(settings.company_address)}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build plain text version of the PO email
 */
function buildPlainText(
  order: POEmailData,
  items: POEmailItem[],
  settings: CompanySettings,
  customOpening?: string,
  customClosing?: string
): string {
  const companyName = settings.company_name || 'Sign House';
  const defaultGreeting = order.supplier_name ? `Hi ${order.supplier_name},` : 'Hi,';
  const openingLines = customOpening
    ? [customOpening]
    : [defaultGreeting, 'Please find our purchase order details below.'];
  const lines: string[] = [
    `PURCHASE ORDER - ${order.order_number}`,
    `From: ${companyName}`,
    `Date: ${formatDate(order.order_date)}`,
    `Delivery: ${order.delivery_method === 'pickup' ? 'Pickup' : 'Shipping'}`,
    '',
    ...openingLines,
    '',
    'ITEMS:',
    '-'.repeat(60),
  ];

  for (const item of items) {
    const price = Number(item.unit_price) > 0 ? ` @ ${formatCurrency(Number(item.unit_price))}` : '';
    const total = Number(item.line_total) > 0 ? ` = ${formatCurrency(Number(item.line_total))}` : '';
    lines.push(`• ${item.product_description}${item.sku ? ` (SKU: ${item.sku})` : ''}`);
    lines.push(`  Qty: ${item.quantity_ordered} ${item.unit || item.unit_of_measure || 'each'}${price}${total}`);
  }

  lines.push('-'.repeat(60));

  const totalAmount = Number(order.total_amount || 0);
  if (totalAmount > 0) {
    lines.push(`Total: ${formatCurrency(totalAmount)}`);
  }

  if (order.notes) {
    lines.push('', `Notes: ${order.notes}`);
  }

  if (customClosing) {
    lines.push('', customClosing);
  } else {
    lines.push(
      '',
      'Thank you for your prompt attention to this order.',
      'Please don\'t hesitate to reach out if you have any questions.',
      '',
      'Best regards,',
      companyName,
    );
  }
  if (settings.company_phone) lines.push(`Phone: ${settings.company_phone}`);
  if (settings.company_email) lines.push(`Email: ${settings.company_email}`);

  return lines.join('\n');
}

/**
 * Generate preview HTML for the PO email (same template used for sending).
 * Called from the frontend confirmation dialog so preview = sent email.
 */
export interface POPreviewRequest {
  items: POEmailItem[];
  deliveryMethod: string;
  opening?: string;
  closing?: string;
  supplierName?: string;
  showPricing?: boolean;
}

export async function generatePOPreviewHtml(req: POPreviewRequest): Promise<{ html: string }> {
  const settings = await loadCompanySettings();

  // Calculate totals from items
  const subtotal = req.items.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);

  const order: POEmailData = {
    order_number: '{PO#}',
    order_date: new Date(),
    delivery_method: req.deliveryMethod,
    supplier_name: req.supplierName,
    subtotal,
    tax_amount: 0,
    shipping_cost: 0,
    total_amount: subtotal,
  };

  const html = buildHtmlBody(order, req.items, settings, req.opening, req.closing, req.showPricing ?? true);
  return { html };
}

/**
 * Main entry point: Send PO email to supplier
 */
export interface POEmailOverrides {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  opening?: string;
  closing?: string;
}

export async function sendPurchaseOrderEmail(
  orderId: number,
  overrides?: POEmailOverrides,
  showPricing: boolean = false
): Promise<POEmailResult> {
  const repository = new SupplierOrderRepository();

  // Load order with items
  const order = await repository.findByIdWithItems(orderId);
  if (!order) {
    return { success: false, reason: 'order_not_found' };
  }

  // Determine recipient: override or supplier contact email
  const recipientEmail = overrides?.to?.trim() || order.supplier_contact_email;
  if (!recipientEmail) {
    return { success: false, reason: 'no_contact_email' };
  }

  // Load company settings for branding
  const settings = await loadCompanySettings();
  const companyName = settings.company_name || 'Sign House';

  // Build email content — replace {PO#} variable with actual generated PO number
  const rawSubject = overrides?.subject?.trim() || `Purchase Order ${order.order_number} - ${companyName}`;
  const subject = rawSubject.replace(/\{PO#\}/g, order.order_number);
  const html = buildHtmlBody(order, order.items || [], settings, overrides?.opening, overrides?.closing, showPricing, showPricing);
  const text = buildPlainText(order, order.items || [], settings, overrides?.opening, overrides?.closing);

  // CC list from overrides
  const ccList: string[] = [];
  if (overrides?.cc?.trim()) {
    ccList.push(...overrides.cc.split(',').map(e => e.trim()).filter(Boolean));
  }

  // BCC list: override takes precedence, otherwise fall back to env default
  const bccList: string[] = [];
  if (overrides?.bcc !== undefined) {
    if (overrides.bcc.trim()) {
      bccList.push(...overrides.bcc.split(',').map(e => e.trim()).filter(Boolean));
    }
  } else if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
    bccList.push(BCC_EMAIL);
  }

  // Gmail disabled mode: log and return success
  if (!GMAIL_ENABLED) {
    console.log('\n' + '='.repeat(80));
    console.log('[GMAIL DISABLED] PO email would be sent:');
    console.log('='.repeat(80));
    console.log(`  From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
    console.log(`  To: ${recipientEmail}`);
    if (ccList.length > 0) console.log(`  Cc: ${ccList.join(', ')}`);
    if (bccList.length > 0) console.log(`  Bcc: ${bccList.join(', ')}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Items: ${order.items?.length || 0}`);
    console.log('\n📄 PLAIN TEXT BODY:');
    console.log('-'.repeat(60));
    console.log(text);
    console.log('-'.repeat(60));
    console.log('✅ PO email would be sent (Gmail disabled)');
    console.log('='.repeat(80) + '\n');

    return { success: true, messageId: `po_disabled_${Date.now()}` };
  }

  try {
    console.log(`📧 [PO Email] Sending PO ${order.order_number} to ${recipientEmail}...`);

    const gmail = await createGmailClient();

    // Build MIME message — logo is embedded as data URI in HTML, so simple
    // multipart/alternative (text + html) is all we need. No CID / multipart/related.
    const altBoundary = '----=_Part_Alt_' + Date.now() + '_' + Math.random().toString(36).substring(7);

    // Email headers
    const headers: string[] = [
      `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
      `To: ${recipientEmail}`,
    ];
    if (ccList.length > 0) headers.push(`Cc: ${ccList.join(', ')}`);
    if (bccList.length > 0) headers.push(`Bcc: ${bccList.join(', ')}`);
    headers.push(`Subject: ${subject}`, `MIME-Version: 1.0`);
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

    const bodyParts: string[] = [
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      text,
      `--${altBoundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
      `--${altBoundary}--`,
    ];

    const email = headers.concat([''], bodyParts).join('\r\n');
    const encodedMessage = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await sendWithRetry(gmail, encodedMessage);

    console.log(`✅ [PO Email] Sent ${order.order_number} to ${recipientEmail} (ID: ${response.data.id})`);

    return { success: true, messageId: response.data.id || undefined };
  } catch (error: any) {
    console.error(`❌ [PO Email] Failed to send ${order.order_number}:`, error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
