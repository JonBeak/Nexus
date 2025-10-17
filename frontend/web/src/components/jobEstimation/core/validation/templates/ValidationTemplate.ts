// Base interface for all validation templates
// Templates define HOW to validate, instances define WHAT to validate

import { ChannelLetterMetrics } from '../utils/channelLetterParser';
import { CustomerManufacturingPreferences } from '../context/useCustomerPreferences';

export interface ValidationTemplate {
  /**
   * Validates a field value using template-specific logic
   * @param value - The field value to validate
   * @param params - Template-specific parameters
   * @param context - Optional validation context with customer prefs and grid state
   * @returns Validation result with success/error information
   */
  validate(value: string, params: Record<string, unknown>, context?: ValidationContext): Promise<ValidationResult>;

  /**
   * Returns a human-readable description of what this template validates
   */
  getDescription(): string;

  /**
   * Returns the expected parameter schema for this template
   */
  getParameterSchema(): Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string; // Human-readable error message
  expectedFormat?: string; // Help text for user
  parsedValue?: unknown; // Successfully parsed value (for calculations)
  calculatedValue?: unknown; // Calculated value based on context (for override templates)
}

// Context interface for context-aware validation
export interface ValidationContext {
  // Current row data
  rowData: Record<string, string>;

  // Customer preferences from customer_manufacturing_preferences table
  customerPreferences: CustomerManufacturingPreferences;

  // Grid-wide context (other rows affect validation)
  gridContext: {
    totalWattage: number;
    rowCount: number;
  };

  // Calculated values from Phase 1
  calculatedValues: {
    ledCount?: number;
    psCount?: number;
    totalInches?: number;
    totalWattage?: number;
    channelLetterMetrics?: ChannelLetterMetrics;
  };
}

// Parameter interfaces for type safety

export interface TextSplitParams {
  // Delimiters
  delimiter: string;          // Primary delimiter (1st dimension)
  delimiter2?: string;        // Optional secondary delimiter (2nd dimension)

  // Parsing
  parse_as: 'string' | 'float' | 'integer';

  // 1st Dimension Controls (groups/items)
  required_count?: number;    // Exactly N groups/items in 1st dim
  min_count?: number;         // Minimum N groups/items in 1st dim
  max_count?: number;         // Maximum N groups/items in 1st dim

  // 2nd Dimension Controls (items within each group)
  required_count2?: number;   // Each group must have exactly N items
  min_count2?: number;        // Each group must have at least N items
  max_count2?: number;        // Each group can have at most N items

  // Value Controls (for numeric parsing)
  min?: number;               // Minimum value for each parsed number
  max?: number;               // Maximum value for each parsed number

  // Behavior Controls
  allow_empty?: boolean;      // Allow empty values between delimiters
  trim_whitespace?: boolean;  // Remove leading/trailing spaces (default: true)
}

export interface FloatParams {
  min?: number;
  max?: number;
  decimal_places?: number;
  allow_negative?: boolean;
}

export interface RequiredParams {
  allow_whitespace?: boolean; // Whether whitespace-only counts as empty
}

export interface LedOverrideParams {
  accepts?: string[]; // ["float", "yes", "no"] - allowed input types
}

export interface PsOverrideParams {
  accepts?: string[]; // ["float", "yes", "no"] - allowed input types
  auto_calculate?: boolean; // Whether to auto-calculate from LED wattage
}

export interface UlOverrideParams {
  accepts?: string[]; // ["float", "yes", "no", "currency"] - allowed input types
  require_symbol?: boolean; // Whether currency must have $ symbol
}
