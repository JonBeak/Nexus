# Wiring Pricing Calculations - Complete Documentation

## Overview

The Wiring system calculates pricing for electrical connections including DC plugs, wall plugs, and extra wire lengths. It provides flexible override capabilities for all components while maintaining standard default rates. The system supports both piece-based wire calculations and additional bulk wire requirements.

## Rate Structure (Configurable Values)

### Wiring Component Rates (B222-C225)
| Component | Default Rate | Description | Cell Ref |
|-----------|-------------|-------------|----------|
| DC Connectors | $15.00 | Default DC plug cost | C223 |
| Wall Plugs | $20.00 | Wall plug cost | C224 |
| Wire Rate (per inch) | $0.0583 | Base wire cost per inch | C225 |
| Wire Rate (per foot) | $0.70 | Calculated rate (per inch × 12) | C225×12 |

### Rate Calculation Details
```
Wire Rate Breakdown:
- Base calculation: $70 ÷ 12 ÷ 100 = $0.0583 per inch
- Per foot rate: $0.0583 × 12 = $0.70 per foot
- This allows flexible inch/foot conversions
```

## Calculation Logic

### 1. DC Plug Calculations
**Business Logic**: Quantity × (override price OR default price)

```
DC Plug Cost Calculation:
IF dc_plug_quantity is empty OR zero:
    dc_plug_cost = $0
ELSE:
    IF dc_plug_price_override provided:
        unit_price = dc_plug_price_override
    ELSE:
        unit_price = $15.00 (default)
    
    dc_plug_cost = dc_plug_quantity × unit_price

Examples:
- Quantity: 3, Override: "" → 3 × $15.00 = $45.00
- Quantity: 5, Override: $12.00 → 5 × $12.00 = $60.00
- Quantity: 0 → $0.00 (no plugs)
```

### 2. Wall Plug Calculations  
**Same logic as DC plugs with different default rate**

```
Wall Plug Cost Calculation:
IF wall_plug_quantity is empty OR zero:
    wall_plug_cost = $0
ELSE:
    IF wall_plug_price_override provided:
        unit_price = wall_plug_price_override
    ELSE:
        unit_price = $20.00 (default)
    
    wall_plug_cost = wall_plug_quantity × unit_price

Examples:
- Quantity: 2, Override: "" → 2 × $20.00 = $40.00
- Quantity: 4, Override: $18.00 → 4 × $18.00 = $72.00
- Quantity: 0 → $0.00 (no wall plugs)
```

### 3. Extra Wire Calculations
**Dual Method Logic**: Piece-based + bulk wire with flexible rate override

```
Step 1: Calculate total wire length
piece_based_length = pieces × length_per_piece
total_wire_length = piece_based_length + additional_bulk_length

Step 2: Determine wire rate
IF wire_rate_override provided:
    rate_per_foot = wire_rate_override
ELSE:
    rate_per_foot = $0.70 (default: $0.0583 × 12)

Step 3: Calculate total wire cost
wire_cost = total_wire_length × rate_per_foot

Examples:
- Pieces: 5, Length/piece: 8ft, Bulk: 0ft, Rate: default
  → (5 × 8) + 0 = 40ft × $0.70 = $28.00

- Pieces: 3, Length/piece: 12ft, Bulk: 25ft, Rate: $0.60 override  
  → (3 × 12) + 25 = 61ft × $0.60 = $36.60

- Pieces: 0, Length/piece: 0, Bulk: 50ft, Rate: default
  → 0 + 50 = 50ft × $0.70 = $35.00
```

## Input Processing Examples

### DC Plug Examples
```
Input: Quantity=3, Override="" (empty)
- Calculation: 3 × $15.00 = $45.00
- Description: "3@$15 DC Plugs"

Input: Quantity=5, Override=$12.00
- Calculation: 5 × $12.00 = $60.00  
- Description: "5@$12 DC Plugs"

Input: Quantity=0 or empty
- Calculation: $0.00
- Description: "" (no description)
```

### Wall Plug Examples
```
Input: Quantity=2, Override="" (empty)
- Calculation: 2 × $20.00 = $40.00
- Description: "2@$20 Wall Plugs"

Input: Quantity=4, Override=$18.50
- Calculation: 4 × $18.50 = $74.00
- Description: "4@$18.5 Wall Plugs"
```

### Combined Plug Examples
```
DC: Quantity=3, Wall: Quantity=2
- Total Plugs: $45.00 + $40.00 = $85.00
- Description: "3@$15 DC Plugs + 2@$20 Wall Plugs"

DC: Quantity=0, Wall: Quantity=2  
- Total Plugs: $0 + $40.00 = $40.00
- Description: "2@$20 Wall Plugs" (no DC mention)
```

