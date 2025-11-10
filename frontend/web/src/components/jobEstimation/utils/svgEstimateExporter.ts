import { EstimatePreviewData } from '../core/layers/CalculationLayer';

interface SVGExportOptions {
  customerName?: string;
  jobName?: string;
  version?: string;
  description?: string;
  date?: string;
}

export const generateEstimateSVG = (
  estimateData: EstimatePreviewData,
  options: SVGExportOptions
): string => {
  // Letter-size landscape: 11" x 8.5" = 792pt x 612pt (at 72 DPI)
  const PAGE_WIDTH = 792;
  const PAGE_HEIGHT = 612;
  const MARGIN = 36; // 0.5 inch margin

  // Configuration - Smaller, more compact table
  const FONT_FAMILY = 'Arial, sans-serif';
  const HEADER_FONT_SIZE = 11;
  const BODY_FONT_SIZE = 10;
  const DETAIL_FONT_SIZE = 9;
  const INFO_FONT_SIZE = 14;
  const DETAIL_LINE_HEIGHT = 11; // Spacing for multi-line details
  const BASE_ROW_HEIGHT = 18; // Base height for single-line rows
  const HEADER_HEIGHT = 24;
  const TABLE_START_X = MARGIN;
  const TABLE_START_Y = MARGIN;

  // Column configuration (x positions and widths) - NO # column, more compact
  const COL_ITEM_X = TABLE_START_X;
  const COL_ITEM_WIDTH = 120;
  const COL_DETAILS_X = COL_ITEM_X + COL_ITEM_WIDTH;
  const COL_DETAILS_WIDTH = 200;
  const COL_QTY_X = COL_DETAILS_X + COL_DETAILS_WIDTH;
  const COL_QTY_WIDTH = 40;
  const COL_UNIT_PRICE_X = COL_QTY_X + COL_QTY_WIDTH;
  const COL_UNIT_PRICE_WIDTH = 70;
  const COL_EXT_PRICE_X = COL_UNIT_PRICE_X + COL_UNIT_PRICE_WIDTH;
  const COL_EXT_PRICE_WIDTH = 80;

  const TABLE_WIDTH = COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - TABLE_START_X;

  // Helper to count lines in text
  const countLines = (text: string): number => {
    if (!text) return 1;
    return text.split('\n').length;
  };

  // Calculate row heights based on multi-line details
  const rowHeights: number[] = estimateData.items.map(item => {
    const detailLines = countLines(item.calculationDisplay);
    if (detailLines <= 1) return BASE_ROW_HEIGHT;
    // Add extra height for each additional line
    return BASE_ROW_HEIGHT + ((detailLines - 1) * DETAIL_LINE_HEIGHT);
  });

  // Helper functions
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const escapeXml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Build SVG content
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}">
  <defs>
    <style>
      .header-text { font-family: ${FONT_FAMILY}; font-size: ${HEADER_FONT_SIZE}px; font-weight: bold; fill: #1f2937; }
      .body-text { font-family: ${FONT_FAMILY}; font-size: ${BODY_FONT_SIZE}px; fill: #374151; }
      .body-text-bold { font-family: ${FONT_FAMILY}; font-size: ${BODY_FONT_SIZE}px; font-weight: bold; fill: #1f2937; }
      .detail-text { font-family: ${FONT_FAMILY}; font-size: ${DETAIL_FONT_SIZE}px; fill: #374151; }
      .detail-text-bold { font-family: ${FONT_FAMILY}; font-size: ${DETAIL_FONT_SIZE}px; font-weight: bold; fill: #1f2937; }
      .info-text { font-family: ${FONT_FAMILY}; font-size: ${INFO_FONT_SIZE}px; fill: #374151; }
      .grid-line { stroke: #d1d5db; stroke-width: 1; fill: none; }
      .total-line { stroke: #6b7280; stroke-width: 1.5; fill: none; }
    </style>
  </defs>

  <!-- Main Estimate Group -->
  <g id="estimate-export">

    <!-- Table and Totals Group -->
    <g id="table-with-totals">

`;

  let currentY = TABLE_START_Y;

  // Table Header (no # column)
  svg += `      <!-- Table Header -->\n`;
  svg += `      <text class="header-text" x="${COL_ITEM_X + 4}" y="${currentY + HEADER_HEIGHT - 6}">Item</text>\n`;
  svg += `      <text class="header-text" x="${COL_DETAILS_X + 4}" y="${currentY + HEADER_HEIGHT - 6}">Details</text>\n`;
  svg += `      <text class="header-text" x="${COL_QTY_X + COL_QTY_WIDTH / 2}" y="${currentY + HEADER_HEIGHT - 6}" text-anchor="middle">Qty</text>\n`;
  svg += `      <text class="header-text" x="${COL_UNIT_PRICE_X + COL_UNIT_PRICE_WIDTH - 4}" y="${currentY + HEADER_HEIGHT - 6}" text-anchor="end">Unit Price</text>\n`;
  svg += `      <text class="header-text" x="${COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - 4}" y="${currentY + HEADER_HEIGHT - 6}" text-anchor="end">Ext. Price</text>\n`;

  // Header underline
  currentY += HEADER_HEIGHT;
  svg += `      <line class="grid-line" x1="${TABLE_START_X}" y1="${currentY}" x2="${TABLE_START_X + TABLE_WIDTH}" y2="${currentY}"/>\n`;

  // Calculate total table height with dynamic row heights
  const tableContentStartY = currentY;
  const totalRowHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const tableEndY = tableContentStartY + totalRowHeight;

  // Table vertical lines
  svg += `      <!-- Vertical column separators -->\n`;
  svg += `      <line class="grid-line" x1="${COL_ITEM_X}" y1="${TABLE_START_Y}" x2="${COL_ITEM_X}" y2="${tableEndY}"/>\n`;
  svg += `      <line class="grid-line" x1="${COL_DETAILS_X}" y1="${TABLE_START_Y}" x2="${COL_DETAILS_X}" y2="${tableEndY}"/>\n`;
  svg += `      <line class="grid-line" x1="${COL_QTY_X}" y1="${TABLE_START_Y}" x2="${COL_QTY_X}" y2="${tableEndY}"/>\n`;
  svg += `      <line class="grid-line" x1="${COL_UNIT_PRICE_X}" y1="${TABLE_START_Y}" x2="${COL_UNIT_PRICE_X}" y2="${tableEndY}"/>\n`;
  svg += `      <line class="grid-line" x1="${COL_EXT_PRICE_X}" y1="${TABLE_START_Y}" x2="${COL_EXT_PRICE_X}" y2="${tableEndY}"/>\n`;

  // Table outer border
  svg += `      <!-- Table border -->\n`;
  svg += `      <rect class="grid-line" x="${TABLE_START_X}" y="${TABLE_START_Y}" width="${TABLE_WIDTH}" height="${tableEndY - TABLE_START_Y}"/>\n`;

  // Line items with dynamic row heights
  svg += `      <!-- Line Items -->\n`;
  let cumulativeY = tableContentStartY;

  estimateData.items.forEach((item, index) => {
    const isEmptyRow = item.productTypeId === 27;
    const isSubtotal = item.productTypeId === 21;
    const rowHeight = rowHeights[index];
    const rowY = cumulativeY + 13; // Text baseline offset (reduced for smaller font)

    // Item name (skip for subtotals)
    if (!isSubtotal) {
      svg += `      <text class="body-text-bold" x="${COL_ITEM_X + 4}" y="${rowY}">${escapeXml(item.itemName)}</text>\n`;
    }

    // Details/Calculation display with multi-line support
    if (item.calculationDisplay) {
      const textClass = isSubtotal ? 'detail-text-bold' : 'detail-text';
      const lines = item.calculationDisplay.split('\n');
      lines.forEach((line, lineIndex) => {
        svg += `      <text class="${textClass}" x="${COL_DETAILS_X + 4}" y="${rowY + (lineIndex * DETAIL_LINE_HEIGHT)}">${escapeXml(line)}</text>\n`;
      });
    }

    // Quantity (skip for empty rows and subtotals)
    if (!isEmptyRow && !isSubtotal) {
      svg += `      <text class="body-text" x="${COL_QTY_X + COL_QTY_WIDTH / 2}" y="${rowY}" text-anchor="middle">${item.quantity}</text>\n`;
    }

    // Unit price (skip for empty rows and subtotals)
    if (!isEmptyRow && !isSubtotal) {
      svg += `      <text class="body-text" x="${COL_UNIT_PRICE_X + COL_UNIT_PRICE_WIDTH - 4}" y="${rowY}" text-anchor="end">${formatCurrency(item.unitPrice)}</text>\n`;
    }

    // Extended price (skip for empty rows and subtotals)
    if (!isEmptyRow && !isSubtotal) {
      svg += `      <text class="body-text-bold" x="${COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - 4}" y="${rowY}" text-anchor="end">${formatCurrency(item.extendedPrice)}</text>\n`;
    }

    // Add horizontal line between rows
    if (index < estimateData.items.length - 1) {
      const lineY = cumulativeY + rowHeight;
      svg += `      <line class="grid-line" x1="${TABLE_START_X}" y1="${lineY}" x2="${TABLE_START_X + TABLE_WIDTH}" y2="${lineY}"/>\n`;
    }

    cumulativeY += rowHeight;
  });

  // Totals section
  currentY = tableEndY + (BASE_ROW_HEIGHT * 1.2);
  svg += `\n      <!-- Totals -->\n`;

  // Subtotal
  svg += `      <text class="body-text" x="${COL_UNIT_PRICE_X - 8}" y="${currentY}" text-anchor="end">Subtotal:</text>\n`;
  svg += `      <text class="body-text-bold" x="${COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - 4}" y="${currentY}" text-anchor="end">$${formatCurrency(estimateData.subtotal)}</text>\n`;

  currentY += BASE_ROW_HEIGHT;

  // Tax
  svg += `      <text class="body-text" x="${COL_UNIT_PRICE_X - 8}" y="${currentY}" text-anchor="end">Tax (${formatPercent(estimateData.taxRate)}):</text>\n`;
  svg += `      <text class="body-text-bold" x="${COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - 4}" y="${currentY}" text-anchor="end">$${formatCurrency(estimateData.taxAmount)}</text>\n`;

  currentY += BASE_ROW_HEIGHT * 0.3;

  // Total line
  svg += `      <line class="total-line" x1="${COL_UNIT_PRICE_X - 100}" y1="${currentY}" x2="${COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - 4}" y2="${currentY}"/>\n`;

  currentY += BASE_ROW_HEIGHT * 0.8;

  // Total
  svg += `      <text class="body-text-bold" x="${COL_UNIT_PRICE_X - 8}" y="${currentY}" text-anchor="end">Total:</text>\n`;
  svg += `      <text class="body-text-bold" x="${COL_EXT_PRICE_X + COL_EXT_PRICE_WIDTH - 4}" y="${currentY}" text-anchor="end" style="font-size: 11px;">$${formatCurrency(estimateData.total)}</text>\n`;

  // Close table-with-totals group
  svg += `    </g>\n\n`;

  // Customer info at bottom right corner (very close to edge)
  svg += `    <!-- Customer Information Group -->\n`;
  svg += `    <g id="customer-info">\n`;
  const infoX = PAGE_WIDTH - 10; // 10pt from right edge
  let infoY = PAGE_HEIGHT - 10; // 10pt from bottom edge

  // Work backwards from bottom
  const lines: string[] = [];
  if (options.date) {
    lines.unshift(options.date);
  }
  if (options.description) {
    lines.unshift(options.description);
  }
  if (options.jobName && options.version) {
    lines.unshift(`${options.jobName} - ${options.version}`);
  }
  if (options.customerName) {
    lines.unshift(options.customerName);
  }

  // Draw from bottom up with compact spacing
  const INFO_LINE_HEIGHT = 18;
  lines.reverse().forEach((line, index) => {
    const yPos = infoY - (index * INFO_LINE_HEIGHT);
    svg += `      <text class="info-text" x="${infoX}" y="${yPos}" text-anchor="end">${escapeXml(line)}</text>\n`;
  });

  // Close customer-info group
  svg += `    </g>\n\n`;

  // Close main estimate-export group
  svg += `  </g>\n`;

  svg += `</svg>`;

  return svg;
};
