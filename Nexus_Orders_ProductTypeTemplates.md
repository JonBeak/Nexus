# Product Type Templates - Phase 1 Hard-coded Specifications

## Overview

This document defines the hard-coded templates for all product types in Phase 1. Each template includes:
- Product specifications (fields shown on order forms)
- Production task checklist
- Packing list items
- Material requirements stub (Phase 4)

**Phase 1 Note:** These are hard-coded in the backend service layer. In Phase 3, these will migrate to a database-driven system with admin UI for management.

## Template Structure

```typescript
interface ProductTypeTemplate {
  product_type_id: string;
  display_name: string;
  category: string;
  specifications: SpecificationField[];
  tasks: TaskTemplate[];
  packingItems: PackingItem[];
  // Phase 4: materialCalculations
}

interface SpecificationField {
  field_id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  required: boolean;
  options?: string[];  // For select type
  show_on_customer_form?: boolean;  // Default true
  transform_for_customer?: (value: any) => any;  // e.g., LED count → Yes/No
}

interface TaskTemplate {
  task_name: string;
  order: number;
  typical_duration?: string;  // Phase 2+
}

interface PackingItem {
  item_name: string;
  order: number;
  conditional?: string;  // e.g., "if led_modules > 0"
}
```

## Product Type Categories

1. **Channel Letters** - Dimensional illuminated letters
2. **Dimensional Letters** - Non-illuminated 3D letters
3. **Flat Signs** - Panel-based signage
4. **Pylons & Monuments** - Large ground structures
5. **Custom/Specialty** - Unique fabrications

---

## Channel Letters

### Channel Letters - Front Lit

```typescript
{
  product_type_id: 'channel_letters_front_lit',
  display_name: 'Channel Letters - Front Lit',
  category: 'Channel Letters',

  specifications: [
    {
      field_id: 'height',
      label: 'Letter Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'depth',
      label: 'Return Depth',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'face_material',
      label: 'Face Material',
      type: 'select',
      options: ['Acrylic', 'Polycarbonate', 'Aluminum'],
      required: true
    },
    {
      field_id: 'return_material',
      label: 'Return Material',
      type: 'select',
      options: ['Aluminum', 'Painted Steel'],
      required: true
    },
    {
      field_id: 'vinyl_color',
      label: 'Vinyl Color',
      type: 'text',
      required: true
    },
    {
      field_id: 'led_count',
      label: 'LED Modules',
      type: 'number',
      required: true,
      show_on_customer_form: true,
      transform_for_customer: (value) => value > 0 ? 'Yes' : 'No'
    },
    {
      field_id: 'power_supply_count',
      label: 'Power Supplies',
      type: 'number',
      required: true,
      show_on_customer_form: true,
      transform_for_customer: (value) => value > 0 ? 'Yes' : 'No'
    },
    {
      field_id: 'mounting_type',
      label: 'Mounting Type',
      type: 'select',
      options: ['Flush Mount', 'Raceway', 'Stud Mount', 'Custom'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Cut letter returns', order: 2 },
    { task_name: 'Cut letter faces', order: 3 },
    { task_name: 'Weld returns to backing', order: 4 },
    { task_name: 'Apply vinyl to faces', order: 5 },
    { task_name: 'Install LED modules', order: 6 },
    { task_name: 'Wire power supply', order: 7 },
    { task_name: 'Test illumination', order: 8 },
    { task_name: 'Quality check - inspect welds and finish', order: 9 },
    { task_name: 'Package with mounting hardware', order: 10 }
  ],

  packingItems: [
    { item_name: 'Letter faces with vinyl applied', order: 1 },
    { item_name: 'Returns assembled and welded', order: 2 },
    { item_name: 'LED modules installed', order: 3, conditional: 'led_count > 0' },
    { item_name: 'Power supply with wiring', order: 4, conditional: 'power_supply_count > 0' },
    { item_name: 'Mounting hardware and anchors', order: 5 },
    { item_name: 'Installation template', order: 6 }
  ]
}
```

### Channel Letters - Back Lit (Halo)

