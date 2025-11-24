# Job and Order Name Validation for Windows Folder Compatibility

**Created:** 2025-11-21
**Status:** In Progress
**Related:** CUSTOMER_NAME_VALIDATION_RULES.md

---

## Problem Statement

Order folders are created on a Windows SMB share using the naming pattern:
```
{order_name} ----- {customer_name}
```

**Issues Identified:**
1. Job names and order names are not validated for Windows folder compatibility
2. Invalid characters in job/order names could cause folder creation failures
3. Trailing spaces cause inconsistent folder access behavior
4. No validation exists at job creation, job edit, or estimate-to-order conversion

**Key Difference from Customer Names:**
- **Customer names:** Cannot end with periods OR spaces
- **Job/Order names:** CAN end with periods, but NOT spaces

This is because the folder name format places the customer name at the END:
```
"My Project Inc." ----- "ABC Signs"
                              ↑ Customer name at end - trailing period here breaks Windows
```

But if job name has a trailing period, it's in the middle of the folder path and is safe:
```
"My Project Inc." ----- "ABC Signs"
       ↑ Job name with period is OK here
```

---

## Data Flow Analysis

### Job Name Entry Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOB CREATION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend: JobPanel.tsx (line 163-178)                                      │
│     ↓ handleCreateJob()                                                     │
│  API: POST /api/job-versioning/jobs                                         │
│     ↓                                                                       │
│  Controller: jobController.ts:169 → createJob()                             │
│     ↓                                                                       │
│  Service: jobService.ts:111 → createJob()                                   │
│     ↓                                                                       │
│  Repository: jobRepository.ts → createJob()                                 │
│     ↓                                                                       │
│  Database: jobs.job_name (varchar 255)                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOB NAME EDITING                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend: JobPanel.tsx (line 116-142)                                      │
│     ↓ handleSaveEdit()                                                      │
│  API: PUT /api/job-versioning/jobs/:jobId                                   │
│     ↓                                                                       │
│  Controller: jobController.ts:140 → updateJob()                             │
│     ↓                                                                       │
│  Service: jobService.ts:68 → updateJobName()                                │
│     ↓                                                                       │
│  Repository: jobRepository.ts → updateJobName()                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOB NAME VALIDATION API                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend: JobPanel.tsx (line 75-98)                                        │
│     ↓ validateJobName()                                                     │
│  API: POST /api/job-versioning/jobs/validate-name                           │
│     ↓                                                                       │
│  Controller: jobController.ts:91 → validateJobName()                        │
│     ↓                                                                       │
│  Service: jobService.ts:58 → validateJobName()                              │
│     ↓ (Currently only checks for duplicates!)                               │
│  Repository: jobRepository.ts → jobNameExists()                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Order Name Entry Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ORDER CREATION (ESTIMATE → ORDER)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend: ApproveEstimateModal.tsx                                         │
│     ↓ orderName state (defaults to job_name)                                │
│  API: POST /api/orders/convert-estimate                                     │
│     ↓                                                                       │
│  Controller: orderConversionController.ts:26 → convertEstimateToOrder()     │
│     ↓                                                                       │
│  Service: orderConversionService.ts:58 → convertEstimateToOrder()           │
│     ↓ Line 112: builds folder name                                          │
│  orderFolderService.buildFolderName(request.orderName, customer.company_name)│
│     ↓                                                                       │
│  Database: orders.order_name (varchar 255)                                  │
│  Filesystem: SMB share folder created                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

### Allowed Characters (Allowlist Approach)

```regex
/^[a-zA-Z0-9\u00C0-\u017F \-_.,&'()]+$/
```

**Breakdown:**
- `a-z A-Z` - English letters (upper and lower case)
- `0-9` - Numbers
- `\u00C0-\u017F` - Latin Extended-A (European accents: é, ñ, ü, ç, etc.)
- ` ` - Space (but not trailing)
- `-` - Hyphen
- `_` - Underscore
- `.,` - Period and comma
- `&` - Ampersand
- `'` - Apostrophe
- `()` - Parentheses

### Rule Comparison: Customer vs Job/Order Names

| Rule | Customer Name | Job/Order Name |
|------|---------------|----------------|
| Allowed chars | `a-zA-Z0-9\u00C0-\u017F \-_.,&'()` | Same |
| Trailing periods | **NOT allowed** | **ALLOWED** |
| Trailing spaces | **NOT allowed** | **NOT allowed** |
| Leading periods | NOT allowed | NOT allowed |
| Leading spaces | NOT allowed (auto-trimmed) | NOT allowed (auto-trimmed) |
| Reserved names | CON, PRN, AUX, NUL, COM1-9, LPT1-9 | Same |
| Max length | 200 chars | 200 chars |
| Empty/whitespace | NOT allowed | NOT allowed |

