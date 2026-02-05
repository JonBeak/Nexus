/**
 * PDF URL Builder Utility
 *
 * Builds frontend-accessible URLs for order PDFs based on known file naming conventions.
 * Used by both Print Forms modal and Prepare Order modal.
 *
 * Pattern extracted from useOrderPrinting.ts buildFormUrls()
 * Created: Nov 18, 2025 - Fix for blank PDF previews in Prepare Order modal
 */

type FolderLocation = 'active' | 'finished' | 'cancelled' | 'hold' | 'none';

interface Order {
  folder_name?: string;
  folder_location?: FolderLocation;
  order_number: number;
  order_name: string;
}

/**
 * Get the folder path segment for a given folder location
 * Maps folder_location to actual folder path on SMB share
 */
export function getFolderPathSegment(location: FolderLocation | undefined, isMigrated: boolean = false): string {
  if (isMigrated) {
    // Legacy orders only have root or 1Finished
    return location === 'active' ? '' : '1Finished/';
  }

  // New orders are in Orders/ subdirectory
  switch (location) {
    case 'active':
      return 'Orders/';
    case 'finished':
      return 'Orders/1Finished/';
    case 'cancelled':
      return 'Orders/1Cancelled/';
    case 'hold':
      return 'Orders/1Hold/';
    default:
      return 'Orders/';
  }
}

interface PdfUrls {
  master: string;
  estimate: string;
  shop: string;
  customer: string;
  packing: string;
  qbEstimate: string;
}

/**
 * Build PDF URLs from order metadata
 *
 * Uses known file naming conventions to construct URLs for static file serving.
 * Files are served via /order-images/* route which maps to SMB storage.
 *
 * @param order - Order with folder_name, folder_location, order_number, order_name
 * @param addCacheBuster - Whether to add timestamp query param (default: true)
 * @returns Object with URLs for all PDF types, or null if order data incomplete
 */
export function buildPdfUrls(order: Order | null, addCacheBuster: boolean = true): PdfUrls | null {
  if (!order || !order.folder_name) {
    return null;
  }

  // Get base URL for PDFs (remove /api suffix since order-images is served from root)
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://192.168.2.14:3001').replace(/\/api$/, '');

  const folderName = order.folder_name; // e.g., "12345 - Job Name ----- Customer Name"
  const orderNum = order.order_number;
  const jobName = order.order_name;

  // Add cache buster using current timestamp to ensure browser fetches latest PDF
  const cacheBuster = addCacheBuster ? `?v=${Date.now()}` : '';

  // Determine base path based on folder location
  const pathSegment = getFolderPathSegment(order.folder_location);
  const basePath = `${apiUrl}/order-images/${pathSegment}${folderName}`;

  // Build URLs using actual folder structure and file naming conventions
  return {
    master: `${basePath}/${orderNum} - ${jobName}.pdf${cacheBuster}`,
    estimate: `${basePath}/${orderNum} - ${jobName} - Estimate.pdf${cacheBuster}`,
    shop: `${basePath}/${orderNum} - ${jobName} - Shop.pdf${cacheBuster}`,
    customer: `${basePath}/Specs/${orderNum} - ${jobName} - Specs.pdf${cacheBuster}`,
    packing: `${basePath}/Specs/${orderNum} - ${jobName} - Packing List.pdf${cacheBuster}`,
    qbEstimate: `${basePath}/Specs/${orderNum} - ${jobName} - QB Estimate.pdf${cacheBuster}`
  };
}