```typescript
{
  product_type_id: 'channel_letters_back_lit',
  display_name: 'Channel Letters - Back Lit (Halo)',
  category: 'Channel Letters',

  specifications: [
    {
      field_id: 'height',
      label: 'Letter Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'depth',
      label: 'Return Depth',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'face_material',
      label: 'Face Material',
      type: 'select',
      options: ['Aluminum', 'Stainless Steel', 'Painted Steel'],
      required: true
    },
    {
      field_id: 'face_finish',
      label: 'Face Finish',
      type: 'select',
      options: ['Brushed', 'Polished', 'Painted', 'Powder Coated'],
      required: true
    },
    {
      field_id: 'return_material',
      label: 'Return Material',
      type: 'select',
      options: ['Aluminum', 'Painted Steel'],
      required: true
    },
    {
      field_id: 'standoff_distance',
      label: 'Standoff Distance',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'led_count',
      label: 'LED Modules',
      type: 'number',
      required: true,
      transform_for_customer: (value) => value > 0 ? 'Yes' : 'No'
    },
    {
      field_id: 'power_supply_count',
      label: 'Power Supplies',
      type: 'number',
      required: true,
      transform_for_customer: (value) => value > 0 ? 'Yes' : 'No'
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Cut letter faces', order: 2 },
    { task_name: 'Finish letter faces (brush/polish/paint)', order: 3 },
    { task_name: 'Cut and weld returns', order: 4 },
    { task_name: 'Install LED modules on back', order: 5 },
    { task_name: 'Attach standoffs', order: 6 },
    { task_name: 'Wire power supply', order: 7 },
    { task_name: 'Test halo illumination', order: 8 },
    { task_name: 'Quality check', order: 9 },
    { task_name: 'Package with spacers', order: 10 }
  ],

  packingItems: [
    { item_name: 'Finished letter faces', order: 1 },
    { item_name: 'Returns with LED modules', order: 2 },
    { item_name: 'Standoffs/spacers attached', order: 3 },
    { item_name: 'Power supply with wiring', order: 4, conditional: 'power_supply_count > 0' },
    { item_name: 'Mounting hardware', order: 5 },
    { item_name: 'Installation template', order: 6 }
  ]
}
```

### Channel Letters - Combination (Front & Back Lit)

```typescript
{
  product_type_id: 'channel_letters_combination',
  display_name: 'Channel Letters - Combination Lit',
  category: 'Channel Letters',

  specifications: [
    {
      field_id: 'height',
      label: 'Letter Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'depth',
      label: 'Return Depth',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'face_material',
      label: 'Face Material',
      type: 'select',
      options: ['Acrylic', 'Polycarbonate'],
      required: true
    },
    {
      field_id: 'return_material',
      label: 'Return Material',
      type: 'select',
      options: ['Aluminum', 'Painted Steel'],
      required: true
    },
    {
      field_id: 'vinyl_color',
      label: 'Vinyl Color',
      type: 'text',
      required: true
    },
    {
      field_id: 'standoff_distance',
      label: 'Standoff Distance',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'led_count',
      label: 'LED Modules',
      type: 'number',
      required: true,
      transform_for_customer: (value) => value > 0 ? 'Yes' : 'No'
    },
    {
      field_id: 'power_supply_count',
      label: 'Power Supplies',
      type: 'number',
      required: true,
      transform_for_customer: (value) => value > 0 ? 'Yes' : 'No'
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Cut letter faces', order: 2 },
    { task_name: 'Cut letter returns', order: 3 },
    { task_name: 'Weld returns', order: 4 },
    { task_name: 'Apply vinyl to faces', order: 5 },
    { task_name: 'Install front LED modules', order: 6 },
    { task_name: 'Install back LED modules', order: 7 },
    { task_name: 'Attach standoffs', order: 8 },
    { task_name: 'Wire power supplies', order: 9 },
    { task_name: 'Test front and halo illumination', order: 10 },
    { task_name: 'Quality check', order: 11 },
    { task_name: 'Package with all hardware', order: 12 }
  ],

  packingItems: [
    { item_name: 'Letter faces with vinyl', order: 1 },
    { item_name: 'Returns with front and back LEDs', order: 2 },
    { item_name: 'Standoffs/spacers', order: 3 },
    { item_name: 'Power supplies (may be multiple)', order: 4 },
    { item_name: 'Mounting hardware', order: 5 },
    { item_name: 'Installation template', order: 6 }
  ]
}
```

