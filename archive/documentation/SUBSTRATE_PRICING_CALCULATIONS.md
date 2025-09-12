# Substrate Pricing Calculations - Complete Documentation

## Rate Structure (Configurable Values)

### Substrate Material Types (B139-D162)
| Material | Sheet 4x8 Cost | Cut Rate | 4x10 Cut | 5x10 Cut |
|----------|----------------|----------|----------|----------|
| Acrylic 3mm | $125 | $70 | - | - |
| Acrylic 4.5mm | $195 | $70 | - | - |
| Acrylic 6mm | $260 | $70 | - | - |
| Acrylic 9mm | $330 | $90 | - | - |
| Acrylic 12mm | $370 | $120 | - | - |
| Acrylic 18mm | $535 | $170 | - | - |
| Acrylic 24mm | $765 | $250 | - | - |
| PVC 3mm | $55 | $70 | - | - |
| PVC 6mm | $150 | $70 | - | - |
| PVC 12mm | $225 | $120 | - | - |
| PVC 18mm | $320 | $170 | - | - |
| PVC 24mm | $460 | $220 | - | - |
| ACM 3mm | $90 | $70 | $115 | - |
| ACM 6mm | $105 | $100 | - | - |
| Alu 0.040" | $187 | $120 | $205 | - |
| Alu 0.064" | $213 | $190 | $250 | - |
| Alu 0.08" | $268 | $270 | $315 | - |
| Brushed alu 0.040" | $485 | $120 | $365 | - |
| Gold br, mirror 0.040" | $468 | $120 | $410 | - |
| Clear Satin 0.040" | $255 | $120 | $245 | - |
| Polycarbonate | $110 | $70 | - | - |
| 2mm ACM | $50 | $70 | - | - |
| Polycarb + ACM | $160 | $140 | - | - |
| Acrylic Letters | $680 | $220 | - | - |

### Fixed Configuration Rates
| Rate Code | Value | Description | Excel Ref |
|-----------|-------|-------------|-----------|
| MAT_BASE | $50.00 | Material base cost | $I$139 |
| MAT_MARKUP | 1.25 | Material markup multiplier | $I$140 |
| CUT_BASE | $30.00 | Cutting base cost | $I$141 |
| STANDOFF_COST | $15.00 | Standoff cost per piece | $K$144 |

### Pin Pricing Structure
| Pin Size | Cost | Sell Price |
|----------|------|------------|
| 2 inch | $0.17 | $0.36 |
| 4 inch | $0.27 | $0.57 |
| 6 inch | $0.40 | $0.86 |

### Standoff Suppliers & Pricing
| Supplier | Cost | Sell Price |
|----------|------|------------|
| YMS | $5.00 | $15.00 |
| Grimco | $20.00 | $15.00 |
| Mustang | - | $15.00 |

## Calculation Logic

### 1. Material Selection & Lookup
**Formula**: `XLOOKUP(material_type, substrate_table, [material_cost, cut_cost])`

**Logic**:
- Input: Material type from 'Estimator V2'!P4
- Lookup in substrate table (B139:D162) 
- Returns: [Material cost per sheet, Cut rate, Optional 4x10/5x10 rates]
- If not found, returns empty array

### 2. Dimension Processing & Square Footage
**Cut Square Footage**:
```
Formula: ROUNDUP(PRODUCT(TEXTSPLIT(dimensions, "x")) / 144, 0)
Logic: 
- Parse "WxH" format: "24x48" → [24, 48]
- Calculate area: 24 * 48 = 1,152 sq inches
- Convert to sq ft: 1,152 / 144 = 8 sq ft
- Round up to whole sq ft: ROUNDUP(8, 0) = 8 sq ft
```

**Material Square Footage**:
```
Formula: ROUNDUP(PRODUCT(TEXTSPLIT(dimensions, "x") + 3) / 144, 0)
Logic:
- Add 3" to each dimension for waste: [24+3, 48+3] = [27, 51]
- Calculate area: 27 * 51 = 1,377 sq inches
- Convert to sq ft: 1,377 / 144 = 9.56 sq ft
- Round up: ROUNDUP(9.56, 0) = 10 sq ft
```

