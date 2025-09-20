# 🎯 Validation Layer Architecture - Complete Specification

## Date: 2025-09-16

## 📋 Layer Position in Architecture Chain

This document covers the **Validation Layer** - the first future layer built on top of the Base Layer.

### Architecture Progression:
1. ✅ **Base Layer** - Core data structures, relationships, display, interaction (COMPLETE)
1a.❌ **Base Formatting Layer** - Colour coding mandatory input fields backgrounds/special fields. On row change like relationships calculations. (FUTURE)
2. 🔄 **Validation Layer** - Field validation, business rules, pricing logic, Assembly Validation (IN PROGRESS)
3. ❌ **Assembly Layer** - Dynamic assembly management, color assignments (FUTURE)
4. ❌ **Visual Styling Layer** - Conditional formatting, themes (FUTURE)
5. ❌ **Calculations Layer** - Pricing, totals, material calculations (FUTURE)

---

## 🏗️ Validation Layer Overview

### **Philosophy:**
> "Validation happens AFTER autosave, is debounced, and provides visual feedback without blocking user input"

### **Key Principles:**
- ✅ **Post-Autosave Trigger** - Validation runs after data is saved (500ms debounce)
- ✅ **Database-Driven Rules** - Validation rules stored in database, cached on load
- ✅ **Non-Blocking Visual Feedback** - Red borders for errors, orange for warnings
- ✅ **Incremental Updates** - Only validate changed rows + dependencies
- ✅ **Flexible Field Categories** - mandatory/sufficient/supplementary markers
- ✅ **Pricing Integration** - Controls estimate calculations and preview display

---

## 🗃️ Database Schema

### **Validation Rules Table:**
```sql
CREATE TABLE validation_rules (
  id INT PRIMARY KEY,
  function_name VARCHAR(50) NOT NULL, -- 'textsplit', 'float', 'required', etc.
  description TEXT,
  parameters_schema JSON -- Defines what parameters this rule accepts
);
```

### **Product Types Integration:**
```sql
-- Use existing product_types table validation_rules column. Can change name to validation_config
product_types.validation_rules

-- Example validation_config:
{
  "field1": {
    "function": "textsplit",
    "params": {"delimiter": "+", "parse_as": "float", "min": 0, "max": 99},
    "error_level": "error",
    "field_category": "mandatory",
    "error_message": "Enter numbers separated by + (0-99 each)"
  },
  "quantity": {
    "function": "float",
    "params": {"min": 0, "allow_negative": false},
    "error_level": "error",
    "field_category": "sufficient"
  },
  "price_adjustment": {
    "function": "float",
    "params": {"allow_negative": true},
    "error_level": "warning",
    "field_category": "supplementary"
  }
}
```

---

## 🔧 Field Categories & Business Logic

### **Field Categories:**
| Category | Purpose | Pricing Impact | Estimate Preview |
|----------|---------|----------------|------------------|
| `complete_set` | Fields that must be ALL filled together for pricing | Must be fully completed for pricing | Must be fully completed for preview |
| `sufficient` | Enough alone for basic pricing | Enables pricing | Enables preview |
| `supplementary` | Enhances pricing calculations | Optional for pricing | Hidden if alone |
| `context_dependent` | Category changes based on context/preferences | Dynamic based on context | Dynamic based on context |

### **Validation & Pricing Logic:**

#### **Validation Warnings/Errors:**
```
Empty Row: No validation, no warnings ✅
Row with Data: Apply field format validation ✅
Partial Complete Set: Show warnings for missing complete_set fields ✅
Context-Dependent: Apply dynamic validation based on customer preferences ✅
```

#### **Pricing Calculation Blocking:**
```
Block Pricing IF:
- Empty row (no fields filled)
- Invalid field input format
- Invalid field input range
- Partial complete_set completion

Allow Pricing IF:
- All complete_set fields complete
- OR at least one sufficient field filled
- OR only supplementary fields filled
- Context-dependent fields (based on calculation results)
```

#### **Estimate Preview Display:**
```
Show in Estimate Preview:
- Rows with all complete_set fields complete
- Rows with sufficient fields filled
- Special rows without need for input fields (subtotal, divider)

Hide from Estimate Preview:
- Empty rows
- Rows with partial complete_set completion
- Rows with only supplementary fields filled
```

---

## 📁 File Structure & Implementation Status

