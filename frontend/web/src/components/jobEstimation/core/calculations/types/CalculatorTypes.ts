// Shared types for all product calculation engines
// This provides a consistent interface for current and future calculators

import { RowCalculationResult } from '../../types/LayerTypes';

/**
 * Standard input for all product calculators
 * Receives validated data from the validation layer
 */
export interface ValidatedPricingInput {
  rowId: string;
  productTypeId: number;

  // Validated and parsed field values from validation layer
  parsedValues: Record<string, unknown>;

  // Calculated business data from validation layer
  calculatedValues: Record<string, unknown>;

  // Validation status from validation layer
  hasValidationErrors: boolean;

  // Optional customer preferences for pricing adjustments
  customerPreferences?: any;

  // Job-level UL tracking - indicates if UL has been added in any previous rows
  ulExistsInPreviousRows?: boolean;
}

/**
 * Component item structure for multi-part products
 * Used by calculators that generate multiple line items (e.g., Channel Letters)
 */
export interface ComponentItem {
  name: string;           // Display name for the component (e.g., "Vinyl", "LEDs", "Power Supplies")
  price: number;          // Unit price for this component
  type: string;           // Component type identifier (e.g., 'channel_letters', 'leds', 'power_supplies')
  calculationDisplay?: string; // Optional: detailed breakdown for this component (shown in gray text)
  quantity?: number;      // Optional: component-specific quantity (defaults to parent row qty if not set)
                          // Use quantity=1 for fixed-price components like UL that shouldn't multiply by parent qty
}

/**
 * Standard output structure for pricing calculations
 * Extends the data portion of RowCalculationResult
 */
export interface PricingCalculationData {
  productTypeId: number;
  rowId: string;
  itemName: string;           // Main item name
  description?: string;        // Additional description
  unitPrice: number;          // Total unit price (sum of components if multi-part)
  quantity: number;           // Quantity from grid
  components?: ComponentItem[]; // Optional: breakdown for multi-part products
  hasCompleteSet?: boolean;   // Optional: indicates if all required parts are included
  [key: string]: unknown;     // Allow product-specific data
}

/**
 * Function signature for all product calculators
 * Each calculator must accept ValidatedPricingInput and return RowCalculationResult
 */
export type ProductCalculator = (
  input: ValidatedPricingInput
) => Promise<RowCalculationResult>;

/**
 * Registry entry for a product calculator
 * Used for future dynamic registration system
 */
export interface CalculatorRegistration {
  productTypeId: number;
  productName: string;
  calculator: ProductCalculator;
}