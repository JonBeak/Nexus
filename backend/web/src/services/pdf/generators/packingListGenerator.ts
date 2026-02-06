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
import { renderSignTypeBox } from '../renderers/specRenderers';


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
      // Show company name in packing list unless hide_company_name is set
      const showCompanyNameOnPackingList = !orderData.hide_company_name;
      const isHighStandards = !!orderData.high_standards;
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
        false, // showDueDate - hide due date on packing list
        showCompanyNameOnPackingList,  // showCompanyName - toggle based on hide_company_name
        isHighStandards  // High Standards gold treatment
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

        // Render Sign Type box (and Scope box if scope exists)
        partY = renderSignTypeBox(doc, displayName, part.part_scope || null, partX, partY, partColumnWidth);

        // Padding around separator line (match order form: 4px above and below visually)
        const separatorPadding = 4;
        partY += separatorPadding;  // 4px above line

        // Draw horizontal separator line (thicker line under Sign Type/Scope)
        doc.strokeColor(COLORS.DIVIDER_DARK)
          .lineWidth(LINE_WIDTHS.DIVIDER_MAIN)
          .moveTo(partX, partY)
          .lineTo(partX + partColumnWidth, partY)
          .stroke();
        doc.strokeColor(COLORS.BLACK);

        // Padding below separator line (+3 to compensate for packing item -2 offset)
        partY += separatorPadding + 3;

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
        const valueBoxWidth = 80;   // Smaller, constant width (was 120)
        const checkboxHeight = 16;  // Box height (reduced from 18 for compact layout)
        const labelFontSize = FONT_SIZES.SPEC_LABEL;  // 10pt - match spec labels
        const borderWidth = 1;

        // Calculate standardized label width (same as spec labels and Quantity)
        const standardLabelWidth = getStandardLabelWidth(doc);

        packingItems.forEach((item) => {
          // Item label with light gray background and centered black text (like Order Form spec labels)
          doc.fontSize(labelFontSize).font('Helvetica-Bold');
          const labelHeight = doc.currentLineHeight();

          // Calculate actual text width for centering
          const actualTextWidth = doc.widthOfString(item.name);
          const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

          // Box dimensions
          const boxStartX = partX - SPACING.LABEL_PADDING;
          const boxStartY = partY - 2;
          const totalWidth = standardLabelWidth + valueBoxWidth;
          const boxHeight = checkboxHeight;

          // Value box position (after label)
          const valueBoxStartX = boxStartX + standardLabelWidth;

          // Cutout dimensions (inset by borderWidth on top/right/bottom)
          const cutoutX = valueBoxStartX;
          const cutoutY = boxStartY + borderWidth;
          const cutoutWidth = valueBoxWidth - borderWidth;
          const cutoutHeight = boxHeight - (borderWidth * 2);

          // Determine colors
          const bgColor = item.required ? checkboxBgColor : PACKING_COLORS.NOT_REQUIRED_BG;

          // Draw compound path: outer rect with inner cutout (creates border effect)
          doc.rect(boxStartX, boxStartY, totalWidth, boxHeight)
            .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);
          doc.fillColor(COLORS.LABEL_BG_DEFAULT).fill('evenodd');

          // Fill cutout with appropriate color
          doc.fillColor(bgColor)
            .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight)
            .fill();

          // Render label text (centered in label area)
          const centeredX = boxStartX + textLeftPadding;
          const labelTextY = boxStartY + (boxHeight - labelHeight) / 2;
          doc.fillColor(COLORS.BLACK)
            .fontSize(labelFontSize)
            .font('Helvetica-Bold')
            .text(item.name, centeredX, labelTextY, { lineBreak: false });

          // If not required, center "None" in the value box
          if (!item.required) {
            doc.fontSize(FONT_SIZES.SPEC_LABEL).font('Helvetica').fillColor(PACKING_COLORS.NOT_REQUIRED_TEXT);
            const noneText = 'None';
            const noneTextWidth = doc.widthOfString(noneText);
            const noneTextHeight = doc.currentLineHeight();
            const noneTextX = cutoutX + (cutoutWidth - noneTextWidth) / 2;
            const noneTextY = cutoutY + (cutoutHeight - noneTextHeight) / 2;
            doc.text(noneText, noneTextX, noneTextY, { lineBreak: false });
            doc.fillColor(COLORS.BLACK);
          }

          partY += 20;  // Spacing for checkboxes (reduced from 22 for compact layout)
        });

        // Render quantity box (shared utility function)
        partY = renderQuantityBox(doc, specsQty, partX, partY, partColumnWidth);

        // Track max Y position
        if (partY > maxPartY) {
          maxPartY = partY;
        }
      });

      // Draw vertical dividers between columns (only if multiple parts)
      if (numColumns > 1) {
        for (let i = 0; i < numColumns - 1; i++) {
          // Calculate divider X position (between columns)
          const dividerX = marginLeft + ((i + 1) * columnWidth);

          // Draw vertical line from top to bottom of parts section
          doc.strokeColor(COLORS.DIVIDER_LIGHT)
            .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
            .moveTo(dividerX, contentStartY)
            .lineTo(dividerX, maxPartY)
            .stroke();
        }
        // Reset stroke color
        doc.strokeColor(COLORS.BLACK);
      }

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
