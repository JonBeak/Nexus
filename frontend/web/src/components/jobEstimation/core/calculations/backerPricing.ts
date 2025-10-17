// Backer Pricing Calculator
// Dedicated pricing logic for Backer products (Product Type 4)
// Only receives validated data from validation layer - no raw grid data
// REQUIRES pre-calculated lookup tables for performance

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData } from './types/CalculatorTypes';
import { BackerLookupTables, lookupAluminumPrice, lookupAcmPrice, lookupHingedRacewayPrice } from './backerPricingLookup';

// Helper function to format price (integer if whole number, 2 decimals if not)
const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
};

// Hardcoded constants for aluminum backers
const BACKER_CONSTANTS = {
  ANGLE_COST: 50,           // 1.25" Angle
  ASSEM_COST: 50,           // Assembly
  MOUNTING_ANGLE_COST: 50,  // Mounting Angle
  PER_ANGLE_CUT: 25,        // Per Angle Cut

  // Total derived from above
  TOTAL_ANGLE_COST: 150,    // 50 + 50 + 50

  // Lookup table categories (inches)
  X_CATEGORIES: [59.5, 119.5, 179.5, 239.5],
  Y_CATEGORIES: [15.5, 23.5, 47.5],

  // Reference sheet size for formula
  REFERENCE_WIDTH: 119.5,
  REFERENCE_HEIGHT: 47.5,

  // Angle calculation constants
  ANGLE_LINEAR_DIVISOR: 240
};

// Hinged Raceway lookup table (hardcoded)
const HINGED_RACEWAY_LOOKUP = {
  CATEGORIES: [59.5, 119.5, 179.5, 239.5, 299.5],
  PRICES: [190, 305, 420, 570, 685]
};

// ACM Backer constants
const ACM_CONSTANTS = {
  ANGLE_COST: 75,           // 2" Angle
  ASSEM_COST: 100,          // Assembly + VHB Tape
  MOUNTING_ANGLE_COST: 50,  // Mounting Angle
  PER_LENGTH_CUT: 25,       // Per Length Cut

  // Total derived from above
  TOTAL_ANGLE_COST: 225,    // 75 + 100 + 50

  // Lookup table categories (inches) - inclusive
  X_CATEGORIES: [48, 60, 96, 120, 192, 240, 300],
  Y_CATEGORIES: [15.5, 23.5, 29, 48, 60],

  // Panel reference sizes
  SMALL_PANEL: {
    NAME: 'ACM 3mm',
    WIDTH: 96,   // 4ft
    HEIGHT: 48,  // 8ft
    MAX_X: 96,
    MAX_Y: 48
  },
  LARGE_PANEL: {
    NAME: 'ACM 3mm 5x10',
    WIDTH: 120,  // 5ft (actual panel)
    HEIGHT: 60,  // 10ft (actual panel)
    MAX_X: 300,  // Maximum backer size
    MAX_Y: 60
  },

  // Angle calculation constants
  ANGLE_LINEAR_DIVISOR: 240
};

// Removed: BackerPricingConfig interface - no longer needed with lookup tables

/**
 * Parse X x Y x Z format and calculate adjusted dimensions
 * Returns normalized [X, Y] where X is longest dimension
 */
function parseAndAdjustDimensions(input: number[]): { x: number; y: number; z: number } | null {
  if (!input || input.length !== 3) {
    return null;
  }

  const [x, y, z] = input;

  // Calculate adjusted dimensions
  const length = x + z * 2;
  const width = y + z * 2;

  // Normalize: longest dimension first
  const normalizedX = Math.max(length, width);
  const normalizedY = Math.min(length, width);

  return { x: normalizedX, y: normalizedY, z };
}

/**
 * Find the category bucket for a dimension (round up to next category)
 * Returns null if out of range
 */
function findCategory(value: number, categories: number[]): number | null {
  for (const category of categories) {
    if (value <= category) {
      return category;
    }
  }
  // Out of range
  return null;
}

// Removed: Old calculation and config loading functions
// All pricing now uses pre-calculated lookup tables from backerPricingLookup.ts

/**
 * Process a single hinged raceway field (field4 or field5)
 * Uses pre-calculated lookup tables
 */
