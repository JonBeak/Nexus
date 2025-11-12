/**
 * PDF Generation Service
 * Main orchestrator for generating all order forms
 *
 * Responsibilities:
 * - Orchestrate generation of all 4 PDF forms
 * - Handle form versioning and archiving
 * - Manage file system operations
 * - Store form paths in database
 */

import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import {
  getOrderStoragePath,
  STORAGE_CONFIG,
  ensureDirectory
} from '../../config/storage';

// =============================================
// TYPES
// =============================================

export interface FormGenerationOptions {
  orderId: number;
  createNewVersion?: boolean;
  userId?: number;
}

export interface FormPaths {
  masterForm: string;
  shopForm: string;
  customerForm: string;
  packingList: string;
}

export interface OrderDataForPDF {
  // Order info
  order_id: number;
  order_number: number;
  order_name: string;
  order_date: Date;
  due_date?: Date;
  hard_due_date_time?: string;  // TIME format "HH:mm:ss" or "HH:mm" from database
  customer_po?: string;
  customer_job_number?: string;
  point_persons?: Array<{ contact_email: string; contact_name?: string }>;
  production_notes?: string;
  manufacturing_note?: string;
  internal_note?: string;
  status: string;
  form_version: number;
  sign_image_path?: string;  // Filename only (e.g., "design.jpg")
  crop_top?: number;         // Auto-crop coordinates
  crop_right?: number;
  crop_bottom?: number;
  crop_left?: number;
  shipping_required: boolean;

  // Folder info (for constructing full image path)
  folder_name?: string;
  folder_location?: 'active' | 'finished' | 'none';
  is_migrated?: boolean;

  // Customer info
  customer_id: number;
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  phone?: string;
  email?: string;

  // Customer packing preferences
  pattern_yes_or_no?: number;              // For packing list pattern logic
  pattern_type?: string;                   // "Paper" or "Digital"
  wiring_diagram_yes_or_no?: number;       // For packing list wiring diagram logic

  // Parts
  parts: OrderPartForPDF[];
}

export interface OrderPartForPDF {
  part_id: number;
  part_number: number;
  display_number?: string;
  is_parent?: boolean;
  product_type: string;
  part_scope?: string;
  specs_display_name?: string;
  product_type_id: string;
  quantity: number;
  specifications: any;
  production_notes?: string;
}

// =============================================
// SERVICE CLASS
// =============================================

class PDFGenerationService {

  /**
   * Get the actual order folder path on SMB share
   */
  private getOrderFolderPath(orderData: OrderDataForPDF): string {
    const SMB_ROOT = '/mnt/channelletter';
    const ORDERS_FOLDER = 'Orders';
    const FINISHED_FOLDER = '1Finished';

    if (!orderData.folder_name || orderData.folder_location === 'none') {
      throw new Error('Order does not have a folder');
    }

    let basePath: string;
    if (orderData.is_migrated) {
      // Legacy orders: use old paths (root or root/1Finished)
      basePath = orderData.folder_location === 'active'
        ? SMB_ROOT
        : path.join(SMB_ROOT, FINISHED_FOLDER);
    } else {
      // New app-created orders: use Orders subfolder
      basePath = orderData.folder_location === 'active'
        ? path.join(SMB_ROOT, ORDERS_FOLDER)
        : path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER);
    }

