# QuickBooks Special Items Implementation

## Overview
Implemented support for special item types in QuickBooks estimate export, including Subtotals, Empty Rows, Custom description-only items, and proper handling of dividers and other special types.

## Implementation Date
November 3, 2025

## Changes Made

### 1. Updated QuickBooks API Interface
**File:** `/backend/web/src/utils/quickbooks/apiClient.ts`

Modified `QBEstimateLine` interface to support multiple DetailTypes:
- Added `SubTotalLineDetail` for subtotal lines
- Added `DescriptionLineDetail` for description-only lines
- Made `SalesItemLineDetail` optional (only for regular items)
- Made `Amount` optional (not required for description-only lines)
- Added `LineNum` for proper line ordering

### 2. Enhanced Estimate Creation Logic
**File:** `/backend/web/src/routes/quickbooks.ts`

#### Special Item Type Handling:

| Product Type ID | Name | QuickBooks Handling |
|-----------------|------|---------------------|
| 9 | Custom | If only description → `DescriptionOnly`; If has price → `SalesItemLineDetail` |
| 21 | Subtotal | `SubTotalLineDetail` with amount |
| 22 | Discount/Fee | Currently skipped (future enhancement) |
| 23 | Multiplier | Skipped (already applied to item prices) |
| 25 | Divider | Skipped entirely (not sent to QB) |
| 27 | Empty Row | `DescriptionOnly` with single space |

#### Key Features:
- Automatic detection of Custom items that are description-only vs. priced items
- Proper line numbering for all items sent to QuickBooks
- Console logging for debugging special item processing
- Maintains backward compatibility with existing regular items

## Testing

### Test Script
Created `/backend/web/src/scripts/test-special-items-qb.js` to verify special item handling with comprehensive test data covering all special item types.

### Expected Behavior
When sending an estimate with special items to QuickBooks:

1. **Regular items** → Create normal `SalesItemLineDetail` entries
2. **Subtotals** → Create `SubTotalLineDetail` entries showing section totals
3. **Empty Rows** → Create `DescriptionOnly` entries with space character
4. **Custom (description-only)** → Create `DescriptionOnly` entries with text
5. **Custom (with price)** → Create normal `SalesItemLineDetail` entries
6. **Dividers** → Completely skipped, not sent to QuickBooks
7. **Discount/Fee** → Currently skipped (placeholder for future DiscountLineDetail)
8. **Multipliers** → Skipped as their effect is already applied to item prices

## User Requirements Met

✅ **Subtotal, Empty Row, Custom implementation for QuickBooks**
- Subtotals properly show section totals
- Empty Rows maintain visual spacing
- Custom items with only description appear as notes/descriptions

✅ **Custom with only description = Empty Row / Note**
- Custom items without price/quantity are treated as description-only lines

✅ **Ignore Divider when sending to QuickBooks**
- Dividers (Product Type 25) are completely excluded from QB estimates

✅ **Other Special Items checked**
- Discount/Fee: Skipped with TODO for future enhancement
- Multiplier: Properly skipped as already applied

## Console Output
The implementation includes helpful console logging:
```
↳ Adding Subtotal at line 3 (Amount: 200)
↳ Adding Empty Row at line 4
↳ Adding Custom (description-only) at line 5: "Note: Customer requested..."
↳ Custom item at line 6 has price/quantity, treating as regular item
↳ Skipping Divider item at line 7
↳ Skipping Discount/Fee at line 8 (future enhancement)
↳ Skipping Multiplier at line 9 (already applied to items)
```

## Future Enhancements

1. **Discount/Fee Support**
   - Implement `DiscountLineDetail` for negative amounts
   - Handle percentage-based discounts

2. **Enhanced Subtotal Calculation**
   - QuickBooks can auto-calculate subtotals
   - Consider letting QB handle subtotal recalculation

3. **Custom Line Formatting**
   - Support rich text formatting in description fields
   - Add support for multi-line descriptions

## Files Modified
- `/backend/web/src/utils/quickbooks/apiClient.ts` - Interface updates
- `/backend/web/src/routes/quickbooks.ts` - Special item handling logic
- `/backend/web/test-special-items-qb.js` - Test script (new file)
- `/backend/web/QUICKBOOKS_SPECIAL_ITEMS_IMPLEMENTATION.md` - This documentation (new file)

## Deployment
Changes have been deployed and the backend server has been restarted with PM2.