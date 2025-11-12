/**
 * OBSOLETE - DO NOT USE
 * This file has been replaced by orderFormGenerator.ts
 *
 * Master Form Generator - REVAMPED
 * Compact landscape layout prioritizing information density and image preview
 *
 * Layout: Landscape Letter (11" x 8.5")
 * Design: Minimal padding, compact info, large image area
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { STORAGE_CONFIG } from '../../../config/storage';
import type { OrderDataForPDF } from '../pdfGenerationService';

// Debug logging to console
function debugLog(message: string) {
  console.log(`======================== PDF DEBUG ========================`);
  console.log(message);
  console.log(`===========================================================`);
}

/**
 * Helper: Format boolean values to Yes/No
 * Converts boolean values (true/false or 'true'/'false') to 'Yes'/'No'
 */
function formatBooleanValue(value: any): string {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  return String(value);
}

/**
 * Helper: Clean up spec values (remove parenthetical details)
 * For LEDs and Power Supplies: "Interone 9K - 9000K (0.80W, 12V)" → "Interone 9K"
 */
function cleanSpecValue(value: string): string {
  if (!value || typeof value !== 'string') return value;

  // Remove parenthetical specs (anything in parentheses)
  if (value.includes('(')) {
    let cleaned = value.split('(')[0].trim();

    // Also remove trailing dash and details (like " - 9000K")
    const dashMatch = cleaned.match(/^(.+?)\s*-\s*.+$/);
    if (dashMatch) {
      cleaned = dashMatch[1].trim();
    }

    return cleaned;
  }

  return value;
}

/**
 * Define spec ordering - templates will be rendered in this order
 */
const SPEC_ORDER = [
  'Return',
  'Trim',
  'Face',
  'Vinyl',
  'Digital Print',
  'Material',
  'Cutting',
  'Box Material',
  'Extr. Colour',
  'Push Thru Acrylic',
  'Neon Base',
  'Neon LED',
  'Painting',
  'D-Tape',
  'Pins',
  'Mounting',
  'Cut',
  'Peel',
  'Mask',
  'Back',
  'LEDs',
  'Power Supply',
  'Wire Length',
  'UL',
  'Drain Holes',
  'Assembly',
  'Notes'
];

/**
 * Helper: Format spec values based on template name using named keys
 */