---

## Dimensional Letters

### Dimensional Letters - Flat Cut

```typescript
{
  product_type_id: 'dimensional_letters_flat',
  display_name: 'Dimensional Letters - Flat Cut',
  category: 'Dimensional Letters',

  specifications: [
    {
      field_id: 'height',
      label: 'Letter Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'material',
      label: 'Material',
      type: 'select',
      options: ['Acrylic', 'PVC', 'Aluminum', 'Wood', 'HDU'],
      required: true
    },
    {
      field_id: 'thickness',
      label: 'Material Thickness',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'finish',
      label: 'Finish',
      type: 'select',
      options: ['Painted', 'Vinyl', 'Natural', 'Powder Coated', 'Brushed', 'Polished'],
      required: true
    },
    {
      field_id: 'mounting_type',
      label: 'Mounting Type',
      type: 'select',
      options: ['Flush Mount', 'Stud Mount', 'Foam Tape', 'Custom'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'CNC cut letters', order: 2 },
    { task_name: 'Route/finish edges', order: 3 },
    { task_name: 'Sand and prep surface', order: 4 },
    { task_name: 'Apply finish (paint/vinyl/etc)', order: 5 },
    { task_name: 'Install mounting hardware', order: 6 },
    { task_name: 'Quality check', order: 7 },
    { task_name: 'Package with template', order: 8 }
  ],

  packingItems: [
    { item_name: 'Finished letters', order: 1 },
    { item_name: 'Mounting studs or tape', order: 2 },
    { item_name: 'Installation template', order: 3 },
    { item_name: 'Touch-up paint (if applicable)', order: 4, conditional: 'finish === "Painted"' }
  ]
}
```

### Dimensional Letters - Fabricated

```typescript
{
  product_type_id: 'dimensional_letters_fabricated',
  display_name: 'Dimensional Letters - Fabricated',
  category: 'Dimensional Letters',

  specifications: [
    {
      field_id: 'height',
      label: 'Letter Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'depth',
      label: 'Letter Depth',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'face_material',
      label: 'Face Material',
      type: 'select',
      options: ['Aluminum', 'Stainless Steel', 'Acrylic', 'Wood'],
      required: true
    },
    {
      field_id: 'return_material',
      label: 'Return/Side Material',
      type: 'select',
      options: ['Aluminum', 'Stainless Steel', 'Painted Steel'],
      required: true
    },
    {
      field_id: 'finish',
      label: 'Finish',
      type: 'select',
      options: ['Painted', 'Powder Coated', 'Brushed', 'Polished', 'Natural'],
      required: true
    },
    {
      field_id: 'mounting_type',
      label: 'Mounting Type',
      type: 'select',
      options: ['Stud Mount', 'Flush Mount', 'Standoffs', 'Custom'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Cut letter faces', order: 2 },
    { task_name: 'Cut returns/sides', order: 3 },
    { task_name: 'Weld or bond assembly', order: 4 },
    { task_name: 'Grind and finish welds', order: 5 },
    { task_name: 'Apply finish', order: 6 },
    { task_name: 'Install mounting hardware', order: 7 },
    { task_name: 'Quality check', order: 8 },
    { task_name: 'Package carefully', order: 9 }
  ],

  packingItems: [
    { item_name: 'Assembled finished letters', order: 1 },
    { item_name: 'Mounting hardware', order: 2 },
    { item_name: 'Installation template', order: 3 },
    { item_name: 'Touch-up materials', order: 4 }
  ]
}
```

---

## Flat Signs

### Flat Sign - ACM Panel

