// File Clean up Finished: Nov 13, 2025
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
