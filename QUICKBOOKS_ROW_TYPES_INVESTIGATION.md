# QuickBooks Online API - Row Type Investigation

**Status:** In Progress
**Date Started:** 2025-11-04
**Objective:** Understand how to create different row types in QB estimates via API

---

## The Goal

Create estimates in QuickBooks Online that include:
- ✅ Regular product/service items (working)
- ❓ Text-only rows (description without product dropdown)
- ❓ Blank divider rows (visual spacing)
- ❓ Section subtotals (with custom formatting)

## Test Results

### Test 1: Initial Row Type Test (Estimate 30249)

**Date:** 2025-11-04
**QB Estimate ID:** 30249
**QB Doc Number:** 19561

#### What We Sent:
```
Line 1: SalesItemLineDetail - 3" Front Lit ($315)
Line 2: SalesItemLineDetail - LEDs ($70)
Line 3: SalesItemLineDetail - Vinyl ($95)
Line 4: SalesItemLineDetail - 3" Front Lit ($1093.5)
Line 5: SalesItemLineDetail - LEDs ($246.75)
Line 6: SalesItemLineDetail - Vinyl ($150)
Line 7: DescriptionOnly - Description: " " (single space)
Line 8: SubTotalLineDetail - Description: "Subtotal: $1,970.25..." Amount: 0
Line 9: DescriptionOnly - Description: "test"
Line 10: SubTotalLineDetail - Description: "test2..." Amount: 0
```

#### What QuickBooks Returned:
```
Line 1: SalesItemLineDetail - 3" Front Lit ($315)
Line 2: SalesItemLineDetail - LEDs ($70)
Line 3: SalesItemLineDetail - Vinyl ($95)
Line 4: SalesItemLineDetail - 3" Front Lit ($1093.5)
Line 5: SalesItemLineDetail - LEDs ($246.75)
Line 6: SalesItemLineDetail - Vinyl ($150)
Line 7: DescriptionOnly - NO Description
Line 8: DescriptionOnly - Description: "test"
Line 9: SubTotalLineDetail - Amount: $1970.25 (AUTO-CALCULATED!)
```

#### Key Findings:
1. ✅ **SubTotalLineDetail REMOVED** - QB removed BOTH our subtotal lines (8 & 10)
2. ✅ **Auto Subtotal Added** - QB added ONE auto-calculated subtotal at the end
3. ✅ **DescriptionOnly Preserved** - Empty and text description-only lines kept

**CONCLUSION:** QuickBooks Online only allows ONE SubTotalLineDetail per estimate, auto-calculated.

---

### Test 2: Estimate 30250 Analysis (Fetched for comparison)

**QB Estimate ID:** 30250
**QB Doc Number:** 19562

#### Observations from Returned Data:
```
Line 7:  DescriptionOnly, NO Description,       TaxCodeRef: {"value":"7"}
Line 8:  DescriptionOnly, Description: "test",   TaxCodeRef: {"value":"7"}
Line 10: DescriptionOnly, Description: "Subtotal: $2955.25", NO TaxCodeRef
Line 11: DescriptionOnly, Description: "Test Text Row", TaxCodeRef: {"value":"7"}
Line 12: DescriptionOnly, NO Description,       TaxCodeRef: {"value":"7"}
Line 13: DescriptionOnly, NO Description,       TaxCodeRef: {"value":"7"}
```

#### Pattern Questions:
- Why does QB add TaxCodeRef to SOME DescriptionOnly lines but NOT others?
- Line 10 (with subtotal text) has NO TaxCodeRef ← Different from others!
- Does the Description content matter?
- Does position in the estimate matter?

---

### Test 3: TaxCodeRef Control Test ✅ COMPLETED

**Date:** 2025-11-04
**QB Estimate ID:** 30270
**QB Doc Number:** 19582

#### What We Sent (8 lines):
```
Line 1: SalesItemLineDetail - 3" Channel Letters ($100)
Line 2: DescriptionOnly - NO TaxCodeRef, NO Description
Line 3: DescriptionOnly - NO TaxCodeRef, Description: "TEST 2: Text Row - No TaxCodeRef Sent"
Line 4: DescriptionOnly - TaxCodeRef="NON", NO Description
Line 5: DescriptionOnly - TaxCodeRef="NON", Description: "TEST 4: Text Row - NON Tax Code"
Line 6: DescriptionOnly - TaxCodeRef="7", NO Description
Line 7: DescriptionOnly - TaxCodeRef="7", Description: "TEST 6: Text Row - GST Tax Code"
Line 8: SalesItemLineDetail - Vinyl ($50)
```