### Examples

**Valid Job/Order Names:**
- "Channel Letters" ✓
- "My Project Inc." ✓ (trailing period allowed)
- "O'Brien's Signs" ✓
- "Project ABC (Phase 2)" ✓
- "Café Sign" ✓
- "123 Main St." ✓

**Invalid Job/Order Names:**
- "Project " ✗ (trailing space)
- "20/20 Vision" ✗ (slash not allowed)
- "Test<Project>" ✗ (angle brackets)
- ".Hidden" ✗ (leading period)
- "CON" ✗ (reserved name)
- "" ✗ (empty)

---

## Implementation Specification

### 1. Backend Validation Utility

**File:** `/home/jon/Nexus/backend/web/src/utils/folderNameValidation.ts`

**Status:** [ ] Not Started

```typescript
export interface FolderNameValidationResult {
  isValid: boolean;
  error: string | null;
  sanitized: string;
}

export interface FolderNameValidationOptions {
  allowTrailingPeriod: boolean;  // true for job/order names, false for customer names
  maxLength?: number;            // default 200
  fieldName?: string;            // for error messages, e.g., "Job name", "Order name"
}

// Core validation function
export function validateFolderName(
  name: string | null | undefined,
  options: FolderNameValidationOptions
): FolderNameValidationResult;

// Convenience wrapper for job/order names (allows trailing periods)
export function validateJobOrOrderName(name: string | null | undefined): FolderNameValidationResult;

// Convenience wrapper for customer names (no trailing periods)
export function validateCustomerName(name: string | null | undefined): FolderNameValidationResult;
```

### 2. Frontend Validation Utility

**File:** `/home/jon/Nexus/frontend/web/src/utils/folderNameValidation.ts`

**Status:** [ ] Not Started

Mirror of backend validation for client-side validation on form submit.

### 3. Backend Controller Updates

#### jobController.ts

**File:** `/home/jon/Nexus/backend/web/src/controllers/jobController.ts`

**Status:** [ ] Not Started

**Changes:**

| Method | Line | Change |
|--------|------|--------|
| `validateJobName()` | 91-138 | Add character validation, return errors in response |
| `updateJob()` | 140-167 | Add validation before update |
| `createJob()` | 169-197 | Add validation before create |

#### orderConversionController.ts

**File:** `/home/jon/Nexus/backend/web/src/controllers/orderConversionController.ts`

**Status:** [ ] Not Started

**Changes:**

| Method | Line | Change |
|--------|------|--------|
| `convertEstimateToOrder()` | 26-75 | Add validation for `orderName` field |

### 4. Frontend Component Updates

#### JobPanel.tsx

**File:** `/home/jon/Nexus/frontend/web/src/components/jobEstimation/JobPanel.tsx`

**Status:** [ ] Not Started

**Changes:**

| Function | Line | Change |
|----------|------|--------|
| `handleCreateJob()` | 163-178 | Add validation before API call |
| `handleSaveEdit()` | 116-142 | Add validation before API call |

**Validation Behavior:**
- Validate on form submit only (not real-time)
- Show error message in modal/inline
- Block submission if invalid

#### ApproveEstimateModal.tsx

**File:** `/home/jon/Nexus/frontend/web/src/components/orders/modals/ApproveEstimateModal.tsx`

**Status:** [ ] Not Started

**Changes:**
- Add validation for `orderName` before calling convert API
- Show validation error near order name input
- Block submission if invalid

### 5. buildFolderName() Update

**File:** `/home/jon/Nexus/backend/web/src/services/orderFolderService.ts`

**Status:** [ ] Not Started

**Current (line 61-71):**
```typescript
buildFolderName(orderName: string, customerName: string): string {
  const sanitize = (str: string) => {
    return str.replace(/[\/\\:*?"<>|]/g, '_');
  };

  const sanitizedOrderName = sanitize(orderName.trim());
  const sanitizedCustomerName = sanitize(customerName.trim());

  return `${sanitizedOrderName} ----- ${sanitizedCustomerName}`;
}
```