```typescript
{
  product_type_id: 'flat_sign_acm',
  display_name: 'Flat Sign - ACM Panel',
  category: 'Flat Signs',

  specifications: [
    {
      field_id: 'width',
      label: 'Width',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'height',
      label: 'Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'panel_color',
      label: 'Panel Color',
      type: 'text',
      required: true
    },
    {
      field_id: 'graphics_type',
      label: 'Graphics Type',
      type: 'select',
      options: ['Vinyl Graphics', 'Digital Print', 'Painted', 'Combination'],
      required: true
    },
    {
      field_id: 'laminate',
      label: 'Laminate',
      type: 'select',
      options: ['None', 'Gloss', 'Matte', 'Anti-Graffiti'],
      required: false
    },
    {
      field_id: 'frame_type',
      label: 'Frame Type',
      type: 'select',
      options: ['No Frame', 'Aluminum Frame', 'Channel Frame', 'Custom'],
      required: true
    },
    {
      field_id: 'mounting_type',
      label: 'Mounting Type',
      type: 'select',
      options: ['Wall Mount', 'Post Mount', 'Hanging', 'Custom'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Cut ACM panel to size', order: 2 },
    { task_name: 'Prepare surface', order: 3 },
    { task_name: 'Apply graphics/print', order: 4 },
    { task_name: 'Apply laminate (if specified)', order: 5, conditional: 'laminate !== "None"' },
    { task_name: 'Build frame (if specified)', order: 6, conditional: 'frame_type !== "No Frame"' },
    { task_name: 'Install mounting hardware', order: 7 },
    { task_name: 'Quality check', order: 8 },
    { task_name: 'Package for shipping', order: 9 }
  ],

  packingItems: [
    { item_name: 'Finished ACM panel with graphics', order: 1 },
    { item_name: 'Frame (if applicable)', order: 2, conditional: 'frame_type !== "No Frame"' },
    { item_name: 'Mounting hardware', order: 3 },
    { item_name: 'Installation instructions', order: 4 }
  ]
}
```

### Flat Sign - HDU Carved

```typescript
{
  product_type_id: 'flat_sign_hdu_carved',
  display_name: 'Flat Sign - HDU Carved',
  category: 'Flat Signs',

  specifications: [
    {
      field_id: 'width',
      label: 'Width',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'height',
      label: 'Height',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'thickness',
      label: 'HDU Thickness',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'carving_depth',
      label: 'Carving Depth',
      type: 'number',
      unit: 'inches',
      required: true
    },
    {
      field_id: 'finish_type',
      label: 'Finish Type',
      type: 'select',
      options: ['Painted', 'Stained', 'Gilded', 'Natural'],
      required: true
    },
    {
      field_id: 'edge_profile',
      label: 'Edge Profile',
      type: 'select',
      options: ['Routed Round', 'Beveled', 'Square', 'Custom'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Prepare HDU blank', order: 2 },
    { task_name: 'CNC carve design', order: 3 },
    { task_name: 'Hand carving details (if needed)', order: 4 },
    { task_name: 'Route edge profile', order: 5 },
    { task_name: 'Sand and smooth', order: 6 },
    { task_name: 'Prime surface', order: 7 },
    { task_name: 'Apply finish/paint', order: 8 },
    { task_name: 'Detail painting', order: 9 },
    { task_name: 'Clear coat/seal', order: 10 },
    { task_name: 'Install mounting hardware', order: 11 },
    { task_name: 'Quality check', order: 12 },
    { task_name: 'Package carefully', order: 13 }
  ],

  packingItems: [
    { item_name: 'Finished carved HDU sign', order: 1 },
    { item_name: 'Mounting hardware', order: 2 },
    { item_name: 'Touch-up paint', order: 3 },
    { item_name: 'Care instructions', order: 4 }
  ]
}
```

---

## Pylons & Monuments

### Pylon Sign

