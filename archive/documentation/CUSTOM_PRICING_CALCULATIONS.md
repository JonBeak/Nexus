# Custom Pricing Calculations - Complete Documentation

## Overview

The Custom pricing system provides a flexible manual input mechanism for adding arbitrary line items to estimates. It serves as a catch-all for products, services, or adjustments that don't fit into the standard pricing categories. This system has no automated calculations - all values are manually entered.

## Input Structure

### Custom Line Item Fields
| Field | Type | Description | Examples |
|-------|------|-------------|----------|
| **Product/Description** | String | Text description of the custom item | "Rush delivery", "Design consultation", "Special hardware" |
| **Amount** | Float | Cost amount for the line item | 150.00, 75.50, 1200.00 |

## Calculation Logic

### Manual Input System
**Business Logic**: Direct passthrough of user inputs with no processing

```
Custom Item Creation:
Step 1: User enters description (string)
Step 2: User enters amount (float)
Step 3: System displays exactly as entered

No validation beyond:
- Description: Accept any text (including empty)
- Amount: Must be valid numeric (positive, negative, or zero)
```

## Use Cases

### Typical Custom Line Items

**Additional Services:**
```
- Product: "Design consultation - 2 hours"
- Amount: $300.00

- Product: "Site survey and measurements"  
- Amount: $150.00

- Product: "Installation supervision"
- Amount: $500.00
```

**Special Materials:**
```
- Product: "Custom powder coating - Red RAL 3020"
- Amount: $450.00

- Product: "Imported specialty vinyl"
- Amount: $125.00

- Product: "Custom LED controller"
- Amount: $875.00
```

**Adjustments:**
```
- Product: "Volume discount"
- Amount: -$250.00

- Product: "Rush delivery surcharge"  
- Amount: $200.00

- Product: "Material shortage adjustment"
- Amount: $75.50
```

**Labor Overrides:**
```
- Product: "Complex installation - 8 hours @ $125/hr"
- Amount: $1000.00

- Product: "Weekend work premium"
- Amount: $300.00

- Product: "Crane rental for installation"
- Amount: $650.00
```

## Input Processing Examples

### Valid Inputs
```
Input: Product="Rush delivery", Amount=150.00
Output: Line item displays "Rush delivery - $150.00"

Input: Product="Volume discount", Amount=-250.00  
Output: Line item displays "Volume discount - -$250.00" (or "Volume discount - ($250.00)")

Input: Product="", Amount=75.50
Output: Line item displays amount only: "$75.50"

Input: Product="Design consultation", Amount=0
Output: Line item displays "Design consultation - $0.00"
```

### Invalid Inputs (Error Handling)
```
Input: Product="Valid description", Amount="abc"
Error: Invalid amount - must be numeric

Input: Product="Valid description", Amount=""
Error: Amount required (or default to $0.00)

Input: Product=null, Amount=100.00
Result: Display "$100.00" (no product description)
```

## Database Schema Requirements

```sql
CREATE TABLE custom_line_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  estimate_id INT NOT NULL,
  item_order INT NOT NULL DEFAULT 1,
  product_description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (estimate_id) REFERENCES estimates(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- No pricing configuration needed - all manual input
-- No lookup tables needed - all manual input  
-- No calculation rules needed - all manual input
```

## Business Logic Summary

**Key Features:**
1. **Complete Flexibility**: Any description, any amount
2. **No Validation**: Beyond basic data type requirements
3. **No Calculations**: Pure manual input system
4. **Positive/Negative**: Supports both charges and credits
5. **Simple Integration**: Adds to estimate total like any other line item

**Design Philosophy:**
- **Simplicity**: No complex rules or calculations
- **Flexibility**: Handle edge cases and special situations
- **Override Capability**: Add anything not covered by standard categories
- **Manual Control**: User has complete control over pricing

**Common Workflows:**
1. **Standard Categories First**: Use automated pricing for standard products
2. **Custom for Exceptions**: Add custom items for special cases
3. **Final Adjustments**: Use custom items for discounts, surcharges, corrections
4. **Service Add-ons**: Manual labor, consultation, delivery charges

## Integration with Other Categories

### Relationship to Other Systems
```
Custom items integrate with:
- **Multipliers**: Custom amounts affected by section/total multipliers (if applicable)
- **Discounts**: Custom amounts subject to percentage discounts (if applicable)  
- **Totaling**: Custom amounts add to estimate subtotal like any line item
- **Audit Trail**: Custom entries logged like all pricing changes
```

### When to Use Custom vs Standard Categories
```
Use Standard Categories When:
- Product fits existing calculation logic
- Automated pricing is accurate
- Standard options cover the need

Use Custom When:
- Unique product not covered by standard categories
- Need to override calculated pricing
- Adding services (design, consultation, delivery)
- Applying manual discounts/surcharges
- Correcting estimate totals
```

## Implementation Notes

### Frontend Interface
```
Simple form with two fields:
- Description: Text input (optional)
- Amount: Number input (required, supports decimals and negative values)

Display format:
- If description exists: "Description - $Amount"
- If no description: "$Amount"
- Negative amounts: "($Amount)" or "-$Amount" based on preference
```

### Validation Rules
```
Description:
- Optional field
- Accept any text including empty string
- No length limits (reasonable database limits apply)

Amount:
- Required field
- Must be valid decimal number
- Support positive, negative, and zero values
- Standard currency precision (2 decimal places)
```

This documentation captures the complete Custom pricing system - the simplest category that provides maximum flexibility for manual pricing inputs and adjustments.