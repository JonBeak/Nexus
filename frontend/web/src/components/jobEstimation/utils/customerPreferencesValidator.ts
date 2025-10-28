// Validation logic for customer preferences panel
// Checks if estimate items match customer manufacturing preferences

import { EstimatePreviewData, EstimateLineItem } from '../core/layers/CalculationLayer';
import { CustomerManufacturingPreferences } from '../core/validation/context/useCustomerPreferences';
import {
  CustomerPreferencesValidationResult,
  SubtotalSection,
  ValidationError
} from '../types/customerPreferences';

/**
 * Validates estimate items against customer preferences
 * Returns validation errors/warnings for display in CustomerPreferencesPanel
 */
export function validateCustomerPreferences(
  estimatePreviewData: EstimatePreviewData | null,
  preferences: CustomerManufacturingPreferences | null,
  discount?: number
): CustomerPreferencesValidationResult {
  // Default to no errors
  const defaultResult: CustomerPreferencesValidationResult = {
    ul: { hasError: false, severity: 'red', subtotalSections: [] },
    wireLength: { hasError: false, severity: 'red', subtotalSections: [] },
    plugNPlay: { hasError: false, severity: 'red', subtotalSections: [] },
    shipping: { hasError: false, severity: 'red', subtotalSections: [] },
    discount: { hasError: false, severity: 'red', subtotalSections: [] }
  };

  // If no data or no preferences, return no errors
  if (!estimatePreviewData || !preferences || estimatePreviewData.items.length === 0) {
    return defaultResult;
  }

  // Group items by subtotal sections
  const sections = groupBySubtotalSections(estimatePreviewData.items);

  // Run validation rules
  const ulValidation = validateUL(sections, preferences);
  const wireLengthValidation = validateWireLength(sections, preferences);
  const plugNPlayValidation = validatePlugNPlay(sections, preferences);
  const shippingValidation = validateShipping(estimatePreviewData.items, preferences);
  const discountValidation = validateDiscount(sections, preferences, discount);

  return {
    ul: ulValidation,
    wireLength: wireLengthValidation,
    plugNPlay: plugNPlayValidation,
    shipping: shippingValidation,
    discount: discountValidation
  };
}

/**
 * Groups estimate items by subtotal sections
 * Subtotal lines (productTypeId === 21) mark section boundaries
 */
function groupBySubtotalSections(items: EstimateLineItem[]): SubtotalSection[] {
  const sections: SubtotalSection[] = [];
  let currentSectionItems: EstimateLineItem[] = [];
  let sectionIndex = 0;
  let startItemIndex = 0;

  items.forEach((item, index) => {
    const isSubtotal = item.productTypeId === 21;

    if (isSubtotal) {
      // End current section
      if (currentSectionItems.length > 0) {
        const subtotal = currentSectionItems.reduce((sum, i) => sum + i.extendedPrice, 0);
        sections.push({
          sectionIndex,
          startItemIndex,
          endItemIndex: index - 1,
          items: [...currentSectionItems],
          subtotal
        });
        sectionIndex++;
      }

      // Start new section
      currentSectionItems = [];
      startItemIndex = index + 1;
    } else {
      currentSectionItems.push(item);
    }
  });

  // Add final section if items remain
  if (currentSectionItems.length > 0) {
    const subtotal = currentSectionItems.reduce((sum, i) => sum + i.extendedPrice, 0);
    sections.push({
      sectionIndex,
      startItemIndex,
      endItemIndex: items.length - 1,
      items: [...currentSectionItems],
      subtotal
    });
  }

  return sections;
}

/**
 * Validate UL requirement per subtotal section
 * Rule: Customer requires UL + LEDs exist + NO UL product = RED
 */
function validateUL(
  sections: SubtotalSection[],
  preferences: CustomerManufacturingPreferences
): ValidationError {
  const errorSections: number[] = [];

  // Only validate if customer requires UL
  if (!preferences.pref_ul_required) {
    return { hasError: false, severity: 'red', subtotalSections: [] };
  }

  sections.forEach(section => {
    const hasLEDs = section.items.some(item => item.itemName.includes('LEDs'));
    const hasUL = section.items.some(item => item.itemName.includes('UL'));

    if (hasLEDs && !hasUL) {
      errorSections.push(section.sectionIndex);
    }
  });

  return {
    hasError: errorSections.length > 0,
    severity: 'red',
    subtotalSections: errorSections,
    message: errorSections.length > 0
      ? `UL missing in section(s): ${errorSections.map(i => i + 1).join(', ')}`
      : undefined
  };
}

