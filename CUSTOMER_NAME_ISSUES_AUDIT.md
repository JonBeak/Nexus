# Customer Name Validation Issues - Audit Report

**Generated:** November 21, 2025
**Total Customers:** 656
**Customers with Issues:** 21
**Percentage with Issues:** 3.2%

---

## Summary of Issues

| Issue Type | Count | Impact |
|------------|-------|--------|
| Ends with period | 20 | **HIGH** - Windows strips trailing periods, causes folder access issues |
| Has forbidden characters | 1 | **HIGH** - Cannot create folders with `/` character |
| **TOTAL** | **21** | |

---

## Customers Requiring Fixes

### 1. High Priority - Forbidden Characters (1 customer)

These customers have characters that are completely forbidden in Windows folder names:

| ID | Current Name | Issue | Suggested Fix |
|----|--------------|-------|---------------|
| 3 | `20/20 Signs` | Contains `/` (slash) | `20-20 Signs` or `2020 Signs` |

**Action Required:** Must be renamed before folder creation. The `/` character is forbidden in Windows filenames.

---

### 2. High Priority - Trailing Periods (20 customers)

These customers end with a period, which Windows Win32 API automatically strips, causing folder access inconsistencies:

| ID | Current Name | Suggested Fix |
|----|--------------|---------------|
| 2 | `1000334415 ONTARIO INC.` | `1000334415 ONTARIO INC` |
| 598 | `10166647 Manitoba ltd.` | `10166647 Manitoba ltd` |
| 77 | `Brofort Inc.` | `Brofort Inc` |
| 88 | `Canadian Sign Co.` | `Canadian Sign Co` |
| 127 | `DA. Sign Media Inc.` | `DA. Sign Media Inc` |
| 631 | `Force Bros Inc.` | `Force Bros Inc` |
| 230 | `Grafcor Inc.` | `Grafcor Inc` |
| 234 | `Grand River Sign Design Inc.` | `Grand River Sign Design Inc` |
| 632 | `JP Signage Inc.` | `JP Signage Inc` |
| 645 | `JunMedia31 Inc.` | `JunMedia31 Inc` |
| 293 | `L3 Digital Print and Copy Inc.` | `L3 Digital Print and Copy Inc` |
| 304 | `Ledle Media Inc.` | `Ledle Media Inc` |
| 329 | `Maxximum Media Inc.` | `Maxximum Media Inc` |
| 331 | `McKeown Sign Co.` | `McKeown Sign Co` |
| 352 | `Mrko Creative Co.` | `Mrko Creative Co` |
| 624 | `Shaw Signs Ltd.` | `Shaw Signs Ltd` |
| 448 | `Sign Ad Corp.` | `Sign Ad Corp` |
| 562 | `The Sign Co.` | `The Sign Co` |
| 564 | `The Sign Shop Inc.` | `The Sign Shop Inc` |
| 591 | `Z Design Studio Inc.` | `Z Design Studio Inc` |

**Why This Matters:**
- NTFS filesystem CAN store trailing periods
- Windows Win32 API strips them during file operations (DOS compatibility)
- This creates folders that exist but cannot be reliably opened via Windows Explorer
- The "Open Folder" button fails with these names

**Example Issue:**
```
Folder created: "TEST JOB 123 ----- Sign House Inc."
Windows sees:     "TEST JOB 123 ----- Sign House Inc" (period stripped)
Result: Folder access fails or behaves inconsistently
```

---

## Migration Options

### Option 1: Soft Migration (Recommended)

**Approach:**
1. Deploy validation to prevent NEW customers from having these issues
2. Existing customers show warning on edit but allow save
3. `buildFolderName()` handles sanitization defensively (strips trailing periods)
4. Gradually clean up as customers are edited naturally

**Pros:**
- No immediate disruption
- No customer communication needed
- Self-healing over time
- Safe deployment

**Cons:**
- Issues persist until customers are edited
- Existing orders with problematic folders still have issues

---

### Option 2: Automated Fix with Notification

**Approach:**
1. Run UPDATE script to fix all 21 customer names
2. Send notification to affected customers about name change
3. Update any existing order folders to match new names
4. Deploy validation to prevent future issues

**SQL Script:**
```sql
-- Fix trailing periods (20 customers)
UPDATE customers
SET company_name = TRIM(TRAILING '.' FROM company_name),
    updated_date = CURRENT_TIMESTAMP,
    updated_by = 'system_migration'
WHERE company_name LIKE '%.'
  AND SUBSTRING(company_name, -1) = '.';

-- Fix forbidden characters (1 customer)
UPDATE customers
SET company_name = '20-20 Signs',
    updated_date = CURRENT_TIMESTAMP,
    updated_by = 'system_migration'
WHERE customer_id = 3;
```

**Pros:**
- Immediate fix for all issues
- Consistent data quality
- Prevents future folder access problems

**Cons:**
- Requires customer communication
- May affect existing QuickBooks integrations
- Need to update historical records/invoices

