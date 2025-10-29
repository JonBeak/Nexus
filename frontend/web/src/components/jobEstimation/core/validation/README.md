# Job Estimation Validation System

Comprehensive validation framework for job estimation forms with support for multiple input types, custom validation rules, and dynamic field dependencies.

## Architecture

```
validation/
├── templates/                    # Validation template implementations (18 total)
│   ├── BaseValidationTemplate.ts   # Abstract base class with shared functionality
│   ├── FloatTemplate.ts            # Float number validation
│   ├── RequiredTemplate.ts         # Required text field validation
│   ├── TwoDimensionsTemplate.ts    # 2D dimensions (WxH)
│   ├── ThreeDimensionsTemplate.ts  # 3D dimensions (WxHxD)
│   ├── FloatOrDimensionsTemplate.ts # Float OR dimensions
│   ├── ConditionalDimensionsTemplate.ts # 2D or 3D based on context
│   ├── FloatOrGroupsTemplate.ts    # Complex grouped format
│   ├── FloatOrFormulaTemplate.ts   # Float OR channel letter formula
│   ├── TextSplitTemplate.ts        # Delimited text parsing
│   ├── OptionalTextTemplate.ts     # Optional text field
│   ├── MultiplierTemplate.ts       # Multiplier field validation
│   ├── LedOverrideTemplate.ts      # LED override with redundancy check
│   ├── PsOverrideTemplate.ts       # Power supply override with calculation
│   ├── UlOverrideTemplate.ts       # UL override with format validation
│   └── ValidationTemplate.ts       # Core interfaces and type definitions
├── validators/                    # Higher-level validation orchestration
│   └── RowValidator.ts            # Row-level validation logic
├── utils/                         # Validation utilities
│   ├── numericValidation.ts       # Numeric input parsing and validation
│   └── channelLetterParser.ts     # Channel letter formula parsing
├── context/                       # Validation context management
│   ├── ValidationContextBuilder.ts # Builds validation context from database
│   └── useCustomerPreferences.ts   # Customer preference loading
├── ValidationEngine.ts            # Main validation orchestration engine
└── ValidationResultsManager.ts    # Validation result storage and queries
```

## Core Concepts

### ValidationTemplate Interface

All validation templates implement this interface:

```typescript
interface ValidationTemplate {
  validate(
    value: string,
    params?: Record<string, unknown>,
    context?: ValidationContext
  ): Promise<ValidationResult>;

  getDescription(): string;
  getParameterSchema(): Record<string, unknown>;
}
```

### ValidationResult

All validations return a `ValidationResult`:

```typescript
interface ValidationResult {
  isValid: boolean;
  parsedValue?: unknown;        // Typed parsed value (number, object, etc.)
  error?: string;               // User-friendly error message
  expectedFormat?: string;      // What format was expected
  calculatedValue?: unknown;    // Additional calculated value (e.g., wattage)
}
```

### BaseValidationTemplate

Abstract base class providing common functionality to eliminate code duplication:

**Helper Methods:**
- `wrapValidation()` - Try-catch wrapper with consistent error handling
- `createError()` - Standardized error response format
- `createSuccess()` - Standardized success response format
- `handleEmptyValue()` - Consistent empty value handling

**Refactoring Impact:**
- Phases 1-4: Eliminated 473 lines of duplicated code (14.6% reduction)
- All 18 templates refactored to use shared base functionality
- Zero breaking changes, all functionality preserved

## Validation Templates

| Template | Purpose | Valid Examples | Invalid Examples |
|----------|---------|----------------|------------------|
| **FloatTemplate** | Single float number | "15.5", "100", "-23.4" | "abc", "1e5" (scientific) |
| **RequiredTemplate** | Required text field | "ABC123", "Hello" | "" (empty) |
| **TwoDimensionsTemplate** | Width x Height | "48x24", "12.5 x 8" | "48", "48x24x6" |
| **ThreeDimensionsTemplate** | Width x Height x Depth | "48x24x6", "12 x 8 x 2" | "48x24" |
| **FloatOrDimensionsTemplate** | Float OR 2D/3D | "32", "48x24", "48x24x6" | "abc", "48xx24" |
| **ConditionalDimensionsTemplate** | 2D or 3D based on context | "48x24" (flat), "48x24x6" (can) | Wrong dimension count for type |
| **FloatOrGroupsTemplate** | Complex grouped format | "10, 8, 6", "10,. . . . . 6," | Invalid group structure |
| **FloatOrFormulaTemplate** | Float OR channel letter formula | "150", "12 letters @ 6' tall" | Invalid formula syntax |
| **TextSplitTemplate** | Delimited text parsing | "red,blue,green" | Depends on config |
| **OptionalTextTemplate** | Optional text | "any text", "" (empty ok) | Never invalid |
| **MultiplierTemplate** | Positive multiplier | "2", "1.5", "3.25" | "0", "-1", "abc" |
| **LedOverrideTemplate** | LED type override | "Type A", "no" | Redundant with customer pref |
| **PsOverrideTemplate** | Power supply override | "350W", "no", "1 @ 350W" | Invalid wattage |
| **UlOverrideTemplate** | UL override | "yes", "no", "$150", "75" | Redundant with customer pref |

