# Blade Sign Pricing Calculations - Complete Documentation

## Overview

The Blade Sign system calculates pricing for rectangular blade signs with integrated LEDs, structural frames, assembly, wrapping, and cutting. The system uses tiered pricing based on square footage thresholds and sophisticated LED density calculations.

## Rate Structure (Configurable Values)

### Blade Sign Specific Rates (B204-C211)
| Component | Threshold | Rate | Description |
|-----------|-----------|------|-------------|
| **Frame** | < 4 sqft | $300 | Base frame cost for small signs |
| **Frame** | > 4 sqft | $12.50/sqft | Additional cost per sqft above 4 sqft |
| **Assembly** | < 4 sqft | $100 | Base assembly cost |
| **Assembly** | > 4 sqft | $5.00/sqft | Additional assembly per sqft above 4 sqft |
| **Wrap** | < 4 sqft | $50 | Base wrap cost |
| **Wrap** | > 4 sqft | $7.50/sqft | Additional wrap per sqft above 4 sqft |
| **Cut Return** | All sizes | $25 | Fixed cutting cost |

### Referenced Rates
| Rate Code | Value | Description | Source |
|-----------|-------|-------------|--------|
| CHANNEL_3_FRONT_RATE | $4.50/inch | 3" Front Lit Channel Letter rate | B57 (Channel Letters) |

### Size Thresholds
| Threshold | Usage |
|-----------|-------|
| 4 sqft | Base pricing breakpoint for all components |
| 576 sqft | Secondary breakpoint (not used in simplified version) |
| 2350 sqft | Maximum size limit |

## Calculation Logic

### 1. Dimension Processing
**Business Logic**: Parse XY dimensions, sort largest first (width × height)

```
Step 1: Parse dimensions
dimensions = TEXTSPLIT(input, "x")
sorted_dims = SORT(dimensions, -1, TRUE) // Largest first

Step 2: Extract width and height  
IF COLUMNS(dimensions) = 1:
    width = dimensions[0]
    height = dimensions[0]  // Square if only one dimension
ELSE IF COLUMNS(dimensions) = 2:
    width = sorted_dims[0]   // Larger dimension
    height = sorted_dims[1]  // Smaller dimension
ELSE:
    Error (invalid input)

Example: "48x32" → width=48", height=32"
Example: "36" → width=36", height=36" (square)
```

### 2. Area Calculation
**Business Logic**: Simple rectangular area (circle logic removed)

```
Formula: area_sqft = width * height / 144

Example: 48" × 32" blade sign
area_sqft = 48 * 32 / 144 = 10.67 sqft
```

### 3. Blade Material Cost
**Business Logic**: Uses channel letter rate with complex calculation

```
Formula: 2 * ROUNDUP(MAX(area_sqft/20 * CHANNEL_RATE, SQRT(area_sqft) * CHANNEL_RATE), 1)

Where:
- area_sqft/20 * $4.50 = area-based calculation  
- SQRT(area_sqft) * $4.50 = perimeter-based calculation
- MAX() = takes larger of the two methods
- 2 * = doubles the cost (face + back or material factor)
- ROUNDUP(, 1) = rounds up to nearest dollar

Example: 10.67 sqft blade sign
Method 1: 10.67/20 * $4.50 = $2.40
Method 2: SQRT(10.67) * $4.50 = $14.70  
MAX($2.40, $14.70) = $14.70
Final cost: 2 * ROUNDUP($14.70, 1) = 2 * $15 = $30
```

### 4. Frame Cost Calculation
**Tiered Pricing Logic**: Base cost + additional per sqft

```
IF area_sqft = 0:
    frame_cost = $0
ELSE IF area_sqft < 4:
    frame_cost = $300 (base cost)
ELSE IF area_sqft < 2350: // Maximum size limit
    additional_sqft = area_sqft - 4
    additional_cost = additional_sqft * $12.50
    frame_cost = $300 + additional_cost
ELSE:
    frame_cost = 99999 (error - exceeds maximum size)

Example: 10.67 sqft blade sign
additional_sqft = 10.67 - 4 = 6.67 sqft
additional_cost = 6.67 * $12.50 = $83.38
frame_cost = $300 + $83.38 = $383.38
```

