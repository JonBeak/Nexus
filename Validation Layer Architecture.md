# Channel Letters Validation Layer Architecture

## Overview

The validation system is a sophisticated multi-layer architecture that provides real-time, context-aware validation for the job estimation grid. It operates on a two-phase validation pipeline with database-driven configuration and template-based extensibility.

## Layer 1: Database Configuration Layer

### Storage Structure

```sql
-- product_types table
CREATE TABLE product_types (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  field_prompts JSON,        -- Field labels and UI configuration
  static_options JSON,       -- Dropdown options and static data
  validation_rules JSON      -- Validation configuration per field
);
```

### Validation Rules Schema

```json
{
  "field1": {
    "function": "non_empty",          // Template alias for required
    "error_level": "warning",
    "field_category": "complete_set",
    "products_affected": ["channel_letters"]
  },
  "field2": {
    "function": "float_or_groups",
    "params": {
      "group_separator": "..... ",
      "number_separator": ",",
      "allow_negative": false,
      "min_value": 0
    },
    "error_level": "error",
    "field_category": "complete_set",
    "products_affected": ["channel_letters", "leds", "power_supplies", "extra_wire"]
  }
}
```

### Current Channel Letters Configuration

- field1: non_empty - Letter type selection (warning-level guidance)
- field2: float_or_groups - Supports the new grouped `widths..... heights` format or numeric totals
- field3: led_override - LED count with context-aware overrides
- field4: ul_override - UL requirements
- field5: float - Pin count
- field6: float - Extra wire length
- field8: led_type - LED type selection gated by LEDs present
- field9: ps_override - Power supply count
- field10: ps_type - PS type selection tied to PS availability

All channel-letter defaults now live in `defaultValidationConfigs.ts`, giving us a frontend-controlled safety net whenever the API omits validation rules.

---

## Layer 2: Backend API Layer

### Template Service (dynamicTemplateService.ts)

```typescript
async getAllFieldPrompts(): Promise<Record<number, SimpleProductTemplate>> {
  // 1. Query database for all product types
  const [rows] = await pool.execute(
    'SELECT id, field_prompts, static_options, validation_rules FROM product_types'
  );

  // 2. Process dynamic dropdown options
  // 3. Build complete template objects
  // 4. Return structured data
}
```

### API Endpoint

```json
// GET /api/job-estimation/templates/all
{
  "success": true,
  "data": {
    "1": {  // Channel Letters
      "field_prompts": { "field1": "Letter Type", ... },
      "static_options": { "field8": ["Standard LED", "RGB LED"], ... },
      "validation_rules": { "field1": { "function": "required" }, ... }
    }
  }
}
```

---

## Layer 3: Frontend Validation Engine

### GridJobBuilderRefactored.tsx (Configuration Layer)

```typescript
// 1. Load templates from API
const allTemplates = await fieldPromptsApi.getAllTemplates();

// 2. Extract validation rules
const validationConfigs = new Map<number, Record<string, unknown>>();
Object.entries(allTemplates).forEach(([productTypeId, template]) => {
  if (template.validation_rules && Object.keys(template.validation_rules).length > 0) {
    validationConfigs.set(parseInt(productTypeId), template.validation_rules);
  }
});

// 3. Merge in frontend defaults (Channel Letters baseline) and configure engine
const finalValidationConfigs = applyDefaultValidationConfigs(validationConfigs);
gridEngine.updateValidationConfig(finalValidationConfigs);
```

### GridEngine.ts (Orchestration Layer)

```typescript
class GridEngine {
  private validationEngine: ValidationEngine;

  // Triggers validation after any data change
  private recalculateAllLayers() {
    // ... layer calculations ...

    // Trigger validation (debounced to prevent excessive calls)
    if (this.validationEngine) {
      this.triggerValidationDebounced(); // 150ms debounce
    }
  }
}
```

---

## Layer 4: Validation Engine Core

### ValidationEngine.ts (Two-Phase Pipeline)

```typescript
async validateGrid(rows: GridRowCore[]): Promise<void> {
  // PHASE 1: Calculate derived values
  const calculatedValues = await this.calculateDerivedValues(rows, customerPreferences);
  // Example: LED count, PS count, total wattage, perimeter

  // PHASE 2: Context-aware validation
  const contexts = this.buildValidationContext(rows, customerPreferences, calculatedValues);

  // Execute validation layers
  await this.validateCells(rows, contexts);      // Field-level validation
  await this.validateRows(rows, contexts);       // Row completeness
  await this.validateStructure(rows, contexts);  // Grid-wide rules
}
```

### Phase 1: Derived Value Calculation

```typescript
// Channel Letters specific calculations
if (row.productTypeId === 1) {
  const metrics = calculateChannelLetterMetrics(row.data.field2);
  rowCalculations.channelLetterMetrics = metrics;
  rowCalculations.ledCount = this.calculateLedCount(row, customerPreferences, metrics);
  rowCalculations.totalInches = metrics?.totalWidth || 0;
  rowCalculations.totalWattage = this.calculateTotalWattage(rowCalculations.ledCount);
  rowCalculations.psCount = this.calculatePsCount(rowCalculations.ledCount, rowCalculations.totalWattage);
}
```

