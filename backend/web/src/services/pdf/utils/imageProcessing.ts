// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed unused ImageRenderOptions properties (notesColumnWidth, imageWidthPercent)
//   - Simplified options destructuring (only includeInternalNote is used)
//   - Use constants directly instead of unused option variables
//   - Reduced code complexity by 10 lines
/**
 * Image Processing Utility
 * Consolidates image rendering and cropping logic for PDF generation
 * Used by: orderFormGenerator, packingListGenerator
 */

import sharp from 'sharp';
import fs from 'fs';
import { COLORS, FONT_SIZES, SPACING, LAYOUT } from '../generators/pdfConstants';
import { getImageFullPath, getStandardLabelWidth } from '../generators/pdfHelpers';
import { calculateAccurateTextHeight } from '../renderers/specRenderers';
import type { OrderDataForPDF } from '../../../types/orders';

/**
 * Options for rendering notes and images
 */
export interface ImageRenderOptions {
  /** Whether to include internal notes (master form only) */
  includeInternalNote?: boolean;
}

/**
 * Crop an image using Sharp
 * @param imagePath - Full path to the image file
 * @param cropCoords - Crop coordinates
 * @returns Cropped image buffer
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
 * Render notes and image section
 * Consolidates duplicate code from orderFormGenerator and packingListGenerator
 *
 * @param doc - PDFKit document
 * @param orderData - Order data for PDF generation
 * @param maxPartY - Y position after parts section
 * @param marginLeft - Left margin
 * @param contentWidth - Total content width
 * @param pageWidth - Page width
 * @param marginRight - Right margin
 * @param pageHeight - Page height
 * @param options - Optional configuration
 */