```
/core/validation/
├── ValidationEngine.ts                 🔄 UPDATE - Add context support, two-phase validation
├── ValidationResultsManager.ts         ✅ COMPLETE - Efficient result storage
│
├── templates/
│   ├── ValidationTemplate.ts           🔄 UPDATE - Add context parameter
│   ├── TextSplitTemplate.ts           ✅ COMPLETE - 1D/2D text parsing
│   ├── FloatTemplate.ts                🆕 NEW - Basic numeric validation
│   ├── RequiredTemplate.ts            🆕 NEW - Non-empty validation
│   ├── LedOverrideTemplate.ts         🆕 NEW - LED business logic with context
│   ├── PsOverrideTemplate.ts          🆕 NEW - Power supply override logic
│   ├── UlOverrideTemplate.ts          🆕 NEW - UL certification with currency
│   └── ValidationTemplateRegistry.ts   🔄 UPDATE - Register new templates
│
├── validators/
│   ├── CellValidator.ts                🔄 UPDATE - Pass context to templates
│   ├── RowValidator.ts                 🔄 UPDATE - Support context_dependent categories
│   └── StructureValidator.ts           ✅ COMPLETE - AssemblyAssigner integration
│
├── context/
│   ├── ValidationContextBuilder.ts     🆕 NEW - Build validation context with preferences
│   └── useCustomerPreferences.ts      🆕 NEW - React hook for customer preferences
│
├── business/
│   └── ProductSelector.ts              🆕 NEW - Product selection from validated data
│
└── cache/
    └── ValidationCache.ts              ❌ TODO - Rule caching system
```

---

## 🎯 Context-Aware Validation System

### **ValidationContext Interface:**
```typescript
interface ValidationContext {
  // Current row data
  rowData: Record<string, string>;

  // Customer preferences from customer_manufacturing_preferences table
  customerPreferences: {
    use_leds: boolean;
    default_led_type: string;
    requires_transformers: boolean;
    default_transformer: string;
    default_ul_requirement: boolean;
    // ... other preferences
  };

  // Grid-wide context (other rows affect validation)
  gridContext: {
    hasAnyUL: boolean;
    totalWattage: number;
    rowCount: number;
  };

  // Calculated values from Phase 1
  calculatedValues: {
    ledCount?: number;
    psCount?: number;
    totalInches?: number;
    totalWattage?: number;
  };
}
```

### **Two-Phase Validation Pipeline:**
```
Phase 1: Calculate Derived Values
├── Parse field1 & field2 (Channel Letters data)
├── Calculate LED count (based on data + field3 + customer prefs)
├── Calculate PS count (based on LED wattage)
└── Calculate total inches/wattage

Phase 2: Context-Aware Validation
├── Validate fields with calculated dependencies
├── Apply customer preference defaults
├── Determine product selections
└── Update UI with validation results
```

### **Override Template Pattern:**
```typescript
// All override templates follow this pattern:
// 1. Accept float, "yes", "no" (+ currency for UL)
// 2. Use context for default behavior
// 3. Return parsed value + business logic

class LedOverrideTemplate {
  async validate(value: string, params: any, context: ValidationContext) {
    // Syntax validation first
    const parsed = this.parseInput(value); // float/"yes"/"no"
    if (!parsed.isValid) return parsed;

    // Business logic with context
    const ledCount = this.calculateLedCount(parsed.value, context);
    return { isValid: true, parsedValue: parsed.value, calculatedValue: ledCount };
  }
}
```

---

## 🎯 TextSplit Template - Comprehensive Implementation

### **Supported Parameters:**
```typescript
interface TextSplitParams {
  // Delimiters
  delimiter: string;          // Primary delimiter (1st dimension)
  delimiter2?: string;        // Optional secondary delimiter (2D parsing)

  // Parsing
  parse_as: 'string' | 'float' | 'integer';

  // 1st Dimension Controls
  required_count?: number;    // Exactly N groups/items
  min_count?: number;         // Minimum N groups/items
  max_count?: number;         // Maximum N groups/items

  // 2nd Dimension Controls (for 2D parsing)
  required_count2?: number;   // Each group exactly N items
  min_count2?: number;        // Each group minimum N items
  max_count2?: number;        // Each group maximum N items

  // Value Controls (numeric parsing)
  min?: number;               // Minimum value
  max?: number;               // Maximum value

  // Behavior Controls
  allow_empty?: boolean;      // Allow empty values
  trim_whitespace?: boolean;  // Remove spaces (default: true)
}
```

### **Example Configurations:**
```typescript
// 1D Math Expression: "12 + 5 + 3"
{
  delimiter: "+",
  parse_as: "float",
  min_count: 2, max_count: 10,
  min: 0, max: 999
}

// 2D Dimensions: "12x8, 15x10, 20x12"
{
  delimiter: ",", delimiter2: "x",
  parse_as: "float",
  min_count: 1, max_count: 20,
  required_count2: 2,
  min: 0.1, max: 999.9
}

// Flexible Measurements: "width:12|height:8, depth:5"
{
  delimiter: ",", delimiter2: "|",
  parse_as: "string",
  min_count: 1,
  min_count2: 1, max_count2: 10
}
```

---

## 🔄 Integration Flow

