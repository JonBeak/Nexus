# Phase 1.c: Backend - PDF Form Generation

## Overview

This sub-phase implements PDF form generation for orders. Four types of forms are generated: Master, Shop, Customer, and Packing List. Each form has specific fields and formatting.

**Duration Estimate:** 3-4 days
**Dependencies:** Phase 1.b (Order Conversion must be complete)
**Validates:** All 4 PDF forms generate correctly with proper formatting

---

## Technology: PDFKit

**Library:** `pdfkit` + `@types/pdfkit`

**Installation:**
```bash
cd /home/jon/Nexus/backend/web
npm install pdfkit @types/pdfkit
```

---

## File Structure

```
/backend/web/src/services/pdf/
├── pdfGenerationService.ts       # Main orchestrator
├── generators/
│   ├── masterFormGenerator.ts    # Master order form
│   ├── shopFormGenerator.ts      # Shop order form
│   ├── customerFormGenerator.ts  # Customer order form
│   └── packingListGenerator.ts   # Packing list
├── components/
│   ├── headerSection.ts          # Reusable header
│   ├── partSection.ts            # Part details
│   └── specificationTable.ts     # Specs table
└── utils/
    ├── pageSetup.ts              # Page config
    ├── styles.ts                 # Styling constants
    └── imageHandler.ts           # Image embedding
```

---

## Routes Addition

### /backend/web/src/routes/orders.ts

Add form generation routes:

```typescript
import * as orderFormController from '../controllers/orderFormController';

// ... existing routes ...

// =============================================
// ORDER FORMS
// =============================================

// Generate/regenerate all forms
router.post(
  '/:orderId/forms',
  authenticateToken,
  checkPermission('orders.forms'),
  orderFormController.generateOrderForms
);

// Download specific form
router.get(
  '/:orderId/forms/:formType',
  authenticateToken,
  checkPermission('orders.forms'),
  orderFormController.downloadOrderForm
);

// Get form paths
router.get(
  '/:orderId/forms',
  authenticateToken,
  checkPermission('orders.forms'),
  orderFormController.getFormPaths
);
```

---

## PDF Generation Service (Main Orchestrator)

### /backend/web/src/services/pdf/pdfGenerationService.ts

