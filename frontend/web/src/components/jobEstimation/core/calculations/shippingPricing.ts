// Shipping Pricing Calculator
// Dedicated pricing logic for Shipping products (Product Type 13)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

// Helper function to format counts (remove decimals if whole number)
const formatCount = (count: number): string => {
  return count % 1 === 0 ? count.toString() : count.toFixed(1);
};

// Shipping rates interface
interface ShippingRates {
  bRate: number;
  bbRate: number;
  bigBRate: number;
  bigBBRate: number;
  tailgateRate: number;
}

/**
 * Fetch shipping pricing rates from PricingDataResource
 * No fallbacks - fails clearly if data missing
 */
async function fetchShippingRates(): Promise<ShippingRates> {
  // Get all shipping rates using PricingDataResource (cached)
  const rateMap = await PricingDataResource.getShippingRatesMap();

  // Check for required rates
  const requiredRates = ['SHIP_B', 'SHIP_BB', 'SHIP_BIG_B', 'SHIP_BIG_BB', 'SHIP_TAILGATE'];
  const missingRates = requiredRates.filter(code => !rateMap[code]);

  if (missingRates.length > 0) {
    throw new Error(`Missing required shipping pricing rates: ${missingRates.join(', ')}`);
  }

  return {
    bRate: rateMap['SHIP_B'],
    bbRate: rateMap['SHIP_BB'],
    bigBRate: rateMap['SHIP_BIG_B'],
    bigBBRate: rateMap['SHIP_BIG_BB'],
    tailgateRate: rateMap['SHIP_TAILGATE']
  };
}

/**
 * Calculate pricing for Shipping products
 * Implements the ProductCalculator interface for product type ID 13
 *
 * Field mapping:
 * - field1: Base (can be negative) - base shipping cost
 * - field2: Multi (positive, default from customer pref) - multiplier for base
 * - field3: b (small box count) - count × $25
 * - field4: bb (medium box count) - count × $40
 * - field5: B (large box count) - count × $55
 * - field6: BB (extra large box count) - count × $80
 * - field7: Pallet - flat dollar amount (not multiplied)
 * - field8: Crate - flat dollar amount (not multiplied)
 * - field9: Tailgate - count × $80
 * - field10: #Days - integer, only in description (not in pricing)
 *
 * Pricing formula:
 * Price = Base * Multi + (#b * $b_rate) + (#bb * $bb_rate) + (#B * $big_b_rate) +
 *         (#BB * $big_bb_rate) + (#Tailgate * $tailgate_rate) + Pallet + Crate
 */
export const calculateShipping = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
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
    const rates = await fetchShippingRates();

    // Extract field values with defaults
    const base = (input.parsedValues.field1 as number) ?? 0;

    // Multi defaults from customer preferences if not provided
    let multi = input.parsedValues.field2 as number | undefined;
    if (multi === undefined || multi === null) {
      // Get default from customer preferences (parse as decimal comes as string from MySQL)
      const prefMulti = input.customerPreferences?.pref_shipping_multiplier;

      if (prefMulti === undefined || prefMulti === null) {
        return {
          status: 'error',
          display: 'Multi field required: enter value or set customer shipping multiplier preference',
          data: null
        };
      }

      // Parse to number (MySQL decimals come as strings)
      multi = typeof prefMulti === 'number' ? prefMulti : parseFloat(prefMulti);

      if (isNaN(multi)) {
        return {
          status: 'error',
          display: 'Invalid shipping multiplier in customer preferences',
          data: null
        };
      }
    }

    const bCount = (input.parsedValues.field3 as number) ?? 0;
    const bbCount = (input.parsedValues.field4 as number) ?? 0;
    const bigBCount = (input.parsedValues.field5 as number) ?? 0;
    const bigBBCount = (input.parsedValues.field6 as number) ?? 0;
    const palletFlat = (input.parsedValues.field7 as number) ?? 0;
    const crateFlat = (input.parsedValues.field8 as number) ?? 0;
    const tailgateCount = (input.parsedValues.field9 as number) ?? 0;
    const days = (input.parsedValues.field10 as number) ?? 0;

    // Calculate total price
    const baseTotal = base * multi;
    const bTotal = bCount * rates.bRate;
    const bbTotal = bbCount * rates.bbRate;
    const bigBTotal = bigBCount * rates.bigBRate;
    const bigBBTotal = bigBBCount * rates.bigBBRate;
    const tailgateTotal = tailgateCount * rates.tailgateRate;

    const totalPrice = baseTotal + bTotal + bbTotal + bigBTotal + bigBBTotal +
                       tailgateTotal + palletFlat + crateFlat;

    // Build description parts (multi-line format)
    const descriptionLines: string[] = [];

    // Line 1: Base(xMulti) [#Days]
    const baseParts: string[] = [];
    if (base !== 0 && multi !== 0) {
      baseParts.push(`Base ${formatPrice(base)}(x${formatCount(multi)})`);
    }
    if (days > 0) {
      baseParts.push(`[${days} days]`);
    }
    if (baseParts.length > 0) {
      descriptionLines.push(baseParts.join(' '));
    }

    // Line 2: Boxes with rates (format: 2 b[$25])
    const boxParts: string[] = [];
    if (bCount > 0) {
      boxParts.push(`${formatCount(bCount)} b[$${formatPrice(rates.bRate)}]`);
    }
    if (bbCount > 0) {
      boxParts.push(`${formatCount(bbCount)} bb[$${formatPrice(rates.bbRate)}]`);
    }
    if (bigBCount > 0) {
      boxParts.push(`${formatCount(bigBCount)} B[$${formatPrice(rates.bigBRate)}]`);
    }
    if (bigBBCount > 0) {
      boxParts.push(`${formatCount(bigBBCount)} BB[$${formatPrice(rates.bigBBRate)}]`);
    }
    if (boxParts.length > 0) {
      descriptionLines.push(boxParts.join(' + '));
    }

    // Line 3: Pallet, Crate, Tailgate (format: 1 Tailgate[$80])
    const serviceParts: string[] = [];
    if (palletFlat > 0) {
      serviceParts.push(`Pallet: $${formatPrice(palletFlat)}`);
    }
    if (crateFlat > 0) {
      serviceParts.push(`Crate: $${formatPrice(crateFlat)}`);
    }
    if (tailgateCount > 0) {
      serviceParts.push(`${formatCount(tailgateCount)} Tailgate[$${formatPrice(rates.tailgateRate)}]`);
    }
    if (serviceParts.length > 0) {
      descriptionLines.push(serviceParts.join(' + '));
    }

    // ========== FINAL RESULT ==========
    if (descriptionLines.length === 0) {
      return {
        status: 'pending',
        display: 'Enter shipping specifications',
        data: null
      };
    }

    // Build final description (multi-line with newline separators)
    const finalDescription = descriptionLines.join('\n');

    // Single component with "Shipping" as name and detailed breakdown
    const component: ComponentItem = {
      name: 'Shipping',
      price: totalPrice,
      type: 'shipping',
      calculationDisplay: finalDescription
    };

    const calculationData: PricingCalculationData = {
      productTypeId: 13,
      rowId: input.rowId,
      itemName: 'Shipping',
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
    console.error('Shipping pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
