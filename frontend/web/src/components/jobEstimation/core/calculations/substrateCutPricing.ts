// Substrate Cut Pricing Calculator
// Dedicated pricing logic for Substrate Cut products (Product Type 3)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

/**
 * Calculate pricing for Substrate Cut products
 * Implements the ProductCalculator interface for product type ID 3
 *
 * Field mapping:
 * - field1: Type (substrate type dropdown)
 * - field2: XY (dimensions in X x Y format)
 * - field3: Pins (number of pins) - works with field4
 * - field4: Pin Type (dropdown - includes "Stand Offs" option)
 * - field5: D-tape (manual cost input - can be negative)
 * - field6: Assem (manual cost input - can be negative)
 * - field10: ~ Cut ~ (cutting cost override - can be negative)
 *
 * Component Logic:
 * - If field1&2 filled: Combine all into ONE "Substrate Cut" component
 * - If field1&2 empty: Split into separate components (Pins, D-tape, Assembly, Cutting)
 */
export const calculateSubstrateCut = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
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

    // Fetch pricing data
    const substratePricingMap = await PricingDataResource.getSubstrateCutPricingMap();
    const basePricingMap = await PricingDataResource.getSubstrateCutBasePricingMap();

    // Track individual component costs and descriptions
    interface ComponentData {
      cost: number;
      description: string;
      detailDisplay?: string;
    }

    let materialAndCutting: ComponentData | null = null;
    let pinsComponent: ComponentData | null = null;
    let dtapeComponent: ComponentData | null = null;
    let assemblyComponent: ComponentData | null = null;
    let cuttingComponent: ComponentData | null = null;

    // ========== FIELD 1 & 2: Substrate Material + Cutting ==========
    const substrateType = input.parsedValues.field1 as string | undefined;
    const dimensionsArray = input.parsedValues.field2 as number[] | undefined;
    const cutOverrideRaw = input.parsedValues.field10;

    const hasSubstrateMaterial = substrateType && substrateType.trim() && dimensionsArray && dimensionsArray.length === 2;

    // Variables that need to be accessible in component building phase
    let sheetsNeeded = 0;
    let substratePricing: any = null;

    if (hasSubstrateMaterial) {
      substratePricing = substratePricingMap[substrateType];
      if (!substratePricing) {
        return {
          status: 'error',
          display: `Unknown substrate type: ${substrateType}`,
          data: null
        };
      }

      const width = dimensionsArray[0];
      const height = dimensionsArray[1];
      const squareFeet = (width * height) / 144;
      const sheetSizeSqft = substratePricing.sheet_size_sqft || 32;
      sheetsNeeded = squareFeet / sheetSizeSqft;

      // Material Cost
      const materialBaseCost = basePricingMap['material_base_cost'] || 0;
      const materialCostPerSheet = substratePricing.material_cost_per_sheet || 0;
      const markupMultiplier = basePricingMap['material_markup_multiplier'] || 1.0;

      const materialCost =
        Math.ceil(sheetsNeeded) * materialBaseCost +
        sheetsNeeded * materialCostPerSheet * markupMultiplier;

      // Cutting Cost (check field10 override first)
      let cuttingCost = 0;
      let cutDescription = '';

      if (cutOverrideRaw != null) {
        const cost = typeof cutOverrideRaw === 'string' ? parseFloat(cutOverrideRaw) : cutOverrideRaw;
        if (!isNaN(cost)) {
          cuttingCost = cost;
          cutDescription = ` • Cut: $${formatPrice(cost)}`;
        }
      } else {
        // Calculate cutting from sheets
        const cuttingBaseCost = basePricingMap['cutting_base_cost'] || 0;
        const cuttingRatePerSheet = substratePricing.cutting_rate_per_sheet || 0;
        cuttingCost = Math.ceil(sheetsNeeded) * cuttingBaseCost + sheetsNeeded * cuttingRatePerSheet;
      }

      materialAndCutting = {
        cost: materialCost + cuttingCost,
        description: `${substrateType} - ${width}" x ${height}"`,
        detailDisplay: `${substrateType} • ${width}" x ${height}"${cutDescription}`
      };
    }

    // ========== FIELD 3 & 4: Pins (including Stand Offs) ==========
    const pinsCountRaw = input.parsedValues.field3;
    const pinType = input.parsedValues.field4 as string | undefined;

    if (pinsCountRaw && pinType) {
      const pins = typeof pinsCountRaw === 'string' ? parseFloat(pinsCountRaw) : pinsCountRaw;
      if (!isNaN(pins) && pins > 0) {
        const pinPricing = await PricingDataResource.getPinType(pinType);
        if (pinPricing) {
          const pinCost = pins * pinPricing.base_cost;
          pinsComponent = {
            cost: pinCost,
            description: `${pins} ${pinType}`,
            detailDisplay: `${pins} ${pinType} @ $${formatPrice(pinPricing.base_cost)}/ea: $${formatPrice(pinCost)}`
          };
        }
      }
    }

    // ========== FIELD 5: D-tape (manual cost) ==========
    const dtapeCostRaw = input.parsedValues.field5;
    if (dtapeCostRaw != null) {
      const cost = typeof dtapeCostRaw === 'string' ? parseFloat(dtapeCostRaw) : dtapeCostRaw;
      if (!isNaN(cost) && cost !== 0) {
        dtapeComponent = {
          cost,
          description: `D-tape: $${formatPrice(cost)}`,
          detailDisplay: `Manual cost: $${formatPrice(cost)}`
        };
      }
    }

    // ========== FIELD 6: Assembly (manual cost) ==========
    const assemblyCostRaw = input.parsedValues.field6;
    if (assemblyCostRaw != null) {
      const cost = typeof assemblyCostRaw === 'string' ? parseFloat(assemblyCostRaw) : assemblyCostRaw;
      if (!isNaN(cost) && cost !== 0) {
        assemblyComponent = {
          cost,
          description: `Assembly: $${formatPrice(cost)}`,
          detailDisplay: `Manual cost: $${formatPrice(cost)}`
        };
      }
    }

    // ========== FIELD 10: Cutting (standalone, only if no substrate material) ==========
    if (!hasSubstrateMaterial) {
      const cutOverrideRaw = input.parsedValues.field10;
      if (cutOverrideRaw != null) {
        const cost = typeof cutOverrideRaw === 'string' ? parseFloat(cutOverrideRaw) : cutOverrideRaw;
        if (!isNaN(cost) && cost !== 0) {
          cuttingComponent = {
            cost,
            description: `Cutting: $${formatPrice(cost)}`,
            detailDisplay: `Manual cost: $${formatPrice(cost)}`
          };
        }
      }
    }

    // ========== BUILD COMPONENTS BASED ON SCENARIO ==========
    const components: any[] = [];

    if (hasSubstrateMaterial) {
      // SCENARIO 1: Substrate material present → combine everything
      let totalCost = 0;
      const displayLines: string[] = [];

      // Line 1: Material info with sheet price + Material cost total
      if (materialAndCutting) {
        const width = dimensionsArray![0];
        const height = dimensionsArray![1];
        const sheetPrice = substratePricingMap[substrateType!].material_cost_per_sheet || 0;
        const materialCost = materialAndCutting.cost - (cutOverrideRaw != null ?
          (typeof cutOverrideRaw === 'string' ? parseFloat(cutOverrideRaw) : cutOverrideRaw) :
          (Math.ceil(sheetsNeeded) * (basePricingMap['cutting_base_cost'] || 0) +
           sheetsNeeded * (substratePricingMap[substrateType!].cutting_rate_per_sheet || 0))
        );

        displayLines.push(`${substrateType} [${width}x${height}]@$${Math.round(sheetPrice)}: $${formatPrice(materialCost)}`);
        totalCost += materialAndCutting.cost;
      }

      // Line 2: Cutting cost total
      if (materialAndCutting) {
        const cuttingCost = materialAndCutting.cost - (Math.ceil(sheetsNeeded) * (basePricingMap['material_base_cost'] || 0) +
          sheetsNeeded * (substratePricingMap[substrateType!].material_cost_per_sheet || 0) * (basePricingMap['material_markup_multiplier'] || 1.0));
        displayLines.push(`Cutting: $${formatPrice(cuttingCost)}`);
      }

      // Line 3: Pins (new line)
      if (pinsComponent) {
        displayLines.push(pinsComponent.detailDisplay || pinsComponent.description);
        totalCost += pinsComponent.cost;
      }

      // Line 4: D-tape (new line)
      if (dtapeComponent) {
        displayLines.push(dtapeComponent.description);
        totalCost += dtapeComponent.cost;
      }

      // Line 5: Assembly (new line)
      if (assemblyComponent) {
        displayLines.push(assemblyComponent.description);
        totalCost += assemblyComponent.cost;
      }

      components.push({
        name: 'Substrate Cut',
        price: totalCost,
        type: 'substrate_cut',
        calculationDisplay: displayLines.join('\n')
      });

    } else {
      // SCENARIO 2: No substrate material → split into individual components

      if (pinsComponent) {
        components.push({
          name: 'Pins',
          price: pinsComponent.cost,
          type: 'pins',
          calculationDisplay: pinsComponent.detailDisplay
        });
      }

      if (dtapeComponent) {
        components.push({
          name: 'D-tape',
          price: dtapeComponent.cost,
          type: 'd_tape',
          calculationDisplay: dtapeComponent.detailDisplay
        });
      }

      if (assemblyComponent) {
        components.push({
          name: 'Assembly',
          price: assemblyComponent.cost,
          type: 'assembly',
          calculationDisplay: assemblyComponent.detailDisplay
        });
      }

      if (cuttingComponent) {
        components.push({
          name: 'Cutting',
          price: cuttingComponent.cost,
          type: 'cutting',
          calculationDisplay: cuttingComponent.detailDisplay
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
      productTypeId: 3,
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
    console.error('Substrate cut pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
