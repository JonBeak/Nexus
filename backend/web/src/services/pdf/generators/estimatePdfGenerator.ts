// File Clean up Finished: 2025-11-15
// Changes:
//   - Removed getTaxRate() function (32 lines) - moved tax lookup to repository layer
//   - Removed database import (query from config/database) - no longer needed
//   - Tax rate now pre-calculated in pdfGenerationService and passed via OrderDataForPDF
//   - Proper 3-layer architecture: Service receives all data, no direct database access
//   - File size reduced from 539 → 502 lines (7% reduction, now under 500-line limit)
//   - Architecture compliance: Matches pattern of other PDF generators (orderFormGenerator, packingListGenerator)
/**
 * Estimate Form PDF Generator
 * Generates estimate PDF with line items table and pricing totals
 *
 * Layout: Landscape Letter (11" x 8.5")
 * - Top Left (~70%): Line items table (QB Item, Description, Qty, Unit Price, Extended)
 * - Top Right (~30%): Order info (Order #, Job Name, Customer, Date) and totals (Subtotal, Tax, Total)
 * - Bottom: Cropped job image (max 50% of page height)
 *
 * Note: If more than 25 line items, table is hidden and message shown instead
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { OrderDataForPDF } from '../../../types/orders';
import { COLORS, FONT_SIZES, SPACING } from './pdfConstants';
import { getImageFullPath } from './pdfHelpers';

// =============================================
// CONSTANTS
// =============================================

const MAX_LINE_ITEMS = 25;  // Hide table if more than this
const TABLE_WIDTH_PERCENT = 0.55;  // Table takes 58% of page width
const MAX_IMAGE_HEIGHT_PERCENT = 0.50;  // Image max height is 50% of page

// =============================================
// MAIN GENERATOR FUNCTION
// =============================================

/**
 * Generate Estimate Form PDF
 */
export async function generateEstimateForm(
  orderData: OrderDataForPDF,
  outputPath: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginLeft = 20;
      const marginRight = 20;
      const marginBottom = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;

      let currentY = 20;

      // Calculate pricing data and get line items
      const pricingData = await calculatePricingData(orderData);

      // Calculate table width (55% of content width)
      const tableWidth = contentWidth * TABLE_WIDTH_PERCENT;

      // Render job/customer details on far right (parallel to table)
      const rightSideStartY = currentY;
      renderJobCustomerDetails(doc, orderData, marginLeft, contentWidth, pageWidth, marginRight, rightSideStartY);

      // Check if we should show table or message
      if (pricingData.lineItems.length > MAX_LINE_ITEMS) {
        // Too many items - show message instead
        doc.fontSize(11).font('Helvetica');
        doc.text(
          `This order contains ${pricingData.lineItems.length} line items. Please see the Master Form for complete details.`,
          marginLeft,
          currentY,
          { width: tableWidth, align: 'center' }
        );
        currentY += 60;
      } else if (pricingData.lineItems.length === 0) {
        // No invoice items
        doc.fontSize(11).font('Helvetica');
        doc.text('No invoice items found for this order.', marginLeft, currentY, { width: tableWidth, align: 'center' });
        currentY += 60;
      } else {
        // Render line items table (on left side, 55% width)
        currentY = renderLineItemsTable(doc, pricingData.lineItems, marginLeft, tableWidth, currentY);
      }

      // Render totals next to the table (close to grid, minimal gap)
      renderTotalsBox(doc, pricingData, marginLeft, tableWidth, rightSideStartY);

      // Render job image at bottom of page (if space available and image exists)
      // Calculate position: bottom of page, working upward with max 50% height
      const maxImageHeight = pageHeight * MAX_IMAGE_HEIGHT_PERCENT;
      const imageStartY = pageHeight - marginBottom - maxImageHeight;
      await renderJobImage(doc, orderData, imageStartY, marginLeft, contentWidth, pageHeight, marginBottom);

      doc.end();

      stream.on('finish', () => {
        console.log(`[Estimate PDF] Generated: ${outputPath}`);
        resolve(outputPath);
      });
      stream.on('error', reject);
    } catch (error) {
      console.error('[Estimate PDF] Generation failed:', error);
      reject(error);
    }
  });
}

