// Push Thru Pricing Calculator
// Dedicated pricing logic for Push Thru products (Product Type 5)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult, ComponentItem } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData } from './types/CalculatorTypes';
import { BackerLookupTables, lookupAluminumPrice, lookupAcmPrice } from './backerPricingLookup';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { selectPowerSupplies, PowerSupplySelectionInput } from './powerSupplySelector';

// Helper function to format price (integer if whole number, 2 decimals if not)
const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
};

// Constants for dimension categorization (from Backer)
const BACKER_CONSTANTS = {
  ALUMINUM_X_CATEGORIES: [59.5, 119.5, 179.5, 239.5],
  ALUMINUM_Y_CATEGORIES: [15.5, 23.5, 47.5],
  ACM_X_CATEGORIES: [48, 60, 96, 120, 192, 240, 300],
  ACM_Y_CATEGORIES: [15.5, 23.5, 29, 48, 60]
};

/**
 * Find the category bucket for a dimension (round up to next category)
 */
function findCategory(value: number, categories: number[]): number | null {
  for (const category of categories) {
    if (value <= category) {
      return category;
    }
  }
  return null;
}

/**
 * Parse and adjust 3D dimensions for aluminum (X x Y x Z)
 * Returns normalized [X, Y] where X is longest dimension
 */
