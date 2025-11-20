# Order Specification Validation Rules

**Status:** ✅ Implemented
**Last Updated:** 2025-11-20
**Service:** `/backend/web/src/services/orderValidationService.ts`
**Used By:** PrepareOrderModal → ValidationStep (Step 1)

---

## Overview

The Order Specification Validation System ensures all order parts have complete and valid specifications before order preparation. This is a critical quality gate that blocks progression to QuickBooks estimate creation, PDF generation, and task creation if validation fails.

### Key Features

- **25 specification templates** with comprehensive validation rules
- **Conditional validation** (fields required based on other field values)
- **OR logic support** (at least one of multiple fields required)
- **Boolean field validation** (true/false values, not just presence)
- **Clear error messages** with part number, template name, and missing fields
- **Auto-runs** when PrepareOrderModal opens

---

## Validation Architecture

### Validation Types

1. **Simple Required Fields** - Field must have a non-empty value
2. **Conditional Required Fields** - Field required only when condition is met
3. **OR Fields** - At least one field from a group must have a value
4. **Boolean Fields** - Field must exist with a boolean value (true or false)

### Error Display

When validation fails, errors are displayed in the PrepareOrderModal:

```
Found 3 validation errors
  Part 1 - Return: Return specification requires both depth and colour. Missing: depth
  Part 1 - LEDs: LEDs specification requires count and LED type. Missing: led_type
  Part 2 - Drain Holes: Drain Holes size is required when include is set to yes

Please fix these issues in the order details before proceeding with preparation.
```

---

## Validation Rules by Category

### Construction Specs

#### 1. Face
**Required Fields:** `material` + `colour`
**Error Message:** "Face specification requires both material and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "material": "3mm PC", "colour": "White" }

// ✗ Invalid - Missing colour
{ "material": "3mm PC" }
```

#### 2. Back
**Required Fields:** `material`
**Error Message:** "Back specification requires material"

**Examples:**
```json
// ✓ Valid
{ "material": "2mm ACM" }

// ✗ Invalid - Empty material
{ "material": "" }
```

#### 3. Material (Substrate Cut)
**Required Fields:** `substrate` + `colour`
**Error Message:** "Material specification requires both substrate and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "substrate": "3mm ACM", "colour": "Matte Black" }

// ✗ Invalid - Missing substrate
{ "colour": "Matte Black" }
```

#### 4. Neon Base
**Required Fields:** `thickness` + `material` + `colour`
**Error Message:** "Neon Base specification requires thickness, material, and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "thickness": "12mm", "material": "Acrylic", "colour": "Clear" }

// ✗ Invalid - Missing material
{ "thickness": "12mm", "colour": "Clear" }
```

#### 5. Box Material
**Required Fields:** `material` + `colour`
**Error Message:** "Box Material specification requires both material and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "material": "3mm ACM", "colour": "Matte Black" }

// ✗ Invalid - Missing colour
{ "material": "3mm ACM" }
```

#### 6. Return
**Required Fields:** `depth` + `colour`
**Error Message:** "Return specification requires both depth and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "depth": "3\"", "colour": "White" }

// ✗ Invalid - Missing depth
{ "colour": "White" }
```

#### 7. Trim
**Required Fields:** `colour`
**Error Message:** "Trim specification requires colour"

**Examples:**
```json
// ✓ Valid
{ "colour": "Black" }

// ✗ Invalid - Empty colour
{ "colour": "" }
```

---

### Fabrication Specs

#### 8. Extr. Colour (Extrusion Colour)
**Required Fields:** `colour`
**Error Message:** "Extr. Colour specification requires colour"

**Examples:**
```json
// ✓ Valid
{ "colour": "White" }

// ✗ Invalid - Whitespace only
{ "colour": "   " }
```

#### 9. Cutting
**Required Fields:** `method`
**Error Message:** "Cutting specification requires method"

**Examples:**
```json
// ✓ Valid
{ "method": "Router" }

// ✗ Invalid - Missing method
{}
```

#### 10. Acrylic (Push Thru Acrylic)
**Required Fields:** `thickness` + `colour`
**Error Message:** "Acrylic specification requires both thickness and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "thickness": "12mm", "colour": "2447 White" }

// ✗ Invalid - Missing thickness
{ "colour": "2447 White" }
```

