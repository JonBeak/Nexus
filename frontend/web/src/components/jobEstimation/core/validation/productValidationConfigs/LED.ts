import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for LED (Product Type 26)
 *
 * Field mappings:
 * - field1: LED # (count of LEDs, float)
 * - field2: LED Type (dropdown selection, requires field1)
 * - field3: LED $ (price override per LED, requires field1)
 * - field4: PS # (power supply count override: float | 'yes' | 'no')
 * - field5: PS Type (dropdown, requires calculated psCount > 0)
 * - field6: PS $/pc (price override per PS, requires calculated psCount > 0)
 * - field7: UL (UL certification override)
 * - field8: Wire Len (length per wire, complementary with field9)
 * - field9: Wire Count (number of wires, complementary with field8)
 * - field10: Wire Flat (flat wire length, independent)
 *
 * Component structure:
 * 1. LEDs (fields 1-3)
 * 2. Power Supplies (fields 4-6)
 * 3. UL (field 7)
 * 4. Extra Wire (fields 8-10): (field8 × field9) + field10
 */
export const ledValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false,
      decimal_places: 2
    }
  },
  field2: {
    function: 'led_type',
    error_level: 'error',
    supplementary_to: [1], // LED Type requires LED # to be filled
    params: {
      led_count_field: 'field1'
    }
  },
  field3: {
    function: 'float',
    error_level: 'error',
    supplementary_to: [1], // LED $ requires LED # to be filled
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false,
      decimal_places: 2
    }
  },
  field4: {
    function: 'ps_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no']
    }
  },
  field5: {
    function: 'ps_type',
    error_level: 'error',
    params: {
      ps_count_field: 'field4'
    }
  },
  field6: {
    function: 'ps_price_override',
    error_level: 'error',
    params: {
      ps_count_field: 'field4',
      min: 0,
      allow_negative: false,
      decimal_places: 2
    }
  },
  field7: {
    function: 'ul_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no', '$amount']
    }
  },
  field8: {
    function: 'float',
    error_level: 'error',
    complimentary_fields: [9], // Wire Len requires Wire Count if filled
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false,
      decimal_places: 2
    }
  },
  field9: {
    function: 'float',
    error_level: 'error',
    complimentary_fields: [8], // Wire Count requires Wire Len if filled
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false,
      decimal_places: 2
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false,
      decimal_places: 2
    }
  }
};