---

### Option 3: Manual Review and Fix

**Approach:**
1. Contact each of the 21 customers
2. Confirm preferred company name
3. Update manually with approval
4. Document changes in audit log

**Pros:**
- Customer involvement and approval
- Opportunity to verify correct business names
- Highest data quality

**Cons:**
- Time-consuming (21 customers)
- May delay deployment
- Requires customer response

---

## Impact Analysis

### Existing Orders with Problematic Customer Names

Run this query to find existing orders affected:

```sql
SELECT
  o.order_id,
  o.order_number,
  o.order_name,
  c.company_name,
  o.folder_name,
  o.folder_location
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE c.customer_id IN (2,3,77,88,127,230,234,293,304,329,331,352,448,562,564,591,598,624,631,632,645)
  AND o.folder_name IS NOT NULL
  AND o.folder_location != 'none';
```

This will identify:
- How many existing orders have folders with problematic names
- Whether folders need to be renamed on the filesystem
- Impact on PDF generation and folder access

---

## Recommended Implementation Plan

### Phase 1: Deploy Defensive Code (Immediate)
1. ✅ Update `buildFolderName()` to strip trailing periods/spaces
2. ✅ Deploy to production
3. ✅ Test folder creation with existing problematic customers
4. **Result:** New folders created correctly even with bad customer names

### Phase 2: Deploy Validation (Week 1)
1. Add frontend validation (creation and edit forms)
2. Add backend validation
3. Block NEW customers with invalid names
4. Show warnings for existing customers on edit
5. **Result:** No new problematic names can be created

### Phase 3: Cleanup (Week 2-3)
1. Run audit query to find affected orders
2. Review impact on existing folders
3. Choose migration option (recommend Option 1: Soft Migration)
4. If Option 2: Run automated fix during off-hours
5. **Result:** Clean dataset

### Phase 4: Monitoring (Ongoing)
1. Monitor customer edits
2. Track how many problematic names get fixed naturally
3. Generate monthly audit reports
4. **Result:** Gradual improvement in data quality

---

## SQL Queries for Monitoring

### Count Remaining Issues
```sql
SELECT COUNT(*) as customers_with_issues
FROM customers
WHERE
  company_name REGEXP '[/:*?"<>|]' OR
  company_name != TRIM(company_name) OR
  company_name LIKE '.%' OR
  (company_name LIKE '%.' AND SUBSTRING(company_name, -1) = '.');
```

### Track Fixes Over Time
```sql
SELECT
  DATE(updated_date) as fix_date,
  COUNT(*) as customers_fixed,
  updated_by
FROM customers
WHERE
  customer_id IN (2,3,77,88,127,230,234,293,304,329,331,352,448,562,564,591,598,624,631,632,645)
  AND updated_date > '2025-11-21'
GROUP BY DATE(updated_date), updated_by
ORDER BY fix_date DESC;
```

---

## Testing Checklist

Before deploying fixes:

- [ ] Test folder creation with "20/20 Signs" → Verify converts to "20_20 Signs"
- [ ] Test folder creation with "Company Inc." → Verify trailing period stripped
- [ ] Test "Open Folder" button with existing problematic folders
- [ ] Verify PDF generation works with sanitized names
- [ ] Test customer edit form validation for each issue type
- [ ] Test customer creation form validation for each issue type
- [ ] Verify QuickBooks sync not affected by name changes (if Option 2)
- [ ] Test that `buildFolderName()` handles all edge cases

---

## Notes

**Good News:**
- Only 3.2% of customers (21 out of 656) have issues
- Issues are concentrated in two simple patterns
- All issues have clear, automated fixes
- No customers have multiple issues simultaneously

**Why This Happened:**
- No validation existed when customers were created
- Windows folder naming rules are subtle (trailing periods work on NTFS but not Win32 API)
- Many companies legitimately end in "Inc." or "Ltd." but add the period

**Prevention:**
The new validation system prevents:
- Forbidden characters: `< > : " / \ | ? *`
- Trailing periods and spaces
- Leading periods
- Reserved Windows names (CON, PRN, etc.)
- Overly long names (>200 chars)

---

## Contact Information for Option 3

If choosing manual review, contact these customers for name confirmation:

**Priority 1 - Has Forbidden Character:**
- Customer ID 3: `20/20 Signs` (needs immediate rename)

**Priority 2 - Ending with Period (contact in batches):**
- Batch 1 (IDs 2-234): 10 customers
- Batch 2 (IDs 293-645): 10 customers

---

## Approval Required

- [ ] Choose migration option (1, 2, or 3)
- [ ] Approve SQL fix script (if Option 2)
- [ ] Approve customer communication plan (if Option 2 or 3)
- [ ] Set deployment date for validation code
- [ ] Assign owner for monitoring and follow-up

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Created By:** System Audit Script
**Reference:** See CUSTOMER_NAME_VALIDATION_RULES.md for complete validation specification
