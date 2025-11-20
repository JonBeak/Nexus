# Phase 1.5.c.2: Order Template System

**Status:** ✅ COMPLETE
**Priority:** HIGH
**Duration:** 1 day (~8 hours actual)
**Completed:** 2025-11-07
**Dependencies:** Phase 1.5.c.1 (Frontend API) ✅
**Last Updated:** 2025-11-07

---

## Overview

Phase 1.5.c.2 creates a NEW template system specifically for orders. This is **separate** from the Estimation Modal templates and uses semantic keys for production-ready data.

**Key Differences from Estimation Templates:**

| Aspect | Estimation Templates | Order Templates (NEW) |
|--------|---------------------|----------------------|
| Purpose | Flexible customer input | Production specifications |
| Storage | field1-field12 | Semantic keys (height, depth, etc.) |
| Location | jobEstimation/ | orders/config/ |
| Mutability | Changes with customer requests | Locked after finalization |
| Display | Field prompts | Production labels |

---

## Template Architecture

### Frontend Templates

**Purpose:** Define field structure for each product type on the order form

**Location:** `/home/jon/Nexus/frontend/web/src/config/orderProductTemplates.ts`

```typescript
export interface OrderTemplateField {
  key: string;              // Semantic key: "height", "depth", "vinyl_color"
  label: string;            // Display label: "Letter Height"
  type: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;            // "inches", "feet", "lbs"
  required: boolean;
  options?: string[];       // For select type
  placeholder?: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface OrderProductTemplate {
  product_type: string;     // Matches order_parts.product_type
  category: string;         // "Channel Letters", "Flat Signs", etc.
  fields: OrderTemplateField[];
}
```

### Backend Types (Optional for Phase 1)

**Purpose:** Type safety for backend template operations (future use)

**Location:** `/home/jon/Nexus/backend/web/src/types/orderTemplates.ts`

```typescript
export interface OrderSpecifications {
  // Common fields
  quantity?: number;

  // Channel Letters
  height?: string;
  depth?: string;
  face_material?: string;
  return_material?: string;
  vinyl_color?: string;
  led_modules?: string;
  power_supply?: string;
  mounting_type?: string;

  // LED Neon
  color?: string;
  length?: string;
  installation?: string;

  // Substrate Cut
  material?: string;
  width?: string;
  finish?: string;

  // Vinyl
  vinyl_type?: string;
  application_method?: string;

  // Painting
  paint_type?: string;
  paint_color?: string;

  // Custom/Other
  [key: string]: any;  // Allow dynamic keys
}
```

---

## Implementation Tasks

### Task 1: Create Frontend Template Configuration

**File:** `/home/jon/Nexus/frontend/web/src/config/orderProductTemplates.ts`

