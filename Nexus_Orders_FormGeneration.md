# Order Form Generation - Technical Specification

## Overview

This document provides technical specifications for generating PDF order forms. Four types of forms are generated simultaneously when an order is created or updated:

1. **Master Order Form** - Complete internal reference
2. **Shop Order Form** - Production floor instructions
3. **Customer Order Form** - Customer confirmation/approval
4. **Packing List** - QC checklist and shipping guide

## Technology Stack

### Phase 1 Recommendation: PDFKit

**Library:** `pdfkit` (Node.js PDF generation)

**Advantages:**
- Mature, well-maintained library
- Programmatic PDF generation with full control
- Good TypeScript support
- Works well with streams for file system operations
- Can embed images easily

**Installation:**
```bash
npm install pdfkit @types/pdfkit
```

**Alternative:** `pdf-lib` (if more advanced PDF manipulation needed)

## File Structure

```
/backend/web/src/services/pdf/
├── pdfGenerationService.ts       # Main service orchestrator
├── generators/
│   ├── masterFormGenerator.ts    # Master order form
│   ├── shopFormGenerator.ts      # Shop order form
│   ├── customerFormGenerator.ts  # Customer order form
│   └── packingListGenerator.ts   # Packing list
├── components/
│   ├── headerSection.ts          # Reusable header component
│   ├── partSection.ts            # Part/job details component
│   ├── specificationTable.ts     # Specifications table
│   └── packingChecklist.ts       # Packing checklist component
└── utils/
    ├── pageSetup.ts              # Page dimensions, margins
    ├── styles.ts                 # Font sizes, colors, spacing
    └── imageHandler.ts           # Image loading and embedding
```

## PDF Generation Service

### Main Orchestrator

