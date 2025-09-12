# Push Thru Pricing Calculations - Complete Documentation

## Overview

The Push Thru system is one of the most complex multi-component pricing categories, combining aluminum/ACM backer calculations with acrylic faces, LED installations, transformers, cutting, and assembly. The key feature is the box multiplier - typically 2 boxes are needed: one face box with acrylic letters and one back box for LEDs.

## Rate Structure (Shared & Unique Tables)

### Shared Tables (from Backer System)
- **Aluminum Backer Table**: B166-F169 (same as Backer documentation)
- **ACM Backer Table**: H166-O171 (same as Backer documentation)
- **Substrate Material Costs**: B139-D162 (Acrylic 12mm, Polycarbonate rates)

### Push Thru Specific Rates (B199-C202)
| Rate Code | Value | Description |
|-----------|-------|-------------|
| PUSH_THRU_CUT | $70 | Push thru cutting rate |
| ASSEMBLY_MULTIPLIER | $80 | Assembly cost × area multiplier |
| ASSEMBLY_BASE | $50 | Base assembly cost |

### Configuration Rates (from Substrate System)
| Rate Code | Value | Description | Cell Ref |
|-----------|-------|-------------|----------|
| MAT_BASE | $50 | Material base cost | $I$139 |
| MAT_MARKUP | 1.25 | Material markup multiplier | $I$140 |
| CUT_BASE | $30 | Cutting base cost | $I$141 |

## Calculation Logic

### 1. Material Selection
**Business Logic**: Choose between Aluminum (3D with depth) or ACM (flat panel)

```
Material Input Processing:
- "0", "", "Alu", "Alum" → "Alu" (Aluminum)
- "1", "ACM" → "ACM" (Aluminum Composite Material)

Dimension Requirements:
- Aluminum: Requires XYZ (3 dimensions with depth for folding)
- ACM: Requires XY (2 dimensions, flat panel)
```

### 2. Box Multiplier System
**Business Logic**: Typically 2 boxes - face box (acrylic) + back box (LEDs)

```
Box Multiplier Logic:
Default: 2 boxes (if input empty)
Common Values: 1, 1.25, 1.5, 2

Effect on Costs:
- Aluminum Cost = base_aluminum_cost × box_multiplier  
- ACM Cost = base_acm_cost × box_multiplier
- Does NOT affect acrylic, LEDs, or assembly (those are per-sign)
```

### 3. Main Backer Calculation (Aluminum)
**Uses same logic as Backer system with box multiplier**

```
Step 1: Parse and sort dimensions (XYZ required)
dimensions = TEXTSPLIT(input, "x") // Must be 3 dimensions
sorted_xy = SORT([X, Y], -1, TRUE)
final_dims = [sorted_xy[0], sorted_xy[1], Z]

Step 2: Calculate lookup keys with folded edges
lookup_width = Width + (Depth × 2)
lookup_height = Height + (Depth × 2)

Step 3: Apply box multiplier
aluminum_cost = base_aluminum_cost × box_multiplier

Example: "24x18x3" aluminum, 2 boxes
- Parse: [24, 18, 3]
- Sort X,Y: [24, 18] (24≥18), keep Z=3  
- lookup_width = 24 + (3×2) = 30"
- lookup_height = 18 + (3×2) = 24"
- base_cost = lookup_price_for_30x24
- final_cost = base_cost × 2 = double cost for 2 boxes
```

### 4. Main Backer Calculation (ACM)  
**Uses Backer ACM system with box multiplier**

```
Step 1: Parse and sort XY dimensions only
dimensions = TEXTSPLIT(input, "x") // Must be 2 dimensions  
sorted_dims = SORT([X, Y], -1, TRUE)

Step 2: Direct lookup (no depth folding)
acm_cost = base_acm_cost × box_multiplier

Example: "36x24" ACM, 2 boxes
- Parse: [36, 24]
- Sort: [36, 24] (36≥24)
- base_cost = lookup_price_for_36x24  
- final_cost = base_cost × 2 = double cost for 2 boxes
```