### 5. Assembly Cost Calculation
**Similar tiered logic to frame**

```
IF area_sqft = 0:
    assembly_cost = $0  
ELSE IF area_sqft < 4:
    assembly_cost = $100
ELSE IF area_sqft < 2350:
    additional_sqft = area_sqft - 4
    additional_cost = additional_sqft * $5.00
    assembly_cost = $100 + additional_cost
ELSE:
    assembly_cost = 99999 (error)

Example: 10.67 sqft blade sign  
additional_sqft = 10.67 - 4 = 6.67 sqft
additional_cost = 6.67 * $5.00 = $33.35
assembly_cost = $100 + $33.35 = $133.35
```

### 6. Wrap Cost Calculation
**Same tiered structure**

```
IF area_sqft = 0:
    wrap_cost = $0
ELSE IF area_sqft < 4:
    wrap_cost = $50
ELSE IF area_sqft < 2350:
    additional_sqft = area_sqft - 4  
    additional_cost = additional_sqft * $7.50
    wrap_cost = $50 + additional_cost
ELSE:
    wrap_cost = 99999 (error)

Example: 10.67 sqft blade sign
additional_sqft = 10.67 - 4 = 6.67 sqft  
additional_cost = 6.67 * $7.50 = $50.03
wrap_cost = $50 + $50.03 = $100.03
```

### 7. Cutting Cost
**Fixed Rate**: Always $25 regardless of size

```
cutting_cost = $25 (fixed for all blade signs)
```

### 8. LED Count Calculation
**Dual Method Logic**: Uses larger of two calculation methods

```
Method 1: Area-based = ROUNDUP(area_sqft / 100 * 9, 0)
Method 2: Perimeter-based = ROUNDUP(SQRT(area_sqft) * 1.4, 0)
LED_count = MAX(method1, method2)

Example: 10.67 sqft blade sign
Method 1: ROUNDUP(10.67 / 100 * 9, 0) = ROUNDUP(0.96, 0) = 1 LED
Method 2: ROUNDUP(SQRT(10.67) * 1.4, 0) = ROUNDUP(4.57, 0) = 5 LEDs  
LED_count = MAX(1, 5) = 5 LEDs
```

### 9. LED Type & Pricing
**Uses Channel Letter LED Logic**

```
LED_type = Job default LED type OR system default
LED_unit_price = VLOOKUP(LED_type, LED_table, price_column)
LED_total_cost = LED_count * LED_unit_price

Example: 5 LEDs × $1.75 = $8.75
```

### 10. Transformer Calculation
**Uses Channel Letter Transformer Logic**

```
Step 1: Calculate total wattage
LED_total_watts = LED_count * LED_watts_per_unit

Step 2: Determine transformer type
IF total_watts > 50W:
    transformer_type = "Speedbox 150W"
ELSE:
    transformer_type = "Speedbox 60W"

Step 3: Calculate quantity needed
transformers_needed = ROUNDUP(total_watts / transformer_max_watts, 0)
transformer_cost = transformers_needed * transformer_unit_price
```

### 11. UL Cost Calculation
**Uses Job-Level UL Logic from Channel Letters**

```
IF UL_required:
    IF this_is_first_UL_item_in_job:
        UL_cost = $150 (base) + additional_sets * $50
    ELSE:
        UL_cost = additional_sets * $50
ELSE:
    UL_cost = $0
```

## Input Processing Examples

### Dimension Input Examples
```
Input: "48x32"
- Parse: [48, 32]
- Sort: [48, 32] (48 ≥ 32)
- Result: Width=48", Height=32", Area=10.67 sqft

Input: "32x48" (same dimensions, different order)  
- Parse: [32, 48]
- Sort: [48, 32] (48 ≥ 32)
- Result: Same as above (dimension agnostic for X/Y)

Input: "36" (single dimension)
- Parse: [36]  
- Result: Width=36", Height=36", Area=9 sqft (square)
```