```typescript
{
  product_type_id: 'pylon_sign',
  display_name: 'Pylon Sign',
  category: 'Pylons & Monuments',

  specifications: [
    {
      field_id: 'overall_height',
      label: 'Overall Height',
      type: 'number',
      unit: 'feet',
      required: true
    },
    {
      field_id: 'sign_face_width',
      label: 'Sign Face Width',
      type: 'number',
      unit: 'feet',
      required: true
    },
    {
      field_id: 'sign_face_height',
      label: 'Sign Face Height',
      type: 'number',
      unit: 'feet',
      required: true
    },
    {
      field_id: 'pole_configuration',
      label: 'Pole Configuration',
      type: 'select',
      options: ['Single Pole', 'Double Pole', 'Triple Pole'],
      required: true
    },
    {
      field_id: 'cabinet_type',
      label: 'Cabinet Type',
      type: 'select',
      options: ['Aluminum', 'Steel', 'Stainless Steel'],
      required: true
    },
    {
      field_id: 'illumination',
      label: 'Illumination',
      type: 'select',
      options: ['LED Internal', 'LED External', 'Non-Illuminated'],
      required: true
    },
    {
      field_id: 'face_material',
      label: 'Face Material',
      type: 'select',
      options: ['Polycarbonate', 'Acrylic', 'Digital Print', 'Vinyl on ACM'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design and engineering approval', order: 1 },
    { task_name: 'Fabricate sign cabinet', order: 2 },
    { task_name: 'Cut and prepare faces', order: 3 },
    { task_name: 'Apply graphics to faces', order: 4 },
    { task_name: 'Install LED lighting (if applicable)', order: 5 },
    { task_name: 'Wire electrical components', order: 6 },
    { task_name: 'Assemble cabinet and faces', order: 7 },
    { task_name: 'Fabricate pole structure', order: 8 },
    { task_name: 'Test all electrical', order: 9 },
    { task_name: 'Quality check - structural integrity', order: 10 },
    { task_name: 'Prepare for shipping (may require freight)', order: 11 }
  ],

  packingItems: [
    { item_name: 'Sign cabinet with faces installed', order: 1 },
    { item_name: 'Pole sections', order: 2 },
    { item_name: 'Mounting brackets and hardware', order: 3 },
    { item_name: 'Electrical components and wiring', order: 4, conditional: 'illumination !== "Non-Illuminated"' },
    { item_name: 'Installation drawings', order: 5 },
    { item_name: 'Foundation specifications', order: 6 }
  ]
}
```

### Monument Sign

```typescript
{
  product_type_id: 'monument_sign',
  display_name: 'Monument Sign',
  category: 'Pylons & Monuments',

  specifications: [
    {
      field_id: 'overall_width',
      label: 'Overall Width',
      type: 'number',
      unit: 'feet',
      required: true
    },
    {
      field_id: 'overall_height',
      label: 'Overall Height',
      type: 'number',
      unit: 'feet',
      required: true
    },
    {
      field_id: 'base_material',
      label: 'Base Material',
      type: 'select',
      options: ['Brick', 'Stone', 'Stucco', 'Concrete', 'Metal'],
      required: true
    },
    {
      field_id: 'sign_face_type',
      label: 'Sign Face Type',
      type: 'select',
      options: ['Cabinet (Illuminated)', 'Flat Panel', 'HDU Carved', 'Dimensional Letters'],
      required: true
    },
    {
      field_id: 'illumination',
      label: 'Illumination',
      type: 'select',
      options: ['Internal LED', 'External Spotlights', 'Non-Illuminated'],
      required: true
    }
  ],

  tasks: [
    { task_name: 'Design and engineering approval', order: 1 },
    { task_name: 'Fabricate base structure', order: 2 },
    { task_name: 'Apply base finish (brick/stone/etc)', order: 3 },
    { task_name: 'Fabricate sign face/cabinet', order: 4 },
    { task_name: 'Apply graphics', order: 5 },
    { task_name: 'Install lighting (if applicable)', order: 6 },
    { task_name: 'Assemble monument components', order: 7 },
    { task_name: 'Test all electrical', order: 8 },
    { task_name: 'Quality check', order: 9 },
    { task_name: 'Prepare for freight shipping', order: 10 }
  ],

  packingItems: [
    { item_name: 'Monument base structure', order: 1 },
    { item_name: 'Sign face/cabinet', order: 2 },
    { item_name: 'Mounting brackets', order: 3 },
    { item_name: 'Lighting components', order: 4, conditional: 'illumination !== "Non-Illuminated"' },
    { item_name: 'Installation drawings', order: 5 },
    { item_name: 'Foundation specifications', order: 6 }
  ]
}
```

