# LED Neon Pricing Calculations - Complete Documentation

## Overview

The LED Neon system calculates pricing for LED neon installations with custom-cut backing panels (PVC or Acrylic), LED neon strip integration, solders, standoffs, and power supplies. The system uses length-based pricing with sophisticated material calculations and solder logic.

## Rate Structure (Configurable Values)

### LED Neon Specific Rates
| Component | Rate | Description |
|-----------|------|-------------|
| LED Neon Price | $11.00/ft | LED neon strip cost per foot |
| LED Neon Watts | 4.8W/ft | Power consumption per foot |
| Standoff Cost | $15.00 | Cost per standoff |

### Solder Pricing
| Solder Type | Price | Usage |
|-------------|-------|--------|
| Clear Solders | $14.00 | Default (clear acrylic + not opaque) |
| Opaque Solders | $7.00 | Opaque acrylic or PVC material |

### Material Options (from Substrate Table)
| Material | Sheet Cost | Cut Rate |
|----------|------------|----------|
| Acrylic 12mm | $370/sheet | $120/sheet |
| PVC 12mm | $225/sheet | $120/sheet |

### Configuration Rates
| Rate Code | Value | Description | Cell Ref |
|-----------|-------|-------------|----------|
| MAT_BASE | $50.00 | Material base cost | $I$139 |
| MAT_MARKUP | 1.25 | Material markup multiplier | $I$140 |
| CUT_BASE | $30.00 | Cutting base cost | $I$141 |

## Calculation Logic

### 1. Material Selection
**Business Logic**: Material selected from dropdown by name

```
Material Selection Logic:
field2 contains the actual material name from dropdown selection.
Materials are from substrate_cut_pricing table.

Available materials:
- "Acrylic 12mm" ($370/sheet, $120/sheet cutting)
- "PVC 12mm" ($225/sheet, $120/sheet cutting)
- Other materials as configured in database

Lookup:
material_pricing = substrate_cut_pricing_map[field2_value]

Examples:
- Input: "Acrylic 12mm" → Uses Acrylic 12mm pricing
- Input: "PVC 12mm" → Uses PVC 12mm pricing
- Input: "" (empty) → No base substrate calculated
```

### 2. Dimension Processing
**Business Logic**: Parse XY dimensions for backing panel as entered (no sorting)

```
Step 1: Parse dimensions
dimensions = input.split("x")

Step 2: Extract width and height
IF dimensions.length === 2:
    width = dimensions[0]
    height = dimensions[1]
ELSE:
    // field1 accepts either dimensions (WxH) OR total square inches as float

Example: "24x18" → Width=24", Height=18" (as entered)
Example: "18x24" → Width=18", Height=24" (different from above - no sorting)
```

### 3. Area Calculation with Waste
**Business Logic**: 21% waste factor for cutting efficiency

```
Formula: area_sqft = ROUNDUP((width * height) * 1.21 / 144, 0)

Calculation Steps:
- Calculate raw area: width * height (in square inches)
- Apply 21% waste factor: raw_area * 1.21
- Convert to square feet: waste_area / 144
- Round up to nearest whole sqft

Example: 24" × 18" backing panel
- raw_area = 24 * 18 = 432 sq in
- waste_area = 432 * 1.21 = 522.72 sq in
- area_sqft = ROUNDUP(522.72 / 144, 0) = ROUNDUP(3.63, 0) = 4 sqft
```

### 4. Base Material Cost Calculation
**Business Logic**: Enhanced substrate calculation with 1.5× multipliers

```
Formula: ROUNDUP(sheets_needed * (material_cost * MAT_MARKUP + cut_rate * 1.5) + 
                sheets_count * (MAT_BASE + CUT_BASE * 1.5), 0)

Where:
- sheets_needed = area_sqft / 32  (32 sqft per sheet)
- sheets_count = ROUNDUP(area_sqft / 32, 0)

Calculation Steps:
1. Material cost component: sheets_needed * (sheet_cost * 1.25 + cut_rate * 1.5)
2. Base cost component: sheets_count * ($50 + $30 * 1.5)
3. Total: ROUNDUP(component1 + component2, 0)

Example: 4 sqft Acrylic 12mm backing
- sheets_needed = 4 / 32 = 0.125 sheets
- sheets_count = ROUNDUP(0.125, 0) = 1 sheet
- component1 = 0.125 * ($370 * 1.25 + $120 * 1.5) = 0.125 * $642.50 = $80.31
- component2 = 1 * ($50 + $30 * 1.5) = 1 * $95 = $95
- base_cost = ROUNDUP($80.31 + $95, 0) = $175
```

