# Painting Pricing Calculations - Complete Documentation

## Overview

The Painting system calculates pricing for painted sign faces and returns using square footage-based pricing. It handles two separate face areas plus linear returns/trimcaps with different depths (3", 4", 5"). The system uses material length standardization (118" pieces) and minimum cost protection.

## Rate Structure (Configurable Values)

### Painting Rates (B217-C220)
| Rate Code | Value | Description |
|-----------|-------|-------------|
| PAINT_BASE | $200 | Minimum painting cost |
| PAINT_4X8_COST | $800 | Cost for 4'×8' panel (32 sqft) |
| PAINT_PER_SQFT | $25 | Cost per sqft ($800 ÷ 32 sqft) |

### Material Specifications
| Specification | Value | Description |
|---------------|-------|-------------|
| MATERIAL_LENGTH | 118" | Standard return/trim material length |

## Calculation Logic

### 1. Face Area Calculations
**Business Logic**: Two separate face areas calculated independently

```
Face 1 Area Calculation:
Step 1: Parse dimensions
dimensions = TEXTSPLIT(face1_input, "x")
sorted_dims = SORT(dimensions, -1, TRUE)

Step 2: Extract width and height  
IF COLUMNS(dimensions) >= 1:
    width = sorted_dims[0]
    IF COLUMNS(dimensions) >= 2:
        height = sorted_dims[1]
    ELSE:
        height = width  // Square if single dimension

Step 3: Calculate area
face1_sqft = ROUNDUP(width * height / 144, 0)

Face 2 Area Calculation:
// Same logic as Face 1 with separate input

Examples:
- Face 1: "24x18" → 24" × 18" = 432 sq in ÷ 144 = 3 sqft
- Face 2: "36x24" → 36" × 24" = 864 sq in ÷ 144 = 6 sqft
```

### 2. Return Depth Calculations (3", 4", 5")
**Business Logic**: Linear inches → material pieces → area by depth

```
Return Calculation Formula:
material_pieces = ROUNDUP(linear_inches / 118, 0)
return_area_sqft = ROUNDUP(material_pieces * 118 * depth_inches / 144, 0)

Step-by-Step:
1. Determine material pieces needed (round up to whole 118" lengths)
2. Calculate actual material used (pieces × 118")  
3. Convert to square feet using depth
4. Round up to whole square feet

3" Return Example: 200" linear input
- material_pieces = ROUNDUP(200 / 118, 0) = ROUNDUP(1.69, 0) = 2 pieces
- actual_material = 2 × 118" = 236"
- return_area = ROUNDUP(236 × 3 / 144, 0) = ROUNDUP(4.92, 0) = 5 sqft

4" Return Example: 200" linear input  
- material_pieces = ROUNDUP(200 / 118, 0) = 2 pieces
- actual_material = 2 × 118" = 236"
- return_area = ROUNDUP(236 × 4 / 144, 0) = ROUNDUP(6.56, 0) = 7 sqft

5" Return Example: 200" linear input
- material_pieces = ROUNDUP(200 / 118, 0) = 2 pieces
- actual_material = 2 × 118" = 236"  
- return_area = ROUNDUP(236 × 5 / 144, 0) = ROUNDUP(8.19, 0) = 9 sqft
```

### 3. Trimcap Calculation
**Business Logic**: Same as 3" return logic

```
Trimcap Formula: ROUNDUP(ROUNDUP(linear_inches / 118, 0) * 118 * 3 / 144, 0)

This is identical to 3" return calculation:
- Uses 118" material length standardization
- 3" depth (same as 3" return)
- Rounds up material pieces and final area

Example: 150" trimcap
- material_pieces = ROUNDUP(150 / 118, 0) = 2 pieces
- actual_material = 2 × 118" = 236"
- trimcap_area = ROUNDUP(236 × 3 / 144, 0) = 5 sqft
```

### 4. Total Area Summation
**Business Logic**: Sum all component areas

```
total_sqft = face1_sqft + face2_sqft + return3_sqft + return4_sqft + return5_sqft + trimcap_sqft

Example Complete Calculation:
- Face 1: 3 sqft (24"×18")
- Face 2: 6 sqft (36"×24")  
- 3" Return: 5 sqft (200" linear)
- 4" Return: 7 sqft (200" linear)
- 5" Return: 0 sqft (no input)
- Trimcap: 5 sqft (150" linear)

Total: 3 + 6 + 5 + 7 + 0 + 5 = 26 sqft
```

### 5. Cost Calculation with Minimum
**Business Logic**: Protect against under-pricing small jobs

```
Formula: MAX(PAINT_BASE, total_sqft * PAINT_PER_SQFT)

calculated_cost = total_sqft * $25
minimum_cost = $200  
final_cost = MAX($200, calculated_cost)

Examples:
- 5 sqft job: MAX($200, 5 × $25) = MAX($200, $125) = $200
- 15 sqft job: MAX($200, 15 × $25) = MAX($200, $375) = $375  
- 26 sqft job: MAX($200, 26 × $25) = MAX($200, $650) = $650
```

