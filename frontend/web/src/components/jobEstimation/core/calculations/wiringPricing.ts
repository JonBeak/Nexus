// Wiring Product Pricing Calculator
// Dedicated pricing logic for Wiring products (Product Type 10, 19)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData, ComponentItem } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

// =====================================================
// TYPE-SAFE FIELD EXTRACTION
// =====================================================
interface ExtractedWiringFields {
  quantity: number | null;
  dcPlugCount: number | undefined;        // field1: DC Plug count
  dcPlugPriceOverride: number | undefined; // field2: DC Plug price override
  wallPlugCount: number | undefined;      // field3: Wall Plug count
  wallPlugPriceOverride: number | undefined; // field4: Wall Plug price override
  wirePieceCount: number | undefined;     // field7: Number of wire pieces
  wireLengthPerPiece: number | undefined; // field8: Length per piece (feet)
  wireTotalLength: number | undefined;    // field9: Additional total length (feet)
  wireCostOverride: number | undefined;   // field10: Wire cost per foot override
}

/**
 * Extract and type-cast field values from parsed input
 */
const extractFields = (parsedValues: Record<string, unknown>): ExtractedWiringFields => {
  const quantityRaw = parsedValues.quantity as string;

  return {
    quantity: quantityRaw ? parseFloat(quantityRaw) : null,
    dcPlugCount: parsedValues.field1 as number | undefined,
    dcPlugPriceOverride: parsedValues.field2 as number | undefined,
    wallPlugCount: parsedValues.field3 as number | undefined,
    wallPlugPriceOverride: parsedValues.field4 as number | undefined,
    wirePieceCount: parsedValues.field7 as number | undefined,
    wireLengthPerPiece: parsedValues.field8 as number | undefined,
    wireTotalLength: parsedValues.field9 as number | undefined,
    wireCostOverride: parsedValues.field10 as number | undefined
  };
};

/**
 * Calculate pricing for Wiring products
 * Implements the ProductCalculator interface for product type IDs 10 and 19
 *
 * Field mapping:
 * - field1: DCPlug # (count)
 * - field2: DCPlug $ (price override)
 * - field3: WallPlug # (count)
 * - field4: WallPlug $ (price override)
 * - field7: # Pcs (number of wire pieces)
 * - field8: Len ft (length per piece in feet)
 * - field9: Total ft (additional total length in feet)
 * - field10: ~ $/ft ~ (wire cost per foot override)
 *
 * Component Logic:
 * 1. Plugs Component (if field1 OR field3 filled):
 *    - DC Plugs: field1 × (field2 OR database dc_plug_cost_per_unit)
 *    - Wall Plugs: field3 × (field4 OR database wall_plug_cost_per_unit)
 *    - Combined into one component with multi-line calculationDisplay
 *
 * 2. Wiring Component (if field7&8 OR field9 filled):
 *    - Total length = (field7 × field8) + field9
 *    - Wire cost = Total length × (field10 OR database wire_cost_per_ft)
 */
export const calculateWiring = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    // Extract and validate fields
    const fields = extractFields(input.parsedValues);

    if (!fields.quantity || fields.quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Fetch pricing data from database
    const wiringPricing = await PricingDataResource.getWiringPricing();

    if (!wiringPricing) {
      return {
        status: 'error',
        display: 'Wiring pricing not found in database',
        data: null
      };
    }

    // Parse decimal values from database to numbers
    const dcPlugCostPerUnit = parseFloat(wiringPricing.dc_plug_cost_per_unit as any);
    const wallPlugCostPerUnit = parseFloat(wiringPricing.wall_plug_cost_per_unit as any);
    const wireCostPerFt = parseFloat(wiringPricing.wire_cost_per_ft as any);

    const components: ComponentItem[] = [];

    // ========== PLUGS COMPONENT (field1-4) ==========
    const hasDcPlugs = fields.dcPlugCount && fields.dcPlugCount > 0;
    const hasWallPlugs = fields.wallPlugCount && fields.wallPlugCount > 0;

    if (hasDcPlugs || hasWallPlugs) {
      let plugsTotalCost = 0;
      const plugsDisplayLines: string[] = [];

      // DC Plugs calculation
      if (hasDcPlugs) {
        const dcPlugPrice = fields.dcPlugPriceOverride ?? dcPlugCostPerUnit;
        const dcPlugsCost = fields.dcPlugCount! * dcPlugPrice;
        plugsTotalCost += dcPlugsCost;
        plugsDisplayLines.push(
          `${fields.dcPlugCount} DC Plugs @ $${formatPrice(dcPlugPrice)}/ea`
        );
      }

      // Wall Plugs calculation
      if (hasWallPlugs) {
        const wallPlugPrice = fields.wallPlugPriceOverride ?? wallPlugCostPerUnit;
        const wallPlugsCost = fields.wallPlugCount! * wallPlugPrice;
        plugsTotalCost += wallPlugsCost;
        plugsDisplayLines.push(
          `${fields.wallPlugCount} Wall Plugs @ $${formatPrice(wallPlugPrice)}/ea`
        );
      }

      // Add single Plugs component with multi-line display
      components.push({
        name: 'Plugs',
        price: plugsTotalCost,
        type: 'plugs',
        calculationDisplay: plugsDisplayLines.join('\n')
      });
    }

    // ========== WIRING COMPONENT (field7-10) ==========
    const hasWirePieces = fields.wirePieceCount && fields.wireLengthPerPiece;
    const hasTotalLength = fields.wireTotalLength && fields.wireTotalLength > 0;

    if (hasWirePieces || hasTotalLength) {
      // Calculate total wire length
      let totalWireLength = 0;
      const wireLengthFromPieces = hasWirePieces
        ? fields.wirePieceCount! * fields.wireLengthPerPiece!
        : 0;
      const additionalLength = fields.wireTotalLength ?? 0;
      totalWireLength = wireLengthFromPieces + additionalLength;

      if (totalWireLength > 0) {
        const effectiveWireCostPerFt = fields.wireCostOverride ?? wireCostPerFt;
        const wiringTotalCost = totalWireLength * effectiveWireCostPerFt;

        // Build display showing calculation breakdown
        const displayParts: string[] = [];

        if (hasWirePieces) {
          displayParts.push(`${fields.wirePieceCount} pcs × ${formatPrice(fields.wireLengthPerPiece!)}ft`);
        }
        if (hasTotalLength) {
          displayParts.push(`${formatPrice(additionalLength)}ft total`);
        }

        const calculationDisplay = displayParts.length > 1
          ? `${displayParts.join(' + ')} = ${formatPrice(totalWireLength)}ft @ $${formatPrice(effectiveWireCostPerFt)}/ft`
          : `${formatPrice(totalWireLength)}ft @ $${formatPrice(effectiveWireCostPerFt)}/ft`;

        components.push({
          name: 'Wiring',
          price: wiringTotalCost,
          type: 'wiring',
          calculationDisplay
        });
      }
    }

    // ========== FINAL RESULT ==========
    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'Enter plug or wiring data',
        data: null
      };
    }

    // Calculate total from components
    const totalPrice = components.reduce((sum, c) => sum + c.price, 0);

    const calculationData: PricingCalculationData = {
      productTypeId: input.productTypeId, // Supports both 10 and 19
      rowId: input.rowId,
      itemName: components.map(c => c.name).join(' + '),
      unitPrice: totalPrice,
      quantity: fields.quantity,
      components,
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: `$${formatPrice(totalPrice)} × ${fields.quantity} = $${formatPrice(totalPrice * fields.quantity)}`,
      data: calculationData
    };

  } catch (error) {
    console.error('[Wiring Calculator] Calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