function formatSpecValues(templateName: string, specs: Record<string, any>): string {
  if (!specs || Object.keys(specs).length === 0) return '';

  switch (templateName) {
    case 'Return':
      // Format: depth + " " + colour (e.g., "3" White")
      const depth = specs.depth || specs.return_depth || '';
      const colour = specs.colour || specs.color || '';
      return [depth, colour].filter(v => v).join(' ');

    case 'Face':
      // Format as {material} [{colour}] (swap order)
      const faceMaterial = specs.material || '';
      const faceColour = specs.colour || specs.color || '';
      if (faceMaterial && faceColour) {
        return `${faceMaterial} [${faceColour}]`;
      }
      return [faceMaterial, faceColour].filter(v => v).join(' ');

    case 'Drain Holes':
      // Format as {type} [{location}]
      const drainType = specs.type || specs.drain_type || '';
      const drainLocation = specs.location || '';
      if (drainType && drainLocation) {
        return `${drainType} [${drainLocation}]`;
      }
      return drainType || '';

    case 'LEDs':
      // Format as {color_temp} [{bin_code}] - {type}
      const ledType = specs.type || specs.led_type || '';
      const colorTemp = specs.color_temp || specs.colour_temp || '';
      const binCode = specs.bin_code || specs.bin || '';
      if (colorTemp && binCode && ledType) {
        return `${colorTemp} [${binCode}] - ${ledType}`;
      } else if (colorTemp && binCode) {
        return `${colorTemp} [${binCode}]`;
      }
      return [ledType, colorTemp, binCode].filter(v => v).join(' ');

    case 'Wire Length':
      // Add " ft" unit if not already present
      const wireLength = specs.length || specs.wire_length || '';
      const wireScope = specs.scope || '';
      const wireLengthWithUnit = wireLength && !String(wireLength).toLowerCase().includes('ft')
        ? `${wireLength} ft`
        : wireLength;

      if (wireLengthWithUnit && wireScope) {
        return `${wireLengthWithUnit} [${wireScope}]`;
      }
      return wireLengthWithUnit || '';

    case 'Power Supply':
      // Format as {model} [{scope}]
      const psModel = specs.model || specs.power_supply || '';
      const psScope = specs.scope || '';
      if (psModel && psScope) {
        return `${psModel} [${psScope}]`;
      }
      return psModel || '';

    case 'UL':
      // Format as {certification} - {details}
      const ulCert = specs.certification || specs.type || '';
      const ulDetails = specs.details || specs.ul_details || '';
      if (ulCert && ulDetails) {
        return `${ulCert} - ${ulDetails}`;
      }
      return ulCert || '';

    case 'Vinyl':
      // Format as {colours/vinyl_code} [{application}] (don't show size/yardage)
      const vinylCode = specs.colours || specs.vinyl_code || specs.code || '';
      const vinylApplication = specs.application || '';
      if (vinylCode && vinylApplication) {
        return `${vinylCode} [${vinylApplication}]`;
      }
      return vinylCode || '';

    case 'Painting':
      // Format as {colour} [{finish}]
      const paintColour = specs.colour || specs.color || '';
      const paintFinish = specs.finish || specs.sheen || '';
      if (paintColour && paintFinish) {
        return `${paintColour} [${paintFinish}]`;
      } else if (paintColour) {
        return paintColour;
      }
      return '';

    default:
      // Default: join all non-empty values with comma and space
      return Object.values(specs).filter(v => v !== null && v !== undefined && v !== '').join(', ');
  }
}

/**
 * Helper: Render specifications for parts (parent + sub-items combined)
 * Parses template-based specifications and formats them as rows
 * Returns the new Y position after rendering
 */
