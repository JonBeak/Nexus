import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Push Thru (Product Type 5)
 *
 * Field mappings:
 * - field1: Alum / ACM (dropdown: "Aluminum" or "ACM")
 * - field2: # Boxes (optional, positive float, min: 0.01, max: 5, defaults to 2 in calculation)
 * - field3: XYZ / XY (conditional: 3D if field1="Aluminum", 2D if field1="ACM")
 * - field4: Acryl XY (2D dimensions or float)
 * - field5: LEDs XY (2D dimensions or float)
 * - field6: UL (accepts "yes", "no", 0, float [set count], $amount [price override])
 * - field7: PS # (power supply override - accepts "yes", "no", float; validates redundancy and LED presence)
 * - field8: ~ Cut ~ (float, allows negative)
 * - field9: ~ PC ~ (float, allows negative)
 * - field10: ~ Assem ~ (float, allows negative)
 *
 * Field dependencies:
 * - Fields 1 & 3: Complimentary (require each other)
 * - Field 2: Supplementary to fields 1 & 3 (if filled, requires 1 & 3 to be filled first)
 * - Fields 4-10: Standalone (no dependencies)
 */
export const pushThruValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'non_empty',
    error_level: 'error',
    complimentary_fields: [3], // If field3 filled, field1 required
    params: {}
  },
  field2: {
    function: 'float',
    error_level: 'error',
    supplementary_to: [1, 3], // If field2 filled, requires field1 and field3
    params: {
      min: 0.01,
      max: 5,
      allow_negative: false
    }
  },
  field3: {
    function: 'conditionaldimensions',
    error_level: 'error',
    complimentary_fields: [1], // If field1 filled, field3 required
    params: {
      condition_field: 'field1',
      aluminum_value: 'Aluminum',  // If field1 = "Aluminum" → validate as 3D (X×Y×Z)
      acm_value: 'ACM',           // If field1 = "ACM" → validate as 2D (X×Y)
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value_alum_x: 239.5,  // Aluminum: After Z adjustment, max X = 239.5"
      max_value_alum_y: 47.5,   // Aluminum: After Z adjustment, max Y = 47.5"
      max_value_acm_x: 300,     // ACM: max X = 300"
      max_value_acm_y: 60       // ACM: max Y = 60"
    }
  },
  field4: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01
    }
  },
  field5: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01
    }
  },
  field6: {
    function: 'ul_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no', '$amount']
    }
  },
  field7: {
    function: 'ps_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no'],
      allow_zero: true
    }
  },
  field8: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // Allows negative for adjustments
    }
  },
  field9: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // Allows negative for adjustments
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // Allows negative for adjustments
    }
  }
};
