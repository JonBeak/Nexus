/**
 * Order Specification Templates
 * Phase 1.5.d - Specification templates mapped to QuickBooks Item Names
 *
 * Each template defines 1-3 specification fields with their input types and options.
 * These are displayed in the "Specs" table in the Order Details page.
 */

import {
  PREFINISHED_COLORS,
  RETURN_DEPTHS,
  FACE_MATERIALS,
  FACE_COLORS,
  DRAIN_HOLE_SIZES,
  VINYL_APPLICATIONS,
  DIGITAL_PRINT_TYPES,
  WIRE_GAUGES,
  CUTTING_METHODS,
  PAINTING_COMPONENTS,
  PAINTING_TIMINGS,
  MATERIAL_COLOURS,
  BOX_MATERIALS,
  BOX_COLOURS,
  BOX_FABRICATION,
  PUSH_THRU_THICKNESSES,
  PUSH_THRU_COLOURS,
  NEON_BASE_THICKNESSES,
  NEON_BASE_MATERIALS,
  NEON_BASE_COLOURS,
  NEON_LED_STROKE_WIDTHS,
  NEON_LED_COLOURS,
  D_TAPE_THICKNESSES,
  PIN_TYPES,
  SPACER_TYPES,
  EXTRUSION_COLOURS,
  BACK_MATERIALS,
  type LEDType,
  type PowerSupplyType
} from './specificationConstants';

/**
 * Field input types
 */
export type SpecFieldType = 'dropdown' | 'combobox' | 'textbox' | 'boolean';

/**
 * Specification field definition
 */
export interface SpecificationField {
  key: string;           // JSON key in order_parts.specifications
  label: string;         // Display label
  type: SpecFieldType;   // Input type
  options?: readonly string[] | string[];  // For dropdown/combobox
  placeholder?: string;  // Placeholder text for textbox/combobox custom input
  required?: boolean;    // Whether field is required
}

/**
 * Specification template
 */
export interface SpecificationTemplate {
  templateName: string;             // Template identifier
  spec1?: SpecificationField;       // First specification
  spec2?: SpecificationField;       // Second specification
  spec3?: SpecificationField;       // Third specification
}

/**
 * Template: Return
 * Spec 1: Depth (combobox: 3", 4", 5", custom)
 * Spec 2: Colour (dropdown: prefinished colors)
 * Spec 3: -
 */
