// Painting Pricing Calculator
// Dedicated pricing logic for Painting products (Product Type 8)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

/**
 * Parse dimensions from "X x Y" format
 * Returns [X, Y] array if successful, null if invalid
 */
const parseDimensions = (value: unknown): [number, number] | null => {
  if (!value) return null;

  // If it's already an array (from validation layer), return it
  if (Array.isArray(value) && value.length === 2) {
    return [value[0], value[1]];
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parts = value.toLowerCase().split('x').map(p => p.trim());
    if (parts.length === 2) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (!isNaN(x) && !isNaN(y)) {
        return [x, y];
      }
    }
  }

  return null;
};

/**
 * Calculate pricing for Painting products
 * Implements the ProductCalculator interface for product type ID 8
 *
 * Field mapping:
 * - field1: Prep Hrs (hourly prep time)
 * - field2: Primer (Yes/No - adds 0.5 to multiplier)
 * - field3: Clear (Yes/No - adds 0.5 to multiplier)
 * - field5: FaceXY (X x Y dimensions)
 * - field6: FaceXY (X x Y dimensions)
 * - field7: 3" Return (linear length in inches)
 * - field8: 4" Return (linear length in inches)
 * - field9: 5" Return (linear length in inches)
 * - field10: Trim Cap (linear length in inches)
 */