```typescript
import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import fs from 'fs/promises';
import path from 'path';

interface FormGenerationOptions {
  orderId: number;
  version?: number;
  createNewVersion?: boolean;
}

interface FormPaths {
  masterForm: string;
  shopForm: string;
  customerForm: string;
  packingList: string;
}

class PDFGenerationService {
  private readonly baseStoragePath = '/mnt/channelletter/NexusTesting';

  /**
   * Generate all 4 forms for an order
   */
  async generateAllForms(options: FormGenerationOptions): Promise<FormPaths> {
    const { orderId, createNewVersion = false } = options;

    // 1. Fetch complete order data
    const orderData = await this.fetchOrderData(orderId);

    // 2. Handle versioning
    let version = options.version || orderData.form_version;
    if (createNewVersion) {
      await this.archiveCurrentVersion(orderId, orderData.form_version);
      version = orderData.form_version + 1;
      await this.updateOrderVersion(orderId, version);
    }

    // 3. Ensure directory structure exists
    const orderDir = path.join(this.baseStoragePath, String(orderData.order_number));
    await this.ensureDirectoryExists(orderDir);

    // 4. Generate all 4 forms
    const { generateMasterForm } = await import('./generators/masterFormGenerator');
    const { generateShopForm } = await import('./generators/shopFormGenerator');
    const { generateCustomerForm } = await import('./generators/customerFormGenerator');
    const { generatePackingList } = await import('./generators/packingListGenerator');

    const [masterPath, shopPath, customerPath, packingPath] = await Promise.all([
      generateMasterForm(orderData, orderDir),
      generateShopForm(orderData, orderDir),
      generateCustomerForm(orderData, orderDir),
      generatePackingList(orderData, orderDir)
    ]);

    // 5. Store paths in database
    await this.saveFormPaths(orderId, version, {
      masterForm: masterPath,
      shopForm: shopPath,
      customerForm: customerPath,
      packingList: packingPath
    });

    return {
      masterForm: masterPath,
      shopForm: shopPath,
      customerForm: customerPath,
      packingList: packingPath
    };
  }

  /**
   * Fetch complete order data with joins
   */
  private async fetchOrderData(orderId: number): Promise<any> {
    const [orderRows] = await pool.execute<RowDataPacket[]>(`
      SELECT
        o.*,
        c.company_name,
        c.contact_first_name,
        c.contact_last_name,
        c.primary_phone,
        c.email
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderRows.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = orderRows[0];

    // Fetch order parts
    const [parts] = await pool.execute<RowDataPacket[]>(`
      SELECT *
      FROM order_parts
      WHERE order_id = ?
      ORDER BY part_number
    `, [orderId]);

    order.parts = parts;

    return order;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Archive current version
   */
  private async archiveCurrentVersion(orderId: number, version: number): Promise<void> {
    const [versionData] = await pool.execute<RowDataPacket[]>(`
      SELECT * FROM order_form_versions
      WHERE order_id = ? AND version_number = ?
    `, [orderId, version]);

    if (versionData.length === 0) return;

    const data = versionData[0];
    const orderDir = path.dirname(data.master_form_path);
    const archiveDir = path.join(orderDir, 'archive', `v${version}`);

    await this.ensureDirectoryExists(archiveDir);

    // Copy files to archive
    const filesToArchive = [
      data.master_form_path,
      data.shop_form_path,
      data.customer_form_path,
      data.packing_list_path
    ].filter(Boolean);

    for (const filePath of filesToArchive) {
      const fileName = path.basename(filePath);
      const archivePath = path.join(archiveDir, fileName);
      try {
        await fs.copyFile(filePath, archivePath);
      } catch (error) {
        console.error(`Failed to archive ${filePath}:`, error);
      }
    }
  }

  /**
   * Update order version
   */
  private async updateOrderVersion(orderId: number, version: number): Promise<void> {
    await pool.execute(
      'UPDATE orders SET form_version = ? WHERE order_id = ?',
      [version, orderId]
    );
  }

  /**
   * Save form paths to database
   */
  private async saveFormPaths(orderId: number, version: number, paths: FormPaths): Promise<void> {
    // Check if version record exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT version_id FROM order_form_versions WHERE order_id = ? AND version_number = ?',
      [orderId, version]
    );

    if (existing.length > 0) {
      // Update existing
      await pool.execute(
        `UPDATE order_form_versions
         SET master_form_path = ?, shop_form_path = ?, customer_form_path = ?, packing_list_path = ?
         WHERE order_id = ? AND version_number = ?`,
        [paths.masterForm, paths.shopForm, paths.customerForm, paths.packingList, orderId, version]
      );
    } else {
      // Insert new
      await pool.execute(
        `INSERT INTO order_form_versions
         (order_id, version_number, master_form_path, shop_form_path, customer_form_path, packing_list_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, version, paths.masterForm, paths.shopForm, paths.customerForm, paths.packingList]
      );
    }
  }
}

export const pdfGenerationService = new PDFGenerationService();
```

---

## Master Form Generator

### /backend/web/src/services/pdf/generators/masterFormGenerator.ts

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate Master Order Form
 * Contains ALL information - internal reference
 */
export async function generateMasterForm(
  orderData: any,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, 'master-form.pdf');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('MASTER ORDER FORM', { align: 'center' });
      doc.moveDown();

      // Order Info
      doc.fontSize(12).font('Helvetica');
      doc.text(`Order Number: ${orderData.order_number}`, { continued: true });
      doc.text(`    Order Name: ${orderData.order_name}`, { align: 'right' });
      doc.moveDown(0.5);

      // Customer Info
      doc.fontSize(10);
      doc.text(`Customer: ${orderData.company_name}`);
      if (orderData.customer_po) {
        doc.text(`Customer PO: ${orderData.customer_po}`);
      }
      if (orderData.point_person_email) {
        doc.text(`Point Person: ${orderData.point_person_email}`);
      }
      doc.moveDown();

      // Dates
      doc.text(`Order Date: ${new Date(orderData.order_date).toLocaleDateString()}`);
      if (orderData.due_date) {
        doc.text(`Due Date: ${new Date(orderData.due_date).toLocaleDateString()}`);
      }
      doc.moveDown();

      // Production Notes (if any)
      if (orderData.production_notes) {
        doc.fontSize(11).font('Helvetica-Bold').text('Production Notes:');
        doc.fontSize(10).font('Helvetica').text(orderData.production_notes);
        doc.moveDown();
      }

      // Parts Section
      doc.fontSize(14).font('Helvetica-Bold').text('Order Parts:');
      doc.moveDown(0.5);

      orderData.parts.forEach((part: any, index: number) => {
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`Part ${part.part_number}: ${part.product_type}`);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Quantity: ${part.quantity}`);

        // Specifications
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            doc.text('Specifications:');
            Object.entries(specs).forEach(([key, value]) => {
              if (value && key !== 'internal') {
                doc.text(`  ${key}: ${value}`);
              }
            });
          } catch (e) {
            doc.text('Specifications: (Unable to parse)');
          }
        }

        // Part notes
        if (part.production_notes) {
          doc.text(`Notes: ${part.production_notes}`);
        }

        doc.moveDown();
      });

      // Footer
      doc.fontSize(8).text(
        `Generated: ${new Date().toLocaleString()} | Version: ${version}`,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
```

---

## Shop Form Generator

### /backend/web/src/services/pdf/generators/shopFormGenerator.ts

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate Shop Order Form
 * Simplified for production floor - no customer details
 */
export async function generateShopForm(
  orderData: any,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, 'shop-form.pdf');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('SHOP ORDER FORM', { align: 'center' });
      doc.moveDown();

      // Order Info (minimal)
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(`Order #: ${orderData.order_number}`, { continued: true });
      doc.text(`    ${orderData.order_name}`, { align: 'right' });
      doc.moveDown(0.5);

      // Due Date (prominent)
      if (orderData.due_date) {
        doc.fontSize(12).font('Helvetica-Bold');
        doc.fillColor('red').text(`DUE DATE: ${new Date(orderData.due_date).toLocaleDateString()}`);
        doc.fillColor('black');
        doc.moveDown();
      }

      // Production Notes
      if (orderData.production_notes) {
        doc.fontSize(11).font('Helvetica-Bold').text('PRODUCTION NOTES:');
        doc.fontSize(10).font('Helvetica').text(orderData.production_notes);
        doc.moveDown();
      }

      // Parts (production-focused)
      doc.fontSize(14).font('Helvetica-Bold').text('Parts to Produce:');
      doc.moveDown(0.5);

      orderData.parts.forEach((part: any) => {
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Part ${part.part_number}: ${part.product_type}`);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Quantity: ${part.quantity}`);

        // Only show production-relevant specs
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            // Filter to production-relevant fields only
            const productionFields = ['dimensions', 'material', 'color', 'finish', 'lighting'];
            const relevantSpecs = Object.entries(specs).filter(([key]) =>
              productionFields.some(field => key.toLowerCase().includes(field))
            );

            if (relevantSpecs.length > 0) {
              relevantSpecs.forEach(([key, value]) => {
                doc.text(`  ${key}: ${value}`);
              });
            }
          } catch (e) {
            // Skip if can't parse
          }
        }

        doc.moveDown();
      });

      // Footer
      doc.fontSize(8).text(
        `Version: ${version} | ${new Date().toLocaleString()}`,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
```

---

## Customer Form Generator

### /backend/web/src/services/pdf/generators/customerFormGenerator.ts

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate Customer Order Form
 * Professional document for customer confirmation
 */
export async function generateCustomerForm(
  orderData: any,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, 'customer-form.pdf');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Professional Header
      doc.fontSize(24).font('Helvetica-Bold').text('ORDER CONFIRMATION', { align: 'center' });
      doc.moveDown(2);

      // Order Number
      doc.fontSize(14).font('Helvetica');
      doc.text(`Order Number: ${orderData.order_number}`);
      doc.text(`Order Date: ${new Date(orderData.order_date).toLocaleDateString()}`);
      if (orderData.due_date) {
        doc.text(`Expected Completion: ${new Date(orderData.due_date).toLocaleDateString()}`);
      }
      doc.moveDown();

      // Customer Info
      doc.fontSize(12).font('Helvetica-Bold').text('Customer:');
      doc.fontSize(11).font('Helvetica');
      doc.text(orderData.company_name);
      if (orderData.contact_first_name) {
        doc.text(`${orderData.contact_first_name} ${orderData.contact_last_name || ''}`);
      }
      if (orderData.primary_phone) {
        doc.text(`Phone: ${orderData.primary_phone}`);
      }
      doc.moveDown();

      // Order Details
      doc.fontSize(14).font('Helvetica-Bold').text('Order Details:');
      doc.moveDown(0.5);

      orderData.parts.forEach((part: any) => {
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`${part.product_type}`);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Quantity: ${part.quantity}`);

        // Customer-friendly specifications (hide technical details)
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            // Show only customer-relevant fields
            const customerFields = ['color', 'size', 'material', 'finish', 'lighting'];
            Object.entries(specs).forEach(([key, value]) => {
              if (customerFields.some(field => key.toLowerCase().includes(field))) {
                doc.text(`  ${key}: ${value}`);
              }
            });
          } catch (e) {
            // Skip if can't parse
          }
        }

        doc.moveDown();
      });

      // Footer
      doc.moveDown(2);
      doc.fontSize(9).text('Thank you for your business!', { align: 'center' });
      doc.fontSize(8).text(
        'If you have any questions, please contact us.',
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
```

---

## Packing List Generator

### /backend/web/src/services/pdf/generators/packingListGenerator.ts

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate Packing List
 * QC checklist and shipping guide
 */
export async function generatePackingList(
  orderData: any,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, 'packing-list.pdf');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('PACKING LIST', { align: 'center' });
      doc.moveDown();

      // Order Info
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Order #: ${orderData.order_number}`);
      doc.text(`Customer: ${orderData.company_name}`);
      doc.moveDown();

      // Checklist Header
      doc.fontSize(14).font('Helvetica-Bold').text('Items to Pack:');
      doc.moveDown(0.5);

      // Checklist items
      orderData.parts.forEach((part: any) => {
        // Checkbox
        doc.rect(doc.x, doc.y, 12, 12).stroke();

        // Item description
        doc.fontSize(11).font('Helvetica');
        doc.text(`  Part ${part.part_number}: ${part.product_type}`, doc.x + 20, doc.y - 10);
        doc.text(`     Quantity: ${part.quantity}`, doc.x + 20);

        doc.moveDown(0.5);
      });

      doc.moveDown();

      // QC Section
      doc.fontSize(12).font('Helvetica-Bold').text('Quality Check:');
      doc.moveDown(0.5);

      const qcChecks = [
        'All parts inspected for defects',
        'Correct quantities verified',
        'Parts properly protected for shipping',
        'Hardware/accessories included (if applicable)',
        'Customer specifications verified'
      ];

      qcChecks.forEach(check => {
        doc.rect(doc.x, doc.y, 12, 12).stroke();
        doc.fontSize(10).font('Helvetica');
        doc.text(`  ${check}`, doc.x + 20, doc.y - 10);
        doc.moveDown(0.5);
      });

      doc.moveDown();

      // Sign-off
      doc.fontSize(11).font('Helvetica-Bold').text('Packed By: ________________    Date: ___________');

      // Footer
      doc.fontSize(8).text(
        `Version: ${version} | ${new Date().toLocaleString()}`,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
```

---

## Order Form Controller

### /backend/web/src/controllers/orderFormController.ts

```typescript
import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { pdfGenerationService } from '../services/pdf/pdfGenerationService';
import fs from 'fs/promises';

/**
 * Generate all order forms
 */
export const generateOrderForms = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { createNewVersion = false } = req.body;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const paths = await pdfGenerationService.generateAllForms({
      orderId: orderIdNum,
      createNewVersion
    });

    res.json({
      success: true,
      data: paths,
      message: 'Order forms generated successfully'
    });
  } catch (error) {
    console.error('Error generating order forms:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate order forms'
    });
  }
};

