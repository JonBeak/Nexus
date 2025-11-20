# Estimate Preview System Requirements

## Overview
Complete rewrite of the estimate preview system to support flexible calculations, advanced validation, subtotals, discounts, multipliers, and custom calculation rules per product type.

**Key Goals:**
- Make Internal view the default (Customer view used when sending estimates)
- Implement orange (missing info) vs red (invalid info) validation
- Support custom calculation rules per input line type
- Add subtotals, discounts, and multipliers functionality
- Enable one input line to generate multiple estimate preview lines
- Support text/empty lines for visual separation

## Validation System

### Orange Validation (Missing Information)
- **Trigger**: Mandatory fields are partially filled but not complete
- **Display**: Orange box around missing cells in input grid ONLY
- **Behavior**: Does NOT block calculations
- **Examples**:
  - Channel Letter Style selected but InchesData is empty
  - Some required fields filled, others empty (if no fields filled = no alert)
  - Optional fields filled doesn't trigger alerts on mandatory fields

### Red Validation (Invalid Information) 
- **Trigger**: Invalid data format or business rule violations
- **Display**: Red box around invalid cells in grid AND whole estimate preview window
- **Behavior**: BLOCKS calculations and estimate preview generation
- **Examples**:
  - InchesData expects "96x48" format but contains extra letters/invalid format
  - Backer size exceeds maximum allowed dimensions
  - Numeric fields contain non-numeric values

### Validation Integration
- Extend existing `useGridValidation` hook
- Validation needs parsing/calculating power for complex business rules
- Return validation flags before calculations begin

### Validation Layers & Data Flow
**Simple, recognizable layers triggering once:**
1. **Inputs** → 2. **Validations** → 3. **Input Grid Formatting** → 4. **Calculations** → 5. **Customer Preferences Validation**

**Validation Sub-layers:**
- **Formatting Layer**: Incorrect format validation (e.g., "96x48" format requirements)
- **Logic Layer**: Business rule validation (e.g., size too large for backer)

### Customer Preferences Validation
- **Display**: Customer requirements listed at top of estimate preview
- **Red Indicators**: Missing requirements turn RED in preference display
- **Example**: Customer requires UL, job includes LEDs but no UL → UL requirement shows RED
- **Layer**: Applied after calculations, validates final estimate against customer requirements

### Unified Database Architecture
- **Single source per item type**: Unified database containing prompts, validations, calculations
- **Manageable Rules**: All rules read from this unified system
- **Future Enhancement**: This may require a separate big refactoring project

## New Grid Fields Required

### Core Fields
```typescript
interface EstimateGridRow {
  // Existing fields...
  
  // New fields
  item_type: 'product' | 'assembly' | 'subtotal' | 'discount' | 'multiplier' | 'text' | 'custom';
  qty: number; // Line quantity (separate from 12-column calculations)
  
  // Multiplier configuration
  multiplier_value?: number;
  multiplier_target_lines?: string; // "1-10" | "1,2,3,6" | "1-5 + 7,9" | "all_above"
  
  // Discount configuration  
  discount_percentage?: number;
  discount_flat_amount?: number;
  discount_target_lines?: string; // Same format as multiplier_target_lines
  
  // Assembly configuration
  assembly_start_line?: number; // Line ID where assembly begins (end = assembly line itself)
  
  // Text/spacing
  text_content?: string; // For text lines, notes, section headers
}
```

### Target Line Format
- **Default**: Empty field - affects all lines above current line (no need to type "all_above")
- **Section-based**: Migrate from current 16-line section system to subtotal-based sections
- **Current Section**: Affects lines above it in current subtotal section
- **Whole Estimate**: Affects all lines above it in entire estimate
- **Assembly Reset**: When assembly member lines are moved, reset target line references

## Item Types and Behaviors

### Product Lines
- Generate main estimate line + sub-items based on product type
- Example: Channel Letters → Main line + LED line + Power Supply line + UL line
- **All calculations** affected by customer preferences, not just sub-items
- Custom calculation rules per product type
- **Dynamic Naming Examples**:
  - "3" Front Lit" chosen but no LEDs → Product name: "3" Channel Letters"
  - "3" Front Lit" chosen with LEDs → Product name: "3" Front Lit Channel Letters"

### Assembly Lines  
- Marks end of assembly group
- Assembly start determined by `assembly_start_line` field
- Assembly cost and description
- Visual grouping with colored indicators
- Validation: Subtotals cannot exist within assembly groups

### Subtotal Lines
- Creates section break in estimate preview
- Calculates sum from beginning or previous subtotal up to current line
- **Can be placed within assembly lines but throws RED validation error**
- Defines sections for discount/multiplier target logic

### Discount Lines
- Applies percentage and/or flat amount discount OR extra fees (rush fees, etc.)
- Targets lines in current subtotal section or whole estimate
- Shows as negative amount (discount) or positive amount (fees) in estimate preview
- **Display**: Just shows total amount, no need to reference applied lines
- Calculation: `(sum_of_target_lines * percentage) + flat_amount`

### Multiplier Lines
- Multiplies QTY of target lines by specified value
- Affects QTY in estimate preview, unit prices remain same
- Extended prices multiply accordingly
- Targets specific lines via `multiplier_target_lines`

### Text Lines
- Visual separation, notes, section headers
- No calculations or pricing
- Appears in estimate preview for formatting

## Calculation Engine Requirements

