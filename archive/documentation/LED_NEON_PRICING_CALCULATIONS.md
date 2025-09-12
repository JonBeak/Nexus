# LED Neon Pricing Calculations - Complete Documentation

## Overview

The LED Neon system calculates pricing for LED neon installations with custom-cut backing panels (PVC or Acrylic), LED neon strip integration, connections, welding, standoffs, and transformers. The system uses length-based pricing with sophisticated material calculations and connection logic.

## Rate Structure (Configurable Values)

### LED Neon Specific Rates
| Component | Rate | Description |
|-----------|------|-------------|
| LED Neon Price | $11.00/ft | LED neon strip cost per foot |
| LED Neon Watts | 4.8W/ft | Power consumption per foot |
| Standoff Cost | $15.00 | Cost per standoff |

### Connection Pricing (B213-C215)
| Connection Type | Price | Usage |
|-----------------|-------|--------|
| Clear Acrylic Connections | $14.00 | Default (clear acrylic + not opaque) |
| Opaque Connections | $7.00 | Opaque acrylic or PVC material |

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
**Business Logic**: Default Acrylic, any input switches to PVC

```
Material Selection Logic:
IF material_input is empty OR material_input = FALSE:
    material_type = "Acrylic 12mm"
ELSE:
    material_type = "PVC 12mm"

Material Properties Lookup:
material_sheet_cost = VLOOKUP(material_type, substrate_table, sheet_cost_column)
material_cut_rate = VLOOKUP(material_type, substrate_table, cut_rate_column)

Examples:
- Input: "" (empty) → "Acrylic 12mm" ($370 sheet, $120 cut)
- Input: "1" → "PVC 12mm" ($225 sheet, $120 cut)
- Input: "PVC" → "PVC 12mm" ($225 sheet, $120 cut)
```

### 2. Dimension Processing
**Business Logic**: Parse XY dimensions for backing panel, sort largest first

```
Step 1: Parse and sort dimensions
dimensions = TEXTSPLIT(input, "x")
sorted_dims = SORT(dimensions, -1, TRUE)

Step 2: Extract width and height
IF COLUMNS(dimensions) >= 1:
    width = sorted_dims[0]
    IF COLUMNS(dimensions) >= 2:
        height = sorted_dims[1]
    ELSE:
        height = width  // Square if only one dimension

Example: "24x18" → Width=24", Height=18"
Example: "36" → Width=36", Height=36"
```

### 3. Area Calculation with Waste
**Business Logic**: 10% waste factor for cutting efficiency

```
Formula: area_sqft = ROUNDUP(width * 1.1 * height * 1.1 / 144, 0)

Calculation Steps:
- waste_width = width * 1.1  (10% waste)
- waste_height = height * 1.1  (10% waste)
- area_sqft = ROUNDUP(waste_width * waste_height / 144, 0)

Example: 24" × 18" backing panel
- waste_width = 24 * 1.1 = 26.4"
- waste_height = 18 * 1.1 = 19.8"
- area_sqft = ROUNDUP(26.4 * 19.8 / 144, 0) = ROUNDUP(3.63, 0) = 4 sqft
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
**Business Logic**: Convert inches to feet for linear pricing

```
LED_length_feet = ROUNDUP(LED_length_inches / 12, 0)

LED_cost = LED_length_feet * LED_price_per_foot
LED_cost = LED_length_feet * $11.00

LED_watts = LED_length_feet * LED_watts_per_foot  
LED_watts = LED_length_feet * 4.8W

Example: 120" LED length
- LED_length_feet = ROUNDUP(120 / 12, 0) = 10 feet
- LED_cost = 10 * $11.00 = $110
- LED_watts = 10 * 4.8W = 48W
```

### 6. Opacity & Connection Logic
**Business Logic**: Material and opacity determine connection type

```
Opacity Detection:
IF opacity_input is empty:
    is_opaque = FALSE (clear)
ELSE:
    is_opaque = TRUE (opaque)

Connection Type Selection:
IF is_opaque OR material_type = "PVC 12mm":
    connection_price = $7.00  (opaque connections)
ELSE:
    connection_price = $14.00  (clear acrylic connections)

Connection Cost:
connection_cost = weld_count * connection_price

Examples:
- Clear Acrylic: 5 welds × $14.00 = $70.00
- Opaque Acrylic: 5 welds × $7.00 = $35.00  
- PVC (any): 5 welds × $7.00 = $35.00
```

### 7. Transformer Calculation
**Uses Channel Letter Logic with LED wattage**

```
Step 1: Calculate total wattage
total_watts = LED_length_feet * 4.8W

Step 2: Select transformer type
IF total_watts > 50W:
    transformer_type = "Speedbox 150W"
ELSE:
    transformer_type = "Speedbox 60W"

Step 3: Calculate quantity needed
transformers_needed = ROUNDUP(total_watts / transformer_rated_watts, 0)
transformer_cost = transformers_needed * transformer_price

Example: 10 feet LED neon (48W)
- Transformer: "Speedbox 60W" (under 50W threshold)
- Quantity: ROUNDUP(48W / 60W, 0) = 1 transformer
- Cost: 1 × $120 = $120
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
- Material: "" (empty = Acrylic)
- Opacity: "opaque"
- Welds: "5"  
- Standoffs: "8"

**Calculations:**
```
1. Material: "Acrylic 12mm" (default)
2. Area: 24×18 with 10% waste = 4 sqft
3. Base Cost: $175 (material + cutting with 1.5× multipliers)
4. LED: 10 feet × $11.00 = $110
5. Connections: 5 welds × $7.00 = $35 (opaque pricing)
6. Transformers: 1 Speedbox 60W = $120  
7. Standoffs: 8 × $15.00 = $120

Total: $560
```

### Connection Pricing Examples
```
Clear Acrylic + Clear: 5 welds × $14.00 = $70
Clear Acrylic + Opaque: 5 welds × $7.00 = $35
PVC + Clear: 5 welds × $7.00 = $35 (PVC forces opaque pricing)
PVC + Opaque: 5 welds × $7.00 = $35
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
- Welds, Standoffs must be numeric
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
4. **Smart Connections**: Material + opacity determine connection type/price
5. **Welding Integration**: Connection count × connection price
6. **Standoff Pricing**: Simple linear at $15 each
7. **Transformer Logic**: Same as Channel Letters (Speedbox selection)

**Sophistication:**
- **Waste Management**: 10% dimensional waste (1.1 × 1.1)
- **Material Intelligence**: PVC forces opaque pricing regardless of opacity input
- **Enhanced Costing**: 1.5× multipliers on cutting rates vs standard substrate
- **Length Flexibility**: Inches input, feet pricing, automatic conversion

This documentation captures the complete LED Neon pricing system with material selection, enhanced substrate calculations, linear LED pricing, and intelligent connection logic.