# Backer Pricing Calculations - Complete Documentation

## Overview

The Backer pricing system handles three distinct product types with sophisticated multi-dimensional lookup tables and dimension sorting logic. The key feature is X/Y dimension interchangeability - width and height can be swapped without affecting price, but depth (Z) is positional and critical to the calculation.

## Rate Structure (Lookup Tables)

### Aluminum Backer Pricing Table (B166-F169)
**Dimension Logic**: `Height + (Depth × 2)` for folded edges

| H+(D×2) | W=1" | W=59.51" | W=119.51" | W=179.51" | W=239.51" |
|---------|------|----------|-----------|-----------|-----------|
| 1" | - | $59.51 | $119.51 | $179.51 | $239.51 |
| 15.51" | - | $190 | $325 | $480 | $615 |
| 23.51" | - | $220 | $385 | $570 | $735 |
| 47.51" | - | $310 | $565 | $870 | $1,155 |

### ACM Backer Pricing Table (H166-O171)
**Dimension Logic**: Standard Width × Height lookup (X/Y interchangeable)

| Height | W=1" | W=48" | W=60" | W=96.1" | W=120.1" | W=192.1" | W=240.1" | W=300.1" |
|--------|------|-------|-------|---------|----------|----------|----------|----------|
| 1" | - | $48 | $60 | $96.10 | $120.10 | $192.10 | $240.10 | $300.10 |
| 16" | - | $210 | $240 | $335 | $405 | $585 | $725 | $905 |
| 24" | - | $245 | $280 | $385 | $455 | $655 | $840 | $1,005 |
| 30" | - | $265 | $305 | $445 | $490 | $735 | $900 | $1,080 |
| 48.1" | - | $345 | $395 | $565 | $640 | $905 | $1,135 | $1,385 |
| 60.1" | - | $365 | $415 | $620 | $720 | $1,070 | $1,295 | $1,545 |

### Hinged Raceway Pricing Table (B195-G196)
**Length-Based Pricing**: 8" Hinged Raceway, 15ft long standard

| Length | 0.5" | 59.5" | 119.5" | 179.5" | 239.5" | 299.5" |
|--------|------|-------|--------|--------|--------|--------|
| 15ft | - | $190 | $305 | $420 | $570 | $685 |

## Calculation Logic

### 1. Dimension Processing & Sorting
**Core Logic**: X and Y interchangeable, Z (depth) is positional

```
Aluminum Backer Examples (XYZ required):

Input: "48x24x3" → TEXTSPLIT → [48, 24, 3]
- Sort X,Y only: [48, 24] → [48, 24] (48≥24)  
- Keep Z position: [48, 24, 3]
- Result: Width=48", Height=24", Depth=3"

Input: "24x48x3" → TEXTSPLIT → [24, 48, 3]  
- Sort X,Y only: [24, 48] → [48, 24] (48≥24)
- Keep Z position: [48, 24, 3] 
- Result: Width=48", Height=24", Depth=3" (SAME PRICE as above)

Input: "3x48x24" → TEXTSPLIT → [3, 48, 24]
- Sort X,Y only: [3, 48] → [48, 3] (48≥3)
- Keep Z position: [48, 3, 24]
- Result: Width=48", Height=3", Depth=24" (DIFFERENT PRICE - depth=24")
```

**Validation**: Must have exactly 3 dimensions for aluminum, 2 for ACM
```
Aluminum: IF COLUMNS(parsed_dimensions) ≠ 3 → Return empty
ACM: IF COLUMNS(parsed_dimensions) ≠ 2 → Return empty  
```

### 2. Aluminum Backer Calculation
**Business Logic**: Folded edges on all 4 sides, depth affects perimeter

```
Step 1: Sort X,Y dimensions (largest first), keep Z positional
dimensions = TEXTSPLIT(input, "x") 
sorted_xy = SORT([X, Y], -1, TRUE)  // Sort X,Y only
final_dims = [sorted_xy[0], sorted_xy[1], Z]  // [Width, Height, Depth]

Step 2: Calculate lookup keys with folded edges  
lookup_width = Width + (Depth × 2)   // Folded on left/right
lookup_height = Height + (Depth × 2) // Folded on top/bottom

Step 3: Table lookup
price = INDEX(aluminum_table, 
             MATCH(lookup_height, height_column),
             MATCH(lookup_width, width_row))
```

**Example: "48x24x3" aluminum backer**
```
1. Parse: [48, 24, 3]
2. Sort X,Y: [48, 24] (48≥24), keep Z=3
3. Final: Width=48", Height=24", Depth=3"  
4. lookup_width = 48 + (3 × 2) = 54"
5. lookup_height = 24 + (3 × 2) = 30"
6. Find price for 54"×30" in aluminum table
```

**Example: "24x48x3" aluminum backer**
```
1. Parse: [24, 48, 3]  
2. Sort X,Y: [48, 24] (48≥24), keep Z=3
3. Final: Width=48", Height=24", Depth=3"
4. Same calculation as above → SAME PRICE
```

### 3. ACM Backer Calculation
**Business Logic**: Flat panel, X/Y fully interchangeable