function renderSpecifications(
  doc: any,
  parts: any[], // Changed to accept array of parts
  x: number,
  startY: number,
  width: number
): number {
  debugLog('[PDF RENDER] ========== START renderSpecifications ==========');
  debugLog(`[PDF RENDER] Processing ${parts.length} parts`);

  let currentY = startY;

  // Extract template rows with their spec values from ALL parts
  // Use array instead of Map to preserve multiple rows with same template name
  const allTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }> = [];

  // Process each part (parent and sub-items)
  parts.forEach((part, partIndex) => {
    if (!part.specifications) return;

    try {
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      if (!specs || Object.keys(specs).length === 0) return;

      debugLog(`[PDF RENDER] Part ${partIndex + 1} specs: ` + JSON.stringify(specs, null, 2));

      // Find all template keys and collect their spec fields
      Object.keys(specs).forEach(key => {
        if (key.startsWith('_template_')) {
          const rowNum = key.replace('_template_', '');
          const templateName = specs[key];

          if (!templateName) return;

          // Collect all spec fields for this row (with named keys)
          const rowSpecs: Record<string, any> = {};

          Object.keys(specs).forEach(fieldKey => {
            if (fieldKey.startsWith(`row${rowNum}_`) && !fieldKey.startsWith('_')) {
              const fieldName = fieldKey.replace(`row${rowNum}_`, '');
              const value = specs[fieldKey];

              // Skip only empty/null/undefined values (but include boolean false)
              if (value !== null && value !== undefined && value !== '') {
                // First, format boolean values to Yes/No
                let formattedValue = formatBooleanValue(value);

                // Then clean up spec values (remove parenthetical details)
                const cleanedValue = cleanSpecValue(String(formattedValue).trim());

                if (cleanedValue) {
                  rowSpecs[fieldName] = cleanedValue;
                }
              }
            }
          });

          // Add as separate row (don't merge)
          allTemplateRows.push({
            template: templateName,
            rowNum: rowNum,
            specs: rowSpecs
          });

          debugLog(`[PDF RENDER] Added template row: ${templateName} (row ${rowNum}) with ${Object.keys(rowSpecs).length} fields`);
        }
      });
    } catch (e) {
      console.error(`Error processing part ${partIndex + 1} specifications:`, e);
    }
  });

  debugLog('[PDF RENDER] All template rows collected: ' + JSON.stringify(allTemplateRows, null, 2));

    // Sort template rows by SPEC_ORDER, then by row number
    const sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }> = [];

    // First, add rows in SPEC_ORDER
    for (const templateName of SPEC_ORDER) {
      const matchingRows = allTemplateRows.filter(row => row.template === templateName);
      matchingRows.forEach(row => sortedTemplateRows.push(row));

      // Add critical specs even if not in data
      if (matchingRows.length === 0 && (templateName === 'LEDs' || templateName === 'Power Supply' || templateName === 'UL')) {
        sortedTemplateRows.push({
          template: templateName,
          rowNum: '0',
          specs: {}
        });
      }
    }

    // Add any templates not in SPEC_ORDER at the end
    allTemplateRows.forEach(row => {
      if (!SPEC_ORDER.includes(row.template)) {
        sortedTemplateRows.push(row);
      }
    });

    // Render each template row
    doc.fontSize(10);
    sortedTemplateRows.forEach(row => {
      // Special handling for LEDs, Power Supply, and UL - always show them
      if (row.template === 'LEDs' || row.template === 'Power Supply' || row.template === 'UL') {
        const valueStr = Object.keys(row.specs).length > 0 ? formatSpecValues(row.template, row.specs) : 'No';

        const labelText = `${row.template}:`;
        doc.font('Helvetica-Bold');
        const labelWidth = doc.widthOfString(labelText);
        const labelHeight = doc.currentLineHeight();

        // Draw lighter gray background behind label
        const bgPadding = 2;
        doc.fillColor('#d8d8d8')
          .rect(x - bgPadding, currentY - 2, labelWidth + (bgPadding * 2), labelHeight + 3)
          .fill();

        // Reset to black and render label + value
        doc.fillColor('#000000')
          .font('Helvetica-Bold')
          .text(`${labelText}  `, x, currentY, {
            continued: true,
            width: width
          });
        doc.font('Helvetica').text(valueStr, {
          width: width,
          lineBreak: true
        });
        currentY = doc.y + 3;
      } else if (Object.keys(row.specs).length > 0) {
        // For other templates, only show if there are values
        const valueStr = formatSpecValues(row.template, row.specs);

        const labelText = `${row.template}:`;
        doc.font('Helvetica-Bold');
        const labelWidth = doc.widthOfString(labelText);
        const labelHeight = doc.currentLineHeight();

        // Draw lighter gray background behind label (just to the colon) - with extra padding
        const bgPadding = 2;
        doc.fillColor('#d8d8d8')
          .rect(x - bgPadding, currentY - 2, labelWidth + (bgPadding * 2), labelHeight + 3)
          .fill();

        // Reset to black and render label + value
        doc.fillColor('#000000')
          .font('Helvetica-Bold')
          .text(`${labelText}  `, x, currentY, {
            continued: true,
            width: width
          });
        doc.font('Helvetica').text(valueStr, {
          width: width,
          lineBreak: true
        });
        currentY = doc.y + 3;
      }
      // Don't render label if no values - skip empty templates (except LEDs, Power Supply, UL)
    });

    return currentY;
}

/**
 * Generate Master Order Form (Compact Layout)
 * @param orderData - Order data for PDF generation
 * @param outputPath - Full path including filename (e.g., "/path/to/200049 - Job Name - Order Form.pdf")
 */