function parseAndAdjustAluminumDimensions(input: number[]): { x: number; y: number; z: number } | null {
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
 * Calculate box pricing (fields 1 & 3) using Backer pricing logic
 */
async function calculateBoxPricing(
  materialType: string,
  dimensions: number[] | undefined,
  lookupTables: BackerLookupTables
): Promise<{ cost: number; display: string } | null> {
  if (!dimensions || !materialType) {
    return null;
  }

  if (materialType === 'Aluminum') {
    // 3D dimensions (X x Y x Z)
    if (dimensions.length !== 3) {
      throw new Error('Aluminum box requires 3D dimensions (X x Y x Z)');
    }

    const adjusted = parseAndAdjustAluminumDimensions(dimensions);
    if (!adjusted) {
      return null;
    }

    const { x, y, z } = adjusted;

    // Find category buckets
    const categoryX = findCategory(x, BACKER_CONSTANTS.ALUMINUM_X_CATEGORIES);
    const categoryY = findCategory(y, BACKER_CONSTANTS.ALUMINUM_Y_CATEGORIES);

    if (!categoryX || !categoryY) {
      throw new Error(
        `Aluminum box dimensions out of range. Max: ${BACKER_CONSTANTS.ALUMINUM_X_CATEGORIES[BACKER_CONSTANTS.ALUMINUM_X_CATEGORIES.length - 1]}" × ${BACKER_CONSTANTS.ALUMINUM_Y_CATEGORIES[BACKER_CONSTANTS.ALUMINUM_Y_CATEGORIES.length - 1]}"`
      );
    }

    // Lookup price from pre-calculated table
    const price = lookupAluminumPrice(categoryX, categoryY, lookupTables);
    if (price === null) {
      throw new Error(`Failed to lookup aluminum price for category ${categoryX}x${categoryY}"`);
    }

    return {
      cost: price,
      display: `${dimensions[0]} x ${dimensions[1]} x ${dimensions[2]}: $${formatPrice(price)}`
    };

  } else if (materialType === 'ACM') {
    // 2D dimensions (X x Y)
    if (dimensions.length !== 2) {
      throw new Error('ACM box requires 2D dimensions (X x Y)');
    }

    const [x, y] = dimensions;

    // Find category buckets
    const categoryX = findCategory(x, BACKER_CONSTANTS.ACM_X_CATEGORIES);
    const categoryY = findCategory(y, BACKER_CONSTANTS.ACM_Y_CATEGORIES);

    if (!categoryX || !categoryY) {
      throw new Error(
        `ACM box dimensions out of range. Max: ${BACKER_CONSTANTS.ACM_X_CATEGORIES[BACKER_CONSTANTS.ACM_X_CATEGORIES.length - 1]}" × ${BACKER_CONSTANTS.ACM_Y_CATEGORIES[BACKER_CONSTANTS.ACM_Y_CATEGORIES.length - 1]}"`
      );
    }

    // Lookup price from pre-calculated table
    const price = lookupAcmPrice(categoryX, categoryY, lookupTables);
    if (price === null) {
      throw new Error(`Failed to lookup ACM price for category ${categoryX}x${categoryY}"`);
    }

    return {
      cost: price,
      display: `${x} x ${y}: $${formatPrice(price)}`
    };
  }

  return null;
}

/**
 * Calculate assembly cost for field4 (Acryl XY)
 * Formula: $50 × ceil(sheets) + $80 × (sqft / 32)
 */
async function calculateAssemblyCost(squareFeet: number): Promise<number> {
  // Fetch assembly pricing from database
  const assemblyPricing = await PricingDataResource.getPushThruAssemblyPricing();

  const sheetCount = squareFeet / 32;
  const baseCost = Math.ceil(sheetCount) * assemblyPricing.base_cost_per_sheet;
  const sizeCost = (squareFeet / 32) * assemblyPricing.size_cost_per_32sqft;

  return baseCost + sizeCost;
}

/**
 * Substrate component breakdown for Push Thru
 */
interface SubstrateBreakdown {
  acrylicSize: string;
  acrylicMaterial: number;
  acrylicCutting: number;
  polycarbonateCombined: number; // Material + Cutting combined
  assembly: number;
  totalPrice: number;
}

/**
 * Calculate substrate components (Acrylic + Polycarbonate) for field4
 * Returns breakdown of individual costs for combination
 */
async function calculateSubstrateBreakdown(
  dimensions: number[] | undefined,
  overrideCut: number | null,
  overridePC: number | null,
  overrideAssembly: number | null
): Promise<SubstrateBreakdown | null> {
  if (!dimensions || dimensions.length !== 2) {
    return null;
  }

  const [width, height] = dimensions;
  const squareFeet = (width * height) / 144;
  const sheetSizeSqft = 32;
  const sheetsNeeded = squareFeet / sheetSizeSqft;

  // Fetch pricing data
  const substratePricingMap = await PricingDataResource.getSubstrateCutPricingMap();
  const basePricingMap = await PricingDataResource.getSubstrateCutBasePricingMap();

  const acrylic12mm = substratePricingMap['Acrylic 12mm'];
  const polycarbonate = substratePricingMap['Polycarbonate'];

  if (!acrylic12mm || !polycarbonate) {
    throw new Error('Acrylic 12mm or Polycarbonate pricing not found');
  }

  const materialBaseCost = basePricingMap['material_base_cost'] || 0;
  const cuttingBaseCost = basePricingMap['cutting_base_cost'] || 0;
  const markupMultiplier = basePricingMap['material_markup_multiplier'] || 1.0;

  // Acrylic Material
  const acrylicMaterialCost =
    Math.ceil(sheetsNeeded) * materialBaseCost +
    sheetsNeeded * acrylic12mm.material_cost_per_sheet * markupMultiplier;

  // Acrylic Cutting (with override from field8)
  let acrylicCuttingCost =
    Math.ceil(sheetsNeeded) * cuttingBaseCost +
    sheetsNeeded * acrylic12mm.cutting_rate_per_sheet;

  if (overrideCut !== null) {
    acrylicCuttingCost = overrideCut;
  }

  // Polycarbonate Material + Cutting combined (with override from field9)
  let polycarbonateCombinedCost =
    (Math.ceil(sheetsNeeded) * materialBaseCost + sheetsNeeded * polycarbonate.material_cost_per_sheet * markupMultiplier) +
    (Math.ceil(sheetsNeeded) * cuttingBaseCost + sheetsNeeded * polycarbonate.cutting_rate_per_sheet);

  if (overridePC !== null) {
    polycarbonateCombinedCost = overridePC;
  }

  // Assembly (with override from field10)
  let assemblyCost = await calculateAssemblyCost(squareFeet);

  if (overrideAssembly !== null) {
    assemblyCost = overrideAssembly;
  }

  const totalPrice = acrylicMaterialCost + acrylicCuttingCost + polycarbonateCombinedCost + assemblyCost;

  return {
    acrylicSize: `${width}x${height}`,
    acrylicMaterial: acrylicMaterialCost,
    acrylicCutting: acrylicCuttingCost,
    polycarbonateCombined: polycarbonateCombinedCost,
    assembly: assemblyCost,
    totalPrice
  };
}

/**
 * Calculate pricing for Push Thru products
 * Implements the ProductCalculator interface for product type ID 5
 *
 * Field mapping:
 * - field1: Alum / ACM (dropdown: material type for box)
 * - field2: # Boxes (multiplier for box cost, range 0.01-5, defaults to 2)
 * - field3: XYZ / XY (box dimensions - 3D if Aluminum, 2D if ACM)
 * - field4: Acryl XY (dimensions for all substrate components + assembly)
 * - field5: LEDs XY (LED dimensions - calculates LED count)
 * - field6: UL (UL listing override - "yes", "no", 0, float [set count], $amount)
 * - field7: Tfrs (power supply override)
 * - field8: ~ Cut ~ (Acrylic cutting cost override)
 * - field9: ~ PC ~ (Polycarbonate Mat + Cut override)
 * - field10: ~ Assem ~ (Assembly cost override)
 */
export const calculatePushThru = async (
  input: ValidatedPricingInput,
  lookupTables?: BackerLookupTables
): Promise<RowCalculationResult> => {
  // FAIL-FAST: Require lookup tables for box pricing
  if (!lookupTables) {
    throw new Error(
      'Push Thru pricing requires pre-calculated lookup tables for box pricing. ' +
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

    const components: ComponentItem[] = [];

    // Parse override fields 8,9,10
    const cutOverrideRaw = input.parsedValues.field8;
    const pcOverrideRaw = input.parsedValues.field9;
    const assemblyOverrideRaw = input.parsedValues.field10;

    const cutOverride = cutOverrideRaw != null ? (typeof cutOverrideRaw === 'string' ? parseFloat(cutOverrideRaw) : cutOverrideRaw) : null;
    const pcOverride = pcOverrideRaw != null ? (typeof pcOverrideRaw === 'string' ? parseFloat(pcOverrideRaw) : pcOverrideRaw) : null;
    const assemblyOverride = assemblyOverrideRaw != null ? (typeof assemblyOverrideRaw === 'string' ? parseFloat(assemblyOverrideRaw) : assemblyOverrideRaw) : null;

    // ========== FIELDS 1, 2, 3: Box Calculation ==========
    const materialType = input.parsedValues.field1 as string | undefined;
    const boxMultiplierRaw = input.parsedValues.field2 as number | undefined;
    const boxDimensions = input.parsedValues.field3 as number[] | undefined;

    // Default field2 (Boxes*) to 2 if not provided
    const boxMultiplier = boxMultiplierRaw ?? 2;

    // ========== FIELD 4: Acrylic Substrate ==========
    const acrylicDimensions = input.parsedValues.field4 as number[] | undefined;

    // Check if we're combining components or creating standalone overrides
    const hasBoxOrSubstrate = (materialType && boxDimensions) || acrylicDimensions;

    if (hasBoxOrSubstrate) {
      // COMBINED MODE: Box + Substrate into one "Push Thru" component
      let boxPrice = 0;
      let boxDisplay = '';

      if (materialType && boxDimensions) {
        const boxResult = await calculateBoxPricing(materialType, boxDimensions, lookupTables);
        if (boxResult) {
          boxPrice = boxResult.cost * boxMultiplier;
          const multiplierDisplay = boxMultiplierRaw === undefined ? `${boxMultiplier} (default)` : `${boxMultiplier}`;
          boxDisplay = `${materialType} ${boxDimensions.join('x')} × ${multiplierDisplay} = ${formatPrice(boxPrice)}`;
        }
      }

      let substrateBreakdown: SubstrateBreakdown | null = null;
      if (acrylicDimensions) {
        substrateBreakdown = await calculateSubstrateBreakdown(acrylicDimensions, cutOverride, pcOverride, assemblyOverride);
      }

      // Build combined calculationDisplay with newlines
      const displayLines: string[] = [];

      if (boxDisplay) {
        displayLines.push(boxDisplay);
      }

      if (substrateBreakdown) {
        // Build Acrylic line: size, Mat, Cut
        const acrylicParts: string[] = [substrateBreakdown.acrylicSize];
        if (substrateBreakdown.acrylicMaterial !== 0) {
          acrylicParts.push(`Mat ${formatPrice(substrateBreakdown.acrylicMaterial)}`);
        }
        if (substrateBreakdown.acrylicCutting !== 0) {
          acrylicParts.push(`Cut ${formatPrice(substrateBreakdown.acrylicCutting)}`);
        }
        displayLines.push(`Acrylic: ${acrylicParts.join(', ')}`);

        // PC Mat + Cut on separate line
        if (substrateBreakdown.polycarbonateCombined !== 0) {
          displayLines.push(`PC Mat + Cut ${formatPrice(substrateBreakdown.polycarbonateCombined)}`);
        }

        // Assembly on separate line
        if (substrateBreakdown.assembly !== 0) {
          displayLines.push(`Assem ${formatPrice(substrateBreakdown.assembly)}`);
        }
      }

      const totalPrice = boxPrice + (substrateBreakdown?.totalPrice || 0);

      components.push({
        name: 'Push Thru',
        price: totalPrice,
        type: 'push_thru_combined',
        calculationDisplay: displayLines.join('\n')
      });

    } else {
      // STANDALONE MODE: Fields 8,9,10 create individual components
      if (cutOverride != null && !isNaN(cutOverride) && cutOverride !== 0) {
        components.push({
          name: 'Cutting',
          price: cutOverride,
          type: 'cutting_override',
          calculationDisplay: `Custom: $${formatPrice(cutOverride)}`
        });
      }

      if (pcOverride != null && !isNaN(pcOverride) && pcOverride !== 0) {
        components.push({
          name: 'Polycarbonate',
          price: pcOverride,
          type: 'polycarbonate_override',
          calculationDisplay: `Custom: $${formatPrice(pcOverride)}`
        });
      }

      if (assemblyOverride != null && !isNaN(assemblyOverride) && assemblyOverride !== 0) {
        components.push({
          name: 'Assembly',
          price: assemblyOverride,
          type: 'assembly_override',
          calculationDisplay: `Custom: $${formatPrice(assemblyOverride)}`
        });
      }
    }

    // ========== FIELD 5: LEDs (trust validation layer's count) ==========
    // The validation layer has already calculated ledCount from field5
    const ledCount = input.calculatedValues.ledCount || 0;

    if (ledCount > 0) {
      // Fetch LED pricing - use customer preference or default LED
      let ledPricing = null;
      let ledType = 'Unknown';

      if (input.customerPreferences?.pref_led_type) {
        ledPricing = await PricingDataResource.getLed(input.customerPreferences.pref_led_type);
        ledType = input.customerPreferences.pref_led_type;
      }

      // Fallback to default LED if customer preference not found
      if (!ledPricing) {
        ledPricing = await PricingDataResource.getDefaultLed();
        ledType = ledPricing?.product_code || 'Default';
      }

      if (!ledPricing) {
        throw new Error('LED pricing not found. Please configure a default LED in the system.');
      }

      // Ensure price is a number (may come from DB as string)
      const ledPrice = typeof ledPricing.price === 'string' ? parseFloat(ledPricing.price) : ledPricing.price;
      const ledCost = ledCount * ledPrice;

      components.push({
        name: 'LEDs',
        price: ledCost,
        type: 'leds',
        calculationDisplay: `${ledCount} @ $${formatPrice(ledPrice)}, ${ledType}`
      });
    }

    // ========== FIELD 6: UL ==========
    const ulOverride = input.parsedValues.field6;
    let hasUL = false;
    let ulSetCount: number | null = null;
    let ulCustomPrice: number | null = null;
    let ulExplicitlySet = false;

    if (ulOverride !== undefined && ulOverride !== null && ulOverride !== '') {
      ulExplicitlySet = true;
      if (typeof ulOverride === 'string') {
        const lower = ulOverride.toLowerCase();
        if (lower === 'yes') {
          hasUL = true;
          ulSetCount = null; // Use default calculation
        } else if (lower === 'no') {
          hasUL = false;
        }
      } else if (typeof ulOverride === 'object' && 'type' in ulOverride) {
        const parsedValue = ulOverride as any;

        if (parsedValue.type === 'currency') {
          // $amount = custom price override
          ulCustomPrice = parsedValue.amount || 0;
          hasUL = ulCustomPrice !== 0;
        } else if (parsedValue.type === 'float') {
          // Plain float = set count (0 = no UL)
          const setCount = parsedValue.amount || 0;
          if (setCount === 0) {
            hasUL = false;
          } else {
            hasUL = true;
            ulSetCount = setCount;
          }
        }
      }
    } else {
      // Default to customer preference
      hasUL = input.customerPreferences?.pref_ul_required === true;
    }

    // ========== FIELD 7: Power Supplies - Use powerSupplySelector for smart selection ==========
    const calculatedPsCount = input.calculatedValues.psCount || 0;

    // Extract and normalize psCountOverride from field7
    const psCountOverrideRaw = input.parsedValues.field7;
    let psCountOverride: number | null = null;
    if (psCountOverrideRaw === 'no') {
      psCountOverride = 0;
    } else if (typeof psCountOverrideRaw === 'number') {
      psCountOverride = psCountOverrideRaw;
    }

    // Determine what to pass to powerSupplySelector
    let psOverrideForSelector: number | null = null;
    let shouldCalculatePS = false;

    if (psCountOverrideRaw === 'yes') {
      // User explicitly wants PSs - enable UL optimization
      shouldCalculatePS = true;
      psOverrideForSelector = null;
    } else if (psCountOverride !== null) {
      // User entered a specific number (including 0)
      shouldCalculatePS = true;
      psOverrideForSelector = psCountOverride;
    } else {
      // No user override - use ValidationContextBuilder's decision
      shouldCalculatePS = calculatedPsCount > 0;
      psOverrideForSelector = calculatedPsCount;
    }

    if (shouldCalculatePS) {
      // Calculate wattage for PS selection
      let ledPricing = null;

      if (input.customerPreferences?.pref_led_type) {
        ledPricing = await PricingDataResource.getLed(input.customerPreferences.pref_led_type);
      }

      // Fallback to default LED
      if (!ledPricing) {
        ledPricing = await PricingDataResource.getDefaultLed();
      }

      if (!ledPricing) {
        throw new Error('LED pricing not found for wattage calculation. Please configure a default LED in the system.');
      }

      // Ensure watts is a number (may come from DB as string)
      const wattsPerLed = typeof ledPricing.watts === 'string' ? parseFloat(ledPricing.watts) : ledPricing.watts;
      const totalWattage = ledCount * wattsPerLed;

      // Use section-level UL for PS optimization (consistent PS types within section)
      const sectionHasUL = input.calculatedValues?.sectionHasUL ?? false;

      const psSelectionInput: PowerSupplySelectionInput = {
        totalWattage,
        hasUL: sectionHasUL,  // Use section-level UL for PS selection
        psCountOverride: psOverrideForSelector,
        psTypeOverride: null, // Push Thru doesn't have PS type override field
        customerPreferences: input.customerPreferences
      };

      const psResult = await selectPowerSupplies(psSelectionInput);

      if (psResult.components && psResult.components.length > 0) {
        components.push(...psResult.components);
      }
    }

    // ========== UL Component (if applicable) ==========
    // Show UL if explicitly set, OR if customer requires it and we have LEDs
    const shouldShowUL = ulExplicitlySet ? hasUL : (hasUL && ledCount > 0);
    if (shouldShowUL) {
      if (ulCustomPrice !== null) {
        // Custom UL price override
        components.push({
          name: 'UL',
          price: ulCustomPrice,
          type: 'ul',
          calculationDisplay: `Custom: $${formatPrice(ulCustomPrice)}`
        });
      } else {
        // Fetch UL pricing from database
        const ulPricing = await PricingDataResource.getUlListingPricing();

        if (!ulPricing) {
          throw new Error('UL listing pricing not found. Please configure UL pricing in the system.');
        }

        // Parse pricing values (may come as strings from DB)
        const baseFee = typeof ulPricing.base_fee === 'string' ? parseFloat(ulPricing.base_fee) : ulPricing.base_fee;
        const perSetFee = typeof ulPricing.per_set_fee === 'string' ? parseFloat(ulPricing.per_set_fee) : ulPricing.per_set_fee;
        const minimumSets = typeof ulPricing.minimum_sets === 'string' ? parseFloat(ulPricing.minimum_sets) : ulPricing.minimum_sets;

        // Determine set count (use minimum if not specified)
        const effectiveSetCount = ulSetCount ?? minimumSets;
        const ulCost = baseFee + (effectiveSetCount * perSetFee);

        const setCountDisplay = ulSetCount === null ? `${effectiveSetCount} (minimum)` : `${effectiveSetCount}`;
        components.push({
          name: 'UL',
          price: ulCost,
          type: 'ul',
          calculationDisplay: `$${formatPrice(baseFee)} base + ${setCountDisplay} sets @ $${formatPrice(perSetFee)}/set = $${formatPrice(ulCost)}`
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
      productTypeId: 5,
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
    console.error('Push Thru pricing calculation error:', error);
    return {
      status: 'error',
      display: error instanceof Error ? error.message : 'Calculation error',
      data: null
    };
  }
};
