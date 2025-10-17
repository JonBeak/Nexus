import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Wiring (Product Type 10)
 *
 * Field mappings:
 * - field1: DCPlug # (float, no scientific notation, no negative)
 * - field2: DCPlug $ (float override, no scientific notation, no negative)
 * - field3: WallPlug # (float, no scientific notation, no negative)
 * - field4: WallPlug $ (float override, no scientific notation, no negative)
 * - field5: Extra (disabled)
 * - field6: Wire >> (disabled, label only)
 * - field7: # Pcs (float, no scientific notation - complementary to field8)
 * - field8: Len ft (float, no scientific notation - complementary to field7)
 * - field9: Total ft (float, no scientific notation)
 * - field10: ~ $/ft ~ (float override, no scientific notation, no negative)
 *
 * Component Logic:
 * - Plugs: field1-4 (DC Plugs and Wall Plugs combined into one component)
 * - Wiring: field7-10 (wire length calculation with optional override)
 *
 * Validation Rules:
 * 1. field7 and field8 are complementary (if one filled, other required)
 * 2. All numeric fields: no scientific notation
 * 3. field1, 3, 9: allow any float (no negative enforcement)
 * 4. field2, 4, 10: no negative values (price overrides)
 */
export const wiringValidation: Record<string, FieldValidationConfig> = {
  field1: {
    // DCPlug # - float, no scientific notation
    function: 'float',
    error_level: 'error',
    params: {
      allow_scientific: false
    }
  },
  field2: {
    // DCPlug $ - price override, no negative
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field3: {
    // WallPlug # - float, no scientific notation
    function: 'float',
    error_level: 'error',
    params: {
      allow_scientific: false
    }
  },
  field4: {
    // WallPlug $ - price override, no negative
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field7: {
    // # Pcs - complementary to field8 (Len ft)
    function: 'float',
    error_level: 'error',
    complimentary_fields: [8], // If field8 filled, field7 is required
    params: {
      allow_scientific: false
    }
  },
  field8: {
    // Len ft - complementary to field7 (# Pcs)
    function: 'float',
    error_level: 'error',
    complimentary_fields: [7], // If field7 filled, field8 is required
    params: {
      allow_scientific: false
    }
  },
  field9: {
    // Total ft - float, no scientific notation
    function: 'float',
    error_level: 'error',
    params: {
      allow_scientific: false
    }
  },
  field10: {
    // ~ $/ft ~ - wire cost override, no negative
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  }
};
