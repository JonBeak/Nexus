// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Deleted storage.ts (legacy NexusTesting config - no longer needed)
//   - Updated 6 files to import from paths.ts instead of hardcoding paths:
//     * toolsController.ts (removed NexusTesting reference)
//     * pdfGenerationService.ts (removed unused storage.ts import)
//     * orderFolderService.ts
//     * printController.ts
//     * pdfCommonGenerator.ts
//     * server.ts
//   - Archived migrateExistingFolders.ts (one-time migration completed Nov 10, 2025)
//   - Established paths.ts as single source of truth for all SMB paths
/**
 * File System Path Configuration
 * Centralized storage paths for order folders and forms
 */

/**
 * Root path for SMB-mounted shared storage
 */
export const SMB_ROOT = '/mnt/channelletter';

/**
 * Folder name for new app-created orders (under SMB_ROOT)
 */
export const ORDERS_FOLDER = 'Orders';

/**
 * Folder name for completed/finished orders
 */
export const FINISHED_FOLDER = '1Finished';

/**
 * Folder name for cancelled orders
 */
export const CANCELLED_FOLDER = '1Cancelled';

/**
 * Folder name for on-hold orders
 */
export const HOLD_FOLDER = '1Hold';
