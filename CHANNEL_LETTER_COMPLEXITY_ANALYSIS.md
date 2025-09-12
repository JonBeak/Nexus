# Channel Letter Complexity Analysis System

## Overview
The complexity analysis system calculates manufacturing costs based on geometric complexity analysis of vector letter shapes, going beyond simple linear measurements to account for fabrication difficulty.

## Current Baseline Method
- **Standard Calculation**: `max(length, width) × cost_per_linear_inch`
- **Small Letter Adjustments**: 6-7" treated as 9", 8-9" treated as 10" (labor complexity)
- **Large Letter Switch**: Above certain size, switch to square footage calculation
- **Long/Narrow Letters**: Area-based calculation when linear would be inflated

## New Complexity System Requirements

### 1. Geometric Analysis Components

#### Primary Complexity Factors:
- **Curvature Complexity**: Integral of inverse circle of curvature
  - Smaller radius curves = higher complexity
  - Multiple curves compound the difficulty
- **Sharp Angle Penalties**: All corners with acute angles
  - Sharper angles = higher fabrication difficulty
- **Combination Penalties**: Curves adjacent to sharp corners
  - Difficulty increases exponentially when curve radius decreases AND corner angle sharpens

#### Size-Based Rules:
- **Minimum Size Constraints**: 
  - 6" minimum for most channel letter styles
  - Varies by letter style (configurable per product type)
  - Below minimum = flag for simple shapes only (oval, rectangle)
- **Maximum Size Constraints**:
  - Style-specific maximum dimensions
  - Above maximum = flag for special handling

#### Material Calculation Transitions:
- **Small Letters (< threshold)**: Linear with labor multipliers
- **Large Letters (> threshold)**: Square footage based (material usage scales squared)
- **Long/Narrow Letters**: Area-based when aspect ratio exceeds threshold

### 2. File Quality Considerations
- **Clean Vector Files**: Full complexity analysis applicable
- **Dirty Vector Files**: 
  - Attempt Illustrator script cleaning
  - Fall back to traditional calculation if cleaning fails
  - Flag for manual review

### 3. Validation and Fallback
- **Comparison Check**: Always compare new method vs old method
- **Variance Threshold**: Flag estimates with significant pricing differences
- **Manual Override**: Allow production staff to override complexity scores

## Technical Implementation Plan

### Phase 1: Basic Geometric Analysis
1. Vector file parsing and path analysis
2. Curvature detection and radius calculation
3. Angle detection and sharpness measurement
4. Basic complexity scoring algorithm

### Phase 2: Advanced Complexity Factors
1. Combination penalty calculations (curves + corners)
2. Size-based rule engine
3. Material vs labor transition logic
4. File quality assessment

### Phase 3: Validation and Fallback Systems
1. Old vs new method comparison
2. Variance detection and flagging
3. Manual override interface
4. Quality assurance reporting

## Data Structure Requirements

### Input Data (per letter):
```json
{
  "vector_path_data": "SVG path data or Illustrator data",
  "bounding_box": {"width": 12.5, "height": 8.0},
  "style": "front_lit_channel_letter",
  "return_depth": "4in",
  "material_specs": {...}
}
```

### Complexity Analysis Output:
```json
{
  "complexity_score": 1.75,
  "calculation_method": "geometric_analysis|linear_fallback|area_based",
  "geometric_factors": {
    "curvature_complexity": 0.8,
    "angle_penalty": 0.3,
    "combination_penalty": 0.65
  },
  "size_flags": ["minimum_size_ok", "maximum_size_ok"],
  "file_quality": "clean|dirty|failed_cleaning",
  "pricing_comparison": {
    "new_method": 125.50,
    "old_method": 110.00,
    "variance_percent": 14.1,
    "requires_review": true
  }
}
```

## Manufacturing Cost Factors to Consider

### Fabrication Difficulty:
1. **Router Path Complexity**: Complex curves require slower cutting speeds
2. **Sharp Corners**: Difficult to achieve clean corners without overcutting
3. **Curve-to-Corner Transitions**: Require careful toolpath planning
4. **Small Details**: Require precision tooling and setup time

### Material Usage:
1. **Face Material**: Scales with area for large letters
2. **Return Material**: Linear scaling with perimeter
3. **Waste Factor**: Complex shapes have higher material waste
4. **Fastener Requirements**: Complex perimeters need more attachment points

### Labor Factors:
1. **Setup Time**: Complex letters require more careful setup
2. **Programming Time**: Complex toolpaths take longer to generate
3. **Finishing Time**: Sharp corners and curves require more hand finishing
4. **Assembly Complexity**: Difficult shapes are harder to assemble cleanly

## Integration Points

### With Existing Systems:
- **Customer Preferences**: Default materials and specifications per customer
- **Inventory System**: Material availability and costing
- **Tax System**: Apply customer-specific tax rates to calculated costs
- **Job Tracking**: Complexity scores inform production scheduling

### Future Integrations:
- **Illustrator Plugin**: Direct vector analysis from design files
- **Production Scheduling**: Use complexity scores for time estimation
- **Quality Control**: Track actual vs predicted fabrication difficulty
- **Pricing Optimization**: Machine learning on actual costs vs predictions

## Implementation Notes
- Start with simplified geometric analysis
- Build robust fallback systems from day one
- Plan for iterative refinement based on production feedback
- Consider machine learning integration for future optimization