### Database Structure
```sql
-- Store calculation rules as JSON in database for editability
CREATE TABLE product_calculation_rules (
  id INT PRIMARY KEY,
  product_type_id INT,
  calculation_rules JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Backer pricing chart
CREATE TABLE backer_pricing_chart (
  id INT PRIMARY KEY,
  size_category VARCHAR(50),
  min_x DECIMAL(10,2),
  max_x DECIMAL(10,2), 
  min_y DECIMAL(10,2),
  max_y DECIMAL(10,2),
  price_per_unit DECIMAL(10,2),
  updated_at TIMESTAMP
);
```

### Product-Specific Calculations

#### Channel Letters
- **Input**: Style, height, width, LED type, power supply options
- **Output**: Main line + LED line + Power supply line + UL line (if required)
- **Rules**: Based on customer manufacturing preferences
- **Sub-items**: Determined by selections and preferences

#### Backers  
- **Input**: X, Y, Z dimensions
- **Normalization**: max(X,Y) becomes X, other becomes Y, Z unchanged
- **Lookup**: Find matching size category in pricing chart
- **Output**: Single line with calculated price

#### Vinyl
- **Input**: Multiple fields with "7+5+2" format parsing
- **Calculation**: Base cost per 3 yards + (total_yards * price_per_yard)
- **Output**: Sum of all vinyl input calculations

### Customer Preference Integration
- Manufacturing preferences stored in customer record
- Called during calculation time (temporary data until saved)
- Influences sub-item generation and pricing
- Examples: LED preferences, mounting options, finishing requirements

## Estimate Preview Display Rules

### Format Options
- **Internal** (default): Product/Service | Description | Calculation | Unit Price | Qty | Ext. Price
- **Customer** (for sending): Product/Service | Description | Unit Price | Qty | Ext. Price

### Display Logic
1. **Main Items**: Product name, description, unit price, qty, extended price
2. **Sub-items**: Indented, smaller font, related to parent item
3. **Assembly Groups**: Color-coded headers, indented items, assembly cost line
4. **Subtotals**: Section breaks with calculated totals
5. **Discounts**: Negative amounts (no reference to applied lines)
6. **Fees**: Positive amounts (no reference to applied lines)
7. **Text Lines**: Formatting/spacing, no pricing columns
8. **Custom Lines**: User-defined product/description with manual pricing
9. **Customer Preferences**: Display at top of estimate preview with validation indicators
10. **Final Totals**: Subtotal, tax, total (existing logic)

### Error States
- **Red Validation Errors**: Overlay blocking entire estimate preview window with error count
- **Orange Validation Warnings**: Grid highlighting only, calculations proceed
- **Invalid Lines**: Lines with errors simply don't show up in estimate preview (no placeholder values)

## Implementation Phases

### Phase 1: Extend Grid with New Fields and Item Types
- Add new fields to `EstimateGridRow` interface
- Update grid UI to support item type selection
- Add qty field and target line string inputs
- Implement text/empty line support

### Phase 3: Rewrite EstimateTable Component  
- New component structure for flexible item types
- Support for multiple preview lines per input line
- Subtotal section logic
- Discount and multiplier display
- Enhanced validation error display

### Phase 4: Integrate Enhanced Validation System
- Extend `useGridValidation` hook
- Orange vs red validation logic
- Complex business rule validation
- Product-specific validation rules

### Phase 2: Build Calculation Engine
- Database tables for calculation rules
- Product-specific calculation logic
- Customer preference integration
- Backer sizing and vinyl parsing
- Sub-item generation logic

## Technical Considerations

### Performance
- Memoize calculation results to prevent unnecessary recalculations
- Stable dependency arrays for React hooks
- Efficient target line parsing and updates

### Data Flow
1. Grid input changes → Validation check → Calculation engine → Estimate preview update
2. Customer preferences fetched once per estimate session
3. Calculation rules cached and updated when product rules change

### Error Handling
- **No graceful degradation**: 100% working product required
- **No fallback calculations**: System must work perfectly or fail clearly
- Clear error messages for invalid configurations
- Invalid lines simply don't appear in estimate preview

### Testing Strategy
- Unit tests for calculation engine logic
- Integration tests for validation system
- End-to-end tests for complete workflow
- Edge case testing for complex target line formats

---

## Implementation Progress

### Phase 1: Extend Grid with New Fields and Item Types - ✅ COMPLETED
**Completed September 4, 2025**

#### Database Schema Updates ✅
- Extended `job_estimate_items` table with new item types: 'subtotal', 'discount', 'multiplier', 'text'
- Added new fields: `qty`, `multiplier_value`, `multiplier_target_lines`, `discount_percentage`, `discount_flat_amount`, `discount_target_lines`, `assembly_start_line`, `text_content`
- Added validation constraints and indexes for performance

#### Frontend Interface Updates ✅
- Updated `EstimateRow` interface with all new fields
- Added QTY column to grid UI with input field for relevant item types
- Implemented item type selection dropdown with organized product types and special items
- Added display logic for subtotal, discount, multiplier, and text item types

#### Bug Fixes Completed ✅
- **Item Type Selection Bug**: Fixed `handleFieldChange` method to properly update row.type for new item types
- **Sub-item Formatting**: Added "└─ " prefix to sub-items in estimate preview while keeping clean export format
- **Dropdown Cleanup**: Removed inappropriate "Sub-item" product type from user selection (set inactive in database)
- **UI Consistency**: Standardized all Product/Item displays to use consistent `font-bold text-black` formatting

#### Current Status
- ✅ Database schema supports all new features
- ✅ Grid UI functional with QTY field and item type selection
- ✅ New item types (subtotal, discount, multiplier, text) selectable and displayable
- ✅ Sub-items display with proper hierarchy in estimate preview
- ✅ Consistent formatting across all item types
- ✅ System ready for Phase 2 implementation

**Next Steps**: Proceed with Phase 2 (Build Calculation Engine) when ready to implement flexible calculations and customer preference integration.