## Creating a New Template

### Step 1: Extend BaseValidationTemplate

```typescript
import { ValidationResult, ValidationContext } from './ValidationTemplate';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class MyCustomTemplate extends BaseValidationTemplate {
  // Implement required methods...
}
```

### Step 2: Implement validate() Method

Use `wrapValidation()` for consistent error handling:

```typescript
async validate(
  value: string,
  params: Record<string, unknown> = {},
  context?: ValidationContext
): Promise<ValidationResult> {
  return this.wrapValidation(params, async () => {
    // Handle empty values
    if (!value || value.trim() === '') {
      return this.createError('Value is required', params);
    }

    // Your validation logic here
    const cleanValue = value.trim();

    // Example: validate numeric input
    if (isNaN(Number(cleanValue))) {
      return this.createError('Must be a number', params);
    }

    const parsedValue = Number(cleanValue);
    return this.createSuccess(parsedValue, parsedValue, params);
  });
}
```

### Step 3: Implement generateExpectedFormat()

```typescript
protected generateExpectedFormat(params?: Record<string, unknown>): string {
  return 'Expected format: positive number';
}
```

### Step 4: Implement getDescription() and getParameterSchema()

```typescript
getDescription(): string {
  return 'Validates positive numeric values';
}

getParameterSchema(): Record<string, unknown> {
  return {
    min_value: {
      type: 'number',
      required: false,
      description: 'Minimum allowed value',
      default: 0
    },
    max_value: {
      type: 'number',
      required: false,
      description: 'Maximum allowed value'
    }
  };
}
```

## Validation Context

The `ValidationContext` provides runtime information needed for context-aware validation:

```typescript
interface ValidationContext {
  productTypeId?: number;           // Current product type being validated
  customerPreferences?: {           // Customer-specific preferences
    pref_led_type?: string;
    pref_ul_required?: boolean;
    // ... other preferences
  };
  ledWattage?: number;              // Calculated LED wattage per foot
  formData?: Record<string, string>; // Other field values for dependencies
  // ... additional context
}
```

**Use Cases:**
- **ConditionalDimensionsTemplate**: Checks product type to determine 2D vs 3D validation
- **LedOverrideTemplate**: Checks customer preference to detect redundant values
- **PsOverrideTemplate**: Uses LED wattage to calculate required power supply
- **FloatOrFormulaTemplate**: Uses product context for formula parsing

## Validation Engine

The `ValidationEngine` orchestrates validation across the entire grid:

```typescript
import { ValidationEngine } from './ValidationEngine';

const engine = new ValidationEngine();

// Validate a single cell
const result = await engine.validateCell(
  fieldDefinition,
  '48x24',
  validationContext
);

// Validate entire row
const rowResults = await engine.validateRow(
  rowData,
  fieldDefinitions,
  validationContext
);

// Validate all cells in grid
const allResults = await engine.validateCells(
  gridData,
  fieldDefinitions,
  validationContext
);
```

## Validation Results Manager

The `ValidationResultsManager` stores and queries validation results:

```typescript
import { ValidationResultsManager } from './ValidationResultsManager';

const manager = new ValidationResultsManager();

// Store validation result
manager.setValidationResult('row-0', 'field-1', validationResult);

// Query results
const result = manager.getValidationResult('row-0', 'field-1');
const hasErrors = manager.hasValidationErrors('row-0');
const allErrors = manager.getAllValidationErrors();

// Clear results
manager.clearRowResults('row-0');
manager.clearAll();
```

## Error Messages

All validation templates provide user-friendly error messages:

**Good Error Messages:**
- ✅ "Expected format: WxH (e.g., 48x24)"
- ✅ "Value 150 exceeds maximum 100"
- ✅ "Redundant: 'yes' matches customer UL preference"

**Bad Error Messages:**
- ❌ "Invalid input"
- ❌ "Validation failed"
- ❌ "Error"

## Testing Validation

### Manual Testing