```typescript
// /backend/web/src/services/pdf/pdfGenerationService.ts

import { pool } from '../../config/database';
import { generateMasterForm } from './generators/masterFormGenerator';
import { generateShopForm } from './generators/shopFormGenerator';
import { generateCustomerForm } from './generators/customerFormGenerator';
import { generatePackingList } from './generators/packingListGenerator';
import fs from 'fs/promises';
import path from 'path';

interface FormGenerationOptions {
  orderId: number;
  version?: number;  // If not provided, use current version from DB
  createNewVersion?: boolean;
}

interface FormPaths {
  masterForm: string;
  shopForm: string;
  customerForm: string;
  packingList: string;
}

export class PDFGenerationService {
  private readonly baseStoragePath = '/mnt/signfiles/orders';

  async generateAllForms(options: FormGenerationOptions): Promise<FormPaths> {
    const { orderId, createNewVersion = false } = options;

    // 1. Fetch order data with all related information
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

    // 4. Generate all 4 forms in parallel
    const formPaths = await Promise.all([
      generateMasterForm(orderData, orderDir, version),
      generateShopForm(orderData, orderDir, version),
      generateCustomerForm(orderData, orderDir, version),
      generatePackingList(orderData, orderDir, version)
    ]);

    // 5. Store paths in database
    await this.saveFormPaths(orderId, version, {
      masterForm: formPaths[0],
      shopForm: formPaths[1],
      customerForm: formPaths[2],
      packingList: formPaths[3]
    });

    return {
      masterForm: formPaths[0],
      shopForm: formPaths[1],
      customerForm: formPaths[2],
      packingList: formPaths[3]
    };
  }

  private async fetchOrderData(orderId: number): Promise<any> {
    // Fetch complete order data with joins
    const [orderRows] = await pool.execute(`
      SELECT
        o.*,
        c.company_name,
        c.billing_address_line1,
        c.billing_city,
        c.billing_province,
        c.billing_postal_code,
        c.special_instructions as customer_manufacturing_preferences,
        c.comments as internal_notes
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (!Array.isArray(orderRows) || orderRows.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = orderRows[0];

    // Fetch order parts
    const [parts] = await pool.execute(`
      SELECT *
      FROM order_parts
      WHERE order_id = ?
      ORDER BY part_number
    `, [orderId]);

    order.parts = parts;

    return order;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async archiveCurrentVersion(orderId: number, version: number): Promise<void> {
    // Move current version files to archive directory
    const [versionData] = await pool.execute(`
      SELECT * FROM order_form_versions
      WHERE order_id = ? AND version_number = ?
    `, [orderId, version]);

    if (!Array.isArray(versionData) || versionData.length === 0) return;

    const data = versionData[0];
    const orderDir = path.dirname(data.master_form_path);
    const archiveDir = path.join(orderDir, 'archive', `v${version}`);

    await this.ensureDirectoryExists(archiveDir);

    // Copy files to archive (keep originals for now, they'll be overwritten)
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

  private async updateOrderVersion(orderId: number, newVersion: number): Promise<void> {
    await pool.execute(`
      UPDATE orders
      SET form_version = ?
      WHERE order_id = ?
    `, [newVersion, orderId]);
  }

  private async saveFormPaths(
    orderId: number,
    version: number,
    paths: FormPaths
  ): Promise<void> {
    await pool.execute(`
      INSERT INTO order_form_versions
        (order_id, version_number, master_form_path, shop_form_path, customer_form_path, packing_list_path)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        master_form_path = VALUES(master_form_path),
        shop_form_path = VALUES(shop_form_path),
        customer_form_path = VALUES(customer_form_path),
        packing_list_path = VALUES(packing_list_path)
    `, [orderId, version, paths.masterForm, paths.shopForm, paths.customerForm, paths.packingList]);
  }
}

export const pdfGenerationService = new PDFGenerationService();
```

## Page Setup and Styling

### Common Configuration

```typescript
// /backend/web/src/services/pdf/utils/pageSetup.ts

import PDFDocument from 'pdfkit';

export const PageConfig = {
  size: 'LETTER' as const,
  layout: 'landscape' as const,
  margins: {
    top: 36,    // 0.5 inch
    bottom: 36,
    left: 36,
    right: 36
  }
};

export const PageDimensions = {
  // Letter landscape: 11" x 8.5"
  width: 11 * 72,   // 792 points
  height: 8.5 * 72, // 612 points

  // Usable area (accounting for margins)
  usableWidth: (11 * 72) - (36 * 2),  // 720 points
  usableHeight: (8.5 * 72) - (36 * 2) // 540 points
};

export function createDocument(): PDFDocument {
  return new PDFDocument({
    size: PageConfig.size,
    layout: PageConfig.layout,
    margins: PageConfig.margins,
    bufferPages: true  // Enable multi-page support
  });
}
```

### Styling Constants

```typescript
// /backend/web/src/services/pdf/utils/styles.ts

export const Colors = {
  // Text
  black: '#000000',
  darkGray: '#333333',
  mediumGray: '#666666',
  lightGray: '#999999',

  // Backgrounds
  headerBg: '#f0f0f0',
  rowAltBg: '#f9f9f9',

  // Packing list color coding
  shipping: '#fff3cd',      // Yellow background
  pickup: '#cfe2ff',        // Blue background

  // Borders
  border: '#cccccc',

  // Version indicator
  versionNew: '#e7f3ff'     // Light blue for v2+
};

export const Fonts = {
  title: {
    font: 'Helvetica-Bold',
    size: 20
  },
  sectionHeader: {
    font: 'Helvetica-Bold',
    size: 14
  },
  fieldLabel: {
    font: 'Helvetica-Bold',
    size: 10
  },
  fieldValue: {
    font: 'Helvetica',
    size: 10
  },
  small: {
    font: 'Helvetica',
    size: 8
  }
};

export const Spacing = {
  lineHeight: 14,
  sectionGap: 20,
  fieldGap: 12,
  tableRowHeight: 18,
  tablePadding: 4
};
```

## Form Generators

### Master Order Form

```typescript
// /backend/web/src/services/pdf/generators/masterFormGenerator.ts

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { createDocument, PageDimensions } from '../utils/pageSetup';
import { Colors, Fonts, Spacing } from '../utils/styles';
import { renderHeader } from '../components/headerSection';
import { renderPartDetails } from '../components/partSection';
import { productTypeTemplateService } from '../../productTypeTemplateService';

export async function generateMasterForm(
  orderData: any,
  outputDir: string,
  version: number
): Promise<string> {
  const doc = createDocument();
  const filename = `master_form_v${version}.pdf`;
  const outputPath = path.join(outputDir, filename);

  // Pipe to file
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Add version background if v2+
  if (version > 1) {
    doc.rect(0, 0, PageDimensions.width, PageDimensions.height)
       .fill(Colors.versionNew);
  }

  let yPosition = doc.page.margins.top;

  // Title
  doc.font(Fonts.title.font)
     .fontSize(Fonts.title.size)
     .text('Order Form', { align: 'center' });

  yPosition += 30;

  // Header section
  yPosition = renderHeader(doc, orderData, yPosition, {
    includeCustomerName: true,
    includePoNumber: true,
    includePointPerson: true,
    includeDueDate: true,
    version: version
  });

  yPosition += Spacing.sectionGap;

  // Manufacturing Preferences section
  if (orderData.customer_manufacturing_preferences || orderData.internal_notes) {
    doc.font(Fonts.sectionHeader.font)
       .fontSize(Fonts.sectionHeader.size)
       .text('Manufacturing Preferences', 36, yPosition);

    yPosition += 20;

    if (orderData.customer_manufacturing_preferences) {
      doc.font(Fonts.fieldLabel.font)
         .fontSize(Fonts.fieldLabel.size)
         .text('Customer Manufacturing Preferences:', 36, yPosition);
      yPosition += 12;

      doc.font(Fonts.fieldValue.font)
         .text(orderData.customer_manufacturing_preferences, 50, yPosition, {
           width: PageDimensions.usableWidth - 14
         });
      yPosition += doc.heightOfString(orderData.customer_manufacturing_preferences) + 10;
    }

    if (orderData.internal_notes) {
      doc.font(Fonts.fieldLabel.font)
         .text('Internal Notes:', 36, yPosition);
      yPosition += 12;

      doc.font(Fonts.fieldValue.font)
         .text(orderData.internal_notes, 50, yPosition, {
           width: PageDimensions.usableWidth - 14
         });
      yPosition += doc.heightOfString(orderData.internal_notes) + 10;
    }

    yPosition += Spacing.sectionGap;
  }

  // Job Information (Parts)
  doc.font(Fonts.sectionHeader.font)
     .fontSize(Fonts.sectionHeader.size)
     .text('Job Information', 36, yPosition);

  yPosition += 20;

  for (const part of orderData.parts) {
    // Check if we need a new page
    if (yPosition > PageDimensions.height - 150) {
      doc.addPage();
      yPosition = doc.page.margins.top;
    }

    yPosition = await renderPartDetails(doc, part, yPosition, {
      showAllFields: true,
      includeImage: true
    });

    yPosition += Spacing.sectionGap;
  }

  // Footer section
  if (orderData.production_notes || orderData.shipping_required !== null) {
    // Check page space
    if (yPosition > PageDimensions.height - 100) {
      doc.addPage();
      yPosition = doc.page.margins.top;
    }

    doc.font(Fonts.sectionHeader.font)
       .fontSize(Fonts.sectionHeader.size)
       .text('Additional Information', 36, yPosition);

    yPosition += 20;

    if (orderData.production_notes) {
      doc.font(Fonts.fieldLabel.font)
         .fontSize(Fonts.fieldLabel.size)
         .text('Overall Production Notes:', 36, yPosition);
      yPosition += 12;

      doc.font(Fonts.fieldValue.font)
         .text(orderData.production_notes, 50, yPosition);
      yPosition += doc.heightOfString(orderData.production_notes) + 10;
    }

    if (orderData.shipping_required !== null) {
      doc.font(Fonts.fieldLabel.font)
         .text('Shipping:', 36, yPosition);

      doc.font(Fonts.fieldValue.font)
         .text(orderData.shipping_required ? 'Yes' : 'No (Pickup)', 100, yPosition);
      yPosition += 15;
    }
  }

  // Finalize
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
```

### Shop Order Form

```typescript
// /backend/web/src/services/pdf/generators/shopFormGenerator.ts

// Nearly identical to Master Form, but with exclusions
export async function generateShopForm(
  orderData: any,
  outputDir: string,
  version: number
): Promise<string> {
  // Clone order data and remove excluded fields
  const shopData = {
    ...orderData,
    company_name: undefined,           // Exclude
    customer_po: undefined,            // Exclude
    point_person_email: undefined,     // Exclude
    internal_notes: undefined          // Exclude
  };

  // Use same generation logic as master form
  const doc = createDocument();
  const filename = `shop_form_v${version}.pdf`;
  const outputPath = path.join(outputDir, filename);

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // ... (same rendering logic as master form, but using shopData)

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
```

### Customer Order Form

```typescript
// /backend/web/src/services/pdf/generators/customerFormGenerator.ts

import { productTypeTemplateService } from '../../productTypeTemplateService';

export async function generateCustomerForm(
  orderData: any,
  outputDir: string,
  version: number
): Promise<string> {
  // Clone and exclude fields
  const customerData = {
    ...orderData,
    due_date: undefined,              // Exclude
    point_person_email: undefined,    // Exclude
    internal_notes: undefined,        // Exclude
    parts: orderData.parts.map((part: any) => ({
      ...part,
      // Transform specifications for customer view
      specifications: productTypeTemplateService.transformSpecificationsForCustomer(
        part.product_type_id,
        part.specifications
      )
    }))
  };

  // Generate PDF with transformed data
  const doc = createDocument();
  const filename = `customer_form_v${version}.pdf`;
  const outputPath = path.join(outputDir, filename);

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // ... (same rendering logic, but LED counts show as Yes/No)

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
```

### Packing List

```typescript
// /backend/web/src/services/pdf/generators/packingListGenerator.ts

import { productTypeTemplateService } from '../../productTypeTemplateService';
import { renderPackingChecklist } from '../components/packingChecklist';

export async function generatePackingList(
  orderData: any,
  outputDir: string,
  version: number
): Promise<string> {
  const doc = createDocument();
  const filename = `packing_list_v${version}.pdf`;
  const outputPath = path.join(outputDir, filename);

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Background color based on shipping status
  const bgColor = orderData.shipping_required ? Colors.shipping : Colors.pickup;
  doc.rect(0, 0, PageDimensions.width, PageDimensions.height)
     .fill(bgColor);

  let yPosition = doc.page.margins.top;

  // Title
  doc.fillColor(Colors.black)
     .font(Fonts.title.font)
     .fontSize(Fonts.title.size)
     .text('Packing List', { align: 'center' });

  yPosition += 30;

  // Header info (minimal)
  doc.font(Fonts.fieldLabel.font)
     .fontSize(Fonts.fieldLabel.size)
     .text(`Order Number: ${orderData.order_number}`, 36, yPosition);
  yPosition += 15;

  doc.text(`Order Name: ${orderData.order_name}`, 36, yPosition);
  yPosition += 15;

  doc.text(`Customer: ${orderData.company_name}`, 36, yPosition);
  yPosition += 25;

  // For each part, show packing checklist
  for (const part of orderData.parts) {
    // Check page space
    if (yPosition > PageDimensions.height - 200) {
      doc.addPage();
      // Re-apply background color
      doc.rect(0, 0, PageDimensions.width, PageDimensions.height)
         .fill(bgColor);
      yPosition = doc.page.margins.top;
    }

    // Part header
    doc.fillColor(Colors.black)
       .font(Fonts.sectionHeader.font)
       .fontSize(Fonts.sectionHeader.size)
       .text(`${part.product_type} (Quantity: ${part.quantity})`, 36, yPosition);
    yPosition += 20;

    // Get packing items from template
    const packingItems = productTypeTemplateService.getPackingItemsForProductType(
      part.product_type_id,
      part.specifications
    );

    // Render checklist
    yPosition = renderPackingChecklist(doc, packingItems, yPosition, bgColor);

    // Production notes for this part
    if (part.production_notes) {
      doc.font(Fonts.fieldLabel.font)
         .fontSize(Fonts.fieldLabel.size)
         .text('Production Notes:', 36, yPosition);
      yPosition += 12;

      doc.font(Fonts.fieldValue.font)
         .text(part.production_notes, 50, yPosition);
      yPosition += doc.heightOfString(part.production_notes) + 10;
    }

    // Sign image if available
    if (part.sign_image_path) {
      try {
        const imagePath = path.join('/mnt/signfiles/orders', String(orderData.order_number), part.sign_image_path);
        // Add image (fit within width, max height)
        doc.image(imagePath, 36, yPosition, {
          fit: [PageDimensions.usableWidth, 200],
          align: 'center'
        });
        yPosition += 210;
      } catch (error) {
        console.error('Failed to embed image:', error);
      }
    }

    yPosition += Spacing.sectionGap;
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
```

## Reusable Components

### Header Section

```typescript
// /backend/web/src/services/pdf/components/headerSection.ts

import PDFDocument from 'pdfkit';
import { Fonts, Spacing, Colors } from '../utils/styles';

interface HeaderOptions {
  includeCustomerName?: boolean;
  includePoNumber?: boolean;
  includePointPerson?: boolean;
  includeDueDate?: boolean;
  version?: number;
}

export function renderHeader(
  doc: PDFDocument,
  orderData: any,
  startY: number,
  options: HeaderOptions = {}
): number {
  let y = startY;

  // Order Number with version
  doc.font(Fonts.fieldLabel.font)
     .fontSize(Fonts.fieldLabel.size)
     .text('Order Number:', 36, y);

  const orderNumberDisplay = options.version && options.version > 1
    ? `${orderData.order_number} - v${options.version}`
    : String(orderData.order_number);

  doc.font(Fonts.fieldValue.font)
     .text(orderNumberDisplay, 150, y);
  y += Spacing.lineHeight;

  // Order Name
  doc.font(Fonts.fieldLabel.font)
     .text('Order Name:', 36, y);
  doc.font(Fonts.fieldValue.font)
     .text(orderData.order_name, 150, y);
  y += Spacing.lineHeight;

  // Customer (conditional)
  if (options.includeCustomerName && orderData.company_name) {
    doc.font(Fonts.fieldLabel.font)
       .text('Customer:', 36, y);
    doc.font(Fonts.fieldValue.font)
       .text(orderData.company_name, 150, y);
    y += Spacing.lineHeight;
  }

  // PO Number (conditional)
  if (options.includePoNumber && orderData.customer_po) {
    doc.font(Fonts.fieldLabel.font)
       .text('PO Number:', 36, y);
    doc.font(Fonts.fieldValue.font)
       .text(orderData.customer_po, 150, y);
    y += Spacing.lineHeight;
  }

  // Point Person Email (conditional)
  if (options.includePointPerson && orderData.point_person_email) {
    doc.font(Fonts.fieldLabel.font)
       .text('Point Person Email:', 36, y);
    doc.font(Fonts.fieldValue.font)
       .text(orderData.point_person_email, 150, y);
    y += Spacing.lineHeight;
  }

  // Order Date
  doc.font(Fonts.fieldLabel.font)
     .text('Order Date:', 36, y);
  doc.font(Fonts.fieldValue.font)
     .text(new Date(orderData.order_date).toLocaleDateString(), 150, y);
  y += Spacing.lineHeight;

  // Due Date (conditional)
  if (options.includeDueDate && orderData.due_date) {
    doc.font(Fonts.fieldLabel.font)
       .text('Due Date:', 36, y);
    doc.font(Fonts.fieldValue.font)
       .text(new Date(orderData.due_date).toLocaleDateString(), 150, y);
    y += Spacing.lineHeight;
  }

  return y;
}
```

### Part Details Section

```typescript
// /backend/web/src/services/pdf/components/partSection.ts

import PDFDocument from 'pdfkit';
import path from 'path';
import { Fonts, Spacing, Colors, PageDimensions } from '../utils/styles';
import { productTypeTemplateService } from '../../productTypeTemplateService';

interface PartOptions {
  showAllFields?: boolean;
  includeImage?: boolean;
}

export async function renderPartDetails(
  doc: PDFDocument,
  part: any,
  startY: number,
  options: PartOptions = {}
): Promise<number> {
  let y = startY;

  // Part header
  doc.font(Fonts.sectionHeader.font)
     .fontSize(Fonts.sectionHeader.size)
     .text(`Part ${part.part_number}: ${part.product_type}`, 36, y);
  y += 18;

  // Quantity
  doc.font(Fonts.fieldLabel.font)
     .fontSize(Fonts.fieldLabel.size)
     .text('Quantity:', 50, y);
  doc.font(Fonts.fieldValue.font)
     .text(String(part.quantity), 150, y);
  y += Spacing.lineHeight;

  // Specifications
  doc.font(Fonts.fieldLabel.font)
     .text('Specifications:', 50, y);
  y += Spacing.lineHeight;

  // Get specification labels from template
  const labels = productTypeTemplateService.getSpecificationLabels(part.product_type_id);
  const specs = part.specifications || {};

  for (const [fieldId, value] of Object.entries(specs)) {
    const label = labels.get(fieldId) || fieldId;

    doc.font(Fonts.fieldValue.font)
       .text(`  ${label}: ${value}`, 60, y);
    y += Spacing.lineHeight;
  }

  // Production Notes
  if (part.production_notes) {
    y += 5;
    doc.font(Fonts.fieldLabel.font)
       .text('Production Notes:', 50, y);
    y += 12;

    doc.font(Fonts.fieldValue.font)
       .text(part.production_notes, 60, y, {
         width: PageDimensions.usableWidth - 24
       });
    y += doc.heightOfString(part.production_notes, { width: PageDimensions.usableWidth - 24 }) + 5;
  }

  // Sign Image
  if (options.includeImage && part.sign_image_path) {
    y += 10;
    doc.font(Fonts.fieldLabel.font)
       .text('Sign Image:', 50, y);
    y += 15;

    try {
      // Embed image - make as large as possible while fitting
      const imagePath = part.sign_image_path;
      doc.image(imagePath, 60, y, {
        fit: [PageDimensions.usableWidth - 24, 250],
        align: 'center'
      });
      y += 260;  // Image height + padding
    } catch (error) {
      console.error('Failed to embed image:', error);
      doc.font(Fonts.fieldValue.font)
         .text('[Image not available]', 60, y);
      y += 15;
    }
  }

  return y;
}
```

### Packing Checklist Component

```typescript
// /backend/web/src/services/pdf/components/packingChecklist.ts

import PDFDocument from 'pdfkit';
import { Fonts, Spacing, Colors } from '../utils/styles';
import { PackingItem } from '../../../types/orders';

export function renderPackingChecklist(
  doc: PDFDocument,
  items: PackingItem[],
  startY: number,
  backgroundColor: string
): number {
  let y = startY;

  // Draw checklist box
  const boxX = 50;
  const boxWidth = 500;
  const itemHeight = 22;

  for (const item of items) {
    // Checkbox (actually a text field in PDF, rendered as box)
    doc.rect(boxX, y, 12, 12)
       .stroke(Colors.border);

    // Item description
    doc.font(Fonts.fieldValue.font)
       .fontSize(Fonts.fieldValue.size)
       .fillColor(Colors.black)
       .text(item.item_name, boxX + 20, y + 2);

    // Blank line for notes
    doc.moveTo(boxX + 250, y + 10)
       .lineTo(boxX + boxWidth, y + 10)
       .stroke(Colors.lightGray);

    y += itemHeight;
  }

  return y + 10;
}
```

## Image Handling

### Image Upload and Storage

```typescript
// /backend/web/src/services/pdf/utils/imageHandler.ts

import path from 'path';
import fs from 'fs/promises';

export async function saveSignImage(
  orderNumber: number,
  partNumber: number,
  imageBuffer: Buffer,
  filename: string
): Promise<string> {
  const orderDir = `/mnt/signfiles/orders/${orderNumber}/sign_images`;

  // Ensure directory exists
  await fs.mkdir(orderDir, { recursive: true });

  // Generate unique filename
  const ext = path.extname(filename);
  const savedFilename = `part${partNumber}${ext}`;
  const fullPath = path.join(orderDir, savedFilename);

  // Save file
  await fs.writeFile(fullPath, imageBuffer);

  // Return relative path for database storage
  return `sign_images/${savedFilename}`;
}

export async function getSignImagePath(
  orderNumber: number,
  relativePath: string
): Promise<string> {
  return path.join('/mnt/signfiles/orders', String(orderNumber), relativePath);
}
```

## API Endpoints

### Form Generation Endpoint

```typescript
// /backend/web/src/controllers/orderFormController.ts

import { Request, Response } from 'express';
import { pdfGenerationService } from '../services/pdf/pdfGenerationService';

export const generateOrderForms = async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { createNewVersion } = req.body;

    const formPaths = await pdfGenerationService.generateAllForms({
      orderId,
      createNewVersion: createNewVersion === true
    });

    res.json({
      success: true,
      message: 'Forms generated successfully',
      data: formPaths
    });
  } catch (error) {
    console.error('Form generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate forms',
      error: error.message
    });
  }
};

export const downloadForm = async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { formType, version } = req.query;

    // Fetch form path from database
    const [rows] = await pool.execute(`
      SELECT ${formType}_path as form_path
      FROM order_form_versions
      WHERE order_id = ? AND version_number = ?
    `, [orderId, version || 1]);

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    const formPath = rows[0].form_path;

    // Send file
    res.download(formPath, path.basename(formPath));
  } catch (error) {
    console.error('Form download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download form'
    });
  }
};
```

## Testing

### Unit Tests

```typescript
// /backend/web/src/services/pdf/__tests__/pdfGeneration.test.ts

