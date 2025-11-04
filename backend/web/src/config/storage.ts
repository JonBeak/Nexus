/**
 * Storage Configuration
 * File storage paths for the Orders system
 */

import path from 'path';

/**
 * Base path for order file storage (SMB mount)
 * Mounted from: \\DESKTOP-EJCP1DO\Channel Letter
 */
export const ORDER_STORAGE_BASE_PATH = '/mnt/channelletter/NexusTesting';

/**
 * Get storage path for a specific order
 */
export function getOrderStoragePath(orderNumber: number): string {
  return path.join(ORDER_STORAGE_BASE_PATH, `Order-${orderNumber}`);
}

/**
 * Get path for a specific form type
 */
export function getFormPath(orderNumber: number, formType: 'master' | 'shop' | 'customer' | 'packing', version?: number): string {
  const orderPath = getOrderStoragePath(orderNumber);

  if (version && version > 1) {
    // Archived version
    return path.join(orderPath, 'archive', `v${version}`, `${formType}-form.pdf`);
  }

  // Current version
  return path.join(orderPath, `${formType}-form.pdf`);
}

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  basePath: ORDER_STORAGE_BASE_PATH,

  // Directory structure
  directories: {
    archive: 'archive',
    temp: 'temp'
  },

  // File naming conventions
  fileNames: {
    masterForm: 'master-form.pdf',
    shopForm: 'shop-form.pdf',
    customerForm: 'customer-form.pdf',
    packingList: 'packing-list.pdf'
  },

  // Maximum file size (10MB)
  maxFileSize: 10 * 1024 * 1024,

  // Supported file types
  supportedTypes: ['.pdf', '.png', '.jpg', '.jpeg']
};

/**
 * Ensure directory exists
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  const fs = require('fs').promises;
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}
