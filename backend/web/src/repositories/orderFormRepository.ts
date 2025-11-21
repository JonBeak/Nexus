/**
 * Order Form Repository
 * Data Access Layer for PDF Generation and Folder Management
 *
 * Extracted from orderRepository.ts - 2025-11-21
 * Handles all direct database operations for:
 * - Order folder tracking (SMB share)
 * - PDF form paths and versioning
 * - Staleness detection for regeneration
 */

import { query, pool } from '../config/database';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';
import { FormPaths, OrderDataForPDF } from '../types/orders';

export class OrderFormRepository {

  // =============================================
  // FOLDER TRACKING METHODS
  // =============================================

  /**
   * Get order folder details by order_number
   * Used for PDF generation, printing operations, and image management
   */
  async getOrderFolderDetails(orderNumber: number): Promise<{
    order_id: number;
    order_number: number;
    order_name: string;
    folder_name: string;
    folder_exists: boolean;
    folder_location: 'active' | 'finished' | 'none';
    is_migrated: boolean;
  } | null> {
    const rows = await query(
      `SELECT order_id, order_number, order_name, folder_name, folder_exists, folder_location, is_migrated
       FROM orders
       WHERE order_number = ?`,
      [orderNumber]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as {
      order_id: number;
      order_number: number;
      order_name: string;
      folder_name: string;
      folder_exists: boolean;
      folder_location: 'active' | 'finished' | 'none';
      is_migrated: boolean;
    };
  }

  /**
   * Check if folder name already exists in database (case-insensitive)
   * Used to prevent duplicate folder names before filesystem operations
   */
  async checkFolderNameConflict(folderName: string): Promise<boolean> {
    const rows = await query(
      `SELECT order_id FROM orders WHERE LOWER(folder_name) = LOWER(?) LIMIT 1`,
      [folderName]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Get folder location for an order
   * Returns 'active', 'finished', or 'none' based on folder_location column
   */
  async getOrderFolderLocation(orderId: number): Promise<'active' | 'finished' | 'none'> {
    const rows = await query(
      `SELECT folder_location FROM orders WHERE order_id = ?`,
      [orderId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      throw new Error('Order not found');
    }

    return rows[0].folder_location as 'active' | 'finished' | 'none';
  }

  /**
   * Update folder tracking information for an order
   * Accepts optional connection parameter for transaction support
   */
  async updateFolderTracking(
    orderId: number,
    folderName: string,
    folderExists: boolean,
    folderLocation: 'active' | 'finished' | 'none',
    connection?: PoolConnection
  ): Promise<void> {
    const db = connection || pool;
    await db.execute(
      `UPDATE orders
       SET folder_name = ?,
           folder_exists = ?,
           folder_location = ?
       WHERE order_id = ?`,
      [folderName, folderExists, folderLocation, orderId]
    );
  }

  // =============================================
  // PDF GENERATION METHODS
  // =============================================

  /**
   * Get complete order data with customer info and parts for PDF generation
   */
  async getOrderWithCustomerForPDF(orderId: number): Promise<OrderDataForPDF | null> {
    // Fetch order with customer info
    const orderRows = await query(`
      SELECT
        o.order_id,
        o.order_number,
        o.order_name,
        o.order_date,
        o.due_date,
        o.hard_due_date_time,
        o.customer_po,
        o.customer_job_number,
        o.production_notes,
        o.manufacturing_note,
        o.internal_note,
        o.status,
        o.form_version,
        o.sign_image_path,
        o.crop_top,
        o.crop_right,
        o.crop_bottom,
        o.crop_left,
        o.shipping_required,
        o.tax_name,
        o.folder_name,
        o.folder_location,
        o.is_migrated,
        o.customer_id,
        c.company_name,
        c.contact_first_name,
        c.contact_last_name,
        c.phone,
        c.email,
        c.pattern_yes_or_no,
        c.pattern_type,
        c.wiring_diagram_yes_or_no
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = ?
    `, [orderId]) as RowDataPacket[];

    if (orderRows.length === 0) {
      return null;
    }

    const order = orderRows[0];

    // Fetch order parts
    const parts = await query(`
      SELECT
        part_id,
        order_id,
        part_number,
        display_number,
        is_parent,
        product_type,
        part_scope,
        specs_display_name,
        product_type_id,
        quantity,
        specifications,
        production_notes,
        qb_item_name,
        invoice_description,
        unit_price,
        extended_price
      FROM order_parts
      WHERE order_id = ?
      ORDER BY part_number
    `, [orderId]) as RowDataPacket[];

    return {
      ...order,
      parts
    } as OrderDataForPDF;
  }

  /**
   * Update order form version number
   */
  async updateOrderFormVersion(orderId: number, version: number): Promise<void> {
    await query(
      'UPDATE orders SET form_version = ? WHERE order_id = ?',
      [version, orderId]
    );
  }

  /**
   * Insert or update order form paths (upsert)
   */
  async upsertOrderFormPaths(
    orderId: number,
    version: number,
    paths: FormPaths,
    dataHash: string,
    userId?: number
  ): Promise<void> {
    // Check if version record exists
    const existing = await query(
      'SELECT version_id FROM order_form_versions WHERE order_id = ? AND version_number = ?',
      [orderId, version]
    ) as RowDataPacket[];

    if (existing.length > 0) {
      // Update existing record
      await query(
        `UPDATE order_form_versions
         SET master_form_path = ?, estimate_form_path = ?, shop_form_path = ?, customer_form_path = ?, packing_list_path = ?, data_hash = ?
         WHERE order_id = ? AND version_number = ?`,
        [paths.masterForm, paths.estimateForm, paths.shopForm, paths.customerForm, paths.packingList, dataHash, orderId, version]
      );
    } else {
      // Insert new record
      await query(
        `INSERT INTO order_form_versions
         (order_id, version_number, master_form_path, estimate_form_path, shop_form_path, customer_form_path, packing_list_path, data_hash, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, version, paths.masterForm, paths.estimateForm, paths.shopForm, paths.customerForm, paths.packingList, dataHash, userId || null]
      );
    }
  }

  /**
   * Get order form paths by order ID and optional version
   */
  async getOrderFormPaths(orderId: number, version?: number): Promise<FormPaths | null> {
    let sql = `
      SELECT master_form_path, estimate_form_path, shop_form_path, customer_form_path, packing_list_path
      FROM order_form_versions
      WHERE order_id = ?
    `;

    const params: any[] = [orderId];

    if (version) {
      sql += ' AND version_number = ?';
      params.push(version);
    } else {
      // Get latest version
      sql += ' ORDER BY version_number DESC LIMIT 1';
    }

    const rows = await query(sql, params) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      masterForm: row.master_form_path,
      estimateForm: row.estimate_form_path,
      shopForm: row.shop_form_path,
      customerForm: row.customer_form_path,
      packingList: row.packing_list_path
    };
  }

  /**
   * Check if order forms exist for an order
   */
  async orderFormsExist(orderId: number): Promise<boolean> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM order_form_versions WHERE order_id = ?',
      [orderId]
    ) as RowDataPacket[];

    return rows[0].count > 0;
  }

  /**
   * Check if order form PDFs are stale (order data changed since PDFs were generated)
   * Returns staleness info including whether PDFs exist and if they're stale
   */
  async checkOrderFormStaleness(orderId: number): Promise<{
    exists: boolean;
    isStale: boolean;
    pdfGeneratedAt: Date | null;
    currentHash: string | null;
    storedHash: string | null;
    formPaths: FormPaths | null;
  }> {
    // Get latest form version info
    const formRows = await query(
      `SELECT
        created_at,
        data_hash,
        master_form_path,
        estimate_form_path,
        shop_form_path,
        customer_form_path,
        packing_list_path
      FROM order_form_versions
      WHERE order_id = ?
      ORDER BY version_number DESC
      LIMIT 1`,
      [orderId]
    ) as RowDataPacket[];

    // No PDFs exist
    if (formRows.length === 0) {
      return {
        exists: false,
        isStale: false,
        pdfGeneratedAt: null,
        currentHash: null,
        storedHash: null,
        formPaths: null
      };
    }

    const formRow = formRows[0];
    const pdfGeneratedAt = formRow.created_at;
    const storedHash = formRow.data_hash;

    // Calculate current hash from order data
    const { calculateOrderDataHash } = await import('../utils/orderDataHashService');
    const currentHash = await calculateOrderDataHash(orderId);

    // Check if stale: current data hash differs from stored hash
    const isStale = currentHash !== storedHash;

    return {
      exists: true,
      isStale,
      pdfGeneratedAt,
      currentHash,
      storedHash,
      formPaths: {
        masterForm: formRow.master_form_path,
        estimateForm: formRow.estimate_form_path,
        shopForm: formRow.shop_form_path,
        customerForm: formRow.customer_form_path,
        packingList: formRow.packing_list_path
      }
    };
  }
}

export const orderFormRepository = new OrderFormRepository();
