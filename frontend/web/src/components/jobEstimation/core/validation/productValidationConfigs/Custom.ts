import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Custom (Product Type 9)
 *
 * Field mappings (3 columns: A, B, C):
 * Column A:
 * - field1: A.ProductName (any text)
 * - field2: A.Description (any text)
 * - field3+: A.UnitPrice (float, no scientific notation)
 *
 * Column B:
 * - field4: B.ProductName (any text)
 * - field5: B.Description (any text)
 * - field6+: B.UnitPrice (float, no scientific notation)
 *
 * Column C:
 * - field7: C.ProductName (any text)
 * - field8: C.Description (any text)
 * - field9+: C.UnitPrice (float, no scientific notation)
 *
 * Validation Rules:
 * 1. If ProductName exists → UnitPrice is required (handled by complimentary_fields)
 * 2. If UnitPrice exists → ProductName OR Description is required (handled by or_required template)
 */
export const customValidation: Record<string, FieldValidationConfig> = {
  // Column A
  field1: {
    // A.ProductName - accepts any text input, no validation needed
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  },
  field2: {
    // A.Description - accepts any text input, no validation needed
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  },
  field3: {
    // A.UnitPrice - float validation + bidirectional dependency
    function: 'or_required',
    error_level: 'error',
    params: {
      required_fields: [1, 2], // At least one of ProductName or Description must be filled
      field_labels: ['Product Name', 'Description'],
      validate_as: 'float',
      float_params: {
        min: 0,
        allow_negative: false
      }
    },
    complimentary_fields: [1] // If ProductName (field1) is filled, UnitPrice is required
  },

  // Column B
  field4: {
    // B.ProductName - accepts any text input
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  },
  field5: {
    // B.Description - accepts any text input
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  },
  field6: {
    // B.UnitPrice - float validation + bidirectional dependency
    function: 'or_required',
    error_level: 'error',
    params: {
      required_fields: [4, 5], // At least one of ProductName or Description must be filled
      field_labels: ['Product Name', 'Description'],
      validate_as: 'float',
      float_params: {
        min: 0,
        allow_negative: false
      }
    },
    complimentary_fields: [4] // If ProductName (field4) is filled, UnitPrice is required
  },

  // Column C
  field7: {
    // C.ProductName - accepts any text input
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  },
  field8: {
    // C.Description - accepts any text input
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  },
  field9: {
    // C.UnitPrice - float validation + bidirectional dependency
    function: 'or_required',
    error_level: 'error',
    params: {
      required_fields: [7, 8], // At least one of ProductName or Description must be filled
      field_labels: ['Product Name', 'Description'],
      validate_as: 'float',
      float_params: {
        min: 0,
        allow_negative: false
      }
    },
    complimentary_fields: [7] // If ProductName (field7) is filled, UnitPrice is required
  }
};
