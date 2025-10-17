import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Substrate Cut (Product Type 3)
 *
 * Field mappings:
 * - field1: Type (substrate type dropdown)
 * - field2: XY (dimensions in X x Y format)
 * - field3: Pins (number of pins) - works with field4
 * - field4: Pin Type (dropdown - includes "Stand Offs" option)
 * - field5: D-tape (double-sided tape cost - manual input, can be negative)
 * - field6: Assem (assembly cost - manual input, can be negative)
 * - field10: ~ Cut ~ (cutting cost override - can be negative)
 */
export const substrateCutValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'non_empty',
    error_level: 'error',
    complimentary_fields: [2], // field1 and field2 require each other
    params: {}
  },
  field2: {
    function: 'floatordimensions',
    error_level: 'error',
    complimentary_fields: [1], // field1 and field2 require each other
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  },
  field3: {
    function: 'float',
    error_level: 'error',
    complimentary_fields: [4], // field3 and field4 require each other
    params: {
      min: 0,
      allow_negative: false
    }
  },
  field4: {
    function: 'non_empty',
    error_level: 'error',
    complimentary_fields: [3], // field3 and field4 require each other
    params: {}
  },
  field5: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // D-tape cost - manual input
    }
  },
  field6: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // Assembly cost - manual input
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // Can be negative, sufficient (standalone)
    }
  }
};