function processHingedRacewayField(
  fieldName: string,
  fieldValue: number | undefined,
  lookupTables: BackerLookupTables
): { cost: number; inputDisplay: string } | null {
  if (!fieldValue || fieldValue <= 0) {
    return null;
  }

  // Find category bucket
  const category = findCategory(fieldValue, HINGED_RACEWAY_LOOKUP.CATEGORIES);
  if (!category) {
    throw new Error(
      `Hinged Raceway length out of range. Max: ${HINGED_RACEWAY_LOOKUP.CATEGORIES[HINGED_RACEWAY_LOOKUP.CATEGORIES.length - 1]}"`
    );
  }

  // Lookup price from pre-calculated table
  const price = lookupHingedRacewayPrice(category, lookupTables);
  if (price === null) {
    throw new Error(`Failed to lookup hinged raceway price for category ${category}"`);
  }

  return {
    cost: price,
    inputDisplay: `${fieldValue}: $${formatPrice(price)}`
  };
}

/**
 * Process a single ACM backer field (field6, field7, field8, or field9)
 * Uses pre-calculated lookup tables
 */
function processAcmField(
  fieldName: string,
  fieldValue: number[] | undefined,
  lookupTables: BackerLookupTables
): { cost: number; inputDisplay: string } | null {
  if (!fieldValue || fieldValue.length !== 2) {
    return null;
  }

  const [x, y] = fieldValue;

  // Find category buckets
  const categoryX = findCategory(x, ACM_CONSTANTS.X_CATEGORIES);
  const categoryY = findCategory(y, ACM_CONSTANTS.Y_CATEGORIES);

  if (!categoryX || !categoryY) {
    throw new Error(
      `ACM backer dimensions out of range. Max: ${ACM_CONSTANTS.X_CATEGORIES[ACM_CONSTANTS.X_CATEGORIES.length - 1]}" × ${ACM_CONSTANTS.Y_CATEGORIES[ACM_CONSTANTS.Y_CATEGORIES.length - 1]}"`
    );
  }

  // Lookup price from pre-calculated table
  const price = lookupAcmPrice(categoryX, categoryY, lookupTables);
  if (price === null) {
    throw new Error(`Failed to lookup ACM price for category ${categoryX}x${categoryY}"`);
  }

  return {
    cost: price,
    inputDisplay: `${x} x ${y}: $${formatPrice(price)}`
  };
}

/**
 * Process a single aluminum backer field (field1, field2, or field3)
 * Uses pre-calculated lookup tables
 */
function processAluminumField(
  fieldName: string,
  fieldValue: number[] | undefined,
  lookupTables: BackerLookupTables
): { cost: number; inputDisplay: string } | null {
  if (!fieldValue) {
    return null;
  }

  // Parse and adjust dimensions
  const dimensions = parseAndAdjustDimensions(fieldValue);
  if (!dimensions) {
    return null;
  }

  const { x, y, z } = dimensions;

  // Find category buckets
  const categoryX = findCategory(x, BACKER_CONSTANTS.X_CATEGORIES);
  const categoryY = findCategory(y, BACKER_CONSTANTS.Y_CATEGORIES);

  if (!categoryX || !categoryY) {
    throw new Error(
      `Backer dimensions out of range. Max: ${BACKER_CONSTANTS.X_CATEGORIES[BACKER_CONSTANTS.X_CATEGORIES.length - 1]}" × ${BACKER_CONSTANTS.Y_CATEGORIES[BACKER_CONSTANTS.Y_CATEGORIES.length - 1]}"`
    );
  }

  // Lookup price from pre-calculated table
  const price = lookupAluminumPrice(categoryX, categoryY, lookupTables);
  if (price === null) {
    throw new Error(`Failed to lookup aluminum price for category ${categoryX}x${categoryY}"`);
  }

  // Format display
  const originalInput = `${fieldValue[0]} x ${fieldValue[1]} x ${fieldValue[2]}`;

  return {
    cost: price,
    inputDisplay: `${originalInput}: $${formatPrice(price)}`
  };
}

/**
 * Calculate pricing for Backer products
 * Implements the ProductCalculator interface for product type ID 4
 * REQUIRES pre-calculated lookup tables for optimal performance
 *
 * Field mapping:
 * - field1: Alum XYZ (3D dimensions: X x Y x Z format)
 * - field2: Alum XYZ (3D dimensions: X x Y x Z format)
 * - field3: Alum XYZ (3D dimensions: X x Y x Z format)
 * - field4: RW 8" L (hinged raceway length - lookup table)
 * - field5: RW 8" L (hinged raceway length - lookup table)
 * - field6: ACM XY (2D dimensions - auto-selects panel size)
 * - field7: ACM XY (2D dimensions - auto-selects panel size)
 * - field8: ACM XY (2D dimensions - auto-selects panel size)
 * - field9: ACM XY (2D dimensions - auto-selects panel size)
 * - field10: Assem (assembly cost override - can be negative)
 */