```typescript
import { OrderTemplateField, OrderProductTemplate } from './types';

/**
 * Template for Channel Letters
 * Covers: Front Lit, Back Lit, Combination, Open Face
 */
const CHANNEL_LETTERS_TEMPLATE: OrderProductTemplate = {
  product_type: 'Channel Letters',
  category: 'Channel Letters',
  fields: [
    {
      key: 'type',
      label: 'Letter Type',
      type: 'text',
      required: true,
      placeholder: 'e.g., 3" Reverse Channel, Front Lit'
    },
    {
      key: 'height',
      label: 'Letter Height',
      type: 'number',
      unit: 'inches',
      required: true,
      validation: { min: 1, max: 120 }
    },
    {
      key: 'depth',
      label: 'Return Depth',
      type: 'number',
      unit: 'inches',
      required: false,
      validation: { min: 0, max: 12 }
    },
    {
      key: 'face_material',
      label: 'Face Material',
      type: 'text',
      required: false,
      placeholder: 'e.g., Acrylic, Polycarbonate'
    },
    {
      key: 'return_material',
      label: 'Return Material',
      type: 'text',
      required: false,
      placeholder: 'e.g., Aluminum, Painted Steel'
    },
    {
      key: 'vinyl_color',
      label: 'Vinyl Color',
      type: 'text',
      required: false
    },
    {
      key: 'led_modules',
      label: 'LED Modules',
      type: 'text',
      required: false,
      placeholder: 'e.g., White 5mm, Qty 64'
    },
    {
      key: 'power_supply',
      label: 'Power Supply',
      type: 'text',
      required: false,
      placeholder: 'e.g., 12V 5A Indoor'
    },
    {
      key: 'mounting_type',
      label: 'Mounting Type',
      type: 'text',
      required: false,
      placeholder: 'e.g., Flush, Pins + Spacer'
    }
  ]
};

/**
 * Template for LED Neon
 */
const LED_NEON_TEMPLATE: OrderProductTemplate = {
  product_type: 'LED Neon',
  category: 'LED Neon',
  fields: [
    {
      key: 'color',
      label: 'Neon Color',
      type: 'text',
      required: true,
      placeholder: 'e.g., Warm White, Red, Blue'
    },
    {
      key: 'length',
      label: 'Total Length',
      type: 'number',
      unit: 'feet',
      required: true,
      validation: { min: 0.1 }
    },
    {
      key: 'power_supply',
      label: 'Power Supply',
      type: 'text',
      required: false,
      placeholder: 'e.g., 12V 3A'
    },
    {
      key: 'installation',
      label: 'Installation Method',
      type: 'text',
      required: false,
      placeholder: 'e.g., Clips, Track, Adhesive'
    }
  ]
};

/**
 * Template for Substrate Cut
 */
const SUBSTRATE_CUT_TEMPLATE: OrderProductTemplate = {
  product_type: 'Substrate Cut',
  category: 'Flat Signs',
  fields: [
    {
      key: 'material',
      label: 'Material',
      type: 'text',
      required: true,
      placeholder: 'e.g., ACM, PVC, Acrylic'
    },
    {
      key: 'width',
      label: 'Width',
      type: 'number',
      unit: 'inches',
      required: true,
      validation: { min: 1 }
    },
    {
      key: 'height',
      label: 'Height',
      type: 'number',
      unit: 'inches',
      required: true,
      validation: { min: 1 }
    },
    {
      key: 'finish',
      label: 'Finish',
      type: 'text',
      required: false,
      placeholder: 'e.g., Routed edges, Polished'
    }
  ]
};

/**
 * Template for Vinyl Application
 */
const VINYL_TEMPLATE: OrderProductTemplate = {
  product_type: '↳ Vinyl',
  category: 'Components',
  fields: [
    {
      key: 'vinyl_type',
      label: 'Vinyl Type',
      type: 'text',
      required: false,
      placeholder: 'e.g., Translucent, Opaque'
    },
    {
      key: 'color',
      label: 'Color',
      type: 'text',
      required: false
    },
    {
      key: 'application_method',
      label: 'Application Method',
      type: 'text',
      required: false,
      placeholder: 'e.g., Wet apply, Dry apply'
    }
  ]
};

/**
 * Template for Painting
 */
const PAINTING_TEMPLATE: OrderProductTemplate = {
  product_type: '↳ Painting',
  category: 'Components',
  fields: [
    {
      key: 'paint_type',
      label: 'Paint Type',
      type: 'text',
      required: false,
      placeholder: 'e.g., Automotive, Powder Coat'
    },
    {
      key: 'color',
      label: 'Color',
      type: 'text',
      required: false
    },
    {
      key: 'finish',
      label: 'Finish',
      type: 'text',
      required: false,
      placeholder: 'e.g., Gloss, Matte, Satin'
    }
  ]
};

/**
 * Default template for unknown product types
 */
const DEFAULT_TEMPLATE: OrderProductTemplate = {
  product_type: 'Default',
  category: 'Custom',
  fields: [
    {
      key: 'spec1',
      label: 'Specification 1',
      type: 'text',
      required: false
    },
    {
      key: 'spec2',
      label: 'Specification 2',
      type: 'text',
      required: false
    },
    {
      key: 'spec3',
      label: 'Specification 3',
      type: 'text',
      required: false
    },
    {
      key: 'spec4',
      label: 'Specification 4',
      type: 'text',
      required: false
    }
  ]
};

/**
 * Template registry
 */
const TEMPLATE_REGISTRY: Record<string, OrderProductTemplate> = {
  'Channel Letters': CHANNEL_LETTERS_TEMPLATE,
  'LED Neon': LED_NEON_TEMPLATE,
  'Substrate Cut': SUBSTRATE_CUT_TEMPLATE,
  '↳ Vinyl': VINYL_TEMPLATE,
  '↳ Painting': PAINTING_TEMPLATE,
};

/**
 * Get template for a product type
 * Supports prefix matching for variants (e.g., "Channel Letters - Front Lit" → "Channel Letters")
 */
export function getOrderTemplate(productType: string): OrderProductTemplate {
  // Exact match
  if (TEMPLATE_REGISTRY[productType]) {
    return TEMPLATE_REGISTRY[productType];
  }

  // Prefix match
  for (const [key, template] of Object.entries(TEMPLATE_REGISTRY)) {
    if (productType.startsWith(key)) {
      return template;
    }
  }

  // Fallback to default
  return DEFAULT_TEMPLATE;
}

/**
 * Get all available templates
 */
export function getAllTemplates(): OrderProductTemplate[] {
  return Object.values(TEMPLATE_REGISTRY);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): OrderProductTemplate[] {
  return Object.values(TEMPLATE_REGISTRY).filter(t => t.category === category);
}

/**
 * Validate specifications against template
 */
export function validateSpecifications(
  productType: string,
  specifications: Record<string, any>
): { valid: boolean; errors: string[] } {
  const template = getOrderTemplate(productType);
  const errors: string[] = [];

  // Check required fields
  for (const field of template.fields) {
    if (field.required && !specifications[field.key]) {
      errors.push(`${field.label} is required`);
    }

    // Validate number ranges
    if (field.type === 'number' && specifications[field.key] !== undefined) {
      const value = Number(specifications[field.key]);
      if (field.validation?.min !== undefined && value < field.validation.min) {
        errors.push(`${field.label} must be at least ${field.validation.min}`);
      }
      if (field.validation?.max !== undefined && value > field.validation.max) {
        errors.push(`${field.label} must be at most ${field.validation.max}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Task 2: Export Types