### 5. LED Length Processing
**Business Logic**: Convert inches to feet for linear pricing (exact division, no rounding for precision)

```
LED_length_feet = LED_length_inches / 12

LED_cost = LED_length_feet * LED_price_per_foot
LED_cost = LED_length_feet * $11.00

LED_watts = LED_length_feet * LED_watts_per_foot
LED_watts = LED_length_feet * 4.8W

Example: 120" LED length
- LED_length_feet = 120 / 12 = 10.0 feet
- LED_cost = 10.0 * $11.00 = $110.00
- LED_watts = 10.0 * 4.8W = 48W

Example: 125" LED length
- LED_length_feet = 125 / 12 = 10.417 feet (exact division)
- LED_cost = 10.417 * $11.00 = $114.58
- LED_watts = 10.417 * 4.8W = 50.0W
```

### 6. Opacity & Solder Logic
**Business Logic**: Material and opacity determine solder type

```
Opacity Detection:
IF opacity_input is empty:
    is_opaque = FALSE (clear)
ELSE:
    is_opaque = TRUE (opaque)

Solder Type Selection:
IF is_opaque OR material_type = "PVC 12mm":
    solder_price = $7.00  (opaque solders)
ELSE:
    solder_price = $14.00  (clear solders)

Solder Cost:
solder_cost = solder_count * solder_price

Examples:
- Clear Acrylic: 5 solders × $14.00 = $70.00
- Opaque Acrylic: 5 solders × $7.00 = $35.00
- PVC (any): 5 solders × $7.00 = $35.00
```

### 7. Power Supply Calculation
**Uses powerSupplySelector.ts with smart optimization logic**

```
Step 1: Calculate total wattage
total_watts = LED_length_feet * 4.8W

Step 2: Handle field7 PS# override
IF field7 = "no" OR field7 = 0:
    Skip power supplies entirely
ELSE IF field7 = "yes":
    Use auto-calculation (proceed to Step 3)
ELSE IF field7 is a number > 0:
    Use that exact count with appropriate default PS (Speedbox 60W if optimizing, else customer pref/default non-UL)
ELSE:
    Use auto-calculation (proceed to Step 3)

Step 3: Determine if UL optimization applies
use_optimization = UL_required OR customer_pref_PS_is_Speedbox_60W

Step 4: Power supply selection hierarchy
IF use_optimization = TRUE:
    // UL Optimization Algorithm (PS#2 Speedbox 60W + PS#3 Speedbox 150W combo)
    remainder = total_watts % PS3_watts
    IF remainder = 0:
        ps3_count = total_watts / PS3_watts
        ps2_count = 0
    ELSE IF remainder < PS2_watts:
        ps2_count = 1
        ps3_count = FLOOR(total_watts / PS3_watts)
    ELSE:
        ps3_count = CEIL(total_watts / PS3_watts)
        ps2_count = 0

    total_cost = (ps2_count * PS2_price) + (ps3_count * PS3_price)
ELSE:
    // Standard Selection
    IF customer_has_preferred_PS:
        ps_type = customer_pref_PS_type
    ELSE:
        ps_type = default_non_UL_PS

    ps_count = CEIL(total_watts / ps_watts)
    total_cost = ps_count * ps_price

Examples:
- 48W, UL required: Uses 1× Speedbox 60W (optimization)
- 180W, UL required: Uses 1× Speedbox 150W + 1× Speedbox 60W (optimization)
- 48W, customer prefers Speedbox 60W: Uses 1× Speedbox 60W (optimization triggered by preference)
- 48W, no UL, different preference: Uses customer's preferred PS or default non-UL
- Field7 = "2", UL required: Uses 2× Speedbox 60W (numeric override with optimization)
- Field7 = "no": Skip all power supplies (explicit user override)
```

### 8. Standoff Cost Calculation
**Simple Linear Pricing**

```
standoff_cost = standoff_quantity * $15.00

Example: 8 standoffs
standoff_cost = 8 × $15.00 = $120
```

## Input Processing Examples

### Material Selection Examples
```
Input: "" (empty) → "Acrylic 12mm"
Input: FALSE → "Acrylic 12mm"  
Input: "1" → "PVC 12mm"
Input: "PVC" → "PVC 12mm"
Input: TRUE → "PVC 12mm"
```