### 5. Acrylic Face Calculation
**Business Logic**: 12mm Acrylic with +3" waste allowance

```
Step 1: Parse acrylic dimensions (XY only)
dimensions = TEXTSPLIT(input, "x") // Must be 2 dimensions
sorted_dims = SORT([X, Y], -1, TRUE) // Width ≥ Height

Step 2: Material cost calculation  
waste_width = Width + 3"
waste_height = Height + 3"  
area_sqft = (waste_width × waste_height) / 144
sheets_needed = area_sqft / 32  // 32 sqft per sheet

acrylic_material_cost = MAT_BASE + (sheets_needed × acrylic_sheet_cost × MAT_MARKUP)
acrylic_material_cost = $50 + (sheets_needed × $370 × 1.25)

Step 3: Cutting cost calculation (if not overridden)
area_sqft_actual = (Width × Height) / 144
sheets_for_cutting = ROUNDUP(area_sqft_actual / 32, 0)
acrylic_cutting_cost = ROUNDUP(sheets_for_cutting × CUT_BASE + area_sqft_actual × acrylic_cut_rate, 0)
acrylic_cutting_cost = ROUNDUP(sheets × $30 + sqft × $120, 0)

Example: "20x14" acrylic face
- Waste dimensions: 23" × 17"  
- Area: (23 × 17) / 144 = 2.71 sqft
- Sheets: 2.71 / 32 = 0.085 sheets
- Material: $50 + (0.085 × $370 × 1.25) = $89.31
- Cutting area: (20 × 14) / 144 = 1.94 sqft  
- Cutting: ROUNDUP(1 × $30 + 1.94 × $120, 0) = $263
```

### 6. LED Count Calculation  
**Business Logic**: 5% of area with 21% waste buffer

```
Formula: ROUNDUP(width × height × 1.1 × 1.1 × 5 / 100, 0)

Breakdown:
- width × height = area in square inches
- × 1.1 × 1.1 = 21% total waste/buffer (1.1² = 1.21)
- × 5 / 100 = 5% LED density (5 LEDs per 100 sq in)  
- ROUNDUP = round up to whole LEDs

Example: "20x14" LED area
- Area: 20 × 14 = 280 sq in
- With waste: 280 × 1.21 = 338.8 sq in
- LED count: ROUNDUP(338.8 × 0.05, 0) = ROUNDUP(16.94, 0) = 17 LEDs
```

### 7. Lexan (Polycarbonate) Calculation
**Business Logic**: +2" waste allowance, different material cost**

```
Step 1: Same area calculation as acrylic
waste_width = Width + 2"  // Less waste than acrylic
waste_height = Height + 2"
area_sqft = (waste_width × waste_height) / 144  
sheets_needed = area_sqft / 32

Step 2: Material cost (Polycarbonate rates)
polycarbonate_sheet_cost = $110 (from substrate table)
polycarbonate_cut_rate = $70 (from substrate table)

lexan_cost = ROUNDUP(sheets × CUT_BASE + area_sqft × (polycarbonate_sheet_cost × MAT_MARKUP + polycarbonate_cut_rate), 0)
lexan_cost = ROUNDUP(sheets × $30 + sqft × ($110 × 1.25 + $70), 0)  
lexan_cost = ROUNDUP(sheets × $30 + sqft × $207.50, 0)
```

### 8. Assembly Cost Calculation
**Business Logic**: Base + area multiplier**

```
Formula: ROUNDUP(sheets × ASSEMBLY_MULTIPLIER + area_sqft × ASSEMBLY_COST_RATE, 0)

Where:
- sheets = ROUNDUP(area_sqft / 32, 0)  
- ASSEMBLY_MULTIPLIER = $80 per sheet
- ASSEMBLY_COST_RATE = $50 per sqft

Example: "20x14" assembly  
- Area: (20 × 14) / 144 = 1.94 sqft
- Sheets: ROUNDUP(1.94 / 32, 0) = 1 sheet
- Assembly: ROUNDUP(1 × $80 + 1.94 × $50, 0) = ROUNDUP($177, 0) = $177
```

