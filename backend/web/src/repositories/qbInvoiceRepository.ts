/**
 * QuickBooks Invoice Repository
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-13
 *
 * Data access layer for:
 * - Order invoice tracking (qb_invoice columns on orders table)
 * - Scheduled emails management
 * - Email templates retrieval
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  OrderInvoiceRecord,
  OrderInvoiceUpdateData,
  ScheduledEmail,
  ScheduledEmailInput,
  EmailTemplate,
  EmailStatus
} from '../types/qbInvoice';

// =============================================
// ORDER INVOICE TRACKING
// =============================================

/**
 * Get invoice-related data for an order
 */
export async function getOrderInvoiceRecord(orderId: number): Promise<OrderInvoiceRecord | null> {
  const rows = await query(
    `SELECT
      order_id,
      order_number,
      qb_invoice_id,
      qb_invoice_doc_number,
      qb_invoice_url,
      qb_invoice_synced_at,
      qb_invoice_data_hash,
      invoice_sent_at
    FROM orders
    WHERE order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    order_id: row.order_id,
    order_number: row.order_number,
    qb_invoice_id: row.qb_invoice_id,
    qb_invoice_doc_number: row.qb_invoice_doc_number,
    qb_invoice_url: row.qb_invoice_url,
    qb_invoice_synced_at: row.qb_invoice_synced_at,
    qb_invoice_data_hash: row.qb_invoice_data_hash,
    invoice_sent_at: row.invoice_sent_at
  };
}

/**
 * Get invoice record by order number
 */
export async function getOrderInvoiceByOrderNumber(orderNumber: number): Promise<OrderInvoiceRecord | null> {
  const rows = await query(
    `SELECT
      order_id,
      order_number,
      qb_invoice_id,
      qb_invoice_doc_number,
      qb_invoice_url,
      qb_invoice_synced_at,
      qb_invoice_data_hash,
      invoice_sent_at
    FROM orders
    WHERE order_number = ?`,
    [orderNumber]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    order_id: row.order_id,
    order_number: row.order_number,
    qb_invoice_id: row.qb_invoice_id,
    qb_invoice_doc_number: row.qb_invoice_doc_number,
    qb_invoice_url: row.qb_invoice_url,
    qb_invoice_synced_at: row.qb_invoice_synced_at,
    qb_invoice_data_hash: row.qb_invoice_data_hash,
    invoice_sent_at: row.invoice_sent_at
  };
}

/**
 * Update invoice-related columns on an order
 */
export async function updateOrderInvoiceRecord(
  orderId: number,
  data: OrderInvoiceUpdateData
): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.qb_invoice_id !== undefined) {
    updates.push('qb_invoice_id = ?');
    values.push(data.qb_invoice_id);
  }
  if (data.qb_invoice_doc_number !== undefined) {
    updates.push('qb_invoice_doc_number = ?');
    values.push(data.qb_invoice_doc_number);
  }
  if (data.qb_invoice_url !== undefined) {
    updates.push('qb_invoice_url = ?');
    values.push(data.qb_invoice_url);
  }
  if (data.qb_invoice_synced_at !== undefined) {
    updates.push('qb_invoice_synced_at = ?');
    values.push(data.qb_invoice_synced_at);
  }
  if (data.qb_invoice_data_hash !== undefined) {
    updates.push('qb_invoice_data_hash = ?');
    values.push(data.qb_invoice_data_hash);
  }
  if (data.invoice_sent_at !== undefined) {
    updates.push('invoice_sent_at = ?');
    values.push(data.invoice_sent_at);
  }

  if (updates.length === 0) {
    return; // Nothing to update
  }

  values.push(orderId);

  await query(
    `UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?`,
    values
  );
}

/**
 * Check if a QB invoice ID is already linked to another order
 */
export async function isInvoiceLinkedToAnotherOrder(
  qbInvoiceId: string,
  excludeOrderId?: number
): Promise<boolean> {
  let sql = 'SELECT order_id FROM orders WHERE qb_invoice_id = ?';
  const params: any[] = [qbInvoiceId];

  if (excludeOrderId) {
    sql += ' AND order_id != ?';
    params.push(excludeOrderId);
  }

  const rows = await query(sql, params) as RowDataPacket[];
  return rows.length > 0;
}

// =============================================
// SCHEDULED EMAILS
// =============================================

/**
 * Create a scheduled email
 */
export async function createScheduledEmail(data: ScheduledEmailInput): Promise<number> {
  const result = await query(
    `INSERT INTO scheduled_emails (
      order_id,
      email_type,
      recipient_emails,
      cc_emails,
      subject,
      body,
      scheduled_for,
      status,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      data.order_id,
      data.email_type,
      JSON.stringify(data.recipient_emails),
      data.cc_emails ? JSON.stringify(data.cc_emails) : null,
      data.subject,
      data.body,
      data.scheduled_for,
      data.created_by
    ]
  ) as ResultSetHeader;

  return result.insertId;
}

