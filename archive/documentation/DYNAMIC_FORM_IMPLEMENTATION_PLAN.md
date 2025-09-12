# Dynamic Product Form Implementation Plan

## Overview
The DynamicProductForm system generates user interfaces dynamically from JSON `input_template` data stored in product types, with customer preference auto-population and override capabilities.

## UI Design Principles

### Excel-Like Interface Requirements:
- **Function over form** - Clean, minimal interface with no fancy colors or visual flourishes
- **Keyboard-first navigation** - Proper tab order through all fields for fast data entry
- **Smart dropdowns** - Autocomplete with tab-to-select first option functionality
- **Grid-like layout** - Clean rows/columns resembling spreadsheet cells
- **Minimal styling** - Standard form controls, clean typography, generous whitespace
- **Fast workflow** - Optimized for users who need to create estimates quickly

### Field Styling Standards:
- Standard HTML form controls (no custom styled components)
- Consistent field heights and spacing
- Clear labels positioned for easy scanning
- Subtle visual indicators for auto-populated vs overridden fields
- Clean borders and standard focus states
- Monospace fonts for numeric inputs

### Keyboard Navigation Requirements:
- Tab moves to next field in logical order
- Shift+Tab moves to previous field
- Enter submits form or moves to next row
- Escape cancels current operation
- Arrow keys navigate within dropdowns
- Tab selects highlighted dropdown option

## Current Database Structure Analysis

### Product Type Input Template Format:
```json
{
  "fields": [
    {
      "name": "letter_data",
      "type": "textarea", 
      "label": "Letter Analysis Data",
      "required": true
    },
    {
      "name": "return_depth",
      "type": "select",
      "label": "Return Depth", 
      "options": ["3in", "4in", "5in"],
      "required": true
    },
    {
      "name": "face_material",
      "type": "select",
      "label": "Face Material",
      "options": ["White Polycarbonate", "Clear Polycarbonate", "Opal Acrylic"],
      "required": true
    }
  ]
}
```

### Customer Preference Integration:
From existing customer preference system:
- LED types (led_types table)
- Power supply types (power_supply_types table) 
- Customer-specific material preferences
- Default configurations per customer

## Component Architecture Plan

### 1. Core Components Structure
```
DynamicProductForm.tsx (main form container)
├── FormFieldRenderer.tsx (renders individual fields)
├── CustomerPreferencesLoader.tsx (loads and applies customer defaults)
├── FormValidation.ts (validation utilities)
└── PriceCalculator.tsx (pricing integration)
```

### 2. Component Responsibilities

#### **DynamicProductForm.tsx**
- Parse input_template JSON from product type
- Manage form state for all fields
- Handle customer preference auto-population
- Coordinate with pricing calculator
- Submit final item data to parent component

#### **FormFieldRenderer.tsx** 
- Render different field types based on JSON specification
- Handle field-specific validation
- Support override indicators (show when customer default is overridden)
- Manage field-level state and events

#### **CustomerPreferencesLoader.tsx**
- Load customer preferences on mount
- Map preferences to form fields
- Handle preference override functionality
- Provide visual indicators for auto-populated vs manually set fields

## Field Type Support Plan

### Phase 1 - Basic Field Types:
- **text**: Simple text input
- **textarea**: Multi-line text (for letter data analysis)
- **select**: Dropdown with predefined options
- **number**: Numeric input with validation

### Phase 2 - Enhanced Field Types:
- **multiselect**: Multiple selection (for complex specifications)
- **conditional**: Fields that show/hide based on other field values
- **file**: File upload for drawings/references
- **calculated**: Fields that auto-calculate based on other inputs

### Field Configuration Schema:
```json
{
  "name": "field_identifier",
  "type": "text|textarea|select|number|multiselect|conditional|file|calculated",
  "label": "Display Label",
  "required": true|false,
  "placeholder": "Optional placeholder text",
  "options": ["array", "of", "options"], // for select/multiselect
  "validation": {
    "min": 0,
    "max": 100,
    "pattern": "regex_pattern"
  },
  "default_value": "default if not from customer preference",
  "customer_preference_key": "led_type", // maps to customer preference
  "conditional_display": {
    "show_when": {"other_field": "specific_value"}
  },
  "calculation": {
    "formula": "field1 * field2",
    "depends_on": ["field1", "field2"]
  }
}
```