### 3. Material Cost Calculation
**Formula**: `MAT_BASE + (material_sqft * material_sheet_cost * MAT_MARKUP / 32)`

**Logic**:
```
IF cut_sqft > 0:
    material_cost = $50 + (material_sqft * sheet_cost * 1.25 / 32)
ELSE:
    material_cost = 0

Example: 10 sq ft of Acrylic 6mm ($260/sheet):
material_cost = $50 + (10 * $260 * 1.25 / 32)
material_cost = $50 + $101.56 = $151.56
```

### 4. Cutting Cost Calculation
**Complex Conditional Logic**:

```
IF cutting_required AND material_found:
    IF custom_cut_override_provided:
        cut_cost = custom_override_value
    ELSE:
        sheets_needed = ROUNDUP(cut_sqft / 32, 0)
        cut_cost = ROUNDUP(sheets_needed * CUT_BASE + cut_sqft * cut_rate / 32, 0)
ELSE:
    cut_cost = 0
```

**Detailed Calculation**:
```
sheets_needed = ROUNDUP(cut_sqft / 32, 0)  // 32 sq ft per sheet
base_cutting = sheets_needed * $30         // Base cutting per sheet
variable_cutting = cut_sqft * cut_rate / 32  // Variable rate per sq ft
total_cut_cost = ROUNDUP(base_cutting + variable_cutting, 0)
```

**Example**: 8 sq ft cut of Acrylic 6mm (cut rate $70):
```
sheets_needed = ROUNDUP(8 / 32, 0) = 1 sheet
base_cutting = 1 * $30 = $30
variable_cutting = 8 * $70 / 32 = $17.50
total_cut_cost = ROUNDUP($30 + $17.50, 0) = $48
```

### 5. Pin Cost Calculation
**Current System**: Direct dollar input
```
Formula: IF(ISNUMBER(pin_input), pin_input, FALSE)
Input: Manual dollar amount (e.g., "$25" for 25 pins @ $1 each)
```

**Enhanced System** (for future implementation):
```
pin_cost = pin_quantity * pin_size_rate
Examples:
- 10 x 2" pins = 10 * $0.36 = $3.60
- 15 x 4" pins = 15 * $0.57 = $8.55
- 8 x 6" pins = 8 * $0.86 = $6.88
```

### 6. Standoff Cost Calculation
**Formula**: `standoff_quantity * STANDOFF_COST`

**Logic**:
```
IF standoff_input is numeric:
    standoff_cost = standoff_quantity * $15.00
ELSE:
    standoff_cost = 0
```

### 7. Assembly & Tape Costs
**Current System**: Manual input based on customer requirements
```
- Assembly: Direct dollar input for labor
- Tape: Direct dollar input for materials
- Both migrate to new assembly system in future estimator
```

## Input Processing Examples

### Dimension Input Examples
```
Input: "24x48"
- Cut sq ft: ROUNDUP(24*48/144, 0) = ROUNDUP(8, 0) = 8 sq ft
- Material sq ft: ROUNDUP((24+3)*(48+3)/144, 0) = ROUNDUP(9.56, 0) = 10 sq ft

Input: "48x96" 
- Cut sq ft: ROUNDUP(48*96/144, 0) = ROUNDUP(32, 0) = 32 sq ft
- Material sq ft: ROUNDUP((48+3)*(96+3)/144, 0) = ROUNDUP(35.01, 0) = 36 sq ft

Input: "14x5"
- Cut sq ft: ROUNDUP(14*5/144, 0) = ROUNDUP(0.49, 0) = 1 sq ft  
- Material sq ft: ROUNDUP((14+3)*(5+3)/144, 0) = ROUNDUP(0.94, 0) = 1 sq ft
```

