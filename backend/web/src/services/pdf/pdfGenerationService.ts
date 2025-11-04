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
  customer_po?: string;
  point_person_email?: string;
  production_notes?: string;
  status: string;
  form_version: number;

  // Customer info
  customer_id: number;
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  phone?: string;
  email?: string;

  // Parts
  parts: OrderPartForPDF[];
}

export interface OrderPartForPDF {
  part_id: number;
  part_number: number;
  product_type: string;
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
      await this.archiveCurrentVersion(orderData.order_number, version);
      version = version + 1;
      await this.updateOrderVersion(orderId, version);
    }

    // 3. Ensure directory structure exists
    const orderDir = getOrderStoragePath(orderData.order_number);
    await ensureDirectory(orderDir);

    // 4. Generate all 4 forms
    const { generateMasterForm } = await import('./generators/masterFormGenerator');
    const { generateShopForm } = await import('./generators/shopFormGenerator');
    const { generateCustomerForm } = await import('./generators/customerFormGenerator');
    const { generatePackingList } = await import('./generators/packingListGenerator');

    const [masterPath, shopPath, customerPath, packingPath] = await Promise.all([
      generateMasterForm(orderData, orderDir),
      generateShopForm(orderData, orderDir),
      generateCustomerForm(orderData, orderDir),
      generatePackingList(orderData, orderDir)
    ]);

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
        o.*,
        c.company_name,
        c.contact_first_name,
        c.contact_last_name,
        c.phone,
        c.email
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
      SELECT *
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
  private async archiveCurrentVersion(orderNumber: number, version: number): Promise<void> {
    const orderDir = getOrderStoragePath(orderNumber);
    const archiveDir = path.join(orderDir, 'archive', `v${version}`);

    // Create archive directory
    await ensureDirectory(archiveDir);

    // Files to archive
    const filesToArchive = [
      STORAGE_CONFIG.fileNames.masterForm,
      STORAGE_CONFIG.fileNames.shopForm,
      STORAGE_CONFIG.fileNames.customerForm,
      STORAGE_CONFIG.fileNames.packingList
    ];

    // Copy each file to archive
    for (const fileName of filesToArchive) {
      const sourcePath = path.join(orderDir, fileName);
      const archivePath = path.join(archiveDir, fileName);

      try {
        // Check if file exists before copying
        await fs.access(sourcePath);
        await fs.copyFile(sourcePath, archivePath);
      } catch (error) {
        // File doesn't exist, skip
        console.log(`Skipping ${fileName} - file does not exist`);
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
