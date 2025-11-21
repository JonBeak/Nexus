// File Clean up Finished: 2025-11-20
// Created during orderValidationService.ts cleanup to separate rules (data) from logic

/**
 * Order Validation Rules Configuration
 *
 * Centralized validation rules for order specification templates.
 * Extracted from orderValidationService.ts to improve separation of concerns.
 *
 * Supports:
 * - Simple required fields
 * - Conditional required fields (field required based on another field's value)
 * - OR logic (at least one of multiple fields required)
 */

/**
 * Specification validation rule configuration
 */
export interface SpecValidationRule {
  templateName: string;
  requiredFields?: string[];  // Simple required fields (all must be present)
  conditionalFields?: ConditionalField[];  // Fields required based on conditions
  orFields?: string[][];  // Array of field groups where at least one from each group is required
  errorMessage: (missingFields: string[], context?: any) => string;
}

/**
 * Conditional field requirement
 * Field is required only when the condition is met
 */
export interface ConditionalField {
  field: string;  // The field that may be required
  condition: {
    field: string;  // The field to check
    value: any;  // The value that triggers the requirement (supports true, false, string values)
    operator?: 'equals' | 'notEquals' | 'exists';  // Comparison operator (default: equals)
  };
}

/**
 * Comprehensive validation rules for all specification templates
 * Updated: 2025-11-20 - Complete validation coverage
 */
export const SPEC_VALIDATION_RULES: SpecValidationRule[] = [
  // ============================================
  // CONSTRUCTION SPECS
  // ============================================
  {
    templateName: 'Face',
    requiredFields: ['material', 'colour'],
    errorMessage: (missing) =>
      `Face specification requires both material and colour. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Back',
    requiredFields: ['material'],
    errorMessage: (missing) =>
      `Back specification requires material`
  },
  {
    templateName: 'Material',
    requiredFields: ['substrate', 'colour'],
    errorMessage: (missing) =>
      `Material specification requires both substrate and colour. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Neon Base',
    requiredFields: ['thickness', 'material', 'colour'],
    errorMessage: (missing) =>
      `Neon Base specification requires thickness, material, and colour. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Box Material',
    requiredFields: ['material', 'colour'],
    errorMessage: (missing) =>
      `Box Material specification requires both material and colour. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Return',
    requiredFields: ['depth', 'colour'],
    errorMessage: (missing) =>
      `Return specification requires both depth and colour. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Trim',
    requiredFields: ['colour'],
    errorMessage: (missing) =>
      `Trim specification requires colour`
  },

  // ============================================
  // FABRICATION SPECS
  // ============================================
  {
    templateName: 'Extr. Colour',
    requiredFields: ['colour'],
    errorMessage: (missing) =>
      `Extr. Colour specification requires colour`
  },
  {
    templateName: 'Cutting',
    requiredFields: ['method'],
    errorMessage: (missing) =>
      `Cutting specification requires method`
  },
  {
    templateName: 'Acrylic',
    requiredFields: ['thickness', 'colour'],
    errorMessage: (missing) =>
      `Acrylic specification requires both thickness and colour. Missing: ${missing.join(', ')}`
  },

  // ============================================
  // GRAPHICS/FINISHING SPECS
  // ============================================
  {
    templateName: 'Vinyl',
    requiredFields: ['colours', 'application', 'size'],
    errorMessage: (missing) =>
      `Vinyl specification requires colours, application, and size. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Digital Print',
    requiredFields: ['colour', 'type', 'application'],
    errorMessage: (missing) =>
      `Digital Print specification requires colour, type, and application. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Painting',
    requiredFields: ['colour', 'component', 'timing'],
    errorMessage: (missing) =>
      `Painting specification requires colour, component, and timing. Missing: ${missing.join(', ')}`
  },

  // ============================================
  // ASSEMBLY SPECS
  // ============================================
  {
    templateName: 'D-Tape',
    requiredFields: ['include', 'thickness'],
    errorMessage: (missing) =>
      `D-Tape specification requires include (yes/no) and thickness. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Pins',
    requiredFields: ['count'],
    orFields: [['pins', 'spacers']],  // At least one of pins OR spacers required
    errorMessage: (missing, context) => {
      if (missing.includes('count')) {
        return `Pins specification requires count. Missing: ${missing.join(', ')}`;
      }
      if (context?.orFieldsViolation) {
        return `Pins specification requires either pins or spacers to be specified`;
      }
      return `Pins specification is incomplete. Missing: ${missing.join(', ')}`;
    }
  },
  {
    templateName: 'Cut',
    requiredFields: ['include'],
    errorMessage: (missing) =>
      `Cut specification requires include (yes/no)`
  },
  {
    templateName: 'Peel',
    requiredFields: ['include'],
    errorMessage: (missing) =>
      `Peel specification requires include (yes/no)`
  },
  {
    templateName: 'Mask',
    requiredFields: ['include'],
    errorMessage: (missing) =>
      `Mask specification requires include (yes/no)`
  },
  // Assembly template - no required fields
  // Notes template - no required fields

  // ============================================
  // ELECTRICAL SPECS
  // ============================================
  {
    templateName: 'LEDs',
    requiredFields: ['count', 'led_type'],
    errorMessage: (missing) =>
      `LEDs specification requires count and LED type. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Neon LED',
    requiredFields: ['stroke_width', 'colour'],
    errorMessage: (missing) =>
      `Neon LED specification requires stroke width and colour. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Power Supply',
    requiredFields: ['count', 'ps_type'],
    errorMessage: (missing) =>
      `Power Supply specification requires count and PS type. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'Wire Length',
    requiredFields: ['length', 'wire_gauge'],
    errorMessage: (missing) =>
      `Wire Length specification requires length and wire gauge. Missing: ${missing.join(', ')}`
  },
  {
    templateName: 'UL',
    requiredFields: ['include'],
    errorMessage: (missing) =>
      `UL specification requires include (yes/no)`
  },

  // ============================================
  // OTHER SPECS
  // ============================================
  {
    templateName: 'Drain Holes',
    requiredFields: ['include'],
    conditionalFields: [
      {
        field: 'size',
        condition: { field: 'include', value: true, operator: 'equals' }
      }
    ],
    errorMessage: (missing, context) => {
      if (missing.includes('include')) {
        return `Drain Holes specification requires include (yes/no)`;
      }
      if (context?.conditionalViolation) {
        return `Drain Holes size is required when include is set to yes`;
      }
      return `Drain Holes specification is incomplete. Missing: ${missing.join(', ')}`;
    }
  }
  // Notes template - no required fields (optional)
];
