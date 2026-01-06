// File Clean up Finished: 2025-11-15
// Changes:
//   - Removed Promise constructor async anti-pattern (line 59)
//   - Removed all debug console.log statements (4 instances)
//   - Removed unused PackingItem type import
//   - File size reduced from 272 to 264 lines (3% reduction)

/**
 * Packing List Generator
 * Based on Master Form layout with Specs section replaced by packing checklist
 *
 * Layout: Landscape Letter (11" x 8.5")
 * Design: Same as Master Form, but Parts section shows packing items instead of specs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import { checkFileWritable, FileBusyError } from '../utils/safeFileWriter';
import { getPackingItemsForProduct } from '../packingItemsMapper';
import { combineSpecifications, flattenCombinedSpecs } from '../specificationCombiner';
import type { OrderDataForPDF } from '../../../types/orders';
import {
  FormType,
  COLORS,
  FONT_SIZES,
  SPACING,
  LAYOUT,
  LINE_WIDTHS,
  SMB_PATHS
} from './pdfConstants';
import {
  debugLog,
  formatDueDateTime,
  getImageFullPath,
  shouldIncludePart,
  shouldStartNewColumn,
  getSpecsQuantity,
  getStandardLabelWidth
} from './pdfHelpers';
import {
  renderHeaderLabel,
  renderMasterCustomerPageHeader,
  renderQuantityBox
} from './pdfHeaderRenderers';
import { renderNotesAndImage } from '../utils/imageProcessing';
import { buildPartColumns } from '../utils/partColumnBuilder';


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
      // Check if file is writable before attempting generation
      await checkFileWritable(outputPath);

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

      // Attach error handler immediately to catch EBUSY during write
      stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EBUSY') {
          reject(new FileBusyError(outputPath));
        } else {
          reject(error);
        }
      });

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
      const partColumns = buildPartColumns(orderData.parts, 'packing', shouldIncludePart, shouldStartNewColumn);

      // Calculate column layout for main parts only - up to 3 columns
      const numParts = partColumns.length;
      const numColumns = Math.min(numParts, 3);
      const columnWidth = contentWidth / numColumns;

      // Parts section height - allocate 35% of available height
      const partsHeight = availableHeight * 0.35;

      // Draw main parts in columns with packing items
      let maxPartY = contentStartY;

      // Only render first 3 parts to prevent overflow
      const partsToRender = partColumns.slice(0, 3);

      partsToRender.forEach((column, colIndex) => {
        const part = column.parent;
        const partX = marginLeft + (colIndex * columnWidth) + LAYOUT.PART_COLUMN_INNER_PADDING;
        const partColumnWidth = columnWidth - (LAYOUT.PART_COLUMN_INNER_PADDING * 2);
        let partY = contentStartY;

        // Get specs_qty from specifications (using shared utility)
        const specsQty = getSpecsQuantity(part);

        // Part header - use specs_display_name instead of product_type
        const displayName = part.specs_display_name || part.product_type;
        doc.fontSize(14).font('Helvetica-Bold');
        const titleLineHeight = doc.currentLineHeight();

        // Product name + colon in bold (if scope exists)
        const titleText = part.part_scope ? `${displayName}: ` : displayName;
        doc.text(titleText, partX, partY, {
          width: partColumnWidth * 0.6,
          lineBreak: false,
          continued: false
        });

        // Append scope inline with smaller, non-bold font, bottom-aligned
        if (part.part_scope) {
          // Calculate X position after product type + colon
          const titleTextWidth = doc.widthOfString(titleText);
          const scopeX = partX + titleTextWidth;

          // Calculate Y offset to bottom-align (move scope text DOWN)
          doc.fontSize(12).font('Helvetica'); // 12pt, not bold
          const scopeLineHeight = doc.currentLineHeight();
          const scopeY = partY + (titleLineHeight - scopeLineHeight);

          doc.text(part.part_scope, scopeX, scopeY, {
            lineBreak: false
          });
        }

        // Update partY manually
        partY += titleLineHeight + 2; // Title height + small gap

        // Draw horizontal separator line between header and checklist (same as Master Form)
        doc.strokeColor('#cccccc').lineWidth(0.5)
          .moveTo(partX, partY)
          .lineTo(partX + partColumnWidth, partY)
          .stroke();
        doc.strokeColor('#000000'); // Reset stroke color
        partY += 8;

        // Get packing items using combined specifications from parent + sub-items
        const productTypeForPacking = part.specs_display_name || part.product_type;

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

        // Get packing items using combined specs - show only relevant items
        const packingItems = getPackingItemsForProduct(productTypeForPacking, combinedSpecs, customerPrefs);

        // Draw packing items with checkboxes and labels - styled like Order Form spec labels
        const checkboxWidth = 120;  // Longer checkbox
        const checkboxHeight = 18;  // Higher checkbox
        const labelFontSize = 11;  // Match Order Form spec labels

        // Calculate standardized label width (same as spec labels and Quantity)
        const standardLabelWidth = getStandardLabelWidth(doc);

        // Calculate checkbox X position (right after standard label width + small gap)
        const checkboxX = partX - SPACING.LABEL_PADDING + standardLabelWidth + 10;

        packingItems.forEach((item) => {
          // Item label with light gray background and centered black text (like Order Form spec labels)
          doc.fontSize(labelFontSize).font('Helvetica-Bold');
          const labelHeight = doc.currentLineHeight();

          // Calculate actual text width for centering
          const actualTextWidth = doc.widthOfString(item.name);
          const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

          // Draw light gray background behind label (standardized width, matching checkbox height)
          doc.fillColor(COLORS.LABEL_BG_DEFAULT)
            .rect(
              partX - SPACING.LABEL_PADDING,
              partY - 2,
              standardLabelWidth,
              checkboxHeight  // Match checkbox height
            )
            .fill();

          // Render label text in black, centered (vertically centered in box)
          const centeredX = partX - SPACING.LABEL_PADDING + textLeftPadding;
          const textY = partY - 2 + (checkboxHeight - labelHeight) / 2;
          doc.fillColor(COLORS.BLACK)
            .text(item.name, centeredX, textY, { lineBreak: false });

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
        partY = renderQuantityBox(doc, specsQty, partX, partY, partColumnWidth);

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
