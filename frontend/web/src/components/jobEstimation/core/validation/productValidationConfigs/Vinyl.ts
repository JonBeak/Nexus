import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Vinyl (Product Type 2)
 *
 * Field mappings:
 * - field1: T (Type - vinyl type/color selections)
 * - field2: Tc (Type color)
 * - field3: Perf (Perforated vinyl selections)
 * - field4: Perf c (Perforated color)
 * - field5: Application (application method - single float)
 * - field6: Dig WxH or sqft (Digital print dimensions or total square footage)
 * - field7: Dig WxH or sqft (Digital print dimensions or total square footage)
 * - field8: Dig WxH or sqft (Digital print dimensions or total square footage)
 * - field9: Dig WxH or sqft (Digital print dimensions or total square footage)
 * - field10: Dig WxH or sqft (Digital print dimensions or total square footage)
 */
export const vinylValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'textsplit',
    error_level: 'error',
    params: {
      delimiter: ' ',
      parse_as: 'float',
      allow_negative: false,
      trim_whitespace: true,
      allow_empty: false,  // Filter out empty strings from extra spaces
      min_value: 0
    }
  },
  field2: {
    function: 'textsplit',
    error_level: 'error',
    params: {
      delimiter: ' ',
      parse_as: 'float',
      allow_negative: false,
      trim_whitespace: true,
      allow_empty: false,  // Filter out empty strings from extra spaces
      min_value: 0
    }
  },
  field3: {
    function: 'textsplit',
    error_level: 'error',
    params: {
      delimiter: ' ',
      parse_as: 'float',
      allow_negative: false,
      trim_whitespace: true,
      allow_empty: false,  // Filter out empty strings from extra spaces
      min_value: 0
    }
  },
  field4: {
    function: 'textsplit',
    error_level: 'error',
    params: {
      delimiter: ' ',
      parse_as: 'float',
      allow_negative: false,
      trim_whitespace: true,
      allow_empty: false,  // Filter out empty strings from extra spaces
      min_value: 0
    }
  },
  field5: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      decimal_places: 2
    }
  },
  field6: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  },
  field7: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  },
  field8: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  },
  field9: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  },
  field10: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
    }
  }
};