export async function generateMasterForm(
  orderData: OrderDataForPDF,
  outputPath: string
): Promise<string> {
  // Write to a test file to prove this function runs
  fs.writeFileSync('/tmp/pdf-generation-test.txt', `MASTER FORM CALLED at ${new Date().toISOString()} for order ${orderData.order_number}\n`, { flag: 'a' });

  console.log('>>>>>>>>>>> MASTER FORM GENERATION STARTED <<<<<<<<<<<<');
  console.log(`Order Number: ${orderData.order_number}`);
  console.log(`Total Parts: ${orderData.parts.length}`);
  debugLog(`[MASTER FORM] Starting generation for order ${orderData.order_number}`);
  debugLog(`[MASTER FORM] Total parts: ${orderData.parts.length}`);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const marginLeft = 20;
      const marginRight = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let currentY = 20;

      // ============================================
      // COMPACT HEADER WITH INFO
      // ============================================

      // Left side: "Sign House Inc." / "Order Form" vertically spanning 2 rows
      const titleWidth = 120;
      const infoStartX = marginLeft + titleWidth + 15;

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Sign House Inc.', marginLeft, currentY);
      doc.text('Order Form', marginLeft, currentY + 18);

      // Right side info columns
      const col1X = infoStartX;
      const col2X = infoStartX + (contentWidth - titleWidth - 15) * 0.35;
      const col3X = infoStartX + (contentWidth - titleWidth - 15) * 0.68;

      doc.fontSize(10).font('Helvetica-Bold');

      // Row 1: Order # | Customer
      doc.font('Helvetica-Bold').text('Order #:', col1X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${orderData.order_number}`);

      doc.font('Helvetica-Bold').text('Customer:', col2X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${orderData.company_name}`);
      currentY += 13;

      // Row 2: Job name | Customer PO# | Customer Job #
      doc.font('Helvetica-Bold').text('Job:', col1X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${orderData.order_name}`);

      // Always show Customer PO# (blank if no value)
      doc.font('Helvetica-Bold').text('Customer PO#:', col2X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${orderData.customer_po || ''}`);

      // Always show Customer Job # (blank if no value)
      doc.font('Helvetica-Bold').text('Customer Job #:', col3X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${orderData.customer_job_number || ''}`)
      currentY += 13;

      // Row 3: Order Date | Due Date (with time) | Delivery
      const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      doc.font('Helvetica-Bold').text('Order Date:', col1X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${orderDateStr}`);

      // Due Date with time - RED AND BOLD if hard deadline
      if (orderData.due_date) {
        const dueDate = new Date(orderData.due_date);
        let dueDateStr = dueDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        // Add time if hard_due_date_time exists (TIME format "HH:mm" or "HH:mm:ss")
        if (orderData.hard_due_date_time) {
          // Parse TIME string and convert to 12-hour format
          const timeParts = orderData.hard_due_date_time.split(':');
          const hours = parseInt(timeParts[0], 10);
          const minutes = timeParts[1];
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
          const timeStr = `${displayHours}:${minutes} ${period}`;
          dueDateStr += ` ${timeStr}`;
        }

        // If hard deadline, make entire date+time RED and BOLD
        if (orderData.hard_due_date_time) {
          doc.font('Helvetica-Bold').fillColor('#cc0000').text('Due:', col2X, currentY, { continued: true });
          doc.font('Helvetica-Bold').text(` ${dueDateStr}`);
          doc.fillColor('#000000');
        } else {
          doc.font('Helvetica-Bold').fillColor('#000000').text('Due:', col2X, currentY, { continued: true });
          doc.font('Helvetica').text(` ${dueDateStr}`);
        }
      }

      // Delivery in right column
      const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
      doc.font('Helvetica-Bold').text('Delivery:', col3X, currentY, { continued: true });
      doc.font('Helvetica').text(` ${shippingText}`);
      currentY += 13;

      currentY += 2; // Small space before divider

      // Divider - thicker line
      doc.strokeColor('#999999').lineWidth(1.5)
        .moveTo(marginLeft, currentY)
        .lineTo(pageWidth - marginRight, currentY)
        .stroke();
      currentY += 12;

      // ============================================
      // MAIN CONTENT AREA - STACKED LAYOUT
      // ============================================
      const contentStartY = currentY;
      const pageHeight = doc.page.height;
      const availableHeight = pageHeight - contentStartY - 15;

      // Calculate column layout for parts - 3 columns spanning full width
      const numParts = orderData.parts.length;
      const numColumns = Math.min(numParts, 3); // Max 3 columns
      const columnWidth = contentWidth / numColumns; // Parts take full width split into 3 columns

      // Parts section height - allocate 35% of available height
      const partsHeight = availableHeight * 0.35;

      // Image section below parts - takes remaining space
      const imageStartY = contentStartY + partsHeight + 10;
      const imageWidth = contentWidth * 0.95;
      const imageHeight = availableHeight - partsHeight - 15;

      debugLog(`[LAYOUT] Page dimensions: ${pageWidth} x ${pageHeight}`);
      debugLog(`[LAYOUT] contentStartY: ${contentStartY}, availableHeight: ${availableHeight}`);
      debugLog(`[LAYOUT] partsHeight (35%): ${partsHeight}`);
      debugLog(`[LAYOUT] Image area - Y: ${imageStartY}, Width: ${imageWidth}, Height: ${imageHeight}`);

      // Draw parts in columns - 1 part per column
      // Group parts: parent items get their own column with sub-items appended
      const partColumns: Array<{ parent: any; subItems: any[] }> = [];

      console.log('[Master Form PDF] Total parts:', orderData.parts.length);

      orderData.parts.forEach((part, index) => {
        // Skip parts with no meaningful specification data
        const hasDisplayName = part.specs_display_name && part.specs_display_name.trim();

        // Check if part has any specification templates (handle both object and JSON string)
        let hasSpecTemplates = false;
        if (part.specifications) {
          try {
            const specs = typeof part.specifications === 'string'
              ? JSON.parse(part.specifications)
              : part.specifications;

            console.log(`[Master Form PDF] Part ${index + 1} specifications:`, JSON.stringify(specs));
            const templateKeys = Object.keys(specs).filter(key => key.startsWith('_template_'));
            console.log(`[Master Form PDF] Part ${index + 1} template keys:`, templateKeys);

            hasSpecTemplates = specs &&
              Object.keys(specs).some(key => key.startsWith('_template_') && specs[key]);
          } catch (e) {
            hasSpecTemplates = false;
          }
        }

        console.log(`[Master Form PDF] Part ${index + 1} hasDisplayName=${hasDisplayName}, hasSpecTemplates=${hasSpecTemplates}, specs_display_name="${part.specs_display_name}"`);

        // Show part only if it has a display name OR has specification templates
        if (!hasDisplayName && !hasSpecTemplates) {
          console.log(`[Master Form PDF] ✓ SKIPPING empty part ${index + 1} (no display name or spec templates)`);
          return; // Skip this part
        }

        console.log(`[Master Form PDF] ✓ INCLUDING part ${index + 1}`);

        // Determine if this is a sub-item (display_number contains letter like "1a", "1b")
        const hasLetterInDisplayNumber = part.display_number ? /[a-zA-Z]/.test(part.display_number) : false;

        // A part should start a new column if:
        // 1. It's marked as a parent (is_parent = true), OR
        // 2. It has no letter in display_number (like "1", "2", "3" instead of "1a", "2b")
        const shouldStartNewColumn = part.is_parent || !hasLetterInDisplayNumber;

        console.log(`[Master Form PDF] Part ${index + 1}:`, {
          display_number: part.display_number,
          is_parent: part.is_parent,
          product_type: part.product_type,
          specs_display_name: part.specs_display_name,
          quantity: part.quantity,
          hasLetterInDisplayNumber,
          shouldStartNewColumn
        });

        if (shouldStartNewColumn) {
          // This is a parent or regular base item - create new column
          partColumns.push({ parent: part, subItems: [] });
          console.log(`[Master Form PDF] Created column ${partColumns.length} for:`, part.specs_display_name || part.product_type);
        } else {
          // This is a sub-item - find the matching parent column by display number prefix
          // E.g., "1a" should match with parent "1", "2b" should match with parent "2"
          const parentNumber = part.display_number?.replace(/[a-zA-Z]/g, '');
          const matchingColumn = partColumns.find(col => col.parent.display_number === parentNumber);

          if (matchingColumn) {
            matchingColumn.subItems.push(part);
            console.log(`[Master Form PDF] Added sub-item to column (matched by number ${parentNumber}):`, part.specs_display_name || part.product_type);
          } else if (partColumns.length > 0) {
            // Fallback: append to last column if no match found
            partColumns[partColumns.length - 1].subItems.push(part);
            console.log(`[Master Form PDF] Added sub-item to last column (fallback):`, part.specs_display_name || part.product_type);
          }
        }
      });

      console.log(`[Master Form PDF] Final column count: ${partColumns.length}`);

      // Track the maximum Y position across all columns
      let maxPartY = contentStartY;

      // Render each column
      partColumns.forEach((column, columnIndex) => {
        if (columnIndex >= 3) return; // Max 3 columns visible

        const partX = marginLeft + (columnIndex * columnWidth) + 5;
        const partColumnWidth = columnWidth - 10;
        let partY = contentStartY;

        // Render parent item
        const parent = column.parent;

        // Get specs_qty from specifications, fallback to invoice quantity, then 0
        let specsQty = 0;
        try {
          const specs = typeof parent.specifications === 'string'
            ? JSON.parse(parent.specifications)
            : parent.specifications;
          specsQty = specs?.specs_qty ?? parent.quantity ?? 0;
        } catch {
          specsQty = parent.quantity ?? 0;
        }

        // Display name (use specs_display_name, fallback to product_type)
        const displayName = parent.specs_display_name || parent.product_type;
        doc.fontSize(12).font('Helvetica-Bold');
        const textWidth = doc.widthOfString(displayName);

        // Product type without box
        doc.text(displayName, partX, partY, {
          width: partColumnWidth * 0.6,
          lineBreak: false,
          ellipsis: true
        });

        // Quantity - inline to the right, WITH BOX
        const qtyX = partX + textWidth + 12;
        const qtyValue = Number(specsQty);
        const isNonStandard = qtyValue !== 1 && qtyValue !== 1.0;

        // Style based on quantity
        if (isNonStandard) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#cc0000');
        } else {
          doc.fontSize(9).font('Helvetica').fillColor('#000000');
        }

        const qtyText = `Qty: ${specsQty}`;
        const qtyTextWidth = doc.widthOfString(qtyText);
        const qtyBoxPadding = 3;

        // Draw box around quantity
        doc.rect(qtyX, partY - 1, qtyTextWidth + (qtyBoxPadding * 2), 14)
          .stroke();

        doc.text(qtyText, qtyX + qtyBoxPadding, partY + 1, { width: partColumnWidth * 0.3 });

        // Reset color
        doc.fillColor('#000000');

        partY += 16;

        // Draw horizontal separator line between header and specs
        doc.strokeColor('#cccccc').lineWidth(0.5)
          .moveTo(partX, partY)
          .lineTo(partX + partColumnWidth, partY)
          .stroke();
        doc.strokeColor('#000000'); // Reset stroke color

        partY += 3;

        // Collect all parts (parent + sub-items) for combined rendering
        const allParts = [parent, ...column.subItems];
        debugLog(`[CALL RENDER] Calling renderSpecifications for column with ${allParts.length} parts`);

        // Render all specifications together (parent + sub-items combined and sorted)
        partY = renderSpecifications(doc, allParts, partX, partY, partColumnWidth);

        // Track the maximum Y position
        if (partY > maxPartY) {
          maxPartY = partY;
        }
      });

      debugLog(`[LAYOUT] Actual parts ended at Y: ${maxPartY}`);

      // ============================================
      // IMAGE SECTION (BOTTOM)
      // ============================================
      if (orderData.sign_image_path && orderData.folder_name && orderData.folder_location !== 'none') {
        try {
          // Construct full image path from folder + filename
          // SMB mount paths (matching orderFolderService logic)
          const SMB_ROOT = '/mnt/channelletter';
          const ORDERS_FOLDER = 'Orders';
          const FINISHED_FOLDER = '1Finished';

          let folderPath: string;
          if (orderData.is_migrated) {
            // Legacy orders: use old paths (root or root/1Finished)
            folderPath = orderData.folder_location === 'active'
              ? SMB_ROOT
              : path.join(SMB_ROOT, FINISHED_FOLDER);
          } else {
            // New app-created orders: use Orders subfolder
            folderPath = orderData.folder_location === 'active'
              ? path.join(SMB_ROOT, ORDERS_FOLDER)
              : path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER);
          }

          const fullImagePath = path.join(folderPath, orderData.folder_name, orderData.sign_image_path);

          debugLog(`[IMAGE] Attempting to load image: ${fullImagePath}`);

          if (fs.existsSync(fullImagePath)) {
            // Calculate actual available space for image
            const actualImageStartY = maxPartY + 15; // 15px spacing after parts
            const actualImageHeight = pageHeight - actualImageStartY - 20; // 20px bottom margin

            debugLog(`[IMAGE] Actual image Y: ${actualImageStartY}, Height: ${actualImageHeight}`);

            // Only draw if there's enough space (at least 100px)
            if (actualImageHeight > 100) {
              // Draw separator line above notes/image section
              doc.strokeColor('#cccccc').lineWidth(0.5)
                .moveTo(marginLeft, actualImageStartY - 5)
                .lineTo(pageWidth - marginRight, actualImageStartY - 5)
                .stroke();

              let notesY = actualImageStartY;

              // Two-column layout for Special Instructions (left) and Internal Notes (right)
              const notesColumnWidth = contentWidth * 0.48;
              const notesLeftX = marginLeft;
              const notesRightX = marginLeft + contentWidth * 0.52;

              // Special Instructions (left side) - NO LABEL, just larger text
              if (orderData.manufacturing_note) {
                doc.fontSize(10).font('Helvetica');
                doc.text(orderData.manufacturing_note, notesLeftX, notesY, {
                  width: notesColumnWidth,
                  lineBreak: true
                });
              }

              // Internal Notes (right side) - Keep label bold
              if (orderData.internal_note) {
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('[Internal Note] ', notesRightX, notesY, { continued: true });
                doc.fontSize(10).font('Helvetica');
                doc.text(orderData.internal_note, {
                  width: notesColumnWidth,
                  lineBreak: true
                });
              }

              // Calculate space used by notes
              const notesHeight = Math.max(
                orderData.manufacturing_note ? doc.heightOfString(orderData.manufacturing_note, { width: notesColumnWidth }) + 15 : 0,
                orderData.internal_note ? doc.heightOfString(orderData.internal_note, { width: notesColumnWidth }) + 15 : 0
              );

              // Center the image below the notes
              const imageY = notesY + notesHeight + 5;
              const imageX = marginLeft + (contentWidth - imageWidth) / 2;
              const adjustedImageHeight = actualImageHeight - notesHeight - 5;

              if (adjustedImageHeight > 50) {
                // Use original image (crop functionality removed)
                doc.image(fullImagePath, imageX, imageY, {
                  fit: [imageWidth, adjustedImageHeight],
                  align: 'center'
                });
                debugLog(`[IMAGE] ✅ Successfully loaded image`);
              } else {
                debugLog(`[IMAGE] ⚠️ Not enough space for image after notes (only ${adjustedImageHeight}px available)`);
              }
            } else {
              debugLog(`[IMAGE] ⚠️ Not enough space for image (only ${actualImageHeight}px available)`);
            }
          } else {
            debugLog(`[IMAGE] ⚠️ Image file not found: ${fullImagePath}`);
          }
        } catch (error) {
          console.error('Error loading sign image:', error);
        }
      }

      // Notes can be overlaid on image if needed, or we skip them for cleaner layout

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