```
Step 1: Sort X,Y dimensions (largest first)
dimensions = TEXTSPLIT(input, "x")  // Must be 2 dimensions
sorted_dims = SORT([X, Y], -1, TRUE)
final_dims = [sorted_dims[0], sorted_dims[1]]  // [Width, Height]

Step 2: Direct lookup (no depth adjustment)
price = INDEX(acm_table,
             MATCH(Height, height_column), 
             MATCH(Width, width_row))
```

**Example: "90x50" ACM backer**
```
1. Parse: [90, 50]
2. Sort: [90, 50] (90≥50)  
3. Width=90", Height=50"
4. Direct lookup in ACM table
```

**Example: "50x90" ACM backer**
```
1. Parse: [50, 90]
2. Sort: [90, 50] (90≥50)
3. Same as above → SAME PRICE
```

### 4. Hinged Raceway Calculation  
**Business Logic**: Single dimension (length), 8"×4" standard cross-section

```
Input: Single numeric value (length in inches)
Valid Range: 0.5" to 299.5"

Validation & Formatting:
IF input > 0.5 AND input < 299.5:
    display_format = input + "x8x4"  
    price = INDEX(raceway_table, MATCH(input, length_row))
ELSE:
    Return empty (out of range)
```

**Example: "120" raceway**
```
1. Input: 120 (length in inches)
2. Range check: 0.5 < 120 < 299.5 ✓
3. Display: "120x8x4"
4. Lookup price for 120" length
```

### 5. Assembly Cost Calculation
**Current System**: Manual input with $100 base guideline

```
Base Rate: $100
Manual Adjustments: 
- Small/simple jobs: -$25 to -$50
- Large/complex jobs: +$50 to +$200
- Based on installer experience and job complexity
```

## Input Processing Examples

### Aluminum Dimension Interchangeability
```
All these inputs produce SAME PRICE:
- "48x24x3" → [48, 24, 3] → 48"×24"×3"
- "24x48x3" → [24, 48, 3] → sort to 48"×24"×3"  

This input produces DIFFERENT PRICE:
- "3x48x24" → [3, 48, 24] → 48"×3"×24" (depth=24" vs depth=3")
- "24x3x48" → [24, 3, 48] → 24"×3"×48" (different again)
```

### ACM Dimension Interchangeability  
```
These inputs produce SAME PRICE:
- "90x50" → [90, 50] → 90"×50"
- "50x90" → [50, 90] → sort to 90"×50"

No depth dimension for ACM (flat panels only)
```

### Raceway Examples
```
Input: "120" → "120x8x4" → lookup 120" length price
Input: "85.5" → "85.5x8x4" → lookup 85.5" length price
Input: "400" → out of range (>299.5) → empty result
```

## Error Handling

### Dimension Validation
```
Aluminum Input Errors:
- "24x18" → empty (needs 3 dimensions)  
- "24x18x12x6" → empty (max 3 dimensions)
- "abc x def x 3" → empty (non-numeric)

ACM Input Errors:
- "24" → empty (needs 2 dimensions)
- "24x18x3" → empty (max 2 dimensions)  

Raceway Input Errors:
- "abc" → empty (non-numeric)
- "500" → empty (>299.5" limit)
```

### Table Lookup Failures
```
If exact dimension match not found:
Result: 99999 (error code for manual review)
Indicates need for interpolation or table expansion
```

## Database Schema Requirements

```sql
CREATE TABLE aluminum_backer_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,  
  width_base DECIMAL(8,2) NOT NULL COMMENT 'Width before depth adjustment',
  height_base DECIMAL(8,2) NOT NULL COMMENT 'Height before depth adjustment', 
  width_plus_depth_x2 DECIMAL(8,2) NOT NULL COMMENT 'Width + (depth × 2)',
  height_plus_depth_x2 DECIMAL(8,2) NOT NULL COMMENT 'Height + (depth × 2)',
  depth DECIMAL(8,2) NOT NULL,
  price DECIMAL(8,4) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE KEY unique_dimensions (width_base, height_base, depth)
);

CREATE TABLE acm_backer_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  width DECIMAL(8,2) NOT NULL COMMENT 'Larger dimension (X/Y agnostic)',  
  height DECIMAL(8,2) NOT NULL COMMENT 'Smaller dimension (X/Y agnostic)',
  price DECIMAL(8,4) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE KEY unique_dimensions (width, height)
);

CREATE TABLE raceway_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  length_inches DECIMAL(8,2) NOT NULL,
  width_inches DECIMAL(8,2) DEFAULT 8.0,
  height_inches DECIMAL(8,2) DEFAULT 4.0, 
  price DECIMAL(8,4) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

## Business Logic Summary

**Key Rules**:
1. **Aluminum**: X/Y interchangeable, Z positional (depth affects folding calculation)
2. **ACM**: X/Y fully interchangeable (flat panels, no depth)  
3. **Raceway**: Single length dimension, standard 8"×4" cross-section
4. **Assembly**: Manual pricing starting at $100 base

This documentation captures the complete Backer pricing system with corrected dimension logic where X/Y are interchangeable but depth (Z) is positionally significant.