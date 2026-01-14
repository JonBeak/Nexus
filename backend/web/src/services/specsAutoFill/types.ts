// File Clean up Finished: Nov 13, 2025
/**
 * Type Definitions for Specs Auto-Fill Service
 *
 * All interfaces and types used across the auto-fill module
 */

/**
 * Component item from estimate calculation
 * (Subset of frontend ComponentItem type)
 */
export interface ComponentItem {
  name: string;
  price: number;
  type: string;
  calculationDisplay?: string;
}

/**
 * Input data for auto-fill process
 */
export interface AutoFillInput {
  qbItemName: string;                    // e.g., "3\" Front Lit"
  specsDisplayName: string;              // e.g., "Front Lit", "Halo Lit", "LEDs"
  calculationDisplay: string;            // Multi-line text from estimate
  calculationComponents?: ComponentItem[]; // Structured component data (preferred source)
  currentSpecifications: any;            // Current specs JSON with templates
  isParentOrRegular: boolean;            // Whether this is a parent/regular row
  customerPreferences?: {                // Customer-specific defaults
    drain_holes_yes_or_no?: boolean;
  };
  connection?: any;                      // Database connection for lookups
  previousItems?: Array<{                // Array of previously processed items (for cross-item logic)
    specsDisplayName: string;
    calculationDisplay: string;
    specifications: any;
  }>;
}

/**
 * Output from auto-fill process
 */
export interface AutoFillOutput {
  specifications: any;                   // Updated specs JSON with filled values
  autoFilledFields: string[];           // List of fields that were auto-filled
  warnings: string[];                   // Any parsing warnings/errors
}

/**
 * Parsed data extracted from various sources
 */
export interface ParsedData {
  depth?: string;           // "3\"", "5\"" from QB item name
  count?: number;           // 15, 105 from calculation display
  type?: string;            // "Interone 9K", "Pins + Spacer"
  hasPins?: boolean;        // Detected pins in calculation
  hasSpacers?: boolean;     // Detected spacers in calculation
  hasRivnut?: boolean;      // Detected rivnut in calculation
  hasStandOffs?: boolean;   // Detected stand offs in calculation
}

/**
 * Power supply parsed data
 */
export interface PowerSupplyData {
  count: number;
  type: string;
}

/**
 * Vinyl component parsed data
 */
export interface VinylComponentData {
  type: 'application_tape' | 'vinyl' | 'digital_print';
  name: string;
  squareFeet?: number;
}
