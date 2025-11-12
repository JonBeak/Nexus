/**
 * Unified Order Form Generator
 * Generates Master, Customer, and Shop order forms from a single template
 *
 * Form Types:
 * - master: Complete internal form with all details
 * - customer: Customer-facing form (also referred to as "Specs" - removes internal notes, simplifies LED/Power Supply)
 * - shop: Production floor form (removes customer details, 2-row header; "Specs" refers to customer form)
 *
 * Layout: Landscape Letter (11" x 8.5")
 * Design: Minimal padding, compact info, large image area
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import sharp from 'sharp';
import { STORAGE_CONFIG } from '../../../config/storage';
import type { OrderDataForPDF } from '../pdfGenerationService';
import {
  FormType,
  COLORS,
  FONT_SIZES,
  SPACING,
  LAYOUT,
  LINE_WIDTHS,
  SMB_PATHS,
  debugLog,
  formatBooleanValue,
  formatDueDateTime,
  renderHeaderLabel,
  renderDueDate,
  renderQuantityBox,
  getImageFullPath,
  shouldIncludePart,
  shouldStartNewColumn
} from './pdfCommonGenerator';

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
// HELPER FUNCTIONS - Spec-Specific Utilities
// ============================================

/**
 * Build sorted template rows from parts (extracted for reuse in 2-column layout)
 */
