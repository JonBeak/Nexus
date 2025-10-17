import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Blade Sign (Product Type 6)
 *
 * Field mappings:
 * - field1: Shape (Circle/Rectangle dropdown) - supplementary to field2
 * - field2: X x Y (dimensions in "X x Y" format)
 * - field3: LEDs # (LED count override - accepts float/yes/no)
 * - field4: UL (UL certification override - accepts float/yes/no/$amount)
 * - field5: PS # (Power supply count override - accepts float/yes/no)
 * - field6: (unused)
 * - field7: ~ Frame ~ (frame cost override - optional, can be negative)
 * - field8: ~ Assem ~ (assembly cost override - optional, can be negative)
 * - field9: ~ Wrap ~ (wrap/aluminum cost override - optional, can be negative)
 * - field10: ~ Cut 2" ~ (cutting cost override - optional, can be negative)
 * - field11-12: (unused)
 *
 * Business Logic:
 * - field1 supplements field2 (shape selection for circle vs rectangle calculation)
 * - field2 drives automatic calculation of Frame, Assembly, Wrap, Cutting costs
 * - field3-5 control LED/UL/PS components (similar to Channel Letters)
 * - field7-10 can override calculated costs
 *
 * Component Generation:
 * - WITH field2: Single "Blade Sign" component (Frame+Assembly+Wrap+Cutting combined)
 * - WITHOUT field2: Separate components (Frame, Assembly, Aluminum, Cutting)
 * - LEDs, Power Supplies, UL always separate
 */
export const bladeSignValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'non_empty',
    error_level: 'error',
    params: {}
  },
  field2: {
    function: 'floatordimensions',
    error_level: 'error',
    complimentary_fields: [1], // If field1 (Shape) is filled, field2 (dimensions) is required → error shows on field2
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0,
      max_area: 2350 // Maximum area in square inches (X * Y <= 2350)
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
    function: 'ps_override',
    error_level: 'error',
    params: {
      accepts: ['float', 'yes', 'no']
    }
  },
  field7: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true, // Can be negative for discounts/overrides
      decimal_places: 2
    }
  },
  field8: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true, // Can be negative for discounts/overrides
      decimal_places: 2
    }
  },
  field9: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true, // Can be negative for discounts/overrides
      decimal_places: 2
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true, // Can be negative for discounts/overrides
      decimal_places: 2
    }
  }
};