---

### Graphics/Finishing Specs

#### 11. Vinyl
**Required Fields:** `colours` + `application` + `size`
**Error Message:** "Vinyl specification requires colours, application, and size. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "colours": "3630-33", "application": "Face, Full", "size": "5yd" }

// ✗ Invalid - Missing size
{ "colours": "3630-33", "application": "Face, Full" }
```

#### 12. Digital Print
**Required Fields:** `colour` + `type` + `application`
**Error Message:** "Digital Print specification requires colour, type, and application. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "colour": "440C", "type": "Translucent", "application": "Face" }

// ✗ Invalid - Missing type
{ "colour": "440C", "application": "Face" }
```

#### 13. Painting
**Required Fields:** `colour` + `component` + `timing`
**Error Message:** "Painting specification requires colour, component, and timing. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "colour": "RAL 9005", "component": "Return", "timing": "Post-Cutting" }

// ✗ Invalid - Missing timing
{ "colour": "RAL 9005", "component": "Return" }
```

---

### Assembly Specs

#### 14. D-Tape
**Required Fields:** `include` + `thickness`
**Error Message:** "D-Tape specification requires include (yes/no) and thickness. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "include": true, "thickness": "62 MIL (Thick)" }

// ✗ Invalid - Missing thickness
{ "include": true }

// ✗ Invalid - Missing include (boolean required)
{ "thickness": "62 MIL (Thick)" }
```

#### 15. Pins (OR Logic Example)
**Required Fields:** `count` + (`pins` OR `spacers`)
**Error Message:** "Pins specification requires count. Missing: {fields}" or "Pins specification requires either pins or spacers to be specified"

**Examples:**
```json
// ✓ Valid - Has pins
{ "count": "8", "pins": "4\" Pins" }

// ✓ Valid - Has spacers
{ "count": "8", "spacers": "1\" Spacer" }

// ✓ Valid - Has both
{ "count": "8", "pins": "4\" Pins", "spacers": "1\" Spacer" }

// ✗ Invalid - Missing both pins and spacers
{ "count": "8" }

// ✗ Invalid - Missing count
{ "pins": "4\" Pins" }
```

#### 16. Cut
**Required Fields:** `include` (boolean)
**Error Message:** "Cut specification requires include (yes/no)"

**Examples:**
```json
// ✓ Valid
{ "include": true }

// ✓ Valid - false is a valid value
{ "include": false }

// ✗ Invalid - Missing include
{}
```

#### 17. Peel
**Required Fields:** `include` (boolean)
**Error Message:** "Peel specification requires include (yes/no)"

#### 18. Mask
**Required Fields:** `include` (boolean)
**Error Message:** "Mask specification requires include (yes/no)"

#### 19. Assembly
**Required Fields:** None (optional notes field)
**Error Message:** N/A

---

### Electrical Specs

#### 20. LEDs
**Required Fields:** `count` + `led_type`
**Optional Fields:** `note` (additional notes)
**Error Message:** "LEDs specification requires count and LED type. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "count": "64", "led_type": "LED-WH-5050-12V - White (3W, 12V)" }

// ✓ Valid - With optional note
{ "count": "64", "led_type": "LED-WH-5050-12V - White (3W, 12V)", "note": "Evenly spaced" }

// ✗ Invalid - Missing led_type
{ "count": "64" }
```

#### 21. Neon LED
**Required Fields:** `stroke_width` + `colour`
**Error Message:** "Neon LED specification requires stroke width and colour. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "stroke_width": "8mm", "colour": "Pure White" }

// ✗ Invalid - Missing stroke_width
{ "colour": "Pure White" }
```

#### 22. Power Supply
**Required Fields:** `count` + `ps_type`
**Optional Fields:** `note` (additional notes)
**Error Message:** "Power Supply specification requires count and PS type. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "count": "2", "ps_type": "Mean Well 12V-5A (60W, 12V, UL)" }

