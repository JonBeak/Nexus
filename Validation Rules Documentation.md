# 📋 Validation Rules Documentation & Progress Tracker

**Created**: 2025-09-17
**Purpose**: Systematic review of all product types and their field validation rules
**Status**: In Progress - Building comprehensive validation rule database

---

## 🎯 **Validation Rule Categories**

### **Field Categories (Updated Naming):**
- **`complete_set`** - All fields in the set must be filled for pricing (formerly "mandatory")
- **`sufficient`** - One field is enough alone for basic pricing
- **`supplementary`** - Enhances pricing but optional

### **Error Levels:**
- **`error`** - Invalid format/range - blocks pricing
- **`warning`** - Missing fields/incomplete data - informational

---

## 📋 **Complete Product Type List**

### **Normal Products (14)**
1. **Channel Letters** - Complex with multiple LED/wiring fields
2. **Vinyl** - Simple dimensions + application method
3. **Substrate Cut** - Material + dimensions + cutting options
4. **Backer** - [Need to review fields]
5. **Push Thru** - [Need to review fields]
6. **Blade Sign** - [Need to review fields]
7. **LED Neon** - [Need to review fields]
8. **Painting** - [Need to review fields]
9. **Custom** - [Need to review fields]
10. **Wiring** - [Need to review fields]
11. **Material Cut** - [Need to review fields]
12. **UL** - [Need to review fields]
13. **Shipping** - [Need to review fields]
14. **LED** - [Need to review fields]

### **Sub-Item Products (5)**
16. **↳ Vinyl** - Vinyl add-ons for main products
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

| Field | Function | Category | Error Level | Dependencies | Products Affected | Description |
|-------|----------|----------|-------------|--------------|------------------|-------------|
| field1 | required | complete_set | warning | - | channel_letters, leds, power_supplies, extra_wire, pins | Channel letter style/type |
| field2 | textsplit | complete_set | mixed | - | channel_letters, leds, power_supplies, extra_wire, pins | Letters data (dimensions) |
| field3 | led_override | sufficient | mixed | - | leds, power_supplies | LED count override |
| field4 | ul_override | sufficient | mixed | led_count (calculated) | ul | UL certification override |
| field5 | float | sufficient | error | - | pins | Pin count |
| field6 | float | supplementary | mixed | field1, field2 | extra_wire | Extra wire length |
| field8 | required | supplementary | warning | - | - | LED type selection |
| field9 | ps_override | sufficient | mixed | led_count (calculated) | power_supplies | Power supply override |
| field10 | required | supplementary | warning | - | - | Power supply type selection |

#### **Business Logic Implemented:**
- **Two-phase validation**: Calculate derived values → Context-aware validation
- **Customer preferences integration**: LED defaults, transformer requirements, UL preferences
- **Override templates**: Accept float/"yes"/"no" with context-aware defaults
- **Product selection**: Automatic determination of products (Channel Letters, LEDs, Power Supplies, UL, Pins, Extra Wire)
- **Dependency resolution**: UL and PS fields depend on calculated LED count

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
✅ **`float`** - Simple numeric validation with min/max/decimal controls
✅ **`required`** - Non-empty field validation with whitespace handling
✅ **`led_override`** - Channel Letters LED calculation with customer preferences
✅ **`ps_override`** - Power supply calculation based on LED count
✅ **`ul_override`** - UL certification logic with currency support

### **Needed Templates:**
❌ **`email`** - Email format validation
❌ **`select`** - Dropdown/select validation
❌ **`date`** - Date format validation

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
   - [ ] Set field category (complete_set/sufficient/supplementary)
   - [ ] Define validation parameters
   - [ ] Set error level (error/warning)

5. **Implementation & Testing**
   - [ ] Update database validation_rules column
   - [ ] Test with sample data
   - [ ] Verify UI visual feedback

---

## 📈 **Progress Tracking**

**Total Product Types**: 27 (from database query)
**Reviewed**: 1
**In Progress**: 0
**Completed**: 1 (Channel Letters)

### **Completed Product Types:**
✅ **Channel Letters** (ID: 1) - Full validation system with context-aware override templates

### **Next Actions:**
1. [✅] **Query database** to get complete product type list
2. [✅] **Channel Letters validation system** - Complete
3. [ ] **Choose next product type** for validation implementation
4. [ ] **Review field prompts** for next product type
5. [ ] **Define validation rules** for next product type

---

## 💡 **Validation Strategy Notes**

### **Common Field Patterns:**
- **Quantity fields**: Usually `sufficient` + `float` validation
- **Dimension fields**: Usually `complete_set` + `textsplit` validation
- **Material/Color fields**: Usually `complete_set` + dropdown validation
- **Notes/Instructions**: Usually `supplementary` + minimal validation
- **Pricing adjustments**: Usually `supplementary` + `float` validation

### **Business Logic:**
- **Complete Set**: All fields must be filled for pricing (e.g., width + height + material)
- **Sufficient**: One field enables pricing (e.g., quantity alone)
- **Supplementary**: Optional enhancements (e.g., rush charges, special instructions)

---

**Last Updated**: 2025-09-18
**Next Step**: Choose next product type for validation implementation (Vinyl or Substrate Cut recommended as commonly used products)