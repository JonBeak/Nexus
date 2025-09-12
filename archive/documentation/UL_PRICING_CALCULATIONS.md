# UL Pricing Calculations - Complete Analysis

## Overview
The UL category provides standalone UL certification pricing for scenarios requiring additional or supplementary UL beyond product-specific UL calculations. This system handles complex scenarios like multiple sign options rather than multiple individual signs.

## Current Excel Formula Structure

### Main UL Calculation Formula
```excel
=IF(Z12<>$JZ$9,0,IFS('Estimator V2'!P4<>"",IFS(OR('Estimator V2'!P4=0,'Estimator V2'!P4="no"),0,1,KD12+('Estimator V2'!P4)*KE12),1,0))
```

### Component Formulas

#### UL Sets
```excel
=IF(Z12<>$JZ$9,0,IFS('Estimator V2'!P4<>"",IFS(OR('Estimator V2'!P4=0,'Estimator V2'!P4="no"),0,1,'Estimator V2'!P4),1,0))
```

#### Additional Sets (+ sets)
```excel
=IF(Z12<>$JZ$9,0,IFS('Estimator V2'!Q4<>"",IFS(OR('Estimator V2'!Q4=0,'Estimator V2'!Q4="no"),0,1,('Estimator V2'!Q4)*KE12),1,0))
```

#### Additional Dollar Amount (+ $)
```excel
=IF(Z12<>$JZ$9,0,IFS('Estimator V2'!R4<>"",IFS(OR('Estimator V2'!R4=0,'Estimator V2'!R4="no"),"",1,'Estimator V2'!R4),1,""))
```

#### Base Rate
```excel
=IF(Z12<>$JZ$9,0,$I$108)
```

#### Per Set Rate
```excel
=IF(Z12<>$JZ$9,0,IF('Estimator V2'!R4<>"",'Estimator V2'!R4,$I$109))
```

### Rate Configuration (Current)
- **Cell I108**: UL Base = $150
- **Cell I109**: UL/Set = $50

### Input References
- **'Estimator V2'!P4**: Number of UL sets needed
- **'Estimator V2'!Q4**: Additional sets beyond base
- **'Estimator V2'!R4**: Additional dollar amount (flat fee)

## Proposed Enhanced Logic

### Smart Calculator Tiers
The current user wants to implement tiered pricing:
- **1 set**: $200 total
- **2+ sets**: $250, $300, etc. (progressive pricing)

### Three Input Methods
1. **Smart Calculator**: Automated tiered pricing based on quantity
2. **Component-Based**: Base ($150) + Per Set ($50) calculation
3. **Manual Override**: Custom price entry

## Current Calculation Logic

### Activation Condition
```
IF Z12 = $JZ$9 THEN process UL calculation
ELSE return 0 (inactive)
```
- Z12: Selected product on estimate line
- $JZ$9: UL product identifier

### Calculation Steps
1. **Check if UL product selected**: `Z12<>$JZ$9`
2. **Process UL sets**: From 'Estimator V2'!P4
3. **Add additional sets**: From 'Estimator V2'!Q4  
4. **Add flat dollar amount**: From 'Estimator V2'!R4
5. **Calculate total**: Base + (Sets × Rate) + Additional

### Example Calculations

#### Current System Example
**Inputs:**
- UL Sets (P4): 3
- Additional Sets (Q4): 1
- Additional $ (R4): $25
- Base Rate: $150
- Per Set Rate: $50

**Calculation:**
```
Base: $150
UL Sets: 3 × $50 = $150
Additional Sets: 1 × $50 = $50
Additional $: $25
Total: $150 + $150 + $50 + $25 = $375
```

#### Proposed Smart Calculator Example
**Inputs:**
- Quantity: 3 sets

**Smart Calculation:**
```
1 set = $200
2 sets = $250  
3 sets = $300
Result: $300
```

## Use Cases

### When UL Category Applies
1. **Supplementary UL**: Additional certification beyond product-specific UL
2. **Multiple Options**: Complex scenarios with multiple sign options vs. multiple individual signs
3. **Custom UL Requirements**: Non-standard certification needs

### Relationship to Product UL
- **Channel Letters**: Have built-in UL calculation per letter type
- **Blade Signs**: Have integrated UL logic
- **UL Category**: Provides additional/supplementary UL for complex scenarios

## Database Schema Design

### UL Configuration Table
```sql
CREATE TABLE ul_rates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rate_type ENUM('smart_tier', 'component_base', 'component_per_set') NOT NULL,
    tier_quantity INT NULL, -- For smart tiers (1, 2, 3, etc.)
    rate_amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### UL Configuration Data
```sql
-- Smart Calculator Tiers
INSERT INTO ul_rates (rate_type, tier_quantity, rate_amount, description) VALUES
('smart_tier', 1, 200.00, '1 set - flat rate'),
('smart_tier', 2, 250.00, '2 sets - flat rate'),
('smart_tier', 3, 300.00, '3 sets - flat rate');

