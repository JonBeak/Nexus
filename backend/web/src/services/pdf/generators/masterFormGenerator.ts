/**
 * Master Form Generator
 * Generates complete internal reference PDF with ALL order information
 *
 * Purpose: Internal reference document containing complete order details
 * Includes: All specifications, customer info, production notes, pricing (future)
 * Layout: Landscape Letter size for easy viewing
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '../../../config/storage';
import type { OrderDataForPDF } from '../pdfGenerationService';

/**
 * Generate Master Order Form
 */
export async function generateMasterForm(
  orderData: OrderDataForPDF,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, STORAGE_CONFIG.fileNames.masterForm);

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
      doc.fontSize(22).font('Helvetica-Bold');
      doc.fillColor('#1a5490');
      doc.text('MASTER ORDER FORM', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(0.5);

      // Divider line
      doc.strokeColor('#cccccc')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

      doc.moveDown();

      // ============================================
      // ORDER INFO SECTION
      // ============================================
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Order #${orderData.order_number}`, 50, doc.y, { continued: true });
      doc.font('Helvetica');
      doc.text(`    |    ${orderData.order_name}`, { align: 'left' });
      doc.moveDown(0.3);

      // Status badge
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#666666');
      doc.text(`Status: ${orderData.status.toUpperCase().replace(/_/g, ' ')}`, 50);
      doc.fillColor('black');
      doc.moveDown(0.5);

      // Date row
      doc.fontSize(10).font('Helvetica');
      const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      doc.text(`Order Date: ${orderDateStr}`, 50, doc.y, { continued: true });

      if (orderData.due_date) {
        const dueDateStr = new Date(orderData.due_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        doc.text(`    |    Due Date: ${dueDateStr}`, { continued: false });
      } else {
        doc.text('', { continued: false });
      }

      doc.moveDown();

      // ============================================
      // CUSTOMER INFO SECTION
      // ============================================
      doc.fontSize(11).font('Helvetica-Bold');
      doc.fillColor('#1a5490');
      doc.text('CUSTOMER INFORMATION', 50);
      doc.fillColor('black');
      doc.moveDown(0.3);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(orderData.company_name, 50);
      doc.font('Helvetica');

      if (orderData.contact_first_name || orderData.contact_last_name) {
        const contactName = [orderData.contact_first_name, orderData.contact_last_name]
          .filter(Boolean)
          .join(' ');
        doc.text(`Contact: ${contactName}`);
      }

      if (orderData.phone) {
        doc.text(`Phone: ${orderData.phone}`);
      }

      if (orderData.email) {
        doc.text(`Email: ${orderData.email}`);
      }

      if (orderData.customer_po) {
        doc.font('Helvetica-Bold');
        doc.text(`Customer PO: ${orderData.customer_po}`);
        doc.font('Helvetica');
      }

      if (orderData.point_person_email) {
        doc.text(`Point Person: ${orderData.point_person_email}`);
      }

      doc.moveDown();

      // ============================================
      // PRODUCTION NOTES SECTION
      // ============================================
      if (orderData.production_notes) {
        doc.fontSize(11).font('Helvetica-Bold');
        doc.fillColor('#1a5490');
        doc.text('PRODUCTION NOTES', 50);
        doc.fillColor('black');
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        doc.text(orderData.production_notes, {
          width: doc.page.width - 100,
          align: 'left'
        });
        doc.moveDown();
      }

      // ============================================
      // PARTS SECTION
      // ============================================
      doc.fontSize(11).font('Helvetica-Bold');
      doc.fillColor('#1a5490');
      doc.text('ORDER PARTS', 50);
      doc.fillColor('black');
      doc.moveDown(0.5);

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

        // Part header
        doc.fontSize(11).font('Helvetica-Bold');
        doc.fillColor('#333333');
        doc.text(`Part ${part.part_number}: ${part.product_type}`, 50);
        doc.fillColor('black');
        doc.moveDown(0.2);

        // Quantity
        doc.fontSize(10).font('Helvetica');
        doc.text(`Quantity: ${part.quantity}`, 60);

        // Specifications
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            if (specs && Object.keys(specs).length > 0) {
              doc.text('Specifications:', 60);

              Object.entries(specs).forEach(([key, value]) => {
                if (value && key !== 'internal' && typeof value !== 'object') {
                  const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  doc.text(`  • ${displayKey}: ${value}`, 70);
                }
              });
            }
          } catch (e) {
            doc.text('Specifications: (Unable to parse)', 60);
          }
        }

        // Part notes
        if (part.production_notes) {
          doc.font('Helvetica-Bold');
          doc.text('Part Notes:', 60);
          doc.font('Helvetica');
          doc.text(part.production_notes, 70, doc.y, {
            width: doc.page.width - 120
          });
        }

        doc.moveDown(0.8);
      });

      // ============================================
      // FOOTER
      // ============================================
      const footerY = doc.page.height - 40;
      doc.fontSize(8).font('Helvetica');
      doc.fillColor('#666666');
      doc.text(
        `Generated: ${new Date().toLocaleString('en-US')} | Version: ${orderData.form_version} | Master Form (Internal Use Only)`,
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