export const calculateBacker = async (
  input: ValidatedPricingInput,
  lookupTables?: BackerLookupTables
): Promise<RowCalculationResult> => {
  // FAIL-FAST: Require lookup tables for performance
  if (!lookupTables) {
    throw new Error(
      'Backer pricing requires pre-calculated lookup tables. ' +
      'Ensure generateBackerLookupTables() is called during initialization.'
    );
  }
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    // Extract quantity
    const quantityRaw = input.parsedValues.quantity as string;
    const quantity = quantityRaw ? parseFloat(quantityRaw) : null;

    if (!quantity || quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Track individual results by type (NO database calls - all lookups!)
    const aluminumResults: { cost: number; inputDisplay: string }[] = [];
    const racewayResults: { cost: number; inputDisplay: string }[] = [];
    const acmResults: { cost: number; inputDisplay: string }[] = [];

    // ========== FIELDS 1-3: Aluminum Backers ==========
    for (let i = 1; i <= 3; i++) {
      const fieldName = `field${i}`;
      const fieldValue = input.parsedValues[fieldName] as number[] | undefined;

      const result = processAluminumField(fieldName, fieldValue, lookupTables);
      if (result) {
        aluminumResults.push(result);
      }
    }

    // ========== FIELDS 4-5: Hinged Raceway ==========
    for (let i = 4; i <= 5; i++) {
      const fieldName = `field${i}`;
      const fieldValue = input.parsedValues[fieldName] as number | undefined;

      const result = processHingedRacewayField(fieldName, fieldValue, lookupTables);
      if (result) {
        racewayResults.push(result);
      }
    }

    // ========== FIELDS 6-9: ACM Backers ==========
    for (let i = 6; i <= 9; i++) {
      const fieldName = `field${i}`;
      const fieldValue = input.parsedValues[fieldName] as number[] | undefined;

      const result = processAcmField(fieldName, fieldValue, lookupTables);
      if (result) {
        acmResults.push(result);
      }
    }

    // ========== Build Consolidated Components ==========
    const components: any[] = [];

    // Aluminum Backer component (all fields 1-3 consolidated)
    if (aluminumResults.length > 0) {
      const totalPrice = aluminumResults.reduce((sum, r) => sum + r.cost, 0);
      const calculationDisplay = aluminumResults.map(r => r.inputDisplay).join('\n');
      components.push({
        name: 'Aluminum Backer',
        price: totalPrice,
        type: 'aluminum_backer',
        calculationDisplay
      });
    }

    // Hinged Raceway component (all fields 4-5 consolidated)
    if (racewayResults.length > 0) {
      const totalPrice = racewayResults.reduce((sum, r) => sum + r.cost, 0);
      const calculationDisplay = racewayResults.map(r => r.inputDisplay).join('\n');
      components.push({
        name: 'Hinged Raceway',
        price: totalPrice,
        type: 'hinged_raceway',
        calculationDisplay
      });
    }

    // ACM Backer component (all fields 6-9 consolidated)
    if (acmResults.length > 0) {
      const totalPrice = acmResults.reduce((sum, r) => sum + r.cost, 0);
      const calculationDisplay = acmResults.map(r => r.inputDisplay).join('\n');
      components.push({
        name: 'ACM Backer',
        price: totalPrice,
        type: 'acm_backer',
        calculationDisplay
      });
    }

    // ========== FIELD 10: Assembly Override ==========
    const assemblyCostRaw = input.parsedValues.field10;
    if (assemblyCostRaw != null) {
      const cost = typeof assemblyCostRaw === 'string' ? parseFloat(assemblyCostRaw) : assemblyCostRaw;
      if (!isNaN(cost) && cost !== 0) {
        components.push({
          name: 'Assembly',
          price: cost,
          type: 'assembly_override'
        });
      }
    }

    // Must have at least one component
    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'No data to calculate',
        data: null
      };
    }

    // Calculate total from components
    const totalPrice = components.reduce((sum, c) => sum + c.price, 0);

    // Create calculation data
    const calculationData: PricingCalculationData = {
      productTypeId: 4,
      rowId: input.rowId,
      itemName: components.map(c => c.name).join(' + '),
      unitPrice: totalPrice,
      quantity,
      components
    };

    return {
      status: 'completed',
      display: `$${formatPrice(totalPrice)} × ${quantity} = $${formatPrice(totalPrice * quantity)}`,
      data: calculationData
    };

  } catch (error) {
    console.error('Backer pricing calculation error:', error);
    return {
      status: 'error',
      display: error.message || 'Calculation error',
      data: null
    };
  }
};
