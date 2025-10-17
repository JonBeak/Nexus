import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Painting (Product Type 8)
 *
 * Field mappings:
 * - field1: Prep Hrs (float, hourly prep time, optional)
 * - field2: Primer (Yes/No dropdown - if filled, requires at least one area/return field)
 * - field3: Clear (Yes/No dropdown - if filled, requires at least one area/return field)
 * - field4: (SKIPPED - intentionally empty)
 * - field5: Area 1 (float OR dimensions - sqft or X x Y for face painting)
 * - field6: Area 2 (float OR dimensions - sqft or X x Y for face painting)
 * - field7: 3" Return (linear length in inches)
 * - field8: 4" Return (linear length in inches)
 * - field9: 5" Return (linear length in inches)
 * - field10: Trim Cap (linear length in inches)
 *
 * Validation Rules:
 * - If Primer or Clear specified → at least one area/return field (5-10) must be filled
 * - Area/return fields (5-10) can be filled independently without Primer/Clear
 */
export const paintingValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      decimal_places: 2
    }
  },
  field2: {
    function: 'or_required',
    error_level: 'error',
    params: {
      required_fields: [5, 6, 7, 8, 9, 10],
      field_labels: ['Area 1', 'Area 2', '3" Return', '4" Return', '5" Return', 'Trim Cap']
    }
  },
  field3: {
    function: 'or_required',
    error_level: 'error',
    params: {
      required_fields: [5, 6, 7, 8, 9, 10],
      field_labels: ['Area 1', 'Area 2', '3" Return', '4" Return', '5" Return', 'Trim Cap']
    }
  },
  field5: {
    function: 'floatordimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0
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
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  },
  field8: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  },
  field9: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  }
};
