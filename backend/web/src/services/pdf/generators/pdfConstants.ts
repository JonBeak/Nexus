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
  QTY_NONSTANDARD_BG: '#f08080',   // Light red background for qty≠1 (black text readable)
  QTY_NONSTANDARD_TEXT: '#ffffff', // White text for qty≠1
  // Label background colors
  LABEL_BG_DEFAULT: '#e0e0e0',     // Default label background (light gray)
  LABEL_BG_DARKER: '#b8b8b8',      // Darker label background for Sign Type/Scope/Header
  LABEL_BG_ELECTRICAL: '#f3da80',  // Electrical/LED specs (yellow)
  LABEL_BG_VINYL: '#eabcbf',       // Vinyl specs (pink)
  LABEL_BG_PAINTING: '#c9b8e8',    // Painting specs (purple)
  NO_BG: '#b8b8b8',                 // Background for "None" values (same as LABEL_BG_DARKER)
};

// ============================================
// CONSTANTS - FONT SIZES
// ============================================
export const FONT_SIZES = {
  TITLE: 14,
  HEADER_VALUE: 11,
  SPEC_BODY: 12,        // Spec value font size
  SPEC_LABEL: 10,       // Spec label font size (reduced from 11 for compact layout)
  HEADER_LABEL: 9,
  SCOPE: 12,
  QTY_NONSTANDARD: 18,
  INTERNAL_NOTE: 12,
  QTY_STANDARD: 12,     // Quantity box label and value font size (reduced from 14)
  INTERNAL_NOTE_LABEL: 10,
  SIGN_TYPE_VALUE: 12,  // Sign Type box value font size (reduced from 14)
  SCOPE_VALUE: 10,      // Scope box value font size
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
  SECTION_GAP: 6,
  HEADER_ROW: 20,  // Increased from 16 for taller header boxes
  HEADER_START_OFFSET: 4,
  AFTER_TITLE: 16,
  AFTER_SCOPE: 14,
  AFTER_SEPARATOR: 4, // reduced from 8 for compact layout
  AFTER_PRODUCT_NAME: 18,
  BEFORE_DIVIDER: 3,
  ITEM_GAP: 36,
  SPEC_ROW_GAP: 1, // reduced from 4 for compact layout
  LABEL_PADDING: 2,
  QTY_BOX_PADDING: 5,
  IMAGE_AFTER_PARTS: 7,  // 3pt above separator line + 4pt below = 7pt total (plus 1pt SPEC_ROW_GAP)
  IMAGE_BOTTOM_MARGIN: 36,
  HEADER_VALUE_RAISE: 0,  // Reduced from 2 for taller header boxes
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
  COL2_PERCENT: 0.24,
  COL3_PERCENT: 0.54,
  PARTS_HEIGHT_PERCENT: 0.35,
  IMAGE_WIDTH_PERCENT: 0.90,
  NOTES_LEFT_WIDTH_PERCENT: 0.48,
  NOTES_RIGHT_START_PERCENT: 0.52,
  PART_COLUMN_INNER_PADDING: 5,
  PART_NAME_WIDTH_PERCENT: 0.6,
  QTY_BOX_WIDTH_PERCENT: 0.3,
  MAX_COLUMNS: 3,
  MIN_IMAGE_HEIGHT: 80,  // Minimum space required for image after notes (~13% of page height)
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