**File:** `/home/jon/Nexus/frontend/web/src/config/types.ts` (create new file)

```typescript
export interface OrderTemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface OrderProductTemplate {
  product_type: string;
  category: string;
  fields: OrderTemplateField[];
}
```

### Task 3: Create Backend Types (Optional)

**File:** `/home/jon/Nexus/backend/web/src/types/orderTemplates.ts`

```typescript
/**
 * Order Template Types (Backend)
 * Phase 1.5.c.2 - Semantic specification keys
 */

export interface OrderSpecifications {
  // Common
  quantity?: number;

  // Channel Letters
  type?: string;
  height?: string;
  depth?: string;
  face_material?: string;
  return_material?: string;
  vinyl_color?: string;
  led_modules?: string;
  power_supply?: string;
  mounting_type?: string;

  // LED Neon
  color?: string;
  length?: string;
  installation?: string;

  // Substrate Cut
  material?: string;
  width?: string;
  finish?: string;

  // Vinyl
  vinyl_type?: string;
  application_method?: string;

  // Painting
  paint_type?: string;
  paint_color?: string;

  // Allow any semantic key
  [key: string]: any;
}
```

---

## Data Migration Strategy

### Current State
```json
// order_parts.specifications (from estimation)
{
  "field1": "3\" Reverse Channel",
  "field2": "10",
  "field3": "",
  ...
  "quantity": "1"
}
```

### Target State
```json
// order_parts.specifications (Phase 1.5.c.2)
{
  "type": "3\" Reverse Channel",
  "height": "10",
  "depth": "3",
  "vinyl_color": "White",
  "led_modules": "Yes",
  "power_supply": "12V 5A Indoor",
  "mounting_type": "Pins + Spacer"
}
```

### Migration Approach

**For Phase 1:** Manual entry during job details setup
- Estimation creates order with empty `specifications: {}`
- Manager fills in semantic fields using template UI
- No automatic field1→semantic conversion needed

**For Future:** Create migration utility to convert field1-12 → semantic keys
- Map based on product type
- Preserve original data in backup field

---

## Testing Checklist

### Unit Tests

