# Customer Name Validation Rules for Windows Folder Compatibility

## Problem Statement

Order folders are created on a Windows SMB share using the naming pattern:
```
{order_name} ----- {customer_name}
```

**Current Issues:**
1. Customer names ending in periods (e.g., "Sign House Inc.") create invalid Windows folder names
2. Customer names with invalid filesystem characters (e.g., "20/20 Signs" with `/`) are not validated at input
3. The `buildFolderName()` function sanitizes some characters but doesn't handle trailing periods

**Example Failure:**
```
Opening folder: \\192.168.2.85\Channel Letter\Orders\TEST JOB 123 ----- Sign House Inc.
```
Windows rejects folder names ending in periods, causing folder operations to fail.

---

## Windows Folder Name Restrictions

### Prohibited Characters
The following characters cannot be used in Windows file/folder names:
```
< > : " / \ | ? *
```

### Prohibited Patterns
- **Trailing periods** (`.`) - Windows automatically strips these
- **Trailing spaces** - Windows automatically strips these
- **Leading periods** - Creates hidden folders on Unix systems
- **Leading spaces** - Poor UX and causes path issues

### Reserved Names (Case-Insensitive)
These names cannot be used as folder names in Windows:
```
CON, PRN, AUX, NUL
COM1, COM2, COM3, COM4, COM5, COM6, COM7, COM8, COM9
LPT1, LPT2, LPT3, LPT4, LPT5, LPT6, LPT7, LPT8, LPT9
```

Also prohibited with extensions (e.g., `CON.txt`, `NUL.xlsx`)

### Length Restrictions
- **Maximum path length**: 260 characters (Windows MAX_PATH)
- **Recommended customer name limit**: 200 characters
  - Leaves room for order name, separators, and subfolder paths
  - Order folders include subfolders like `/Specs/`, `/Images/`, etc.

---

## Validation Rules for Customer Names

### Rule 1: Required Field
- Company name cannot be empty or only whitespace
- Must contain at least one non-whitespace character

### Rule 2: Character Restrictions
Reject names containing any of these characters:
```javascript
/[<>:"\/\\|?*]/
```

**User-friendly error message:**
```
Company name cannot contain: < > : " / \ | ? *
```

### Rule 3: Trailing/Leading Whitespace and Periods
- Automatically trim leading/trailing spaces
- Reject names that end in periods after trimming
- Reject names that start with periods

**User-friendly error messages:**
```
Company name cannot end in a period
Company name cannot start with a period
```

### Rule 4: Reserved Names
Reject if the trimmed, uppercase name matches:
```
CON, PRN, AUX, NUL, COM1-9, LPT1-9
```

Or if it matches the pattern:
```
{RESERVED_NAME}.{extension}
```

**User-friendly error message:**
```
Company name cannot be a Windows reserved name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
```

### Rule 5: Length Limit
- Maximum length: 200 characters (after trimming)

**User-friendly error message:**
```
Company name must be 200 characters or less
```

---

## Implementation Specification

### 1. Frontend Validation Utility
**File:** `/home/jon/Nexus/frontend/web/src/utils/customerNameValidation.ts`

```typescript
export interface CustomerNameValidationResult {
  isValid: boolean;
  error: string | null;
  sanitized: string; // Auto-trimmed version
}

export class CustomerNameValidator {
  // Windows reserved characters for filenames
  private static readonly INVALID_CHARS = /[<>:"\/\\|?*]/;

  // Windows reserved names (case-insensitive)
  private static readonly RESERVED_NAMES = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  private static readonly MAX_LENGTH = 200;

  static validate(name: string | null | undefined): CustomerNameValidationResult {
    // Handle null/undefined
    if (!name) {
      return {
        isValid: false,
        error: 'Company name is required',
        sanitized: ''
      };
    }

    // Trim whitespace
    const sanitized = name.trim();

    // Check empty after trim
    if (!sanitized) {
      return {
        isValid: false,
        error: 'Company name cannot be empty or only whitespace',
        sanitized: ''
      };
    }

    // Check length
    if (sanitized.length > this.MAX_LENGTH) {
      return {
        isValid: false,
        error: `Company name must be ${this.MAX_LENGTH} characters or less`,
        sanitized
      };
    }

    // Check invalid characters
    if (this.INVALID_CHARS.test(sanitized)) {
      return {
        isValid: false,
        error: 'Company name cannot contain: < > : " / \\ | ? *',
        sanitized
      };
    }

    // Check leading period
    if (sanitized.startsWith('.')) {
      return {
        isValid: false,
        error: 'Company name cannot start with a period',
        sanitized
      };
    }

    // Check trailing period
    if (sanitized.endsWith('.')) {
      return {
        isValid: false,
        error: 'Company name cannot end with a period',
        sanitized
      };
    }

    // Check reserved names
    const upperName = sanitized.toUpperCase();

    // Check exact match
    if (this.RESERVED_NAMES.includes(upperName)) {
      return {
        isValid: false,
        error: 'Company name cannot be a Windows reserved name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)',
        sanitized
      };
    }

    // Check reserved name with extension (e.g., "CON.txt")
    const baseName = upperName.split('.')[0];
    if (this.RESERVED_NAMES.includes(baseName)) {
      return {
        isValid: false,
        error: 'Company name cannot be a Windows reserved name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)',
        sanitized
      };
    }

    return {
      isValid: true,
      error: null,
      sanitized
    };
  }
}
```

