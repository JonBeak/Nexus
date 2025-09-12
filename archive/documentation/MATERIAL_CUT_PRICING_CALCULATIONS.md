# Material Cut Pricing Calculations - Complete Documentation

## Overview

The Material Cut system handles raw material cutting for extrusions and substrates plus design services. Extrusions use 100-inch increment pricing with waste buffers, while substrates use a sophisticated dual-rate system with setup fees per sheet started plus material costs for actual usage.

## Rate Structure (Configurable Values)

### Extrusion Cutting Rates
| Material Type | Rate | Description |
|---------------|------|-------------|
| 3" Raw | $15.00 | Per 100-inch increment |
| 3" Primed | $19.00 | Per 100-inch increment |
| 4" | $15.50 | Per 100-inch increment |
| 5" | $16.00 | Per 100-inch increment |
| Trim | $10.00 | Per 100-inch increment |

### Substrate Cutting Rates (Corrected Formula)
| Material | Setup Fee | Material Rate | Net Rate |
|----------|-----------|---------------|----------|
| PC (Polycarbonate) | $190.00 | $160.00 | ($190 - $30) |
| ACM | $120.00 | $100.00 | ($120 - $20) |

### Design Services
| Service | Rate | Description |
|---------|------|-------------|
| Design | $30.00 | Per unit/project |

## Calculation Logic

