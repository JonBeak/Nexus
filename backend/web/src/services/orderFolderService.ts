// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed direct pool.execute() calls - all database operations now use orderRepository
//   - Added updateFolderTracking() to orderRepository (was missing)
//   - Removed unused pool import
//   - Service now follows proper 3-layer architecture (no direct DB access)
//   - All folder database operations: checkFolderNameConflict, getOrderFolderLocation, updateFolderTracking
/**
 * Order Folder Service
 * Manages SMB folder lifecycle for orders
 *
 * Responsibilities:
 * - Create order folders on SMB share
 * - Check for folder name conflicts
 * - Move folders to 1Finished on order completion
 * - List available images in folder
 * - Build standardized folder names
 */

import * as fs from 'fs';
import * as path from 'path';
import { orderFormRepository } from '../repositories/orderFormRepository';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../config/paths';

// Path helpers
const LEGACY_ACTIVE_PATH = SMB_ROOT; // Legacy migrated orders in root
const LEGACY_FINISHED_PATH = path.join(SMB_ROOT, FINISHED_FOLDER); // Legacy finished orders
const NEW_ACTIVE_PATH = path.join(SMB_ROOT, ORDERS_FOLDER); // New app-created orders
const NEW_FINISHED_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER); // New finished orders

export class OrderFolderService {

  /**
   * Get full folder path based on location and whether it's a migrated order
   * @param folderName - The folder name
   * @param location - 'active' or 'finished'
   * @param isMigrated - Whether this is a legacy migrated order (default: false)
   */
  private getFolderPath(
    folderName: string,
    location: 'active' | 'finished',
    isMigrated: boolean = false
  ): string {
    if (isMigrated) {
      // Legacy orders: use old paths
      return location === 'active'
        ? path.join(LEGACY_ACTIVE_PATH, folderName)
        : path.join(LEGACY_FINISHED_PATH, folderName);
    } else {
      // New app-created orders: use Orders subfolder
      return location === 'active'
        ? path.join(NEW_ACTIVE_PATH, folderName)
        : path.join(NEW_FINISHED_PATH, folderName);
    }
  }

  /**
   * Build standardized folder name: "{order_name} ----- {customer_name}"
   * Sanitizes special characters for filesystem safety
   *
   * Important:
   * - Trailing periods are OK for orderName (middle of folder path)
   * - Trailing periods are stripped from customerName (end of folder path - Windows issue)
   * - Trailing spaces are stripped from both (Windows strips them, causing access issues)
   */
  buildFolderName(orderName: string, customerName: string): string {
    // Sanitize: replace invalid filesystem characters with underscore
    // Strip trailing spaces and periods as needed based on position in folder path
    const sanitize = (str: string, stripTrailingPeriods: boolean = false) => {
      let result = str
        .replace(/[\/\\:*?"<>|]/g, '_')  // Replace invalid chars with underscore
        .trim()                          // Remove leading/trailing spaces
        .replace(/\s+$/, '');            // Ensure no trailing spaces (Windows strips these)

      if (stripTrailingPeriods) {
        result = result.replace(/\.+$/, '');  // Remove trailing periods
      }

      return result;
    };

    const sanitizedOrderName = sanitize(orderName, false);       // Keep trailing periods (middle of path)
    const sanitizedCustomerName = sanitize(customerName, true);  // Strip trailing periods (end of path)

    return `${sanitizedOrderName} ----- ${sanitizedCustomerName}`;
  }

  /**
   * Get order form PDF paths for printing operations
   * Builds complete filesystem paths for all order form types
   *
   * @param orderNumber - The order number to get paths for
   * @returns Object with order details and paths to all form PDFs
   * @throws Error if order not found or folder not configured
   */
  async getOrderFormPaths(orderNumber: number): Promise<{
    order_name: string;
    folder_name: string;
    folder_location: 'active' | 'finished' | 'none';
    is_migrated: boolean;
    paths: {
      master: string;
      shop: string;
      customer: string;
      estimate: string;
      packing: string;
    };
  }> {
    // Get order details from repository
    const order = await orderFormRepository.getOrderFolderDetails(orderNumber);

    if (!order) {
      throw new Error(`Order ${orderNumber} not found`);
    }

    if (!order.folder_name || order.folder_location === 'none') {
      throw new Error(`Order ${orderNumber} does not have a folder`);
    }

    // Build folder paths using same logic as PDF generation
    const orderFolderRoot = this.getFolderPath(
      order.folder_name,
      order.folder_location,
      order.is_migrated
    );

    const specsSubfolder = path.join(orderFolderRoot, 'Specs');

    // Build PDF filenames
    const orderNum = order.order_number;
    const jobName = order.order_name;

    return {
      order_name: order.order_name,
      folder_name: order.folder_name,
      folder_location: order.folder_location,
      is_migrated: order.is_migrated,
      paths: {
        master: path.join(orderFolderRoot, `${orderNum} - ${jobName}.pdf`),
        shop: path.join(orderFolderRoot, `${orderNum} - ${jobName} - Shop.pdf`),
        customer: path.join(specsSubfolder, `${orderNum} - ${jobName} - Specs.pdf`),
        estimate: path.join(orderFolderRoot, `${orderNum} - ${jobName} - Estimate.pdf`),
        packing: path.join(specsSubfolder, `${orderNum} - ${jobName} - Packing List.pdf`)
      }
    };
  }

  /**
   * Check if SMB share is accessible with 7-second timeout
   * Used during order conversion to fail fast if network share is unavailable
   */
  async checkSMBHealth(timeoutMs: number = 7000): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.warn('[OrderFolderService] SMB health check timeout - share is not responding');
        resolve(false);
      }, timeoutMs);