### 9. Transformer & UL Integration
**Uses same logic as Channel Letters**
- LED wattage calculation based on LED count and type
- Transformer selection based on total wattage  
- UL costs follow job-level logic ($150 first + $50 additional)

## Input Processing Examples

### Complete Push Thru Example
```
Input Set:
- Material: "0" (Aluminum)  
- Boxes: "2" (face + back boxes)
- Main Dimensions: "24x18x3"  
- Acrylic: "20x14"
- LEDs: (calculated from acrylic area)

Calculations:
1. Aluminum: 24x18x3 → lookup + folding × 2 boxes
2. Acrylic: 20x14 → material + cutting  
3. LEDs: 17 LEDs (from 20×14 area calculation)
4. Assembly: Based on acrylic area
5. Transformers: Based on total LED wattage
```

### Material Selection Examples
```
Aluminum Input: "0", "", "Alu", "Alum" 
- Requires: XYZ dimensions (e.g., "24x18x3")
- Uses: Aluminum backer table with folding logic

ACM Input: "1", "ACM"
- Requires: XY dimensions (e.g., "36x24")  
- Uses: ACM backer table, flat panel pricing
```

### Box Multiplier Examples
```
Input: "" (empty) → Default: 2 boxes
Input: "1" → Single box (face only)
Input: "1.5" → 1.5× cost (partial second box)  
Input: "2" → Standard double box (face + back)
```

## Error Handling

### Dimension Validation
```
Aluminum Errors:
- "24x18" → empty (needs XYZ for folding calculation)
- "24x18x3x2" → empty (max 3 dimensions)

ACM Errors:  
- "24" → empty (needs XY dimensions)
- "24x18x3" → empty (ACM is flat, max 2 dimensions)

Acrylic/Lexan Errors:
- "24" → single value, treated as cost override
- "24x18x3" → empty (max 2 dimensions for faces)
```

### Component Integration
```
LED Count Dependency: Requires acrylic dimensions
Transformer Dependency: Requires LED count and type
Assembly Dependency: Requires acrylic area calculation
```

## Database Schema Requirements

```sql
CREATE TABLE push_thru_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Configuration data
INSERT INTO push_thru_pricing_config VALUES
(1, 'PUSH_THRU_CUT_RATE', 70.0000, 'Push thru cutting rate', '2025-09-01', true),
(2, 'ASSEMBLY_PER_SHEET', 80.0000, 'Assembly cost per sheet', '2025-09-01', true), 
(3, 'ASSEMBLY_BASE_RATE', 50.0000, 'Base assembly rate per sqft', '2025-09-01', true),
(4, 'LED_DENSITY_PERCENT', 5.0000, 'LEDs per 100 sq inches', '2025-09-01', true),
(5, 'LED_WASTE_MULTIPLIER', 1.21, 'Waste factor (1.1 × 1.1)', '2025-09-01', true),
(6, 'ACRYLIC_WASTE_INCHES', 3.0000, 'Waste allowance for acrylic', '2025-09-01', true),
(7, 'LEXAN_WASTE_INCHES', 2.0000, 'Waste allowance for lexan', '2025-09-01', true),
(8, 'DEFAULT_BOX_MULTIPLIER', 2.0000, 'Default box count (face + back)', '2025-09-01', true);
```

## Business Logic Summary

**Key Components**:
1. **Dual Box System**: Face box (acrylic) + back box (LEDs) = 2× backer cost
2. **Material Choice**: Aluminum (3D with folding) vs ACM (flat panel)  
3. **Acrylic Faces**: 12mm acrylic with +3" waste, separate cutting costs
4. **LED Integration**: 5% density with 21% waste buffer, calculated from face area
5. **Lexan Option**: Polycarbonate alternative with +2" waste  
6. **Assembly Scaling**: Base rate + per-sheet multiplier
7. **Component Integration**: LEDs → transformers → UL (using Channel Letter logic)

This documentation captures the complete Push Thru pricing system, showing how it combines Backer calculations with sophisticated multi-component integration for acrylic faces, LED systems, and assembly processes.