export const calculatePainting = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
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

    // Get painting pricing configuration from database
    const paintingPricing = await PricingDataResource.getPaintingPricing();

    if (!paintingPricing) {
      return {
        status: 'error',
        display: 'Painting pricing configuration not found',
        error: 'No painting pricing data available in database',
        data: null
      };
    }

    // Parse database values as numbers (they come as strings/decimals from MySQL)
    const sqftPrice = parseFloat(String(paintingPricing.sqft_price));
    const prepRatePerHour = parseFloat(String(paintingPricing.prep_rate_per_hour));
    const return3inSqft = parseFloat(String(paintingPricing.return_3in_sqft_per_length));
    const return4inSqft = parseFloat(String(paintingPricing.return_4in_sqft_per_length));
    const return5inSqft = parseFloat(String(paintingPricing.return_5in_sqft_per_length));
    const trimCapSqft = parseFloat(String(paintingPricing.trim_cap_sqft_per_length));

    const components: ComponentItem[] = [];
    let totalPrice = 0;
    let paintingTotal = 0; // Track area + returns + trim separately from prep

    // Extract field values
    const prepHours = (input.parsedValues.field1 as number) || 0;
    const primer = input.parsedValues.field2 as string;
    const clear = input.parsedValues.field3 as string;
    const face1 = input.parsedValues.field5;
    const face2 = input.parsedValues.field6;
    const return3in = (input.parsedValues.field7 as number) || 0;
    const return4in = (input.parsedValues.field8 as number) || 0;
    const return5in = (input.parsedValues.field9 as number) || 0;
    const trimCap = (input.parsedValues.field10 as number) || 0;

    // Calculate paint multiplier (starts at 1.0)
    let paintMultiplier = 1.0;
    if (primer && (primer.toLowerCase() === 'yes' || primer === 'Yes')) {
      paintMultiplier += 0.5;
    }
    if (clear && (clear.toLowerCase() === 'yes' || clear === 'Yes')) {
      paintMultiplier += 0.5;
    }

    // 1. PREP CHARGE (if prep hours specified) - NOT included in minimum
    let prepCost = 0;
    if (prepHours > 0) {
      prepCost = prepHours * prepRatePerHour;
      components.push({
        name: 'Prep Work',
        price: prepCost,
        type: 'prep',
        calculationDisplay: `${formatPrice(prepHours)} hrs @ $${formatPrice(prepRatePerHour)}/hr`,
        prepRate: prepRatePerHour
      });
    }

    // 2. FACE PAINTING (field5, field6) - Can be dimensions OR float (direct sqft)
    const processFace = (faceValue: unknown, faceNumber: number) => {
      // Try parsing as dimensions first
      const dims = parseDimensions(faceValue);

      if (dims) {
        // Input was dimensions like "24x18"
        const [x, y] = dims;
        const sqftRaw = (x * y) / 144; // Convert square inches to square feet
        const sqft = Math.ceil(sqftRaw); // Round UP to nearest whole number
        const faceCost = sqft * sqftPrice * paintMultiplier;

        components.push({
          name: `Face ${faceNumber}`,
          price: faceCost,
          type: 'face_paint',
          calculationDisplay: `${formatPrice(x)}x${formatPrice(y)}[${sqft}sqft]`,
          displayType: 'dimensions',
          sqft: sqft
        });
        paintingTotal += faceCost;
      } else if (typeof faceValue === 'number' && faceValue > 0) {
        // Input was direct sqft like "7"
        const sqft = Math.ceil(faceValue); // Round UP to nearest whole number
        const faceCost = sqft * sqftPrice * paintMultiplier;

        components.push({
          name: `Face ${faceNumber}`,
          price: faceCost,
          type: 'face_paint',
          calculationDisplay: `[${sqft}sqft]`,
          displayType: 'float',
          sqft: sqft
        });
        paintingTotal += faceCost;
      }
    };

    if (face1) processFace(face1, 1);
    if (face2) processFace(face2, 2);

    // 3. RETURNS & TRIM (fields 7-10)
    // Each calculates: num_pieces = ceil(length / 118), then sqft = num_pieces * sqft_per_length

    if (return3in > 0) {
      const numPieces = Math.ceil(return3in / 118);
      const sqftRaw = numPieces * return3inSqft;
      const sqft = Math.ceil(sqftRaw); // Round UP to nearest whole number
      const cost = sqft * sqftPrice * paintMultiplier;

      components.push({
        name: '3" Return',
        price: cost,
        type: 'return_3in',
        calculationDisplay: `${numPieces}x3"[${sqft}sqft]`,
        count: numPieces
      });
      paintingTotal += cost;
    }

    if (return4in > 0) {
      const numPieces = Math.ceil(return4in / 118);
      const sqftRaw = numPieces * return4inSqft;
      const sqft = Math.ceil(sqftRaw); // Round UP to nearest whole number
      const cost = sqft * sqftPrice * paintMultiplier;

      components.push({
        name: '4" Return',
        price: cost,
        type: 'return_4in',
        calculationDisplay: `${numPieces}x4"[${sqft}sqft]`,
        count: numPieces
      });
      paintingTotal += cost;
    }

    if (return5in > 0) {
      const numPieces = Math.ceil(return5in / 118);
      const sqftRaw = numPieces * return5inSqft;
      const sqft = Math.ceil(sqftRaw); // Round UP to nearest whole number
      const cost = sqft * sqftPrice * paintMultiplier;

      components.push({
        name: '5" Return',
        price: cost,
        type: 'return_5in',
        calculationDisplay: `${numPieces}x5"[${sqft}sqft]`,
        count: numPieces
      });
      paintingTotal += cost;
    }

    if (trimCap > 0) {
      const numPieces = Math.ceil(trimCap / 118);
      const sqftRaw = numPieces * trimCapSqft;
      const sqft = Math.ceil(sqftRaw); // Round UP to nearest whole number
      const cost = sqft * sqftPrice * paintMultiplier;

      components.push({
        name: 'Trim Cap',
        price: cost,
        type: 'trim_cap',
        calculationDisplay: `${numPieces}xtrim[${sqft}sqft]`,
        count: numPieces
      });
      paintingTotal += cost;
    }

    // Check if we have any components
    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'Enter at least one painting item',
        data: null
      };
    }

    // Apply $200 minimum to painting total (area + returns + trim, NOT prep)
    const MINIMUM_PAINT_PRICE = 200;
    const originalPaintingTotal = paintingTotal;
    let minimumApplied = false;

    if (paintingTotal > 0 && paintingTotal < MINIMUM_PAINT_PRICE) {
      paintingTotal = MINIMUM_PAINT_PRICE;
      minimumApplied = true;
    }

    // Calculate final total price
    totalPrice = prepCost + paintingTotal;

    // Build combined calculation display string with line breaks
    // Format:
    // Line 1: "Prep: 2hrs @ $50/hr"
    // Line 2: "Area: 45x20[7sqft] + 20x45[7sqft]"
    // Line 3: "3x 3\" Return, 2x 4\" Return, 1x Trim"
    // Line 4: "@ $25/sqft (1.5x mult)"
    const displayLines: string[] = [];

    // 1. Prep work (with hourly rate)
    const prepComponent = components.find(c => c.type === 'prep');
    if (prepComponent) {
      displayLines.push(prepComponent.calculationDisplay || '');
    }

    // 2. All face painting areas combined into one "Area:" line (without pricing)
    const faceComponents = components.filter(c => c.type === 'face_paint');
    if (faceComponents.length > 0) {
      const areaDisplays = faceComponents.map(c => c.calculationDisplay).filter(d => d);
      if (areaDisplays.length > 0) {
        displayLines.push(`Area: ${areaDisplays.join(' + ')}`);
      }
    }

    // 3. Returns & Trim (combined on one line, with counts)
    const returnTrimParts: string[] = [];

    const return3Component = components.find(c => c.type === 'return_3in');
    if (return3Component && (return3Component as any).count) {
      const count = (return3Component as any).count;
      returnTrimParts.push(`${count}x 3" Return`);
    }

    const return4Component = components.find(c => c.type === 'return_4in');
    if (return4Component && (return4Component as any).count) {
      const count = (return4Component as any).count;
      returnTrimParts.push(`${count}x 4" Return`);
    }

    const return5Component = components.find(c => c.type === 'return_5in');
    if (return5Component && (return5Component as any).count) {
      const count = (return5Component as any).count;
      returnTrimParts.push(`${count}x 5" Return`);
    }

    const trimComponent = components.find(c => c.type === 'trim_cap');
    if (trimComponent && (trimComponent as any).count) {
      const count = (trimComponent as any).count;
      returnTrimParts.push(`${count}x Trim`);
    }

    if (returnTrimParts.length > 0) {
      displayLines.push(returnTrimParts.join(', '));
    }

    // 4. sqft pricing line at bottom (only if Area, Return, or Trim exists)
    const hasAreaOrReturnOrTrim = faceComponents.length > 0 || returnTrimParts.length > 0;
    if (hasAreaOrReturnOrTrim) {
      // Format multiplier display with Primer/Clear info
      let multDisplay = '';
      if (paintMultiplier > 1.0) {
        const options: string[] = [];
        if (primer && (primer.toLowerCase() === 'yes' || primer === 'Yes')) {
          options.push('Primer');
        }
        if (clear && (clear.toLowerCase() === 'yes' || clear === 'Yes')) {
          options.push('Clear');
        }

        if (options.length > 0) {
          multDisplay = ` (${options.join(', ')} - ${formatPrice(paintMultiplier)}x mult)`;
        } else {
          multDisplay = ` (${formatPrice(paintMultiplier)}x mult)`;
        }
      }

      displayLines.push(`@ $${formatPrice(sqftPrice)}/sqft${multDisplay}`);

      // Show minimum price if applied
      if (minimumApplied) {
        displayLines.push(`Minimum paint price: $${formatPrice(MINIMUM_PAINT_PRICE)}`);
      }
    }

    const combinedDisplay = displayLines.join('\n');

    // Build the pricing calculation data with ONE combined component
    const unitPrice = totalPrice; // Total price for one set

    const pricingData: PricingCalculationData = {
      productTypeId: 8,
      rowId: input.rowId,
      itemName: 'Painting',
      description: `${components.length} component(s)`,
      unitPrice: unitPrice,
      quantity: quantity,
      components: [{
        name: 'Painting',
        price: unitPrice,
        type: 'painting_combined',
        calculationDisplay: combinedDisplay
      }],
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: '', // Not used - component has calculationDisplay
      data: pricingData
    };

  } catch (error) {
    console.error('Painting pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      error: error instanceof Error ? error.message : 'Unknown calculation error',
      data: null
    };
  }
};