### Extra Wire Examples
```
Input: Pieces=5, Length=8, Total=0, Rate="" (default)
- Calculation: (5 × 8) + 0 = 40ft × $0.70 = $28.00
- Description: "5pc@8ft [40ft] @$0.7/ft"

Input: Pieces=3, Length=12, Total=25, Rate=$0.60
- Calculation: (3 × 12) + 25 = 61ft × $0.60 = $36.60
- Description: "3pc@12ft [36ft]+[25ft] @$0.6/ft"

Input: Pieces=0, Length=0, Total=50, Rate="" (default)
- Calculation: 0 + 50 = 50ft × $0.70 = $35.00
- Description: "[50ft] @$0.7/ft"
```

### Complete Wiring Example
**Input Set:**
- DC Plugs: Quantity=3, Override=""
- Wall Plugs: Quantity=2, Override=$18.00
- Wire: Pieces=4, Length=10ft, Total=15ft, Rate=""

**Calculations:**
```
1. DC Plugs: 3 × $15.00 = $45.00
2. Wall Plugs: 2 × $18.00 = $36.00  
3. Plug Total: $45.00 + $36.00 = $81.00

4. Wire Length: (4 × 10) + 15 = 55ft
5. Wire Cost: 55 × $0.70 = $38.50

Total Wiring: $81.00 + $38.50 = $119.50

Descriptions:
- Plugs: "3@$15 DC Plugs + 2@$18 Wall Plugs"
- Wire: "4pc@10ft [40ft]+[15ft] @$0.7/ft"
```

## Error Handling

### Input Validation
```
Quantities:
- Empty input → treat as 0
- Non-numeric → treat as 0
- Negative → treat as 0 (or error)

Prices:
- Empty override → use default rate  
- Non-numeric override → use default rate
- Negative price → allow (could be credit/discount)

Wire Lengths:
- Empty input → treat as 0
- Non-numeric → treat as 0
- Support decimal values (e.g., 12.5ft)
```

### Description Generation
```
Plugs:
- If both DC and Wall: "DC info + Wall info"
- If only DC: "DC info" (no Wall mention)
- If only Wall: "Wall info" (no DC mention)
- If neither: No plug description

Wire:
- If pieces and total: "Pieces info + [Total info]"  
- If only pieces: "Pieces info [calculated total]"
- If only total: "[Total info]"
- If neither: No wire description
```

## Database Schema Requirements

```sql
CREATE TABLE wiring_pricing_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value DECIMAL(10,6) NOT NULL,
  config_description VARCHAR(200),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO wiring_pricing_config VALUES
(1, 'DC_CONNECTOR_DEFAULT_COST', 15.0000, 'Default DC connector cost', '2025-09-01', true),
(2, 'WALL_PLUG_DEFAULT_COST', 20.0000, 'Default wall plug cost', '2025-09-01', true),
(3, 'WIRE_COST_PER_INCH', 0.058333, 'Wire cost per inch', '2025-09-01', true),
(4, 'WIRE_COST_PER_FOOT', 0.700000, 'Wire cost per foot (per inch × 12)', '2025-09-01', true);

CREATE TABLE wiring_components (
  id INT PRIMARY KEY AUTO_INCREMENT,
  component_name VARCHAR(50) NOT NULL,
  component_type ENUM('dc_plug', 'wall_plug', 'wire') NOT NULL,
  default_unit_cost DECIMAL(8,4),
  unit_of_measure VARCHAR(20), -- 'each', 'foot', 'inch'
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO wiring_components VALUES
(1, 'DC Connector', 'dc_plug', 15.0000, 'each', '2025-09-01', true),
(2, 'Wall Plug', 'wall_plug', 20.0000, 'each', '2025-09-01', true),
(3, 'Wire', 'wire', 0.7000, 'foot', '2025-09-01', true);
```

## Business Logic Summary

**Key Features:**
1. **Flexible Override System**: All default rates can be manually overridden
2. **Dual Wire Calculation**: Piece-based (quantity × length) + bulk additional wire
3. **Component Integration**: Plugs and wire calculated separately, summed for total
4. **Intelligent Descriptions**: Context-aware description generation
5. **Default Rate Protection**: Uses standard rates when overrides not provided

**Calculation Methods:**
- **Plug Costs**: Simple quantity × unit_price with override capability
- **Wire Costs**: Complex dual-method length calculation with rate flexibility
- **Total Integration**: Component costs sum for complete wiring price

**Override Flexibility:**
- **Per-Job Rates**: Override default rates for specific estimates
- **Component Independence**: DC plugs, wall plugs, wire can each have custom rates  
- **Bulk Flexibility**: Handle both structured (piece-based) and unstructured (bulk) wire requirements

This documentation captures the complete Wiring pricing system with flexible override capabilities, dual wire calculation methods, and intelligent component integration.