### Complete Cost Breakdown Example
**48"×32" Blade Sign (10.67 sqft)**

```
1. Blade Material:
   - Method 1: 10.67/20 * $4.50 = $2.40
   - Method 2: SQRT(10.67) * $4.50 = $14.70
   - Cost: 2 * ROUNDUP($14.70, 1) = $30

2. Frame: $300 + (6.67 sqft * $12.50) = $383.38

3. Assembly: $100 + (6.67 sqft * $5.00) = $133.35

4. Wrap: $50 + (6.67 sqft * $7.50) = $100.03

5. Cutting: $25 (fixed)

6. LEDs: 5 LEDs @ $1.75 = $8.75

7. Transformer: 1 Speedbox 60W = $120

8. UL: $150 (if first item in job)

Total: $950.51
```

## Error Handling

### Size Validation
```
Maximum Size Check:
IF area_sqft > 2350:
    Return 99999 (manual review required)

Minimum Size Check:  
IF dimensions empty or zero:
    Return $0 for all components
```

### Component Overrides
```
All components support manual override:
IF manual_input provided:
    Use manual_input value
ELSE:
    Use calculated value
```

## Database Schema Requirements

```sql
CREATE TABLE blade_sign_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO blade_sign_pricing_config VALUES
(1, 'FRAME_BASE_COST', 300.0000, 'Frame base cost < 4 sqft', '2025-09-01', true),
(2, 'FRAME_RATE_PER_SQFT', 12.5000, 'Frame cost per sqft > 4 sqft', '2025-09-01', true),
(3, 'ASSEMBLY_BASE_COST', 100.0000, 'Assembly base cost < 4 sqft', '2025-09-01', true), 
(4, 'ASSEMBLY_RATE_PER_SQFT', 5.0000, 'Assembly cost per sqft > 4 sqft', '2025-09-01', true),
(5, 'WRAP_BASE_COST', 50.0000, 'Wrap base cost < 4 sqft', '2025-09-01', true),
(6, 'WRAP_RATE_PER_SQFT', 7.5000, 'Wrap cost per sqft > 4 sqft', '2025-09-01', true),
(7, 'CUTTING_FIXED_COST', 25.0000, 'Fixed cutting cost', '2025-09-01', true),
(8, 'SIZE_THRESHOLD_SQFT', 4.0000, 'Size threshold for tiered pricing', '2025-09-01', true),
(9, 'MAXIMUM_SIZE_SQFT', 2350.0000, 'Maximum allowable size', '2025-09-01', true),
(10, 'BLADE_MATERIAL_MULTIPLIER', 2.0000, 'Blade material cost multiplier', '2025-09-01', true),
(11, 'LED_AREA_FACTOR', 0.09, 'LEDs per sqft (9/100)', '2025-09-01', true),
(12, 'LED_PERIMETER_FACTOR', 1.4000, 'LED perimeter calculation factor', '2025-09-01', true);
```

## Business Logic Summary

**Key Features**:
1. **Tiered Pricing**: 4 sqft threshold for all components with base + additional rates
2. **Dual LED Logic**: Area vs perimeter-based, uses larger count
3. **Blade Material**: Uses channel letter rate with dual calculation method  
4. **Size Limits**: Maximum 2350 sqft, error code for oversized signs
5. **Component Integration**: LEDs → transformers → UL using Channel Letter logic
6. **Override Capability**: All calculated values can be manually overridden

**Simplified Design**: 
- Removed circle vs square complexity  
- Standardized rectangular calculations
- Clear tiered pricing structure
- Integration with existing LED/transformer/UL systems

This documentation captures the complete Blade Sign pricing system with simplified rectangular calculations and clear tiered pricing logic for all components.