> **Note:** `calculateChannelLetterMetrics` currently returns placeholder totals while we finish the grouped-format math. The structure is already plumbed through the validation context so we can drop in the final calculations without further refactors.
```

### Phase 2: Context Building

```typescript
const context: ValidationContext = {
  rowData: row.data,
  customerPreferences: {
    use_leds: false,
    default_led_type: 'Standard LED',
    requires_transformers: false,
    default_ul_requirement: false
  },
  gridContext: {
    hasAnyUL: this.hasAnyUL(allRows),
    totalWattage: this.getTotalWattage(allRows),
    rowCount: allRows.length
  },
  calculatedValues: rowCalculations
};
```

---

## Layer 5: Validation Templates

### Template Architecture

```typescript
interface ValidationTemplate {
  validate(value: string, params: Record<string, unknown>, context?: ValidationContext): Promise<ValidationResult>;
  getDescription(): string;
  getParameterSchema(): Record<string, unknown>;
}
```

### Template Registry (ValidationTemplateRegistry.ts)

```typescript
class ValidationTemplateRegistry {
  constructor() {
    // Basic templates
    this.registerTemplate('required', new RequiredTemplate());
    this.registerTemplate('float', new FloatTemplate());
    this.registerTemplate('textsplit', new TextSplitTemplate());

    // Context-aware templates
    this.registerTemplate('led_override', new LedOverrideTemplate());
    this.registerTemplate('ps_override', new PsOverrideTemplate());
    this.registerTemplate('ul_override', new UlOverrideTemplate());

    // Specialized templates
    this.registerTemplate('float_or_groups', new FloatOrGroupsTemplate());
  }
}
```

### Template Examples

#### TextSplitTemplate (Dimensions)

```typescript
// Validates "12x8,15x10" format
validate("12x8,15x10", {
  delimiter: ",",      // Split groups
  delimiter2: "x",     // Split dimensions
  parse_as: "float",   // Parse as numbers
  required_count2: 2   // Require width x height
})
```

#### LedOverrideTemplate (Context-Aware)

```typescript
// Validates LED count with business logic
validate("yes", { accepts: ["float", "yes", "no"] }, context) {
  if (value === "yes") {
    // Calculate from channel letter dimensions
    return this.calculateLedsFromChannelLetters(context);
  }
}
```

---

## Layer 6: Validation Results Management

### ValidationResultsManager.ts

```typescript
class ValidationResultsManager {
  private cellErrors = new Map<string, CellValidationError>();
  private cellWarnings = new Map<string, CellValidationWarning>();
  private structureErrors = new Map<string, StructureValidationError>();

  setCellError(rowId: string, fieldName: string, error: CellValidationError): void {
    const key = `${rowId}.${fieldName}`;
    this.cellErrors.set(key, error);
  }

  getValidationSummary(): ValidationSummary {
    return {
      errorCount: this.cellErrors.size,
      warningCount: this.cellWarnings.size,
      hasErrors: this.cellErrors.size > 0
    };
  }
}
```

---

## Layer 7: UI Feedback Layer

### Visual Indicators

```typescript
// Red borders for errors
className={`border ${hasError ? 'border-red-500' : 'border-gray-300'}`}

// Error tooltips
{hasError && (
  <div className="absolute bg-red-100 border border-red-300 rounded p-2">
    {error.message}
    <div className="text-xs text-gray-600">{error.expectedFormat}</div>
  </div>
)}
```

### Validation Summary

```typescript
// Shows total error count in EstimateTable
<div className="text-red-600">
  {errorCount} validation {errorCount === 1 ? 'error' : 'errors'}
</div>
```

---

## Data Flow Diagram

```
Database (validation_rules)
    ↓
Backend API (/templates/all)
    ↓
Frontend Template Loading
    ↓
GridEngine Configuration
    ↓
User Input → Grid Change
    ↓
ValidationEngine.validateGrid()
    ↓
Phase 1: Calculate Values → Phase 2: Validate with Context
    ↓
Template.validate() → ValidationResult
    ↓
ValidationResultsManager → Store Results
    ↓
UI → Red Borders + Tooltips
```

---

## Key Features

### 🔄 Real-Time Validation

- Triggers on every field change (debounced)
- Updates immediately with visual feedback
- No blocking - validation is informational only

### 📊 Context-Aware Logic

- LED count affects PS validation
- Customer preferences influence defaults
- Grid-wide state (UL requirements) affects individual fields

### 🎯 Template Extensibility

- New validation types via template registration
- Database-driven configuration
- Reusable validation logic across products

### ⚡ Performance Optimized

- Validation debouncing (150ms)
- Efficient result caching
- Minimal re-computation

### 🏗️ Separation of Concerns

- Database: Configuration storage
- Backend: Template serving
- ValidationEngine: Business logic
- Templates: Reusable validation rules
- UI: Visual feedback only

This architecture provides a scalable, maintainable, and extensible validation system that can handle complex business rules while maintaining excellent performance and user experience.