---

## Custom/Specialty

### Custom Fabrication

```typescript
{
  product_type_id: 'custom_fabrication',
  display_name: 'Custom Fabrication',
  category: 'Custom/Specialty',

  specifications: [
    {
      field_id: 'description',
      label: 'Project Description',
      type: 'text',
      required: true
    },
    {
      field_id: 'overall_dimensions',
      label: 'Overall Dimensions',
      type: 'text',
      required: true
    },
    {
      field_id: 'primary_materials',
      label: 'Primary Materials',
      type: 'text',
      required: true
    },
    {
      field_id: 'finish',
      label: 'Finish',
      type: 'text',
      required: true
    },
    {
      field_id: 'special_requirements',
      label: 'Special Requirements',
      type: 'text',
      required: false
    }
  ],

  tasks: [
    { task_name: 'Design approval', order: 1 },
    { task_name: 'Custom task - TBD based on project', order: 2 },
    { task_name: 'Quality check', order: 3 },
    { task_name: 'Package for shipping', order: 4 }
  ],

  packingItems: [
    { item_name: 'Custom fabricated items', order: 1 },
    { item_name: 'Hardware as specified', order: 2 },
    { item_name: 'Installation instructions', order: 3 }
  ]
}
```

---

## Implementation Code

### Phase 1 Hard-coded Service

```typescript
// /backend/web/src/services/productTypeTemplateService.ts

import { ProductTypeTemplate, SpecificationField, TaskTemplate, PackingItem } from '../types/orders';

// Import all template definitions
import { channelLettersFrontLit } from './templates/channelLetters';
import { channelLettersBackLit } from './templates/channelLetters';
import { channelLettersCombination } from './templates/channelLetters';
import { dimensionalLettersFlat } from './templates/dimensionalLetters';
import { dimensionalLettersFabricated } from './templates/dimensionalLetters';
import { flatSignACM } from './templates/flatSigns';
import { flatSignHDUCarved } from './templates/flatSigns';
import { pylonSign } from './templates/pylonsMonuments';
import { monumentSign } from './templates/pylonsMonuments';
import { customFabrication } from './templates/custom';

class ProductTypeTemplateService {
  private templates: Map<string, ProductTypeTemplate>;

  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  private loadTemplates() {
    // Channel Letters
    this.templates.set('channel_letters_front_lit', channelLettersFrontLit);
    this.templates.set('channel_letters_back_lit', channelLettersBackLit);
    this.templates.set('channel_letters_combination', channelLettersCombination);

    // Dimensional Letters
    this.templates.set('dimensional_letters_flat', dimensionalLettersFlat);
    this.templates.set('dimensional_letters_fabricated', dimensionalLettersFabricated);

    // Flat Signs
    this.templates.set('flat_sign_acm', flatSignACM);
    this.templates.set('flat_sign_hdu_carved', flatSignHDUCarved);

    // Pylons & Monuments
    this.templates.set('pylon_sign', pylonSign);
    this.templates.set('monument_sign', monumentSign);

    // Custom
    this.templates.set('custom_fabrication', customFabrication);
  }

  getTemplate(productTypeId: string): ProductTypeTemplate | undefined {
    return this.templates.get(productTypeId);
  }

  getAllTemplates(): ProductTypeTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): ProductTypeTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(
      Array.from(this.templates.values()).map(t => t.category)
    );
    return Array.from(categories);
  }

  getTasksForProductType(productTypeId: string): TaskTemplate[] {
    const template = this.templates.get(productTypeId);
    return template ? template.tasks : [];
  }

  getPackingItemsForProductType(
    productTypeId: string,
    specifications?: any
  ): PackingItem[] {
    const template = this.templates.get(productTypeId);
    if (!template) return [];

    // Filter based on conditionals
    return template.packingItems.filter(item => {
      if (!item.conditional) return true;
      if (!specifications) return true;

      // Evaluate conditional (simple eval - enhance as needed)
      try {
        // This is a simplified example - use a proper expression evaluator
        return this.evaluateConditional(item.conditional, specifications);
      } catch (e) {
        console.warn('Failed to evaluate packing item conditional:', e);
        return true;
      }
    });
  }

  private evaluateConditional(conditional: string, specs: any): boolean {
    // Simple conditional evaluation
    // Examples: "led_count > 0", "finish === 'Painted'"

    // Extract field, operator, value
    const match = conditional.match(/(\w+)\s*([><=!]+)\s*(.+)/);
    if (!match) return true;

    const [, field, operator, value] = match;
    const fieldValue = specs[field];

    switch (operator) {
      case '>':
        return Number(fieldValue) > Number(value);
      case '<':
        return Number(fieldValue) < Number(value);
      case '>=':
        return Number(fieldValue) >= Number(value);
      case '<=':
        return Number(fieldValue) <= Number(value);
      case '===':
        return String(fieldValue) === value.replace(/['"]/g, '');
      case '!==':
        return String(fieldValue) !== value.replace(/['"]/g, '');
      default:
        return true;
    }
  }

  transformSpecificationsForCustomer(
    productTypeId: string,
    specifications: any
  ): any {
    const template = this.templates.get(productTypeId);
    if (!template) return specifications;

    const transformed = { ...specifications };

    template.specifications.forEach(spec => {
      if (spec.transform_for_customer && transformed[spec.field_id] !== undefined) {
        transformed[spec.field_id] = spec.transform_for_customer(transformed[spec.field_id]);
      }
    });

    return transformed;
  }

  getSpecificationLabels(productTypeId: string): Map<string, string> {
    const template = this.templates.get(productTypeId);
    if (!template) return new Map();

    const labels = new Map<string, string>();
    template.specifications.forEach(spec => {
      labels.set(spec.field_id, spec.label);
    });

    return labels;
  }
}

export const productTypeTemplateService = new ProductTypeTemplateService();
```

