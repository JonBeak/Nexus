/**
 * Unified Order Form Generator
 * Generates Master, Customer, and Shop order forms from a single template
 *
 * Form Types:
 * - master: Complete internal form with all details
 * - customer: Customer-facing form (removes internal notes, simplifies LED/Power Supply)
 * - shop: Production floor form (removes customer details, 2-row header)
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

export type FormType = 'master' | 'customer' | 'shop';

// ============================================
// CONSTANTS
// ============================================

const COLORS = {
  BLACK: '#000000',
  WHITE: '#ffffff',
  DARK_GRAY: '#333333',
  URGENT_RED: '#cc0000',
  LABEL_BACKGROUND: '#c0c0c0',
  DIVIDER_LIGHT: '#cccccc',
  DIVIDER_DARK: '#999999',
  QTY_STANDARD_BG: '#e8e8e8',      // Gray background for qty=1
  QTY_STANDARD_TEXT: '#000000',    // Black text for qty=1
  QTY_NONSTANDARD_BG: '#cc0000',   // Red background for qty≠1
  QTY_NONSTANDARD_TEXT: '#ffffff', // White text for qty≠1
};

const FONT_SIZES = {
  TITLE: 14,
  HEADER_VALUE: 13,
  SPEC_BODY: 12,
  HEADER_LABEL: 10,
  SCOPE: 11,
  QTY_NONSTANDARD: 13,
  INTERNAL_NOTE: 12,
  QTY_STANDARD: 11,
  INTERNAL_NOTE_LABEL: 9,
};

const SPACING = {
  PAGE_MARGIN: 20,
  SECTION_GAP: 12,
  HEADER_ROW: 16,
  HEADER_START_OFFSET: 4,
  AFTER_TITLE: 16,
  AFTER_SCOPE: 14,
  AFTER_SEPARATOR: 8,
  AFTER_PRODUCT_NAME: 18,
  BEFORE_DIVIDER: 3,
  ITEM_GAP: 5,
  SPEC_ROW_GAP: 3,
  LABEL_PADDING: 2,
  QTY_BOX_PADDING: 3,
  IMAGE_AFTER_PARTS: 8,
  IMAGE_BOTTOM_MARGIN: 20,
  HEADER_VALUE_RAISE: 2,
  HEADER_LABEL_TO_VALUE: 6,
};

const LAYOUT = {
  TITLE_WIDTH: 120,
  TITLE_DIVIDER_OFFSET: 7.5,
  TITLE_INFO_GAP: 25,
  DIVIDER_HEIGHT: 40,
  COL2_PERCENT: 0.35,
  COL3_PERCENT: 0.68,
  PARTS_HEIGHT_PERCENT: 0.35,
  IMAGE_WIDTH_PERCENT: 0.95,
  NOTES_LEFT_WIDTH_PERCENT: 0.48,
  NOTES_RIGHT_START_PERCENT: 0.52,
  PART_COLUMN_INNER_PADDING: 5,
  PART_NAME_WIDTH_PERCENT: 0.6,
  QTY_BOX_WIDTH_PERCENT: 0.3,
  MAX_COLUMNS: 3,
  MIN_IMAGE_HEIGHT: 100,
  MIN_ADJUSTED_IMAGE_HEIGHT: 50,
};

const LINE_WIDTHS = {
  DIVIDER_MAIN: 1.5,
  DIVIDER_LIGHT: 0.5,
  VERTICAL_DIVIDER: 1,
};

const SMB_PATHS = {
  ROOT: '/mnt/channelletter',
  ORDERS_FOLDER: 'Orders',
  FINISHED_FOLDER: '1Finished',
};

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
] as const;

const CRITICAL_SPECS = ['LEDs', 'Power Supply', 'UL'] as const;

// Specs display names that DO NOT require mandatory LEDs/PS/UL
const SPECS_EXEMPT_FROM_CRITICAL = [
  'Trim Cap',
  'Vinyl Cut',
  'Vinyl',
  'Frame',
  'Custom',
  'Aluminum Raceway',
  'Extrusion Raceway',
  'Material Cut'
] as const;

// ============================================
// HELPER FUNCTIONS - Utilities
// ============================================

function debugLog(message: string) {
  console.log(`======================== PDF DEBUG ========================`);
  console.log(message);
  console.log(`===========================================================`);
}

/**
 * Format boolean values to Yes/No
 */
function formatBooleanValue(value: any): string {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  return String(value);
}

/**
 * Clean up spec values (remove parenthetical details)
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
 * Format due date with optional time
 */
