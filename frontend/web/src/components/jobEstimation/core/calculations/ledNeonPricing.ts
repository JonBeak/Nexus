// LED Neon Pricing Calculator
// Dedicated pricing logic for LED Neon products (Product Type 7)
// Only receives validated data from validation layer - no raw grid data

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData, ComponentItem } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { selectPowerSupplies } from './powerSupplySelector';
import { formatPrice } from './utils/priceFormatter';

// =====================================================
// BUSINESS CONSTANTS
// =====================================================
const WASTE_FACTOR = 1.21;                    // 21% waste factor for substrate cutting
const ENGRAVING_MULTIPLIER = 1.5;             // Engraving cutting cost multiplier
const INCHES_TO_FEET = 12;                    // Conversion factor for LED length
const SQUARE_INCHES_TO_SQFT = 144;            // Conversion factor for area calculations
const DEFAULT_SHEET_SIZE_SQFT = 32;           // Default substrate sheet size (from substrate data)

// =====================================================
// MATERIAL RULES
// =====================================================
const MATERIAL_RULES = {
  /**
   * Determine if material is inherently opaque (PVC)
   */
  isPVCMaterial: (materialName: string): boolean => {
    return materialName.includes('PVC');
  },

  /**
   * Get default solder type based on material
   * PVC materials default to Opaque, others to Clear
   */
  getDefaultSolderType: (materialName: string): 'Clear' | 'Opaque' => {
    return MATERIAL_RULES.isPVCMaterial(materialName) ? 'Opaque' : 'Clear';
  }
};

// =====================================================
// TYPE-SAFE FIELD EXTRACTION
// =====================================================
interface ExtractedLedNeonFields {
  quantity: number | null;
  baseSize: number | number[] | undefined;           // field1: float (sqin) or dimensions [w, h]
  substrateMaterial: string | undefined;             // field2: material name from dropdown
  lengthInches: number | undefined;                  // field3: LED length in inches
  soldersCount: number | undefined;                  // field4: number of solder joints
  standoffsCount: number | undefined;                // field5: number of standoffs
  opacityOverride: string | undefined;               // field6: Yes/No opacity override
  psCountOverride: number | 'yes' | 'no' | undefined; // field7: PS count/control
}

/**
 * Extract and type-cast field values from parsed input
 */
const extractFields = (parsedValues: Record<string, unknown>): ExtractedLedNeonFields => {
  const quantityRaw = parsedValues.quantity as string;

  return {
    quantity: quantityRaw ? parseFloat(quantityRaw) : null,
    baseSize: parsedValues.field1 as number | number[] | undefined,
    substrateMaterial: parsedValues.field2 as string | undefined,
    lengthInches: parsedValues.field3 as number | undefined,
    soldersCount: parsedValues.field4 as number | undefined,
    standoffsCount: parsedValues.field5 as number | undefined,
    opacityOverride: parsedValues.field6 as string | undefined,
    psCountOverride: parsedValues.field7 as number | 'yes' | 'no' | undefined
  };
};

/**
 * Calculate pricing for LED Neon products
 * Implements the ProductCalculator interface for product type ID 7
 *
 * Field mapping:
 * - field1: Base HxL (dimensions in X x Y format or total sqin)
 * - field2: Base Mat (substrate material name from dropdown)
 * - field3: Length (in) (LED neon linear length in inches, converted to feet for pricing)
 * - field4: Solders (number of solder joints)
 * - field5: Stnd Off # (number of standoffs)
 * - field6: Opq? (Yes/No - opacity override)
 * - field7: PS # (power supply count override or yes/no control)
 *
 * Component Logic:
 * - If field1&2 filled: Create base substrate component (engraving cuts)
 * - If field1&3 filled: Combine LED Neon with base in one component
 * - If field1 empty but field3 filled: Create standalone LED component
 * - If field4 filled: Add solder cost to LED component
 * - If field5 filled: Add Stand Offs to LED component (or standalone if no LED)
 * - If field3 filled: Auto-calculate Power Supplies based on wattage (field7 can override count)
 */