#### What QuickBooks Returned (9 lines):
```
Line 1: SalesItemLineDetail - $100
Line 2: DescriptionOnly - NO TaxCodeRef ✅ (kept as-is)
Line 3: DescriptionOnly - NO TaxCodeRef, "TEST 2..." ✅ (kept as-is)
Line 4: DescriptionOnly - NO TaxCodeRef ❌ (QB REMOVED "NON"!)
Line 5: DescriptionOnly - NO TaxCodeRef, "TEST 4..." ❌ (QB REMOVED "NON"!)
Line 6: DescriptionOnly - TaxCodeRef="7" ✅ (kept as-is)
Line 7: DescriptionOnly - TaxCodeRef="7", "TEST 6..." ✅ (kept as-is)
Line 8: SalesItemLineDetail - $50
Line 9: SubTotalLineDetail - $150 (auto-added by QB)
```

#### What Appeared in QB UI:
```
Line 1: 3" Channel Letters | Qty: 1 | $100 | GST (5%)
Line 2: Select a product/service | Sales tax rate
Line 3: Select a product/service | TEST 2... | Sales tax rate
Line 4: Select a product/service | Sales tax rate
Line 5: Select a product/service | TEST 4... | Sales tax rate
Line 6: Select a product/service | GST (5%)
Line 7: Select a product/service | TEST 6... | GST (5%)
Line 8: Vinyl | Qty: 1 | $50 | GST (5%)
Line 9: (subtotal row)
```

#### 🎯 CRITICAL FINDINGS:

1. **QuickBooks REMOVES TaxCodeRef="NON"** ❌
   - Lines 4-5 sent with `TaxCodeRef: "NON"` → QB stripped it out
   - Returned as empty `DescriptionLineDetail: {}`
   - Same behavior as sending NO TaxCodeRef at all

2. **QuickBooks KEEPS TaxCodeRef="7" (taxable)** ✅
   - Lines 6-7 sent with `TaxCodeRef: "7"` → QB preserved it
   - Returned with `DescriptionLineDetail: {"TaxCodeRef":{"value":"7"}}`

3. **UI Display Differences:**
   - Lines WITH `TaxCodeRef="7"` → Show **"GST (5%)"** in tax column
   - Lines WITHOUT TaxCodeRef → Show **"Sales tax rate"** dropdown

4. **ALL DescriptionOnly Lines Show Product Dropdown** 🚫
   - Every DescriptionOnly line shows "Select a product/service" in UI
   - NO way to create "pure text rows" that hide the product field
   - QuickBooks treats these as editable product lines

5. **Auto-Subtotal Still Added** ✅
   - QB added Line 9: SubTotalLineDetail with calculated total
   - Confirms: Only ONE subtotal allowed per estimate

---

## 🏁 FINAL CONCLUSIONS

### Question 1: Can we create text rows that DON'T show product/service dropdown?
**ANSWER: NO** ❌
- QuickBooks API does not support "pure text rows"
- All DescriptionOnly lines show product/service dropdown in UI
- This is a QuickBooks limitation, not an API implementation issue

### Question 2: Does explicitly sending TaxCodeRef="NON" prevent tax fields?
**ANSWER: NO** ❌
- QuickBooks REMOVES TaxCodeRef="NON" from DescriptionOnly lines
- Cannot force a line to be explicitly non-taxable
- Lines end up identical to sending no TaxCodeRef

### Question 3: Can we control tax display in the UI?
**ANSWER: PARTIALLY** ⚠️
- Sending `TaxCodeRef="7"` (or other taxable code) → Shows "GST (5%)" in UI
- Omitting TaxCodeRef → Shows generic "Sales tax rate" dropdown
- Sending `TaxCodeRef="NON"` → Gets removed, becomes "Sales tax rate"

### Question 4: Why does QB add TaxCodeRef to some lines but not others?
**ANSWER: IT DOESN'T** ✅
- QB doesn't auto-add TaxCodeRef to DescriptionOnly lines
- If we don't send it, QB doesn't add it
- Previous observations of TaxCodeRef appeared because we sent them

---

## 📋 RECOMMENDATIONS FOR PRODUCTION

