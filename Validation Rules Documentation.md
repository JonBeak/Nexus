# 📋 Validation Rules Documentation & Progress Tracker

**Created**: 2025-09-17
**Purpose**: Systematic review of all product types and their field validation rules
**Status**: In Progress - Building comprehensive validation rule database

---

## 🎯 **Validation Rule Categories**

### **Field Relationships:**
- **`complimentary_fields`** - Array of field names that must all be filled together (e.g., ["field1", "field2"] means both are required if either is filled)
- **`supplementary_to`** - Array of field names this field enhances (optional field that adds detail to other fields)
- **`required`** - Boolean indicating if field is always required regardless of other fields

### **Error Level:**
- **`error`** - Invalid format/range/missing required data - blocks pricing (all validation errors are blocking)

---

## 📋 **Complete Product Type List**

### **Normal Products (14)**
1. **Channel Letters** - ✅ Complex with multiple LED/wiring fields, full validation implemented
2. **Vinyl** - ✅ Vinyl yards arrays with digital print support
3. **Substrate Cut** - ✅ Material + dimensions + pins/tape/assembly
4. **Backer** - ✅ Aluminum 3D, Raceway, ACM with assembly
5. **Push Thru** - ✅ Conditional 2D/3D dimensions, LEDs, UL, PS logic
6. **Blade Sign** - ✅ Shape-aware dimensions, tiered pricing, LED/UL/PS
7. **LED Neon** - ✅ Base substrate, linear LED, solders, standoffs, PS
8. **Painting** - [Need to review fields]
9. **Custom** - ✅ Three-column product/description/price format
10. **Wiring** - [Need to review fields]
11. **Material Cut** - [Need to review fields]
12. **UL** - [Need to review fields]
13. **Shipping** - [Need to review fields]
14. **LED** - [Need to review fields]

### **Sub-Item Products (5)**
16. **↳ Vinyl** - ✅ Vinyl add-ons for main products (uses same validation as Vinyl)
17. **↳ Painting** - Painting services for main products
18. **↳ LED** - LED components for main products
19. **↳ Wiring** - Wiring services for main products
20. **↳ Material Cut** - Additional cutting for main products

### **Special Items (7)**
14. **Assembly** - Assembly fee with group management
21. **Subtotal** - Calculation item (no validation needed)
22. **Discount/Fee** - Pricing adjustments
23. **Multiplier** - Quantity multipliers
24. **Text/Note** - Notes/comments (no validation needed)
25. **Divider** - Visual separator (no validation needed)
27. **Empty Row** - Placeholder (no validation needed)

---

## 🎯 **Current Focus: Working on Product Type**

### **✅ COMPLETED: Channel Letters (Product Type ID: 1)**

#### **Validation Rules Implemented:**

| Field | Function | Complimentary Fields | Supplementary To | Products Affected | Description |
|-------|----------|---------------------|------------------|------------------|-------------|
| field1 | required | ["field2"] | - | channel_letters, leds, power_supplies, extra_wire, pins | Channel letter style/type |
| field2 | textsplit | ["field1"] | - | channel_letters, leds, power_supplies, extra_wire, pins | Letters data (dimensions) |
| field3 | led_override | - | - | leds, power_supplies | LED count override |
| field4 | ul_override | - | - | ul | UL certification override |
| field5 | float | - | - | pins | Pin count |
| field6 | float | - | ["field1", "field2"] | extra_wire | Extra wire length |
| field8 | required | - | ["field3"] | - | LED type selection |
| field9 | ps_override | - | - | power_supplies | Power supply override |
| field10 | required | - | ["field9"] | - | Power supply type selection |

#### **Business Logic Implemented:**
- **Two-phase validation**: Calculate derived values → Context-aware validation
- **Customer preferences integration**: LED defaults, transformer requirements, UL preferences
- **Override templates**: Accept float/"yes"/"no" with context-aware defaults
- **Product selection**: Automatic determination of products (Channel Letters, LEDs, Power Supplies, UL, Pins, Extra Wire)
- **Dependency resolution**: UL and PS fields depend on calculated LED count

---