export const calculateLedNeon = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
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

    // Convert inches to feet for pricing (LED Neon priced per foot)
    const lengthFeet = fields.lengthInches ? fields.lengthInches / INCHES_TO_FEET : undefined;

    // Fetch pricing data
    const allPricingData = await PricingDataResource.getAllPricingData();
    const substratePricingMap = await PricingDataResource.getSubstrateCutPricingMap();
    const basePricingMap = await PricingDataResource.getSubstrateCutBasePricingMap();

    // Convert arrays to Maps for O(1) lookups
    const ledsMap = new Map(
      allPricingData.leds?.map(led => [led.product_code, led]) || []
    );
    const solderPricingMap = new Map(
      allPricingData.ledNeonPricing?.map(solder => [solder.solder_type.toLowerCase(), solder]) || []
    );

    // Track components
    const components: ComponentItem[] = [];

    // ========== FIELD 1 & 2: Base Substrate with Engraving ==========
    let baseSubstrateCost = 0;
    let baseDescription = '';
    let width: number | undefined;
    let height: number | undefined;

    // Check if field1 has valid data (either float or dimensions) AND field2 is filled
    const hasBaseSubstrate = fields.baseSize && fields.substrateMaterial;

    if (hasBaseSubstrate) {
      // Look up substrate pricing by name from cached map (O(1) lookup)
      const substratePricing = substratePricingMap[fields.substrateMaterial];

      if (!substratePricing) {
        return {
          status: 'error',
          display: `Substrate material not found: ${fields.substrateMaterial}`,
          data: null
        };
      }

      // Determine square feet based on input type
      let squareFeet: number;

      if (Array.isArray(fields.baseSize)) {
        // Dimensions format: [width, height]
        if (fields.baseSize.length !== 2) {
          return {
            status: 'error',
            display: 'Invalid dimensions format for field1',
            data: null
          };
        }
        width = fields.baseSize[0];
        height = fields.baseSize[1];
        // Apply 21% waste factor, convert to sqft, then round up
        squareFeet = Math.ceil((width * height) * WASTE_FACTOR / SQUARE_INCHES_TO_SQFT);
      } else {
        // Float format: total square inches with 21% waste factor, round up
        squareFeet = Math.ceil(fields.baseSize * WASTE_FACTOR / SQUARE_INCHES_TO_SQFT);
      }
      const sheetSizeSqft = substratePricing.sheet_size_sqft || DEFAULT_SHEET_SIZE_SQFT;
      const sheetsNeeded = squareFeet / sheetSizeSqft;

      // Material Cost
      const materialBaseCost = basePricingMap['material_base_cost'] || 0;
      const materialCostPerSheet = substratePricing.material_cost_per_sheet || 0;
      const markupMultiplier = basePricingMap['material_markup_multiplier'] || 1.0;

      const materialCost =
        Math.ceil(sheetsNeeded) * materialBaseCost +
        sheetsNeeded * materialCostPerSheet * markupMultiplier;

      // Cutting Cost (multiply by ENGRAVING_MULTIPLIER for engraving)
      const cuttingBaseCost = basePricingMap['cutting_base_cost'] || 0;
      const cuttingRatePerSheet = substratePricing.cutting_rate_per_sheet || 0;
      const standardCuttingCost = Math.ceil(sheetsNeeded) * cuttingBaseCost + sheetsNeeded * cuttingRatePerSheet;
      const engravingCuttingCost = standardCuttingCost * ENGRAVING_MULTIPLIER;

      // Round up total base cost to nearest dollar
      baseSubstrateCost = Math.ceil(materialCost + engravingCuttingCost);

      // Build description based on input format
      if (width !== undefined && height !== undefined) {
        baseDescription = `${substratePricing.substrate_name} [${width}x${height}]`;
      } else {
        baseDescription = `${substratePricing.substrate_name} [${fields.baseSize} sq in]`;
      }
    }

    // ========== FIELD 3: LED Neon Length ==========
    let ledNeonCost = 0;
    let ledNeonDescription = '';
    let totalWattage = 0;
    const hasLedNeon = lengthFeet && lengthFeet > 0;

    if (hasLedNeon) {
      // Look up LED Neon pricing from cached map (O(1) lookup)
      const ledNeonPricing = ledsMap.get('LED Neon');

      if (!ledNeonPricing) {
        return {
          status: 'error',
          display: 'LED Neon pricing not found in database',
          data: null
        };
      }

      const costPerFoot = ledNeonPricing.price;
      const wattsPerFoot = ledNeonPricing.watts;

      ledNeonCost = lengthFeet * costPerFoot;
      totalWattage = lengthFeet * wattsPerFoot;
      ledNeonDescription = `${fields.lengthInches}" (${formatPrice(lengthFeet)}') LED Neon @ $${formatPrice(costPerFoot)}/ft`;
    }

    // ========== FIELD 4: Solders (supplementary to field3) ==========
    let solderCost = 0;
    let solderDescription = '';
    const hasSolders = fields.soldersCount && fields.soldersCount > 0;

    if (hasSolders && hasLedNeon) {
      // Determine solder type: Check field6 override first, then material type
      let solderType: 'Clear' | 'Opaque' = 'Clear'; // Default

      if (fields.opacityOverride) {
        solderType = fields.opacityOverride.toLowerCase() === 'yes' ? 'Opaque' : 'Clear';
      } else if (hasBaseSubstrate && fields.substrateMaterial) {
        // Determine from material using centralized rules
        solderType = MATERIAL_RULES.getDefaultSolderType(fields.substrateMaterial);
      }

      // Get solder price (O(1) lookup) - MUST exist in database
      const solderPriceData = solderPricingMap.get(solderType.toLowerCase());

      if (!solderPriceData) {
        return {
          status: 'error',
          display: `Solder pricing not found for type: ${solderType}. Please configure led_neon_solder_pricing table.`,
          data: null
        };
      }

      const pricePerSolder = solderPriceData.price;
      solderCost = fields.soldersCount * pricePerSolder;
      solderDescription = `${fields.soldersCount} ${solderType} Solders @ $${formatPrice(pricePerSolder)}/ea`;
    }

    // ========== FIELD 5: Stand Offs ==========
    let standoffsCost = 0;
    let standoffsDescription = '';
    const hasStandoffs = fields.standoffsCount && fields.standoffsCount > 0;

    if (hasStandoffs) {
      const standoffsPin = await PricingDataResource.getPinType('Stand Offs');

      if (!standoffsPin) {
        return {
          status: 'error',
          display: 'Stand Offs pricing not found. Please configure pin_types table.',
          data: null
        };
      }

      const pricePerStandoff = standoffsPin.base_cost;
      standoffsCost = fields.standoffsCount * pricePerStandoff;
      standoffsDescription = `${fields.standoffsCount} Stand Offs @ $${formatPrice(pricePerStandoff)}/ea`;
    }

    // ========== FIELD 7: Power Supplies - Use powerSupplySelector for smart selection ==========
    const powerSupplyComponents: ComponentItem[] = [];
    let totalPsCost = 0;

    const calculatedPsCount = input.calculatedValues.psCount || 0;

    // Normalize psCountOverride from field7
    let normalizedPsCountOverride: number | null = null;
    if (fields.psCountOverride === 'no') {
      normalizedPsCountOverride = 0;
    } else if (typeof fields.psCountOverride === 'number') {
      normalizedPsCountOverride = fields.psCountOverride;
    }

    // Determine what to pass to powerSupplySelector
    let psOverrideForSelector: number | null = null;
    let shouldCalculatePS = false;

    if (fields.psCountOverride === 'yes') {
      // User explicitly wants PSs - enable UL optimization
      shouldCalculatePS = true;
      psOverrideForSelector = null;
    } else if (normalizedPsCountOverride !== null) {
      // User entered a specific number (including 0)
      shouldCalculatePS = true;
      psOverrideForSelector = normalizedPsCountOverride;
    } else {
      // No user override - use ValidationContextBuilder's decision
      shouldCalculatePS = calculatedPsCount > 0;
      psOverrideForSelector = calculatedPsCount;
    }

    if (shouldCalculatePS) {
      // Use section-level UL for PS optimization (consistent PS types within section)
      const sectionHasUL = input.calculatedValues?.sectionHasUL ?? false;

      const psResult = await selectPowerSupplies({
        totalWattage,
        hasUL: sectionHasUL,  // Use section-level UL for PS selection
        psCountOverride: psOverrideForSelector,
        customerPreferences: input.customerPreferences
      });

      powerSupplyComponents.push(...psResult.components);
      totalPsCost = psResult.components.reduce((sum, c) => sum + c.price, 0);
    }

    // ========== BUILD COMPONENTS BASED ON SCENARIO ==========
    // Simplified component assembly: calculate costs first, then build components

    // Calculate total LED-related costs (LED + solders + standoffs)
    const totalLedRelatedCost = ledNeonCost + solderCost + standoffsCost;

    // Build LED-related display lines (reused in multiple scenarios)
    const buildLedDisplay = (): string[] => {
      const lines: string[] = [];
      if (hasLedNeon) lines.push(ledNeonDescription);
      if (hasSolders) lines.push(solderDescription);
      if (hasStandoffs) lines.push(standoffsDescription);
      return lines;
    };

    // Component assembly based on what's present
    if (hasBaseSubstrate && hasLedNeon) {
      // SCENARIO 1: Base + LED Neon combined into single component
      components.push({
        name: 'LED Neon',
        price: baseSubstrateCost + totalLedRelatedCost,
        type: 'led_neon',
        calculationDisplay: [baseDescription, ...buildLedDisplay()].join('\n')
      });
    } else if (hasBaseSubstrate) {
      // SCENARIO 2: Base substrate only
      components.push({
        name: 'LED Neon',
        price: baseSubstrateCost,
        type: 'led_neon_base',
        calculationDisplay: baseDescription
      });
      // Add standalone standoffs if present
      if (hasStandoffs) {
        components.push({
          name: 'Stand Offs',
          price: standoffsCost,
          type: 'stand_offs',
          calculationDisplay: standoffsDescription
        });
      }
    } else if (hasLedNeon) {
      // SCENARIO 3: LED Neon without base substrate
      components.push({
        name: 'LEDs',
        price: totalLedRelatedCost,
        type: 'led',
        calculationDisplay: buildLedDisplay().join('\n'),
        metadata: { led_type: 'LED Neon' }
      });
    } else if (hasStandoffs) {
      // SCENARIO 4: Standalone standoffs only
      components.push({
        name: 'Stand Offs',
        price: standoffsCost,
        type: 'stand_offs',
        calculationDisplay: standoffsDescription
      });
    }

    // Add Power Supply components
    if (powerSupplyComponents.length > 0) {
      components.push(...powerSupplyComponents);
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
      productTypeId: 7,
      rowId: input.rowId,
      itemName: components.map(c => c.name).join(' + '),
      unitPrice: totalPrice,
      quantity: fields.quantity,
      components
    };

    return {
      status: 'completed',
      display: `$${formatPrice(totalPrice)} × ${fields.quantity} = $${formatPrice(totalPrice * fields.quantity)}`,
      data: calculationData
    };

  } catch (error) {
    console.error('[LED Neon Calculator] Calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
