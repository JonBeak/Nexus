// Vinyl Pricing Calculator
// Dedicated pricing logic for Vinyl products (Product Type 2)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

// Helper to format yards (remove decimals if whole number, otherwise 1 decimal)
const formatYards = (yards: number): string => {
  return yards % 1 === 0 ? yards.toString() : yards.toFixed(1);
};

// Vinyl pricing rates interface
interface VinylRates {
  translucentRate: number;
  perforatedRate: number;
  digitalPrintRate: number;
  feeSheet: number;
  feeCutSheet: number;
  feeCutYd: number;
}

/**
 * Fetch vinyl pricing rates from PricingDataResource
 * No fallbacks - fails clearly if data missing
 */
async function fetchVinylRates(): Promise<VinylRates> {
  // Get all vinyl rates using PricingDataResource (cached)
  const rateMap = await PricingDataResource.getVinylRatesMap();

  // Check for required rates
  const requiredRates = ['VINYL_TRANS', 'VINYL_PERF', 'DIGITAL_PRINT', 'FEE_SHEET', 'FEE_CUT_SHEET', 'FEE_CUT_YD'];
  const missingRates = requiredRates.filter(code => !rateMap[code]);

  if (missingRates.length > 0) {
    throw new Error(`Missing required vinyl pricing rates: ${missingRates.join(', ')}`);
  }

  return {
    translucentRate: rateMap['VINYL_TRANS'],
    perforatedRate: rateMap['VINYL_PERF'],
    digitalPrintRate: rateMap['DIGITAL_PRINT'],
    feeSheet: rateMap['FEE_SHEET'],
    feeCutSheet: rateMap['FEE_CUT_SHEET'],
    feeCutYd: rateMap['FEE_CUT_YD']
  };
}

/**
 * Calculate pricing for Vinyl products
 * Implements the ProductCalculator interface for product type ID 2
 *
 * Field mapping:
 * - field1: T (Standard vinyl - yards array)
 * - field2: Tc (Color cut vinyl - yards array)
 * - field3: Perf (Perforated vinyl - yards array)
 * - field4: Perf c (Perforated color cut - yards array)
 * - field5: Application fee (direct dollar amount)
 * - field6-10: Digital print - either dimensions (WxH format) or total square footage (float)
 */
