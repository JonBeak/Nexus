/**
 * Packing List Generator
 * Generates QC checklist and shipping guide PDF
 *
 * Purpose: Quality control checklist and packing verification
 * Includes: All parts with checkboxes, QC checks, sign-off section
 * Layout: Portrait Letter size (standard checklist format)
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '../../../config/storage';
import type { OrderDataForPDF } from '../pdfGenerationService';

/**
 * Generate Packing List
 */
export async function generatePackingList(
  orderData: OrderDataForPDF,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, STORAGE_CONFIG.fileNames.packingList);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ============================================
      // HEADER
      // ============================================
      doc.fontSize(22).font('Helvetica-Bold');
      doc.fillColor('#5cb85c'); // Green for QC/completion
      doc.text('PACKING LIST', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(0.5);

      // Divider line
      doc.strokeColor('#5cb85c')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

      doc.moveDown();

      // ============================================
      // ORDER INFO
      // ============================================
      doc.fontSize(13).font('Helvetica-Bold');
      doc.fillColor('black');
      doc.text(`Order #${orderData.order_number}`, 50);
      doc.fontSize(11).font('Helvetica');
      doc.text(orderData.order_name, 50);
      doc.moveDown(0.5);

      doc.fontSize(10);
      doc.text(`Customer: ${orderData.company_name}`, 50);
      if (orderData.customer_po) {
        doc.text(`Customer PO: ${orderData.customer_po}`, 50);
      }

      if (orderData.due_date) {
        const dueDateStr = new Date(orderData.due_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        doc.font('Helvetica-Bold');
        doc.text(`Due Date: ${dueDateStr}`, 50);
        doc.font('Helvetica');
      }

      doc.moveDown(1.5);

      // ============================================
      // ITEMS TO PACK SECTION
      // ============================================
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ITEMS TO PACK:', 50);
      doc.moveDown(0.5);

      // Checkbox size
      const checkboxSize = 14;
      const checkboxX = 50;

      // Render each part with checkbox
      orderData.parts.forEach((part, index) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 100) {
          doc.addPage({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
          });
        }

        const currentY = doc.y;

        // Draw checkbox
        doc.rect(checkboxX, currentY, checkboxSize, checkboxSize)
          .lineWidth(1.5)
          .stroke('#333333');

        // Part description
        doc.fontSize(10).font('Helvetica-Bold');
        const textX = checkboxX + checkboxSize + 10;
        doc.text(
          `Part ${part.part_number}: ${part.product_type}`,
          textX,
          currentY + 2,
          { width: doc.page.width - textX - 50 }
        );

        // Move to next line for quantity
        const qtyY = doc.y;
        doc.fontSize(9).font('Helvetica');
        doc.text(`Quantity: ${part.quantity}`, textX, qtyY);

        doc.moveDown(0.7);
      });

      doc.moveDown(1);

      // ============================================
      // QUALITY CHECK SECTION
      // ============================================
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('QUALITY CONTROL CHECKS:', 50);
      doc.moveDown(0.5);

      const qcChecks = [
        'All parts inspected for defects',
        'Correct quantities verified',
        'Parts properly protected for shipping/pickup',
        'Hardware and accessories included (if applicable)',
        'Customer specifications verified against order',
        'All parts properly labeled'
      ];

      qcChecks.forEach((check, index) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 80) {
          doc.addPage({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
          });
        }

        const currentY = doc.y;

        // Draw checkbox
        doc.rect(checkboxX, currentY, checkboxSize, checkboxSize)
          .lineWidth(1.5)
          .stroke('#333333');

        // Check description
        doc.fontSize(10).font('Helvetica');
        const textX = checkboxX + checkboxSize + 10;
        doc.text(check, textX, currentY + 2, {
          width: doc.page.width - textX - 50
        });

        doc.moveDown(0.6);
      });

      doc.moveDown(1.5);

      // ============================================
      // SIGN-OFF SECTION
      // ============================================
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('PACKING VERIFICATION:', 50);
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');

      // Packed by line
      const signLineY = doc.y + 30;
      doc.text('Packed By:', 50, doc.y);
      doc.moveTo(130, signLineY)
        .lineTo(300, signLineY)
        .stroke();

      // Date line
      doc.text('Date:', 330, doc.y);
      doc.moveTo(370, signLineY)
        .lineTo(doc.page.width - 50, signLineY)
        .stroke();

      doc.moveDown(2.5);

      // Inspected by line
      const inspectLineY = doc.y + 30;
      doc.text('Inspected By:', 50, doc.y);
      doc.moveTo(130, inspectLineY)
        .lineTo(300, inspectLineY)
        .stroke();

      // Date line
      doc.text('Date:', 330, doc.y);
      doc.moveTo(370, inspectLineY)
        .lineTo(doc.page.width - 50, inspectLineY)
        .stroke();

      // ============================================
      // FOOTER
      // ============================================
      const footerY = doc.page.height - 40;
      doc.fontSize(8).font('Helvetica');
      doc.fillColor('#666666');
      doc.text(
        `Packing List | Version: ${orderData.form_version} | Generated: ${new Date().toLocaleString('en-US')}`,
        50,
        footerY,
        { align: 'center', width: doc.page.width - 100 }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
