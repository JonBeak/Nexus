/**
 * Shared PDF Generator Utilities
 * Common constants, colors, spacing, and helper functions used across all PDF generators
 */

import path from 'path';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../../../config/paths';

export type FormType = 'master' | 'customer' | 'shop' | 'packing';

// ============================================
// CONSTANTS - COLORS
// ============================================
export const COLORS = {
  BLACK: '#000000',
  WHITE: '#ffffff',
  DARK_GRAY: '#333333',
  URGENT_RED: '#cc0000',
  LABEL_BACKGROUND: '#3a3a3a',
  DIVIDER_LIGHT: '#aaaaaa',
  DIVIDER_DARK: '#666666',
  QTY_STANDARD_BG: '#d9d9d9',      // Gray background for qty=1
  QTY_STANDARD_TEXT: '#000000',    // Black text for qty=1
  QTY_NONSTANDARD_BG: '#cc0000',   // Red background for qty≠1
  QTY_NONSTANDARD_TEXT: '#ffffff', // White text for qty≠1
};

// ============================================
// CONSTANTS - FONT SIZES
// ============================================
export const FONT_SIZES = {
  TITLE: 14,
  HEADER_VALUE: 11,
  SPEC_BODY: 12,
  HEADER_LABEL: 9,
  SCOPE: 12,
  QTY_NONSTANDARD: 18,
  INTERNAL_NOTE: 12,
  QTY_STANDARD: 14,
  INTERNAL_NOTE_LABEL: 10,
};

// ============================================
// CONSTANTS - SPACING
// ============================================
export const SPACING = {
  PAGE_MARGIN: 16,
  SECTION_GAP: 12,
  HEADER_ROW: 16,
  HEADER_START_OFFSET: 4,
  AFTER_TITLE: 16,
  AFTER_SCOPE: 14,
  AFTER_SEPARATOR: 8,
  AFTER_PRODUCT_NAME: 18,
  BEFORE_DIVIDER: 3,
  ITEM_GAP: 5,
  SPEC_ROW_GAP: 4,
  LABEL_PADDING: 2,
  QTY_BOX_PADDING: 5,
  IMAGE_AFTER_PARTS: 8,
  IMAGE_BOTTOM_MARGIN: 20,
  HEADER_VALUE_RAISE: 2,
  HEADER_LABEL_TO_VALUE: 6,
};

// ============================================
// CONSTANTS - LAYOUT
// ============================================
export const LAYOUT = {
  TITLE_WIDTH: 120,
  TITLE_LEFT_MARGIN: 6,
  TITLE_DIVIDER_OFFSET: 3,
  TITLE_INFO_GAP: 15,
  DIVIDER_HEIGHT: 40,
  COL2_PERCENT: 0.27,
  COL3_PERCENT: 0.54,
  PARTS_HEIGHT_PERCENT: 0.35,
  IMAGE_WIDTH_PERCENT: 0.95,
  NOTES_LEFT_WIDTH_PERCENT: 0.48,
  NOTES_RIGHT_START_PERCENT: 0.52,
  PART_COLUMN_INNER_PADDING: 5,
  PART_NAME_WIDTH_PERCENT: 0.6,
  QTY_BOX_WIDTH_PERCENT: 0.3,
  MAX_COLUMNS: 3,
  MIN_IMAGE_HEIGHT: 100,
  MIN_ADJUSTED_IMAGE_HEIGHT: 50,
};

// ============================================
// CONSTANTS - LINE WIDTHS
// ============================================
export const LINE_WIDTHS = {
  DIVIDER_MAIN: 1.5,
  DIVIDER_LIGHT: 0.5,
  VERTICAL_DIVIDER: 1,
};

// ============================================
// CONSTANTS - SMB PATHS (Re-exported from config/paths.ts)
// ============================================
export const SMB_PATHS = {
  ROOT: SMB_ROOT,
  ORDERS_FOLDER: ORDERS_FOLDER,
  FINISHED_FOLDER: FINISHED_FOLDER,
};

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
 * Render a header label with black background
 */
