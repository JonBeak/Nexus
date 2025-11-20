# QuickBooks Online API Limitations - Confirmed

## Date: November 3, 2025

## Key Finding: QuickBooks Online Only Supports ONE SubTotalLineDetail

### Evidence from Production Testing
- **Test Case**: Sent estimate with 2 SubTotalLineDetail items
- **Result**: QuickBooks removed the first subtotal, kept only the last one
- **Conclusion**: **QB Online allows only ONE SubTotalLineDetail per estimate/invoice**

### API Behavior Observed

#### What We Sent (11 items):
```
1-6. Regular SalesItemLineDetail items
7. DescriptionOnly (empty row)
8. SubTotalLineDetail (Amount: 1970.25) ← REMOVED BY QB
9. DescriptionOnly ("test")
10. SalesItemLineDetail
11. SubTotalLineDetail (Amount: 2955.25) ← KEPT BY QB
```

#### What QB Returned (10 items):
```
1-6. Regular items
7. DescriptionOnly
8. DescriptionOnly ("test")
9. SalesItemLineDetail
10. SubTotalLineDetail (only the last one)
```

## Confirmed Limitations

### 1. ❌ Multiple SubTotalLineDetail Not Supported
- **Limitation**: Only ONE SubTotalLineDetail allowed per document
- **Behavior**: QB silently removes all but the last SubTotalLineDetail
- **This matches**: User reports from 2024 about QB Online removing subtotal functionality

### 2. ❌ SubTotalLineDetail Description Field Ignored
- **Limitation**: Even when accepted, Description field on SubTotalLineDetail doesn't display
- **Behavior**: Amount shows, but any Description text is ignored

### 3. ⚠️ DescriptionOnly Shows with Tax Column
- **Limitation**: Can't create pure "Text" rows like in QB Desktop
- **Behavior**: DescriptionOnly lines show with empty tax/amount columns

## Implemented Workaround

### Smart Subtotal Handling
```javascript
// Detect if this is the LAST subtotal
const isLastSubtotal = !estimatePreviewData.items
  .slice(estimatePreviewData.items.indexOf(item) + 1)
  .some(i => i.productTypeId === 21);

if (isLastSubtotal && subtotalAmount > 0) {
  // Use SubTotalLineDetail for LAST subtotal only
  lines.push({
    DetailType: 'SubTotalLineDetail',
    SubTotalLineDetail: {},
    Amount: subtotalAmount
  });
} else {
  // Convert intermediate subtotals to text
  lines.push({
    DetailType: 'DescriptionOnly',
    Description: `Subtotal: $${subtotalAmount.toFixed(2)}`
  });
}
```

## Current Solution

### For Multiple Section Subtotals:
1. **Intermediate Subtotals** → Convert to DescriptionOnly text rows
   - Shows as: "Subtotal: $1,970.25" (as text)
2. **Final Subtotal** → Use SubTotalLineDetail
   - Shows as: Proper QB subtotal line

### For Text Rows:
- **Empty Row** → DescriptionOnly with space (" ")
- **Text with comment** → DescriptionOnly with the text

## User Experience Impact

### Before Workaround:
- Multiple subtotals sent → Only last one appears
- Confusing missing subtotals

### After Workaround:
- Intermediate subtotals appear as formatted text
- Final subtotal appears as proper QB subtotal
- All sections properly labeled

## Alternative Approaches for Users

### Option 1: Single Subtotal Strategy
- Use text rows for section headers
- Regular items in each section
- ONE subtotal at the very end

### Option 2: Manual Section Totals
- Use Empty Row (Type 27) with section totals as text
- Example: "Phase 1 Total: $1,970.25"
- Let QB calculate final subtotal

### Option 3: Use QuickBooks Desktop
- QuickBooks Desktop supports multiple subtotals properly
- Desktop API has different capabilities than Online API

## References
- QuickBooks removed subtotal functionality in their 2024 "new invoice template"
- Multiple users reported this as a regression from 15+ years of functionality
- QuickBooks Online mobile app also lacks subtotal support
- This is an API/product limitation, not a bug in our implementation

## Recommendation
Users should be informed that:
1. QuickBooks Online has limited subtotal support (only one per document)
2. Our app converts intermediate subtotals to text for visibility
3. For full subtotal functionality, QuickBooks Desktop is required