## Input Processing Examples

### Face Dimension Examples
```
Face 1 Input: "24x18"
- Parse: [24, 18]
- Sort: [24, 18] (24 ≥ 18)
- Area: ROUNDUP(24 × 18 / 144, 0) = ROUNDUP(3, 0) = 3 sqft
- Description: "24x18 in"

Face 2 Input: "36" (single dimension)
- Parse: [36]  
- Area: ROUNDUP(36 × 36 / 144, 0) = ROUNDUP(9, 0) = 9 sqft
- Description: "36x36 in"

Face Input: "" (empty)
- No area calculated
- No description generated
```

### Return Length Examples
```
3" Return Input: "200"
- Material pieces: ROUNDUP(200 / 118, 0) = 2 pieces
- Area: ROUNDUP(2 × 118 × 3 / 144, 0) = 5 sqft
- Description: "2 [3"]"

4" Return Input: "150"  
- Material pieces: ROUNDUP(150 / 118, 0) = 2 pieces
- Area: ROUNDUP(2 × 118 × 4 / 144, 0) = 7 sqft
- Description: "2 [4"]"

Trimcap Input: "100"
- Material pieces: ROUNDUP(100 / 118, 0) = 1 piece
- Area: ROUNDUP(1 × 118 × 3 / 144, 0) = 3 sqft  
- Description: "1 [Trim]"
```

### Complete Painting Job Example
**Input Set:**
- Face 1: "48x32"
- Face 2: "24x18"  
- 3" Return: "240"
- 4" Return: "120"
- 5" Return: "" (empty)
- Trimcap: "80"

**Calculations:**
```
1. Face 1: ROUNDUP(48 × 32 / 144, 0) = 11 sqft
2. Face 2: ROUNDUP(24 × 18 / 144, 0) = 3 sqft
3. 3" Return: ROUNDUP(ROUNDUP(240/118,0) × 118 × 3 / 144, 0) = 7 sqft
4. 4" Return: ROUNDUP(ROUNDUP(120/118,0) × 118 × 4 / 144, 0) = 4 sqft  
5. 5" Return: 0 sqft (no input)
6. Trimcap: ROUNDUP(ROUNDUP(80/118,0) × 118 × 3 / 144, 0) = 3 sqft

Total Area: 11 + 3 + 7 + 4 + 0 + 3 = 28 sqft
Final Cost: MAX($200, 28 × $25) = MAX($200, $700) = $700

Description: "48x32 in, 24x18 in, 3 [3"], 1 [4"], 1 [Trim]"
```

## Error Handling

### Input Validation
```
Dimension Inputs:
- Empty input → no area calculation
- Single dimension → square area  
- Two dimensions → rectangular area
- Invalid/non-numeric → no area

Linear Inputs:
- Empty/zero → no area calculation
- Numeric → material piece calculation
- Non-numeric → no area calculation
```

### Area Calculations
```
All area calculations use ROUNDUP to ensure:
- No partial square feet charged
- Conservative material estimation
- Simplified pricing structure
```

## Database Schema Requirements

```sql
CREATE TABLE painting_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO painting_pricing_config VALUES
(1, 'PAINT_BASE_COST', 200.0000, 'Minimum painting cost', '2025-09-01', true),
(2, 'PAINT_COST_PER_SQFT', 25.0000, 'Painting cost per square foot', '2025-09-01', true),
(3, 'MATERIAL_LENGTH_INCHES', 118.0000, 'Standard material length for returns', '2025-09-01', true),
(4, 'RETURN_3_DEPTH', 3.0000, '3 inch return depth', '2025-09-01', true),
(5, 'RETURN_4_DEPTH', 4.0000, '4 inch return depth', '2025-09-01', true),
(6, 'RETURN_5_DEPTH', 5.0000, '5 inch return depth', '2025-09-01', true),
(7, 'TRIMCAP_DEPTH', 3.0000, 'Trimcap depth (same as 3" return)', '2025-09-01', true);

CREATE TABLE painting_components (
  id INT PRIMARY KEY AUTO_INCREMENT,
  component_name VARCHAR(50) NOT NULL,
  component_type ENUM('face', 'return', 'trimcap') NOT NULL,
  depth_inches DECIMAL(4,1) NULL,
  calculation_method VARCHAR(100),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

## Business Logic Summary

**Key Features:**
1. **Dual Face Areas**: Independent XY calculations for two faces
2. **Material Standardization**: 118" pieces for all returns/trimcaps  
3. **Depth Variations**: 3", 4", 5" returns plus trimcap (3")
4. **Area Summation**: All components add to total square footage
5. **Minimum Cost Protection**: $200 minimum prevents under-pricing
6. **Conservative Rounding**: ROUNDUP ensures adequate material/pricing

**Calculation Efficiency:**
- Simple XY to sqft conversion for faces
- Linear to area conversion with material standardization
- Single rate structure ($25/sqft) with minimum protection
- Clear component separation for detailed descriptions

This documentation captures the complete Painting pricing system with face areas, return calculations using standardized material lengths, and minimum cost protection for small jobs.