```typescript
// Test template lookup
const template = getOrderTemplate('Channel Letters - Front Lit');
expect(template.fields.length).toBeGreaterThan(0);
expect(template.fields[0].key).toBe('type');

// Test prefix matching
const template2 = getOrderTemplate('Channel Letters');
expect(template2).toBe(template);

// Test default fallback
const unknownTemplate = getOrderTemplate('Unknown Product');
expect(unknownTemplate.product_type).toBe('Default');
expect(unknownTemplate.fields.length).toBe(4);

// Test validation
const specs = { type: '3" Front Lit', height: '12' };
const result = validateSpecifications('Channel Letters', specs);
expect(result.valid).toBe(true);

const invalidSpecs = { height: '-5' };  // Invalid: negative
const result2 = validateSpecifications('Channel Letters', invalidSpecs);
expect(result2.valid).toBe(false);
expect(result2.errors.length).toBeGreaterThan(0);
```

### Integration Tests

**Test 1: Load template for order part**
```typescript
import { getOrderTemplate } from '@/config/orderProductTemplates';

const part = { product_type: 'Channel Letters' };
const template = getOrderTemplate(part.product_type);
console.log('Template fields:', template.fields.map(f => f.label));
```

**Test 2: Render fields dynamically**
```typescript
const template = getOrderTemplate(part.product_type);
template.fields.forEach(field => {
  console.log(`${field.label} (${field.key}): ${field.type} ${field.unit || ''}`);
});
```

**Test 3: Validate specifications**
```typescript
const specs = {
  type: '3" Reverse Channel',
  height: '10',
  depth: '3'
};
const validation = validateSpecifications('Channel Letters', specs);
console.log('Valid?', validation.valid);
console.log('Errors:', validation.errors);
```

---

## Template Expansion Guide

### Adding a New Product Type

1. Define template:
```typescript
const NEW_PRODUCT_TEMPLATE: OrderProductTemplate = {
  product_type: 'New Product',
  category: 'Custom',
  fields: [
    {
      key: 'dimension1',
      label: 'Primary Dimension',
      type: 'number',
      unit: 'inches',
      required: true
    },
    // ... more fields
  ]
};
```

2. Add to registry:
```typescript
const TEMPLATE_REGISTRY: Record<string, OrderProductTemplate> = {
  // ... existing templates
  'New Product': NEW_PRODUCT_TEMPLATE,
};
```

3. Test lookup:
```typescript
const template = getOrderTemplate('New Product');
console.log('Fields:', template.fields);
```

---

## Success Criteria

Phase 1.5.c.2 is complete when:

✅ Template configuration file created - DONE (366 lines)
✅ At least 5 product type templates defined - DONE (6 templates)
✅ Template lookup function works with prefix matching - VERIFIED
✅ Validation function works for required fields and ranges - VERIFIED
✅ Default template exists for unknown types - CONFIRMED
✅ All unit tests pass - PASSED
✅ Integration tests successful - CONFIRMED
✅ Used in Dual-Table UI (Phase 1.5.c.5) - INTEGRATED

---

## Next Steps

Once Phase 1.5.c.2 is complete:

1. **Review** `Nexus_Orders_Phase1.5c.3_Snapshots.md`
2. **Implement** Snapshot & Versioning System (Phase 1.5.c.3)

---

## Files Created/Modified

- `/home/jon/Nexus/frontend/web/src/config/orderProductTemplates.ts` (+350 lines) **NEW**
- `/home/jon/Nexus/frontend/web/src/config/types.ts` (+25 lines) **NEW**
- `/home/jon/Nexus/backend/web/src/types/orderTemplates.ts` (+50 lines) **NEW** (optional)

**Total Lines Added:** ~425
**Estimated Time:** 8 hours

---

**Document Status:** ✅ COMPLETE - All Templates Implemented and Tested
**Completed Date:** 2025-11-07
**Dependencies:** Phase 1.5.c.1 (Frontend API) - COMPLETE
**Unblocked:** Phase 1.5.c.3 (Snapshots), Phase 1.5.c.5 (Dual-Table UI)
**Integration:** Successfully integrated with Dual-Table UI in Phase 1.5.c.5