export const RETURN_TEMPLATE: SpecificationTemplate = {
  templateName: 'Return',
  spec1: {
    key: 'depth',
    label: 'Depth',
    type: 'combobox',
    options: RETURN_DEPTHS,
    placeholder: 'Depth'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'dropdown',
    options: PREFINISHED_COLORS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Trim
 * Spec 1: Colour (dropdown: prefinished colors)
 * Spec 2: -
 * Spec 3: -
 */
export const TRIM_TEMPLATE: SpecificationTemplate = {
  templateName: 'Trim',
  spec1: {
    key: 'colour',
    label: 'Colour',
    type: 'dropdown',
    options: PREFINISHED_COLORS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Face
 * Spec 1: Material (combobox: 2mm PC, 3mm PC, 3mm ACM, 1mm Aluminum)
 * Spec 2: Colour (combobox: White, Black, custom)
 * Spec 3: -
 */
export const FACE_TEMPLATE: SpecificationTemplate = {
  templateName: 'Face',
  spec1: {
    key: 'material',
    label: 'Material',
    type: 'combobox',
    options: FACE_MATERIALS,
    placeholder: 'Material'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: FACE_COLORS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Vinyl
 * Spec 1: Colours (textbox) - Multi-select vinyl products (deferred)
 * Spec 2: Application (combobox: Face, Return Wrap, Trim Wrap, etc.)
 * Spec 3: Size (textbox) - Auto-filled with yards from estimate
 *
 * NOTE: Full vinyl selector implementation deferred to later phase
 */
export const VINYL_TEMPLATE: SpecificationTemplate = {
  templateName: 'Vinyl',
  spec1: {
    key: 'colours',
    label: 'Vinyl',
    type: 'textbox',
    placeholder: 'Vinyl Code'
  },
  spec2: {
    key: 'application',
    label: 'Application',
    type: 'combobox',
    options: VINYL_APPLICATIONS,
    placeholder: 'Application'
  },
  spec3: {
    key: 'size',
    label: 'Size',
    type: 'textbox',
    placeholder: 'Size (e.g., 5yd)'
  }
};

/**
 * Template: Digital Print
 * Spec 1: Colour (textbox)
 * Spec 2: Type (dropdown: Translucent, Opaque, Clear, Perforated)
 * Spec 3: Application (combobox: Face, Return Wrap, Trim Wrap, etc.)
 */
export const DIGITAL_PRINT_TEMPLATE: SpecificationTemplate = {
  templateName: 'Digital Print',
  spec1: {
    key: 'colour',
    label: 'Colour',
    type: 'textbox',
    placeholder: 'Colour'
  },
  spec2: {
    key: 'type',
    label: 'Type',
    type: 'dropdown',
    options: DIGITAL_PRINT_TYPES,
    placeholder: 'Type'
  },
  spec3: {
    key: 'application',
    label: 'Application',
    type: 'combobox',
    options: VINYL_APPLICATIONS,
    placeholder: 'Application'
  }
};

/**
 * Template: LEDs
 * Spec 1: LED count (textbox)
 * Spec 2: LED Type (dropdown from database)
 * Spec 3: Note (textbox)
 *
 * NOTE: LED Type options populated from API at runtime
 */
export const LEDS_TEMPLATE: SpecificationTemplate = {
  templateName: 'LEDs',
  spec1: {
    key: 'count',
    label: 'LED count',
    type: 'textbox',
    placeholder: 'LED count'
  },
  spec2: {
    key: 'led_type',
    label: 'LED Type',
    type: 'dropdown',
    options: [], // Populated from API
    placeholder: 'LED Type'
  },
  spec3: {
    key: 'note',
    label: 'Note',
    type: 'textbox',
    placeholder: 'Additional notes'
  }
};

/**
 * Template: Power Supply
 * Spec 1: PS count (textbox)
 * Spec 2: PS Type (dropdown from database)
 * Spec 3: Note (textbox)
 *
 * NOTE: PS Type options populated from API at runtime
 */
export const POWER_SUPPLY_TEMPLATE: SpecificationTemplate = {
  templateName: 'Power Supply',
  spec1: {
    key: 'count',
    label: 'PS count',
    type: 'textbox',
    placeholder: 'PS count'
  },
  spec2: {
    key: 'ps_type',
    label: 'PS Type',
    type: 'dropdown',
    options: [], // Populated from API
    placeholder: 'PS Type'
  },
  spec3: {
    key: 'note',
    label: 'Note',
    type: 'textbox',
    placeholder: 'Additional notes'
  }
};

/**
 * Template: Wire Length
 * Spec 1: Length (textbox)
 * Spec 2: Wire Gauge (combobox: 18 AWG, 22 AWG)
 * Spec 3: -
 */
export const WIRE_LENGTH_TEMPLATE: SpecificationTemplate = {
  templateName: 'Wire Length',
  spec1: {
    key: 'length',
    label: 'Length',
    type: 'textbox',
    placeholder: 'Length'
  },
  spec2: {
    key: 'wire_gauge',
    label: 'Wire Gauge',
    type: 'combobox',
    options: WIRE_GAUGES,
    placeholder: 'Wire Gauge'
  }
};

/**
 * Template: UL
 * Spec 1: Include (boolean yes/no)
 * Spec 2: Note (textbox)
 * Spec 3: -
 */
export const UL_TEMPLATE: SpecificationTemplate = {
  templateName: 'UL',
  spec1: {
    key: 'include',
    label: 'Include',
    type: 'boolean',
    placeholder: 'Yes/No'
  },
  spec2: {
    key: 'note',
    label: 'Note',
    type: 'textbox',
    placeholder: 'Additional notes'
  }
};

/**
 * Template: Drain Holes
 * Spec 1: Include (boolean yes/no)
 * Spec 2: Size (combobox: Default 1/4", Custom)
 * Spec 3: -
 */
export const DRAIN_HOLES_TEMPLATE: SpecificationTemplate = {
  templateName: 'Drain Holes',
  spec1: {
    key: 'include',
    label: 'Include',
    type: 'boolean',
    placeholder: 'Yes/No'
  },
  spec2: {
    key: 'size',
    label: 'Size',
    type: 'combobox',
    options: DRAIN_HOLE_SIZES,
    placeholder: 'Hole size'
  }
};

/**
 * Template: Notes
 * Spec 1: Additional notes (textbox)
 * Spec 2: -
 * Spec 3: -
 */
export const NOTES_TEMPLATE: SpecificationTemplate = {
  templateName: 'Notes',
  spec1: {
    key: 'additional_notes',
    label: 'Additional notes',
    type: 'textbox',
    placeholder: 'Additional notes'
  }
};

/**
 * Template: Cutting
 * Spec 1: Method (combobox: Router, Laser, Router & Laser)
 * Spec 2: -
 * Spec 3: -
 */
export const CUTTING_TEMPLATE: SpecificationTemplate = {
  templateName: 'Cutting',
  spec1: {
    key: 'method',
    label: 'Method',
    type: 'combobox',
    options: CUTTING_METHODS,
    placeholder: 'Method'
  }
};

/**
 * Template: Painting
 * Spec 1: Colour (textbox)
 * Spec 2: Component (combobox: Return, Trim, Face, etc.)
 * Spec 3: Timing (combobox: Pre-Cutting, Post-Cutting, etc.)
 */
export const PAINTING_TEMPLATE: SpecificationTemplate = {
  templateName: 'Painting',
  spec1: {
    key: 'colour',
    label: 'Colour',
    type: 'textbox',
    placeholder: 'Colour'
  },
  spec2: {
    key: 'component',
    label: 'Component',
    type: 'combobox',
    options: PAINTING_COMPONENTS,
    placeholder: 'Component'
  },
  spec3: {
    key: 'timing',
    label: 'Timing',
    type: 'combobox',
    options: PAINTING_TIMINGS,
    placeholder: 'Timing'
  }
};

// OLD MOUNTING_TEMPLATE REMOVED - replaced by MOUNTING_NEW_TEMPLATE (formerly PINS_TEMPLATE)
// The old template had Type/Pin Length/Spacer Length fields
// The new template has Count/Pins/Spacers fields which provides better detail

/**
 * Template: Material
 * Spec 1: Substrate (dropdown from database)
 * Spec 2: Colour (combobox: Matte White, Matte Black, etc.)
 * Spec 3: -
 *
 * NOTE: Substrate options populated from API at runtime
 */
export const MATERIAL_TEMPLATE: SpecificationTemplate = {
  templateName: 'Material',
  spec1: {
    key: 'substrate',
    label: 'Substrate',
    type: 'dropdown',
    options: [], // Populated from API
    placeholder: 'Substrate'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: MATERIAL_COLOURS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Box Type
 * Spec 1: Material (combobox: 3mm ACM, 1mm Aluminum)
 * Spec 2: Colour (combobox: Matte Black, White, Red)
 * Spec 3: Fabrication (combobox: 2" Angle Return, Folded)
 */
export const BOX_TYPE_TEMPLATE: SpecificationTemplate = {
  templateName: 'Box Type',
  spec1: {
    key: 'material',
    label: 'Material',
    type: 'combobox',
    options: BOX_MATERIALS,
    placeholder: 'Material'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: BOX_COLOURS,
    placeholder: 'Colour'
  },
  spec3: {
    key: 'fabrication',
    label: 'Fabrication',
    type: 'combobox',
    options: BOX_FABRICATION,
    placeholder: 'Fabrication'
  }
};

/**
 * Template: Acrylic
 * Spec 1: Thickness (combobox: 12mm, 9mm, 6mm, 0mm (Knockout))
 * Spec 2: Colour (combobox: 2447 White, Clear)
 * Spec 3: -
 */
export const ACRYLIC_TEMPLATE: SpecificationTemplate = {
  templateName: 'Acrylic',
  spec1: {
    key: 'thickness',
    label: 'Thickness',
    type: 'combobox',
    options: PUSH_THRU_THICKNESSES,
    placeholder: 'Thickness'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: PUSH_THRU_COLOURS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Neon Base
 * Spec 1: Thickness (combobox: 12mm, 9mm, 6mm)
 * Spec 2: Material (combobox: Acrylic, PVC)
 * Spec 3: Colour (combobox: Clear, 2447 White, etc.)
 */
export const NEON_BASE_TEMPLATE: SpecificationTemplate = {
  templateName: 'Neon Base',
  spec1: {
    key: 'thickness',
    label: 'Thickness',
    type: 'combobox',
    options: NEON_BASE_THICKNESSES,
    placeholder: 'Thickness'
  },
  spec2: {
    key: 'material',
    label: 'Material',
    type: 'combobox',
    options: NEON_BASE_MATERIALS,
    placeholder: 'Material'
  },
  spec3: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: NEON_BASE_COLOURS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Neon LED
 * Spec 1: Stroke Width (combobox: 8mm, 6mm)
 * Spec 2: Colour (combobox: Pure White, Warm White, etc.)
 * Spec 3: -
 */
export const NEON_LED_TEMPLATE: SpecificationTemplate = {
  templateName: 'Neon LED',
  spec1: {
    key: 'stroke_width',
    label: 'Stroke Width',
    type: 'combobox',
    options: NEON_LED_STROKE_WIDTHS,
    placeholder: 'Stroke Width'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: NEON_LED_COLOURS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Assembly
 * Spec 1: Description (textbox)
 * Spec 2: -
 * Spec 3: -
 */
export const ASSEMBLY_TEMPLATE: SpecificationTemplate = {
  templateName: 'Assembly',
  spec1: {
    key: 'description',
    label: 'Description',
    type: 'textbox',
    placeholder: 'Description'
  }
};

/**
 * Template: D-Tape
 * Spec 1: Include (boolean yes/no)
 * Spec 2: Thickness (combobox: 62 MIL (Thick), 45 MIL (Medium), 16 MIL (Thin))
 * Spec 3: -
 */
export const D_TAPE_TEMPLATE: SpecificationTemplate = {
  templateName: 'D-Tape',
  spec1: {
    key: 'include',
    label: 'Include',
    type: 'boolean',
    placeholder: 'Yes/No'
  },
  spec2: {
    key: 'thickness',
    label: 'Thickness',
    type: 'combobox',
    options: D_TAPE_THICKNESSES,
    placeholder: 'Thickness'
  }
};

/**
 * Template: Mounting (renamed from Pins)
 * Spec 1: Count (textbox)
 * Spec 2: Pins (combobox: pin types including nylon and SS variants)
 * Spec 3: Spacers (combobox: spacer types with inserts, rivnuts, stand off)
 */
export const MOUNTING_TEMPLATE: SpecificationTemplate = {
  templateName: 'Mounting',
  spec1: {
    key: 'count',
    label: 'Count',
    type: 'textbox',
    placeholder: 'Count'
  },
  spec2: {
    key: 'pins',
    label: 'Pins',
    type: 'combobox',
    options: PIN_TYPES,
    placeholder: 'Pin Type'
  },
  spec3: {
    key: 'spacers',
    label: 'Spacers',
    type: 'combobox',
    options: SPACER_TYPES,
    placeholder: 'Spacer Type'
  }
};

/**
 * Template: Cut
 * Spec 1: Include (boolean yes/no)
 * Spec 2: -
 * Spec 3: -
 */
export const CUT_TEMPLATE: SpecificationTemplate = {
  templateName: 'Cut',
  spec1: {
    key: 'include',
    label: 'Include',
    type: 'boolean',
    placeholder: 'Yes/No'
  }
};

/**
 * Template: Peel
 * Spec 1: Include (boolean yes/no)
 * Spec 2: -
 * Spec 3: -
 */
export const PEEL_TEMPLATE: SpecificationTemplate = {
  templateName: 'Peel',
  spec1: {
    key: 'include',
    label: 'Include',
    type: 'boolean',
    placeholder: 'Yes/No'
  }
};

/**
 * Template: Mask
 * Spec 1: Include (boolean yes/no)
 * Spec 2: -
 * Spec 3: -
 */
export const MASK_TEMPLATE: SpecificationTemplate = {
  templateName: 'Mask',
  spec1: {
    key: 'include',
    label: 'Include',
    type: 'boolean',
    placeholder: 'Yes/No'
  }
};

/**
 * Template: Extr. Colour
 * Spec 1: Colour (combobox: White, Gray, Black)
 * Spec 2: -
 * Spec 3: -
 */
export const EXTR_COLOUR_TEMPLATE: SpecificationTemplate = {
  templateName: 'Extr. Colour',
  spec1: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: EXTRUSION_COLOURS,
    placeholder: 'Colour'
  }
};

/**
 * Template: Back
 * Spec 1: Material (combobox: 2mm ACM, 2mm White PC, 2mm Clear PC)
 * Spec 2: -
 * Spec 3: -
 */
export const BACK_TEMPLATE: SpecificationTemplate = {
  templateName: 'Back',
  spec1: {
    key: 'material',
    label: 'Material',
    type: 'combobox',
    options: BACK_MATERIALS,
    placeholder: 'Material'
  }
};

/**
 * Template registry - maps template names to templates
 * Note: 'Pins' was renamed to 'Mounting' - backward compatibility handled in getSpecificationTemplate()
 * Note: 'Box Material' was renamed to 'Box Type' - backward compatibility handled in getSpecificationTemplate()
 */
const TEMPLATE_REGISTRY: Record<string, SpecificationTemplate> = {
  'Return': RETURN_TEMPLATE,
  'Trim': TRIM_TEMPLATE,
  'Face': FACE_TEMPLATE,
  'Vinyl': VINYL_TEMPLATE,
  'Digital Print': DIGITAL_PRINT_TEMPLATE,
  'LEDs': LEDS_TEMPLATE,
  'Power Supply': POWER_SUPPLY_TEMPLATE,
  'Wire Length': WIRE_LENGTH_TEMPLATE,
  'UL': UL_TEMPLATE,
  'Drain Holes': DRAIN_HOLES_TEMPLATE,
  'Notes': NOTES_TEMPLATE,
  'Cutting': CUTTING_TEMPLATE,
  'Painting': PAINTING_TEMPLATE,
  'Mounting': MOUNTING_TEMPLATE,
  'Material': MATERIAL_TEMPLATE,
  'Box Type': BOX_TYPE_TEMPLATE,
  'Acrylic': ACRYLIC_TEMPLATE,
  'Neon Base': NEON_BASE_TEMPLATE,
  'Neon LED': NEON_LED_TEMPLATE,
  'Assembly': ASSEMBLY_TEMPLATE,
  'D-Tape': D_TAPE_TEMPLATE,
  'Cut': CUT_TEMPLATE,
  'Peel': PEEL_TEMPLATE,
  'Mask': MASK_TEMPLATE,
  'Extr. Colour': EXTR_COLOUR_TEMPLATE,
  'Back': BACK_TEMPLATE
};

/**
 * Module-level cache for template data
 */
let templatesPopulated = false;
let cachedLEDs: LEDType[] = [];
let cachedPowerSupplies: PowerSupplyType[] = [];
let cachedMaterials: string[] = [];

/**
 * Get specification template by name
 *
 * @param templateName - Template name
 * @returns Template or undefined if not found
 *
 * Note: Includes deprecated templates for backward compatibility with legacy orders
 */
export function getSpecificationTemplate(templateName: string): SpecificationTemplate | undefined {
  // Check main registry first
  const template = TEMPLATE_REGISTRY[templateName];
  if (template) {
    return template;
  }

  // Handle deprecated templates (not in registry but needed for legacy orders)
  if (templateName === 'Pins') {
    // 'Pins' was renamed to 'Mounting' - redirect to new template
    return MOUNTING_TEMPLATE;
  }

  if (templateName === 'Box Material') {
    // 'Box Material' was renamed to 'Box Type' - redirect to new template
    return BOX_TYPE_TEMPLATE;
  }

  return undefined;
}

/**
 * Check if templates have been populated with API data
 *
 * @returns true if templates are already populated
 */
export function areTemplatesPopulated(): boolean {
  return templatesPopulated;
}

/**
 * Get cached LED data
 *
 * @returns Cached LEDs array
 */
export function getCachedLEDs(): LEDType[] {
  return cachedLEDs;
}

/**
 * Get cached Power Supply data
 *
 * @returns Cached power supplies array
 */
export function getCachedPowerSupplies(): PowerSupplyType[] {
  return cachedPowerSupplies;
}

/**
 * Populate LED options in the LEDs template
 * Called after fetching LED data from API
 * Caches data to avoid repeated API calls
 *
 * @param leds - Array of LED types from API
 */
export function populateLEDOptions(leds: LEDType[]): void {
  if (!leds || !Array.isArray(leds)) {
    console.warn('populateLEDOptions called with invalid data:', leds);
    return;
  }
  cachedLEDs = leds;
  if (LEDS_TEMPLATE.spec2) {
    LEDS_TEMPLATE.spec2.options = leds.map(led =>
      `${led.product_code} - ${led.colour} (${led.watts}W, ${led.volts}V)`
    );
  }
  // Mark templates as populated when all have been set
  if (cachedLEDs.length > 0 && cachedPowerSupplies.length > 0 && cachedMaterials.length > 0) {
    templatesPopulated = true;
  }
}

/**
 * Populate Power Supply options in the Power Supply template
 * Called after fetching power supply data from API
 * Caches data to avoid repeated API calls
 *
 * @param powerSupplies - Array of power supply types from API
 */
export function populatePowerSupplyOptions(powerSupplies: PowerSupplyType[]): void {
  if (!powerSupplies || !Array.isArray(powerSupplies)) {
    console.warn('populatePowerSupplyOptions called with invalid data:', powerSupplies);
    return;
  }
  cachedPowerSupplies = powerSupplies;
  if (POWER_SUPPLY_TEMPLATE.spec2) {
    POWER_SUPPLY_TEMPLATE.spec2.options = powerSupplies.map(ps =>
      `${ps.transformer_type} (${ps.watts}W, ${ps.volts}V${ps.ul_listed ? ', UL' : ''})`
    );
  }
  // Mark templates as populated when all have been set
  if (cachedLEDs.length > 0 && cachedPowerSupplies.length > 0 && cachedMaterials.length > 0) {
    templatesPopulated = true;
  }
}

/**
 * Get cached Materials data
 *
 * @returns Cached materials array
 */
export function getCachedMaterials(): string[] {
  return cachedMaterials;
}

/**
 * Populate Material options in the Material template
 * Called after fetching substrate materials from API
 * Caches data to avoid repeated API calls
 *
 * @param materials - Array of material names from substrate_cut_pricing
 */
export function populateMaterialOptions(materials: string[]): void {
  if (!materials || !Array.isArray(materials)) {
    console.warn('populateMaterialOptions called with invalid data:', materials);
    return;
  }
  cachedMaterials = materials;
  if (MATERIAL_TEMPLATE.spec1) {
    MATERIAL_TEMPLATE.spec1.options = materials;
  }
  // Mark templates as populated when all have been set
  if (cachedLEDs.length > 0 && cachedPowerSupplies.length > 0 && cachedMaterials.length > 0) {
    templatesPopulated = true;
  }
}

/**
 * Get all available template names
 *
 * @returns Array of template names
 */
export function getAllTemplateNames(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}
