// File Clean up Finished: 2025-11-15
/**
 * PDF Header Rendering Functions
 * Functions for rendering headers, labels, dates, and quantity boxes in PDFs
 *
 * Extracted from pdfCommonGenerator.ts as part of file size reduction refactoring
 * REFACTORED: Eliminated ~60 lines of code duplication between renderMasterCustomerPageHeader
 * and renderMasterCustomerInfoRows
 */

import { COLORS, FONT_SIZES, SPACING, LAYOUT, LINE_WIDTHS } from './pdfConstants';
import { formatDueDateTime } from './pdfHelpers';

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// ============================================
// HEADER RENDERING FUNCTIONS
// ============================================

/**
 * Render master/customer form header info rows (3-row)
 * Row 1: Order # | Date | Customer
 * Row 2: Job # | PO# | Job Name
 * Row 3: (blank) | Due | Delivery
 *
 * REFACTORED: Now accepts optional deliveryBgColor parameter to support packing list styling
 * This eliminates code duplication with renderMasterCustomerPageHeader
 *
 * @param showDueDate - Whether to show due date (false for customer forms)
 * @param deliveryBgColor - Optional background color for Delivery field (for packing list styling)
 * @returns Y position after rows
 */
export function renderMasterCustomerInfoRows(
  doc: any,
  orderData: any,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number,
  showDueDate: boolean = true,
  deliveryBgColor?: string
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

  return currentY;
}

/**
 * Render master/customer header with title, info rows, and dividers
 * Returns Y position after header
 *
 * REFACTORED: Now calls renderMasterCustomerInfoRows instead of duplicating ~60 lines of code
 *
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

  // REFACTORED: Call renderMasterCustomerInfoRows instead of duplicating code
  currentY = renderMasterCustomerInfoRows(
    doc,
    orderData,
    col1X,
    col2X,
    col3X,
    currentY,
    showDueDate,
    deliveryBgColor
  );

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