export async function renderNotesAndImage(
  doc: any,
  orderData: OrderDataForPDF,
  maxPartY: number,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  pageHeight: number,
  options: ImageRenderOptions = {}
): Promise<void> {
  // Default options
  const { includeInternalNote = false } = options;

  // Get image path
  const fullImagePath = getImageFullPath(orderData);
  if (!fullImagePath) return;

  try {
    console.log(`[IMAGE] Attempting to load image: ${fullImagePath}`);

    // Check if file exists
    if (!fs.existsSync(fullImagePath)) {
      console.log(`[IMAGE] ⚠️ Image file not found: ${fullImagePath}`);
      return;
    }

    // Calculate actual available space for image
    const actualImageStartY = maxPartY + SPACING.IMAGE_AFTER_PARTS;
    const actualImageHeight = pageHeight - actualImageStartY - SPACING.IMAGE_BOTTOM_MARGIN;

    console.log(`[IMAGE] Actual image Y: ${actualImageStartY}, Height: ${actualImageHeight}`);

    // Only draw if there's enough space
    if (actualImageHeight <= LAYOUT.MIN_IMAGE_HEIGHT) {
      console.log(`[IMAGE] ⚠️ Not enough space for image (only ${actualImageHeight}px available)`);
      return;
    }

    // Draw separator line above notes/image section (centered in the IMAGE_AFTER_PARTS gap)
    const separatorY = maxPartY + (SPACING.IMAGE_AFTER_PARTS / 2);
    doc.strokeColor(COLORS.DIVIDER_LIGHT)
      .lineWidth(0.5)
      .moveTo(marginLeft, separatorY)
      .lineTo(pageWidth - marginRight, separatorY)
      .stroke();

    let notesY = actualImageStartY;

    // Two-column layout for notes
    // Align left side with first column parts (includes inner padding)
    const notesLeftX = marginLeft + LAYOUT.PART_COLUMN_INNER_PADDING;

    // Align right side at 50% of content width (right half)
    const notesRightX = marginLeft + (contentWidth / 2) + LAYOUT.PART_COLUMN_INNER_PADDING;

    // Calculate notes column width
    const notesColumnWidth = contentWidth * LAYOUT.NOTES_LEFT_WIDTH_PERCENT;

    // Order Notes (left side) - manufacturing_note with compound path styling
    let orderNotesHeight = 0;
    if (orderData.manufacturing_note) {
      const labelText = 'Order Notes';
      const noteText = orderData.manufacturing_note.trim();

      // === STEP 1: Calculate all dimensions ===

      // Label dimensions (11pt font)
      doc.fontSize(11).font('Helvetica-Bold');
      const labelHeight = doc.currentLineHeight();

      // Get standardized label width
      const standardLabelWidth = getStandardLabelWidth(doc);

      // Calculate actual text width for horizontal centering
      const actualTextWidth = doc.widthOfString(labelText);
      const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

      // Fixed value box width (fills available column width)
      const valueBoxPaddingLeft = 6;
      const valueBoxWidth = notesColumnWidth - standardLabelWidth;
      const valueBoxStartX = notesLeftX - SPACING.LABEL_PADDING + standardLabelWidth;
      const valueTextX = valueBoxStartX + valueBoxPaddingLeft;
      const availableValueWidth = valueBoxWidth - valueBoxPaddingLeft - 6; // 6px right padding

      // Calculate value height based on wrapped text
      const valueHeight = calculateAccurateTextHeight(doc, noteText, availableValueWidth, 12, 'Helvetica');
      doc.fontSize(12).font('Helvetica');
      const valueLineHeight = doc.currentLineHeight();
      const effectiveValueHeight = Math.max(valueHeight, valueLineHeight);

      // Add padding above and below the value height
      const valuePadding = 1;
      const paddedValueHeight = effectiveValueHeight + (valuePadding * 2);

      // Calculate label box height with padding
      const topTextPadding = 3;
      const bottomTextPadding = 1;
      const maxContentHeight = Math.max(labelHeight, paddedValueHeight);
      const labelBoxHeight = maxContentHeight + topTextPadding + bottomTextPadding;

      // === STEP 2: Draw compound path (label + value borders) ===

      const labelBoxStartY = notesY;
      const labelBoxStartX = notesLeftX - SPACING.LABEL_PADDING;
      const borderWidth = 1;

      // Outer rect covers label + value area
      const outerWidth = standardLabelWidth + valueBoxWidth;

      // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
      const cutoutX = valueBoxStartX;
      const cutoutY = labelBoxStartY + borderWidth;
      const cutoutWidth = valueBoxWidth - borderWidth;
      const cutoutHeight = labelBoxHeight - (borderWidth * 2);

      // Create compound path and fill with evenOdd rule
      doc.rect(labelBoxStartX, labelBoxStartY, outerWidth, labelBoxHeight)  // Outer rect
        .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);                  // Inner cutout
      doc.fillColor(COLORS.LABEL_BG_DEFAULT).fill('evenodd');

      // === STEP 3: Render label text (centered in box) ===

      const labelTextY = labelBoxStartY + (labelBoxHeight - labelHeight) / 2;
      const centeredX = labelBoxStartX + textLeftPadding;

      doc.fillColor(COLORS.BLACK)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(labelText, centeredX, labelTextY, {
          continued: false,
          width: standardLabelWidth,
          lineBreak: false
        });

      // === STEP 4: Render value text (inside cutout area) ===

      const valueY = labelBoxStartY + topTextPadding + valuePadding;

      doc.fillColor(COLORS.BLACK)
        .fontSize(12)
        .font('Helvetica')
        .text(noteText, valueTextX, valueY, {
          width: availableValueWidth,
          lineBreak: true
        });

      // Track the height used by Order Notes row
      orderNotesHeight = labelBoxHeight + SPACING.SPEC_ROW_GAP;
    }

    // Internal Notes (right side) - ONLY if includeInternalNote option is true
    let internalNoteHeight = 0;
    if (includeInternalNote && orderData.internal_note) {
      const labelText = 'Internal Note';
      const noteText = orderData.internal_note.trim();

      // === STEP 1: Calculate all dimensions ===

      // Label dimensions (11pt font)
      doc.fontSize(11).font('Helvetica-Bold');
      const labelHeight = doc.currentLineHeight();

      // Get standardized label width
      const standardLabelWidth = getStandardLabelWidth(doc);

      // Calculate actual text width for horizontal centering
      const actualTextWidth = doc.widthOfString(labelText);
      const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

      // Fixed value box width (fills available column width)
      const valueBoxPaddingLeft = 6;
      const valueBoxWidth = notesColumnWidth - standardLabelWidth;
      const valueBoxStartX = notesRightX - SPACING.LABEL_PADDING + standardLabelWidth;
      const valueTextX = valueBoxStartX + valueBoxPaddingLeft;
      const availableValueWidth = valueBoxWidth - valueBoxPaddingLeft - 6; // 6px right padding

      // Calculate value height based on wrapped text
      const valueHeight = calculateAccurateTextHeight(doc, noteText, availableValueWidth, 12, 'Helvetica');
      doc.fontSize(12).font('Helvetica');
      const valueLineHeight = doc.currentLineHeight();
      const effectiveValueHeight = Math.max(valueHeight, valueLineHeight);

      // Add padding above and below the value height
      const valuePadding = 1;
      const paddedValueHeight = effectiveValueHeight + (valuePadding * 2);

      // Calculate label box height with padding
      const topTextPadding = 3;
      const bottomTextPadding = 1;
      const maxContentHeight = Math.max(labelHeight, paddedValueHeight);
      const labelBoxHeight = maxContentHeight + topTextPadding + bottomTextPadding;

      // === STEP 2: Draw compound path (label + value borders) ===

      const labelBoxStartY = notesY;
      const labelBoxStartX = notesRightX - SPACING.LABEL_PADDING;
      const borderWidth = 1;

      // Outer rect covers label + value area
      const outerWidth = standardLabelWidth + valueBoxWidth;

      // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
      const cutoutX = valueBoxStartX;
      const cutoutY = labelBoxStartY + borderWidth;
      const cutoutWidth = valueBoxWidth - borderWidth;
      const cutoutHeight = labelBoxHeight - (borderWidth * 2);

      // Create compound path and fill with evenOdd rule
      doc.rect(labelBoxStartX, labelBoxStartY, outerWidth, labelBoxHeight)  // Outer rect
        .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);                  // Inner cutout
      doc.fillColor(COLORS.LABEL_BG_DEFAULT).fill('evenodd');

      // === STEP 3: Render label text (centered in box) ===

      const labelTextY = labelBoxStartY + (labelBoxHeight - labelHeight) / 2;
      const centeredX = labelBoxStartX + textLeftPadding;

      doc.fillColor(COLORS.BLACK)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(labelText, centeredX, labelTextY, {
          continued: false,
          width: standardLabelWidth,
          lineBreak: false
        });

      // === STEP 4: Render value text (inside cutout area) ===

      const valueY = labelBoxStartY + topTextPadding + valuePadding;

      doc.fillColor(COLORS.BLACK)
        .fontSize(12)
        .font('Helvetica')
        .text(noteText, valueTextX, valueY, {
          width: availableValueWidth,
          lineBreak: true
        });

      // Track the height used by Internal Note row
      internalNoteHeight = labelBoxHeight + SPACING.SPEC_ROW_GAP;
    }

    // Calculate space used by notes
    const notesHeight = Math.max(orderNotesHeight, internalNoteHeight);

    // Center the image below the notes
    const imageWidth = contentWidth * LAYOUT.IMAGE_WIDTH_PERCENT;
    const imageY = notesY + notesHeight + SPACING.ITEM_GAP;
    const imageX = marginLeft + (contentWidth - imageWidth) / 2;
    const adjustedImageHeight = actualImageHeight - notesHeight - SPACING.ITEM_GAP;

    if (adjustedImageHeight <= LAYOUT.MIN_ADJUSTED_IMAGE_HEIGHT) {
      console.log(`[IMAGE] ⚠️ Not enough space for image after notes (only ${adjustedImageHeight}px available)`);
      return;
    }

    // Check if image has crop coordinates
    const hasCrop = orderData.crop_top || orderData.crop_right || orderData.crop_bottom || orderData.crop_left;

    if (hasCrop) {
      try {
        console.log(`[IMAGE] Applying crop: T${orderData.crop_top} R${orderData.crop_right} B${orderData.crop_bottom} L${orderData.crop_left}`);

        // Crop the image
        const croppedBuffer = await cropImage(fullImagePath, {
          top: orderData.crop_top || 0,
          right: orderData.crop_right || 0,
          bottom: orderData.crop_bottom || 0,
          left: orderData.crop_left || 0
        });

        // Embed cropped image
        doc.image(croppedBuffer, imageX, imageY, {
          fit: [imageWidth, adjustedImageHeight],
          align: 'center',
          valign: 'center'
        });
        console.log(`[IMAGE] ✅ Successfully loaded cropped image`);
      } catch (cropError) {
        console.error('[IMAGE] ⚠️ Crop failed, using original:', cropError);
        // Fall back to original image
        doc.image(fullImagePath, imageX, imageY, {
          fit: [imageWidth, adjustedImageHeight],
          align: 'center'
        });
        console.log(`[IMAGE] ✅ Successfully loaded image (crop failed, using original)`);
      }
    } else {
      // No crop coordinates, use original image
      doc.image(fullImagePath, imageX, imageY, {
        fit: [imageWidth, adjustedImageHeight],
        align: 'center'
      });
      console.log(`[IMAGE] ✅ Successfully loaded image (no crop)`);
    }
  } catch (error) {
    console.error('[IMAGE] ⚠️ Error loading sign image:', error);
  }
}