      try {
        // Try to access the Orders folder
        const ordersPath = NEW_ACTIVE_PATH;
        if (fs.existsSync(ordersPath)) {
          clearTimeout(timer);
          console.log('[OrderFolderService] ✓ SMB share is accessible');
          resolve(true);
          return;
        }

        // If Orders folder doesn't exist, try to check parent
        if (fs.existsSync(SMB_ROOT)) {
          clearTimeout(timer);
          console.log('[OrderFolderService] ✓ SMB share is accessible (root exists)');
          resolve(true);
          return;
        }

        clearTimeout(timer);
        console.warn('[OrderFolderService] SMB share is not accessible');
        resolve(false);
      } catch (error) {
        clearTimeout(timer);
        console.error('[OrderFolderService] SMB health check error:', error);
        resolve(false);
      }
    });
  }

  /**
   * Check if folder name already exists (case-insensitive)
   * Checks ALL locations: legacy (root, 1Finished) and new (Orders, Orders/1Finished)
   *
   * Returns: { exists: boolean, location: 'active' | 'finished' | null, actualName: string | null }
   */
  async checkFolderConflict(folderName: string): Promise<{
    exists: boolean;
    location: 'active' | 'finished' | null;
    actualName: string | null;
  }> {
    try {
      const lowerFolderName = folderName.toLowerCase();

      // Check all 4 possible locations
      const locationsToCheck = [
        { path: LEGACY_ACTIVE_PATH, location: 'active' as const },
        { path: LEGACY_FINISHED_PATH, location: 'finished' as const },
        { path: NEW_ACTIVE_PATH, location: 'active' as const },
        { path: NEW_FINISHED_PATH, location: 'finished' as const }
      ];

      for (const { path: searchPath, location } of locationsToCheck) {
        if (fs.existsSync(searchPath)) {
          const items = fs.readdirSync(searchPath);
          for (const item of items) {
            if (item.toLowerCase() === lowerFolderName) {
              const itemPath = path.join(searchPath, item);
              if (fs.statSync(itemPath).isDirectory()) {
                return {
                  exists: true,
                  location,
                  actualName: item
                };
              }
            }
          }
        }
      }

      return { exists: false, location: null, actualName: null };
    } catch (error) {
      console.error('[OrderFolderService] Error checking folder conflict:', error);
      throw new Error('Failed to check folder conflict');
    }
  }

  /**
   * Check if folder name conflicts in database (case-insensitive)
   * Faster than filesystem check
   */
  async checkDatabaseConflict(folderName: string): Promise<boolean> {
    try {
      return await orderFormRepository.checkFolderNameConflict(folderName);
    } catch (error) {
      console.error('[OrderFolderService] Error checking database conflict:', error);
      throw new Error('Failed to check database conflict');
    }
  }

  /**
   * Create folder on SMB share (new orders only - in Orders subfolder)
   * Returns: true if created, false if already exists
   */
  createOrderFolder(folderName: string): boolean {
    try {
      const folderPath = path.join(NEW_ACTIVE_PATH, folderName);

      // Check if already exists
      if (fs.existsSync(folderPath)) {
        console.log(`[OrderFolderService] Folder already exists: ${folderName}`);
        return false;
      }

      // Create folder (recursive creates Orders/1Finished if needed)
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`[OrderFolderService] ✅ Created folder: ${folderPath}`);

      return true;
    } catch (error) {
      console.error('[OrderFolderService] Error creating folder:', error);
      throw new Error(`Failed to create folder: ${folderName}`);
    }
  }

  /**
   * Move folder from active to 1Finished (new orders only - within Orders subfolder)
   * Returns: { success: boolean, conflict: boolean, error?: string }
   */
  async moveToFinished(folderName: string): Promise<{
    success: boolean;
    conflict: boolean;
    error?: string;
  }> {
    try {
      const sourcePath = path.join(NEW_ACTIVE_PATH, folderName);
      const destPath = path.join(NEW_FINISHED_PATH, folderName);

      // Check if source exists
      if (!fs.existsSync(sourcePath)) {
        return {
          success: false,
          conflict: false,
          error: 'Source folder does not exist'
        };
      }

      // Check for conflict in destination
      if (fs.existsSync(destPath)) {
        console.warn(`[OrderFolderService] ⚠️  Conflict: Folder already exists in 1Finished: ${folderName}`);
        return {
          success: false,
          conflict: true,
          error: 'Folder already exists in 1Finished'
        };
      }

      // Ensure 1Finished directory exists
      if (!fs.existsSync(NEW_FINISHED_PATH)) {
        fs.mkdirSync(NEW_FINISHED_PATH, { recursive: true });
      }

      // Move folder
      fs.renameSync(sourcePath, destPath);
      console.log(`[OrderFolderService] ✅ Moved folder to 1Finished: ${destPath}`);

      return { success: true, conflict: false };
    } catch (error) {
      console.error('[OrderFolderService] Error moving folder:', error);
      return {
        success: false,
        conflict: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Rename order folder on SMB share
   * Handles both active and finished folder locations
   *
   * @param oldFolderName - Current folder name
   * @param newFolderName - New folder name to rename to
   * @param location - 'active' or 'finished'
   * @param isMigrated - Whether this is a legacy migrated order (default: false)
   * @returns { success: boolean, error?: string }
   */
  renameOrderFolder(
    oldFolderName: string,
    newFolderName: string,
    location: 'active' | 'finished',
    isMigrated: boolean = false
  ): { success: boolean; error?: string } {
    try {
      const sourcePath = this.getFolderPath(oldFolderName, location, isMigrated);
      const destPath = this.getFolderPath(newFolderName, location, isMigrated);

      // Check if source folder exists
      if (!fs.existsSync(sourcePath)) {
        console.warn(`[OrderFolderService] Source folder does not exist: ${sourcePath}`);
        return {
          success: false,
          error: 'Source folder does not exist'
        };
      }

      // Check if destination already exists (case-insensitive conflict)
      if (fs.existsSync(destPath)) {
        console.warn(`[OrderFolderService] Destination folder already exists: ${destPath}`);
        return {
          success: false,
          error: 'A folder with this name already exists'
        };
      }

      // Perform the rename
      fs.renameSync(sourcePath, destPath);
      console.log(`[OrderFolderService] ✅ Renamed folder: "${oldFolderName}" → "${newFolderName}"`);

      return { success: true };
    } catch (error) {
      console.error('[OrderFolderService] Error renaming folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during folder rename'
      };
    }
  }

  /**
   * Rename PDF files in a folder when order name changes
   * PDFs follow pattern: "{orderNum} - {orderName}*.pdf"
   * Also checks Specs subfolder for customer-facing PDFs
   *
   * @param folderPath - Full path to the order folder
   * @param orderNumber - The order number (e.g., 200123)
   * @param oldOrderName - The old order name
   * @param newOrderName - The new order name
   * @returns { renamed: number, errors: string[] }
   */
  renamePdfsInFolder(
    folderPath: string,
    orderNumber: number,
    oldOrderName: string,
    newOrderName: string
  ): { renamed: number; errors: string[] } {
    const results = { renamed: 0, errors: [] as string[] };

    // Directories to check: root folder and Specs subfolder
    const dirsToCheck = [
      folderPath,
      path.join(folderPath, 'Specs')
    ];

    const oldPrefix = `${orderNumber} - ${oldOrderName}`;
    const newPrefix = `${orderNumber} - ${newOrderName}`;

    for (const dir of dirsToCheck) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      try {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          // Only process PDF files that match the old naming pattern
          if (!file.toLowerCase().endsWith('.pdf')) {
            continue;
          }

          if (!file.startsWith(oldPrefix)) {
            continue;
          }

          // Build new filename by replacing the prefix
          const suffix = file.substring(oldPrefix.length); // e.g., ".pdf" or " - Shop.pdf"
          const newFilename = `${newPrefix}${suffix}`;

          const oldFilePath = path.join(dir, file);
          const newFilePath = path.join(dir, newFilename);

          try {
            fs.renameSync(oldFilePath, newFilePath);
            results.renamed++;
            console.log(`[OrderFolderService] ✅ Renamed PDF: "${file}" → "${newFilename}"`);
          } catch (renameErr) {
            const errMsg = `Failed to rename ${file}: ${renameErr instanceof Error ? renameErr.message : 'Unknown error'}`;
            results.errors.push(errMsg);
            console.error(`[OrderFolderService] ❌ ${errMsg}`);
          }
        }
      } catch (readErr) {
        const errMsg = `Failed to read directory ${dir}: ${readErr instanceof Error ? readErr.message : 'Unknown error'}`;
        results.errors.push(errMsg);
        console.error(`[OrderFolderService] ❌ ${errMsg}`);
      }
    }

    if (results.renamed > 0) {
      console.log(`[OrderFolderService] ✅ Renamed ${results.renamed} PDF file(s) in folder`);
    }

    return results;
  }

  /**
   * List all image files (JPG, JPEG, PNG) in folder
   * Returns: Array of { filename, size, modifiedDate }
   */
  listImagesInFolder(
    folderName: string,
    location: 'active' | 'finished' = 'active',
    isMigrated: boolean = false
  ): Array<{
    filename: string;
    size: number;
    modifiedDate: Date;
  }> {
    try {
      const folderPath = this.getFolderPath(folderName, location, isMigrated);

      // Check if folder exists
      if (!fs.existsSync(folderPath)) {
        console.warn(`[OrderFolderService] Folder does not exist: ${folderPath}`);
        return [];
      }

      // Read directory
      const items = fs.readdirSync(folderPath);
      const images: Array<{ filename: string; size: number; modifiedDate: Date }> = [];

      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const stats = fs.statSync(itemPath);

        // Only include files (not directories)
        if (!stats.isFile()) {
          continue;
        }

        // Check file extension (case-insensitive)
        const ext = path.extname(item).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
          images.push({
            filename: item,
            size: stats.size,
            modifiedDate: stats.mtime
          });
        }
      }

      // Sort by modified date (newest first)
      images.sort((a, b) => b.modifiedDate.getTime() - a.modifiedDate.getTime());

      return images;
    } catch (error) {
      console.error('[OrderFolderService] Error listing images:', error);
      throw new Error('Failed to list images in folder');
    }
  }

  /**
   * Check if image file exists in folder
   */
  imageExists(
    folderName: string,
    filename: string,
    location: 'active' | 'finished' = 'active',
    isMigrated: boolean = false
  ): boolean {
    try {
      const folderPath = this.getFolderPath(folderName, location, isMigrated);
      const imagePath = path.join(folderPath, filename);

      return fs.existsSync(imagePath) && fs.statSync(imagePath).isFile();
    } catch (error) {
      console.error('[OrderFolderService] Error checking image existence:', error);
      return false;
    }
  }

  /**
   * Get folder location from database
   */
  async getFolderLocation(orderId: number): Promise<'active' | 'finished' | 'none'> {
    try {
      return await orderFormRepository.getOrderFolderLocation(orderId);
    } catch (error) {
      console.error('[OrderFolderService] Error getting folder location:', error);
      throw error;
    }
  }

  /**
   * Update folder tracking in database
   * Accepts optional connection parameter for transaction support
   */
  async updateFolderTracking(
    orderId: number,
    folderName: string,
    folderExists: boolean,
    folderLocation: 'active' | 'finished' | 'none',
    connection?: any
  ): Promise<void> {
    try {
      await orderFormRepository.updateFolderTracking(
        orderId,
        folderName,
        folderExists,
        folderLocation,
        connection
      );

      console.log(`[OrderFolderService] Updated folder tracking for order ${orderId}`);
    } catch (error) {
      console.error('[OrderFolderService] Error updating folder tracking:', error);
      throw new Error('Failed to update folder tracking');
    }
  }
}

export const orderFolderService = new OrderFolderService();