### 1. Extrusion Cutting Calculations
**Business Logic**: 118" material length with 100" usable (18" waste buffer)

```
Extrusion Cost Formula:
units_needed = ROUNDUP(linear_inches / 100, 0)
extrusion_cost = units_needed × rate_per_unit

Waste Logic:
- Physical material: 118" lengths
- Usable material: 100" (allows 18" waste for cutting efficiency)
- Always round up to whole units

Examples:
3" Raw - Input: 250"
- units_needed = ROUNDUP(250 / 100, 0) = 3 units
- cost = 3 × $15.00 = $45.00
- Description: "3x 3in Raw@$15"

4" - Input: 180"  
- units_needed = ROUNDUP(180 / 100, 0) = 2 units
- cost = 2 × $15.50 = $31.00
- Description: "2x 4in@$15.5"
```

### 2. Substrate Cutting Calculations (Corrected System)
**Business Logic**: Setup fee per sheet started + material cost for actual usage

```
Corrected Formula:
sheets_needed = input_area / 96  // 96 sq in per sheet
sheets_started = CEILING(sheets_needed)  // Round up for setup fees
setup_cost = sheets_started × setup_fee
material_cost = sheets_needed × material_rate  
total_cost = setup_cost + material_cost

Rate Structure:
- PC: Setup $190/sheet, Material $160/sheet ($190 - $30)
- ACM: Setup $120/sheet, Material $100/sheet ($120 - $20)

Example: PC - Input: 220 sq in
- sheets_needed = 220 / 96 = 2.29 sheets
- sheets_started = CEILING(2.29) = 3 sheets
- setup_cost = 3 × $190 = $570
- material_cost = 2.29 × $160 = $366.40
- total_cost = $570 + $366.40 = $936.40
- Description: "220x48in PC@$190" (showing area and rate)

Example: ACM - Input: 150 sq in  
- sheets_needed = 150 / 96 = 1.56 sheets
- sheets_started = CEILING(1.56) = 2 sheets  
- setup_cost = 2 × $120 = $240
- material_cost = 1.56 × $100 = $156
- total_cost = $240 + $156 = $396
- Description: "150x48in ACM@$120"
```

### 3. Design Services Calculation
**Simple Linear Pricing**

```
Design Cost Formula:
design_cost = quantity × $30.00

Example: 2 design projects
- cost = 2 × $30.00 = $60.00  
- Description: "2x Design@$30"
```

## Input Processing Examples

### Extrusion Input Examples
```
3" Raw: Input = 350"
- Units: ROUNDUP(350/100, 0) = 4 units
- Cost: 4 × $15 = $60
- Description: "4x 3in Raw@$15"

Trim: Input = 85"
- Units: ROUNDUP(85/100, 0) = 1 unit  
- Cost: 1 × $10 = $10
- Description: "1x Trim@$10"

Multiple Materials: 3"Raw=200", 4"=150", 5"=300"
- 3" Raw: 2 units × $15 = $30
- 4": 2 units × $15.50 = $31  
- 5": 3 units × $16 = $48
- Total: $109
- Description: "2x 3in Raw@$15, 2x 4in@$15.5, 3x 5in@$16"
```

### Substrate Input Examples (Corrected System)
```
PC: Input = 288 sq in (exactly 3 sheets)
- sheets_needed = 288/96 = 3.0 sheets
- sheets_started = 3 sheets
- setup_cost = 3 × $190 = $570
- material_cost = 3.0 × $160 = $480
- total_cost = $1,050
- Description: "288x48in PC@$190"

ACM: Input = 50 sq in (partial sheet)
- sheets_needed = 50/96 = 0.52 sheets  
- sheets_started = 1 sheet
- setup_cost = 1 × $120 = $120
- material_cost = 0.52 × $100 = $52
- total_cost = $172
- Description: "50x48in ACM@$120"
```

### Complete Material Cut Example
**Input Set:**
- 3" Raw: 400"
- 4": 275"  
- PC: 180 sq in
- ACM: 75 sq in
- Design: 1

**Calculations:**
```
Extrusions:
1. 3" Raw: ROUNDUP(400/100,0) × $15 = 4 × $15 = $60
2. 4": ROUNDUP(275/100,0) × $15.50 = 3 × $15.50 = $46.50
   Extrusion Total: $106.50

Substrates:
3. PC: 180/96 = 1.875 sheets
   - Setup: 2 sheets × $190 = $380  
   - Material: 1.875 × $160 = $300
   - PC Total: $680

4. ACM: 75/96 = 0.78 sheets
   - Setup: 1 sheet × $120 = $120
   - Material: 0.78 × $100 = $78  
   - ACM Total: $198
   Substrate Total: $878

Design:
5. Design: 1 × $30 = $30

Grand Total: $106.50 + $878 + $30 = $1,014.50
```

## Business Logic Comparison

### Current Excel vs Corrected System

**Current Excel (Incorrect):**
```
PC: whole_sheets × $190 + fractional × ($190 - $30)
2.3 sheets = 2 × $190 + 0.3 × $160 = $380 + $48 = $428
```

**Corrected System:**
```
PC: sheets_started × $190 + total_sheets × $160  
2.3 sheets = 3 × $190 + 2.3 × $160 = $570 + $368 = $938
```

**Why the Correction Makes Business Sense:**
- **Setup Fee**: You pay to start each sheet (3 sheets started = 3 setup fees)
- **Material Cost**: You pay for actual material used (2.3 sheets worth)
- **Realistic Costing**: Reflects true cost structure of sheet-based operations

## Error Handling

### Input Validation
```
Extrusions:
- Empty/zero input → no cost, no description
- Negative input → treat as zero
- Non-numeric → treat as zero

Substrates:  
- Empty/zero input → no cost, no description
- Negative input → treat as zero
- Non-numeric → treat as zero
- Minimum 1 sq in for meaningful calculation

Design:
- Empty/zero input → no cost, no description
- Non-numeric → treat as zero
- Supports fractional quantities (0.5 design projects)
```

### Calculation Safeguards
```
Extrusions:
- Always round up to whole units (no partial 100" increments)
- Minimum 1 unit if any input provided

Substrates:
- Always round up sheets_started for setup fees
- Use exact decimal for material calculations
- Handle edge cases (very small areas)
```

## Database Schema Requirements

```sql
CREATE TABLE material_cut_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO material_cut_pricing_config VALUES
(1, 'EXTRUSION_3IN_RAW_RATE', 15.0000, '3 inch raw extrusion per 100 inches', '2025-09-01', true),
(2, 'EXTRUSION_3IN_PRIMED_RATE', 19.0000, '3 inch primed extrusion per 100 inches', '2025-09-01', true),
(3, 'EXTRUSION_4IN_RATE', 15.5000, '4 inch extrusion per 100 inches', '2025-09-01', true),
(4, 'EXTRUSION_5IN_RATE', 16.0000, '5 inch extrusion per 100 inches', '2025-09-01', true),
(5, 'EXTRUSION_TRIM_RATE', 10.0000, 'Trim extrusion per 100 inches', '2025-09-01', true),
(6, 'SUBSTRATE_PC_SETUP_FEE', 190.0000, 'PC setup fee per sheet started', '2025-09-01', true),
(7, 'SUBSTRATE_PC_MATERIAL_RATE', 160.0000, 'PC material rate per sheet', '2025-09-01', true),
(8, 'SUBSTRATE_ACM_SETUP_FEE', 120.0000, 'ACM setup fee per sheet started', '2025-09-01', true),
(9, 'SUBSTRATE_ACM_MATERIAL_RATE', 100.0000, 'ACM material rate per sheet', '2025-09-01', true),
(10, 'DESIGN_RATE', 30.0000, 'Design service rate', '2025-09-01', true),
(11, 'EXTRUSION_INCREMENT_INCHES', 100.0000, 'Usable inches per extrusion unit', '2025-09-01', true),
(12, 'SUBSTRATE_SQIN_PER_SHEET', 96.0000, 'Square inches per substrate sheet', '2025-09-01', true);
```

## Business Logic Summary

**Key Features:**
1. **Extrusion Waste Management**: 100" usable from 118" material (18" waste buffer)
2. **Substrate Dual Pricing**: Setup fee per sheet started + material cost per sheet used
3. **Unit Standardization**: 100" increments (extrusions), 96 sq in sheets (substrates)
4. **Conservative Rounding**: Always round up units to ensure adequate material
5. **Flexible Design Pricing**: Simple per-unit design service charges

**Corrected Substrate Logic:**
- **Setup Fees**: Pay for every sheet you have to start (ceiling function)
- **Material Costs**: Pay for exact amount of material used (decimal precision)
- **Business Reality**: Reflects actual manufacturing cost structure

This documentation captures the complete Material Cut pricing system with corrected substrate pricing that properly accounts for both setup fees and material usage costs.