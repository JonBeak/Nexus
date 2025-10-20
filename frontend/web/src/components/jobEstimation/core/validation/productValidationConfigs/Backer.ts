import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Backer (Product Type 4)
 *
 * Field mappings:
 * - field1: Alum XYZ (3D dimensions: X x Y x Z format)
 * - field2: Alum XYZ (3D dimensions: X x Y x Z format)
 * - field3: Alum XYZ (3D dimensions: X x Y x Z format)
 * - field4: RW 8" L (positive float, max 299.5")
 * - field5: RW 8" L (positive float, max 299.5")
 * - field6: ACM XY (2D dimensions: X x Y format, max 300" x 60")
 * - field7: ACM XY (2D dimensions: X x Y format, max 300" x 60")
 * - field8: ACM XY (2D dimensions: X x Y format, max 300" x 60")
 * - field9: ACM XY (2D dimensions: X x Y format, max 300" x 60")
 * - field10: Assem (assembly cost - can be negative)
 *
 * Dimensional limits:
 * - Aluminum (fields 1-3): After Z adjustment, max 239.5" x 47.5"
 * - Hinged Raceway (fields 4-5): max 299.5"
 * - ACM (fields 6-9): max 300" x 60"
 */
export const backerValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'threedimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,  // Must be > 0
      max_value_x: 239.5,  // After adjustment: X + Z*2
      max_value_y: 47.5    // After adjustment: Y + Z*2
    }
  },
  field2: {
    function: 'threedimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value_x: 239.5,
      max_value_y: 47.5
    }
  },
  field3: {
    function: 'threedimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value_x: 239.5,
      max_value_y: 47.5
    }
  },
  field4: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0.01,
      max: 299.5,
      allow_negative: false
    }
  },
  field5: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0.01,
      max: 299.5,
      allow_negative: false
    }
  },
  field6: {
    function: 'twodimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value: 300,  // Max X for ACM
      max_value_y: 60  // Max Y for ACM
    }
  },
  field7: {
    function: 'twodimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value: 300,
      max_value_y: 60
    }
  },
  field8: {
    function: 'twodimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value: 300,
      max_value_y: 60
    }
  },
  field9: {
    function: 'twodimensions',
    error_level: 'error',
    params: {
      delimiter: 'x',
      allow_negative: false,
      min_value: 0.01,
      max_value: 300,
      max_value_y: 60
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true  // Assembly cost can be negative
    }
  }
};
