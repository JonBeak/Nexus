# Vinyl Pricing Calculations - Complete Documentation

## Rate Structure (Configurable Values)

| Rate Code | Description | Value | Excel Ref |
|-----------|-------------|-------|-----------|
| APP_SHEET | Application/Sheet Fee | $40.00 | $I$112 |
| CUT_APP_SHEET | Cut Application/Sheet Fee | $80.00 | $I$113 |
| T_PER_YARD | Standard Vinyl per Yard | $55.00 | $I$114 |
| PERF_PER_YARD | Perforated Vinyl per Yard | $110.00 | $I$115 |
| PC_24IN | 24" Standard Piece | $55.00 | $I$116 |
| PC_24IN_COLOR | 24" Color Piece | $85.00 | $I$117 |
| PC_24IN_PERF | 24" Perforated Piece | $80.00 | $I$118 |
| DIG_PER_SQFT | Digital Print per SqFt | $8.00 | $I$119 |

## Calculation Methods by Vinyl Type

### 1. Standard Vinyl (T)
**Formula**: `ROUNDUP(yards/3,0) * APP_SHEET + yards * T_PER_YARD`
**Logic**: 
- Application fee charged per 3-yard increment (rounded up)
- Plus linear yards at standard rate
**Examples**:
- 7 yards = ROUNDUP(7/3,0) * $40 + 7 * $55 = 3 * $40 + $385 = $505

### 2. Translucent Color Vinyl (Tc) 
**Formula**: `ROUNDUP(yards/3,0) * CUT_APP_SHEET + yards * T_PER_YARD`
**Logic**:
- Uses higher application fee for translucent/color
- Same per-yard rate as standard
**Examples**:
- 7 yards = ROUNDUP(7/3,0) * $80 + 7 * $55 = 3 * $80 + $385 = $625

### 3. Perforated Vinyl (Perf)
**Formula**: `ROUNDUP(yards/3,0) * APP_SHEET + yards * PERF_PER_YARD`
**Logic**:
- Standard application fee
- Higher per-yard rate for perforated material
**Examples**:
- 7 yards = ROUNDUP(7/3,0) * $40 + 7 * $110 = 3 * $40 + $770 = $890

### 4. Perforated Color Vinyl (Perf c)
**Formula**: `ROUNDUP(yards/3,0) * CUT_APP_SHEET + yards * PERF_PER_YARD`
**Logic**:
- Higher application fee for color
- Higher per-yard rate for perforated
**Examples**:
- 7 yards = ROUNDUP(7/3,0) * $80 + 7 * $110 = 3 * $80 + $770 = $1010

### 5. 24-inch Standard Pieces (24in)
**Formula**: `pieces * PC_24IN`
**Logic**: Simple per-piece pricing for pre-cut 24" material
**Examples**:
- 5 pieces = 5 * $55 = $275

### 6. 24-inch Color Pieces (24in c)
**Formula**: `pieces * PC_24IN_COLOR`
**Logic**: Higher rate for color 24" pieces
**Examples**:
- 5 pieces = 5 * $85 = $425

### 7. 24-inch Perforated Pieces (24in perf)
**Formula**: `pieces * PC_24IN_PERF`
**Logic**: Special rate for perforated 24" pieces
**Examples**:
- 5 pieces = 5 * $80 = $400

### 8-10. Digital Print Vinyl (Dig WxH - 3 columns)
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

### Linear Yard Inputs (T, Tc, Perf, Perf c)
- Input can be space-separated numbers: "3 4 2"
- Each number treated as separate yard quantity
- All quantities summed for total calculation
- Text parsing: `TEXTSPLIT(input," ",,TRUE)*1`

### Piece Inputs (24in variants)
- Direct numeric input for piece count
- Descriptive text generated: "5 (24\"pcs)"

### Digital Print Inputs (Dig)
- Accepts "WxH" format: "12x8", "24x18"
- Accepts direct sqft: "5.5"
- Dimension parsing with quarter-foot precision
- Setup fee applied when content exists

## Database Schema Requirements

### 1. Vinyl Rate Configuration Table
```sql
CREATE TABLE vinyl_pricing_rates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rate_code VARCHAR(20) UNIQUE NOT NULL,
  rate_description VARCHAR(100) NOT NULL,
  rate_value DECIMAL(8,4) NOT NULL,
  rate_unit VARCHAR(20) NOT NULL, -- 'PER_YARD', 'PER_PIECE', 'PER_SQFT', 'PER_APPLICATION'
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Vinyl Product Types Table
```sql  
CREATE TABLE vinyl_product_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_code VARCHAR(20) UNIQUE NOT NULL, -- 'T', 'TC', 'PERF', 'PERF_C', '24IN', '24IN_C', '24IN_PERF', 'DIG'
  product_name VARCHAR(100) NOT NULL,
  calculation_type ENUM('LINEAR_YARD', 'PIECE', 'DIGITAL_PRINT') NOT NULL,
  app_fee_rate_code VARCHAR(20), -- References vinyl_pricing_rates.rate_code
  base_rate_code VARCHAR(20), -- References vinyl_pricing_rates.rate_code
  setup_fee_multiplier DECIMAL(4,2) DEFAULT 0, -- For digital print setup fee
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

### 3. Calculation Engine Requirements
- Parse space-separated yard inputs: "3 4 2"
- Calculate application fees: `ROUNDUP(total_yards/3,0)`
- Parse dimension inputs: "12x8" with quarter-foot precision
- Handle setup fees for digital prints
- Support multiple input formats per product type

## Implementation Priority
1. Create configurable rate tables
2. Build calculation engine for each vinyl type
3. Implement input parsing logic
4. Add frontend interface for rate management
5. Integrate with job builder for real-time pricing

This documentation provides complete formula replication of your Excel vinyl pricing system with configurable rates stored in the database.