```typescript
import { FloatTemplate } from './templates/FloatTemplate';

const template = new FloatTemplate();

// Test valid input
const result1 = await template.validate('15.5', { min: 0, max: 100 });
// result1.isValid === true, result1.parsedValue === 15.5

// Test invalid input
const result2 = await template.validate('abc', { min: 0, max: 100 });
// result2.isValid === false, result2.error === "..."
```

### Integration Testing

Test with ValidationEngine for full context:

```typescript
const engine = new ValidationEngine();
const context = await buildValidationContext(customerId, productTypeId);
const result = await engine.validateCell(fieldDef, value, context);
```

## Performance Considerations

- **Validation is asynchronous**: All templates return `Promise<ValidationResult>`
- **Context building is cached**: Customer preferences and LED data cached per session
- **Validation is incremental**: Only changed cells are re-validated
- **Results are memoized**: ValidationResultsManager prevents duplicate validations

## Refactoring History

### Phase 1-4: Template Consolidation (2025-01)
- **Goal**: Eliminate code duplication across 18 validation templates
- **Approach**: Create BaseValidationTemplate with shared helper methods
- **Result**:
  - Removed 473 lines of duplicated code (14.6% reduction)
  - All templates now follow consistent patterns
  - Zero breaking changes, all functionality preserved
  - Improved maintainability and testability

### Helper Methods Introduced:
1. `wrapValidation()` - Consistent try-catch error handling
2. `createError()` - Standardized error response format
3. `createSuccess()` - Standardized success response format
4. `handleEmptyValue()` - Uniform empty value handling

## Common Patterns

### Pattern 1: Required Field with Range Validation

```typescript
async validate(value: string, params: FloatParams = {}): Promise<ValidationResult> {
  return this.wrapValidation(params, async () => {
    if (!value?.trim()) {
      return this.createError('Value is required', params);
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return this.createError('Must be a valid number', params);
    }

    if (params.min !== undefined && numValue < params.min) {
      return this.createError(`Value ${numValue} is below minimum ${params.min}`, params);
    }

    if (params.max !== undefined && numValue > params.max) {
      return this.createError(`Value ${numValue} exceeds maximum ${params.max}`, params);
    }

    return this.createSuccess(numValue, numValue, params);
  });
}
```

### Pattern 2: Optional Field with Default

```typescript
async validate(value: string, params: Record<string, unknown> = {}): Promise<ValidationResult> {
  return this.wrapValidation(params, async () => {
    if (!value?.trim()) {
      // Empty is valid, return default or undefined
      return this.handleEmptyValue(undefined, params);
    }

    // Validation logic for non-empty values
    const parsedValue = parseValue(value);
    return this.createSuccess(parsedValue, parsedValue, params);
  });
}
```

### Pattern 3: Context-Aware Validation

```typescript
async validate(
  value: string,
  params: Record<string, unknown> = {},
  context?: ValidationContext
): Promise<ValidationResult> {
  return this.wrapValidation(params, async () => {
    // Use context to inform validation
    if (context?.productTypeId === 1) {
      // Flat letters validation
      return this.validateFlatFormat(value, params);
    } else {
      // Can letters validation
      return this.validateCanFormat(value, params);
    }
  });
}
```

## Future Enhancements

Potential improvements for future phases:

1. **i18n Support**: Add internationalization for error messages
2. **Advanced Formula Parsing**: Support operator precedence in channel letter formulas
3. **Performance Caching**: Cache parsed dimension results for repeated validations
4. **Metric Unit Support**: Add support for metric measurements (requires product decision)
5. **Fuzzing Tests**: Add comprehensive fuzzing tests for formula parser
6. **Async Validation**: Support async data fetching in validation (e.g., check inventory)
7. **Custom Validators**: Allow product-specific custom validation plugins

## Documentation Notes

- **NOTE comments**: Two NOTE comments exist documenting business rules:
  1. `UlOverrideTemplate.ts:3` - Documents 0/$0 auto-conversion to "no"
  2. `RowValidator.ts:59` - Explains field dependency validation location

These are intentional documentation comments providing valuable context for future developers.

## Support

For questions or issues with the validation system:
1. Check this README for common patterns
2. Examine existing templates for examples
3. Review ValidationEngine.ts for orchestration logic
4. Consult BaseValidationTemplate for available helper methods

---

**Last Updated**: 2025-01 (Phase 5 - Technical Debt Cleanup)
**Maintainer**: SignHouse Development Team
**Related Documentation**: See `/home/jon/Nexus/Nexus_JobEstimation.md` for full system documentation