export function renderHeaderLabel(doc: any, label: string, x: number, y: number): number {
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelWidth = doc.widthOfString(label);
  const labelHeight = doc.currentLineHeight();

  // Draw black background behind label
  doc.fillColor(COLORS.LABEL_BACKGROUND)
    .rect(
      x - SPACING.LABEL_PADDING,
      y - 2,
      labelWidth + (SPACING.LABEL_PADDING * 2),
      labelHeight + 3
    )
    .fill();

  // Render label text in white
  doc.fillColor(COLORS.WHITE)
    .text(label, x, y);

  return labelWidth;
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
 * Render due date label and value with optional time
 */
export function renderDueDate(doc: any, orderData: any, x: number, y: number): void {
  if (!orderData.due_date) return;

  const dueDate = new Date(orderData.due_date);
  const dueDateStr = formatDueDateTime(dueDate, orderData.hard_due_date_time);
  const dueLabel = 'Due';

  // Always use black background label
  const dueLabelWidth = renderHeaderLabel(doc, dueLabel, x, y);

  // If hard deadline, make date value RED and BOLD
  if (orderData.hard_due_date_time) {
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica-Bold').fillColor(COLORS.URGENT_RED);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, y - SPACING.HEADER_VALUE_RAISE);
    doc.fillColor(COLORS.BLACK);
  } else {
    // Normal due date - regular black text
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, y - SPACING.HEADER_VALUE_RAISE);
  }
}

/**
 * Render quantity box with dynamic sizing based on standard vs non-standard quantities
 * @param doc - PDFKit document
 * @param specsQty - Quantity value
 * @param partX - X position for the box
 * @param partY - Y position for the box
 * @param partColumnWidth - Width of the column for text wrapping
 * @returns Updated Y position after the quantity box
 */
export function renderQuantityBox(
  doc: any,
  specsQty: number,
  partX: number,
  partY: number,
  partColumnWidth: number
): number {
  const qtyValue = Number(specsQty);
  const isStandard = qtyValue === 1 || qtyValue === 1.0;

  // Style based on quantity
  const bgColor = isStandard ? COLORS.QTY_STANDARD_BG : COLORS.QTY_NONSTANDARD_BG;
  const textColor = isStandard ? COLORS.QTY_STANDARD_TEXT : COLORS.QTY_NONSTANDARD_TEXT;
  const fontSize = isStandard ? FONT_SIZES.QTY_STANDARD : FONT_SIZES.QTY_NONSTANDARD;
  const fontWeight = isStandard ? 'Helvetica' : 'Helvetica-Bold';
  const boxHeight = isStandard ? 18 : 22;

  doc.fontSize(fontSize).font(fontWeight).fillColor(textColor);

  const qtyUnit = qtyValue <= 1 ? 'set' : 'sets';
  const qtyText = `Quantity: ${specsQty} ${qtyUnit}`;
  const qtyTextWidth = doc.widthOfString(qtyText);

  // Draw filled background rectangle
  doc.fillColor(bgColor)
    .rect(partX, partY - 1, qtyTextWidth + (SPACING.QTY_BOX_PADDING * 2), boxHeight)
    .fill();

  // Draw text on top (centered vertically in box)
  doc.fillColor(textColor)
    .text(qtyText, partX + SPACING.QTY_BOX_PADDING, partY + 2, { width: partColumnWidth });

  // Reset colors
  doc.fillColor(COLORS.BLACK).strokeColor(COLORS.BLACK);

  // Return updated Y position (add spacing after quantity box)
  return partY + boxHeight + 4;
}

/**
 * Render master/customer header with title, info rows, and dividers
 * Returns Y position after header
 * @param deliveryBgColor - Optional background color for Delivery field (for packing list styling)
 * @param pageTitle - Optional title text (default "Order Form")
 * @param showDueDate - Optional flag to show/hide due date (default true)
 */