// ✗ Invalid - Missing ps_type
{ "count": "2" }
```

#### 23. Wire Length
**Required Fields:** `length` + `wire_gauge`
**Error Message:** "Wire Length specification requires length and wire gauge. Missing: {fields}"

**Examples:**
```json
// ✓ Valid
{ "length": "6ft", "wire_gauge": "18 AWG" }

// ✗ Invalid - Missing wire_gauge
{ "length": "6ft" }
```

#### 24. UL
**Required Fields:** `include` (boolean)
**Optional Fields:** `note` (additional notes)
**Error Message:** "UL specification requires include (yes/no)"

**Examples:**
```json
// ✓ Valid
{ "include": true }

// ✓ Valid - With note
{ "include": true, "note": "UL1598 certification" }

// ✗ Invalid - Missing include
{}
```

---

### Other Specs

#### 25. Drain Holes (Conditional Validation Example)
**Required Fields:** `include` (always required)
**Conditional Fields:** `size` (required only when `include` = `true`)
**Error Message:** "Drain Holes specification requires include (yes/no)" or "Drain Holes size is required when include is set to yes"

**Examples:**
```json
// ✓ Valid - Include is false, size not required
{ "include": false }

// ✓ Valid - Include is true, size provided
{ "include": true, "size": "1/4\"" }

// ✗ Invalid - Include is true but size missing (CONDITIONAL VIOLATION)
{ "include": true }

// ✗ Invalid - Missing include entirely
{}
```

#### 26. Notes
**Required Fields:** None (completely optional)
**Error Message:** N/A

---

## Deprecated Templates

### Mounting (DEPRECATED)
**Status:** Removed from dropdown, kept for backward compatibility
**Usage:** 6 legacy orders (200016-200023) still reference this template
**Required Fields:** None (no validation enforced)
**Note:** Template definition kept in `MOUNTING_TEMPLATE` but removed from `TEMPLATE_REGISTRY`

---

## Implementation Details

### Service Location
`/backend/web/src/services/orderValidationService.ts`

### API Endpoint
```
GET /api/order-preparation/:orderNumber/validate
```

### Frontend Integration
```typescript
// Called by ValidationStep component
const result = await ordersApi.validateForPreparation(orderNumber);

if (!result.isValid) {
  // Display errors in UI
  setValidationErrors(result.errors);
}
```

### Error Format
```typescript
interface ValidationError {
  field: string;           // 'specifications'
  message: string;         // Human-readable error message
  partNumber?: number;     // Part number with error
  templateName?: string;   // Template name (e.g., "Return", "LEDs")
}
```

---

## Testing Validation

### Manual Testing Steps

1. Open Order Details page for any order
2. Click "Prepare Order" button
3. Validation runs automatically (Step 1)
4. If errors exist:
   - Red error box displays with all validation errors
   - "Next: Send to Customer" button is disabled
   - Fix errors in Order Details page (Specs table)
   - Re-run validation
5. When validation passes:
   - Green checkmark appears
   - Can proceed to Step 2 (Create QB Estimate)

### Sample Test Cases

**Test Case 1: Missing Required Fields**
- Part 1: Return with no depth field
- Expected: "Return specification requires both depth and colour. Missing: depth"

**Test Case 2: Conditional Validation**
- Part 1: Drain Holes with include=true but no size
- Expected: "Drain Holes size is required when include is set to yes"

**Test Case 3: OR Logic**
- Part 1: Pins with count=8 but no pins or spacers
- Expected: "Pins specification requires either pins or spacers to be specified"

**Test Case 4: Boolean Fields**
- Part 1: Cut with no include field
- Expected: "Cut specification requires include (yes/no)"

---

## Future Enhancements

### Potential Improvements
1. **Cross-spec validation** - Validate relationships between different specs (e.g., wire length matches LED count)
2. **Product type-specific rules** - Different validation rules per product type
3. **Warning-level validation** - Non-blocking warnings for best practices
4. **Batch validation** - Validate multiple orders at once
5. **Validation templates** - Pre-configured validation rule sets per customer

---

**Document Status:** ✅ Complete
**Next:** See `/Nexus_Orders_Phase1.5c.6.2_PrepareSteps.md` for PrepareOrderModal workflow