### **✅ COMPLETED: Vinyl (Product Type ID: 2)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Description |
|-------|-------|----------|------------|-------------|
| field1 | T | textsplit | delimiter: ' ', parse_as: 'float', min: 0 | Standard vinyl yards array |
| field2 | Tc | textsplit | delimiter: ' ', parse_as: 'float', min: 0 | Color cut vinyl yards array |
| field3 | Perf | textsplit | delimiter: ' ', parse_as: 'float', min: 0 | Perforated vinyl yards array |
| field4 | Perf c | textsplit | delimiter: ' ', parse_as: 'float', min: 0 | Perforated color cut yards array |
| field5 | Application | float | min: 0, allow_negative: false | Application fee (direct $) |
| field6-10 | Dig WxH or sqft | floatordimensions | delimiter: 'x', min: 0 | Digital print dimensions or total sqft |

#### **Business Logic:**
- Accepts space-delimited yard quantities (e.g., "5 3 2.5")
- Each field represents a different vinyl type with different pricing
- Digital print accepts either dimensions (24 x 18) or total sqft (432)

---

### **✅ COMPLETED: Substrate Cut (Product Type ID: 3)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Relationships | Description |
|-------|-------|----------|------------|---------------|-------------|
| field1 | Type | non_empty | - | Complimentary with field2 | Substrate material dropdown |
| field2 | XY | floatordimensions | delimiter: 'x', min: 0 | Complimentary with field1 | Dimensions |
| field3 | Pins | float | min: 0 | Complimentary with field4 | Number of pins |
| field4 | Pin Type | non_empty | - | Complimentary with field3 | Pin type selection |
| field5 | D-tape | float | allow_negative: true | - | Double-sided tape override |
| field6 | Assem | float | allow_negative: true | - | Assembly cost override |
| field10 | ~ Cut ~ | float | allow_negative: true | - | Cutting cost override |

#### **Business Logic:**
- Material + dimensions required together
- Pins + pin type work as complimentary pair
- Override fields can accept negative values for discounts

---

### **✅ COMPLETED: Backer (Product Type ID: 4)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Description |
|-------|-------|----------|------------|-------------|
| field1-3 | Alum XYZ | threedimensions | delimiter: 'x', max_x: 239.5, max_y: 47.5 | Aluminum 3D dimensions |
| field4-5 | RW 8" L | float | min: 0.01, max: 299.5 | Raceway length |
| field6-9 | ACM XY | floatordimensions | delimiter: 'x', max: 300, max_y: 60 | ACM panel dimensions |
| field10 | Assem | float | allow_negative: true | Assembly override |

#### **Business Logic:**
- Supports three component types: Aluminum (3D), Raceway (linear), ACM (2D)
- Uses lookup tables for aluminum and ACM pricing
- Raceway priced per linear inch

---

### **✅ COMPLETED: Push Thru (Product Type ID: 5)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Relationships | Description |
|-------|-------|----------|------------|---------------|-------------|
| field1 | Alum / ACM | non_empty | - | Complimentary with field3 | Material dropdown |
| field2 | # Boxes | float | min: 0.01, max: 5 | Supplementary to field1,3 | Box count (defaults: 2) |
| field3 | XYZ / XY | conditionaldimensions | condition: field1 | Complimentary with field1 | 3D if Aluminum, 2D if ACM |
| field4 | Acryl XY | floatordimensions | delimiter: 'x', min: 0.01 | - | Acrylic panel dimensions |
| field5 | LEDs XY | floatordimensions | delimiter: 'x', min: 0.01 | - | LED panel dimensions |
| field6 | UL | ul_override | accepts: ['float', 'yes', 'no', '$amount'] | - | UL certification |
| field7 | PS # | ps_override | accepts: ['float', 'yes', 'no'], allow_zero: true | - | Power supply count |
| field8-10 | Overrides | float | allow_negative: true | - | Cut/PC/Assembly overrides |

#### **Business Logic:**
- Conditional dimensions: 3D for Aluminum, 2D for ACM (smart validation)
- LED/UL/PS logic similar to Channel Letters
- Box count multiplies final pricing

---