### For Empty Rows (Product Type 27):
```typescript
// Send as DescriptionOnly WITHOUT TaxCodeRef
{
  DetailType: 'DescriptionOnly',
  Description: item.calculationDisplay || ' ',
  DescriptionLineDetail: {},  // Empty - no TaxCodeRef
  LineNum: lineNum
}
```
**Result:** Shows "Sales tax rate" in UI (generic, non-specific)

### For Subtotals (Product Type 21):
```typescript
// Convert ALL to DescriptionOnly text (QB removes SubTotalLineDetail)
{
  DetailType: 'DescriptionOnly',
  Description: `Subtotal: $${subtotalAmount.toFixed(2)}`,
  DescriptionLineDetail: {},  // Empty - no TaxCodeRef
  LineNum: lineNum
}
```
**Result:** Text row showing subtotal calculation

### For Section Headers:
```typescript
// Use DescriptionOnly WITHOUT TaxCodeRef for cleaner appearance
{
  DetailType: 'DescriptionOnly',
  Description: 'SECTION HEADER TEXT',
  DescriptionLineDetail: {},  // Empty - no TaxCodeRef
  LineNum: lineNum
}
```
**Result:** Shows "Sales tax rate" instead of specific tax amount

---

## ⚠️ KNOWN LIMITATIONS

1. **No Pure Text Rows:** QB always shows "Select a product/service" dropdown
2. **No Non-Taxable Enforcement:** Cannot send TaxCodeRef="NON" (QB removes it)
3. **Only One Subtotal:** QB auto-calculates and adds ONE SubTotalLineDetail at end
4. **UI Always Editable:** DescriptionOnly lines can be converted to products in QB UI

---

## ✅ WHAT WORKS

1. **DescriptionOnly for Text:** Reliable way to add text/headers/comments
2. **TaxCodeRef="7" Display:** Shows specific tax rate in UI if needed
3. **Omitting TaxCodeRef:** Cleaner UI with generic "Sales tax rate"
4. **Description Field:** Supports multiline text and formatting

---

## Implementation Notes

### Current Production Code (works for subtotals):
```typescript
// Location: /backend/web/src/routes/quickbooks.ts:810-823
// SUBTOTAL (Product Type 21) - Convert ALL to DescriptionOnly text
if (item.productTypeId === 21) {
  const description = item.calculationDisplay || item.itemName || '';
  const subtotalText = description ?
    description.replace(/\n/g, ' | ') :
    `Subtotal: $${subtotalAmount.toFixed(2)}`;

  lines.push({
    DetailType: 'DescriptionOnly',
    Description: subtotalText,
    DescriptionLineDetail: {},
    LineNum: lineNum
  });
  continue;
}
```

### Current Production Code (empty rows):
```typescript
// Location: /backend/web/src/routes/quickbooks.ts:826-838
// EMPTY ROW (Product Type 27) - Use DescriptionOnly
if (item.productTypeId === 27) {
  const description = item.calculationDisplay || item.itemName || ' ';

  lines.push({
    DetailType: 'DescriptionOnly',
    Description: description,
    DescriptionLineDetail: {},
    LineNum: lineNum
  });
  continue;
}
```

---

## Resources

- **Test Endpoint:** `POST /api/quickbooks-test/row-types`
- **Test UI:** SimpleDashboard component (frontend)
- **Production Endpoint:** `POST /api/quickbooks/create-estimate`
- **Fetch Endpoint:** `GET /api/quickbooks/estimate/:id`

---

## ~~Questions~~ All Questions ANSWERED ✅

1. ✅ **Can we create text rows that DON'T show product/service dropdown?** → NO, QB limitation
2. ✅ **Does explicitly sending TaxCodeRef="NON" prevent tax fields?** → NO, QB removes it
3. ✅ **Is there a different DetailType for pure text headers?** → NO, DescriptionOnly is the only option
4. ✅ **Why does QB add TaxCodeRef to some lines but not others?** → It doesn't auto-add, we were sending them

---

## Related Documentation

- QB API docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/estimate
- Automated Sales Tax (AST): https://blogs.a.intuit.com/2017/12/11/using-quickbooks-online-api-automated-sales-tax/

---

---

---

## Test 4: SubTotalLineDetail Deep Dive ✅ COMPLETED

**Date:** 2025-11-04
**QB Estimate IDs:** 30271, 30272, 30273

### Discovery: DescriptionOnly Text Pattern Recognition

QuickBooks **parses DescriptionOnly text** for a specific pattern and renders it as a subtotal display!

