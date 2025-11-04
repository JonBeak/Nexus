import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Channel Letters (Product Type 1)
 *
 * Field mappings:
 * - field1: Type
 * - field2: Inches/LED
 * - field3: LEDs #
 * - field4: UL
 * - field5: Pins # (required if channel type requires_pins)
 * - field6: Pins Type (required if channel type requires_pins)
 * - field7: Extra wire
 * - field8: LED Type
 * - field9: PS #
 * - field10: PS Type
 */
export const channelLettersValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'non_empty',
    error_level: 'error',
    complimentary_fields: [2], // If field2 (dimensions) filled, field1 (type) required
    params: {}
  },
  field2: {
    function: 'float_or_groups',
    error_level: 'error',
    complimentary_fields: [1], // If field1 (type) filled, field2 (dimensions) required
    params: {
      group_separator: '. . . . . ',
      number_separator: ',',
      allow_negative: false,
      min_value: 0
    }
  },
  field3: {
    function: 'led_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no']
    }
  },
  field4: {
    function: 'ul_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no', '$amount']
    }
  },
  field5: {
    function: 'floatorformula',
    error_level: 'error',
    complimentary_fields: [6], // If field6 (pins type) filled, field5 (pins #) required
    params: {
      min: 0,
      allow_negative: false,
      decimal_places: 2
    }
  },
  field6: {
    function: 'non_empty',
    error_level: 'error',
    // Validation handled by custom logic: required if field5 > 0
    params: {}
  },
  field7: {
    function: 'float',
    error_level: 'error',
    supplementary_to: [1, 2], // Extra wire requires type and dimensions
    params: {
      min: 0,
      allow_negative: false,
      decimal_places: 2
    }
  },
  field8: {
    function: 'led_type',
    error_level: 'error',
    params: {
      led_count_field: 'field3'
    }
  },
  field9: {
    function: 'ps_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no']
    }
  },
  field10: {
    function: 'ps_type',
    error_level: 'error',
    params: {
      ps_count_field: 'field9'
    }
  }
};