### **✅ COMPLETED: Blade Sign (Product Type ID: 6)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Relationships | Description |
|-------|-------|----------|------------|---------------|-------------|
| field1 | Shape | non_empty | - | - | Circle/Rectangle dropdown |
| field2 | X x Y | floatordimensions | delimiter: 'x', max_area: 2350 | Complimentary with field1 | Dimensions |
| field3 | LEDs # | led_override | accepts: ['float', 'yes', 'no'] | - | LED count override |
| field4 | UL | ul_override | accepts: ['float', 'yes', 'no', '$amount'] | - | UL certification |
| field5 | PS # | ps_override | accepts: ['float', 'yes', 'no'] | - | Power supply count |
| field7-10 | ~ Frame/Assem/Wrap/Cut ~ | float | allow_negative: true | - | Component cost overrides |

#### **Calculated Values:**
- `sqft`: Area in square feet (shape-aware: circles use averaged ellipse area)
- `sqInches`: Actual shape area
- `ledCount`: MAX(CEIL(sqInches/100*9), CEIL(SQRT(sqInches)*1.4))
- `totalWattage`: ledCount * 1.2W
- `psCount`: Optimized PS count

#### **Business Logic:**
- Shape affects area calculation (Circle = avg of ellipse and bounding box)
- Tiered pricing: < 4 sqft base cost, > 4 sqft additional rate per sqft
- LED count uses dual method (area-based vs perimeter-based, takes larger)
- Power supply uses smart optimization (UL or Speedbox 60W preference)

---

### **✅ COMPLETED: LED Neon (Product Type ID: 7)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Relationships | Description |
|-------|-------|----------|------------|---------------|-------------|
| field1 | Base HxL | floatordimensions | delimiter: 'x', min: 0 | - | Base substrate dimensions |
| field2 | Base Mat | non_empty | - | Supplementary to field1 | Material dropdown |
| field3 | Length (in) | float | min: 0 | - | LED linear length (inches) |
| field4 | Solders | float | min: 0 | Supplementary to field3 | Solder joint count |
| field5 | Stnd Off # | float | min: 0 | - | Standoff count |
| field6 | Opq? | non_empty | - | Supplementary to field4 | Opacity override (Yes/No) |
| field7 | PS # | ps_override | accepts: ['float', 'yes', 'no'] | - | Power supply count |

#### **Calculated Values:**
- `totalWattage`: (field3/12) * 4.80W per foot
- `ledCount`: 1 (fake for ps_override validation)
- `savedPsCount`: ceil(totalWattage / 60)

#### **Business Logic:**
- Base substrate with 21% waste factor
- LED priced per foot (inches converted to feet)
- Solder type determined by material + opacity (PVC or opacity="Yes" → Opaque solders)
- Power supply uses smart optimization (respects customer UL/PS preferences)

---

### **✅ COMPLETED: Custom (Product Type ID: 9)**

#### **Validation Rules Implemented:**

| Field | Label | Function | Parameters | Relationships | Description |
|-------|-------|----------|------------|---------------|-------------|
| field1 | A.ProductName | non_empty | allow_whitespace: false | - | Column A product name |
| field2 | A.Description | non_empty | allow_whitespace: false | - | Column A description |
| field3 | A.UnitPrice | or_required | required_fields: [1,2], validate_as: 'float' | - | Requires field1 OR field2 |
| field4-6 | B.* | (same as A) | - | - | Column B (same pattern) |
| field7-9 | C.* | (same as A) | - | - | Column C (same pattern) |

#### **Business Logic:**
- Three-column layout for custom products
- Each column must have product name OR description before price
- Flexible: allows partial column fills

---

## 🧪 **Validation Rule Templates Available**

### **Current Templates:**
✅ **`textsplit`** - 1D/2D parsing with delimiters
```json
{
  "delimiter": "+",
  "parse_as": "float",
  "min_count": 2,
  "max_count": 10,
  "min": 0,
  "max": 999
}
```

### **Completed Templates:**

**Basic Validation:**
✅ **`float`** - Numeric validation with min/max/decimal/negative controls
✅ **`non_empty` / `required`** - Non-empty field validation with whitespace handling

**Dimension Parsing:**
✅ **`textsplit`** - Space-delimited float arrays (e.g., "5 3 2.5")
✅ **`float_or_groups`** - Float OR groups format (e.g., "10,. . . . . 6,")
✅ **`floatordimensions`** - Float OR dimensions (e.g., "24 x 18")
✅ **`threedimensions`** - 3D dimensions only (e.g., "48 x 24 x 3")
✅ **`conditionaldimensions`** - 2D or 3D based on another field's value