    return path.join(basePath, orderData.folder_name);
  }

  /**
   * Generate PDF filenames with order number and job name
   */
  private getPdfFilenames(orderData: OrderDataForPDF): {
    master: string;
    shop: string;
    customer: string;
    packing: string;
  } {
    const orderNum = orderData.order_number;
    const jobName = orderData.order_name;

    return {
      master: `${orderNum} - ${jobName}.pdf`,
      shop: `${orderNum} - ${jobName} - Shop.pdf`,
      customer: `${orderNum} - ${jobName} - Specs.pdf`,
      packing: `${orderNum} - ${jobName} - Packing List.pdf`
    };
  }

  /**
   * Generate all 4 forms for an order
   */
  async generateAllForms(options: FormGenerationOptions): Promise<FormPaths> {
    const { orderId, createNewVersion = false, userId } = options;

    // 1. Fetch complete order data
    const orderData = await this.fetchOrderData(orderId);

    // 2. Handle versioning
    let version = orderData.form_version;
    if (createNewVersion && version > 1) {
      // Archive current version before creating new one
      await this.archiveCurrentVersion(orderData, version);
      version = version + 1;
      await this.updateOrderVersion(orderId, version);
    }

    // 3. Ensure directory structure exists
    // Master Form goes in order folder root
    const orderFolderRoot = this.getOrderFolderPath(orderData);
    await ensureDirectory(orderFolderRoot);

    // Other forms go in "Specs" subfolder
    const orderFormsSubfolder = path.join(orderFolderRoot, 'Specs');
    await ensureDirectory(orderFormsSubfolder);

    // Get dynamic filenames
    const filenames = this.getPdfFilenames(orderData);

    console.log(`[PDF Generation] Master & Shop Forms → ${orderFolderRoot}/`);
    console.log(`[PDF Generation] Customer & Packing → ${orderFormsSubfolder}/`);

    // 4. Generate all 4 forms
    const { generateOrderForm } = await import('./generators/orderFormGenerator');
    const { generatePackingList } = await import('./generators/packingListGenerator');

    // Build full paths with dynamic filenames
    const masterPath = path.join(orderFolderRoot, filenames.master);
    const shopPath = path.join(orderFolderRoot, filenames.shop);           // Shop in root
    const customerPath = path.join(orderFormsSubfolder, filenames.customer);
    const packingPath = path.join(orderFormsSubfolder, filenames.packing);

    // Generate forms sequentially to avoid SMB file locking issues
    await generateOrderForm(orderData, masterPath, 'master');      // Master in root
    await generateOrderForm(orderData, shopPath, 'shop');          // Shop in root
    await generateOrderForm(orderData, customerPath, 'customer');  // Customer in subfolder
    await generatePackingList(orderData, packingPath);             // Packing in subfolder

    // 5. Store paths in database
    await this.saveFormPaths(orderId, version, {
      masterForm: masterPath,
      shopForm: shopPath,
      customerForm: customerPath,
      packingList: packingPath
    }, userId);

    return {
      masterForm: masterPath,
      shopForm: shopPath,
      customerForm: customerPath,
      packingList: packingPath
    };
  }

  /**
   * Fetch complete order data with customer and parts
   */
  private async fetchOrderData(orderId: number): Promise<OrderDataForPDF> {
    // Fetch order with customer info
    const [orderRows] = await pool.execute<RowDataPacket[]>(`
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
    `, [orderId]);

    if (orderRows.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = orderRows[0];

    // Fetch order parts
    const [parts] = await pool.execute<RowDataPacket[]>(`
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
        production_notes
      FROM order_parts
      WHERE order_id = ?
      ORDER BY part_number
    `, [orderId]);

    return {
      ...order,
      parts: parts as OrderPartForPDF[]
    } as OrderDataForPDF;
  }

  /**
   * Archive current version before creating new one
   */
  private async archiveCurrentVersion(orderData: OrderDataForPDF, version: number): Promise<void> {
    const orderFolderRoot = this.getOrderFolderPath(orderData);
    const orderFormsSubfolder = path.join(orderFolderRoot, 'Specs');
    const archiveDir = path.join(orderFolderRoot, 'archive', `v${version}`);

    // Get dynamic filenames for this order
    const filenames = this.getPdfFilenames(orderData);

    // Create archive directory
    await ensureDirectory(archiveDir);

    // Master and Shop forms are in order folder root
    const rootForms = [
      { filename: filenames.master, name: 'Master' },
      { filename: filenames.shop, name: 'Shop' }
    ];

    for (const form of rootForms) {
      try {
        const sourcePath = path.join(orderFolderRoot, form.filename);
        const archivePath = path.join(archiveDir, form.filename);
        await fs.access(sourcePath);
        await fs.copyFile(sourcePath, archivePath);
        console.log(`Archived: ${form.filename}`);
      } catch (error) {
        console.log(`Skipping ${form.filename} - file does not exist`);
      }
    }

    // Customer and Packing forms are in "Order Forms" subfolder
    const subfolderForms = [
      { filename: filenames.customer, name: 'Customer' },
      { filename: filenames.packing, name: 'Packing' }
    ];

    for (const form of subfolderForms) {
      try {
        const sourcePath = path.join(orderFormsSubfolder, form.filename);
        const archivePath = path.join(archiveDir, form.filename);
        await fs.access(sourcePath);
        await fs.copyFile(sourcePath, archivePath);
        console.log(`Archived: ${form.filename}`);
      } catch (error) {
        console.log(`Skipping ${form.filename} - file does not exist`);
      }
    }
  }

  /**
   * Update order version number
   */
  private async updateOrderVersion(orderId: number, version: number): Promise<void> {
    await pool.execute(
      'UPDATE orders SET form_version = ? WHERE order_id = ?',
      [version, orderId]
    );
  }

  /**
   * Save form paths to database
   */
  private async saveFormPaths(
    orderId: number,
    version: number,
    paths: FormPaths,
    userId?: number
  ): Promise<void> {
    // Check if version record exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT version_id FROM order_form_versions WHERE order_id = ? AND version_number = ?',
      [orderId, version]
    );

    if (existing.length > 0) {
      // Update existing record
      await pool.execute(
        `UPDATE order_form_versions
         SET master_form_path = ?, shop_form_path = ?, customer_form_path = ?, packing_list_path = ?
         WHERE order_id = ? AND version_number = ?`,
        [paths.masterForm, paths.shopForm, paths.customerForm, paths.packingList, orderId, version]
      );
    } else {
      // Insert new record
      await pool.execute(
        `INSERT INTO order_form_versions
         (order_id, version_number, master_form_path, shop_form_path, customer_form_path, packing_list_path, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, version, paths.masterForm, paths.shopForm, paths.customerForm, paths.packingList, userId || null]
      );
    }
  }

  /**
   * Get form paths for an order
   */
  async getFormPaths(orderId: number, version?: number): Promise<FormPaths | null> {
    let sql = `
      SELECT master_form_path, shop_form_path, customer_form_path, packing_list_path
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

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      masterForm: row.master_form_path,
      shopForm: row.shop_form_path,
      customerForm: row.customer_form_path,
      packingList: row.packing_list_path
    };
  }

  /**
   * Check if forms exist for an order
   */
  async formsExist(orderId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM order_form_versions WHERE order_id = ?',
      [orderId]
    );

    return rows[0].count > 0;
  }
}

export const pdfGenerationService = new PDFGenerationService();
