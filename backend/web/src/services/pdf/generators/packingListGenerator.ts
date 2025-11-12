/**
 * Packing List Generator
 * Based on Master Form layout with Specs section replaced by packing checklist
 *
 * Layout: Landscape Letter (11" x 8.5")
 * Design: Same as Master Form, but Parts section shows packing items instead of specs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import { STORAGE_CONFIG } from '../../../config/storage';
import { getPackingItemsForProduct, PackingItem } from '../packingItemsMapper';
import { combineSpecifications, flattenCombinedSpecs } from '../specificationCombiner';
import type { OrderDataForPDF } from '../pdfGenerationService';
import {
  FormType,
  COLORS,
  FONT_SIZES,
  SPACING,
  LAYOUT,
  LINE_WIDTHS,
  SMB_PATHS,
  debugLog,
  formatDueDateTime,
  renderHeaderLabel,
  renderMasterCustomerPageHeader,
  renderQuantityBox,
  getImageFullPath,
  shouldIncludePart,
  shouldStartNewColumn
} from './pdfCommonGenerator';
import { renderNotesAndImage } from '../utils/imageProcessing';


// =============================================
// ADDITIONAL COLORS (for packing list specific styling)
// =============================================
const PACKING_COLORS = {
  CHECKBOX_BORDER: '#000000',
  PICKUP_BG: '#ADD8E6',      // Light Blue
  SHIPPING_BG: '#FFFFB3',    // Light Yellow
  NOT_REQUIRED_BG: '#A0A0A0', // Darker Gray
  NOT_REQUIRED_TEXT: '#000000', // Black (for bold text)
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
        margins: {
          top: SPACING.PAGE_MARGIN,
          bottom: SPACING.PAGE_MARGIN,
          left: SPACING.PAGE_MARGIN,
          right: SPACING.PAGE_MARGIN
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginLeft = SPACING.PAGE_MARGIN;
      const marginRight = SPACING.PAGE_MARGIN;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let currentY = SPACING.PAGE_MARGIN;

      // Determine shipping method (blue for pickup, yellow for shipping)
      const isPickup = orderData.status === 'pick_up' || !orderData.shipping_required;
      const checkboxBgColor = isPickup ? PACKING_COLORS.PICKUP_BG : PACKING_COLORS.SHIPPING_BG;

      // Render header using shared function with packing list styling
      currentY = renderMasterCustomerPageHeader(
        doc,
        orderData,
        marginLeft,
        contentWidth,
        pageWidth,
        marginRight,
        currentY,
        checkboxBgColor, // Delivery background color for packing list
        'Packing List', // pageTitle
        false // showDueDate - hide due date on packing list
      );

      // ============================================
      // MAIN CONTENT AREA - PARTS WITH PACKING ITEMS
      // ============================================
      const contentStartY = currentY;
      const availableHeight = pageHeight - contentStartY - 15;

      // Group parts: parent items with their sub-items (using shared logic)
      const partColumns: Array<{ parent: any; subItems: any[] }> = [];

      orderData.parts.forEach((part, index) => {
        // Skip parts with no meaningful data
        if (!shouldIncludePart(part, 'master')) {
          console.log(`[Packing List] ✓ SKIPPING empty part ${index + 1} (no display name or spec templates)`);
          return;
        }

        console.log(`[Packing List] ✓ INCLUDING part ${index + 1}`);

        if (shouldStartNewColumn(part)) {
          // This is a parent or regular base item - create new column
          partColumns.push({ parent: part, subItems: [] });
          console.log(`[Packing List] Created column ${partColumns.length} for:`, part.specs_display_name || part.product_type);
        } else {
          // This is a sub-item - find the matching parent column by display number prefix
          const parentNumber = part.display_number?.replace(/[a-zA-Z]/g, '');
          const matchingColumn = partColumns.find(col => col.parent.display_number === parentNumber);

          if (matchingColumn) {
            matchingColumn.subItems.push(part);
            console.log(`[Packing List] Added sub-item to column (matched by number ${parentNumber}):`, part.specs_display_name || part.product_type);
          } else if (partColumns.length > 0) {
            // Fallback: append to last column if no match found
            partColumns[partColumns.length - 1].subItems.push(part);
            console.log(`[Packing List] Added sub-item to last column (fallback):`, part.specs_display_name || part.product_type);
          }
        }
      });

      console.log(`[Packing List] Final column count: ${partColumns.length}`);

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
          doc.fontSize(FONT_SIZES.SCOPE).font('Helvetica').fillColor(COLORS.BLACK);
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
          // Item label with black background (like Master Form spec labels)
          doc.fontSize(labelFontSize).font('Helvetica-Bold');
          const labelWidth = doc.widthOfString(item.name);
          const labelHeight = doc.currentLineHeight();

          // Draw black background behind label
          doc.fillColor(COLORS.LABEL_BACKGROUND)
            .rect(
              partX - SPACING.LABEL_PADDING,
              partY - 2,
              labelWidth + (SPACING.LABEL_PADDING * 2),
              labelHeight + 3
            )
            .fill();

          // Render label text in white
          doc.fillColor(COLORS.WHITE)
            .text(item.name, partX, partY, { lineBreak: false });

          // Draw checkbox AFTER label - aligned right of longest label
          if (item.required) {
            // Required item: show empty checkbox with blue/yellow background
            doc.rect(checkboxX, partY - 2, checkboxWidth, checkboxHeight)
              .lineWidth(0.5)
              .fillAndStroke(checkboxBgColor, PACKING_COLORS.CHECKBOX_BORDER);
          } else {
            // Not required: show gray box with "No" text centered
            doc.rect(checkboxX, partY - 2, checkboxWidth, checkboxHeight)
              .lineWidth(0.5)
              .fillAndStroke(PACKING_COLORS.NOT_REQUIRED_BG, PACKING_COLORS.CHECKBOX_BORDER);

            // Center "No" text in the box (bold)
            doc.fontSize(10).font('Helvetica-Bold').fillColor(PACKING_COLORS.NOT_REQUIRED_TEXT);
            const noText = 'No';
            const noTextWidth = doc.widthOfString(noText);
            const textX = checkboxX + (checkboxWidth - noTextWidth) / 2;
            const textY = partY + 2; // Vertically center in box
            doc.text(noText, textX, textY, { lineBreak: false });

            // Reset color
            doc.fillColor(COLORS.BLACK);
          }

          partY += 22;  // Spacing for checkboxes
        });

        // Render quantity box (shared utility function)
        partY = renderQuantityBox(doc, specsQty, partX, partY, columnWidth);

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