### **Validation Trigger (Post-Autosave):**
```
User Input → GridEngine.updateSingleRow() → AutoSave (500ms debounce)
    ↓
AutoSave Completes → ValidationEngine.validateGrid() → Update UI
```

### **Validation Pipeline:**
```
1. CellValidator: Field format validation using templates
2. RowValidator: Completeness + pricing eligibility
3. StructureValidator: Business rules + assembly logic
4. ValidationResultsManager: Store results efficiently
5. UI Update: Apply red/orange borders, update estimate preview
```

### **Performance Optimizations:**
- ✅ **Incremental Validation** - Only changed rows + dependencies
- ✅ **Parallel Cell Validation** - Promise.all() for field validations
- ✅ **Efficient Result Storage** - Maps instead of React state
- ✅ **Template Caching** - Rules loaded once on startup
- ✅ **Debounced Execution** - Batch validation after autosave

---

## 🚀 Implementation Progress

### **Completed (✅)**
1. **Core Architecture** - ValidationEngine orchestrator with layered approach
2. **TextSplit Template** - Comprehensive 1D/2D text parsing with all parameters
3. **Field Categories** - complete_set/sufficient/supplementary system
4. **Row Validation Logic** - Pricing and estimate preview control
5. **Results Management** - Efficient validation result storage
6. **Cell Validation** - Template-based field validation

### **In Progress (🔄)**
1. **Context-Aware Validation** - Customer preferences integration
2. **Override Templates** - LED, PS, UL business logic templates
3. **Two-Phase Validation** - Calculate then validate workflow
4. **Product Selection Logic** - Separate validation from business rules
5. **Documentation Updates** - Updated field categories and architecture

### **Remaining TODO (❌)**
1. **ValidationCache** - Rule and product validation caching system
2. **GridEngine Integration** - Wire validation into post-autosave pipeline
3. **UI Visual Feedback** - Modify FieldCell components for red/orange borders
4. **Additional Templates** - email, phone, etc. (as needed per product)

---

## 🎯 Example Product Configuration

### **Product: "Aluminum Sign Panel"**
```json
{
  "validation_config": {
    "quantity": {
      "function": "float",
      "params": {"min": 1, "allow_negative": false},
      "error_level": "error",
      "field_category": "sufficient"
    },
    "dimensions": {
      "function": "textsplit",
      "params": {
        "delimiter": "x",
        "parse_as": "float",
        "required_count": 2,
        "min": 1, "max": 120
      },
      "error_level": "error",
      "field_category": "mandatory",
      "error_message": "Enter width x height (1-120 inches each)"
    },
    "material": {
      "function": "textsplit",
      "params": {
        "delimiter": ",",
        "parse_as": "string",
        "min_count": 1, "max_count": 3
      },
      "error_level": "error",
      "field_category": "mandatory"
    },
    "coating": {
      "function": "textsplit",
      "params": {
        "delimiter": ",",
        "parse_as": "string",
        "max_count": 2
      },
      "error_level": "warning",
      "field_category": "supplementary"
    },
    "rush_charge": {
      "function": "float",
      "params": {"allow_negative": false},
      "error_level": "warning",
      "field_category": "supplementary"
    }
  }
}
```

### **Row Examples & Behavior:**
```
[empty] → No validation, No pricing, No estimate ✅

[quantity: 5] → No warnings, Pricing ✅, Estimate ✅ (sufficient)

[dimensions: "12x8"] → Warning (partial mandatory), No pricing, No estimate

[quantity: 5, dimensions: "12x8", material: "aluminum"] → No warnings, Pricing ✅, Estimate ✅ (complete)

[coating: "powder coat"] → Warning (supplementary only), Pricing ✅, No estimate

[dimensions: "12x8x3"] → Error (expects 2 dimensions), No pricing, No estimate
```

---

## 🔮 Future Extensions

### **Additional Templates (As Needed):**
- `float` - Simple numeric validation
- `required` - Non-empty field validation
- `email` - Email format validation
- `phone` - Phone number validation
- `currency` - Money format validation
- `dimensions` - Specialized dimension parsing
- `color_code` - Hex/named color validation

### **Advanced Features:**
- **Conditional Validation** - Rules that depend on other field values
- **Cross-Row Validation** - Assembly-level business rules
- **Dynamic Rule Loading** - Real-time rule updates without restart
- **Validation History** - Track validation changes over time
- **Performance Analytics** - Validation timing and optimization metrics

---

## 📝 Next Implementation Steps

1. **Complete StructureValidator** - Implement hardcoded business rules
2. **Build ValidationCache** - Efficient rule and config caching
3. **GridEngine Integration** - Wire into existing autosave pipeline
4. **UI Integration** - Add visual feedback to FieldCell components
5. **Testing** - Unit tests for templates and edge cases
6. **Performance Optimization** - Profile and optimize validation speed

This validation layer provides a robust, flexible foundation for complex business rule validation while maintaining excellent performance and user experience.