### 2. Backend Validation
**File:** `/home/jon/Nexus/backend/web/src/services/customers/customerService.ts`

Add validation to `createCustomer()` and `updateCustomer()` methods:

```typescript
// At top of file
import { validateCustomerName } from '../../utils/customerNameValidation';

// In createCustomer() method, after line 320
if (!safeData.company_name) {
  throw new Error('Company name is required');
}

// Add new validation
const nameValidation = validateCustomerName(safeData.company_name);
if (!nameValidation.isValid) {
  throw new Error(nameValidation.error);
}

// In updateCustomer() method, add after preparing updateData
if (customerData.company_name) {
  const nameValidation = validateCustomerName(customerData.company_name);
  if (!nameValidation.isValid) {
    throw new Error(nameValidation.error);
  }
}
```

**New File:** `/home/jon/Nexus/backend/web/src/utils/customerNameValidation.ts`

```typescript
export interface CustomerNameValidationResult {
  isValid: boolean;
  error: string | null;
}

const INVALID_CHARS = /[<>:"\/\\|?*]/;
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];
const MAX_LENGTH = 200;

export function validateCustomerName(name: string | null | undefined): CustomerNameValidationResult {
  if (!name?.trim()) {
    return { isValid: false, error: 'Company name is required' };
  }

  const sanitized = name.trim();

  if (sanitized.length > MAX_LENGTH) {
    return { isValid: false, error: `Company name must be ${MAX_LENGTH} characters or less` };
  }

  if (INVALID_CHARS.test(sanitized)) {
    return { isValid: false, error: 'Company name cannot contain: < > : " / \\ | ? *' };
  }

  if (sanitized.startsWith('.')) {
    return { isValid: false, error: 'Company name cannot start with a period' };
  }

  if (sanitized.endsWith('.')) {
    return { isValid: false, error: 'Company name cannot end with a period' };
  }

  const upperName = sanitized.toUpperCase();
  const baseName = upperName.split('.')[0];

  if (RESERVED_NAMES.includes(upperName) || RESERVED_NAMES.includes(baseName)) {
    return { isValid: false, error: 'Company name cannot be a Windows reserved name' };
  }

  return { isValid: true, error: null };
}
```

### 3. Fix orderFolderService.buildFolderName()
**File:** `/home/jon/Nexus/backend/web/src/services/orderFolderService.ts`

**Current code (lines 61-71):**
```typescript
buildFolderName(orderName: string, customerName: string): string {
  // Sanitize: replace invalid filesystem characters with underscore
  const sanitize = (str: string) => {
    return str.replace(/[\/\\:*?"<>|]/g, '_');
  };

  const sanitizedOrderName = sanitize(orderName.trim());
  const sanitizedCustomerName = sanitize(customerName.trim());

  return `${sanitizedOrderName} ----- ${sanitizedCustomerName}`;
}
```

**Updated code:**
```typescript
buildFolderName(orderName: string, customerName: string): string {
  // Sanitize: replace invalid filesystem characters with underscore
  // Also strip trailing periods and spaces (Windows incompatible)
  const sanitize = (str: string) => {
    return str
      .replace(/[\/\\:*?"<>|]/g, '_')  // Replace invalid chars
      .trim()                            // Remove leading/trailing spaces
      .replace(/\.+$/, '');              // Remove trailing periods
  };

  const sanitizedOrderName = sanitize(orderName);
  const sanitizedCustomerName = sanitize(customerName);

  return `${sanitizedOrderName} ----- ${sanitizedCustomerName}`;
}
```

### 4. Update Frontend Customer Creation Form
**File:** `/home/jon/Nexus/frontend/web/src/components/customers/creation/CustomerCreationValidation.ts`

Add to imports:
```typescript
import { CustomerNameValidator } from '../../../utils/customerNameValidation';
```

Update `validateRequiredFields()` method:
```typescript
private static validateRequiredFields(formData: CustomerCreateData, errors: ValidationError[]): void {
  if (!formData.company_name?.trim()) {
    errors.push({
      field: 'company_name',
      message: 'Company name is required'
    });
    return; // Don't continue validation if empty
  }

  // Validate Windows folder name compatibility
  const nameValidation = CustomerNameValidator.validate(formData.company_name);
  if (!nameValidation.isValid) {
    errors.push({
      field: 'company_name',
      message: nameValidation.error || 'Invalid company name'
    });
  }
}
```