/**
 * Download specific form
 */
export const downloadOrderForm = async (req: Request, res: Response) => {
  try {
    const { orderId, formType } = req.params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    // Get form path from database
    // Implementation depends on your data structure
    // For now, return error
    res.status(501).json({
      success: false,
      message: 'Download not implemented yet'
    });
  } catch (error) {
    console.error('Error downloading order form:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to download order form'
    });
  }
};

/**
 * Get form paths
 */
export const getFormPaths = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    // Get paths from database
    // Implementation depends on your data structure
    res.status(501).json({
      success: false,
      message: 'Get paths not implemented yet'
    });
  } catch (error) {
    console.error('Error getting form paths:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get form paths'
    });
  }
};
```

---

## SMB Mount Configuration

Forms are stored on SMB mount at `/mnt/channelletter/NexusTesting/`

**SMB Mount Details:**
- **Mount Point:** `/mnt/channelletter`
- **Network Share:** `\\DESKTOP-EJCP1DO\Channel Letter`
- **Storage Path:** `/mnt/channelletter/NexusTesting/`
- **Static IP:** 192.168.2.85 (DHCP Reserved)
- **Write Access:** Verified ✓

**Directory Structure:**
```
/mnt/channelletter/NexusTesting/
├── Order-200000/
│   ├── master-form.pdf         ← Current version (no version suffix)
│   ├── shop-form.pdf
│   ├── customer-form.pdf
│   ├── packing-list.pdf
│   └── archive/
│       └── v1/                 ← Previous versions archived here
│           ├── master-form.pdf
│           ├── shop-form.pdf
│           ├── customer-form.pdf
│           └── packing-list.pdf
├── Order-200001/
│   └── ...
```

**Filename Convention:**
- Current version: `{formType}-form.pdf` (hyphenated, no version suffix)
- Archived versions: `archive/v{N}/{formType}-form.pdf`

**Ensure mount is accessible:**
```bash
# Check if mount exists
ls -la /mnt/channelletter/NexusTesting/

