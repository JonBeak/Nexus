// Power Supply Selector
// Reusable power supply selection logic for all LED-based products
// Handles user overrides, UL requirements, and standard selection

import { ComponentItem } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

/**
 * Input parameters for power supply selection
 */
export interface PowerSupplySelectionInput {
  totalWattage: number;
  hasUL: boolean;
  psTypeOverride?: string | null;
  psCountOverride?: number | null;
  psPriceOverride?: number | null;
  customerPreferences?: {
    pref_power_supply_type?: string;
  };
}

/**
 * Result from power supply selection
 */
export interface PowerSupplyResult {
  components: ComponentItem[];
  totalCount: number;
  error?: string;
}

// =====================================================
// MAIN SELECTION FUNCTION
// =====================================================

/**
 * Select appropriate power supplies based on wattage and requirements
 *
 * Selection Priority:
 * 1. User-specified type override (field10)
 * 2. UL-required optimization (PS#2 + PS#3 combo)
 * 3. Standard selection (customer pref → default non-UL)
 *
 * @param input - Power supply selection parameters
 * @returns Promise<PowerSupplyResult> - Selected power supply components
 */
export async function selectPowerSupplies(
  input: PowerSupplySelectionInput
): Promise<PowerSupplyResult> {
  const {
    totalWattage,
    hasUL,
    psTypeOverride,
    psCountOverride,
    psPriceOverride,
    customerPreferences
  } = input;

  // Validate input - allow totalWattage = 0 if explicit count/type override exists
  const hasExplicitOverride = (psCountOverride !== null && psCountOverride !== undefined) ||
                               (psTypeOverride && psTypeOverride !== '');

  if (totalWattage <= 0 && !hasExplicitOverride) {
    return {
      components: [],
      totalCount: 0,
      error: 'Total wattage must be greater than 0 (or provide explicit PS count/type)'
    };
  }

  const components: ComponentItem[] = [];
  let totalCount = 0;

  // =====================================================
  // STEP 1: Determine if optimization should be used
  // Logic: if ((sectionHasUL AND !(PSTypeExplicit <>2or3)) OR finalPSType=2or3) AND (PS#=null)
  // =====================================================

  // Check if there's an explicit numeric count override
  const hasExplicitCountOverride = (psCountOverride !== null && psCountOverride !== undefined && typeof psCountOverride === 'number');

  // Resolve explicit PS type if provided
  let explicitPS = null;
  if (psTypeOverride) {
    explicitPS = await PricingDataResource.getPowerSupplyByType(psTypeOverride);
  }

  // Check if explicit type is Speedbox (ID 2 or 3)
  const explicitIsSpeedbox = explicitPS?.power_supply_id === 2 || explicitPS?.power_supply_id === 3;

  // Resolve final PS type (explicit → customer pref, no system default)
  let finalPSType = explicitPS;
  if (!finalPSType && customerPreferences?.pref_power_supply_type) {
    finalPSType = await PricingDataResource.getPowerSupplyByType(customerPreferences.pref_power_supply_type);
  }

  // Check if final type is Speedbox
  const finalIsSpeedbox = finalPSType?.power_supply_id === 2 || finalPSType?.power_supply_id === 3;

  // Apply optimization logic:
  // Use optimization when PS count is NOT explicitly set AND:
  // - (UL enabled AND (no explicit PS type OR explicit type is Speedbox)) OR
  // - Final PS type is Speedbox
  const shouldUseOptimization = !hasExplicitCountOverride && (
    (hasUL && (!psTypeOverride || explicitIsSpeedbox)) ||  // UL and compatible explicit type
    finalIsSpeedbox  // OR final resolved type is Speedbox
  );
  console.log(`[psSelector] Input: hasUL=${hasUL}, psTypeOverride=${psTypeOverride}, psCountOverride=${psCountOverride}`);
  console.log(`[psSelector] Decision: shouldUseOptimization=${shouldUseOptimization}, hasExplicitCountOverride=${hasExplicitCountOverride}`);

  // =====================================================
  // PATH 1: UL Optimization (when enabled and no explicit count)
  // =====================================================
  if (shouldUseOptimization && !hasExplicitCountOverride) {
    const ps2 = await PricingDataResource.getPowerSupplyById(2); // Speedbox 60W (50W actual)
    const ps3 = await PricingDataResource.getPowerSupplyById(3); // Speedbox 150W (135W actual)

    if (!ps2 || !ps3) {
      return {
        components: [],
        totalCount: 0,
        error: 'UL power supplies not configured (PS#2 or PS#3 not found)'
      };
    }

    if (!ps2.watts || !ps3.watts) {
      return {
        components: [],
        totalCount: 0,
        error: 'UL power supplies missing wattage data'
      };
    }

    // UL power supply optimization algorithm
    const remainder = totalWattage % ps3.watts;
    let ps2Count = 0;
    let ps3Count = 0;

    if (remainder === 0) {
      // Perfect fit with PS#3 only
      ps3Count = totalWattage / ps3.watts;
    } else if (remainder < ps2.watts) {
      // Use 1x PS#2 for remainder, rest with PS#3
      ps2Count = 1;
      ps3Count = Math.floor(totalWattage / ps3.watts);
    } else {
      // Remainder >= PS#2 watts, just use PS#3
      ps3Count = Math.ceil(totalWattage / ps3.watts);
    }

    // Build combined component with multi-line display
    const psLines: string[] = [];
    let totalPSPrice = 0;

    if (ps2Count > 0) {
      const ps2Price = ps2Count * ps2.price;
      psLines.push(`${ps2Count} @ $${formatPrice(Number(ps2.price))}, ${ps2.transformer_type}`);
      totalPSPrice += ps2Price;
    }

    if (ps3Count > 0) {
      const ps3Price = ps3Count * ps3.price;
      psLines.push(`${ps3Count} @ $${formatPrice(Number(ps3.price))}, ${ps3.transformer_type}`);
      totalPSPrice += ps3Price;
    }

    if (psLines.length > 0) {
      components.push({
        name: `Power Supplies`,
        price: totalPSPrice,
        type: 'power_supplies',
        calculationDisplay: psLines.join('\n')
      });
    }

    totalCount = ps2Count + ps3Count;

    return { components, totalCount };
  }

  // =====================================================
  // PATH 2: User-specified power supply type override
  // (with or without explicit count)
  // =====================================================
  if (psTypeOverride && psTypeOverride !== '') {
    const powerSupply = await PricingDataResource.getPowerSupplyByType(psTypeOverride);

    if (powerSupply) {
      // Check for user override on PS count (explicitly check for null/undefined to allow 0)
      if (hasExplicitCountOverride) {
        totalCount = Number(psCountOverride);
      } else {
        // Calculate PS count based on watts
        if (!powerSupply.watts) {
          return {
            components: [],
            totalCount: 0,
            error: `Power supply ${powerSupply.transformer_type} missing wattage data`
          };
        }
        totalCount = Math.ceil(totalWattage / powerSupply.watts);
        // If explicit type override with zero wattage, default to 1 PS
        if (totalCount === 0 && totalWattage === 0) {
          totalCount = 1;
        }
      }

      // Only add component if totalCount > 0
      if (totalCount > 0) {
        const unitPrice = psPriceOverride !== null && psPriceOverride !== undefined ? psPriceOverride : powerSupply.price;
        const psPrice = totalCount * unitPrice;
        components.push({
          name: `Power Supplies`,
          price: psPrice,
          type: 'power_supplies',
          calculationDisplay: `${totalCount} @ $${formatPrice(Number(unitPrice))}, ${powerSupply.transformer_type}`
        });
      }

      return { components, totalCount };
    } else {
      console.warn(`Power supply type '${psTypeOverride}' not found, falling through to standard selection`);
      // Fall through to standard selection paths
    }
  }

  // =====================================================
  // PATH 3: Standard power supply selection
  // (No optimization, no type override - use customer pref or default)
  // =====================================================
  console.log(`[psSelector] PATH 3: hasUL=${hasUL}, customerPref=${customerPreferences?.pref_power_supply_type}`);
  let powerSupply = null;

  // Check customer preference first
  const customerPrefPSType = customerPreferences?.pref_power_supply_type;
  if (customerPrefPSType) {
    const prefPS = await PricingDataResource.getPowerSupplyByType(customerPrefPSType);
    // Only use customer preference if: no UL required OR the preferred PS is UL-listed
    if (prefPS && (!hasUL || prefPS.ul_listed)) {
      powerSupply = prefPS;
      console.log(`[psSelector] PATH 3: Using customer pref PS:`, powerSupply?.transformer_type);
    } else if (prefPS && hasUL && !prefPS.ul_listed) {
      console.log(`[psSelector] PATH 3: Skipping non-UL customer pref (${prefPS.transformer_type}) because section has UL`);
    }
  }

  // Fall back to default power supply based on UL requirement
  if (!powerSupply) {
    if (hasUL) {
      // Section has UL - prefer UL power supply
      powerSupply = await PricingDataResource.getDefaultULPowerSupply();
      console.log(`[psSelector] PATH 3: UL default PS:`, powerSupply?.transformer_type);
      // Fallback to Speedbox 150W (ID 3) if no default UL configured
      if (!powerSupply) {
        powerSupply = await PricingDataResource.getPowerSupplyById(3);
        console.log(`[psSelector] PATH 3: Fallback to PS ID 3:`, powerSupply?.transformer_type);
      }
    }
    if (!powerSupply) {
      // No UL or UL PS not found - use default non-UL
      powerSupply = await PricingDataResource.getDefaultNonULPowerSupply();
      console.log(`[psSelector] PATH 3: Non-UL default PS:`, powerSupply?.transformer_type);
    }
  }

  if (powerSupply) {
    // Check for user override on PS count
    if (hasExplicitCountOverride) {
      totalCount = Number(psCountOverride);
    } else {
      // Calculate PS count based on watts
      if (!powerSupply.watts) {
        return {
          components: [],
          totalCount: 0,
          error: `Power supply ${powerSupply.transformer_type} missing wattage data`
        };
      }
      totalCount = Math.ceil(totalWattage / powerSupply.watts);
      // If using explicit override (type or count) with zero wattage, default to 1 PS
      if (totalCount === 0 && totalWattage === 0 && hasExplicitOverride) {
        totalCount = 1;
      }
    }

    // Only add component if totalCount > 0
    if (totalCount > 0) {
      const unitPrice = psPriceOverride !== null && psPriceOverride !== undefined ? psPriceOverride : powerSupply.price;
      const psPrice = totalCount * unitPrice;
      components.push({
        name: `Power Supplies`,
        price: psPrice,
        type: 'power_supplies',
        calculationDisplay: `${totalCount} @ $${formatPrice(Number(unitPrice))}, ${powerSupply.transformer_type}`
      });
    }

    return { components, totalCount };
  } else {
    return {
      components: [],
      totalCount: 0,
      error: 'No power supply data found'
    };
  }
}
