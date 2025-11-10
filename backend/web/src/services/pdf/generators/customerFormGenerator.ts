/**
 * Customer Form Generator
 * Generates professional customer-facing order confirmation PDF
 *
 * Purpose: Professional document for customer confirmation/records
 * Includes: Order details, customer-friendly specs, delivery info
 * Excludes: Internal notes, technical production details, pricing (for now)
 * Layout: Portrait Letter size (standard business document)
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '../../../config/storage';
import type { OrderDataForPDF } from '../pdfGenerationService';

/**
 * Generate Customer Order Form
 */
export async function generateCustomerForm(
  orderData: OrderDataForPDF,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, STORAGE_CONFIG.fileNames.customerForm);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ============================================
      // PROFESSIONAL HEADER
      // ============================================
      doc.fontSize(26).font('Helvetica-Bold');
      doc.fillColor('#1a5490');
      doc.text('ORDER CONFIRMATION', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(2);

      // ============================================
      // ORDER INFORMATION
      // ============================================
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Order Information', 72);
      doc.moveDown(0.3);

      doc.fontSize(11).font('Helvetica');
      doc.text(`Order Number: ${orderData.order_number}`, 72);

      const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(`Order Date: ${orderDateStr}`, 72);

      if (orderData.due_date) {
        const dueDateStr = new Date(orderData.due_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        doc.text(`Expected Completion: ${dueDateStr}`, 72);
      }

      if (orderData.customer_po) {
        doc.text(`Your PO Number: ${orderData.customer_po}`, 72);
      }

      doc.moveDown(1.5);

      // ============================================
      // CUSTOMER INFORMATION
      // ============================================
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Customer:', 72);
      doc.moveDown(0.3);

      doc.fontSize(11).font('Helvetica');
      doc.text(orderData.company_name, 72);

      if (orderData.contact_first_name || orderData.contact_last_name) {
        const contactName = [orderData.contact_first_name, orderData.contact_last_name]
          .filter(Boolean)
          .join(' ');
        doc.text(contactName, 72);
      }

      if (orderData.phone) {
        doc.text(orderData.phone, 72);
      }

      if (orderData.email) {
        doc.text(orderData.email, 72);
      }

      doc.moveDown(1.5);

      // ============================================
      // ORDER DETAILS
      // ============================================
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Order Details:', 72);
      doc.moveDown(0.5);

      // Customer-friendly field keywords
      const customerFields = [
        'color', 'size', 'dimension', 'width', 'height',
        'material', 'finish', 'style',
        'lighting', 'illumination',
        'quantity', 'text', 'font'
      ];

      // Render each part
      orderData.parts.forEach((part, index) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 200) {
          doc.addPage({
            size: 'LETTER',
            margins: { top: 72, bottom: 72, left: 72, right: 72 }
          });
        }

        // Part header
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(part.product_type, 72);
        doc.font('Helvetica');
        doc.fontSize(10);
        doc.text(`Quantity: ${part.quantity}`, 82);

        // Customer-friendly specifications
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            if (specs && Object.keys(specs).length > 0) {
              // Filter to customer-friendly fields
              const relevantSpecs = Object.entries(specs).filter(([key, value]) => {
                if (!value || typeof value === 'object') return false;
                const keyLower = key.toLowerCase();
                return customerFields.some(field => keyLower.includes(field));
              });

              if (relevantSpecs.length > 0) {
                relevantSpecs.forEach(([key, value]) => {
                  const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  doc.text(`${displayKey}: ${value}`, 82);
                });
              }
            }
          } catch (e) {
            // Skip if can't parse
          }
        }

        doc.moveDown(0.8);
      });

      // ============================================
      // POINT OF CONTACT (IF PROVIDED)
      // ============================================
      if (orderData.point_persons && orderData.point_persons.length > 0) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica');
        const contacts = orderData.point_persons.map(p => p.contact_email).join(', ');
        doc.text(`For questions regarding this order, please contact: ${contacts}`, 72, doc.y, {
          width: doc.page.width - 144,
          align: 'left'
        });
      }

      // ============================================
      // PROFESSIONAL CLOSING
      // ============================================
      doc.moveDown(2);
      doc.fontSize(11).font('Helvetica');
      doc.text('Thank you for your business!', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9);
      doc.fillColor('#666666');
      doc.text(
        'If you have any questions about this order, please contact us.',
        { align: 'center' }
      );

      // ============================================
      // FOOTER
      // ============================================
      const footerY = doc.page.height - 50;
      doc.fontSize(8).font('Helvetica');
      doc.fillColor('#999999');
      doc.text(
        `Order Confirmation | Generated ${new Date().toLocaleDateString('en-US')}`,
        72,
        footerY,
        { align: 'center', width: doc.page.width - 144 }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