Update `validateField()` method for company_name case:
```typescript
case 'company_name':
  if (!value || typeof value !== 'string' || !value.trim()) {
    return 'Company name is required';
  }
  const validation = CustomerNameValidator.validate(value);
  return validation.error;
```

### 5. Update Frontend Customer Edit Form
**File:** `/home/jon/Nexus/frontend/web/src/components/customers/CustomerForm.tsx`

Add validation on blur or change for company_name field around line 28-38.

---

## Migration Strategy for Existing Customers

### Current Problematic Names Found

**Query to find issues:**
```sql
-- Names ending in period
SELECT customer_id, company_name
FROM customers
WHERE company_name REGEXP '\.$';

-- Names with invalid characters
SELECT customer_id, company_name
FROM customers
WHERE company_name REGEXP '[/:*?"<>|]';

-- Names with leading period
SELECT customer_id, company_name
FROM customers
WHERE company_name REGEXP '^\\.';
```

**Known Issues:**
1. **"20/20 Signs"** (customer_id: 3) - Contains `/` character
   - Suggested fix: "20-20 Signs" or "2020 Signs"

2. Any names ending in "Inc.", "Ltd.", "Corp." etc.
   - These are VALID (period in middle is fine)
   - Only trailing periods at the very end are problematic

### Migration Options

**Option 1: Soft Migration (Recommended)**
- New customers must comply with validation rules
- Existing customers show warning on edit but allow save
- `buildFolderName()` handles sanitization defensively

**Option 2: Hard Migration**
- Create migration script to auto-fix existing names
- Update database with sanitized versions
- Notify affected customers of name change

**Option 3: Grandfather Clause**
- Existing customers exempt from validation
- Only new customers (customer_id > current_max) must comply
- Add `legacy_name` flag to database

**Recommended:** Option 1 with gradual cleanup as customers are edited.

---

## Testing Checklist

### Frontend Tests
- [ ] Empty company name shows error
- [ ] Name with `/` shows error "cannot contain: < > : " / \ | ? *"
- [ ] Name ending in `.` shows error "cannot end with a period"
- [ ] Name starting with `.` shows error "cannot start with a period"
- [ ] Name "CON" shows reserved name error
- [ ] Name "CON.txt" shows reserved name error
- [ ] Name with 201+ characters shows length error
- [ ] Valid name "ABC Company Inc" passes
- [ ] Valid name "3M Canada" passes
- [ ] Leading/trailing spaces auto-trimmed

### Backend Tests
- [ ] POST /customers with invalid name returns 400 error
- [ ] PUT /customers/:id with invalid name returns 400 error
- [ ] Valid names pass and create customer successfully

### Integration Tests
- [ ] Create order with customer "Test Co." - folder created correctly
- [ ] Folder name does not end in period on filesystem
- [ ] Open folder button works for sanitized names
- [ ] Existing customer "20/20 Signs" can create orders (sanitized to "20_20 Signs")

---

## Rollout Plan

1. **Phase 1: Backend Hardening (Non-Breaking)**
   - Add `buildFolderName()` trailing period fix
   - Deploy to production
   - Verify existing orders unaffected

2. **Phase 2: Frontend Validation (Soft Launch)**
   - Add validation utility and form validation
   - Show warnings but allow saves for existing customers
   - Deploy to production

3. **Phase 3: Backend Enforcement**
   - Enable backend validation for new customers
   - Add edit warnings for existing problematic names
   - Deploy to production

4. **Phase 4: Cleanup**
   - Run audit report
   - Contact customers with problematic names
   - Update names with approval

---

## Audit Script

Run this to generate a report of problematic customer names:

```sql
-- Comprehensive audit of customer names
SELECT
  customer_id,
  company_name,
  CASE
    WHEN company_name REGEXP '\.$' THEN 'Ends with period'
    WHEN company_name REGEXP '^\.' THEN 'Starts with period'
    WHEN company_name REGEXP '[/:*?"<>|]' THEN 'Contains invalid characters'
    WHEN LENGTH(company_name) > 200 THEN 'Too long (>200 chars)'
    WHEN UPPER(company_name) IN ('CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9') THEN 'Reserved Windows name'
    ELSE 'Unknown issue'
  END AS issue_type
FROM customers
WHERE
  company_name REGEXP '\.$' OR
  company_name REGEXP '^\.' OR
  company_name REGEXP '[/:*?"<>|]' OR
  LENGTH(company_name) > 200 OR
  UPPER(company_name) IN ('CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9')
ORDER BY issue_type, company_name;
```

---

## References

- [Microsoft: Naming Files, Paths, and Namespaces](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)
- [Windows Reserved Names](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#naming-conventions)
- Current implementation: `/home/jon/Nexus/backend/web/src/services/orderFolderService.ts:61-71`
