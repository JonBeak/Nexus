/**
 * Image Processing Utility
 * Consolidates image rendering and cropping logic for PDF generation
 * Used by: orderFormGenerator, packingListGenerator
 */

import sharp from 'sharp';
import fs from 'fs';
import { getImageFullPath, COLORS, FONT_SIZES, SPACING, LAYOUT } from '../generators/pdfCommonGenerator';
import type { OrderDataForPDF } from '../pdfGenerationService';

/**
 * Options for rendering notes and images
 */
export interface ImageRenderOptions {
  /** Whether to include internal notes (master form only) */
  includeInternalNote?: boolean;
  /** Optional override for notes column width */
  notesColumnWidth?: number;
  /** Optional override for image width percentage */
  imageWidthPercent?: number;
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
  const {
    includeInternalNote = false,
    notesColumnWidth = contentWidth * LAYOUT.NOTES_LEFT_WIDTH_PERCENT,
    imageWidthPercent = LAYOUT.IMAGE_WIDTH_PERCENT
  } = options;

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

    // Draw separator line above notes/image section
    doc.strokeColor(COLORS.DIVIDER_LIGHT)
      .lineWidth(0.5)
      .moveTo(marginLeft, actualImageStartY - SPACING.ITEM_GAP)
      .lineTo(pageWidth - marginRight, actualImageStartY - SPACING.ITEM_GAP)
      .stroke();

    let notesY = actualImageStartY;

    // Two-column layout for notes
    const notesLeftX = marginLeft;
    const notesRightX = marginLeft + contentWidth * LAYOUT.NOTES_RIGHT_START_PERCENT;

    // Special Instructions (left side) - manufacturing_note
    if (orderData.manufacturing_note) {
      doc.fontSize(FONT_SIZES.SPEC_BODY).font('Helvetica').fillColor(COLORS.BLACK);
      doc.text(orderData.manufacturing_note, notesLeftX, notesY, {
        width: notesColumnWidth,
        lineBreak: true
      });
    }

    // Internal Notes (right side) - ONLY if includeInternalNote option is true
    if (includeInternalNote && orderData.internal_note) {
      doc.fontSize(FONT_SIZES.INTERNAL_NOTE_LABEL).font('Helvetica-Bold');
      const labelWidth = doc.widthOfString('[Internal Note]  ');
      doc.text('[Internal Note]  ', notesRightX, notesY);
      doc.fontSize(FONT_SIZES.INTERNAL_NOTE).font('Helvetica');
      doc.text(orderData.internal_note, notesRightX + labelWidth, notesY, {
        width: notesColumnWidth - labelWidth,
        lineBreak: true
      });
    }

    // Calculate space used by notes
    const notesHeight = Math.max(
      orderData.manufacturing_note ? doc.heightOfString(orderData.manufacturing_note, { width: notesColumnWidth }) + 15 : 0,
      (includeInternalNote && orderData.internal_note) ? doc.heightOfString(orderData.internal_note, { width: notesColumnWidth }) + 15 : 0
    );

    // Center the image below the notes
    const imageWidth = contentWidth * imageWidthPercent;
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