function buildSortedTemplateRows(
  parts: any[],
  formType: FormType
): Array<{ template: string; rowNum: string; specs: Record<string, any> }> {
  // Determine if LEDs/PS/UL should be mandatory for this part
  const specsDisplayName = parts.length > 0 ? parts[0].specs_display_name : null;
  const isExemptFromCritical = specsDisplayName && SPECS_EXEMPT_FROM_CRITICAL.includes(specsDisplayName as any);

  // Extract template rows with their spec values from ALL parts
  const allTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }> = [];

  // Process each part (parent and sub-items)
  parts.forEach((part) => {
    if (!part.specifications) return;

    try {
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      if (!specs || Object.keys(specs).length === 0) return;

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
        }
      });
    } catch (e) {
      console.error(`Error processing part specifications:`, e);
    }
  });

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

  return sortedTemplateRows;
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
      // Template stores: count, led_type (full string), note
      const ledCount = specs.count || '';
      let ledType = specs.type || specs.led_type || '';

      // Shorten LED type: keep only part before " - "
      if (ledType && ledType.includes(' - ')) {
        ledType = ledType.split(' - ')[0].trim();
      }

      // Customer form: Replace count with "Yes" if it's a number > 0, but preserve type
      if (formType === 'customer') {
        const countNum = Number(ledCount);
        if (!isNaN(countNum) && countNum > 0) {
          // Count is a valid number > 0, show "Yes [type]"
          return ledType ? `Yes [${ledType}]` : 'Yes';
        } else if (ledType) {
          // No count, but has type
          return ledType;
        }
        return 'No';
      }

      // Master/Shop: Format as {count} [{led_type}]
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
      // Template stores: count, ps_type (full string), note
      const psCount = specs.count || '';
      let psType = specs.ps_type || specs.model || specs.power_supply || '';

      // Shorten PS type: keep only part before " ("
      if (psType && psType.includes(' (')) {
        psType = psType.split(' (')[0].trim();
      }

      // Customer form: Replace count with "Yes" if it's a number > 0, but preserve type
      if (formType === 'customer') {
        const countNum = Number(psCount);
        if (!isNaN(countNum) && countNum > 0) {
          // Count is a valid number > 0, show "Yes [type]"
          return psType ? `Yes [${psType}]` : 'Yes';
        } else if (psType) {
          // No count, but has type
          return psType;
        }
        return 'No';
      }

      // Master/Shop: Format as {count} [{ps_type}]
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
  formType: FormType,
  specsToRender?: Array<{ template: string; rowNum: string; specs: Record<string, any> }>
): number {
  debugLog('[PDF RENDER] ========== START renderSpecifications ==========');
  debugLog(`[PDF RENDER] Processing ${parts.length} parts for ${formType} form`);

  let currentY = startY;

  // Use provided specs or build from parts
  const sortedTemplateRows = specsToRender || buildSortedTemplateRows(parts, formType);

  const specsDisplayName = parts.length > 0 ? parts[0].specs_display_name : null;
  const isExemptFromCritical = specsDisplayName && SPECS_EXEMPT_FROM_CRITICAL.includes(specsDisplayName as any);

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
  const labelText = label;

  // Label: 11pt (1pt smaller)
  doc.fontSize(11).font('Helvetica-Bold');
  const labelWidth = doc.widthOfString(labelText);
  const labelHeight = doc.currentLineHeight();

  // Calculate black background dimensions
  const grayBoxStartY = currentY - 2;
  const grayBoxHeight = labelHeight + 3;
  const grayBoxEndY = grayBoxStartY + grayBoxHeight; // = currentY + labelHeight + 1

  // Draw black background behind label
  doc.fillColor(COLORS.LABEL_BACKGROUND)
    .rect(
      x - SPACING.LABEL_PADDING,
      grayBoxStartY,
      labelWidth + (SPACING.LABEL_PADDING * 2),
      grayBoxHeight
    )
    .fill();

  // Render label (11pt) in white
  doc.fillColor(COLORS.WHITE)
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

  // Render value (even if empty) in black
  doc.fillColor(COLORS.BLACK)
    .text(value, valueX, valueY, {
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

  // Title text height: two lines (18pt + 12pt with spacing)
  const titleHeight = 42;

  // Calculate vertical center offset for title
  const titleVerticalOffset = (headerContentHeight - titleHeight) / 2;

  // Now render the left side title, vertically centered
  const titleY = headerStartY + titleVerticalOffset;
  const titleX = marginLeft + LAYOUT.TITLE_LEFT_MARGIN;

  // Order Form (big, 18pt)
  doc.fontSize(18).font('Helvetica-Bold');
  doc.text('Order Form', titleX, titleY);

  // Sign House Inc. (smaller, 12pt)
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Sign House Inc.', titleX, titleY + 22);

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

  // Row 1: Order # | Date | Job
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: (blank) | Due | Delivery
  renderDueDate(doc, orderData, col2X, currentY);

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
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

  // Row 1: Order # | Date | Customer
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Customer';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.company_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 2: Job # | PO# | Job Name
  label = 'Job #';
  labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_job_number || '', col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'PO#';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.customer_po || '', col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job Name';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  // Row 3: (blank) | Due | Delivery (no due date for customer/specs form)
  if (formType !== 'customer') {
    renderDueDate(doc, orderData, col2X, currentY);
  }

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);
  currentY += SPACING.HEADER_ROW;

  return currentY;
}

/**
 * Calculate optimal split index for 2-column spec layout
 * Strategy:
 * 1. If LEDs component exists:
 *    - Must be within range: midpoint - 1 (up) to midpoint + 4 (down)
 *    - If within range but creates same spec type split, try adjustments: down 1-3, then up 1
 *    - If no valid adjustment, fall back to Strategy 2
 * 2. If no LEDs or Strategy 1 fails, split at exact half with adjustments: down 1-3, then up 1
 */
function calculateOptimalSplitIndex(
  sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }>
): number {
  const totalSpecs = sortedTemplateRows.length;
  const midpoint = Math.floor(totalSpecs / 2);

  // Strategy 1: Look for LEDs component
  const ledsIndex = sortedTemplateRows.findIndex(row => row.template === 'LEDs');
  if (ledsIndex !== -1) {
    // Check if LEDs is within acceptable distance from midpoint
    const distanceFromMidpoint = ledsIndex - midpoint;
    const isWithinRange = distanceFromMidpoint >= -1 && distanceFromMidpoint <= 4;

    if (isWithinRange) {
      debugLog(`[SPLIT STRATEGY] Found LEDs at index ${ledsIndex} (${distanceFromMidpoint > 0 ? '+' : ''}${distanceFromMidpoint} from midpoint)`);

      // Check if this split point is valid (no same spec type on both sides)
      if (!shouldAdjustSplit(sortedTemplateRows, ledsIndex)) {
        debugLog(`[SPLIT STRATEGY] Using LEDs index ${ledsIndex} directly`);
        return ledsIndex;
      }

      debugLog(`[SPLIT STRATEGY] LEDs index ${ledsIndex} causes same-spec split, trying adjustments`);

      // Try adjustments: down 1, 2, 3, then up 1
      const adjustments = [1, 2, 3, -1]; // positive = down, negative = up
      for (const adjustment of adjustments) {
        const candidateIndex = ledsIndex + adjustment;

        // Ensure within bounds
        if (candidateIndex > 0 && candidateIndex < totalSpecs) {
          if (!shouldAdjustSplit(sortedTemplateRows, candidateIndex)) {
            debugLog(`[SPLIT STRATEGY] Adjusted from LEDs to index ${candidateIndex} (offset +${adjustment})`);
            return candidateIndex;
          }
        }
      }

      debugLog(`[SPLIT STRATEGY] No valid adjustment for LEDs found, falling back to Strategy 2`);
    } else {
      debugLog(`[SPLIT STRATEGY] LEDs at index ${ledsIndex} is too far from midpoint (${distanceFromMidpoint}), falling back to Strategy 2`);
    }
  }

  // Strategy 2: No LEDs or Strategy 1 failed - split at half, then adjust if needed
  let splitIndex = midpoint;

  // Check if split separates same spec type
  if (shouldAdjustSplit(sortedTemplateRows, splitIndex)) {
    debugLog(`[SPLIT STRATEGY] Split at ${splitIndex} separates same spec type, attempting adjustment`);

    // Try adjustments in order: down 1, 2, 3, then up 1
    const adjustments = [1, 2, 3, -1]; // positive = down, negative = up
    for (const adjustment of adjustments) {
      const candidateIndex = splitIndex + adjustment;

      // Ensure within bounds
      if (candidateIndex > 0 && candidateIndex < totalSpecs) {
        if (!shouldAdjustSplit(sortedTemplateRows, candidateIndex)) {
          debugLog(`[SPLIT STRATEGY] Adjusted to index ${candidateIndex} (offset +${adjustment})`);
          return candidateIndex;
        }
      }
    }

    debugLog(`[SPLIT STRATEGY] No valid adjustment found, using original midpoint ${splitIndex}`);
  } else {
    debugLog(`[SPLIT STRATEGY] Split at midpoint ${splitIndex} is valid`);
  }

  return splitIndex;
}