export const calculateVinyl = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    // Extract parsed field values
    const quantityRaw = input.parsedValues.quantity as string;
    const quantity = quantityRaw ? parseFloat(quantityRaw) : null;

    if (!quantity || quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Fetch pricing rates
    const rates = await fetchVinylRates();

    // Arrays to collect descriptions and total price
    const vinylFields1to4: string[] = []; // Fields 1-4 go on same line
    const otherDescriptions: string[] = []; // Fields 5+ go on separate lines
    let totalPrice = 0;

    // ========== FIELD 1: Standard Vinyl (T) ==========
    const field1Yards = input.parsedValues.field1 as number[] | undefined;
    if (field1Yards && field1Yards.length > 0) {
      let fieldTotal = 0;
      const yardDescriptions: string[] = [];

      for (const yards of field1Yards) {
        // appFee = CEIL(yards/3) * FEE_SHEET
        const appFee = Math.ceil(yards / 3) * rates.feeSheet;
        // material = yards * VINYL_TRANS
        const material = yards * rates.translucentRate;
        const itemTotal = appFee + material;

        fieldTotal += itemTotal;
        yardDescriptions.push(formatYards(yards));
      }

      totalPrice += fieldTotal;
      vinylFields1to4.push(yardDescriptions.join(' + '));
    }

    // ========== FIELD 2: Translucent Color Cut (Tc) ==========
    const field2Yards = input.parsedValues.field2 as number[] | undefined;
    if (field2Yards && field2Yards.length > 0) {
      let fieldTotal = 0;
      const yardDescriptions: string[] = [];

      for (const yards of field2Yards) {
        // appFee = CEIL(yards/3) * (FEE_SHEET + FEE_CUT_SHEET)
        const appFee = Math.ceil(yards / 3) * (rates.feeSheet + rates.feeCutSheet);
        // material = yards * (VINYL_TRANS + FEE_CUT_YD)
        const material = yards * (rates.translucentRate + rates.feeCutYd);
        const itemTotal = appFee + material;

        fieldTotal += itemTotal;
        yardDescriptions.push(formatYards(yards) + 'c');
      }

      totalPrice += fieldTotal;
      vinylFields1to4.push(yardDescriptions.join(' + '));
    }

    // ========== FIELD 3: Perforated Vinyl (Perf) ==========
    const field3Yards = input.parsedValues.field3 as number[] | undefined;
    if (field3Yards && field3Yards.length > 0) {
      let fieldTotal = 0;
      const yardDescriptions: string[] = [];

      for (const yards of field3Yards) {
        // appFee = CEIL(yards/3) * FEE_SHEET
        const appFee = Math.ceil(yards / 3) * rates.feeSheet;
        // material = yards * VINYL_PERF
        const material = yards * rates.perforatedRate;
        const itemTotal = appFee + material;

        fieldTotal += itemTotal;
        yardDescriptions.push(formatYards(yards) + ' perf');
      }

      totalPrice += fieldTotal;
      vinylFields1to4.push(yardDescriptions.join(' + '));
    }

    // ========== FIELD 4: Perforated Color Cut (Perf c) ==========
    const field4Yards = input.parsedValues.field4 as number[] | undefined;
    if (field4Yards && field4Yards.length > 0) {
      let fieldTotal = 0;
      const yardDescriptions: string[] = [];

      for (const yards of field4Yards) {
        // appFee = CEIL(yards/3) * (FEE_SHEET + FEE_CUT_SHEET)
        const appFee = Math.ceil(yards / 3) * (rates.feeSheet + rates.feeCutSheet);
        // material = yards * (VINYL_PERF + FEE_CUT_YD)
        const material = yards * (rates.perforatedRate + rates.feeCutYd);
        const itemTotal = appFee + material;

        fieldTotal += itemTotal;
        yardDescriptions.push(formatYards(yards) + 'c perf');
      }

      totalPrice += fieldTotal;
      vinylFields1to4.push(yardDescriptions.join(' + '));
    }

    // ========== FIELD 5: Application Fee (Direct) ==========
    const applicationFee = input.parsedValues.field5 as number | undefined;
    if (applicationFee && applicationFee > 0) {
      totalPrice += applicationFee;
      otherDescriptions.push(`Application $${formatPrice(applicationFee)}`);
    }

    // ========== FIELDS 6-10: Digital Print ==========
    const digitalPrintFields = [
      { field: 'field6', value: input.parsedValues.field6 },
      { field: 'field7', value: input.parsedValues.field7 },
      { field: 'field8', value: input.parsedValues.field8 },
      { field: 'field9', value: input.parsedValues.field9 },
      { field: 'field10', value: input.parsedValues.field10 }
    ];

    for (const field of digitalPrintFields) {
      const fieldValue = field.value;

      // Check if it's dimensions [width, height] or a direct sqft float
      if (fieldValue !== undefined && fieldValue !== null) {
        let sqft: number;
        let dimensionPart: string = '';

        if (Array.isArray(fieldValue) && fieldValue.length === 2) {
          // Dimensions format [width, height]
          const [widthInches, heightInches] = fieldValue as [number, number];

          // Convert to quarter-foot precision: ROUNDUP(inches*4/12, 0)/4
          const widthFt = Math.ceil((widthInches * 4) / 12) / 4;
          const heightFt = Math.ceil((heightInches * 4) / 12) / 4;
          sqft = widthFt * heightFt;

          // Dimension part: "2x3ft "
          dimensionPart = `${formatYards(widthFt)}x${formatYards(heightFt)}ft `;
        } else if (typeof fieldValue === 'number') {
          // Direct sqft float
          sqft = fieldValue;
        } else {
          // Skip invalid values
          continue;
        }

        // Calculate costs for this field
        const materialCost = sqft * rates.digitalPrintRate;
        const setupFee = rates.feeSheet * 1.5; // $60 application fee per field
        const itemTotal = materialCost + setupFee;

        // Add to total
        totalPrice += itemTotal;

        // Format description: "2x3ft [6 sqft @ $8 + Application $60]" or "[15.5 sqft @ $8 + Application $60]"
        const description = `${dimensionPart}[${formatYards(sqft)} sqft @ $${formatPrice(rates.digitalPrintRate)} + Application $${formatPrice(setupFee)}]`;
        otherDescriptions.push(description);
      }
    }

    // ========== FINAL RESULT ==========
    if (totalPrice === 0 || (vinylFields1to4.length === 0 && otherDescriptions.length === 0)) {
      return {
        status: 'pending',
        display: 'Enter vinyl specifications',
        data: null
      };
    }

    // Build final description: fields 1-4 on same line separated by " + ", then rest on new lines
    const finalDescriptions: string[] = [];

    // Add fields 1-4 as a single line if any exist
    if (vinylFields1to4.length > 0) {
      finalDescriptions.push(vinylFields1to4.join(' + '));
    }

    // Add other fields on separate lines
    finalDescriptions.push(...otherDescriptions);

    // Single component with "Vinyl" as name and detailed breakdown in calculationDisplay
    const component: ComponentItem = {
      name: 'Vinyl',
      price: totalPrice,
      type: 'vinyl',
      calculationDisplay: finalDescriptions.join('\n')
    };

    const calculationData: PricingCalculationData = {
      productTypeId: 2,
      rowId: input.rowId,
      itemName: 'Vinyl',
      unitPrice: totalPrice,
      quantity: quantity,
      components: [component],
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: '', // Not used - components have their own calculationDisplay
      data: calculationData
    };

  } catch (error) {
    console.error('Vinyl pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