export function renderMasterCustomerPageHeader(
  doc: any,
  orderData: any,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  startY: number,
  deliveryBgColor?: string,
  pageTitle: string = 'Order Form',
  showDueDate: boolean = true
): number {
  const headerStartY = startY;
  let currentY = startY + SPACING.HEADER_START_OFFSET;

  // Right side info columns
  const infoStartX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_INFO_GAP;
  const col1X = infoStartX;
  const col2X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL2_PERCENT;
  const col3X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL3_PERCENT;

  // Row 1: Order # | Date | Customer
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Customer';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.company_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: Job # | PO# | Job Name
  label = 'Job #';
  labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_job_number || '', col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'PO#';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_po || '', col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job Name';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 3: (blank) | Due | Delivery
  if (showDueDate) {
    renderDueDate(doc, orderData, col2X, currentY);
  }

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);

  // Render Delivery field (with optional background color for packing list)
  if (deliveryBgColor) {
    // Packing list style: draw background rectangle behind text
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica');
    const deliveryTextX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
    const deliveryTextY = currentY - SPACING.HEADER_VALUE_RAISE;
    const deliveryTextWidth = doc.widthOfString(shippingText);
    doc.rect(deliveryTextX, currentY - 4, deliveryTextWidth + 8, 16)
      .fillAndStroke(deliveryBgColor, COLORS.DIVIDER_DARK);
    doc.fillColor(COLORS.BLACK).font('Helvetica');
    doc.text(shippingText, deliveryTextX + 4, deliveryTextY);
  } else {
    // Order form style: plain text
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
    doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  }

  currentY += SPACING.HEADER_ROW;

  // Calculate total header content height
  const headerContentHeight = currentY - headerStartY;

  // Title text height: two lines (18pt + 12pt with spacing)
  const titleHeight = 42;

  // Calculate vertical center offset for title
  const titleVerticalOffset = (headerContentHeight - titleHeight) / 2;

  // Now render the left side title, vertically centered
  const titleY = headerStartY + titleVerticalOffset;
  const titleX = marginLeft + LAYOUT.TITLE_LEFT_MARGIN;

  // Page title (big, 18pt)
  doc.fontSize(18).font('Helvetica-Bold');
  doc.text(pageTitle, titleX, titleY);

  // Sign House Inc. (smaller, 12pt)
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Sign House Inc.', titleX, titleY + 22);

  // Draw vertical divider between title and info columns
  const dividerX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_DIVIDER_OFFSET;
  doc.strokeColor(COLORS.DIVIDER_DARK)
    .lineWidth(LINE_WIDTHS.VERTICAL_DIVIDER)
    .moveTo(dividerX, headerStartY)
    .lineTo(dividerX, currentY)
    .stroke();

  // Add spacing before divider
  currentY += SPACING.BEFORE_DIVIDER;

  // Horizontal divider - thicker line
  doc.strokeColor(COLORS.DIVIDER_DARK)
    .lineWidth(LINE_WIDTHS.DIVIDER_MAIN)
    .moveTo(marginLeft, currentY)
    .lineTo(pageWidth - marginRight, currentY)
    .stroke();

  doc.strokeColor(COLORS.BLACK);

  return currentY + SPACING.SECTION_GAP;
}

/**
 * Render master/customer form header info rows (3-row)
 * Row 1: Order # | Date | Customer
 * Row 2: Job # | PO# | Job Name
 * Row 3: (blank) | Due | Delivery
 *
 * @param showDueDate - Whether to show due date (false for customer forms)
 * @returns Y position after rows
 */
export function renderMasterCustomerInfoRows(
  doc: any,
  orderData: any,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number,
  showDueDate: boolean = true
): number {
  let currentY = startY;

  // Row 1: Order # | Date | Customer
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Customer';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.company_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: Job # | PO# | Job Name
  label = 'Job #';
  labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_job_number || '', col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'PO#';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_po || '', col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job Name';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 3: (blank) | Due | Delivery
  if (showDueDate) {
    renderDueDate(doc, orderData, col2X, currentY);
  }

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  return currentY;
}

/**
 * Render shop form header info rows (2-row)
 * Row 1: Order # | Date | Job
 * Row 2: (blank) | Due | Delivery
 *
 * @returns Y position after rows
 */
export function renderShopInfoRows(
  doc: any,
  orderData: any,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number
): number {
  let currentY = startY;

  // Row 1: Order # | Date | Job
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: (blank) | Due | Delivery
  renderDueDate(doc, orderData, col2X, currentY);

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  return currentY;
}

/**
 * Extract specs_qty from part specifications
 * Safely parses specifications JSON and extracts specs_qty with fallbacks
 *
 * @param part - Part object with specifications field
 * @returns Quantity value (specs_qty > quantity > 0)
 */
export function getSpecsQuantity(part: any): number {
  try {
    const specs = typeof part.specifications === 'string'
      ? JSON.parse(part.specifications)
      : part.specifications;
    return specs?.specs_qty ?? part.quantity ?? 0;
  } catch {
    return part.quantity ?? 0;
  }
}

