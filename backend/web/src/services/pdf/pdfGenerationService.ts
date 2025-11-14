// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Moved database queries to orderRepository (proper 3-layer architecture)
//   - Migrated to query() helper for all DB operations (in repository)
//   - Removed hardcoded SMB paths, now using config/paths.ts
//   - Moved FormPaths, OrderDataForPDF, OrderPartForPDF to types/orders.ts
//   - Removed point_persons field (dead code - never fetched)
//   - Updated specifications type from any to OrderSpecifications
//   - Removed unused imports (pool, ResultSetHeader, PoolConnection)
//   - File size reduced from 432 to 243 lines (44% reduction)
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

import fs from 'fs/promises';
import path from 'path';
import { orderRepository } from '../../repositories/orderRepository';
import { FormPaths, OrderDataForPDF, OrderPartForPDF } from '../../types/orders';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../../config/paths';

// =============================================
// TYPES
// =============================================

export interface FormGenerationOptions {
  orderId: number;
  createNewVersion?: boolean;
  userId?: number;
}

// =============================================
// SERVICE CLASS
// =============================================

class PDFGenerationService {

  /**
   * Get the actual order folder path on SMB share
   */
  private getOrderFolderPath(orderData: OrderDataForPDF): string {
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
    await fs.mkdir(orderFolderRoot, { recursive: true });

    // Other forms go in "Specs" subfolder
    const orderFormsSubfolder = path.join(orderFolderRoot, 'Specs');
    await fs.mkdir(orderFormsSubfolder, { recursive: true });

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
    const orderData = await orderRepository.getOrderWithCustomerForPDF(orderId);

    if (!orderData) {
      throw new Error(`Order ${orderId} not found`);
    }

    return orderData;
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
    await fs.mkdir(archiveDir, { recursive: true });

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
    await orderRepository.updateOrderFormVersion(orderId, version);
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
    await orderRepository.upsertOrderFormPaths(orderId, version, paths, userId);
  }

  /**
   * Get form paths for an order
   */
  async getFormPaths(orderId: number, version?: number): Promise<FormPaths | null> {
    return await orderRepository.getOrderFormPaths(orderId, version);
  }

  /**
   * Check if forms exist for an order
   */
  async formsExist(orderId: number): Promise<boolean> {
    return await orderRepository.orderFormsExist(orderId);
  }
}

export const pdfGenerationService = new PDFGenerationService();
