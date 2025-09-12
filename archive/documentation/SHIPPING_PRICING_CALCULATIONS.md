# Shipping Pricing Calculations - Complete Analysis

## Overview
The Shipping category provides comprehensive shipping cost calculations based on manual inputs from online shipping quotes, packaging requirements, and delivery services. The system handles base shipping costs with multipliers plus additional packaging and service fees.

## Current Excel Formula Structure

### Main Shipping Calculation Formula
```excel
=IF(Z12<>$KI$9,0,ROUND(KJ12*KI12+SUM(IFERROR($KK$10:$KN$10*KK12:KN12,0),KO12:KP12,IFERROR($KQ$10*KQ12,0)),2))
```

### Component Formulas

#### Base Shipping Amount
```excel
=IF(Z12<>$KI$9,0,IF('Estimator V2'!P4<>"",'Estimator V2'!P4,0))
```

#### Shipping Multiplier
```excel
=IF(Z12<>$KI$9,0,IFERROR(IFS('Estimator V2'!Q4<>"",'Estimator V2'!Q4,$AK$7<>"",$AK$7,1,$C$232),""))
```

#### Box Types (b, bb, B, BB)
```excel
=IF(Z12<>$KI$9,0,IF('Estimator V2'!R4<>"",'Estimator V2'!R4,0))  // b boxes
=IF(Z12<>$KI$9,0,IF('Estimator V2'!S4<>"",'Estimator V2'!S4,0))  // bb boxes  
=IF(Z12<>$KI$9,0,IF('Estimator V2'!T4<>"",'Estimator V2'!T4,0))  // B boxes
=IF(Z12<>$KI$9,0,IF('Estimator V2'!U4<>"",'Estimator V2'!U4,0))  // BB boxes
```

#### Packaging Services
```excel
=IF(Z12<>$KI$9,0,IF('Estimator V2'!V4<>"",'Estimator V2'!V4,0))  // Pallet
=IF(Z12<>$KI$9,0,IF('Estimator V2'!W4<>"",'Estimator V2'!W4,0))  // Crate
```

#### Additional Services
```excel
=IF(Z12<>$KI$9,0,IF('Estimator V2'!X4<>"",'Estimator V2'!X4,0))  // Tailgate
```

### Rate Configuration (Current)
```
Cell B228: b = $25
Cell B229: bb = $40  
Cell B230: B = $55
Cell B231: BB = $80
Cell B232: multi = 1.5
Cell B233: Tailgate = $60
```

### Input References
- **'Estimator V2'!P4**: Base shipping amount (from online quotes)
- **'Estimator V2'!Q4**: Multiplier quantity
- **'Estimator V2'!R4**: b boxes (small boxes)
- **'Estimator V2'!S4**: bb boxes (medium-small boxes)
- **'Estimator V2'!T4**: B boxes (large boxes)  
- **'Estimator V2'!U4**: BB boxes (extra large boxes)
- **'Estimator V2'!V4**: Pallet costs (custom per job)
- **'Estimator V2'!W4**: Crate costs (custom per job)
- **'Estimator V2'!X4**: Tailgate service
- **'Estimator V2'!Y4**: Estimated delivery days (display only)

## Shipping Calculation Logic

### Activation Condition
```
IF Z12 = $KI$9 THEN process shipping calculation
ELSE return 0 (inactive)
```
- Z12: Selected product on estimate line
- $KI$9: Shipping product identifier

### Calculation Formula
```
Total = (Base Shipping × Multiplier) + Box Costs + Packaging Costs + Service Costs
```

**Breakdown:**
1. **Base Shipping Cost**: Manual input from online shipping quotes
2. **Multiplier Application**: Base × Multiplier (default 1.5 for multiple pieces)
3. **Box Costs**: Quantity × Rate for each box type (b, bb, B, BB)
4. **Packaging Costs**: Manual amounts for pallets and crates
5. **Service Costs**: Additional services like tailgate delivery

### Box Types and Pricing

#### Standard Box Types
- **b (small)**: $25 per box
- **bb (medium-small)**: $40 per box
- **B (large)**: $55 per box  
- **BB (extra large)**: $80 per box

#### Box Selection Logic
- Manual input based on actual packaging requirements
- Multiple box types can be used in same shipment
- Each type priced independently

### Example Calculations

#### Simple Shipping Example
**Inputs:**
- Base Shipping: $75 (from UPS quote)
- Multiplier: 1.5 (multiple pieces)
- b boxes: 2
- bb boxes: 1
- Tailgate: Yes
- Delivery Days: 3

**Calculation:**
```
Base with Multiplier: $75 × 1.5 = $112.50
Box Costs: (2 × $25) + (1 × $40) = $50 + $40 = $90
Tailgate Service: $60
Total: $112.50 + $90 + $60 = $262.50
```

#### Complex Shipping with Custom Packaging
**Inputs:**
- Base Shipping: $150 (freight quote)
- Multiplier: 1.0 (single large piece)
- B boxes: 0
- Custom Crate: $200
- Custom Pallet: $75
- Tailgate: Yes
- Delivery Days: 5