/**
 * Check if split would separate same spec type on both sides
 * Returns true if the spec type at (index-1) == spec type at (index)
 */
function shouldAdjustSplit(
  sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }>,
  splitIndex: number
): boolean {
  if (splitIndex <= 0 || splitIndex >= sortedTemplateRows.length) {
    return false;
  }

  const lastLeftTemplate = sortedTemplateRows[splitIndex - 1].template;
  const firstRightTemplate = sortedTemplateRows[splitIndex].template;

  return lastLeftTemplate === firstRightTemplate;
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
 * Render a single part with specs split into 2 horizontal columns (for 9+ specs)
 * Used when there's only 1 part and it has many specs
 */
function renderSpecsInTwoColumns(
  doc: any,
  column: { parent: any; subItems: any[] },
  marginLeft: number,
  contentWidth: number,
  contentStartY: number,
  pageWidth: number,
  marginRight: number,
  formType: FormType
): number {
  const parent = column.parent;
  const allParts = [parent, ...column.subItems];

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

  let currentY = contentStartY;

  // Display name (left aligned, no duplicate for right column)
  const displayName = parent.specs_display_name || parent.product_type;
  doc.fontSize(FONT_SIZES.TITLE).font('Helvetica-Bold');
  const titleLineHeight = doc.currentLineHeight();

  doc.text(displayName, marginLeft, currentY, {
    width: contentWidth * LAYOUT.PART_NAME_WIDTH_PERCENT,
    lineBreak: false,
    ellipsis: true
  });

  currentY += titleLineHeight + 2; // Title height + small gap

  // Add Scope text below Product Type (if it exists)
  if (parent.part_scope) {
    doc.fontSize(FONT_SIZES.SCOPE).font('Helvetica');
    const scopeLineHeight = doc.currentLineHeight();
    doc.text(`Scope: ${parent.part_scope}`, marginLeft, currentY, {
      width: contentWidth,
      lineBreak: false,
      ellipsis: true
    });
    currentY += scopeLineHeight + 3; // Scope height + small gap
  }

  // Draw FULL-WIDTH horizontal separator line (not split)
  doc.strokeColor(COLORS.DIVIDER_LIGHT)
    .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
    .moveTo(marginLeft, currentY)
    .lineTo(pageWidth - marginRight, currentY)
    .stroke();
  doc.strokeColor(COLORS.BLACK);

  currentY += SPACING.AFTER_SEPARATOR;

  // Build sorted template rows
  const sortedTemplateRows = buildSortedTemplateRows(allParts, formType);

  // Determine split point for 2-column layout
  let splitIndex = calculateOptimalSplitIndex(sortedTemplateRows);

  const leftSpecs = sortedTemplateRows.slice(0, splitIndex);
  const rightSpecs = sortedTemplateRows.slice(splitIndex);

  // Calculate column widths for 2-column layout
  const leftColumnX = marginLeft + LAYOUT.PART_COLUMN_INNER_PADDING;
  const rightColumnX = marginLeft + contentWidth / 2 + LAYOUT.PART_COLUMN_INNER_PADDING;
  const columnWidth = contentWidth / 2 - (LAYOUT.PART_COLUMN_INNER_PADDING * 2);

  // Render left column specs
  let leftY = renderSpecifications(doc, allParts, leftColumnX, currentY, columnWidth, formType, leftSpecs);

  // Render right column specs
  let rightY = renderSpecifications(doc, allParts, rightColumnX, currentY, columnWidth, formType, rightSpecs);

  // Determine where to place quantity box (under the taller column)
  const maxSpecsY = Math.max(leftY, rightY);
  let finalY = maxSpecsY + 5; // Add gap before quantity box

  // Render quantity box under the right column (position it under right specs)
  finalY = renderQuantityBox(doc, specsQty, rightColumnX, finalY, columnWidth);

  return finalY;
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
  pageWidth: number,
  marginRight: number,
  formType: FormType
): number {
  // Check if this is a single-part order with 9+ specs (use 2-column layout)
  if (partColumns.length === 1) {
    const singleColumn = partColumns[0];
    const allParts = [singleColumn.parent, ...singleColumn.subItems];
    const sortedSpecs = buildSortedTemplateRows(allParts, formType);

    if (sortedSpecs.length >= 9) {
      console.log(`[SINGLE PART 2-COLUMN] Order has ${sortedSpecs.length} specs - using 2-column layout`);
      debugLog(`[SINGLE PART 2-COLUMN] Using 2-column layout for ${sortedSpecs.length} specs`);
      return renderSpecsInTwoColumns(doc, singleColumn, marginLeft, contentWidth, contentStartY, pageWidth, marginRight, formType);
    }
  }

  // Multi-part or single-part with <9 specs: use normal column layout
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

    // Draw horizontal separator line (split for multi-part, full-width for single with <9)
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

    // Render quantity box (shared utility function)
    partY = renderQuantityBox(doc, specsQty, partX, partY, partColumnWidth);

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
      const maxPartY = renderPartColumns(doc, partColumns, marginLeft, contentWidth, contentStartY, pageWidth, marginRight, formType);

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