import { pdfGenerationService } from '../pdfGenerationService';
import fs from 'fs/promises';

describe('PDF Generation Service', () => {
  const mockOrderData = {
    order_id: 1,
    order_number: 200000,
    order_name: 'Test Order',
    customer_id: 100,
    company_name: 'Test Company',
    order_date: new Date(),
    form_version: 1,
    parts: [
      {
        part_id: 1,
        part_number: 1,
        product_type: 'Channel Letters - Front Lit',
        product_type_id: 'channel_letters_front_lit',
        quantity: 10,
        specifications: {
          height: 12,
          depth: 3,
          face_material: 'Acrylic',
          vinyl_color: 'Red'
        }
      }
    ]
  };

  it('should generate all 4 forms', async () => {
    const paths = await pdfGenerationService.generateAllForms({
      orderId: 1
    });

    expect(paths.masterForm).toBeDefined();
    expect(paths.shopForm).toBeDefined();
    expect(paths.customerForm).toBeDefined();
    expect(paths.packingList).toBeDefined();

    // Verify files exist
    await expect(fs.access(paths.masterForm)).resolves.not.toThrow();
    await expect(fs.access(paths.shopForm)).resolves.not.toThrow();
    await expect(fs.access(paths.customerForm)).resolves.not.toThrow();
    await expect(fs.access(paths.packingList)).resolves.not.toThrow();
  });

  it('should create new version when requested', async () => {
    const paths = await pdfGenerationService.generateAllForms({
      orderId: 1,
      createNewVersion: true
    });

    // Verify v2 files created
    expect(paths.masterForm).toContain('_v2.pdf');
  });
});
```

## Performance Considerations

### Optimization Strategies

1. **Parallel Generation**: Generate all 4 forms concurrently using `Promise.all()`

2. **Image Optimization**:
   - Resize images before embedding to reduce PDF size
   - Use compression settings in PDFKit

3. **Caching**:
   - Cache product type templates in memory
   - Reuse specification labels

4. **Streaming**:
   - Use streams for file writing to reduce memory usage
   - Don't load entire PDF into memory

5. **Background Processing** (Phase 2):
   - Queue PDF generation for large orders
   - Use worker threads for CPU-intensive operations

## Error Handling

### Robust Error Management

```typescript
try {
  await pdfGenerationService.generateAllForms({ orderId });
} catch (error) {
  if (error.message.includes('not found')) {
    // Order doesn't exist
    return res.status(404).json({ error: 'Order not found' });
  } else if (error.code === 'EACCES') {
    // Permission error on SMB mount
    return res.status(500).json({ error: 'File system permission denied' });
  } else if (error.code === 'ENOSPC') {
    // Disk full
    return res.status(507).json({ error: 'Insufficient storage' });
  } else {
    // Generic error
    console.error('PDF generation failed:', error);
    return res.status(500).json({ error: 'Form generation failed' });
  }
}
```

## Future Enhancements

### Phase 2+ Improvements

1. **Email Integration**: Automatically email customer form to point person
2. **Digital Signatures**: Add signature fields to customer approval form
3. **QR Codes**: Add QR code linking to order tracking page
4. **Barcode**: Add barcode for warehouse scanning
5. **Multi-language**: Support for bilingual forms (English/French)
6. **Custom Branding**: Add customer logo to customer-facing forms
7. **Interactive PDFs**: Editable fields in packing list checkboxes

---

**Document Status:** Technical Specification - Phase 1
**Last Updated:** 2025-11-03
**Dependencies:** Nexus_Orders_OrderForms.md, Nexus_Orders_ProductTypeTemplates.md
**Library:** PDFKit for Node.js