**Calculation:**
```
Base with Multiplier: $150 × 1.0 = $150
Box Costs: $0
Custom Packaging: $200 + $75 = $275
Tailgate Service: $60
Total: $150 + $275 + $60 = $485
```

## Business Process Integration

### Quote Generation Process
1. **Get Shipping Quote**: Manual lookup from carrier websites (UPS, FedEx, freight)
2. **Assess Packaging**: Determine box types and quantities needed
3. **Calculate Custom Costs**: Estimate pallet/crate costs for unique items
4. **Add Services**: Include tailgate delivery if required
5. **Input to System**: Enter all values in estimation worksheet

### Packaging Assessment Guidelines
- **b boxes**: Small signs, vinyl rolls, small hardware
- **bb boxes**: Medium signs, multiple small items
- **B boxes**: Large signs, substantial hardware
- **BB boxes**: Extra large signs, bulk items
- **Pallets**: Heavy or oversized items requiring forklift
- **Crates**: Fragile or high-value items needing protection

## Database Schema Design

### Shipping Rate Configuration
```sql
CREATE TABLE shipping_rates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rate_type VARCHAR(50) NOT NULL, -- 'box_b', 'box_bb', 'box_B', 'box_BB', 'multiplier', 'tailgate'
    rate_amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_rate_type (rate_type)
);
```

### Shipping Rate Data
```sql
INSERT INTO shipping_rates (rate_type, rate_amount, description) VALUES
('box_b', 25.00, 'Small box packaging'),
('box_bb', 40.00, 'Medium-small box packaging'),
('box_B', 55.00, 'Large box packaging'),
('box_BB', 80.00, 'Extra large box packaging'),
('multiplier', 1.5, 'Default shipping multiplier'),
('tailgate', 60.00, 'Tailgate delivery service');
```

### Job Shipping Calculations
```sql
CREATE TABLE job_shipping_calculations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    line_item_id INT NOT NULL,
    base_shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    box_b_quantity INT DEFAULT 0,
    box_bb_quantity INT DEFAULT 0,
    box_B_quantity INT DEFAULT 0,
    box_BB_quantity INT DEFAULT 0,
    custom_pallet_cost DECIMAL(10,2) DEFAULT 0,
    custom_crate_cost DECIMAL(10,2) DEFAULT 0,
    tailgate_required BOOLEAN DEFAULT FALSE,
    estimated_delivery_days INT DEFAULT 0,
    calculated_total DECIMAL(10,2) NOT NULL,
    shipping_quote_source VARCHAR(255), -- 'UPS', 'FedEx', 'Freight', etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (line_item_id) REFERENCES job_line_items(id)
);
```

### Shipping Tracking (Future Enhancement)
```sql
CREATE TABLE job_shipping_actuals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    shipping_calculation_id INT NOT NULL,
    actual_shipping_cost DECIMAL(10,2),
    actual_delivery_days INT,
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    shipped_date DATE,
    delivered_date DATE,
    variance_amount DECIMAL(10,2) AS (actual_shipping_cost - (
        SELECT calculated_total FROM job_shipping_calculations 
        WHERE id = shipping_calculation_id
    )) STORED,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shipping_calculation_id) REFERENCES job_shipping_calculations(id)
);
```

## TypeScript Interfaces

### Shipping Rate Configuration
```typescript
interface ShippingRate {
    id: number;
    rate_type: string;
    rate_amount: number;
    description: string;
    is_active: boolean;
}
```

### Shipping Calculation Input
```typescript
interface ShippingCalculationInput {
    base_shipping_amount: number;
    shipping_multiplier: number;
    box_quantities: {
        b: number;
        bb: number;
        B: number;
        BB: number;
    };
    custom_costs: {
        pallet: number;
        crate: number;
    };
    services: {
        tailgate: boolean;
    };
    estimated_delivery_days: number;
    shipping_quote_source?: string;
}
```

### Shipping Calculation Result
```typescript
interface ShippingCalculationResult {
    base_shipping_amount: number;
    shipping_multiplier: number;
    adjusted_base_cost: number;
    box_costs: {
        b: { quantity: number; rate: number; total: number };
        bb: { quantity: number; rate: number; total: number };
        B: { quantity: number; rate: number; total: number };
        BB: { quantity: number; rate: number; total: number };
    };
    total_box_cost: number;
    custom_costs: {
        pallet: number;
        crate: number;
    };
    total_custom_cost: number;
    service_costs: {
        tailgate: number;
    };
    total_service_cost: number;
    final_total: number;
    estimated_delivery_days: number;
    breakdown: string[];
}
```

## Calculation Engine Logic

