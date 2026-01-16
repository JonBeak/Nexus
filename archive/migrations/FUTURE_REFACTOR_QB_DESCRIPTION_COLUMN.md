# Future Refactoring: Extract qb_description from JSON to Database Column

**Date Created:** 2025-11-17
**Priority:** Medium
**Category:** Database Schema Improvement

## Problem

Currently, `qb_description` (QuickBooks description field) is stored inside the `specifications` JSON column in the `order_parts` table. This is architecturally incorrect because:

1. **Wrong data category** - QB/invoice data is mixed with technical specifications
2. **Hard to query** - Requires JSON parsing to access QB description
3. **Poor data integrity** - No column-level validation or typing
4. **Inconsistent architecture** - Other QB/invoice fields have their own columns

## Current State

### Current Structure (`order_parts` table)
```
qb_item_name         VARCHAR(255)  - QB item code
invoice_description  TEXT          - Calculation display for invoice
specifications       JSON          - Contains _qb_description inside JSON
unit_price           DECIMAL(10,2) - Price per unit
extended_price       DECIMAL(10,2) - Total price
```

### Current JSON Structure
```json
{
  "_template_1": "Return",
  "row1_spec1": "4\"",
  "_qb_description": "Channel Letters - Front Lit - 4\" Return",  // ← Should be column
  "specs_qty": 8
}
```

## Proposed Solution

### Step 1: Add Database Column

**Migration:** `2025-XX-XX-add-qb-description-column.sql`

```sql
-- Add qb_description column to order_parts table
ALTER TABLE order_parts
ADD COLUMN qb_description TEXT
COMMENT 'QuickBooks description field (extracted from specifications JSON)'
AFTER invoice_description;
```

**Column Specifications:**
- **Name:** `qb_description`
- **Type:** `TEXT` (matches `invoice_description`)
- **Nullable:** `YES` (not all parts have QB descriptions)
- **Position:** After `invoice_description` (keeps QB fields together)
- **Default:** `NULL`

### Step 2: Update Type Definitions

**File:** `/backend/web/src/types/orders.ts`

Update `OrderPart`, `CreateOrderPartData`, and `OrderPartForPDF` interfaces:

```typescript
export interface OrderPart {
  // ... existing fields ...
  qb_item_name?: string;         // QuickBooks item name
  invoice_description?: string;  // Invoice description (calculation display)
  qb_description?: string;        // QuickBooks description field (NEW)
  unit_price?: number;
  extended_price?: number;
  // ... rest of fields ...
}
```

### Step 3: Data Migration Script

Create a one-time migration script to extract existing `_qb_description` values from JSON and populate the new column:

**File:** `/database/migrations/2025-XX-XX-migrate-qb-description-data.sql`

```sql
-- Extract _qb_description from specifications JSON and populate new column
UPDATE order_parts
SET qb_description = JSON_UNQUOTE(JSON_EXTRACT(specifications, '$._qb_description'))
WHERE JSON_EXTRACT(specifications, '$._qb_description') IS NOT NULL;

-- Verify migration
SELECT
  part_id,
  qb_description,
  JSON_EXTRACT(specifications, '$._qb_description') as old_value
FROM order_parts
WHERE qb_description IS NOT NULL
LIMIT 10;
```

### Step 4: Update Repository Layer

**File:** `/backend/web/src/repositories/orderRepository.ts`

Update all queries to include `qb_description`:

```typescript
// getOrderWithCustomerForPDF
SELECT
  part_id,
  order_id,
  // ... other fields ...
  qb_item_name,
  invoice_description,
  qb_description,        // NEW
  unit_price,
  extended_price
FROM order_parts
WHERE order_id = ?
```

### Step 5: Update Order Part Creation

**File:** `/backend/web/src/services/orderPartCreationService.ts`

When creating order parts, write `qb_description` to both:
1. New column (for new architecture)
2. JSON field (for backward compatibility - can remove later)

### Step 6: Update Estimate PDF Generator

**File:** `/backend/web/src/services/pdf/generators/estimatePdfGenerator.ts`

Use the new column instead of parsing JSON:

```typescript
// OLD (current workaround)
description: part.invoice_description || part.product_type

// NEW (after refactoring)
description: part.qb_description || part.invoice_description || part.product_type
```

### Step 7: Clean Up (Optional - Later Phase)

After confirming everything works:
1. Remove `_qb_description` from specifications JSON (data cleanup)
2. Update all code that writes to specifications to skip `_qb_description`

## Benefits

✅ **Cleaner data architecture** - QB/invoice data grouped together
✅ **Easier to query** - No JSON parsing needed
✅ **Better performance** - Direct column access vs JSON extraction
✅ **Type safety** - Proper column typing and validation
✅ **More maintainable** - Clear separation of concerns
✅ **Future-proof** - Easier to integrate with QB API

## Files to Modify

### Backend
- [ ] `/database/migrations/2025-XX-XX-add-qb-description-column.sql` (CREATE)
- [ ] `/database/migrations/2025-XX-XX-migrate-qb-description-data.sql` (CREATE)
- [ ] `/backend/web/src/types/orders.ts` (UPDATE)
- [ ] `/backend/web/src/repositories/orderRepository.ts` (UPDATE)
- [ ] `/backend/web/src/services/orderPartCreationService.ts` (UPDATE)
- [ ] `/backend/web/src/services/pdf/generators/estimatePdfGenerator.ts` (UPDATE)

### Testing Checklist
- [ ] Run migration on development database
- [ ] Verify data migration script moved all `_qb_description` values
- [ ] Test order creation with new column
- [ ] Test estimate PDF generation with new column
- [ ] Test existing orders still work (backward compatibility)
- [ ] Verify QB sync still works (if implemented)

## Related Files

- Current workaround: `/backend/web/src/services/pdf/generators/estimatePdfGenerator.ts:151`
- Type definitions: `/backend/web/src/types/orders.ts:471-488`

## Notes

- This refactoring should be done AFTER the estimate PDF feature is stable
- No breaking changes - fully backward compatible
- Can be implemented incrementally (add column → migrate data → update code → clean up)
- Consider doing this alongside other QB integration work

---

**Status:** Documented for future implementation
**Estimated Effort:** 2-3 hours (including testing)
**Risk Level:** Low (backward compatible)
