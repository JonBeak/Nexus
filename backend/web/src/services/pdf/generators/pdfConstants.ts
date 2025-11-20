// File Clean up Finished: 2025-11-15
/**
 * PDF Generator Constants
 * All constants, colors, spacing, layout values, and types used across PDF generators
 *
 * Extracted from pdfCommonGenerator.ts as part of file size reduction refactoring
 */

import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../../../config/paths';

// ============================================
// TYPE DEFINITIONS
// ============================================
export type FormType = 'master' | 'customer' | 'shop' | 'packing';

// ============================================
// CONSTANTS - COLORS
// ============================================
export const COLORS = {
  BLACK: '#000000',
  WHITE: '#ffffff',
  DARK_GRAY: '#333333',
  URGENT_RED: '#cc0000',
  LABEL_BACKGROUND: '#3a3a3a',
  DIVIDER_LIGHT: '#aaaaaa',
  DIVIDER_DARK: '#666666',
  QTY_STANDARD_BG: '#c0c0c0',      // Light gray background for qty=1
  QTY_STANDARD_TEXT: '#000000',    // Black text for qty=1
  QTY_NONSTANDARD_BG: '#cc0000',   // Red background for qty≠1
  QTY_NONSTANDARD_TEXT: '#ffffff', // White text for qty≠1
  // Label background colors
  LABEL_BG_DEFAULT: '#d0d0d0',     // Default label background (light gray)
  LABEL_BG_ELECTRICAL: '#f3da80',  // Electrical/LED specs (yellow)
  LABEL_BG_VINYL: '#eabcbf',       // Vinyl specs (pink)
  LABEL_BG_PAINTING: '#b6b0cc',    // Painting specs (purple)
  NO_BG: '#ff0000',                 // Pure red background for "No" values
};

// ============================================
// CONSTANTS - FONT SIZES
// ============================================
export const FONT_SIZES = {
  TITLE: 14,
  HEADER_VALUE: 11,
  SPEC_BODY: 12,
  HEADER_LABEL: 9,
  SCOPE: 12,
  QTY_NONSTANDARD: 18,
  INTERNAL_NOTE: 12,
  QTY_STANDARD: 14,
  INTERNAL_NOTE_LABEL: 10,
};

// ============================================
// CONSTANTS - LABEL STANDARDIZATION
// ============================================
export const STANDARD_LABEL_REFERENCE = 'Internal Note'; // Longest label used for width standardization

// ============================================
// CONSTANTS - SPACING
// ============================================
export const SPACING = {
  PAGE_MARGIN: 16,
  SECTION_GAP: 12,
  HEADER_ROW: 16,
  HEADER_START_OFFSET: 4,
  AFTER_TITLE: 16,
  AFTER_SCOPE: 14,
  AFTER_SEPARATOR: 4, // reduced from 8 for compact layout
  AFTER_PRODUCT_NAME: 18,
  BEFORE_DIVIDER: 3,
  ITEM_GAP: 5,
  SPEC_ROW_GAP: 2, // reduced from 4 for compact layout
  LABEL_PADDING: 2,
  QTY_BOX_PADDING: 5,
  IMAGE_AFTER_PARTS: 8,
  IMAGE_BOTTOM_MARGIN: 20,
  HEADER_VALUE_RAISE: 2,
  HEADER_LABEL_TO_VALUE: 6,
};

// ============================================
// CONSTANTS - LAYOUT
// ============================================
export const LAYOUT = {
  TITLE_WIDTH: 120,
  TITLE_LEFT_MARGIN: 6,
  TITLE_DIVIDER_OFFSET: 3,
  TITLE_INFO_GAP: 15,
  DIVIDER_HEIGHT: 40,
  COL2_PERCENT: 0.27,
  COL3_PERCENT: 0.57,
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

// ============================================
// CONSTANTS - LINE WIDTHS
// ============================================
export const LINE_WIDTHS = {
  DIVIDER_MAIN: 1.5,
  DIVIDER_LIGHT: 0.5,
  VERTICAL_DIVIDER: 1,
};

// ============================================
// CONSTANTS - SMB PATHS (Re-exported from config/paths.ts)
// ============================================
export const SMB_PATHS = {
  ROOT: SMB_ROOT,
  ORDERS_FOLDER: ORDERS_FOLDER,
  FINISHED_FOLDER: FINISHED_FOLDER,
};
