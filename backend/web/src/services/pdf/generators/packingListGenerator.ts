/**
 * Packing List Generator
 * Based on Master Form layout with Specs section replaced by packing checklist
 *
 * Layout: Landscape Letter (11" x 8.5")
 * Design: Same as Master Form, but Parts section shows packing items instead of specs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { STORAGE_CONFIG } from '../../../config/storage';
import { getPackingItemsForProduct, PackingItem } from '../packingItemsMapper';
import { combineSpecifications, flattenCombinedSpecs } from '../specificationCombiner';
import type { OrderDataForPDF } from '../pdfGenerationService';

// SMB Path Constants (same as OrderFormGenerator)
const SMB_PATHS = {
  ROOT: '/mnt/channelletter',
  ORDERS_FOLDER: 'Orders',
  FINISHED_FOLDER: '1Finished',
};

// Debug logging to console
function debugLog(message: string) {
  console.log(`======================== PDF DEBUG ========================`);
  console.log(message);
  console.log(`===========================================================`);
}

/**
 * Get full image path from order data (same logic as OrderFormGenerator)
 */
function getImageFullPath(orderData: OrderDataForPDF): string | null {
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
 * Render a header label with gray background
 */
function renderHeaderLabel(doc: any, label: string, x: number, y: number): number {
  doc.fontSize(10).font('Helvetica-Bold');
  const labelWidth = doc.widthOfString(label);
  const labelHeight = doc.currentLineHeight();

  // Draw gray background behind label
  doc.fillColor(COLORS.LABEL_BACKGROUND)
    .rect(
      x - 2,
      y - 2,
      labelWidth + 4,
      labelHeight + 3
    )
    .fill();

  // Render label text
  doc.fillColor(COLORS.TEXT_BLACK)
    .text(label, x, y);

  return labelWidth;
}

/**
 * Render notes and image section (async to handle Sharp image processing)
 */
async function renderNotesAndImage(
  doc: any,
  orderData: OrderDataForPDF,
  maxPartY: number,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  pageHeight: number
): Promise<void> {
  const actualImageStartY = maxPartY + 8;
  const actualImageHeight = pageHeight - actualImageStartY - 20;

  // Draw separator line above notes/image section
  doc.strokeColor(COLORS.DIVIDER_LIGHT)
    .lineWidth(0.5)
    .moveTo(marginLeft, actualImageStartY - 5)
    .lineTo(pageWidth - marginRight, actualImageStartY - 5)
    .stroke();

  let notesY = actualImageStartY;

  // Two-column layout for notes
  const notesColumnWidth = contentWidth * 0.55;
  const notesLeftX = marginLeft;

  // Special Instructions (manufacturing_note) - match Master Form spec body font
  if (orderData.manufacturing_note) {
    doc.fontSize(12).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
    doc.text(orderData.manufacturing_note, notesLeftX, notesY, {
      width: notesColumnWidth,
      lineBreak: true
    });

    // Calculate space used by notes
    const notesHeight = doc.heightOfString(orderData.manufacturing_note, { width: notesColumnWidth }) + 10;
    notesY += notesHeight;
  }

  // ============================================
  // IMAGE SECTION
  // ============================================
  const fullImagePath = getImageFullPath(orderData);
  if (fullImagePath && fs.existsSync(fullImagePath)) {
    try {
      debugLog(`[IMAGE] Attempting to load image: ${fullImagePath}`);

      // Adjust image start position based on notes
      const imageStartY = Math.max(actualImageStartY, notesY);
      const imageHeight = pageHeight - imageStartY - 20;

      debugLog(`[IMAGE] Image Y: ${imageStartY}, Height: ${imageHeight}`);

      // Only draw if there's enough space
      if (imageHeight > 80) {
        const imageWidth = contentWidth * 0.95;
        const imageX = marginLeft + (contentWidth - imageWidth) / 2;

        // Check if image has crop coordinates
        const hasCrop = orderData.crop_top || orderData.crop_right || orderData.crop_bottom || orderData.crop_left;

        if (hasCrop) {
          try {
            debugLog(`[IMAGE] Applying crop: T${orderData.crop_top} R${orderData.crop_right} B${orderData.crop_bottom} L${orderData.crop_left}`);

            // Get image metadata
            const imageMetadata = await sharp(fullImagePath).metadata();
            const cropWidth = (imageMetadata.width || 0) - (orderData.crop_left || 0) - (orderData.crop_right || 0);
            const cropHeight = (imageMetadata.height || 0) - (orderData.crop_top || 0) - (orderData.crop_bottom || 0);

            // Extract cropped region
            const croppedBuffer = await sharp(fullImagePath)
              .extract({
                left: orderData.crop_left || 0,
                top: orderData.crop_top || 0,
                width: cropWidth,
                height: cropHeight
              })
              .toBuffer();

            // Embed cropped image
            doc.image(croppedBuffer, imageX, imageStartY, {
              fit: [imageWidth, imageHeight],
              align: 'center',
              valign: 'center'
            });
            debugLog(`[IMAGE] ✅ Successfully loaded cropped image (${cropWidth}x${cropHeight})`);
          } catch (cropError) {
            console.error('[IMAGE] ⚠️ Crop failed, using original:', cropError);
            // Fall back to original image
            doc.image(fullImagePath, imageX, imageStartY, {
              fit: [imageWidth, imageHeight],
              align: 'center'
            });
            debugLog(`[IMAGE] ✅ Successfully loaded image (crop failed, using original)`);
          }
        } else {
          // No crop - use original image
          doc.image(fullImagePath, imageX, imageStartY, {
            fit: [imageWidth, imageHeight],
            align: 'center'
          });
          debugLog(`[IMAGE] ✅ Successfully loaded image (no crop)`);
        }
      } else {
        debugLog(`[IMAGE] ⚠️ Not enough space for image (only ${imageHeight}px available)`);
      }
    } catch (error) {
      console.error('[IMAGE] ⚠️ Failed to load image:', error);
      debugLog(`[IMAGE] ⚠️ Failed to load image: ${error}`);
    }
  } else {
    debugLog(`[IMAGE] ⚠️ Image file not found: ${fullImagePath}`);
  }
}

// =============================================
// COLORS
// =============================================
const COLORS = {
  HEADER_BLACK: '#000000',
  TEXT_BLACK: '#000000',
  TEXT_GRAY: '#666666',
  DIVIDER: '#999999',
  DIVIDER_LIGHT: '#dddddd',
  CHECKBOX_BORDER: '#000000',
  PICKUP_BG: '#ADD8E6',      // Light Blue
  SHIPPING_BG: '#FFFFB3',    // Light Yellow
  NOT_REQUIRED_BG: '#A0A0A0', // Darker Gray
  NOT_REQUIRED_TEXT: '#000000', // Black (for bold text)
  LABEL_BACKGROUND: '#c0c0c0', // Gray background for header labels
  QTY_STANDARD_BG: '#e8e8e8',      // Gray background for qty=1
  QTY_NONSTANDARD_BG: '#cc0000',   // Red background for qty≠1
  QTY_NONSTANDARD_TEXT: '#ffffff', // White text for qty≠1
};

/**
 * Generate Packing List
 * @param orderData - Order data for PDF generation
 * @param outputPath - Full path including filename
 */
export async function generatePackingList(
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
      const contentWidth = pageWidth - marginLeft - marginRight;
      let currentY = 20;

      // Determine shipping method (blue for pickup, yellow for shipping)
      const isPickup = orderData.status === 'pick_up' || !orderData.shipping_required;
      const checkboxBgColor = isPickup ? COLORS.PICKUP_BG : COLORS.SHIPPING_BG;

      // ============================================
      // COMPACT HEADER WITH INFO (same as Master Form)
      // ============================================

      // Header setup
      const titleWidth = 120;
      const infoStartX = marginLeft + titleWidth + 25;
      const headerStartY = currentY;
      currentY = currentY + 4; // Add padding above header data (HEADER_START_OFFSET)

      // Right side info columns
      const col1X = infoStartX;
      const col2X = infoStartX + (contentWidth - titleWidth - 25) * 0.35;
      const col3X = infoStartX + (contentWidth - titleWidth - 25) * 0.68;

      doc.fontSize(10).font('Helvetica-Bold');

      // Row 1: Order # | Customer | Job Name
      let labelWidth = renderHeaderLabel(doc, 'Order #:', col1X, currentY);
      doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
      doc.text(String(orderData.order_number), col1X + labelWidth + 6, currentY - 2);

      labelWidth = renderHeaderLabel(doc, 'Customer:', col2X, currentY);
      doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
      doc.text(orderData.company_name, col2X + labelWidth + 6, currentY - 2);

      labelWidth = renderHeaderLabel(doc, 'Job:', col3X, currentY);
      doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
      doc.text(orderData.order_name, col3X + labelWidth + 6, currentY - 2);
      currentY += 16;

      // Row 2: Customer PO# | Customer Job # | Order Date
      labelWidth = renderHeaderLabel(doc, 'Customer PO#:', col1X, currentY);
      doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
      doc.text(orderData.customer_po || '', col1X + labelWidth + 6, currentY - 2);

      labelWidth = renderHeaderLabel(doc, 'Customer Job #:', col2X, currentY);
      doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
      doc.text(orderData.customer_job_number || '', col2X + labelWidth + 6, currentY - 2);

      const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      labelWidth = renderHeaderLabel(doc, 'Order Date:', col3X, currentY);
      doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
      doc.text(orderDateStr, col3X + labelWidth + 6, currentY - 2);
      currentY += 16;

      // Row 3: Due Date | Delivery
      if (orderData.due_date) {
        const dueDate = new Date(orderData.due_date);
        let dueDateStr = dueDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        // Add time if hard_due_date_time exists
        if (orderData.hard_due_date_time) {
          const timeParts = orderData.hard_due_date_time.split(':');
          const hours = parseInt(timeParts[0], 10);
          const minutes = timeParts[1];
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          const timeStr = `${displayHours}:${minutes} ${period}`;
          dueDateStr += ` ${timeStr}`;
        }

        // Always use gray background label
        labelWidth = renderHeaderLabel(doc, 'Due:', col1X, currentY);

        // If hard deadline, make date value RED and BOLD
        if (orderData.hard_due_date_time) {
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#cc0000');
          doc.text(dueDateStr, col1X + labelWidth + 6, currentY - 2);
          doc.fillColor(COLORS.TEXT_BLACK);
        } else {
          // Normal due date - regular black text
          doc.fontSize(13).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
          doc.text(dueDateStr, col1X + labelWidth + 6, currentY - 2);
        }
      }

      // Delivery - with colored background for the text
      const shippingText = isPickup ? 'Pick Up' : 'Shipping';
      labelWidth = renderHeaderLabel(doc, 'Delivery:', col2X, currentY);

      // Draw background rectangle for delivery text - box raised but text stays same position
      const deliveryTextX = col2X + labelWidth + 6;
      const deliveryTextY = currentY - 2;  // Text position (same as other header values)
      doc.fontSize(13).font('Helvetica');
      const deliveryTextWidth = doc.widthOfString(shippingText);
      doc.rect(deliveryTextX, currentY - 4, deliveryTextWidth + 8, 16)
        .fillAndStroke(checkboxBgColor, COLORS.CHECKBOX_BORDER);

      // Draw text on top of background - black text
      doc.fillColor(COLORS.TEXT_BLACK).font('Helvetica');
      doc.text(shippingText, deliveryTextX + 4, deliveryTextY);
      currentY += 16;

      currentY += 3;

      // Calculate total header content height
      const headerContentHeight = currentY - headerStartY;

      // Title text height: two lines of 14pt text with 18pt spacing = ~32pt total
      const titleHeight = 32;

      // Calculate vertical center offset for title
      const titleVerticalOffset = (headerContentHeight - titleHeight) / 2;

      // Now render the left side title, vertically centered
      const titleY = headerStartY + titleVerticalOffset;
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Sign House Inc.', marginLeft, titleY);
      doc.text('Packing List', marginLeft, titleY + 18);

      // Draw vertical divider between title and info columns
      const dividerX = marginLeft + titleWidth + 7.5;
      doc.strokeColor(COLORS.DIVIDER)
        .lineWidth(1)
        .moveTo(dividerX, headerStartY)
        .lineTo(dividerX, currentY)
        .stroke();

      // Horizontal divider - thicker line
      doc.strokeColor(COLORS.DIVIDER).lineWidth(1.5)
        .moveTo(marginLeft, currentY)
        .lineTo(pageWidth - marginRight, currentY)
        .stroke();
      doc.strokeColor(COLORS.TEXT_BLACK);
      currentY += 12;

      // ============================================
      // MAIN CONTENT AREA - PARTS WITH PACKING ITEMS
      // ============================================
      const contentStartY = currentY;
      const availableHeight = pageHeight - contentStartY - 15;

      // Group parts: parent items with their sub-items (SAME LOGIC as Master Form)
      const partColumns: Array<{ parent: any; subItems: any[] }> = [];

      orderData.parts.forEach((part) => {
        // Skip parts with no meaningful specification data
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

        // Show part only if it has a display name OR has specification templates
        if (!hasDisplayName && !hasSpecTemplates) {
          return; // Skip this part
        }

        // Determine if this is a sub-item (display_number contains letter like "1a", "1b")
        const hasLetterInDisplayNumber = part.display_number ? /[a-zA-Z]/.test(part.display_number) : false;

        // A part should start a new column if:
        // 1. It's marked as a parent (is_parent = true), OR
        // 2. It has no letter in display_number (like "1", "2", "3" instead of "1a", "2b")
        const shouldStartNewColumn = part.is_parent || !hasLetterInDisplayNumber;

        if (shouldStartNewColumn) {
          // This is a parent or regular base item - create new column
          partColumns.push({ parent: part, subItems: [] });
        } else {
          // This is a sub-item - find the matching parent column by display number prefix
          // E.g., "1a" should match with parent "1", "2b" should match with parent "2"
          const parentNumber = part.display_number?.replace(/[a-zA-Z]/g, '');
          const matchingColumn = partColumns.find(col => col.parent.display_number === parentNumber);

          if (matchingColumn) {
            matchingColumn.subItems.push(part);
          } else if (partColumns.length > 0) {
            // Fallback: append to last column if no match found
            partColumns[partColumns.length - 1].subItems.push(part);
          }
        }
      });

      // Calculate column layout for main parts only - up to 3 columns
      const numParts = partColumns.length;
      const numColumns = Math.min(numParts, 3);
      const columnWidth = contentWidth / numColumns;

      // Parts section height - allocate 35% of available height
      const partsHeight = availableHeight * 0.35;

      // Draw main parts in columns with packing items
      let maxPartY = contentStartY;

      partColumns.forEach((column, colIndex) => {
        const part = column.parent;
        const partX = marginLeft + (colIndex * columnWidth);
        let partY = contentStartY;

        // Get specs_qty from specifications (same as Master Form)
        let specsQty = 0;
        try {
          const specs = typeof part.specifications === 'string'
            ? JSON.parse(part.specifications)
            : part.specifications;
          specsQty = specs?.specs_qty ?? part.quantity ?? 0;
        } catch {
          specsQty = part.quantity ?? 0;
        }

        // Part header - use specs_display_name instead of product_type
        const displayName = part.specs_display_name || part.product_type;
        doc.fontSize(14).font('Helvetica-Bold');
        const textWidth = doc.widthOfString(displayName);

        doc.text(displayName, partX, partY, {
          width: columnWidth * 0.6,
          lineBreak: false,
          ellipsis: true
        });

        partY += 16;

        // Scope (if present) - same formatting as Master Form
        if (part.part_scope) {
          doc.fontSize(11).font('Helvetica').fillColor(COLORS.TEXT_BLACK);
          doc.text(`Scope: ${part.part_scope}`, partX, partY, {
            width: columnWidth - 10,
            lineBreak: false,
            ellipsis: true
          });
          partY += 14;
        }

        // Draw horizontal separator line between header and checklist (same as Master Form)
        doc.strokeColor('#cccccc').lineWidth(0.5)
          .moveTo(partX, partY)
          .lineTo(partX + columnWidth - 10, partY)
          .stroke();
        doc.strokeColor('#000000'); // Reset stroke color
        partY += 8;

        // Get packing items using combined specifications from parent + sub-items
        const productTypeForPacking = part.specs_display_name || part.product_type;

        // Debug logging
        console.log(`[Packing List] Part ${part.display_number}: productTypeForPacking="${productTypeForPacking}" (specs_display_name="${part.specs_display_name}", product_type="${part.product_type}")`);

        // Combine specifications from parent + sub-items (same as Master Form)
        const allParts = [part, ...column.subItems];
        const combinedSpecsMap = combineSpecifications(allParts);
        const combinedSpecs = flattenCombinedSpecs(combinedSpecsMap);

        // Pass customer preferences for packing item auto-fill
        const customerPrefs = {
          pattern_yes_or_no: orderData.pattern_yes_or_no,
          pattern_type: orderData.pattern_type,
          wiring_diagram_yes_or_no: orderData.wiring_diagram_yes_or_no
        };

        // Debug: Log combined specs
        console.log(`\n[Packing List] Part ${part.display_number} (${productTypeForPacking})`);
        console.log(`[Packing List] Combined specs templates:`, Object.keys(combinedSpecs).filter(k => k.startsWith('_template')).map(k => `${k}=${combinedSpecs[k]}`));
        console.log(`[Packing List] Full combined specs:`, JSON.stringify(combinedSpecs, null, 2));

        // Get packing items using combined specs - show only relevant items
        const packingItems = getPackingItemsForProduct(productTypeForPacking, combinedSpecs, customerPrefs);

        // Draw packing items with checkboxes and labels - styled like Master Form spec labels
        const checkboxWidth = 120;  // Longer checkbox
        const checkboxHeight = 18;  // Higher checkbox
        const labelFontSize = 11;  // Match Master Form spec labels

        // First pass: find the longest label width
        let maxLabelWidth = 0;
        packingItems.forEach((item) => {
          doc.fontSize(labelFontSize).font('Helvetica-Bold');
          const labelWidth = doc.widthOfString(item.name);
          if (labelWidth > maxLabelWidth) {
            maxLabelWidth = labelWidth;
          }
        });

        // Calculate checkbox X position (15 pixels right of longest label)
        const checkboxX = partX + maxLabelWidth + 15;

        packingItems.forEach((item) => {
          // Item label with gray background (like Master Form spec labels)
          doc.fontSize(labelFontSize).font('Helvetica-Bold');
          const labelWidth = doc.widthOfString(item.name);
          const labelHeight = doc.currentLineHeight();

          // Draw gray background behind label
          doc.fillColor(COLORS.LABEL_BACKGROUND)
            .rect(
              partX - 2,
              partY - 2,
              labelWidth + 4,
              labelHeight + 3
            )
            .fill();

          // Render label text
          doc.fillColor(COLORS.TEXT_BLACK)
            .text(item.name, partX, partY, { lineBreak: false });

          // Draw checkbox AFTER label - aligned right of longest label
          if (item.required) {
            // Required item: show empty checkbox with blue/yellow background
            doc.rect(checkboxX, partY - 2, checkboxWidth, checkboxHeight)
              .lineWidth(0.5)
              .fillAndStroke(checkboxBgColor, COLORS.CHECKBOX_BORDER);
          } else {
            // Not required: show gray box with "No" text centered
            doc.rect(checkboxX, partY - 2, checkboxWidth, checkboxHeight)
              .lineWidth(0.5)
              .fillAndStroke(COLORS.NOT_REQUIRED_BG, COLORS.CHECKBOX_BORDER);

            // Center "No" text in the box (bold)
            doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.NOT_REQUIRED_TEXT);
            const noText = 'No';
            const noTextWidth = doc.widthOfString(noText);
            const textX = checkboxX + (checkboxWidth - noTextWidth) / 2;
            const textY = partY + 2; // Vertically center in box
            doc.text(noText, textX, textY, { lineBreak: false });

            // Reset color
            doc.fillColor(COLORS.TEXT_BLACK);
          }

          partY += 22;  // Spacing for checkboxes
        });

        // Quantity box at bottom of packing checklist - WITH FILLED BOX (same as Order Forms)
        const qtyValue = Number(specsQty);
        const isStandard = qtyValue === 1 || qtyValue === 1.0;

        // Style based on quantity
        const bgColor = isStandard ? COLORS.QTY_STANDARD_BG : COLORS.QTY_NONSTANDARD_BG;
        const textColor = isStandard ? COLORS.TEXT_BLACK : COLORS.QTY_NONSTANDARD_TEXT;
        const fontSize = isStandard ? 11 : 13;
        const fontWeight = isStandard ? 'Helvetica' : 'Helvetica-Bold';

        doc.fontSize(fontSize).font(fontWeight).fillColor(textColor);

        const qtyUnit = qtyValue <= 1 ? 'set' : 'sets';
        const qtyText = `Quantity: ${specsQty} ${qtyUnit}`;
        const qtyTextWidth = doc.widthOfString(qtyText);
        const qtyBoxPadding = 3;

        // Draw filled background rectangle
        doc.fillColor(bgColor)
          .rect(partX, partY - 1, qtyTextWidth + (qtyBoxPadding * 2), 14)
          .fill();

        // Draw text on top
        doc.fillColor(textColor)
          .text(qtyText, partX + qtyBoxPadding, partY + 1);

        // Reset color
        doc.fillColor(COLORS.TEXT_BLACK);

        // Add spacing after quantity box
        partY += 18;

        // Track max Y position
        if (partY > maxPartY) {
          maxPartY = partY;
        }
      });

      // ============================================
      // NOTES/IMAGE SECTION (BOTTOM)
      // ============================================
      await renderNotesAndImage(doc, orderData, maxPartY, marginLeft, contentWidth, pageWidth, marginRight, pageHeight);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