## Customer Preference Integration Design

### 1. Preference Mapping System
Create mapping between customer preference types and form fields:
```json
{
  "preference_mappings": {
    "led_type": {
      "customer_table": "customer_led_preferences", 
      "field_name": "led_type",
      "applicable_fields": ["led_specification", "led_color"]
    },
    "power_supply_type": {
      "customer_table": "customer_power_supply_preferences",
      "field_name": "power_supply_type", 
      "applicable_fields": ["power_supply"]
    }
  }
}
```

### 2. Auto-Population Logic
1. **On Form Load**:
   - Check if customer is selected
   - Load customer preferences from database
   - Apply preferences to matching form fields
   - Mark fields as "auto-populated"

2. **On Customer Change**:
   - Re-load preferences for new customer
   - Update form fields (only if not manually overridden)
   - Maintain user-entered values where appropriate

3. **Override Handling**:
   - Track which fields have been manually modified
   - Provide subtle visual indicators (small dot or text indicator)
   - Allow "reset to customer default" functionality

## Implementation Steps

### Step 1: Basic Form Rendering System
**Files to Create:**
```
/frontend/web/src/components/jobEstimation/
├── DynamicProductForm.tsx
├── FormFieldRenderer.tsx
├── hooks/
│   ├── useFormState.ts
│   └── useCustomerPreferences.ts
└── utils/
    ├── formValidation.ts
    └── fieldTypeUtils.ts
```

**DynamicProductForm Interface:**
```typescript
interface DynamicProductFormProps {
  productType: ProductType;
  selectedCustomer: Customer | null;
  initialData?: any; // for editing existing items
  onSubmit: (itemData: ItemFormData) => void;
  onCancel: () => void;
}

interface ItemFormData {
  product_type_id: number;
  item_name: string;
  input_data: Record<string, any>;
  customer_preferences_applied: string[];
  manual_overrides: string[];
}
```

### Step 2: Customer Preference Integration
**Backend API Extension:**
```typescript
// GET /api/customers/:id/preferences-for-product/:productTypeId
interface CustomerPreferences {
  led_type?: string;
  power_supply_type?: string;
  material_preferences?: Record<string, any>;
  default_specifications?: Record<string, any>;
}
```

**Frontend Integration:**
- Load preferences on customer/product selection
- Apply to form fields with subtle indicators
- Track override state for each field

### Step 3: Form Validation System
**Validation Rules:**
- Required field validation
- Type-specific validation (number ranges, text patterns)
- Cross-field validation (conditional requirements)
- Customer preference consistency warnings

### Step 4: Integration with JobBuilder
**JobBuilder.tsx Modifications:**
- Replace placeholder `handleAddItem` function
- Integrate DynamicProductForm into product type selector flow
- Handle form submission and item creation
- Update UI state with new items

## Data Flow Architecture

### 1. Form Initialization Flow:
```
1. User selects product type from ProductTypeSelector
2. DynamicProductForm loads input_template JSON
3. CustomerPreferencesLoader fetches customer defaults
4. Form fields render with auto-populated values
5. User modifies fields as needed
6. Form validates on submit
7. ItemData passed back to JobBuilder
8. JobBuilder calls backend API to create item
```

### 2. State Management:
```typescript
interface FormState {
  formData: Record<string, any>;
  customerDefaults: Record<string, any>;
  overriddenFields: Set<string>;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;
}
```

### 3. Backend Integration:
- Validate input_data against input_template schema
- Store customer preference override tracking
- Apply basic pricing calculations
- Return created item with calculated prices

## Performance Considerations

### Optimization Strategies:
- Lazy load customer preferences only when needed
- Debounce validation to avoid excessive API calls
- Memoize expensive form calculations
- Cache product type templates
- Minimize re-renders during rapid data entry

### Loading States:
- Simple loading text (no animated spinners)
- Disable form submission during validation
- Clear status messages for user feedback

## Implementation Priority
Start with Step 1 - Basic Form Rendering System to establish the foundation for dynamic form generation and integration with the existing JobBuilder component.