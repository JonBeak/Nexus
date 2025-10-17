# Vinyl Pricing Calculations - Complete Documentation

## Rate Structure (Configurable Values)

| Rate Code | Description | Value | Database Code |
|-----------|-------------|-------|---------------|
| APP_SHEET | Application/Sheet Fee | $40.00 | FEE_SHEET |
| CUT_APP_SHEET | Cut Application/Sheet Fee | $80.00 | FEE_CUT_SHEET (legacy) |
| T_PER_YARD | Standard Vinyl per Yard | $55.00 | VINYL_TRANS |
| PERF_PER_YARD | Perforated Vinyl per Yard | $110.00 | VINYL_PERF |
| DIG_PER_SQFT | Digital Print per SqFt | $8.00 | DIGITAL_PRINT |

**Note**: 24" piece pricing (PC_24IN variants) removed from current implementation.

## Current Field Configuration (Updated)

### Field Mappings:
- **field1**: T (Type - space-separated vinyl product IDs for standard vinyl)
- **field2**: Tc (Type color - space-separated vinyl product IDs for translucent/color)
- **field3**: Perf (Perforated - space-separated vinyl product IDs for perforated)
- **field4**: Perf c (Perforated color - space-separated vinyl product IDs)
- **field5**: Application (simple float - application fee multiplier or count)
- **field6-10**: Dig WxH (Digital print dimensions - "WxH" format, e.g., "24x36")

## Calculation Methods by Field

### Fields 1-4: Vinyl Product Selection (T, Tc, Perf, Perf c)
**Input Format**: Space-separated vinyl product IDs (e.g., "53 564 12")
**Logic**:
- Each ID maps to a vinyl product in `vinyl_products` table
- Products have `default_width` in inches
- Convert to yards: `width_inches / 36`
- Sum all yards from all product IDs
- Calculate based on vinyl type (translucent vs perforated)

**Translucent (T, Tc) Formula**:
```
total_yards = SUM(product_widths / 36)
application_fee = ROUNDUP(total_yards/3, 0) * APP_SHEET
material_cost = total_yards * T_PER_YARD
total = application_fee + material_cost
```

**Perforated (Perf, Perf c) Formula**:
```
total_yards = SUM(product_widths / 36)
application_fee = ROUNDUP(total_yards/3, 0) * APP_SHEET
material_cost = total_yards * PERF_PER_YARD
total = application_fee + material_cost
```

**Examples**:
- Input: "53 564" (two product IDs with 54" width each)
- Total width: 108 inches = 3 yards
- Translucent: ROUNDUP(3/3,0) * $40 + 3 * $55 = $40 + $165 = $205
- Perforated: ROUNDUP(3/3,0) * $40 + 3 * $110 = $40 + $330 = $370

### Field 5: Application Fee
**Input Format**: Single float (e.g., "40", "60", "80")
**Formula**: `value` (direct fee)
**Logic**: Direct application fee amount - user enters the total fee, not a multiplier
**Examples**:
- Input: "60"
- Cost: $60

### Fields 6-10: Digital Print Vinyl (Dig WxH)
**Formula**: `calculated_sqft * DIG_PER_SQFT + setup_fee`
**Logic**:
- Dimensions parsed from "WxH" format (e.g., "12x8")
- Converted to quarter-foot precision: `ROUNDUP(dimension*4/12,0)/4`
- Square footage calculated: `width_qft * height_qft`
- One-time setup fee: `APP_SHEET * 1.5` ($40 * 1.5 = $60) when content exists
**Examples**:
- Input: "12x8" = 12"x8"
- Width: ROUNDUP(12*4/12,0)/4 = ROUNDUP(4,0)/4 = 1.0 ft
- Height: ROUNDUP(8*4/12,0)/4 = ROUNDUP(2.67,0)/4 = 0.75 ft
- Area: 1.0 * 0.75 = 0.75 sqft
- Cost: 0.75 * $8 + $60 = $66

## Input Processing Logic

### Vinyl Product ID Inputs (fields 1-4: T, Tc, Perf, Perf c)
- Input: Space-separated product IDs from `vinyl_products` table
- Example: "53 564 12"
- Each ID is looked up in database to get `default_width` (in inches)
- Convert each width to yards: `width_inches / 36`
- Sum all yards for total calculation
- Validation: Parsed as array of floats [53, 564, 12]

### Application Fee Input (field 5)
- Input: Direct dollar amount as single float
- Example: "60", "40", "80"
- No calculation needed - this IS the application fee
- Validation: Single float, no scientific notation

### Digital Print Inputs (fields 6-10: Dig WxH)
- Input: "WxH" format where W and H are dimensions in inches
- Example: "12x8", "24x36", "48 x 96" (spaces ignored)
- Validation: Parsed as [width, height] array
- Quarter-foot precision conversion: `ROUNDUP(dimension*4/12, 0) / 4`
- Setup fee ($60) applied once if ANY digital print field has content
- Each field calculated independently and summed

## Database Schema (Implemented)

### 1. vinyl_pricing table
**Current Structure**:
```sql
CREATE TABLE vinyl_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vinyl_component VARCHAR(100) NOT NULL,
  component_code VARCHAR(20) UNIQUE NOT NULL,
  componentl_type VARCHAR(20) NOT NULL,
  price DECIMAL(8,4) NOT NULL,
  effective_date DATE,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Active Rates**:
- `VINYL_TRANS` (Translucent): $55.00/yard
- `VINYL_PERF` (Perforated): $110.00/yard
- `DIGITAL_PRINT`: $8.00/sqft
- `FEE_SHEET` (Application): $40.00
- Legacy 24" rates (ignored in current implementation)

### 2. vinyl_products table
**Current Structure**:
```sql
CREATE TABLE vinyl_products (
  product_id INT PRIMARY KEY AUTO_INCREMENT,
  brand VARCHAR(100),
  series VARCHAR(100),
  type VARCHAR(100),
  default_width DECIMAL(5,2), -- Width in inches
  colour_number VARCHAR(20),
  colour_name VARCHAR(100),
  is_active BOOLEAN DEFAULT 1,
  ...
);
```

**Usage**: Fields 1-4 reference `product_id` to lookup `default_width` for yard calculations.

## Calculation Engine Requirements

### Calculator Implementation (`vinylPricing.ts`)
1. **Fetch pricing rates** from `vinyl_pricing` table
2. **Process fields 1-4**:
   - Lookup product IDs in `vinyl_products`
   - Sum widths and convert to yards
   - Apply yard-based pricing
3. **Process field 5**: Direct application fee
4. **Process fields 6-10**:
   - Parse WxH dimensions
   - Quarter-foot precision rounding
   - Calculate sqft and apply digital print rate
   - Add one-time setup fee if any digital content exists
5. **Generate components** for estimate preview breakdown

## Implementation Status
✅ Database tables exist with pricing data
✅ Validation layer complete (fields 1-10)
⏳ Calculation engine (next step)
⏳ Estimate preview integration