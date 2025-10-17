// Power Supply Selector
// Reusable power supply selection logic for all LED-based products
// Handles user overrides, UL requirements, and standard selection

import { ComponentItem } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';

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
// HELPER FUNCTIONS
// =====================================================

/**
 * Format price (integer if whole number, 2 decimals if not)
 */
const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
};

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
  // PATH 1: User-specified power supply type override
  // =====================================================
  if (psTypeOverride && psTypeOverride !== '') {
    const powerSupply = await PricingDataResource.getPowerSupplyByType(psTypeOverride);

    if (powerSupply) {
      // Check for user override on PS count
      if (psCountOverride && !isNaN(Number(psCountOverride))) {
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

      const unitPrice = psPriceOverride !== null && psPriceOverride !== undefined ? psPriceOverride : powerSupply.price;
      const psPrice = totalCount * unitPrice;
      components.push({
        name: `Power Supplies`,
        price: psPrice,
        type: 'power_supplies',
        calculationDisplay: `${totalCount} @ $${formatPrice(Number(unitPrice))}, ${powerSupply.transformer_type}`
      });

      console.log('User-specified Power Supply:', {
        type: powerSupply.transformer_type,
        count: totalCount,
        totalPrice: psPrice
      });

      return { components, totalCount };
    } else {
      console.warn(`Power supply type '${psTypeOverride}' not found, falling through to standard selection`);
      // Fall through to standard selection paths
    }
  }

  // =====================================================
  // PATH 2: UL-required optimization (PS#2 + PS#3 combo)
  // Also use optimization if customer's preferred PS is Speedbox 60W (ID=2)
  // =====================================================

  // Check if customer's preferred power supply is Speedbox 60W
  let useOptimization = hasUL;
  if (!useOptimization && customerPreferences?.pref_power_supply_type) {
    const preferredPS = await PricingDataResource.getPowerSupplyByType(customerPreferences.pref_power_supply_type);
    if (preferredPS?.power_supply_id === 2) {
      useOptimization = true;
    }
  }

  if (useOptimization) {
    const ps2 = await PricingDataResource.getPowerSupplyById(2); // Speedbox 60W (50W actual)
    const ps3 = await PricingDataResource.getPowerSupplyById(3); // Speedbox 150W (120W actual)

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

    // Check for user override on PS count - use default UL PS (Speedbox 60W)
    if (psCountOverride && !isNaN(Number(psCountOverride))) {
      totalCount = Number(psCountOverride);
      const unitPrice = psPriceOverride !== null && psPriceOverride !== undefined ? psPriceOverride : ps2.price;
      const psPrice = totalCount * unitPrice;
      components.push({
        name: `Power Supplies`,
        price: psPrice,
        type: 'power_supplies',
        calculationDisplay: `${totalCount} @ $${formatPrice(Number(unitPrice))}, ${ps2.transformer_type}`
      });

      console.log('User-specified UL Power Supply count:', {
        type: ps2.transformer_type,
        count: totalCount,
        totalPrice: psPrice
      });

      return { components, totalCount };
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

    console.log('UL Power Supply Optimization:', {
      totalWattage,
      ps3Watts: ps3.watts,
      ps2Watts: ps2.watts,
      remainder,
      ps2Count,
      ps3Count
    });

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
  // PATH 3: Standard power supply selection
  // =====================================================
  let powerSupply = null;

  // Check customer preference first
  const customerPrefPSType = customerPreferences?.pref_power_supply_type;
  if (customerPrefPSType) {
    powerSupply = await PricingDataResource.getPowerSupplyByType(customerPrefPSType);
  }

  // Fall back to default non-UL power supply
  if (!powerSupply) {
    powerSupply = await PricingDataResource.getDefaultNonULPowerSupply();
  }

  if (powerSupply) {
    // Check for user override on PS count
    if (psCountOverride && !isNaN(Number(psCountOverride))) {
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

    const unitPrice = psPriceOverride !== null && psPriceOverride !== undefined ? psPriceOverride : powerSupply.price;
    const psPrice = totalCount * unitPrice;
    components.push({
      name: `Power Supplies`,
      price: psPrice,
      type: 'power_supplies',
      calculationDisplay: `${totalCount} @ $${formatPrice(Number(unitPrice))}, ${powerSupply.transformer_type}`
    });

    console.log('Standard Power Supply:', {
      type: powerSupply.transformer_type,
      count: totalCount,
      totalPrice: psPrice
    });

    return { components, totalCount };
  } else {
    return {
      components: [],
      totalCount: 0,
      error: 'No power supply data found'
    };
  }
}