#### The Magic Pattern:
```typescript
{
  DetailType: 'DescriptionOnly',
  Description: 'Subtotal: $XXX.XX',  // EXACT format required
  DescriptionLineDetail: {}
}
```

#### Pattern Requirements:
- ✅ Must start with capital "**S**ubtotal:"
- ✅ Must have colon and space: `: `
- ✅ Must have dollar sign: `$`
- ✅ Amount format: `XXX.XX`

#### What QuickBooks Does:
1. **API Level:** Returns as normal `DescriptionOnly` (not SubTotalLineDetail)
2. **UI Level:** Renders with special formatting:
   ```
   Subtotal
   Subtotal    $XXX.XX
   ```
3. **Extracts Amount:** Uses the dollar amount from your text
4. **Ignores Custom Text:** Always displays "Subtotal" label (can't customize)

#### What Doesn't Work:
- ❌ `subtotal: $XXX.XX` (lowercase 's')
- ❌ `Total: $XXX.XX` (different keyword)
- ❌ `Subtotal $XXX.XX` (no colon)
- ❌ `Subtotal:$XXX.XX` (no space after colon)
- ❌ `Subtotal: XXX.XX` (no dollar sign)
- ❌ `Section 1 Subtotal: $XXX.XX` (custom prefix ignored, creates $0.00 subtotal)

#### Test Results:

**Sent to QB:**
```
Line 1: 3" Channel Letters ($100)
Line 2: DescriptionOnly - "Subtotal: $100.00"
Line 3: DescriptionOnly - "subtotal: $100.00" (lowercase)
Line 4: DescriptionOnly - "Subtotal: 100.00" (no $)
Line 5: DescriptionOnly - "Subtotal:$100.00" (no space)
Line 6: DescriptionOnly - "Total: $100.00"
Line 7: DescriptionOnly - "Subtotal: $100.00\nTax: $5.00..."
Line 8: Vinyl ($50)
```

**What Appeared in QB UI:**
```
Line 1: 3" Channel Letters - $100 - GST (5%)

Subtotal Line (special formatting):
  Subtotal
  Subtotal    $100.00

Line 2: Select a product/service | subtotal: $100.00 | Sales tax rate

Subtotal Line (from line 4 - parsed as $0):
  Subtotal
  Subtotal    $0.00

Subtotal Line (from line 5 - parsed as $0):
  Subtotal
  Subtotal    $0.00

Line 3: Select a product/service | Total: $100.00 | Sales tax rate

[More $0.00 subtotals from other failed patterns]

Line 5: Vinyl - $50 - GST (5%)
```

#### 🎯 CRITICAL LIMITATION DISCOVERED:

**You CANNOT customize the subtotal label/description!**

- Sending `"Section 1 Subtotal: $150.00"` → Creates subtotal showing "$0.00" (QB can't parse the amount)
- QB's parser is VERY strict about the format
- The label always shows "Subtotal" in the UI
- Cannot create labeled sections like "Channel Letters: $XXX.XX"

---

## 🏁 FINAL CONCLUSIONS - SUBTOTALS

### Question: Can we use SubTotalLineDetail to create section subtotals?
**ANSWER: NO (via SubTotalLineDetail), PARTIALLY (via DescriptionOnly text pattern)** ⚠️

**What Works:**
```typescript
// Create a visual subtotal display in QB UI
{
  DetailType: 'DescriptionOnly',
  Description: 'Subtotal: $150.00',  // EXACT format
  DescriptionLineDetail: {}
}
```
**Result:** Special subtotal formatting in UI (no product dropdown)

**Limitations:**
1. ❌ Cannot customize label (always shows "Subtotal")
2. ❌ Cannot use for section headers like "Channel Letters Section: $XXX"
3. ❌ QB still adds its own auto-calculated SubTotalLineDetail at the end
4. ⚠️  Amount is static text - QB won't update it if items change
5. ⚠️  Very strict pattern - easy to break accidentally

### Question: Can we control the position of subtotals?
**ANSWER: YES** ✅
- DescriptionOnly with "Subtotal: $XXX.XX" can be placed anywhere
- Appears in-position in the estimate
- Can have multiple section subtotals using this pattern

### Question: Can we control the amount shown?
**ANSWER: YES (but static)** ⚠️
- The amount you put in the text ("Subtotal: $**150.00**") is what displays
- QB does NOT auto-calculate it
- If items change, subtotal won't update
- You must calculate and format it yourself

---

---

## Test 5: Edge Cases & The Perfect Pattern ✅ BREAKTHROUGH

**Date:** 2025-11-04
**QB Estimate ID:** 30276

### 🎯 THE WINNING SOLUTION DISCOVERED!

You CAN create labeled section subtotals by using TWO separate DescriptionOnly lines:

```typescript
// Line 1: Custom section label
{
  DetailType: 'DescriptionOnly',
  Description: '=== Channel Letters Section ===',
  DescriptionLineDetail: {}
},

// Line 2: Auto-calculated subtotal (immediately after)
{
  DetailType: 'DescriptionOnly',
  Description: 'Subtotal: $0.00',  // QB auto-calculates from items above!
  DescriptionLineDetail: {}
}
```

**Result in QB UI:**
```
=== Channel Letters Section ===    (regular text row with dropdown)
Subtotal
Subtotal    $150.00                (special format, auto-calculated!)
```

### Edge Case Testing Results:

#### TEST 1: Subtotal Before Any Items
**Sent:** `"Subtotal: $999.99"` (at top of estimate)
**QB Shows:** `Subtotal $0.00` ✅
**Finding:** Shows $0.00 correctly (no items to sum yet)

#### TEST 2: Separate Label + Subtotal ⭐ WINNER
**Sent:**
```
Line A: "=== Channel Letters Section ==="
Line B: "Subtotal: $0.00"
```
**QB Shows:**
```
Line A: Regular text row
Line B: Subtotal $150.00 (auto-calculated!)
```
**Finding:** PERFECT! Custom labels + auto-calculation work!

#### TEST 3: Back-to-Back Subtotals
**Sent:** Two consecutive `"Subtotal: $XXX.XX"` lines (no items between)
**QB Shows:** Both show `Subtotal $0.00`
**Finding:** Each calculates from items ABOVE it

#### TEST 4: Negative Amount
**Sent:** `"Subtotal: $-50.00"`
**QB Shows:** `Subtotal $75.00` (ignores negative, auto-calculates)

#### TEST 5: Very Large Amount
**Sent:** `"Subtotal: $999999.99"`
**QB Shows:** `Subtotal $25.00` (ignores large number, auto-calculates)

#### TEST 6: Three Decimal Places
**Sent:** `"Subtotal: $100.123"`
**QB Shows:** `Subtotal $0.00` ❌
**Finding:** Pattern BREAKS - must be exactly 2 decimals

#### TEST 7: No Decimal Places
**Sent:** `"Subtotal: $100"`
**QB Shows:** `Subtotal $0.00` ❌
**Finding:** Pattern BREAKS - decimals required

#### TEST 8: Text in Amount
**Sent:** `"Subtotal: $100.00 USD"`
**QB Shows:** `Subtotal $0.00` ❌
**Finding:** Pattern BREAKS - nothing can be between $ and amount

#### TEST 9: Multiple Patterns in One Line
**Sent:** `"Subtotal: $50.00 | Subtotal: $75.00"`
**QB Shows:** `Subtotal $0.00` ❌
**Finding:** Pattern BREAKS - gets confused

#### TEST 10: Emoji Before Pattern
**Sent:** `"💰 Subtotal: $20.00 💰"`
**QB Shows:** Regular DescriptionOnly (no special format) ❌
**Finding:** ANY character before "Subtotal:" breaks the pattern

---

## 🎯 FINAL PATTERN RULES - DEFINITIVE GUIDE

### ✅ EXACT FORMAT REQUIRED:

```
"Subtotal: $XX.XX"
```

**Character-by-character requirements:**
1. **Must start with:** Capital "S" in "Subtotal"
2. **Must have:** Colon `:` immediately after "Subtotal"
3. **Must have:** Single space after colon
4. **Must have:** Dollar sign `$`
5. **Must have:** Amount with exactly 2 decimal places (e.g., `125.00`, `0.00`, `1234.56`)
6. **Optional:** Text can appear AFTER the amount (e.g., `"Subtotal: $100.00 (Note)"`)
   - But this is unreliable and may cause issues
7. **CANNOT have:** ANY characters before "Subtotal"

### ❌ WHAT BREAKS THE PATTERN:

- `"subtotal: $100.00"` - lowercase 's'
- `"Total: $100.00"` - different keyword
- `"Subtotal:$100.00"` - no space after colon
- `"Subtotal $100.00"` - no colon
- `"Subtotal: 100.00"` - no dollar sign
- `"Subtotal: $100"` - no decimals
- `"Subtotal: $100.123"` - wrong decimal count
- `"Section Subtotal: $100.00"` - text before pattern
- `"💰 Subtotal: $100.00"` - emoji/char before pattern
- `"Subtotal: $100.00 USD"` - text in amount (unreliable)

### 🔍 HOW QUICKBOOKS PROCESSES IT:

1. **API Level:** Stays as `DescriptionOnly` (never becomes SubTotalLineDetail)
2. **Pattern Recognition:** QB parses the text client-side (in UI)
3. **Auto-Calculation:** QB sums ALL items above this line
4. **Amount Ignored:** Whatever you put in `$XX.XX` is replaced by QB's calculation
5. **Display:** Special formatting (no product dropdown, special "Subtotal" label)

---

## 📋 PRODUCTION IMPLEMENTATION GUIDE

### Use Case 1: Simple Section Subtotals

```typescript
// Items for section
lines.push({
  DetailType: 'SalesItemLineDetail',
  SalesItemLineDetail: { /* ... */ },
  Amount: 100
});

// Section label (optional but recommended)
lines.push({
  DetailType: 'DescriptionOnly',
  Description: '=== Channel Letters Section ===',
  DescriptionLineDetail: {}
});

// Auto-calculated subtotal
lines.push({
  DetailType: 'DescriptionOnly',
  Description: 'Subtotal: $0.00',  // QB will calculate automatically
  DescriptionLineDetail: {}
});
```

### Use Case 2: Multiple Sections

```typescript
// Section 1
addItems(channelLettersItems);
addLabel('Channel Letters');
addSubtotal();  // Shows sum of channel letters only

// Section 2
addItems(vinylItems);
addLabel('Vinyl & Graphics');
addSubtotal();  // Shows sum of vinyl items only (resets from last subtotal)

// Section 3
addItems(hardwareItems);
addLabel('Hardware & Fasteners');
addSubtotal();  // Shows sum of hardware only
```

### Use Case 3: Empty Dividers Between Sections

```typescript
addSubtotal();  // End of section

// Visual separator
lines.push({
  DetailType: 'DescriptionOnly',
  Description: '',  // Empty row
  DescriptionLineDetail: {}
});

addItems(nextSectionItems);  // Start new section
```

### Helper Function Example:

```typescript
function addSectionSubtotal(sectionLabel?: string) {
  // Optional: Add section label
  if (sectionLabel) {
    lines.push({
      DetailType: 'DescriptionOnly',
      Description: `=== ${sectionLabel} ===`,
      DescriptionLineDetail: {}
    });
  }

  // Add auto-calculated subtotal
  lines.push({
    DetailType: 'DescriptionOnly',
    Description: 'Subtotal: $0.00',  // QB calculates from items above
    DescriptionLineDetail: {}
  });
}

// Usage:
addItems(channelLetters);
addSectionSubtotal('Channel Letters');  // Creates label + subtotal

addItems(vinyl);
addSectionSubtotal('Vinyl');  // Creates label + subtotal

addItems(misc);
addSectionSubtotal();  // Just subtotal, no label
```

---

## ⚠️ IMPORTANT LIMITATIONS

1. **Amount is NOT in your control** - QB always auto-calculates
   - You cannot set a custom subtotal amount
   - You cannot show tax in the subtotal
   - The calculation is simple sum of items above

2. **Label is always "Subtotal"** - Cannot customize the subtotal label itself
   - "Subtotal" text is hardcoded by QB
   - You must use a separate line for section names

3. **Pattern is extremely fragile** - Any deviation breaks it
   - Must match format exactly
   - Easy to break with formatting changes
   - No validation feedback from QB API

4. **QB still adds final SubTotalLineDetail** - At the very end
   - This is the "official" subtotal for the entire estimate
   - Cannot be prevented
   - Will sum ALL items (including after your subtotals)

5. **No multiline support in subtotal itself**
   - Cannot do: `"Subtotal: $100.00\nTax: $5.00"`
   - Must use separate DescriptionOnly lines for additional info

---

## 📊 Investigation Status: **COMPLETE** ✅

- ✅ DescriptionOnly lines: Fully understood
- ✅ SubTotalLineDetail: Fully understood (API removes them, QB adds one auto-calculated at end)
- ✅ Text Pattern Subtotals: Discovered and documented
- ✅ Edge Cases: Tested and documented
- ✅ Production Pattern: Defined and ready to implement

**Last Updated:** 2025-11-04 (Investigation Completed - All Mysteries Solved!)