# Mount should already be configured via /etc/fstab
# If not accessible, check mount status:
mount | grep channelletter
```

---

## Testing Checklist

- [ ] Install pdfkit: `npm install pdfkit @types/pdfkit`
- [ ] Verify SMB mount accessible: `ls /mnt/signfiles/orders`
- [ ] Create test order with conversion
- [ ] Generate all 4 forms: `POST /api/orders/:orderNumber/forms`
- [ ] Verify all 4 PDFs created in `/mnt/channelletter/NexusTesting/Order-{orderNumber}/`
- [ ] Open each PDF and verify:
  - Master Form: All information present
  - Shop Form: Production-focused, no customer details
  - Customer Form: Professional, customer-friendly
  - Packing List: Checklist format with checkboxes
- [ ] Test form versioning: generate forms twice with `createNewVersion: true`
- [ ] Verify v1 archived, v2 created
- [ ] Test with order containing multiple parts
- [ ] Test with order containing specifications JSON

---

## Next Steps

After completing Phase 1.c:

1. ✅ PDF forms generating correctly
2. ✅ All 4 form types working
3. ✅ Form versioning functional
4. → Proceed to **Phase 1.d: Backend - Progress Tracking**

---

**Sub-Phase Status:** Ready for Implementation
**Estimated Time:** 3-4 days
**Blockers:** None
**Dependencies:** Phase 1.b must be complete
