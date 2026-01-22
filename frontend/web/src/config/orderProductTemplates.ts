/**
 * Order Specification Templates
 * Phase 1.5.d - Specification templates mapped to QuickBooks Item Names
 *
 * Each template defines 1-3 specification fields with their input types and options.
 * These are displayed in the "Specs" table in the Order Details page.
 *
 * NOTE: Dropdown options are populated from database via populateSpecificationOptions().
 * Templates start with empty arrays and are populated on Order Details page load.
 */

import { type LEDType, type PowerSupplyType } from './specificationConstants';

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
    options: [], // Populated from DB: return_depths
    placeholder: 'Depth'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'dropdown',
    options: [], // Populated from DB: prefinished_colors
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
    options: [], // Populated from DB: prefinished_colors
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
    options: [], // Populated from DB: face_materials
    placeholder: 'Material'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // Populated from DB: face_colors
    placeholder: 'Colour'
  }
};

/**
 * Template: Vinyl
 * Spec 1: Colours (combobox) - Searchable dropdown of active vinyl products
 * Spec 2: Application (combobox: Face, Return Wrap, Trim Wrap, etc.)
 * Spec 3: Size (textbox) - Auto-filled with yards from estimate
 *
 * NOTE: Spec1 populated from vinyl_products table via getVinylColourOptions()
 */
export const VINYL_TEMPLATE: SpecificationTemplate = {
  templateName: 'Vinyl',
  spec1: {
    key: 'colours',
    label: 'Vinyl',
    type: 'combobox',
    options: [], // Populated from API: vinyl colour options
    placeholder: 'Vinyl Code'
  },
  spec2: {
    key: 'application',
    label: 'Application',
    type: 'combobox',
    options: [], // Populated from DB: vinyl_applications
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
    options: [], // Populated from DB: digital_print_types
    placeholder: 'Type'
  },
  spec3: {
    key: 'application',
    label: 'Application',
    type: 'combobox',
    options: [], // Populated from DB: vinyl_applications
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
 * Spec 3: Note (textbox) - Additional notes displayed in PDF as "({note})"
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
    options: [], // Populated from DB: wire_gauges
    placeholder: 'Wire Gauge'
  },
  spec3: {
    key: 'note',
    label: 'Note',
    type: 'textbox',
    placeholder: 'Additional notes'
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
    options: [], // Populated from DB: drain_hole_sizes
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
    options: [], // Populated from DB: cutting_methods
    placeholder: 'Method'
  }
};

/**
 * Template: Painting
 * Spec 1: Colour (textbox)
 * Spec 2: Component (combobox: Return, Trim, Face, etc.)
 * Spec 3: Timing (combobox: Before Cutting, After Cutting, etc.)
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
    options: [], // Populated from DB: painting_components
    placeholder: 'Component'
  },
  spec3: {
    key: 'timing',
    label: 'Timing',
    type: 'combobox',
    options: [], // Populated from DB: painting_timings
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
    options: [], // Populated from API (pricing data)
    placeholder: 'Substrate'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // Populated from DB: material_colours
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
    options: [], // Populated from DB: box_materials
    placeholder: 'Material'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // Populated from DB: box_colours
    placeholder: 'Colour'
  },
  spec3: {
    key: 'fabrication',
    label: 'Fabrication',
    type: 'combobox',
    options: [], // Populated from DB: box_fabrication
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
    options: [], // Populated from DB: push_thru_thicknesses
    placeholder: 'Thickness'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // Populated from DB: push_thru_colours
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
    options: [], // Populated from DB: neon_base_thicknesses
    placeholder: 'Thickness'
  },
  spec2: {
    key: 'material',
    label: 'Material',
    type: 'combobox',
    options: [], // Populated from DB: neon_base_materials
    placeholder: 'Material'
  },
  spec3: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // Populated from DB: neon_base_colours
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
    options: [], // Populated from DB: neon_led_stroke_widths
    placeholder: 'Stroke Width'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // Populated from DB: neon_led_colours
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
 * Template: Face Assembly
 * Used for face-type products (Halo Lit, Trimless Letters) - separate from structural Assembly
 * Spec 1: Description (textbox)
 * Spec 2: -
 * Spec 3: -
 */
export const FACE_ASSEMBLY_TEMPLATE: SpecificationTemplate = {
  templateName: 'Face Assembly',
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
    options: [], // Populated from DB: d_tape_thicknesses
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
    options: [], // Populated from DB: pin_types
    placeholder: 'Pin Type'
  },
  spec3: {
    key: 'spacers',
    label: 'Spacers',
    type: 'combobox',
    options: [], // Populated from DB: spacer_types
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
    options: [], // Populated from DB: extrusion_colours
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
    options: [], // Populated from DB: back_materials
    placeholder: 'Material'
  }
};

/**
 * Template: 3DP Return
 * Spec 1: Depth (combobox: 1", 1.25", 1.5", 2", Custom)
 * Spec 2: Colour (combobox: 3D print colours - Translucent White, Opaque White, etc.)
 * Spec 3: -
 *
 * Used for 3D Print products with shallower depths than standard channel letters.
 */
