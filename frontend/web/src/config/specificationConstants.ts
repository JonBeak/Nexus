/**
 * Specification Constants
 * Shared constants and dropdown options for order part specifications
 */

/**
 * Prefinished colors available for returns, trim, and face
 */
export const PREFINISHED_COLORS = [
  'White',
  'Black',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Blue',
  'Gold',
  'Mill Finish'
] as const;

/**
 * Return depth options
 */
export const RETURN_DEPTHS = [
  '3"',
  '4"',
  '5"',
  'Custom'
] as const;

/**
 * Face material options
 */
export const FACE_MATERIALS = [
  '2mm PC',
  '3mm PC',
  '3mm ACM',
  '1mm Aluminum',
  '12mm Acrylic',
  '9mm Acrylic'
] as const;

/**
 * Face color options (includes custom option)
 */
export const FACE_COLORS = [
  'White',
  'Black',
  'White 2447',
  'White 7328',
  'Clear',
  'Custom'
] as const;

/**
 * Drain hole size options
 */
export const DRAIN_HOLE_SIZES = [
  '1/4"',
  'Custom'
] as const;

/**
 * Types for LED and Power Supply data from API
 */
export interface LEDType {
  led_id: number;
  product_code: string;
  colour: string;
  watts: number;
  volts: number;
  brand: string;
  model: string;
  is_default: boolean;
}

export interface PowerSupplyType {
  power_supply_id: number;
  transformer_type: string;
  watts: number;
  rated_watts: number;
  volts: number;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
}

/**
 * Vinyl application options
 */
export const VINYL_APPLICATIONS = [
  'Face, Full',
  'Face, White Keyline',
  'Face, Custom Cut',
  'Return Wrap',
  'Trim Wrap',
  'Return & Trim Wrap',
  'Face & Return Wrap'
] as const;

/**
 * Digital Print type options
 */
export const DIGITAL_PRINT_TYPES = [
  'Translucent',
  'Opaque',
  'Clear',
  'Perforated'
] as const;

/**
 * Wire gauge options
 */
export const WIRE_GAUGES = [
  '18 AWG',
  '22 AWG'
] as const;

/**
 * Cutting method options
 */
export const CUTTING_METHODS = [
  'Router',
  'Laser',
  'Router & Laser'
] as const;

/**
 * Painting component options
 */
export const PAINTING_COMPONENTS = [
  'Return',
  'Trim',
  'Face',
  'Return & Trim',
  'Face & Return'
] as const;

/**
 * Painting timing options
 */
export const PAINTING_TIMINGS = [
  'Pre-Cutting',
  'Post-Cutting',
  'Post-Folding',
  'Post-Fabrication'
] as const;

/**
 * Mounting type options
 */
export const MOUNTING_TYPES = [
  'Pins',
  'Pins + Spacers',
  'Pins + Inserts',
  'Pins + Spacers + Inserts',
  'D-Tape',
  'Nylon Pins',
  'Nylon Pins + Spacers',
  'SS Pins',
  'SS Pins + Spacers',
  'Stand offs'
] as const;

/**
 * Pin length options
 */
export const PIN_LENGTHS = [
  '2"',
  '4"',
  '6"'
] as const;

/**
 * Spacer length options
 */
export const SPACER_LENGTHS = [
  '0.5"',
  '1"',
  '1.5"'
] as const;

/**
 * Material colour options (for substrates)
 */
export const MATERIAL_COLOURS = [
  'Matte White',
  'Matte Black',
  'Black',
  'Opaque White',
  '2447 White',
  '7328 White',
  'Clear',
  '1" Galv Steel Square Tube'
] as const;

/**
 * Extrusion colour options
 */
export const EXTRUSION_COLOURS = [
  'White',
  'Gray',
  'Black'
] as const;

/**
 * Back material options (for Material Cut)
 */
export const BACK_MATERIALS = [
  '2mm ACM',
  '2mm White PC',
  '2mm Clear PC'
] as const;

/**
 * Box material options
 */
export const BOX_MATERIALS = [
  '3mm ACM',
  '1mm Aluminum'
] as const;

/**
 * Box colour options
 */
export const BOX_COLOURS = [
  'Matte Black',
  'White',
  'Red'
] as const;

/**
 * Push thru acrylic thickness options
 */
export const PUSH_THRU_THICKNESSES = [
  '12mm',
  '9mm',
  '6mm',
  '0mm (Knockout)'
] as const;

/**
 * Push thru acrylic colour options
 */
export const PUSH_THRU_COLOURS = [
  '2447 White',
  'Clear'
] as const;

/**
 * Neon base thickness options
 */
export const NEON_BASE_THICKNESSES = [
  '12mm',
  '9mm',
  '6mm'
] as const;

/**
 * Neon base material options
 */
export const NEON_BASE_MATERIALS = [
  'Acrylic',
  'PVC'
] as const;

/**
 * Neon base colour options (combined for both materials)
 */
export const NEON_BASE_COLOURS = [
  'Clear',
  '2447 White',
  '7328 White',
  'Opaque White',
  'Black',
  'White'
] as const;

/**
 * Neon LED stroke width options
 */
export const NEON_LED_STROKE_WIDTHS = [
  '8mm',
  '6mm'
] as const;

/**
 * Neon LED colour options
 */
export const NEON_LED_COLOURS = [
  'Pure White',
  'Warm White',
  'Yellow',
  'Orange',
  'Red',
  'Green',
  'Blue',
  'Purple'
] as const;

/**
 * D-Tape thickness options
 */
export const D_TAPE_THICKNESSES = [
  '62 MIL (Thick)',
  '45 MIL (Medium)',
  '16 MIL (Thin)'
] as const;

/**
 * Pin type options (including material variants)
 */
export const PIN_TYPES = [
  '2" Pins',
  '4" Pins',
  '6" Pins',
  '4" Nylon',
  '4" SS',
  '6" SS',
  '8" SS',
  'Stand Offs'
] as const;

/**
 * Spacer type options (with inserts and rivnuts)
 */
export const SPACER_TYPES = [
  '0.5" Pad',
  '1" Spacer',
  '1.5" Spacer',
  '0.5" Pad + Insert',
  '1" Spacer + Insert',
  '1.5" Spacer + Insert',
  '0.5" Pad + Rivnut',
  '1" Spacer + Rivnut',
  '1.5" Spacer + Rivnut',
  'Stand off'
] as const;