/**
 * Validate wire length requirement per subtotal section
 * Rule: Custom length > 8ft + LEDs exist + NO Extra Wire product = RED
 */
function validateWireLength(
  sections: SubtotalSection[],
  preferences: CustomerManufacturingPreferences
): ValidationError {
  const errorSections: number[] = [];

  // Only validate if custom wire length > 8ft
  const wireLength = preferences.pref_wire_length || 8;
  if (wireLength <= 8) {
    return { hasError: false, severity: 'red', subtotalSections: [] };
  }

  sections.forEach(section => {
    const hasLEDs = section.items.some(item => item.itemName.includes('LEDs'));
    const hasExtraWire = section.items.some(item => item.itemName.includes('Extra Wire'));

    if (hasLEDs && !hasExtraWire) {
      errorSections.push(section.sectionIndex);
    }
  });

  return {
    hasError: errorSections.length > 0,
    severity: 'red',
    subtotalSections: errorSections,
    message: errorSections.length > 0
      ? `Extra wire required (${wireLength}ft) but missing in section(s): ${errorSections.map(i => i + 1).join(', ')}`
      : undefined
  };
}

/**
 * Validate Plug N Play requirement per subtotal section
 * Rule: (LEDs exist OR PS exist) + NO Plugs item = RED
 */
function validatePlugNPlay(
  sections: SubtotalSection[],
  preferences: CustomerManufacturingPreferences
): ValidationError {
  const errorSections: number[] = [];

  // Only validate if customer requires plug and play
  if (!preferences.pref_plug_and_play_required) {
    return { hasError: false, severity: 'red', subtotalSections: [] };
  }

  sections.forEach(section => {
    const hasLEDs = section.items.some(item => item.itemName.includes('LEDs'));
    const hasPS = section.items.some(item => item.itemName.includes('Power Supplies'));
    const hasPlugs = section.items.some(item => item.itemName.includes('Plugs'));

    if ((hasLEDs || hasPS) && !hasPlugs) {
      errorSections.push(section.sectionIndex);
    }
  });

  return {
    hasError: errorSections.length > 0,
    severity: 'red',
    subtotalSections: errorSections,
    message: errorSections.length > 0
      ? `Plug N Play required but missing in section(s): ${errorSections.map(i => i + 1).join(', ')}`
      : undefined
  };
}

/**
 * Validate shipping requirement (entire estimate)
 * Rule: Customer preference = Yes + NO shipping product = RED
 */
function validateShipping(
  items: EstimateLineItem[],
  preferences: CustomerManufacturingPreferences
): ValidationError {
  // Only validate if customer requires shipping
  if (!preferences.pref_shipping_required) {
    return { hasError: false, severity: 'red' };
  }

  const hasShipping = items.some(item => item.itemName.includes('Shipping'));

  return {
    hasError: !hasShipping,
    severity: 'red',
    message: !hasShipping ? 'Shipping required but not included in estimate' : undefined
  };
}

/**
 * Validate discount per subtotal section
 * Rule: Discount preference exists + NO discount line
 * RED if subtotal >= $1000, YELLOW if subtotal < $1000
 */
function validateDiscount(
  sections: SubtotalSection[],
  preferences: CustomerManufacturingPreferences,
  customerDiscount?: number
): ValidationError {
  const redErrorSections: number[] = [];
  const yellowWarningSections: number[] = [];

  // Only validate if customer has discount preference
  if (!customerDiscount || customerDiscount <= 0) {
    return { hasError: false, severity: 'red', subtotalSections: [] };
  }

  sections.forEach(section => {
    const hasDiscount = section.items.some(item => item.itemName.includes('Discount'));

    if (!hasDiscount) {
      if (section.subtotal >= 1000) {
        redErrorSections.push(section.sectionIndex);
      } else {
        yellowWarningSections.push(section.sectionIndex);
      }
    }
  });

  // Prioritize red errors over yellow warnings
  if (redErrorSections.length > 0) {
    return {
      hasError: true,
      severity: 'red',
      subtotalSections: redErrorSections,
      message: `Discount (${customerDiscount}%) missing in high-value section(s): ${redErrorSections.map(i => i + 1).join(', ')}`
    };
  }

  if (yellowWarningSections.length > 0) {
    return {
      hasError: true,
      severity: 'yellow',
      subtotalSections: yellowWarningSections,
      message: `Discount (${customerDiscount}%) missing in section(s): ${yellowWarningSections.map(i => i + 1).join(', ')}`
    };
  }

  return { hasError: false, severity: 'red', subtotalSections: [] };
}