export const THREE_DP_RETURN_TEMPLATE: SpecificationTemplate = {
  templateName: '3DP Return',
  spec1: {
    key: 'depth',
    label: 'Depth',
    type: 'combobox',
    options: [], // Populated from DB: 3dp_depths
    placeholder: 'Depth'
  },
  spec2: {
    key: 'colour',
    label: 'Colour',
    type: 'combobox',
    options: [], // TODO: Populate from DB with 3D print colours (Translucent White, Opaque White, etc.)
    placeholder: 'Colour'
  }
};

/**
 * Template: Illumination
 * Spec 1: Face (boolean) - Face lit
 * Spec 2: Side (boolean) - Side lit
 * Spec 3: Halo (boolean) - Halo lit
 *
 * Used for 3D Print products. Illumination description is computed
 * in PDF formatter based on these boolean values.
 */
export const ILLUMINATION_TEMPLATE: SpecificationTemplate = {
  templateName: 'Illumination',
  spec1: {
    key: 'face_lit',
    label: 'Face',
    type: 'boolean',
    placeholder: 'Face Lit?'
  },
  spec2: {
    key: 'side_lit',
    label: 'Side',
    type: 'boolean',
    placeholder: 'Side Lit?'
  },
  spec3: {
    key: 'halo_lit',
    label: 'Halo',
    type: 'boolean',
    placeholder: 'Halo Lit?'
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
  'Face Assembly': FACE_ASSEMBLY_TEMPLATE,
  'D-Tape': D_TAPE_TEMPLATE,
  'Cut': CUT_TEMPLATE,
  'Peel': PEEL_TEMPLATE,
  'Mask': MASK_TEMPLATE,
  'Extr. Colour': EXTR_COLOUR_TEMPLATE,
  'Back': BACK_TEMPLATE,
  '3DP Return': THREE_DP_RETURN_TEMPLATE,
  'Illumination': ILLUMINATION_TEMPLATE
};

/**
 * Module-level cache for template data
 */
let templatesPopulated = false;
let cachedLEDs: LEDType[] = [];
let cachedPowerSupplies: PowerSupplyType[] = [];
let cachedMaterials: string[] = [];
let cachedVinylColours: string[] = [];

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
 * Get cached Vinyl Colours data
 *
 * @returns Cached vinyl colours array
 */
export function getCachedVinylColours(): string[] {
  return cachedVinylColours;
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
 * Populate Vinyl Colour options in the Vinyl template
 * Called after fetching vinyl colour options from API
 * Caches data to avoid repeated API calls
 *
 * @param vinylColours - Array of formatted vinyl colour strings from vinyl_products
 */
export function populateVinylColourOptions(vinylColours: string[]): void {
  if (!vinylColours || !Array.isArray(vinylColours)) {
    console.warn('populateVinylColourOptions called with invalid data:', vinylColours);
    return;
  }
  cachedVinylColours = vinylColours;
  if (VINYL_TEMPLATE.spec1) {
    VINYL_TEMPLATE.spec1.options = vinylColours;
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

/**
 * Populate specification options from database cache
 * Called after fetching spec options from SpecificationOptionsCache
 *
 * Maps database category keys to template spec fields.
 * No fallbacks - database is the single source of truth.
 *
 * @param optionsMap - Record of category key -> option values from database
 */
export function populateSpecificationOptions(optionsMap: Record<string, string[]>): void {
  console.log('[Templates] Populating specification options from database...');

  // Helper to get options (empty array if category missing)
  const getOptions = (category: string): string[] => {
    const dbOptions = optionsMap[category];
    if (!dbOptions || dbOptions.length === 0) {
      console.warn(`[Templates] No options found for category: ${category}`);
      return [];
    }
    return dbOptions;
  };

  // RETURN_TEMPLATE
  if (RETURN_TEMPLATE.spec1) {
    RETURN_TEMPLATE.spec1.options = getOptions('return_depths');
  }
  if (RETURN_TEMPLATE.spec2) {
    RETURN_TEMPLATE.spec2.options = getOptions('prefinished_colors');
  }

  // TRIM_TEMPLATE
  if (TRIM_TEMPLATE.spec1) {
    TRIM_TEMPLATE.spec1.options = getOptions('prefinished_colors');
  }

  // FACE_TEMPLATE
  if (FACE_TEMPLATE.spec1) {
    FACE_TEMPLATE.spec1.options = getOptions('face_materials');
  }
  if (FACE_TEMPLATE.spec2) {
    FACE_TEMPLATE.spec2.options = getOptions('face_colors');
  }

  // VINYL_TEMPLATE
  // Note: spec1 (vinyl colours) is populated by populateVinylColourOptions() from vinyl_products API
  if (VINYL_TEMPLATE.spec2) {
    VINYL_TEMPLATE.spec2.options = getOptions('vinyl_applications');
  }

  // DIGITAL_PRINT_TEMPLATE
  if (DIGITAL_PRINT_TEMPLATE.spec2) {
    DIGITAL_PRINT_TEMPLATE.spec2.options = getOptions('digital_print_types');
  }
  if (DIGITAL_PRINT_TEMPLATE.spec3) {
    DIGITAL_PRINT_TEMPLATE.spec3.options = getOptions('vinyl_applications');
  }

  // WIRE_LENGTH_TEMPLATE
  if (WIRE_LENGTH_TEMPLATE.spec2) {
    WIRE_LENGTH_TEMPLATE.spec2.options = getOptions('wire_gauges');
  }

  // DRAIN_HOLES_TEMPLATE
  if (DRAIN_HOLES_TEMPLATE.spec2) {
    DRAIN_HOLES_TEMPLATE.spec2.options = getOptions('drain_hole_sizes');
  }

  // CUTTING_TEMPLATE
  if (CUTTING_TEMPLATE.spec1) {
    CUTTING_TEMPLATE.spec1.options = getOptions('cutting_methods');
  }

  // PAINTING_TEMPLATE
  if (PAINTING_TEMPLATE.spec2) {
    PAINTING_TEMPLATE.spec2.options = getOptions('painting_components');
  }
  if (PAINTING_TEMPLATE.spec3) {
    PAINTING_TEMPLATE.spec3.options = getOptions('painting_timings');
  }

  // MATERIAL_TEMPLATE (spec2 only - spec1 populated by populateMaterialOptions)
  if (MATERIAL_TEMPLATE.spec2) {
    MATERIAL_TEMPLATE.spec2.options = getOptions('material_colours');
  }

  // BOX_TYPE_TEMPLATE
  if (BOX_TYPE_TEMPLATE.spec1) {
    BOX_TYPE_TEMPLATE.spec1.options = getOptions('box_materials');
  }
  if (BOX_TYPE_TEMPLATE.spec2) {
    BOX_TYPE_TEMPLATE.spec2.options = getOptions('box_colours');
  }
  if (BOX_TYPE_TEMPLATE.spec3) {
    BOX_TYPE_TEMPLATE.spec3.options = getOptions('box_fabrication');
  }

  // ACRYLIC_TEMPLATE
  if (ACRYLIC_TEMPLATE.spec1) {
    ACRYLIC_TEMPLATE.spec1.options = getOptions('push_thru_thicknesses');
  }
  if (ACRYLIC_TEMPLATE.spec2) {
    ACRYLIC_TEMPLATE.spec2.options = getOptions('push_thru_colours');
  }

  // NEON_BASE_TEMPLATE
  if (NEON_BASE_TEMPLATE.spec1) {
    NEON_BASE_TEMPLATE.spec1.options = getOptions('neon_base_thicknesses');
  }
  if (NEON_BASE_TEMPLATE.spec2) {
    NEON_BASE_TEMPLATE.spec2.options = getOptions('neon_base_materials');
  }
  if (NEON_BASE_TEMPLATE.spec3) {
    NEON_BASE_TEMPLATE.spec3.options = getOptions('neon_base_colours');
  }

  // NEON_LED_TEMPLATE
  if (NEON_LED_TEMPLATE.spec1) {
    NEON_LED_TEMPLATE.spec1.options = getOptions('neon_led_stroke_widths');
  }
  if (NEON_LED_TEMPLATE.spec2) {
    NEON_LED_TEMPLATE.spec2.options = getOptions('neon_led_colours');
  }

  // D_TAPE_TEMPLATE
  if (D_TAPE_TEMPLATE.spec2) {
    D_TAPE_TEMPLATE.spec2.options = getOptions('d_tape_thicknesses');
  }

  // MOUNTING_TEMPLATE
  if (MOUNTING_TEMPLATE.spec2) {
    MOUNTING_TEMPLATE.spec2.options = getOptions('pin_types');
  }
  if (MOUNTING_TEMPLATE.spec3) {
    MOUNTING_TEMPLATE.spec3.options = getOptions('spacer_types');
  }

  // EXTR_COLOUR_TEMPLATE
  if (EXTR_COLOUR_TEMPLATE.spec1) {
    EXTR_COLOUR_TEMPLATE.spec1.options = getOptions('extrusion_colours');
  }

  // BACK_TEMPLATE
  if (BACK_TEMPLATE.spec1) {
    BACK_TEMPLATE.spec1.options = getOptions('back_materials');
  }

  // THREE_DP_RETURN_TEMPLATE
  if (THREE_DP_RETURN_TEMPLATE.spec1) {
    THREE_DP_RETURN_TEMPLATE.spec1.options = getOptions('3dp_depths');
  }
  if (THREE_DP_RETURN_TEMPLATE.spec2) {
    THREE_DP_RETURN_TEMPLATE.spec2.options = getOptions('3dp_colours');
  }

  // THREE_DP_ILLUMINATION_TEMPLATE - no options to populate (boolean fields)

  console.log('[Templates] Specification options populated from database');
}
