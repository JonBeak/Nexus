// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed dead code: checkItemRequirement() function (never used, marked as TODO stub)
//   - File size reduced from 419 to 402 lines (4% reduction)
/**
 * Packing Items Mapper
 * Maps product types to their required packing items
 */

export interface PackingItem {
  name: string;
  required: boolean;
}

/**
 * Customer preferences for packing items
 */
export interface CustomerPackingPreferences {
  pattern_yes_or_no?: number | boolean;        // 1 = include, 0 = exclude
  pattern_type?: string;                       // "Paper" or "Digital"
  wiring_diagram_yes_or_no?: number | boolean; // 1 = include, 0 = exclude
}

/**
 * All possible packing items
 */
export const PACKING_ITEM_TYPES = [
  'Pattern',
  'Screws',
  'Pins',
  'Spacers',
  'D-Tape',
  'Wiring Diagram',
  'Transformer',
  'UL Stickers',
  'Drainholes',
  'LED Box',
  'L-angle',
  'Standoffs',
  'Hinged Brackets',
  'End Caps'
] as const;

/**
 * Display name overrides for packing items
 */
const DISPLAY_NAME_MAP: Record<string, string> = {
  'Transformer': 'Power Supply'
};

/**
 * Product type to packing items mapping
 */
const PRODUCT_PACKING_MAP: Record<string, string[]> = {
  'Front Lit': ['Pattern', 'Screws', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Halo Lit': ['Pattern', 'Pins', 'Spacers', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Dual Lit': ['Pattern', 'Screws', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  '3D print': ['Pattern', 'Pins', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Blade Sign': ['Pattern', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Marquee Bulb': ['Pattern', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Substrate Cut': ['Pattern', 'Pins', 'Spacers', 'D-Tape', 'Wiring Diagram', 'Transformer', 'UL Stickers'],
  'Push Thru': ['LED Box', 'L-angle', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Neon LED': ['Pattern', 'Standoffs', 'Transformer'],
  'Return': ['Pattern', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Trim Cap': ['Screws'],
  'Front Lit Push Thru': ['Pattern', 'Screws', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Halo Acrylic': ['Pattern', 'Pins', 'Spacers', 'D-Tape', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Front Lit Acrylic Face': ['Pattern', 'Screws', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Backer': ['L-angle'],
  'Aluminum Raceway': ['L-angle'],
  'Extrusion Raceway': ['Hinged Brackets', 'End Caps'],
  'Dual Lit Acrylic Face': ['Pattern', 'Screws', 'Pins', 'Spacers', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Material Cut': ['Pattern'],
  'Dual Lit - Single Layer': ['Pattern', 'Screws', 'Pins', 'Spacers', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Dual Lit - Double Layer': ['Pattern', 'Screws', 'Pins', 'Spacers', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Channel Letter': ['Pattern', 'Screws', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Reverse Channel': ['Pattern', 'Pins', 'Spacers', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Trimless Channel': ['Pattern', 'Screws', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes'],
  'Knockout Box': ['LED Box', 'L-angle', 'Wiring Diagram', 'Transformer', 'UL Stickers', 'Drainholes']
};

/**
 * Get packing items for a product type
 * @param productType - The product type name
 * @param specifications - Part specifications (for conditional logic)
 * @param customerPreferences - Customer preferences for packing items
 * @returns Array of packing items with required status
 */
export function getPackingItemsForProduct(
  productType: string,
  specifications?: any,
  customerPreferences?: CustomerPackingPreferences
): PackingItem[] {
  // Get base items for this product type
  const requiredItems = PRODUCT_PACKING_MAP[productType] || [];

  // Debug logging
  console.log(`[Packing Items] Getting items for product type: "${productType}"`);
  console.log(`[Packing Items] Base items from map:`, requiredItems);

  // Build comprehensive list with all items
  const allItems = PACKING_ITEM_TYPES.map(itemName => {
    let isRequired = requiredItems.includes(itemName);
    const isInBaseMapping = requiredItems.includes(itemName);
    const hasTemplate = hasTemplateInSpecs(itemName, specifications);

    // Apply customer preference logic for Pattern
    if (itemName === 'Pattern' && customerPreferences) {
      isRequired = shouldIncludePattern(customerPreferences);
    }

    // Apply customer preference logic for Wiring Diagram
    if (itemName === 'Wiring Diagram' && customerPreferences) {
      isRequired = shouldIncludeWiringDiagram(customerPreferences, specifications);
    }

    // Apply specification-based logic for spec-dependent items
    if (specifications) {
      if (itemName === 'Transformer') {
        isRequired = shouldIncludePowerSupply(specifications);
      }
      if (itemName === 'Pins') {
        isRequired = shouldIncludePins(specifications);
      }
      if (itemName === 'Spacers') {
        isRequired = shouldIncludeSpacers(specifications);
      }
      if (itemName === 'UL Stickers') {
        isRequired = shouldIncludeUL(specifications);
      }
      if (itemName === 'Drainholes') {
        isRequired = shouldIncludeDrainHoles(specifications);
      }
      if (itemName === 'D-Tape') {
        isRequired = shouldIncludeDTape(specifications);
      }
    }

    return {
      name: itemName,
      required: isRequired,
      isInBaseMapping,  // Track if item is in product's base mapping
      hasTemplate       // Track if item has a template in specifications
    };
  });

  // Filter to only include relevant items:
  // 1. Items in the base mapping for this product type (always show these)
  // 2. Items NOT in base mapping but have a template in specifications (dynamic items - show even if not required)
  const filteredItems = allItems.filter(item => {
    const itemData = item as any;

    // Always include items in the base mapping for this product type
    if (itemData.isInBaseMapping) {
      return true;
    }

    // Include items NOT in base mapping if they have a template in specifications
    // This ensures items like Pins show up even if count=0 (they'll show as "No")
    if (itemData.hasTemplate) {
      console.log(`[Packing Items] Including "${item.name}" (not in base mapping but has template in specs, required=${item.required})`);
      return true;
    }

    return false;
  });

  console.log(`[Packing Items] Filtered items (${filteredItems.length}):`, filteredItems.map(i => `${i.name}${i.required ? '' : ' (No)'}`));

  // Remove the extra properties before returning and apply display name overrides
  return filteredItems.map(({ name, required }) => ({
    name: DISPLAY_NAME_MAP[name] || name,
    required
  }));
}

/**
 * Helper function to check if a template exists in specifications
 * Used for filtering - determines if an item should appear in the checklist
 */
function hasTemplateInSpecs(templateName: string, specs: any): boolean {
  if (!specs) {
    console.log(`[hasTemplateInSpecs] "${templateName}" - specs is null/undefined`);
    return false;
  }

  // Map packing item names to template names
  const templateMap: Record<string, string[]> = {
    'Transformer': ['Power Supply'],
    'Pins': ['Mounting'],
    'Spacers': ['Mounting'],  // Spacers are part of Mounting template
    'UL Stickers': ['UL'],
    'Drainholes': ['Drain Holes'],
    'D-Tape': ['D-Tape', 'D-tape', 'Dtape', 'DTape', 'D tape'],  // Check variations
    'LED Box': ['LED Box'],
    'L-angle': ['L-angle'],
    'Standoffs': ['Standoffs'],
    'Hinged Brackets': ['Hinged Brackets'],
    'End Caps': ['End Caps']
  };

  const templates = templateMap[templateName];
  if (!templates) {
    console.log(`[hasTemplateInSpecs] "${templateName}" - no template mapping found`);
    return false;
  }

  console.log(`[hasTemplateInSpecs] Checking "${templateName}" against variations: [${templates.join(', ')}]`);

  // Check if any matching template exists in specs
  // Loop up to 100 to handle combined parent + sub-item specifications
  for (let i = 1; i <= 100; i++) {
    const specTemplateName = specs[`_template_${i}`];
    if (specTemplateName) {
      console.log(`[hasTemplateInSpecs]   _template_${i} = "${specTemplateName}"`);
      if (templates.some(t => specTemplateName.toLowerCase().includes(t.toLowerCase()))) {
        console.log(`[hasTemplateInSpecs] ✅ FOUND "${templateName}" - template "${specTemplateName}" matches!`);
        return true;
      }
    }
  }

  console.log(`[hasTemplateInSpecs] ❌ NOT FOUND "${templateName}"`);
  return false;
}

/**
 * Determine if Pattern should be included based on customer preferences
 * Excel Logic:
 *   IF(patType = "Digital", "No",
 *     IFS(pat=1, "", pat=0, "No", 1, "error"))
 *
 * Translation:
 * - If pattern_type is "Digital" → Exclude (no physical pattern needed)
 * - Else if pattern_yes_or_no = 1 → Include
 * - Else if pattern_yes_or_no = 0 → Exclude
 */
function shouldIncludePattern(prefs: CustomerPackingPreferences): boolean {
  // If pattern type is Digital, exclude physical pattern
  if (prefs.pattern_type === 'Digital') {
    return false;
  }

  // Otherwise, use pattern_yes_or_no preference
  // Database stores as tinyint: 1 = yes, 0 = no
  const patternPref = prefs.pattern_yes_or_no;
  return patternPref === 1 || patternPref === true;
}

/**
 * Determine if Wiring Diagram should be included
 * Requires: customer preference enabled AND LEDs exist in specs
 */
function shouldIncludeWiringDiagram(prefs: CustomerPackingPreferences, specs?: any): boolean {
  // Customer must have preference enabled
  const wiringPref = prefs.wiring_diagram_yes_or_no;
  if (wiringPref !== 1 && wiringPref !== true) {
    return false;
  }

  // Must have LEDs in the specs with count > 0
  if (!specs) return false;

  return hasLEDsInSpecs(specs);
}

/**
 * Check if LEDs template exists with count > 0
 */
function hasLEDsInSpecs(specs: any): boolean {
  for (let i = 1; i <= 100; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) continue;

    // Check for LEDs template with count > 0
    if (templateName.toLowerCase() === 'leds') {
      const count = specs[`row${i}_count`];
      if (count && parseInt(count, 10) > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determine if Power Supply (Transformer) should be included
 * Include if Power Supply specs exist with count > 0
 */
function shouldIncludePowerSupply(specs: any): boolean {
  if (!specs) return false;

  // Check for Power Supply template
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (templateName === 'Power Supply') {
      const count = specs[`row${i}_count`];
      return count && parseInt(count, 10) > 0;
    }
  }

  return false;
}

/**
 * Determine if Pins should be included
 * Include if Mounting specs exist with count > 0 AND pin type is specified
 */
function shouldIncludePins(specs: any): boolean {
  if (!specs) return false;

  // Check for Mounting template
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (templateName === 'Mounting') {
      const count = specs[`row${i}_count`];
      const pinType = specs[`row${i}_pins`];

      // Only include if count > 0 AND pin type is specified
      const hasCount = count && parseInt(count, 10) > 0;
      const hasPinType = pinType && String(pinType).trim() !== '';

      return hasCount && hasPinType;
    }
  }

  return false;
}

/**
 * Determine if Spacers should be included
 * Include if Mounting template has count > 0 AND spacers type is specified
 */
function shouldIncludeSpacers(specs: any): boolean {
  if (!specs) return false;

  // Check for Mounting template with spacers
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (templateName === 'Mounting') {
      const count = specs[`row${i}_count`];
      const spacersValue = specs[`row${i}_spacers`];

      // Only include if count > 0 AND spacer type is specified
      const hasCount = count && parseInt(count, 10) > 0;
      const hasSpacerType = spacersValue && String(spacersValue).trim() !== '';

      return hasCount && hasSpacerType;
    }
  }

  return false;
}

/**
 * Determine if UL Stickers should be included
 * Include if part has UL specification with include = true
 */
function shouldIncludeUL(specs: any): boolean {
  if (!specs) return false;

  // Check for UL template in specifications
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (templateName === 'UL') {
      const includeValue = specs[`row${i}_include`];
      // If include field exists, check its value
      if (includeValue !== undefined) {
        return includeValue === 'true' || includeValue === true || includeValue === 'Yes';
      }
      // If include field doesn't exist but template does, assume it should be included
      return true;
    }
  }

  return false;
}

/**
 * Determine if Drain Holes should be included
 * Include if Drain Holes spec is set to "true"
 */
function shouldIncludeDrainHoles(specs: any): boolean {
  if (!specs) return false;

  // Check for Drain Holes template
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (templateName === 'Drain Holes') {
      const includeValue = specs[`row${i}_include`];
      return includeValue === 'true' || includeValue === true;
    }
  }

  return false;
}

/**
 * Determine if D-Tape should be included
 * Include if D-Tape template exists AND include value is "Yes"
 */
function shouldIncludeDTape(specs: any): boolean {
  if (!specs) return false;

  // D-Tape template name variations to check
  const dtapeVariations = ['d-tape', 'dtape', 'd tape'];

  // Check for D-Tape template and its include value
  // Loop up to 100 to handle combined parent + sub-item specifications
  for (let i = 1; i <= 100; i++) {
    const templateName = specs[`_template_${i}`];
    if (templateName) {
      const lowerTemplateName = templateName.toLowerCase();

      // Check if template name matches any D-Tape variation
      const isDTapeTemplate = dtapeVariations.some(variation =>
        lowerTemplateName.includes(variation)
      );

      if (isDTapeTemplate) {
        const includeValue = specs[`row${i}_include`];
        console.log(`[D-Tape] Found template "${templateName}", includeValue="${includeValue}"`);

        // Check if include field exists and is set to "Yes"
        if (includeValue !== undefined) {
          const shouldInclude = includeValue === 'true' || includeValue === true || includeValue === 'Yes' || String(includeValue).toLowerCase() === 'yes';
          console.log(`[D-Tape] Include value check: ${shouldInclude}`);
          return shouldInclude;
        }

        // If no include field, default to false (don't include)
        console.log(`[D-Tape] No include field found, defaulting to false`);
        return false;
      }
    }
  }

  console.log(`[D-Tape] No D-Tape template found in specifications`);
  return false;
}

