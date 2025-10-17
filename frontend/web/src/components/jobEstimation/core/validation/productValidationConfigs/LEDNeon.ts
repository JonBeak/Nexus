import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for LED Neon (Product Type 7)
 *
 * Field mappings:
 * - field1: Base HxL (dimensions in X x Y format)
 * - field2: Base Mat (substrate material dropdown - IDs 3,4,5,10)
 * - field3: Length (in) (float, linear length in inches - converted to feet for pricing)
 * - field4: Solders (number of solder joints, supplementary to field3)
 * - field5: Stnd Off # (number of standoffs)
 * - field6: Opq? (Yes/No - opacity override, supplementary to field4)
 * - field7: PS # (power supply count override - auto-calculated if empty)
 * - field8-10: Inactive
 */
export const ledNeonValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  },
  field2: {
    function: 'non_empty',
    error_level: 'error',
    supplementary_to: [1], // field2 requires field1 to be filled
    params: {}
  },
  field3: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field4: {
    function: 'float',
    error_level: 'error',
    supplementary_to: [3], // Solders requires Length to be filled
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field5: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field6: {
    function: 'non_empty',
    error_level: 'error',
    supplementary_to: [4], // Opq? requires Solders to be filled
    params: {}
  },
  field7: {
    function: 'ps_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no']
    }
  }
};