function formatDueDateTime(dueDate: Date, hardDueTime?: string): string {
  let dateStr = dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Add time if hard_due_date_time exists (TIME format "HH:mm" or "HH:mm:ss")
  if (hardDueTime) {
    const timeParts = hardDueTime.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes} ${period}`;
    dateStr += ` ${timeStr}`;
  }

  return dateStr;
}

/**
 * Format spec values based on template name using named keys
 */
function formatSpecValues(templateName: string, specs: Record<string, any>, formType: FormType): string {
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
      // Template stores: include (boolean), size (combobox)
      // Format as Yes/No, or Yes [size] if size is specified
      const drainInclude = formatBooleanValue(specs.include);
      const drainSize = specs.size || '';
      if (drainInclude === 'Yes' && drainSize) {
        return `${drainInclude} [${drainSize}]`;
      }
      return drainInclude || '';

    case 'LEDs':
      // Customer form: Yes/No only
      if (formType === 'customer') {
        return Object.keys(specs).length > 0 ? 'Yes' : 'No';
      }
      // Master/Shop: Format as {count} [{led_type}]
      // Template stores: count, led_type (full string), note
      const ledCount = specs.count || '';
      let ledType = specs.type || specs.led_type || '';

      // Shorten LED type: keep only part before " - "
      if (ledType && ledType.includes(' - ')) {
        ledType = ledType.split(' - ')[0].trim();
      }

      if (ledCount && ledType) {
        return `${ledCount} [${ledType}]`;
      } else if (ledCount) {
        return ledCount;
      } else if (ledType) {
        return ledType;
      }
      return '';

    case 'Wire Length':
      // Add " ft" unit if not already present
      const wireLength = specs.length || specs.wire_length || '';
      const wireGauge = specs.wire_gauge || '';
      const wireLengthWithUnit = wireLength && !String(wireLength).toLowerCase().includes('ft')
        ? `${wireLength} ft`
        : wireLength;

      if (wireLengthWithUnit && wireGauge) {
        return `${wireLengthWithUnit} [${wireGauge}]`;
      }
      return wireLengthWithUnit || '';

    case 'Power Supply':
      // Customer form: Yes/No only
      if (formType === 'customer') {
        return Object.keys(specs).length > 0 ? 'Yes' : 'No';
      }
      // Master/Shop: Format as {count} [{ps_type}]
      // Template stores: count, ps_type (full string), note
      const psCount = specs.count || '';
      let psType = specs.ps_type || specs.model || specs.power_supply || '';

      // Shorten PS type: keep only part before " ("
      if (psType && psType.includes(' (')) {
        psType = psType.split(' (')[0].trim();
      }

      if (psCount && psType) {
        return `${psCount} [${psType}]`;
      } else if (psCount) {
        return psCount;
      } else if (psType) {
        return psType;
      }
      return '';

    case 'UL':
      // Template stores: include (boolean), note (textbox)
      // Format as Yes/No, or Yes - note if note is specified
      const ulInclude = formatBooleanValue(specs.include);
      const ulNote = specs.note || '';
      if (ulInclude === 'Yes' && ulNote) {
        return `${ulInclude} - ${ulNote}`;
      }
      return ulInclude || '';

    case 'Vinyl':
      // Format as {colours/vinyl_code} [{application}] (don't show size/yardage)
      const vinylCode = specs.colours || specs.vinyl_code || specs.code || '';
      const vinylApplication = specs.application || '';
      if (vinylCode && vinylApplication) {
        return `${vinylCode} [${vinylApplication}]`;
      }
      return vinylCode || '';

    case 'Digital Print':
      // Template stores: colour, type, application
      // Format as {colour} - {type} [{application}]
      const dpColour = specs.colour || specs.color || '';
      const dpType = specs.type || '';
      const dpApplication = specs.application || '';

      if (dpColour && dpType && dpApplication) {
        return `${dpColour} - ${dpType} [${dpApplication}]`;
      } else if (dpColour && dpType) {
        return `${dpColour} - ${dpType}`;
      } else if (dpColour) {
        return dpColour;
      }
      return [dpType, dpApplication].filter(v => v).join(' ');

    case 'Painting':
      // Template stores: colour, component, timing
      // Format as {colour} [{component}] (ignore timing)
      const paintColour = specs.colour || specs.color || '';
      const paintComponent = specs.component || '';
      if (paintColour && paintComponent) {
        return `${paintColour} [${paintComponent}]`;
      } else if (paintColour) {
        return paintColour;
      }
      return '';

    case 'Material':
      // Template stores: substrate, colour
      // Format as {colour} - {substrate}
      const matColour = specs.colour || specs.color || '';
      const substrate = specs.substrate || '';
      if (matColour && substrate) {
        return `${matColour} - ${substrate}`;
      }
      return [matColour, substrate].filter(v => v).join(' ');

    case 'Box Material':
      // Template stores: material, colour
      // Format as {colour} - {material}
      const boxColour = specs.colour || specs.color || '';
      const boxMaterial = specs.material || '';
      if (boxColour && boxMaterial) {
        return `${boxColour} - ${boxMaterial}`;
      }
      return [boxColour, boxMaterial].filter(v => v).join(' ');

    case 'Push Thru Acrylic':
      // Template stores: thickness, colour
      // Format as {thickness} - {colour}
      const ptThickness = specs.thickness || '';
      const ptColour = specs.colour || specs.color || '';
      if (ptThickness && ptColour) {
        return `${ptThickness} - ${ptColour}`;
      }
      return [ptThickness, ptColour].filter(v => v).join(' ');

    case 'Neon Base':
      // Template stores: thickness, material, colour
      // Format as {thickness} {colour} {material}
      const neonBaseThickness = specs.thickness || '';
      const neonBaseMaterial = specs.material || '';
      const neonBaseColour = specs.colour || specs.color || '';
      return [neonBaseThickness, neonBaseColour, neonBaseMaterial].filter(v => v).join(' ');

    case 'Neon LED':
      // Template stores: stroke_width, colour
      // Format as {stroke_width} - {colour}
      const strokeWidth = specs.stroke_width || '';
      const neonColour = specs.colour || specs.color || '';
      if (strokeWidth && neonColour) {
        return `${strokeWidth} - ${neonColour}`;
      }
      return [strokeWidth, neonColour].filter(v => v).join(' ');

    case 'D-Tape':
      // Template stores: include (boolean), thickness
      // Format as {include} - {thickness}
      const dtInclude = formatBooleanValue(specs.include);
      const dtThickness = specs.thickness || '';
      if (dtInclude && dtThickness) {
        return `${dtInclude} - ${dtThickness}`;
      }
      return dtInclude || '';

    case 'Pins':
      // Template stores: count, pins, spacers
      // Format as [{count} pcs] {pins} + {spacers}
      // Pins or Spacers are optional
      const pinCount = specs.count || '';
      const pinType = specs.pins || '';
      const spacerType = specs.spacers || '';

      const pinsParts: string[] = [];
      if (pinCount) {
        pinsParts.push(`[${pinCount} pcs]`);
      }

      const components: string[] = [];
      if (pinType) components.push(pinType);
      if (spacerType) components.push(spacerType);

      if (components.length > 0) {
        pinsParts.push(components.join(' + '));
      }

      return pinsParts.join(' ');

    default:
      // Default: join all non-empty values with comma and space
      return Object.values(specs).filter(v => v !== null && v !== undefined && v !== '').join(', ');
  }
}

/**
 * Check if part should be included in PDF
 */
function shouldIncludePart(part: any, formType: FormType): boolean {
  const hasDisplayName = part.specs_display_name && part.specs_display_name.trim();

  // Check if part has any specification templates
  let hasSpecTemplates = false;
  if (part.specifications) {
    try {
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      hasSpecTemplates = specs &&
        Object.keys(specs).some(key => key.startsWith('_template_') && specs[key]);
    } catch (e) {
      hasSpecTemplates = false;
    }
  }

  return hasDisplayName || hasSpecTemplates;
}

/**
 * Check if part should start a new column
 */
function shouldStartNewColumn(part: any): boolean {
  return Boolean(part.is_parent);
}

/**
 * Get image full path from order data
 */
function getImageFullPath(orderData: OrderDataForPDF): string | null {
  if (!orderData.sign_image_path || !orderData.folder_name || orderData.folder_location === 'none') {
    return null;
  }

  let folderPath: string;
  if (orderData.is_migrated) {
    // Legacy orders: use old paths (root or root/1Finished)
    folderPath = orderData.folder_location === 'active'
      ? SMB_PATHS.ROOT
      : path.join(SMB_PATHS.ROOT, SMB_PATHS.FINISHED_FOLDER);
  } else {
    // New app-created orders: use Orders subfolder
    folderPath = orderData.folder_location === 'active'
      ? path.join(SMB_PATHS.ROOT, SMB_PATHS.ORDERS_FOLDER)
      : path.join(SMB_PATHS.ROOT, SMB_PATHS.ORDERS_FOLDER, SMB_PATHS.FINISHED_FOLDER);
  }

  return path.join(folderPath, orderData.folder_name, orderData.sign_image_path);
}

// ============================================
// HELPER FUNCTIONS - Rendering
// ============================================

/**
 * Render specifications for parts (parent + sub-items combined)
 */
function renderSpecifications(
  doc: any,
  parts: any[],
  x: number,
  startY: number,
  width: number,
  formType: FormType
): number {
  debugLog('[PDF RENDER] ========== START renderSpecifications ==========');
  debugLog(`[PDF RENDER] Processing ${parts.length} parts for ${formType} form`);

  let currentY = startY;

  // Determine if LEDs/PS/UL should be mandatory for this part
  // Get specs_display_name from the first part (parent or regular)
  const specsDisplayName = parts.length > 0 ? parts[0].specs_display_name : null;
  const isExemptFromCritical = specsDisplayName && SPECS_EXEMPT_FROM_CRITICAL.includes(specsDisplayName as any);
  debugLog(`[PDF RENDER] Specs Display Name: ${specsDisplayName}, Exempt from critical: ${isExemptFromCritical}`);

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

    // Add critical specs even if not in data (unless this part is exempt)
    const isCritical = CRITICAL_SPECS.includes(templateName as any);
    if (matchingRows.length === 0 && isCritical && !isExemptFromCritical) {
      sortedTemplateRows.push({
        template: templateName,
        rowNum: '0',
        specs: {}
      });
    }
  }

  // Add any templates not in SPEC_ORDER at the end
  allTemplateRows.forEach(row => {
    if (!SPEC_ORDER.includes(row.template as any)) {
      sortedTemplateRows.push(row);
    }
  });

  // Render each template row
  doc.fontSize(FONT_SIZES.SPEC_BODY);
  sortedTemplateRows.forEach(row => {
    const isCriticalSpec = CRITICAL_SPECS.includes(row.template as any) && !isExemptFromCritical;

    // Critical specs: always show them (unless exempt)
    if (isCriticalSpec) {
      const valueStr = formatSpecValues(row.template, row.specs, formType) || 'No';
      currentY = renderSpecRow(doc, row.template, valueStr, x, currentY, width);
    } else if (Object.keys(row.specs).length > 0) {
      // Other specs: only show if there are values
      const valueStr = formatSpecValues(row.template, row.specs, formType);
      currentY = renderSpecRow(doc, row.template, valueStr, x, currentY, width);
    }
  });

  return currentY;
}

/**
 * Render a single spec row with label and value
 */
function renderSpecRow(
  doc: any,
  label: string,
  value: string,
  x: number,
  currentY: number,
  width: number
): number {
  const labelText = `${label}:`;

  // Label: 11pt (1pt smaller)
  doc.fontSize(11).font('Helvetica-Bold');
  const labelWidth = doc.widthOfString(labelText);
  const labelHeight = doc.currentLineHeight();

  // Calculate gray background dimensions
  const grayBoxStartY = currentY - 2;
  const grayBoxHeight = labelHeight + 3;
  const grayBoxEndY = grayBoxStartY + grayBoxHeight; // = currentY + labelHeight + 1

  // Draw gray background behind label
  doc.fillColor(COLORS.LABEL_BACKGROUND)
    .rect(
      x - SPACING.LABEL_PADDING,
      grayBoxStartY,
      labelWidth + (SPACING.LABEL_PADDING * 2),
      grayBoxHeight
    )
    .fill();

  // Render label (11pt)
  doc.fillColor(COLORS.BLACK)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`${labelText}  `, x, currentY, {
      continued: false,
      width: width,
      lineBreak: false
    });

  // Calculate value position (after label, raised 1pt)
  const valueX = x + labelWidth + doc.widthOfString('  ');
  const valueY = currentY - 1;  // Raise value by 1pt

  // Calculate value height (13pt font, can wrap)
  doc.fontSize(13).font('Helvetica');
  const valueLineHeight = doc.currentLineHeight();

  let valueHeight = 0;
  if (value && value.trim()) {
    // Only calculate height if there's actual text
    valueHeight = doc.heightOfString(value, {
      width: width - (valueX - x),
      lineBreak: true
    });
  }

  // Use at least one line height for spacing (even if value is empty)
  const effectiveValueHeight = Math.max(valueHeight, valueLineHeight);

  // Render value (even if empty)
  doc.text(value, valueX, valueY, {
    width: width - (valueX - x),
    lineBreak: true
  });

  // Calculate actual bottom positions
  // Gray box (label background) ends at: currentY + labelHeight + 1
  // Value ends at: (currentY - 1) + effectiveValueHeight = currentY + effectiveValueHeight - 1
  const labelVisualBottom = grayBoxEndY;
  const valueBottom = valueY + effectiveValueHeight;
  const rowBottom = Math.max(labelVisualBottom, valueBottom);

  return rowBottom + SPACING.SPEC_ROW_GAP;
}

/**
 * Render compact header with order information
 */
function renderCompactHeader(
  doc: any,
  orderData: OrderDataForPDF,
  formType: FormType,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  startY: number
): number {
  const headerStartY = startY;
  let currentY = startY + SPACING.HEADER_START_OFFSET;

  // Right side info columns
  const infoStartX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_INFO_GAP;
  const col1X = infoStartX;
  const col2X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL2_PERCENT;
  const col3X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL3_PERCENT;

  // Calculate baseline alignment offset - raise larger font up 2pts
  const baselineOffset = 0; // Labels and values now aligned at top, with values raised 2pts below

  // Render header rows first to get the total height
  if (formType === 'shop') {
    currentY = renderShopHeader(doc, orderData, col1X, col2X, col3X, currentY, baselineOffset);
  } else {
    currentY = renderMasterCustomerHeader(doc, orderData, col1X, col2X, col3X, currentY, baselineOffset, formType);
  }

  currentY += SPACING.BEFORE_DIVIDER;

  // Calculate total header content height
  const headerContentHeight = currentY - headerStartY;

  // Title text height: two lines of 14pt text with 18pt spacing = ~32pt total
  const titleHeight = 32;

  // Calculate vertical center offset for title
  const titleVerticalOffset = (headerContentHeight - titleHeight) / 2;

  // Now render the left side title, vertically centered
  const titleY = headerStartY + titleVerticalOffset;
  doc.fontSize(FONT_SIZES.TITLE).font('Helvetica-Bold');
  doc.text('Sign House Inc.', marginLeft, titleY);
  doc.text('Order Form', marginLeft, titleY + 18);

  // Draw vertical divider between title and info columns
  const dividerX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_DIVIDER_OFFSET;
  doc.strokeColor(COLORS.DIVIDER_DARK)
    .lineWidth(LINE_WIDTHS.VERTICAL_DIVIDER)
    .moveTo(dividerX, headerStartY)
    .lineTo(dividerX, currentY)
    .stroke();

  // Horizontal divider - thicker line
  doc.strokeColor(COLORS.DIVIDER_DARK)
    .lineWidth(LINE_WIDTHS.DIVIDER_MAIN)
    .moveTo(marginLeft, currentY)
    .lineTo(pageWidth - marginRight, currentY)
    .stroke();

  doc.strokeColor(COLORS.BLACK);

  return currentY + SPACING.SECTION_GAP;
}

/**
 * Render a header label with background
 */
function renderHeaderLabel(doc: any, label: string, x: number, y: number): number {
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelWidth = doc.widthOfString(label);
  const labelHeight = doc.currentLineHeight();

  // Draw gray background behind label
  doc.fillColor(COLORS.LABEL_BACKGROUND)
    .rect(
      x - SPACING.LABEL_PADDING,
      y - 2,
      labelWidth + (SPACING.LABEL_PADDING * 2),
      labelHeight + 3
    )
    .fill();

  // Render label text
  doc.fillColor(COLORS.BLACK)
    .text(label, x, y);

  return labelWidth;
}

/**
 * Render shop form header (2-row)
 */
function renderShopHeader(
  doc: any,
  orderData: OrderDataForPDF,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number,
  baselineOffset: number
): number {
  let currentY = startY;

  // Row 1: Order # | Job name | Order Date
  const orderLabel = 'Order #:';
  const orderLabelWidth = renderHeaderLabel(doc, orderLabel, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + orderLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const jobLabel = 'Job:';
  const jobLabelWidth = renderHeaderLabel(doc, jobLabel, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col2X + jobLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const orderDateLabel = 'Order Date:';
  const orderDateLabelWidth = renderHeaderLabel(doc, orderDateLabel, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col3X + orderDateLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: Due Date | Delivery
  renderDueDate(doc, orderData, col1X, currentY);

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  const deliveryLabel = 'Delivery:';
  const deliveryLabelWidth = renderHeaderLabel(doc, deliveryLabel, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, col2X + deliveryLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  return currentY;
}

/**
 * Render master/customer form header (3-row)
 */
function renderMasterCustomerHeader(
  doc: any,
  orderData: OrderDataForPDF,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number,
  baselineOffset: number,
  formType: FormType
): number {
  let currentY = startY;

  // Row 1: Order # | Customer | Job Name
  let label = 'Order #:';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Customer:';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.company_name, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job:';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: Customer PO# | Customer Job # | Order Date
  label = 'Customer PO#:';
  labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_po || '', col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Customer Job #:';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_job_number || '', col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Order Date:';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 3: Due Date (hidden for customer form) | Delivery
  // Only show Due Date for Master form
  if (formType === 'master') {
    renderDueDate(doc, orderData, col1X, currentY);
  }

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery:';
  const deliveryCol = formType === 'customer' ? col1X : col2X;
  labelWidth = renderHeaderLabel(doc, label, deliveryCol, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, deliveryCol + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  return currentY;
}

/**
 * Render due date with time (if applicable)
 */
function renderDueDate(doc: any, orderData: OrderDataForPDF, x: number, y: number): void {
  if (!orderData.due_date) return;

  const dueDate = new Date(orderData.due_date);
  const dueDateStr = formatDueDateTime(dueDate, orderData.hard_due_date_time);
  const dueLabel = 'Due:';

  // Always use gray background label
  const dueLabelWidth = renderHeaderLabel(doc, dueLabel, x, y);

  // If hard deadline, make date value RED and BOLD
  if (orderData.hard_due_date_time) {
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica-Bold').fillColor(COLORS.URGENT_RED);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, y - SPACING.HEADER_VALUE_RAISE);
    doc.fillColor(COLORS.BLACK);
  } else {
    // Normal due date - regular black text
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, y - SPACING.HEADER_VALUE_RAISE);
  }
}

/**
 * Build part columns from parts list
 */
function buildPartColumns(parts: any[], formType: FormType): Array<{ parent: any; subItems: any[] }> {
  const partColumns: Array<{ parent: any; subItems: any[] }> = [];

  console.log(`[${formType.toUpperCase()} Form PDF] Total parts:`, parts.length);

  parts.forEach((part, index) => {
    // Skip parts with no meaningful data
    if (!shouldIncludePart(part, formType)) {
      console.log(`[${formType.toUpperCase()} Form PDF] ✓ SKIPPING empty part ${index + 1} (no display name or spec templates)`);
      return;
    }

    console.log(`[${formType.toUpperCase()} Form PDF] ✓ INCLUDING part ${index + 1}`);

    if (shouldStartNewColumn(part)) {
      // This is a parent or regular base item - create new column
      partColumns.push({ parent: part, subItems: [] });
      console.log(`[${formType.toUpperCase()} Form PDF] Created column ${partColumns.length} for:`, part.specs_display_name || part.product_type);
    } else {
      // This is a sub-item - find the matching parent column by display number prefix
      const parentNumber = part.display_number?.replace(/[a-zA-Z]/g, '');
      const matchingColumn = partColumns.find(col => col.parent.display_number === parentNumber);

      if (matchingColumn) {
        matchingColumn.subItems.push(part);
        console.log(`[${formType.toUpperCase()} Form PDF] Added sub-item to column (matched by number ${parentNumber}):`, part.specs_display_name || part.product_type);
      } else if (partColumns.length > 0) {
        // Fallback: append to last column if no match found
        partColumns[partColumns.length - 1].subItems.push(part);
        console.log(`[${formType.toUpperCase()} Form PDF] Added sub-item to last column (fallback):`, part.specs_display_name || part.product_type);
      }
    }
  });

  console.log(`[${formType.toUpperCase()} Form PDF] Final column count: ${partColumns.length}`);

  return partColumns;
}

/**
 * Render all part columns
 */
function renderPartColumns(
  doc: any,
  partColumns: Array<{ parent: any; subItems: any[] }>,
  marginLeft: number,
  contentWidth: number,
  contentStartY: number,
  formType: FormType
): number {
  const numColumns = Math.min(partColumns.length, LAYOUT.MAX_COLUMNS);
  const columnWidth = contentWidth / numColumns;

  let maxPartY = contentStartY;

  // Render each column
  partColumns.forEach((column, columnIndex) => {
    if (columnIndex >= LAYOUT.MAX_COLUMNS) return;

    const partX = marginLeft + (columnIndex * columnWidth) + LAYOUT.PART_COLUMN_INNER_PADDING;
    const partColumnWidth = columnWidth - (LAYOUT.PART_COLUMN_INNER_PADDING * 2);
    let partY = contentStartY;

    const parent = column.parent;

    // Get specs_qty from specifications, fallback to invoice quantity
    let specsQty = 0;
    try {
      const specs = typeof parent.specifications === 'string'
        ? JSON.parse(parent.specifications)
        : parent.specifications;
      specsQty = specs?.specs_qty ?? parent.quantity ?? 0;
    } catch {
      specsQty = parent.quantity ?? 0;
    }

    // Display name
    const displayName = parent.specs_display_name || parent.product_type;
    doc.fontSize(FONT_SIZES.TITLE).font('Helvetica-Bold');
    const titleLineHeight = doc.currentLineHeight();

    // Product name
    doc.text(displayName, partX, partY, {
      width: partColumnWidth * LAYOUT.PART_NAME_WIDTH_PERCENT,
      lineBreak: false,
      ellipsis: true
    });

    // Update partY manually (don't use doc.y in multi-column layout)
    partY += titleLineHeight + 2; // Title height + small gap

    // Add Scope text below Product Type (if it exists)
    if (parent.part_scope) {
      doc.fontSize(FONT_SIZES.SCOPE).font('Helvetica');
      const scopeLineHeight = doc.currentLineHeight();
      doc.text(`Scope: ${parent.part_scope}`, partX, partY, {
        width: partColumnWidth,
        lineBreak: false,
        ellipsis: true
      });
      // Update partY manually
      partY += scopeLineHeight + 3; // Scope height + small gap
    }

    // Draw horizontal separator line
    doc.strokeColor(COLORS.DIVIDER_LIGHT)
      .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
      .moveTo(partX, partY)
      .lineTo(partX + partColumnWidth, partY)
      .stroke();
    doc.strokeColor(COLORS.BLACK);

    partY += SPACING.AFTER_SEPARATOR;

    // Collect all parts (parent + sub-items) for combined rendering
    const allParts = [parent, ...column.subItems];
    debugLog(`[CALL RENDER] Calling renderSpecifications for column with ${allParts.length} parts`);

    // Render all specifications together
    partY = renderSpecifications(doc, allParts, partX, partY, partColumnWidth, formType);

    // Add gap before quantity box
    partY += 5;

    // Quantity box at bottom of specs - NEW STYLING: gray background for qty=1, red for others
    const qtyValue = Number(specsQty);
    const isStandard = qtyValue === 1 || qtyValue === 1.0;

    // Style based on quantity
    const bgColor = isStandard ? COLORS.QTY_STANDARD_BG : COLORS.QTY_NONSTANDARD_BG;
    const textColor = isStandard ? COLORS.QTY_STANDARD_TEXT : COLORS.QTY_NONSTANDARD_TEXT;
    const fontSize = isStandard ? FONT_SIZES.QTY_STANDARD : FONT_SIZES.QTY_NONSTANDARD;
    const fontWeight = isStandard ? 'Helvetica' : 'Helvetica-Bold';

    doc.fontSize(fontSize).font(fontWeight).fillColor(textColor);

    const qtyUnit = qtyValue <= 1 ? 'set' : 'sets';
    const qtyText = `Quantity: ${specsQty} ${qtyUnit}`;
    const qtyTextWidth = doc.widthOfString(qtyText);

    // Draw filled background rectangle
    doc.fillColor(bgColor)
      .rect(partX, partY - 1, qtyTextWidth + (SPACING.QTY_BOX_PADDING * 2), 14)
      .fill();

    // Draw text on top
    doc.fillColor(textColor)
      .text(qtyText, partX + SPACING.QTY_BOX_PADDING, partY + 1, { width: partColumnWidth });

    // Reset colors
    doc.fillColor(COLORS.BLACK).strokeColor(COLORS.BLACK);

    // Add spacing after quantity box
    partY += 18;

    // Track the maximum Y position
    if (partY > maxPartY) {
      maxPartY = partY;
    }
  });

  debugLog(`[LAYOUT] Actual parts ended at Y: ${maxPartY}`);

  return maxPartY;
}

/**
 * Render notes and image section
 */
async function renderNotesAndImage(
  doc: any,
  orderData: OrderDataForPDF,
  formType: FormType,
  maxPartY: number,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  pageHeight: number
): Promise<void> {
  const fullImagePath = getImageFullPath(orderData);
  if (!fullImagePath) return;

  try {
    debugLog(`[IMAGE] Attempting to load image: ${fullImagePath}`);

    if (!fs.existsSync(fullImagePath)) {
      debugLog(`[IMAGE] ⚠️ Image file not found: ${fullImagePath}`);
      return;
    }

    // Calculate actual available space for image
    const actualImageStartY = maxPartY + SPACING.IMAGE_AFTER_PARTS;
    const actualImageHeight = pageHeight - actualImageStartY - SPACING.IMAGE_BOTTOM_MARGIN;

    debugLog(`[IMAGE] Actual image Y: ${actualImageStartY}, Height: ${actualImageHeight}`);

    // Only draw if there's enough space
    if (actualImageHeight <= LAYOUT.MIN_IMAGE_HEIGHT) {
      debugLog(`[IMAGE] ⚠️ Not enough space for image (only ${actualImageHeight}px available)`);
      return;
    }

    // Draw separator line above notes/image section
    doc.strokeColor(COLORS.DIVIDER_LIGHT)
      .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
      .moveTo(marginLeft, actualImageStartY - SPACING.ITEM_GAP)
      .lineTo(pageWidth - marginRight, actualImageStartY - SPACING.ITEM_GAP)
      .stroke();

    let notesY = actualImageStartY;

    // Two-column layout for notes
    const notesColumnWidth = contentWidth * LAYOUT.NOTES_LEFT_WIDTH_PERCENT;
    const notesLeftX = marginLeft;
    const notesRightX = marginLeft + contentWidth * LAYOUT.NOTES_RIGHT_START_PERCENT;

    // Special Instructions (left side)
    if (orderData.manufacturing_note) {
      doc.fontSize(FONT_SIZES.SPEC_BODY).font('Helvetica');
      doc.text(orderData.manufacturing_note, notesLeftX, notesY, {
        width: notesColumnWidth,
        lineBreak: true
      });
    }

    // Internal Notes (right side) - HIDE for Customer and Shop forms
    if (formType === 'master' && orderData.internal_note) {
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
      (formType === 'master' && orderData.internal_note) ? doc.heightOfString(orderData.internal_note, { width: notesColumnWidth }) + 15 : 0
    );

    // Center the image below the notes
    const imageWidth = contentWidth * LAYOUT.IMAGE_WIDTH_PERCENT;
    const imageY = notesY + notesHeight + SPACING.ITEM_GAP;
    const imageX = marginLeft + (contentWidth - imageWidth) / 2;
    const adjustedImageHeight = actualImageHeight - notesHeight - SPACING.ITEM_GAP;

    if (adjustedImageHeight <= LAYOUT.MIN_ADJUSTED_IMAGE_HEIGHT) {
      debugLog(`[IMAGE] ⚠️ Not enough space for image after notes (only ${adjustedImageHeight}px available)`);
      return;
    }

    // Check if image has crop coordinates
    const hasCrop = orderData.crop_top || orderData.crop_right || orderData.crop_bottom || orderData.crop_left;

    if (hasCrop) {
      try {
        debugLog(`[IMAGE] Applying crop: T${orderData.crop_top} R${orderData.crop_right} B${orderData.crop_bottom} L${orderData.crop_left}`);

        // Get image metadata
        const imageMetadata = await sharp(fullImagePath).metadata();
        const cropWidth = (imageMetadata.width || 0) - (orderData.crop_left || 0) - (orderData.crop_right || 0);
        const cropHeight = (imageMetadata.height || 0) - (orderData.crop_top || 0) - (orderData.crop_bottom || 0);

        // Extract cropped region
        const croppedBuffer = await sharp(fullImagePath)
          .extract({
            left: orderData.crop_left || 0,
            top: orderData.crop_top || 0,
            width: cropWidth,
            height: cropHeight
          })
          .toBuffer();

        // Embed cropped image
        doc.image(croppedBuffer, imageX, imageY, {
          fit: [imageWidth, adjustedImageHeight],
          align: 'center',
          valign: 'center'
        });
        debugLog(`[IMAGE] ✅ Successfully loaded cropped image (${cropWidth}x${cropHeight})`);
      } catch (cropError) {
        console.error('[IMAGE] ⚠️ Crop failed, using original:', cropError);
        // Fall back to original image
        doc.image(fullImagePath, imageX, imageY, {
          fit: [imageWidth, adjustedImageHeight],
          align: 'center'
        });
        debugLog(`[IMAGE] ✅ Successfully loaded image (crop failed, using original)`);
      }
    } else {
      // No crop coordinates, use original image
      doc.image(fullImagePath, imageX, imageY, {
        fit: [imageWidth, adjustedImageHeight],
        align: 'center'
      });
      debugLog(`[IMAGE] ✅ Successfully loaded image (no crop)`);
    }
  } catch (error) {
    console.error('Error loading sign image:', error);
  }
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Generate Order Form (Master, Customer, or Shop variant)
 */
export async function generateOrderForm(
  orderData: OrderDataForPDF,
  outputPath: string,
  formType: FormType = 'master'
): Promise<string> {
  // Debug trace
  fs.writeFileSync('/tmp/pdf-generation-test.txt', `${formType.toUpperCase()} FORM CALLED at ${new Date().toISOString()} for order ${orderData.order_number}\n`, { flag: 'a' });

  console.log(`>>>>>>>>>>> ${formType.toUpperCase()} FORM GENERATION STARTED <<<<<<<<<<<<`);
  console.log(`Order Number: ${orderData.order_number}`);
  console.log(`Total Parts: ${orderData.parts.length}`);
  debugLog(`[${formType.toUpperCase()} FORM] Starting generation for order ${orderData.order_number}`);
  debugLog(`[${formType.toUpperCase()} FORM] Total parts: ${orderData.parts.length}`);

  return new Promise(async (resolve, reject) => {
    try {
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
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginLeft = SPACING.PAGE_MARGIN;
      const marginRight = SPACING.PAGE_MARGIN;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // Render header
      let currentY = SPACING.PAGE_MARGIN;
      currentY = renderCompactHeader(doc, orderData, formType, marginLeft, contentWidth, pageWidth, marginRight, currentY);

      // Main content area
      const contentStartY = currentY;
      const availableHeight = pageHeight - contentStartY - 15;

      debugLog(`[LAYOUT] Page dimensions: ${pageWidth} x ${pageHeight}`);
      debugLog(`[LAYOUT] contentStartY: ${contentStartY}, availableHeight: ${availableHeight}`);

      // Build and render part columns
      const partColumns = buildPartColumns(orderData.parts, formType);
      const maxPartY = renderPartColumns(doc, partColumns, marginLeft, contentWidth, contentStartY, formType);

      // Render notes and image section
      await renderNotesAndImage(doc, orderData, formType, maxPartY, marginLeft, contentWidth, pageWidth, marginRight, pageHeight);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================
// LEGACY EXPORTS
// ============================================

export const generateMasterForm = (orderData: OrderDataForPDF, outputPath: string) =>
  generateOrderForm(orderData, outputPath, 'master');

export const generateCustomerForm = (orderData: OrderDataForPDF, outputPath: string) =>
  generateOrderForm(orderData, outputPath, 'customer');

export const generateShopForm = (orderData: OrderDataForPDF, outputPath: string) =>
  generateOrderForm(orderData, outputPath, 'shop');