/**
 * Get a scheduled email by ID
 */
export async function getScheduledEmailById(id: number): Promise<ScheduledEmail | null> {
  const rows = await query(
    `SELECT * FROM scheduled_emails WHERE id = ?`,
    [id]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  return parseScheduledEmailRow(rows[0]);
}

/**
 * Get pending scheduled email for an order (if any)
 */
export async function getScheduledEmailForOrder(orderId: number): Promise<ScheduledEmail | null> {
  const rows = await query(
    `SELECT * FROM scheduled_emails
    WHERE order_id = ? AND status = 'pending'
    ORDER BY scheduled_for ASC
    LIMIT 1`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  return parseScheduledEmailRow(rows[0]);
}

/**
 * Get all pending scheduled emails that are due
 */
export async function getPendingScheduledEmails(): Promise<ScheduledEmail[]> {
  const rows = await query(
    `SELECT se.*, o.order_number
    FROM scheduled_emails se
    JOIN orders o ON se.order_id = o.order_id
    WHERE se.status = 'pending'
      AND se.scheduled_for <= NOW()
    ORDER BY se.scheduled_for ASC
    LIMIT 50`
  ) as RowDataPacket[];

  return rows.map(parseScheduledEmailRow);
}

/**
 * Update a scheduled email
 */
export async function updateScheduledEmail(
  id: number,
  updates: Partial<{
    subject: string;
    body: string;
    scheduled_for: Date;
    recipient_emails: string[];
    cc_emails: string[];
    status: EmailStatus;
    sent_at: Date;
    error_message: string;
  }>
): Promise<void> {
  const updateParts: string[] = [];
  const values: any[] = [];

  if (updates.subject !== undefined) {
    updateParts.push('subject = ?');
    values.push(updates.subject);
  }
  if (updates.body !== undefined) {
    updateParts.push('body = ?');
    values.push(updates.body);
  }
  if (updates.scheduled_for !== undefined) {
    updateParts.push('scheduled_for = ?');
    values.push(updates.scheduled_for);
  }
  if (updates.recipient_emails !== undefined) {
    updateParts.push('recipient_emails = ?');
    values.push(JSON.stringify(updates.recipient_emails));
  }
  if (updates.cc_emails !== undefined) {
    updateParts.push('cc_emails = ?');
    values.push(JSON.stringify(updates.cc_emails));
  }
  if (updates.status !== undefined) {
    updateParts.push('status = ?');
    values.push(updates.status);
  }
  if (updates.sent_at !== undefined) {
    updateParts.push('sent_at = ?');
    values.push(updates.sent_at);
  }
  if (updates.error_message !== undefined) {
    updateParts.push('error_message = ?');
    values.push(updates.error_message);
  }

  if (updateParts.length === 0) {
    return;
  }

  values.push(id);

  await query(
    `UPDATE scheduled_emails SET ${updateParts.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Cancel a scheduled email
 */
export async function cancelScheduledEmail(id: number): Promise<void> {
  await query(
    `UPDATE scheduled_emails SET status = 'cancelled' WHERE id = ? AND status = 'pending'`,
    [id]
  );
}

// =============================================
// EMAIL TEMPLATES
// =============================================

/**
 * Get email template by key
 */
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplate | null> {
  const rows = await query(
    `SELECT * FROM email_templates WHERE template_key = ? AND is_active = 1`,
    [templateKey]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  // MySQL JSON columns may be returned as objects or strings depending on driver version
  let variables = null;
  if (row.variables) {
    variables = typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables;
  }
  return {
    id: row.id,
    template_key: row.template_key,
    template_name: row.template_name,
    subject: row.subject,
    body: row.body,
    variables,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Get all active email templates
 */
export async function getAllEmailTemplates(): Promise<EmailTemplate[]> {
  const rows = await query(
    `SELECT * FROM email_templates WHERE is_active = 1 ORDER BY template_name`
  ) as RowDataPacket[];

  return rows.map(row => ({
    id: row.id,
    template_key: row.template_key,
    template_name: row.template_name,
    subject: row.subject,
    body: row.body,
    variables: row.variables ? JSON.parse(row.variables) : null,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function parseScheduledEmailRow(row: RowDataPacket): ScheduledEmail {
  return {
    id: row.id,
    order_id: row.order_id,
    email_type: row.email_type,
    recipient_emails: JSON.parse(row.recipient_emails),
    cc_emails: row.cc_emails ? JSON.parse(row.cc_emails) : null,
    subject: row.subject,
    body: row.body,
    scheduled_for: row.scheduled_for,
    status: row.status,
    sent_at: row.sent_at,
    error_message: row.error_message,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at
  };
}