### Main Shipping Calculator
```typescript
function calculateShipping(
    input: ShippingCalculationInput,
    rates: ShippingRate[]
): ShippingCalculationResult {
    
    // Get current rates
    const boxRates = {
        b: rates.find(r => r.rate_type === 'box_b')?.rate_amount || 0,
        bb: rates.find(r => r.rate_type === 'box_bb')?.rate_amount || 0,
        B: rates.find(r => r.rate_type === 'box_B')?.rate_amount || 0,
        BB: rates.find(r => r.rate_type === 'box_BB')?.rate_amount || 0
    };
    
    const tailgateRate = rates.find(r => r.rate_type === 'tailgate')?.rate_amount || 0;
    
    // Calculate adjusted base cost
    const adjustedBaseCost = input.base_shipping_amount * input.shipping_multiplier;
    
    // Calculate box costs
    const boxCosts = {
        b: {
            quantity: input.box_quantities.b,
            rate: boxRates.b,
            total: input.box_quantities.b * boxRates.b
        },
        bb: {
            quantity: input.box_quantities.bb,
            rate: boxRates.bb,
            total: input.box_quantities.bb * boxRates.bb
        },
        B: {
            quantity: input.box_quantities.B,
            rate: boxRates.B,
            total: input.box_quantities.B * boxRates.B
        },
        BB: {
            quantity: input.box_quantities.BB,
            rate: boxRates.BB,
            total: input.box_quantities.BB * boxRates.BB
        }
    };
    
    const totalBoxCost = Object.values(boxCosts).reduce((sum, box) => sum + box.total, 0);
    
    // Calculate service costs
    const serviceCosts = {
        tailgate: input.services.tailgate ? tailgateRate : 0
    };
    
    const totalServiceCost = Object.values(serviceCosts).reduce((sum, cost) => sum + cost, 0);
    
    // Calculate custom costs
    const totalCustomCost = input.custom_costs.pallet + input.custom_costs.crate;
    
    // Calculate final total
    const finalTotal = adjustedBaseCost + totalBoxCost + totalCustomCost + totalServiceCost;
    
    // Generate breakdown
    const breakdown = [
        `Base Shipping: $${input.base_shipping_amount}`,
        input.shipping_multiplier !== 1 ? `Multiplier (${input.shipping_multiplier}): $${adjustedBaseCost}` : '',
        ...Object.entries(boxCosts).map(([type, cost]) => 
            cost.quantity > 0 ? `${type.toUpperCase()} Boxes (${cost.quantity} × $${cost.rate}): $${cost.total}` : ''
        ),
        input.custom_costs.pallet > 0 ? `Custom Pallet: $${input.custom_costs.pallet}` : '',
        input.custom_costs.crate > 0 ? `Custom Crate: $${input.custom_costs.crate}` : '',
        input.services.tailgate ? `Tailgate Delivery: $${serviceCosts.tailgate}` : '',
        `Total: $${finalTotal}`
    ].filter(Boolean);
    
    return {
        base_shipping_amount: input.base_shipping_amount,
        shipping_multiplier: input.shipping_multiplier,
        adjusted_base_cost: adjustedBaseCost,
        box_costs: boxCosts,
        total_box_cost: totalBoxCost,
        custom_costs: input.custom_costs,
        total_custom_cost: totalCustomCost,
        service_costs: serviceCosts,
        total_service_cost: totalServiceCost,
        final_total: Math.round(finalTotal * 100) / 100,
        estimated_delivery_days: input.estimated_delivery_days,
        breakdown: breakdown
    };
}
```

## Business Rules

### Shipping Calculation Rules
1. **Base Amount Required**: Must have base shipping amount from carrier quote
2. **Multiplier Application**: Applied to base amount only, not to packaging/services
3. **Box Type Selection**: Manual selection based on actual packaging needs
4. **Custom Costs**: Manually estimated for each unique packaging requirement
5. **Service Addition**: Additional services applied as flat fees

### Rate Management
1. **Standard Box Rates**: Configurable but typically stable
2. **Service Rates**: Configurable (tailgate, etc.)
3. **Custom Costs**: Always manual input per job
4. **Multiplier**: Configurable default, can be overridden per shipment

### Integration Points
1. **Carrier Integration**: Manual process (future automation opportunity)
2. **Job Estimation**: Integrates with main estimating workflow  
3. **Cost Tracking**: Compare estimated vs. actual shipping costs
4. **Delivery Tracking**: Record estimated vs. actual delivery times

## Future Enhancement Opportunities

### Potential Automation
1. **Carrier API Integration**: Automatic quotes from UPS, FedEx APIs
2. **Dimension-Based Packaging**: Auto-calculate box requirements from dimensions
3. **Pallet/Crate Estimation**: Standard formulas based on size/weight/fragility
4. **Address-Based Services**: Auto-suggest tailgate for residential deliveries

### Advanced Features
1. **Shipping Cost Analysis**: Compare carriers and methods
2. **Delivery Performance Tracking**: Actual vs. estimated delivery times
3. **Cost Variance Reporting**: Estimated vs. actual shipping cost analysis
4. **Bulk Shipping Optimization**: Combine multiple jobs for cost savings

## Implementation Priority
- **Phase 1**: Current manual input system with configurable rates
- **Phase 2**: Enhanced tracking and variance reporting  
- **Phase 3**: Carrier API integration for automated quotes
- **Phase 4**: Intelligent packaging recommendations

This shipping system provides comprehensive cost calculation while maintaining the flexibility needed for custom manufacturing scenarios.