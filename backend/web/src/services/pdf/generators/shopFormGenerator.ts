/**
 * Shop Form Generator
 * Generates simplified production floor PDF
 *
 * Purpose: Production floor reference (no customer contact info, no pricing)
 * Includes: Production-relevant specs, quantities, deadlines, notes
 * Layout: Landscape Letter size for easy viewing on production floor
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '../../../config/storage';
import type { OrderDataForPDF } from '../pdfGenerationService';

/**
 * Generate Shop Order Form
 */
export async function generateShopForm(
  orderData: OrderDataForPDF,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, STORAGE_CONFIG.fileNames.shopForm);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ============================================
      // HEADER
      // ============================================
      doc.fontSize(24).font('Helvetica-Bold');
      doc.fillColor('#d9534f'); // Red color for production
      doc.text('SHOP ORDER FORM', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(0.5);

      // Divider line
      doc.strokeColor('#cccccc')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

      doc.moveDown();

      // ============================================
      // ORDER INFO (MINIMAL)
      // ============================================
      doc.fontSize(16).font('Helvetica-Bold');
      doc.text(`Order #${orderData.order_number}`, 50, doc.y);
      doc.fontSize(14).font('Helvetica');
      doc.text(orderData.order_name, 50);
      doc.moveDown(0.5);

      // Customer name (simple, no contact info)
      doc.fontSize(11).font('Helvetica');
      doc.text(`Customer: ${orderData.company_name}`, 50);
      if (orderData.customer_po) {
        doc.text(`PO: ${orderData.customer_po}`, 50);
      }
      doc.moveDown();

      // ============================================
      // DUE DATE (PROMINENT)
      // ============================================
      if (orderData.due_date) {
        const dueDateStr = new Date(orderData.due_date).toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#d9534f');
        doc.text(`DUE DATE: ${dueDateStr}`, 50);
        doc.fillColor('black');
        doc.moveDown();
      }

      // ============================================
      // PRODUCTION NOTES (IF ANY)
      // ============================================
      if (orderData.production_notes) {
        doc.fontSize(12).font('Helvetica-Bold');
        doc.fillColor('#856404'); // Warning yellow-brown
        doc.text('⚠ PRODUCTION NOTES:', 50);
        doc.fillColor('black');
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        doc.text(orderData.production_notes, 60, doc.y, {
          width: doc.page.width - 110
        });
        doc.moveDown();
      }

      // ============================================
      // PARTS TO PRODUCE
      // ============================================
      doc.fontSize(13).font('Helvetica-Bold');
      doc.text('PARTS TO PRODUCE:', 50);
      doc.moveDown(0.5);

      // Production-relevant field keywords
      const productionFields = [
        'dimension', 'size', 'width', 'height', 'depth', 'length',
        'material', 'substrate', 'metal', 'acrylic', 'aluminum',
        'color', 'finish', 'paint',
        'lighting', 'led', 'light', 'illumination',
        'mounting', 'hardware',
        'vinyl', 'laminate',
        'thickness', 'gauge'
      ];

      // Render each part
      orderData.parts.forEach((part, index) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 150) {
          doc.addPage({
            size: 'LETTER',
            layout: 'landscape',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
          });
        }

        // Part header with box
        doc.rect(50, doc.y - 5, doc.page.width - 100, 25)
          .fillAndStroke('#f0f0f0', '#cccccc');

        doc.fillColor('black');
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Part ${part.part_number}: ${part.product_type}`, 55, doc.y);
        doc.moveDown(0.5);

        // Quantity (prominent)
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`Qty: ${part.quantity}`, 60);
        doc.font('Helvetica');
        doc.moveDown(0.3);

        // Production-relevant specifications only
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            if (specs && Object.keys(specs).length > 0) {
              // Filter to production-relevant fields
              const relevantSpecs = Object.entries(specs).filter(([key, value]) => {
                if (!value || typeof value === 'object') return false;
                const keyLower = key.toLowerCase();
                return productionFields.some(field => keyLower.includes(field));
              });

              if (relevantSpecs.length > 0) {
                doc.fontSize(10);
                relevantSpecs.forEach(([key, value]) => {
                  const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  doc.text(`  • ${displayKey}: ${value}`, 70);
                });
              }
            }
          } catch (e) {
            // Skip if can't parse
          }
        }

        // Part production notes
        if (part.production_notes) {
          doc.moveDown(0.2);
          doc.fontSize(10).font('Helvetica-Bold');
          doc.fillColor('#856404');
          doc.text('⚠ Part Notes:', 70);
          doc.fillColor('black');
          doc.font('Helvetica');
          doc.text(part.production_notes, 70, doc.y, {
            width: doc.page.width - 120
          });
        }

        doc.moveDown(1);
      });

      // ============================================
      // FOOTER
      // ============================================
      const footerY = doc.page.height - 40;
      doc.fontSize(8).font('Helvetica');
      doc.fillColor('#666666');
      doc.text(
        `Shop Form | Version: ${orderData.form_version} | Generated: ${new Date().toLocaleString('en-US')}`,
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
