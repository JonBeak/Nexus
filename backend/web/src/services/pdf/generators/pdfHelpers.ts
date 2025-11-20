// File Clean up Finished: 2025-11-15
/**
 * PDF Generator Helper Functions
 * Utility functions for PDF generation (formatting, validation, path resolution)
 *
 * Extracted from pdfCommonGenerator.ts as part of file size reduction refactoring
 */

import path from 'path';
import { FormType, SMB_PATHS, STANDARD_LABEL_REFERENCE, SPACING } from './pdfConstants';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Debug logging utility
 */
export function debugLog(message: string): void {
  console.log(`======================== PDF DEBUG ========================`);
  console.log(message);
  console.log(`===========================================================`);
}

/**
 * Calculate standardized label width for consistent spec label sizing
 * Uses STANDARD_LABEL_REFERENCE as the longest label to determine width
 * Includes spacing on both sides of the text for better readability
 *
 * @param doc - PDFKit document instance
 * @returns Standardized label width in points
 */
export function getStandardLabelWidth(doc: any): number {
  doc.fontSize(11).font('Helvetica-Bold');
  const maxLabelWidth = doc.widthOfString(STANDARD_LABEL_REFERENCE);
  const spaceWidth = doc.widthOfString(' ');
  return maxLabelWidth + (SPACING.LABEL_PADDING * 2) + 4 + (spaceWidth * 2);
}

/**
 * Format boolean values to Yes/No
 */
export function formatBooleanValue(value: any): string {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  return String(value);
}

/**
 * Clean up spec values (remove parenthetical details)
 * For LEDs and Power Supplies: "Interone 9K - 9000K (0.80W, 12V)" → "Interone 9K"
 */
export function cleanSpecValue(value: string): string {
  if (!value || typeof value !== 'string') return value;

  // Remove parenthetical specs (anything in parentheses)
  if (value.includes('(')) {
    let cleaned = value.split('(')[0].trim();

    // Also remove trailing dash and details (like " - 9000K")
    const dashMatch = cleaned.match(/^(.+?)\s*-\s*.+$/);
    if (dashMatch) {
      cleaned = dashMatch[1].trim();
    }

    return cleaned;
  }

  return value;
}

/**
 * Format due date with optional time
 */
export function formatDueDateTime(dueDate: Date, hardDueTime?: string): string {
  let dateStr = dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Add time if hard_due_date_time exists (TIME format "HH:mm" or "HH:mm:ss")
  if (hardDueTime) {
    const timeParts = hardDueTime.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes} ${period}`;
    dateStr += ` ${timeStr}`;
  }

  return dateStr;
}

/**
 * Get image full path from order data
 */
export function getImageFullPath(orderData: any): string | null {
  if (!orderData.sign_image_path || !orderData.folder_name || orderData.folder_location === 'none') {
    return null;
  }

  let folderPath: string;
  if (orderData.is_migrated) {
    // Legacy orders: use old paths (root or root/1Finished)
    folderPath = orderData.folder_location === 'active'
      ? SMB_PATHS.ROOT
      : path.join(SMB_PATHS.ROOT, SMB_PATHS.FINISHED_FOLDER);
  } else {
    // New app-created orders: use Orders subfolder
    folderPath = orderData.folder_location === 'active'
      ? path.join(SMB_PATHS.ROOT, SMB_PATHS.ORDERS_FOLDER)
      : path.join(SMB_PATHS.ROOT, SMB_PATHS.ORDERS_FOLDER, SMB_PATHS.FINISHED_FOLDER);
  }

  return path.join(folderPath, orderData.folder_name, orderData.sign_image_path);
}

/**
 * Check if part should be included in PDF (has display name or spec templates)
 */
export function shouldIncludePart(part: any, formType: FormType): boolean {
  const hasDisplayName = part.specs_display_name && part.specs_display_name.trim();

  // Check if part has any specification templates
  let hasSpecTemplates = false;
  if (part.specifications) {
    try {
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      hasSpecTemplates = specs &&
        Object.keys(specs).some(key => key.startsWith('_template_') && specs[key]);
    } catch (e) {
      hasSpecTemplates = false;
    }
  }

  return hasDisplayName || hasSpecTemplates;
}

/**
 * Check if part should start a new column (parent items only)
 */
export function shouldStartNewColumn(part: any): boolean {
  return Boolean(part.is_parent);
}

/**
 * Get specs quantity (manufacturing qty) - fallback to invoice quantity if not set
 * Now reads from dedicated specs_qty column instead of JSON
 *
 * @param part - Part object with specs_qty field
 * @returns Quantity value (specs_qty > quantity > 0)
 */
export function getSpecsQuantity(part: any): number {
  return part.specs_qty ?? part.quantity ?? 0;
}