### Complete Calculation Example
**Scenario**: 24"x48" Acrylic 6mm substrate with 10 pins and 4 standoffs

```
Material: Acrylic 6mm ($260 sheet, $70 cut rate)
Dimensions: 24x48 → 8 sq ft cut, 10 sq ft material

Material Cost:
$50 + (10 * $260 * 1.25 / 32) = $50 + $101.56 = $151.56

Cutting Cost:
Sheets: ROUNDUP(8/32, 0) = 1 sheet
Base: 1 * $30 = $30
Variable: 8 * $70 / 32 = $17.50
Total: ROUNDUP($47.50, 0) = $48

Pins: $10 (manual input, future: 10 * $0.36 = $3.60)
Standoffs: 4 * $15 = $60

Total Substrate Cost: $151.56 + $48 + $10 + $60 = $269.56
```

## Database Schema Requirements

### Enhanced Substrate Tables

```sql
CREATE TABLE substrate_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_name VARCHAR(100) UNIQUE NOT NULL,
  material_code VARCHAR(20) UNIQUE NOT NULL,
  sheet_4x8_cost DECIMAL(8,4) NOT NULL,
  cut_rate DECIMAL(8,4) NOT NULL,
  sheet_4x10_cost DECIMAL(8,4) NULL,
  sheet_5x10_cost DECIMAL(8,4) NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE substrate_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE pin_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pin_size VARCHAR(20) NOT NULL,
  cost_price DECIMAL(8,4) NOT NULL,
  sell_price DECIMAL(8,4) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE standoff_suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_name VARCHAR(100) NOT NULL,
  cost_price DECIMAL(8,4) NULL,
  sell_price DECIMAL(8,4) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

### Configuration Data
```sql
INSERT INTO substrate_pricing_config VALUES
(1, 'MAT_BASE', 50.0000, 'Material base cost', '2025-09-01', true),
(2, 'MAT_MARKUP', 1.2500, 'Material markup multiplier', '2025-09-01', true),
(3, 'CUT_BASE', 30.0000, 'Cutting base cost per sheet', '2025-09-01', true),
(4, 'STANDOFF_COST', 15.0000, 'Standoff sell price per piece', '2025-09-01', true),
(5, 'SHEET_SQFT', 32.0000, 'Square feet per standard sheet', '2025-09-01', true);

INSERT INTO pin_types VALUES
(1, '2 inch', 0.1700, 0.3600, '2025-09-01', true),
(2, '4 inch', 0.2700, 0.5700, '2025-09-01', true),  
(3, '6 inch', 0.4000, 0.8600, '2025-09-01', true);

INSERT INTO standoff_suppliers VALUES
(1, 'YMS', 5.0000, 15.0000, '2025-09-01', true),
(2, 'Grimco', 20.0000, 15.0000, '2025-09-01', true),
(3, 'Mustang', NULL, 15.0000, '2025-09-01', true);
```

## Calculation Engine Implementation

The substrate calculation engine must handle:

1. **Material Lookup**: XLOOKUP equivalent for 24 different substrate types
2. **Dimension Parsing**: "WxH" format with TEXTSPLIT logic
3. **Dual Square Footage**: Cut area vs material area (+3" waste calculation)
4. **Complex Cutting Logic**: Base cost + variable rate with sheet calculations
5. **Pin Enhancement**: Transition from manual input to detailed pin type pricing
6. **Standoff Selection**: Multiple supplier options with cost tracking
7. **Assembly Integration**: Future migration to new assembly system

## Migration Notes

**Current Manual Systems**:
- Pins: Dollar amount input (assuming $1/pin average)
- Assembly: Manual labor cost input  
- Tape: Manual material cost input

**Future Enhancements**:
- Detailed pin type selection with accurate pricing
- Assembly cost integration with new assembly system
- Tape cost calculation based on substrate size and type

This documentation captures the complete Substrate pricing system with all Excel formula logic preserved for database implementation, including the transition path from current manual inputs to enhanced detailed pricing.