// =============================================
// PRICING CALCULATION
// =============================================

interface PricingData {
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

interface LineItem {
  qbItem: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extended: number;
}

/**
 * Calculate pricing data from order parts
 */
async function calculatePricingData(orderData: OrderDataForPDF): Promise<PricingData> {
  // Filter parts that have invoice data (extended_price is not null)
  const invoiceParts = orderData.parts.filter(
    part => part.extended_price !== null && part.extended_price !== undefined
  );

  // Build line items - only skip rows where QB Item Name, invoice_description, AND unit_price are ALL null
  const lineItems: LineItem[] = invoiceParts
    .map((part) => ({
      qbItem: part.qb_item_name || '',
      description: part.invoice_description || '',  // Price Calculation column only, no fallback
      quantity: Number(part.quantity) || 0,
      unitPrice: Number(part.unit_price) || 0,
      extended: Number(part.extended_price) || 0
    }))
    .filter(item => {
      // Only skip if QB Item Name, invoice_description, AND unit_price are ALL empty/null
      const hasQbItem = item.qbItem && item.qbItem.trim() !== '';
      const hasDescription = item.description && item.description.trim() !== '';
      const hasUnitPrice = item.unitPrice !== null && item.unitPrice !== undefined;

      // Include row if ANY of these fields has a value
      return hasQbItem || hasDescription || hasUnitPrice;
    });

  // Calculate subtotal
  const subtotal = lineItems.reduce((sum, item) => sum + item.extended, 0);

  // Use pre-calculated tax rate from orderData
  const taxRate = orderData.tax_percent || 0;

  // Calculate tax and total
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  return {
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    total
  };
}

// =============================================
// TABLE RENDERING
// =============================================

/**
 * Render line items table with Item Name column and row lines
 */
function renderLineItemsTable(
  doc: any,
  lineItems: LineItem[],
  x: number,
  width: number,
  startY: number
): number {
  const rowHeight = 16;  // Condensed row height
  const fontSize = 9;    // Small font for compact table
  let y = startY;
  const tableStartY = startY;  // Track start for box border

  // Column widths (narrower overall)
  const colWidths = {
    itemName: 105,       // Item Name column (narrower)
    desc: width - 250,  // Description (remaining space)
    qty: 25,            // Qty (narrower)
    unit: 60,           // Unit Price (narrower)
    extended: 60        // Extended (narrower)
  };

  const cellPadding = 3;  // Padding from vertical lines

  // Table header - with padding from top border
  doc.fontSize(fontSize).font('Helvetica-Bold');
  doc.fillColor(COLORS.BLACK);

  let xPos = x + cellPadding;
  doc.text('Item Name', xPos, y + 3);
  xPos += colWidths.itemName;
  doc.text('Description', xPos, y + 3);
  xPos += colWidths.desc;
  doc.text('Qty', xPos, y + 3);
  xPos += colWidths.qty;
  doc.text('Unit Price', xPos, y + 3);
  xPos += colWidths.unit;
  doc.text('Extended', xPos, y + 3);

  y += rowHeight;

  // Draw header line
  doc.strokeColor(COLORS.BLACK)
    .lineWidth(1)
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke();

  y += 5;

  // Table rows
  doc.font('Helvetica');
  lineItems.forEach((item, index) => {
    const rowStartY = y;
    xPos = x + cellPadding;

    // Item Name (was QB Item)
    doc.text(item.qbItem, xPos, y, { width: colWidths.itemName - cellPadding * 2, lineBreak: false, ellipsis: true });
    xPos += colWidths.itemName;

    // Description (allow wrapping for long descriptions)
    const descHeight = doc.heightOfString(item.description, { width: colWidths.desc - cellPadding * 2 });
    doc.text(item.description, xPos, y, { width: colWidths.desc - cellPadding * 2 });
    xPos += colWidths.desc;

    // Qty
    doc.text(Number(item.quantity).toString(), xPos, y);
    xPos += colWidths.qty;

    // Unit Price
    doc.text(`$${Number(item.unitPrice).toFixed(2)}`, xPos, y);
    xPos += colWidths.unit;

    // Extended
    doc.text(`$${Number(item.extended).toFixed(2)}`, xPos, y);

    // Update y position (account for multi-line descriptions)
    const actualRowHeight = Math.max(rowHeight, descHeight + 4);
    y += actualRowHeight;

    // Draw line after each row (except last) - positioned higher (closer to row above)
    if (index < lineItems.length - 1) {
      const lineY = y - 2; // Move line 2px higher
      doc.strokeColor(COLORS.DIVIDER_LIGHT)
        .lineWidth(0.5)
        .moveTo(x, lineY)
        .lineTo(x + width, lineY)
        .stroke();
    }
  });

  const tableEndY = y;

  // Draw internal vertical lines in light gray (draw first so black border is on top)
  doc.strokeColor(COLORS.DIVIDER_LIGHT).lineWidth(0.5);

  xPos = x + colWidths.itemName;
  doc.moveTo(xPos, tableStartY).lineTo(xPos, tableEndY).stroke();  // After Item Name

  xPos += colWidths.desc;
  doc.moveTo(xPos, tableStartY).lineTo(xPos, tableEndY).stroke();  // After Description

  xPos += colWidths.qty;
  doc.moveTo(xPos, tableStartY).lineTo(xPos, tableEndY).stroke();  // After Qty

  xPos += colWidths.unit;
  doc.moveTo(xPos, tableStartY).lineTo(xPos, tableEndY).stroke();  // After Unit Price

  // Draw box border around entire table in black (draw last so it's on top)
  doc.strokeColor(COLORS.BLACK)
    .lineWidth(1)
    .rect(x, tableStartY, width, tableEndY - tableStartY)
    .stroke();

  return y;
}

// =============================================
// JOB/CUSTOMER DETAILS (FAR RIGHT)
// =============================================

/**
 * Render job/customer details on far right of page (right-justified, no labels)
 */
function renderJobCustomerDetails(
  doc: any,
  orderData: OrderDataForPDF,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  startY: number
): void {
  const fontSize = 11;  // Larger font
  const rowHeight = 15;
  const sectionWidth = 200;  // Total width for the details section

  // Position closer to the right edge
  const sectionX = pageWidth - marginRight - sectionWidth - 5;

  let y = startY;

  doc.fontSize(fontSize).font('Helvetica');

  // Order Number (with "Order #" prefix, right-justified)
  doc.text(`Order # ${orderData.order_number}`, sectionX, y, { width: sectionWidth, align: 'right' });
  y += rowHeight;

  // Job Name (right-justified, bold)
  doc.font('Helvetica-Bold');
  doc.text(orderData.order_name || '', sectionX, y, { width: sectionWidth, align: 'right' });
  y += rowHeight;

  // Customer (right-justified, bold)
  doc.text(orderData.company_name, sectionX, y, { width: sectionWidth, align: 'right' });
  y += rowHeight;

  // Date (format: January 15, 2025, right-justified, normal weight)
  doc.font('Helvetica');
  const formattedDate = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(formattedDate, sectionX, y, { width: sectionWidth, align: 'right' });
}

// =============================================
// TOTALS BOX (NEXT TO TABLE)
// =============================================

/**
 * Render totals in a smaller box next to the estimate table
 */
function renderTotalsBox(
  doc: any,
  pricingData: PricingData,
  marginLeft: number,
  tableWidth: number,
  startY: number
): void {
  const fontSize = 10;
  const rowHeight = 14;
  const labelWidth = 70;    // Narrower
  const valueWidth = 65 ;    // Narrower
  const boxWidth = labelWidth + valueWidth + 8;  // Smaller box
  const boxPadding = 4;     // Less padding

  // Position next to the table (minimal gap)
  const boxX = marginLeft + tableWidth + 5;
  const labelX = boxX + boxPadding;
  const valueX = labelX + labelWidth;

  let y = startY + boxPadding;

  doc.fontSize(fontSize).font('Helvetica');

  // Subtotal
  doc.text('Subtotal:', labelX, y);
  doc.text(`$${pricingData.subtotal.toFixed(2)}`, valueX, y);
  y += rowHeight;

  // Tax
  const taxPercentage = (pricingData.taxRate * 100).toFixed(0);
  doc.text(`Tax (${taxPercentage}%):`, labelX, y);
  doc.text(`$${pricingData.taxAmount.toFixed(2)}`, valueX, y);
  y += rowHeight;

  // Draw line above total - extend to left edge
  doc.strokeColor(COLORS.BLACK)
    .lineWidth(1)
    .moveTo(boxX, y - 3)
    .lineTo(valueX + valueWidth - boxPadding, y - 3)
    .stroke();

  y += 2;

  // Total (bold)
  doc.font('Helvetica-Bold');
  doc.text('Total:', labelX, y);
  doc.text(`$${pricingData.total.toFixed(2)}`, valueX, y);
  y += rowHeight + boxPadding/2;

  // Draw left line only for totals box
  doc.strokeColor(COLORS.BLACK)
    .lineWidth(1)
    .moveTo(boxX, startY)
    .lineTo(boxX, y)
    .stroke();
}

// =============================================
// IMAGE RENDERING
// =============================================

/**
 * Crop an image using Sharp
 */
async function cropImage(
  imagePath: string,
  cropCoords: { top: number; right: number; bottom: number; left: number }
): Promise<Buffer> {
  const imageMetadata = await sharp(imagePath).metadata();
  const cropWidth = (imageMetadata.width || 0) - cropCoords.left - cropCoords.right;
  const cropHeight = (imageMetadata.height || 0) - cropCoords.top - cropCoords.bottom;

  return sharp(imagePath)
    .extract({
      left: cropCoords.left,
      top: cropCoords.top,
      width: cropWidth,
      height: cropHeight
    })
    .toBuffer();
}

/**
 * Render job image at bottom of page with cropping support (max 50% of page height)
 */
async function renderJobImage(
  doc: any,
  orderData: OrderDataForPDF,
  startY: number,
  marginLeft: number,
  contentWidth: number,
  pageHeight: number,
  marginBottom: number
): Promise<void> {
  if (!orderData.sign_image_path) {
    return;
  }

  try {
    const imagePath = getImageFullPath(orderData);

    // Check if imagePath is valid
    if (!imagePath) {
      return;
    }

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`[Estimate PDF] Image not found: ${imagePath}`);
      return;
    }