**Updated:**
```typescript
buildFolderName(orderName: string, customerName: string): string {
  // Sanitize: replace invalid filesystem characters with underscore
  // Strip trailing spaces (Windows Win32 API strips these, causing access issues)
  // Note: Trailing periods are OK for orderName (middle of path) but stripped from customerName (end of path)
  const sanitize = (str: string, stripTrailingPeriods: boolean = false) => {
    let result = str
      .replace(/[\/\\:*?"<>|]/g, '_')  // Replace invalid chars with underscore
      .trim();                          // Remove leading/trailing spaces

    if (stripTrailingPeriods) {
      result = result.replace(/\.+$/, '');  // Remove trailing periods
    }

    return result;
  };

  const sanitizedOrderName = sanitize(orderName, false);           // Keep trailing periods
  const sanitizedCustomerName = sanitize(customerName, true);      // Strip trailing periods

  return `${sanitizedOrderName} ----- ${sanitizedCustomerName}`;
}
```

---

## Error Messages

### User-Friendly Error Messages

| Condition | Error Message |
|-----------|---------------|
| Empty/whitespace | "Job name is required" |
| Invalid characters | "Job name contains invalid characters. Only letters, numbers, spaces, and these symbols are allowed: - _ . , & ' ( )" |
| Leading period | "Job name cannot start with a period" |
| Trailing space | "Job name cannot end with a space" |
| Reserved name | "Job name cannot be a Windows reserved name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)" |
| Too long | "Job name must be 200 characters or less" |

---

## Implementation Progress

### Checklist

- [ ] **Phase 1: Create Validation Utilities**
  - [ ] Backend: `folderNameValidation.ts`
  - [ ] Frontend: `folderNameValidation.ts`

- [ ] **Phase 2: Backend Integration**
  - [ ] Update `jobController.ts` - validateJobName()
  - [ ] Update `jobController.ts` - createJob()
  - [ ] Update `jobController.ts` - updateJob()
  - [ ] Update `orderConversionController.ts` - convertEstimateToOrder()

- [ ] **Phase 3: Frontend Integration**
  - [ ] Update `JobPanel.tsx` - handleCreateJob()
  - [ ] Update `JobPanel.tsx` - handleSaveEdit()
  - [ ] Update `ApproveEstimateModal.tsx` - order name validation

- [ ] **Phase 4: Sanitization Update**
  - [ ] Update `orderFolderService.ts` - buildFolderName()

- [ ] **Phase 5: Testing**
  - [ ] Test job creation with valid names
  - [ ] Test job creation with invalid characters
  - [ ] Test job edit with valid names
  - [ ] Test job edit with invalid characters
  - [ ] Test order conversion with valid names
  - [ ] Test order conversion with invalid characters
  - [ ] Test folder creation on SMB share

---

## Testing Checklist

### Backend API Tests

```bash
# Test job creation with invalid characters
curl -X POST /api/job-versioning/jobs \
  -d '{"customer_id": 1, "job_name": "Test/Project"}' \
  # Expected: 400 error with validation message

# Test job creation with trailing space
curl -X POST /api/job-versioning/jobs \
  -d '{"customer_id": 1, "job_name": "Test Project "}' \
  # Expected: 400 error

# Test job creation with trailing period (should succeed)
curl -X POST /api/job-versioning/jobs \
  -d '{"customer_id": 1, "job_name": "Test Project Inc."}' \
  # Expected: 200 success

# Test order conversion with invalid name
curl -X POST /api/orders/convert-estimate \
  -d '{"estimateId": 1, "orderName": "Order<Test>"}' \
  # Expected: 400 error
```

### Frontend UI Tests

- [ ] Create job with invalid characters → Error shown, submit blocked
- [ ] Create job with trailing space → Error shown, submit blocked
- [ ] Create job with trailing period → Success
- [ ] Edit job to invalid name → Error shown, submit blocked
- [ ] Convert estimate with invalid order name → Error shown, submit blocked
- [ ] Convert estimate with valid order name → Success, folder created

---

## Rollback Plan

If issues are discovered:

1. **Backend rollback:** Revert validation checks in controllers (validation is additive, not breaking)
2. **Frontend rollback:** Revert validation in components
3. **buildFolderName rollback:** Revert to original sanitize function

All changes are additive and can be safely reverted without data migration.

---

## References

- **Customer Name Validation:** `/home/jon/Nexus/CUSTOMER_NAME_VALIDATION_RULES.md`
- **Microsoft Naming Conventions:** https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
- **Current Folder Service:** `/home/jon/Nexus/backend/web/src/services/orderFolderService.ts`
- **Job Controller:** `/home/jon/Nexus/backend/web/src/controllers/jobController.ts`
- **Order Conversion:** `/home/jon/Nexus/backend/web/src/controllers/orderConversionController.ts`

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