### Usage Example

```typescript
// When creating tasks for an order
import { productTypeTemplateService } from '../services/productTypeTemplateService';

async function generateTasksForOrderPart(orderId: number, partId: number, productTypeId: string) {
  const taskTemplates = productTypeTemplateService.getTasksForProductType(productTypeId);

  for (const template of taskTemplates) {
    await pool.execute(
      `INSERT INTO order_tasks (order_id, part_id, task_name, task_order)
       VALUES (?, ?, ?, ?)`,
      [orderId, partId, template.task_name, template.order]
    );
  }
}

// When generating packing list
async function getPackingListItems(partId: number) {
  const part = await getOrderPart(partId);
  const items = productTypeTemplateService.getPackingItemsForProductType(
    part.product_type_id,
    part.specifications
  );

  return items;
}
```

---

## Migration to Database (Phase 3)

### Future Database Schema

```sql
-- Phase 3: Product type templates in database
CREATE TABLE product_type_templates (
  template_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_type_id VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE product_type_specifications (
  spec_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  field_id VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  field_type ENUM('text', 'number', 'select', 'boolean') NOT NULL,
  unit VARCHAR(20),
  required BOOLEAN DEFAULT false,
  options JSON,  -- For select type
  display_order TINYINT UNSIGNED,
  show_on_customer_form BOOLEAN DEFAULT true,
  FOREIGN KEY (template_id) REFERENCES product_type_templates(template_id)
);

CREATE TABLE product_type_tasks (
  task_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  task_order TINYINT UNSIGNED NOT NULL,
  typical_duration INT UNSIGNED,  -- Minutes
  FOREIGN KEY (template_id) REFERENCES product_type_templates(template_id)
);

CREATE TABLE product_type_packing_items (
  item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_order TINYINT UNSIGNED NOT NULL,
  conditional VARCHAR(255),  -- Expression to evaluate
  FOREIGN KEY (template_id) REFERENCES product_type_templates(template_id)
);
```

---

**Document Status:** Phase 1 Hard-coded Templates
**Last Updated:** 2025-11-03
**Dependencies:** Nexus_Orders_JobStructure.md
**Migration Plan:** Phase 3 - Move to database with admin UI