    // Image is positioned at bottom of page with max 50% height
    const maxImageHeight = pageHeight * MAX_IMAGE_HEIGHT_PERCENT;

    // Only render if we have at least 100px height available
    if (maxImageHeight < 100) {
      console.log(`[Estimate PDF] Not enough space for image (only ${maxImageHeight}px available)`);
      return;
    }

    const maxWidth = contentWidth;
    const maxHeight = maxImageHeight;

    // Check if image has crop coordinates
    const hasCrop = orderData.crop_top || orderData.crop_right || orderData.crop_bottom || orderData.crop_left;

    if (hasCrop) {
      try {
        console.log(`[Estimate PDF] Applying crop: T${orderData.crop_top} R${orderData.crop_right} B${orderData.crop_bottom} L${orderData.crop_left}`);

        // Crop the image
        const croppedBuffer = await cropImage(imagePath, {
          top: orderData.crop_top || 0,
          right: orderData.crop_right || 0,
          bottom: orderData.crop_bottom || 0,
          left: orderData.crop_left || 0
        });

        // Embed cropped image
        doc.image(croppedBuffer, marginLeft, startY, {
          fit: [maxWidth, maxHeight],
          align: 'center',
          valign: 'top'
        });
        console.log(`[Estimate PDF] Successfully loaded cropped image`);
      } catch (cropError) {
        console.error('[Estimate PDF] Crop failed, using original:', cropError);
        // Fall back to original image
        doc.image(imagePath, marginLeft, startY, {
          fit: [maxWidth, maxHeight],
          align: 'center',
          valign: 'top'
        });
        console.log(`[Estimate PDF] Successfully loaded image (crop failed, using original)`);
      }
    } else {
      // No crop coordinates, use original image
      doc.image(imagePath, marginLeft, startY, {
        fit: [maxWidth, maxHeight],
        align: 'center',
        valign: 'top'
      });
      console.log(`[Estimate PDF] Successfully loaded image (no crop)`);
    }
  } catch (error) {
    console.error('[Estimate PDF] Error rendering job image:', error);
    // Continue without image
  }
}