**Component Overrides:**
✅ **`led_override`** - LED count override (float/"yes"/"no")
✅ **`ps_override`** - Power supply count override with smart UL optimization
  - Accepts: number (explicit count), "yes" (auto-calculate), "no" (skip PS), 0 (skip PS)
  - Smart optimization: Uses PS#2+PS#3 combo when UL required OR customer prefers Speedbox 60W
  - Used in: Channel Letters (field9), Blade Sign (field5), LED Neon (field7), Push Thru (field7)
✅ **`ul_override`** - UL certification override (float/"yes"/"no"/"$amount")

**Product Selection:**
✅ **`led_type`** - LED product selection validation
✅ **`ps_type`** - Power supply type selection validation

**Advanced Logic:**
✅ **`or_required`** - Requires at least one of specified fields when current field has value

---

## 🔄 **Systematic Review Process**

### **Current Phase: Database Discovery**

1. **✅ NEXT: Get Actual Product Types**
   - [ ] Query database for all product types
   - [ ] Identify categories (regular/sub-item/special)
   - [ ] Review current field labels/prompts

2. **Product Type Categorization**
   - [ ] Regular Products: Main items that can have sub-items
   - [ ] Sub-Item Products: Attachments/add-ons for main products
   - [ ] Special Items: Subtotals, dividers, assembly fees

3. **Field Analysis per Product Type**
   - [ ] Review current field prompts/labels
   - [ ] Understand business purpose of each field
   - [ ] Determine validation requirements

4. **Validation Rule Design**
   - [ ] Choose appropriate validation template
   - [ ] Define complimentary_fields (if field works with others)
   - [ ] Define supplementary_to (if field enhances others)
   - [ ] Define validation parameters

5. **Implementation & Testing**
   - [ ] Update database validation_rules column
   - [ ] Test with sample data
   - [ ] Verify UI visual feedback

---

## 📈 **Progress Tracking**

**Total Product Types**: 27 (from database query)
**Reviewed**: 8
**In Progress**: 0
**Completed**: 8 products + 1 sub-item = 9 total implementations

### **Completed Product Types:**
✅ **Channel Letters** (ID: 1) - Full validation system with LED/UL/PS override templates, 10 fields
✅ **Vinyl** (ID: 2) - Vinyl yards arrays + digital print support, 10 fields
✅ **Substrate Cut** (ID: 3) - Material selection + dimensions + pins/assembly, 7 fields
✅ **Backer** (ID: 4) - Aluminum 3D + Raceway + ACM with conditional dimensions, 10 fields
✅ **Push Thru** (ID: 5) - Conditional 2D/3D based on material + LED/UL/PS logic, 10 fields
✅ **Blade Sign** (ID: 6) - Shape-aware dimensions + LED/UL/PS + tiered pricing overrides, 9 fields
✅ **LED Neon** (ID: 7) - Base substrate + linear LED + solders + PS optimization, 7 fields
✅ **Custom** (ID: 9) - Three-column product/description/price with OR logic, 9 fields
✅ **↳ Vinyl** (ID: 16) - Sub-item using same validation as Vinyl (ID: 2)

### **Next Actions:**
1. [✅] **Query database** to get complete product type list
2. [✅] **Channel Letters validation system** - Complete
3. [ ] **Choose next product type** for validation implementation
4. [ ] **Review field prompts** for next product type
5. [ ] **Define validation rules** for next product type

---

## 💡 **Validation Strategy Notes**

### **Common Field Patterns:**
- **Quantity fields**: Standalone fields with `float` validation
- **Dimension fields**: Complimentary with `textsplit` validation (e.g., width + height)
- **Material/Color fields**: Often complimentary with dropdown validation
- **Notes/Instructions**: Supplementary fields with minimal validation
- **Type selection fields**: Supplementary to data fields (e.g., LED type supplements LED count)

### **Business Logic:**
- **Complete Set**: All fields must be filled for pricing (e.g., width + height + material)
- **Sufficient**: One field enables pricing (e.g., quantity alone)
- **Supplementary**: Optional enhancements (e.g., rush charges, special instructions)

---

**Last Updated**: 2025-10-16
**Status**: Major milestone reached - 8 core product types fully implemented with validation & calculation
**Next Step**: Implement remaining products (Painting, Wiring, Material Cut, UL, Shipping, LED) or focus on enhancing existing products