### Complete LED Neon Example
**Input Set:**
- Dimensions: "24x18"
- LED Length: "120" inches
- Material: "Acrylic 12mm"
- Opacity: "opaque"
- Solders: "5"
- Standoffs: "8"

**Calculations:**
```
1. Material: "Acrylic 12mm"
2. Area: 24×18 with 21% waste = 4 sqft
3. Base Cost: $175 (material + cutting with 1.5× multipliers)
4. LED: 10 feet × $11.00 = $110
5. Solders: 5 solders × $7.00 = $35 (opaque pricing)
6. Power Supplies: Calculated via powerSupplySelector (varies by customer prefs/UL)
7. Standoffs: 8 × $15.00 = $120

Total: $440 + Power Supplies
```

### Solder Pricing Examples
```
Clear Acrylic + Clear: 5 solders × $14.00 = $70
Clear Acrylic + Opaque: 5 solders × $7.00 = $35
PVC + Clear: 5 solders × $7.00 = $35 (PVC forces opaque pricing)
PVC + Opaque: 5 solders × $7.00 = $35
```

## Error Handling

### Input Validation
```
Dimensions: 
- Single value → square (24 → 24×24)
- Two values → rectangle (24×18)
- Empty → no backing panel cost

LED Length:
- Must be numeric inches
- Converts to feet (rounds up)

Material Selection:
- Any non-empty value → PVC
- Empty/FALSE → Acrylic

Quantities:
- Solders, Standoffs must be numeric
- Default to 0 if empty
```

### Override Capability
```
All calculated values support manual override:
IF manual_input provided:
    Use manual_input
ELSE:  
    Use calculated_value
```

## Database Schema Requirements

```sql
CREATE TABLE led_neon_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO led_neon_pricing_config VALUES
(1, 'LED_NEON_PRICE_PER_FOOT', 11.0000, 'LED neon strip cost per foot', '2025-09-01', true),
(2, 'LED_NEON_WATTS_PER_FOOT', 4.8000, 'LED neon power per foot', '2025-09-01', true),
(3, 'STANDOFF_COST_EACH', 15.0000, 'Cost per standoff', '2025-09-01', true),
(4, 'CONNECTION_CLEAR_PRICE', 14.0000, 'Clear acrylic connection cost', '2025-09-01', true),
(5, 'CONNECTION_OPAQUE_PRICE', 7.0000, 'Opaque connection cost', '2025-09-01', true),
(6, 'WASTE_MULTIPLIER', 1.1000, 'Waste factor for dimensions', '2025-09-01', true),
(7, 'MATERIAL_MULTIPLIER', 1.5000, 'Enhanced cutting rate multiplier', '2025-09-01', true),
(8, 'SHEETS_PER_SQFT', 0.03125, 'Sheets needed per sqft (1/32)', '2025-09-01', true);

CREATE TABLE led_neon_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_name VARCHAR(50) UNIQUE NOT NULL,
  material_code VARCHAR(20) UNIQUE NOT NULL,
  sheet_cost DECIMAL(8,4) NOT NULL,
  cut_rate DECIMAL(8,4) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO led_neon_materials VALUES
(1, 'Acrylic 12mm', 'ACRYL_12', 370.0000, 120.0000, true, '2025-09-01', true),
(2, 'PVC 12mm', 'PVC_12', 225.0000, 120.0000, false, '2025-09-01', true);
```

## Business Logic Summary

**Key Components:**
1. **Material Selection**: Default Acrylic, any input = PVC
2. **Enhanced Substrate**: Uses substrate logic with 1.5× cutting multipliers  
3. **Linear LED Pricing**: $11/foot with inches-to-feet conversion
4. **Smart Solders**: Material + opacity determine solder type/price
5. **Solder Integration**: Solder count × solder price
6. **Standoff Pricing**: Simple linear at $15 each
7. **Power Supply Logic**: Complex multi-path selection (see powerSupplySelector.ts)

**Sophistication:**
- **Waste Management**: 21% dimensional waste (1.21 multiplier)
- **Material Intelligence**: PVC forces opaque pricing regardless of opacity input
- **Enhanced Costing**: 1.5× multipliers on cutting rates vs standard substrate
- **Length Flexibility**: Inches input, feet pricing, exact division (no rounding)
- **Complex Power Supply Logic**: Multi-path selection with UL optimization (see powerSupplySelector.ts)

This documentation captures the complete LED Neon pricing system with material selection, enhanced substrate calculations, linear LED pricing, and intelligent connection logic.