-- Component Rates
INSERT INTO ul_rates (rate_type, tier_quantity, rate_amount, description) VALUES
('component_base', NULL, 150.00, 'UL base fee'),
('component_per_set', NULL, 50.00, 'UL per set fee');
```

### Job UL Tracking Table
```sql
CREATE TABLE job_ul_calculations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    line_item_id INT NOT NULL,
    calculation_method ENUM('smart_tier', 'component_based', 'manual_override') NOT NULL,
    ul_sets INT NOT NULL DEFAULT 0,
    additional_sets INT DEFAULT 0,
    additional_amount DECIMAL(10,2) DEFAULT 0,
    manual_override_amount DECIMAL(10,2) NULL,
    calculated_total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (line_item_id) REFERENCES job_line_items(id)
);
```

## TypeScript Interfaces

### UL Rate Configuration
```typescript
interface ULRate {
    id: number;
    rate_type: 'smart_tier' | 'component_base' | 'component_per_set';
    tier_quantity?: number;
    rate_amount: number;
    description: string;
    is_active: boolean;
}
```

### UL Calculation Input
```typescript
interface ULCalculationInput {
    method: 'smart_tier' | 'component_based' | 'manual_override';
    ul_sets: number;
    additional_sets?: number;
    additional_amount?: number;
    manual_override_amount?: number;
}
```

### UL Calculation Result
```typescript
interface ULCalculationResult {
    method: string;
    ul_sets: number;
    additional_sets: number;
    additional_amount: number;
    base_fee: number;
    per_set_fee: number;
    calculated_subtotal: number;
    manual_override?: number;
    final_total: number;
    breakdown: string[];
}
```

## Calculation Engine Logic

### Smart Tier Calculator
```typescript
function calculateSmartTierUL(sets: number, tierRates: ULRate[]): number {
    const tierRate = tierRates.find(rate => 
        rate.rate_type === 'smart_tier' && rate.tier_quantity === sets
    );
    
    if (tierRate) {
        return tierRate.rate_amount;
    }
    
    // For quantities beyond defined tiers, use progressive logic
    // This would need business rule clarification
    return 0;
}
```

### Component-Based Calculator
```typescript
function calculateComponentUL(
    input: ULCalculationInput, 
    rates: ULRate[]
): ULCalculationResult {
    const baseRate = rates.find(r => r.rate_type === 'component_base')?.rate_amount || 0;
    const perSetRate = rates.find(r => r.rate_type === 'component_per_set')?.rate_amount || 0;
    
    const baseFee = baseRate;
    const setsFee = input.ul_sets * perSetRate;
    const additionalSetsFee = (input.additional_sets || 0) * perSetRate;
    const additionalAmount = input.additional_amount || 0;
    
    const calculatedTotal = baseFee + setsFee + additionalSetsFee + additionalAmount;
    
    return {
        method: 'component_based',
        ul_sets: input.ul_sets,
        additional_sets: input.additional_sets || 0,
        additional_amount: additionalAmount,
        base_fee: baseFee,
        per_set_fee: perSetRate,
        calculated_subtotal: calculatedTotal,
        final_total: calculatedTotal,
        breakdown: [
            `Base UL Fee: $${baseFee}`,
            `UL Sets (${input.ul_sets} × $${perSetRate}): $${setsFee}`,
            input.additional_sets ? `Additional Sets (${input.additional_sets} × $${perSetRate}): $${additionalSetsFee}` : '',
            input.additional_amount ? `Additional Amount: $${additionalAmount}` : '',
            `Total: $${calculatedTotal}`
        ].filter(Boolean)
    };
}
```

## Business Rules

### UL Category Application
1. **Product Selection**: Only active when UL product type is selected on estimate line
2. **Supplementary Nature**: Used in addition to, not replacement of, product-specific UL
3. **Complex Scenarios**: Primarily for multiple options vs. multiple individual signs

### Rate Management
1. **Smart Tiers**: Configurable quantity-based flat rates
2. **Component Rates**: Separate base and per-set configurable rates  
3. **Manual Override**: Always available for custom scenarios

### Integration Points
1. **Job Estimation**: Integrates with main estimating workflow
2. **Product Selection**: Activated by product type selection
3. **Audit Trail**: All UL calculations tracked with method and breakdown

## Implementation Priority
- **Phase 1**: Basic component-based calculation (current Excel logic)
- **Phase 2**: Smart tier calculator with configurable rates
- **Phase 3**: Manual override capabilities
- **Phase 4**: Integration with product-specific UL systems

This UL category provides essential flexibility for complex certification scenarios while maintaining clear audit trails and configurable rate structures.