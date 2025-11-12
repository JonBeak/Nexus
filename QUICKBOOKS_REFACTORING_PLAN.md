# QuickBooks Route Refactoring Plan
## 3-Layer Architecture Implementation

**Date**: November 12, 2024
**File**: `/backend/web/src/routes/quickbooks.ts`
**Current Size**: 1,191 lines
**Target**: 4 files, ~1,080 lines total
**Estimated Time**: 4 hours
**Status**: Ready to implement

---

## 📊 EXECUTIVE SUMMARY

### Current State
- **Single monolithic route file** with mixed concerns
- **Direct database access** in route handlers (violates architecture)
- **Complex business logic** embedded in HTTP layer (544-line endpoint!)
- **No separation of concerns** - impossible to unit test
- **138% over architectural limit** (1,191 lines vs. 500-line max)

### Target State
- **4 focused files** following Route → Controller → Service → Repository pattern
- **Zero database access in routes** - all moved to repository layer
- **Business logic isolated** in service layer - fully testable
- **52 testable units** vs. 10 monolithic endpoints
- **All files under 500 lines** - compliant with architecture standard

### Business Impact
- ✅ **Zero breaking changes** - all functionality preserved
- ✅ **Improved maintainability** - clear separation of concerns
- ✅ **Better testability** - unit tests for each layer
- ✅ **Code reusability** - service methods can be called from jobs/CLI
- ✅ **Easier debugging** - isolated layers, structured logging

---

## 🎯 REQUIREMENTS & DECISIONS

### Finalized Requirements
1. ✅ **Remove** `/estimate-test/:id` endpoint (unauthenticated test endpoint)
2. ✅ **Debug mode**: Owner-only access (403 for Manager and below)
3. ✅ **OAuth cleanup**: Scheduled job to clean expired CSRF tokens
4. ✅ **Retry logic**: Keep current token-refresh retry only (no additional retries)
5. ✅ **Logging**: Implement structured logging (Winston or similar)

### Architecture Compliance
- Routes: 15-25 lines per endpoint (middleware chains only)
- Controller: 20-40 lines per method, 300 lines max per file
- Service: 50-200 lines per method, 500 lines max per file
- Repository: 20-60 lines per method, 300 lines max per file

---

## 📁 CURRENT FILE ANALYSIS

### Endpoint Inventory (10 → 9 endpoints)

#### **OAuth Flow** (4 endpoints)
| Endpoint | Method | Lines | Auth | Purpose |
|----------|--------|-------|------|---------|
| `/config-status` | GET | 34-42 | Required | Check QB credentials configured |
| `/start-auth` | GET | 74-98 | Query Token | Initiate OAuth, redirect to QB |
| `/callback` | GET | 104-262 | None | OAuth callback with CSRF protection |
| `/disconnect` | POST | 606-634 | Required | Disconnect and delete tokens |

#### **API Integration** (3 endpoints)
| Endpoint | Method | Lines | Auth | Purpose |
|----------|--------|-------|------|---------|
| `/status` | GET | 565-600 | Required | Check connection status |
| `/items` | GET | 530-559 | Required | Fetch QB items from local DB |
| `/create-estimate` | POST | 645-1189 | Required | **COMPLEX** Create estimate in QB |

#### **Debug/Test** (3 → 2 endpoints)
| Endpoint | Method | Lines | Auth | Purpose | Action |
|----------|--------|-------|------|---------|--------|
| `/test-logging` | GET | 268-280 | Required | Test logging functionality | Keep |
| `/estimate/:id` | GET | 408-523 | Required | Fetch QB estimate (debug) | Keep |
| `/estimate-test/:id` | GET | 286-402 | **NONE** | Fetch QB estimate (no auth) | **REMOVE** |

### Critical Issues Identified

#### 1. **Massive Endpoint Complexity** 🔴
- `/create-estimate`: **544 lines** (45% of entire file!)
- Nested business logic 5+ levels deep
- 7+ product type handlers
- Multiple database queries inline
- Complex error aggregation
- **Violation**: Service should handle this

#### 2. **Direct Database Access in Routes** 🔴
```typescript
Lines 534-538:  await pool.execute<RowDataPacket[]>(...)  // /items
Lines 618-619:  await pool.execute(...)                   // /disconnect
Lines 695-701:  await pool.execute<RowDataPacket[]>(...)  // estimate validation
Lines 765-816:  Multiple pool.execute calls              // tax resolution
```
**Violation**: Routes must NEVER touch database directly

#### 3. **Business Logic in HTTP Layer** 🔴
- Product type handling (Divider, Subtotal, Custom, Empty Row, Multiplier)
- Tax calculation based on customer province
- Item ID caching strategies
- Missing item error aggregation
- Line item construction with QB magic pattern avoidance
**Violation**: All belongs in service layer

#### 4. **Mixed Concerns** 🔴
- HTML generation for OAuth callback pages
- Encryption service calls
- Logging mixed with business logic
- Debug mode comparison analysis
**Violation**: Single Responsibility Principle

---

## 🏗️ TARGET ARCHITECTURE

### File Structure
```
backend/web/src/
├── routes/
│   └── quickbooks.ts                      (~90 lines)
│       - 9 endpoint definitions
│       - Middleware chains only
│       - NO business logic
│       - NO database access
│
├── controllers/
│   └── quickbooksController.ts            (~260 lines)
│       - 9 HTTP handler methods
│       - Request/response handling
│       - Parameter extraction & validation
│       - Error formatting
│       - Calls service layer
│       - NO business logic
│       - NO database access
│
├── services/
│   └── quickbooksService.ts               (~450 lines)
│       - 15 business logic methods
│       - OAuth flow orchestration
│       - Estimate creation logic
│       - Entity resolution (customer/tax/item)
│       - Line item processing
│       - Product type handling
│       - Caching strategies
│       - Calls repository & API clients
│       - NO HTTP handling
│       - NO direct database queries
│
├── repositories/
│   └── quickbooksRepository.ts            (~280 lines)
│       - 17 data access methods
│       - Database queries (pool.execute)
│       - Estimate data CRUD
│       - Customer/tax/item lookups
│       - OAuth state management
│       - Data transformation
│       - NO business logic
│       - NO HTTP handling
│
├── utils/
│   ├── quickbooks/
│   │   ├── oauthClient.ts                 (existing - no changes)
│   │   ├── apiClient.ts                   (existing - no changes)
│   │   └── dbManager.ts                   (existing - gradually migrate to repository)
│   └── logger.ts                          (~50 lines - NEW)
│       - Winston structured logger
│       - Log levels (info, warn, error, debug)
│       - Formatted output
│
└── jobs/
    └── quickbooksCleanup.ts               (~30 lines - NEW)
        - Scheduled cron job
        - Cleans expired OAuth states
        - Runs daily at 2 AM
```

### Layer Responsibilities Matrix

| Concern | Route | Controller | Service | Repository |
|---------|-------|------------|---------|------------|
| HTTP handling | ✅ | ✅ | ❌ | ❌ |
| Middleware | ✅ | ❌ | ❌ | ❌ |
| Parameter extraction | ❌ | ✅ | ❌ | ❌ |
| Input validation | ❌ | ✅ | ✅ | ❌ |
| Business logic | ❌ | ❌ | ✅ | ❌ |
| Orchestration | ❌ | ❌ | ✅ | ❌ |
| Database queries | ❌ | ❌ | ❌ | ✅ |
| Data transformation | ❌ | ❌ | ❌ | ✅ |
| Error formatting | ❌ | ✅ | ❌ | ❌ |
| Logging | ❌ | ✅ | ✅ | ✅ |

---

## 🔍 DATA FLOW MAPPING

### Flow 1: OAuth Connection Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: GET /api/quickbooks/start-auth?token=xxx              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Route Layer                                                     │
│ - authenticateTokenFromQuery middleware                         │
│ - quickbooksController.startAuth                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Controller Layer                                                │
│ - Extract user from req                                         │
│ - Call service.initiateOAuth()                                  │
│ - Send redirect response                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Service Layer                                                   │
│ - oauthClient.getAuthorizationUrl()                             │
│ - repository.storeOAuthState(state, 600)                        │
│ - Return authUrl                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Repository Layer                                                │
│ - pool.execute(INSERT INTO qb_oauth_states ...)                 │
│ - Return void                                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response: 302 Redirect to QuickBooks authorization page         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ QuickBooks: Redirects back with code, realmId, state            │
│ GET /api/quickbooks/callback?code=xxx&realmId=xxx&state=xxx     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Route Layer (NO auth middleware - public callback)             │
│ - quickbooksController.handleCallback                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Controller Layer                                                │
│ - Extract code, realmId, state from query                       │
│ - Validate parameters present                                   │
│ - Call service.processCallback(code, realmId, state)            │
│ - Return HTML success/error page                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Service Layer                                                   │
│ 1. Validate CSRF token                                          │
│    - repository.validateAndConsumeOAuthState(state)             │
│    - Throw error if invalid/expired                             │
│ 2. Exchange code for tokens                                     │
│    - oauthClient.exchangeCodeForTokens(code)                    │
│ 3. Store tokens                                                 │
│    - repository.storeTokens(realmId, tokenData)                 │
│ 4. Set default realm if first connection                        │
│    - defaultRealmId = repository.getDefaultRealmId()            │
│    - if (!defaultRealmId) repository.setDefaultRealmId(realmId) │
│ 5. Return success                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Repository Layer                                                │
│ - DELETE FROM qb_oauth_states WHERE state_token = ?             │
│ - INSERT INTO qb_oauth_tokens (encrypted tokens)                │
│ - SELECT/UPDATE qb_settings (default_realm_id)                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response: HTML page with success message + auto-close script    │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 2: Create Estimate (Most Complex)
```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: POST /api/quickbooks/create-estimate                  │
│ Body: { estimateId, estimatePreviewData, debugMode }            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Route Layer                                                     │
│ - authenticateToken middleware (JWT validation)                 │
│ - quickbooksController.createEstimate                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Controller Layer                                                │
│ - Extract estimateId, estimatePreviewData, debugMode from body  │
│ - Extract user from AuthRequest                                 │
│ - Validate required fields present                              │
│ - **CHECK: debugMode && user.role !== 'owner' → 403**          │
│ - Call service.createEstimateInQuickBooks(...)                  │
│ - Format response with qbEstimateId, qbDocNumber, qbUrl         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Service Layer: createEstimateInQuickBooks()                     │
│                                                                 │
│ STEP 1: Validate Estimate Eligibility                          │
│   - estimateDetails = repository.getEstimateDetails(estimateId) │
│   - Validate: is_draft === true (else throw error)             │
│   - Validate: qb_estimate_id === null (else throw error)       │
│   - Validate: customerName is configured (else throw error)    │
│                                                                 │
│ STEP 2: Resolve Customer ID (with caching)                     │
│   - qbCustomerId = repository.getCachedCustomerId(customerId)   │
│   - if (!qbCustomerId):                                         │
│       - qbCustomerId = apiClient.getCustomerIdByName(name, ...) │
│       - if (!qbCustomerId) throw "Customer not found in QB"    │
│       - repository.storeCustomerMapping(mapping)                │
│                                                                 │
│ STEP 3: Resolve Tax Code (province-based)                      │
│   - province = repository.getCustomerProvince(customerId)       │
│   - taxName = repository.getTaxNameForProvince(province)        │
│   - qbTaxCodeId = repository.getTaxCodeIdByName(taxName)        │
│   - if (!qbTaxCodeId) throw "Tax mapping not found"            │
│                                                                 │
│ STEP 4: Build Line Items (complex product type handling)       │
│   - lines = []                                                  │
│   - missingItems = []                                           │
│   - for each item in estimatePreviewData.items:                 │
│       - processedLine = processProductType(item, ...)           │
│       - if (processedLine) lines.push(processedLine)            │
│       - if (item missing from QB) missingItems.push(itemName)   │
│   - if (missingItems.length > 0) throw with list               │
│                                                                 │
│ STEP 5: Create Estimate in QuickBooks                          │
│   - payload = { CustomerRef, TxnDate, Line: lines }             │
│   - result = apiClient.createEstimate(payload, realmId)         │
│                                                                 │
│ STEP 6: Finalize Estimate (make immutable)                     │
│   - repository.finalizeEstimate(estimateId, qbEstimateId, ...)  │
│                                                                 │
│ STEP 7: Debug Mode (owner only)                                │
│   - if (debugMode):                                             │
│       - fetchedEstimate = apiClient.makeQBApiCall(GET, ...)     │
│       - Log detailed comparison (sent vs. returned lines)       │
│       - Return debug data in response                           │
│                                                                 │
│ RETURN: { qbEstimateId, qbDocNumber, qbEstimateUrl, debug? }   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Service Layer: processProductType() - Private Method           │
│                                                                 │
│ Handle special product types:                                  │
│   - Type 25 (Divider): return null (skip)                      │
│   - Type 21 (Subtotal): return DescriptionOnly with formatted  │
│       text (replace "Subtotal:" with "Subtotal =" to avoid QB  │
│       magic pattern)                                            │
│   - Type 27 (Empty Row): return DescriptionOnly for spacing    │
│   - Type 9 (Custom): if no price → DescriptionOnly, else Item  │
│   - Type 23 (Multiplier): return null (already applied)        │
│   - Default: resolve item ID and return SalesItemLineDetail    │
│                                                                 │
│ For regular items:                                              │
│   - itemData = repository.getCachedItemId(itemName)             │
│   - if (!itemData):                                             │
│       - qbItemId = apiClient.getItemIdByName(itemName, realmId) │
│       - if (!qbItemId) add to missingItems                      │
│       - else repository.storeItemMapping(...)                   │
│                                                                 │
│ RETURN: QBLine object or null                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Repository Layer                                                │
│                                                                 │
│ getEstimateDetails(estimateId):                                 │
│   - SELECT customer_id, is_draft, qb_estimate_id, job_id        │
│     FROM job_estimates WHERE id = ?                             │
│                                                                 │
│ getCachedCustomerId(customerId):                                │
│   - SELECT qb_customer_id FROM qb_customer_id_mappings          │
│     WHERE customer_id = ?                                       │
│                                                                 │
│ storeCustomerMapping(mapping):                                  │
│   - INSERT INTO qb_customer_id_mappings ... ON DUPLICATE UPDATE │
│                                                                 │
│ getCustomerProvince(customerId):                                │
│   - SELECT province_state_short FROM customer_addresses         │
│     WHERE customer_id = ? AND (is_billing = 1 OR is_primary = 1)│
│     ORDER BY is_billing DESC LIMIT 1                            │
│                                                                 │
│ getTaxNameForProvince(provinceShort):                           │
│   - SELECT tax_name FROM provinces_tax                          │
│     WHERE province_short = ? AND is_active = 1                  │
│                                                                 │
│ getTaxCodeIdByName(taxName):                                    │
│   - SELECT qb_tax_code_id FROM qb_tax_code_mappings             │
│     WHERE tax_name = ?                                          │
│                                                                 │
│ getCachedItemId(itemName):                                      │
│   - SELECT qb_item_id, description FROM qb_item_mappings        │
│     WHERE item_name = ?                                         │
│                                                                 │
│ storeItemMapping(mapping):                                      │
│   - INSERT INTO qb_item_mappings ... ON DUPLICATE UPDATE        │
│                                                                 │
│ finalizeEstimate(estimateId, qbEstimateId, amounts, userId):    │
│   - UPDATE job_estimates SET                                    │
│       is_draft = FALSE, status = 'sent', is_sent = TRUE,        │
│       finalized_at = NOW(), finalized_by_user_id = ?,           │
│       qb_estimate_id = ?, sent_to_qb_at = NOW(),                │
│       subtotal = ?, tax_amount = ?, total_amount = ?            │
│     WHERE id = ? AND is_draft = TRUE                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response: JSON with qbEstimateId, qbDocNumber, qbEstimateUrl    │
│ (+ debug data if debugMode && owner)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ IMPLEMENTATION DETAILS

### Phase 1: Repository Layer (~280 lines)

**File**: `/backend/web/src/repositories/quickbooksRepository.ts`

```typescript
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class QuickBooksRepository {

  // =============================================
  // ESTIMATE DATA ACCESS
  // =============================================

  /**
   * Get estimate details for QB creation
   */
  async getEstimateDetails(estimateId: number): Promise<{
    customer_id: number;
    is_draft: boolean;
    qb_estimate_id: string | null;
    job_id: number;
  } | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT customer_id, is_draft, qb_estimate_id, job_id
       FROM job_estimates
       WHERE id = ?`,
      [estimateId]
    );

    return rows.length > 0 ? rows[0] as any : null;
  }

  /**
   * Finalize estimate after QB creation (make immutable)
   */
  async finalizeEstimate(
    estimateId: number,
    qbEstimateId: string,
    amounts: { subtotal: number; taxAmount: number; total: number },
    userId: number
  ): Promise<void> {
    await pool.execute(
      `UPDATE job_estimates
       SET is_draft = FALSE,
           status = 'sent',
           is_sent = TRUE,
           finalized_at = NOW(),
           finalized_by_user_id = ?,
           qb_estimate_id = ?,
           sent_to_qb_at = NOW(),
           subtotal = ?,
           tax_amount = ?,
           total_amount = ?
       WHERE id = ? AND is_draft = TRUE`,
      [userId, qbEstimateId, amounts.subtotal, amounts.taxAmount, amounts.total, estimateId]
    );
  }

  // =============================================
  // CUSTOMER RESOLUTION
  // =============================================

  /**
   * Get customer's billing province for tax resolution
   */
  async getCustomerProvince(customerId: number): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT province_state_short FROM customer_addresses
       WHERE customer_id = ? AND (is_billing = 1 AND is_primary = 1 OR is_primary = 1)
       ORDER BY is_billing DESC
       LIMIT 1`,
      [customerId]
    );

    return rows.length > 0 ? rows[0].province_state_short : null;
  }

  /**
   * Get cached QB customer ID from local customer ID
   */
  async getCachedCustomerId(customerId: number): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT qb_customer_id FROM qb_customer_id_mappings
       WHERE customer_id = ?`,
      [customerId]
    );

    return rows.length > 0 ? rows[0].qb_customer_id : null;
  }

  /**
   * Store customer ID mapping for caching
   */
  async storeCustomerMapping(mapping: {
    customer_id: number;
    qb_customer_id: string;
    qb_customer_name: string;
  }): Promise<void> {
    await pool.execute(
      `INSERT INTO qb_customer_id_mappings
        (customer_id, qb_customer_id, qb_customer_name, last_synced_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        qb_customer_id = VALUES(qb_customer_id),
        qb_customer_name = VALUES(qb_customer_name),
        last_synced_at = NOW()`,
      [mapping.customer_id, mapping.qb_customer_id, mapping.qb_customer_name]
    );
  }

  // =============================================
  // TAX RESOLUTION
  // =============================================

  /**
   * Get tax name from province code
   */
  async getTaxNameForProvince(provinceShort: string): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT pt.tax_name FROM provinces_tax pt
       WHERE pt.province_short = ? AND pt.is_active = 1
       LIMIT 1`,
      [provinceShort]
    );

    return rows.length > 0 ? rows[0].tax_name : null;
  }

  /**
   * Get QB tax code ID from tax name
   */
  async getTaxCodeIdByName(taxName: string): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT qtc.qb_tax_code_id FROM qb_tax_code_mappings qtc
       WHERE qtc.tax_name = ?
       LIMIT 1`,
      [taxName]
    );

    return rows.length > 0 ? rows[0].qb_tax_code_id : null;
  }

  /**
   * Store tax code mapping for future lookups
   */
  async storeTaxCodeMapping(mapping: {
    tax_name: string;
    qb_tax_code_id: string;
    tax_rate?: number;
  }): Promise<void> {
    await pool.execute(
      `INSERT INTO qb_tax_code_mappings
        (tax_name, qb_tax_code_id, tax_rate, last_synced_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        qb_tax_code_id = VALUES(qb_tax_code_id),
        tax_rate = VALUES(tax_rate),
        last_synced_at = NOW()`,
      [mapping.tax_name, mapping.qb_tax_code_id, mapping.tax_rate || null]
    );
  }

  // =============================================
  // ITEM RESOLUTION
  // =============================================

  /**
   * Get cached QB item ID and description
   */
  async getCachedItemId(itemName: string): Promise<{
    qb_item_id: string;
    description: string | null;
  } | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT qb_item_id, description FROM qb_item_mappings
       WHERE item_name = ?`,
      [itemName]
    );

    if (rows.length === 0) return null;

    return {
      qb_item_id: rows[0].qb_item_id,
      description: rows[0].description || null
    };
  }

  /**
   * Store item mapping for caching
   */
  async storeItemMapping(mapping: {
    item_name: string;
    qb_item_id: string;
    qb_item_type?: string;
  }): Promise<void> {
    await pool.execute(
      `INSERT INTO qb_item_mappings
        (item_name, qb_item_id, qb_item_type, last_synced_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        qb_item_id = VALUES(qb_item_id),
        qb_item_type = VALUES(qb_item_type),
        last_synced_at = NOW()`,
      [mapping.item_name, mapping.qb_item_id, mapping.qb_item_type || null]
    );
  }

  /**
   * Get all QB items for dropdown population
   */
  async getAllQBItems(): Promise<Array<{
    id: number;
    name: string;
    description: string | null;
    qbItemId: string;
    qbItemType: string | null;
  }>> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, item_name, description, qb_item_id, qb_item_type
       FROM qb_item_mappings
       ORDER BY item_name ASC`
    );

    return rows.map((row: any) => ({
      id: row.id,
      name: row.item_name,
      description: row.description,
      qbItemId: row.qb_item_id,
      qbItemType: row.qb_item_type
    }));
  }

  // =============================================
  // SETTINGS & CONFIGURATION
  // =============================================

  /**
   * Get default QB realm ID
   */
  async getDefaultRealmId(): Promise<string | null> {
    // First check explicit setting
    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT setting_value FROM qb_settings
       WHERE setting_key = 'default_realm_id'`
    );

    if (settingsRows.length > 0 && settingsRows[0].setting_value) {
      return settingsRows[0].setting_value as string;
    }

    // Fallback to most recent token
    const [tokenRows] = await pool.execute<RowDataPacket[]>(
      `SELECT realm_id FROM qb_oauth_tokens
       ORDER BY updated_at DESC LIMIT 1`
    );

    return tokenRows.length > 0 ? tokenRows[0].realm_id : null;
  }

  /**
   * Set default QB realm ID
   */
  async setDefaultRealmId(realmId: string): Promise<void> {
    await pool.execute(
      `UPDATE qb_settings
       SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = 'default_realm_id'`,
      [realmId]
    );
  }

  // =============================================
  // OAUTH STATE MANAGEMENT (CSRF PROTECTION)
  // =============================================

  /**
   * Store OAuth state token for CSRF validation
   */
  async storeOAuthState(stateToken: string, expiresInSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await pool.execute(
      `INSERT INTO qb_oauth_states (state_token, expires_at)
       VALUES (?, ?)`,
      [stateToken, expiresAt]
    );
  }

  /**
   * Validate and consume OAuth state token (one-time use)
   */
  async validateAndConsumeOAuthState(stateToken: string): Promise<boolean> {
    // Check if exists and not expired
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM qb_oauth_states
       WHERE state_token = ? AND expires_at > NOW()`,
      [stateToken]
    );

    if (rows.length === 0) {
      return false;
    }

    // Delete token (one-time use)
    await pool.execute(
      `DELETE FROM qb_oauth_states WHERE state_token = ?`,
      [stateToken]
    );

    return true;
  }

  /**
   * Clean up expired OAuth state tokens
   */
  async cleanupExpiredOAuthStates(): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM qb_oauth_states WHERE expires_at < NOW()`
    );

    return result.affectedRows;
  }

  /**
   * Delete tokens for disconnect
   */
  async deleteTokens(realmId: string): Promise<void> {
    await pool.execute(
      'DELETE FROM qb_oauth_tokens WHERE realm_id = ?',
      [realmId]
    );
  }
}

// Export singleton instance
export const quickbooksRepository = new QuickBooksRepository();
```

### Phase 2: Service Layer (~450 lines)

**File**: `/backend/web/src/services/quickbooksService.ts`

Key methods:
- `async initiateOAuth()`
- `async processCallback(code, realmId, state)`
- `async checkConnectionStatus()`
- `async getQuickBooksItems()`
- `async createEstimateInQuickBooks(estimateId, previewData, userId, debugMode)`
- `private async validateEstimateEligibility(estimateId)`
- `private async resolveCustomerId(customerId, customerName, realmId)`
- `private async resolveTaxCode(customerId)`
- `private async buildLineItems(items, qbTaxCodeId, taxName, realmId)`
- `private async processProductType(item, ...)`
- `private async finalizeEstimate(estimateId, qbEstimateId, amounts, userId)`
- `async fetchEstimateForAnalysis(estimateId, realmId)`
- `async disconnect(realmId)`

### Phase 3: Controller Layer (~260 lines)

**File**: `/backend/web/src/controllers/quickbooksController.ts`

Key methods (all async):
- `checkConfigStatus(req, res)` - Validate QB credentials configured
- `startAuth(req, res)` - Initiate OAuth flow
- `handleCallback(req, res)` - Process OAuth callback
- `getStatus(req, res)` - Check connection status
- `getItems(req, res)` - Get QB items from DB
- `createEstimate(req, res)` - Create estimate in QB (with owner-only debug check)
- `disconnect(req, res)` - Disconnect from QB
- `testLogging(req, res)` - Test logging
- `getEstimate(req, res)` - Fetch QB estimate (authenticated)

### Phase 4: Route Layer (~90 lines)

**File**: `/backend/web/src/routes/quickbooks.ts`

Endpoints (middleware chains only):
```typescript
router.get('/config-status', authenticateToken, controller.checkConfigStatus);
router.get('/start-auth', authenticateTokenFromQuery, controller.startAuth);
router.get('/callback', controller.handleCallback);
router.get('/status', authenticateToken, controller.getStatus);
router.get('/items', authenticateToken, controller.getItems);
router.post('/create-estimate', authenticateToken, controller.createEstimate);
router.post('/disconnect', authenticateToken, controller.disconnect);
router.get('/test-logging', authenticateToken, controller.testLogging);
router.get('/estimate/:id', authenticateToken, controller.getEstimate);
```

### Phase 5: Structured Logger (~50 lines)

**File**: `/backend/web/src/utils/logger.ts`

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export { logger };
```

### Phase 6: OAuth Cleanup Job (~30 lines)

**File**: `/backend/web/src/jobs/quickbooksCleanup.ts`

```typescript
import cron from 'node-cron';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { logger } from '../utils/logger';

/**
 * Clean up expired OAuth state tokens
 * Runs daily at 2:00 AM
 */
export function startQuickBooksCleanupJob() {
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('🧹 Starting QuickBooks OAuth state cleanup...');
      const deletedCount = await quickbooksRepository.cleanupExpiredOAuthStates();

      if (deletedCount > 0) {
        logger.info(`✅ Cleaned up ${deletedCount} expired OAuth state token(s)`);
      } else {
        logger.info('✅ No expired OAuth state tokens found');
      }
    } catch (error) {
      logger.error('❌ Failed to clean up OAuth state tokens:', error);
    }
  });

  logger.info('📅 QuickBooks cleanup job scheduled (daily at 2:00 AM)');
}
```

---

## ⚠️ CRITICAL PRESERVATION AREAS

### 1. OAuth Callback HTML Pages
**Location**: Lines 110-261 (current file)
**Requirement**: Exact UX preservation

**Success Page** (auto-close after 2 seconds):
```html
<html>
  <head><title>QuickBooks Connected</title></head>
  <body>
    <div class="success">✅</div>
    <h1>QuickBooks Connected!</h1>
    <p>This window will close in <span id="countdown">2</span> seconds...</p>
    <script>
      // Countdown + auto-close logic
    </script>
  </body>
</html>
```

**Error Pages**:
- Missing parameters error
- CSRF validation error (expired/invalid state)
- Token exchange error

**Action**: Move HTML templates to service layer or separate template file

### 2. Product Type Handling Logic
**Location**: Lines 830-928
**Requirement**: Exact business logic preservation

| Type | ID | Behavior | QB Line Type |
|------|-----|----------|--------------|
| **Divider** | 25 | Skip entirely (don't send to QB) | N/A |
| **Subtotal** | 21 | DescriptionOnly with special text processing | DescriptionOnly |
| **Empty Row** | 27 | DescriptionOnly for spacing/comments | DescriptionOnly |
| **Custom** | 9 | If no price → DescriptionOnly, else SalesItem | DescriptionOnly or SalesItemLineDetail |
| **Multiplier** | 23 | Skip (already applied to items) | N/A |
| **Discount/Fee** | 22 | Regular QB item lookup | SalesItemLineDetail |

**Critical Text Processing** (Type 21 - Subtotal):
```typescript
// MUST replace colons with equals to avoid QB magic subtotal pattern
const processedText = displayText
  .replace(/Subtotal:/g, 'Subtotal =')
  .replace(/Tax\s*\(/g, 'Tax (')
  .replace(/Tax\s*\([^)]+\):/g, (match) => match.replace(':', ' ='))
  .replace(/Section Total:/g, 'Section Total =')
  .replace(/Total:/g, 'Total =');
```

**Why**: QuickBooks has magic patterns that auto-insert calculated subtotals. We must avoid triggering these.

### 3. Tax Resolution Chain
**Location**: Lines 765-818
**Requirement**: Exact lookup sequence

```
Step 1: Get customer province
  SELECT province_state_short FROM customer_addresses
  WHERE customer_id = ? AND (is_billing = 1 OR is_primary = 1)
  ORDER BY is_billing DESC LIMIT 1

Step 2: Map province to tax name
  SELECT tax_name FROM provinces_tax
  WHERE province_short = ? AND is_active = 1

Step 3: Get QB tax code ID
  SELECT qb_tax_code_id FROM qb_tax_code_mappings
  WHERE tax_name = ?
```

**Error Messages to Preserve**:
- "Customer does not have a primary address"
- "No tax configuration found for province {X}"
- "No QuickBooks tax code mapping found for {tax_name}"

### 4. Caching Strategy
**Location**: Throughout create-estimate endpoint
**Requirement**: Check local DB before QB API

**For Customer IDs**:
1. Check `qb_customer_id_mappings` table
2. If not found, call `getCustomerIdByName()` QB API
3. If found in QB, store in mappings table
4. If not found in QB, throw error with clear message

**For Item IDs**:
1. Check `qb_item_mappings` table (returns ID + description)
2. If not found, call `getItemIdByName()` QB API
3. If found in QB, store in mappings table
4. Collect ALL missing items before failing (don't fail on first miss)

**Error Aggregation**:
```typescript
const missingItems: string[] = [];
for (const item of items) {
  if (!qbItemId) {
    missingItems.push(item.itemName);
    continue; // Don't fail yet - check all items
  }
}

if (missingItems.length > 0) {
  throw new Error(
    `The following items were not found in QuickBooks:\n${missingItems.join('\n')}`
  );
}
```

### 5. Debug Mode Comparison
**Location**: Lines 1080-1173
**Requirement**: Owner-only, preserve exact logging format

**Behavior**:
1. After creating estimate, immediately fetch it back from QB
2. Log side-by-side comparison:
   - "WHAT WE SENT TO QUICKBOOKS" section
   - "WHAT QUICKBOOKS RETURNED" section
   - Line-by-line comparison
3. Return debug data in response:
   ```json
   {
     "success": true,
     "qbEstimateId": "123",
     "debug": {
       "linesSent": 15,
       "linesReturned": 13,
       "sentLines": [...],
       "returnedLines": [...],
       "fullEstimate": {...}
     }
   }
   ```

**Access Control** (NEW):
```typescript
if (debugMode && user.role !== 'owner') {
  return res.status(403).json({
    success: false,
    error: 'Debug mode is only available to system owners'
  });
}
```

### 6. Custom Middleware
**Location**: Lines 48-68
**Requirement**: Preserve exact token extraction logic

```typescript
const authenticateTokenFromQuery = async (req, res, next) => {
  // Check query parameter first (OAuth popup), then fall back to header
  const token = (req.query.token as string) ||
    (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Validate JWT
  const jwt = require('jsonwebtoken');
  const decoded = jwt.verify(token, process.env.JWT_SECRET!);

  (req as AuthRequest).user = { userId: decoded.userId } as any;
  next();
};
```

**Why**: OAuth flow opens in popup via `window.open()`, which cannot set headers. Token must be passed as query param.

---

## 🧪 TESTING STRATEGY

### Unit Tests

#### Repository Layer Tests
```typescript
describe('QuickBooksRepository', () => {
  test('getEstimateDetails returns estimate data', async () => {});
  test('getEstimateDetails returns null if not found', async () => {});
  test('getCachedCustomerId returns cached ID', async () => {});
  test('getCachedCustomerId returns null if not cached', async () => {});
  test('storeCustomerMapping creates new mapping', async () => {});
  test('storeCustomerMapping updates existing mapping', async () => {});
  test('getCustomerProvince returns billing address province', async () => {});
  test('getCustomerProvince falls back to primary address', async () => {});
  test('getTaxNameForProvince returns active tax name', async () => {});
  test('validateAndConsumeOAuthState returns true for valid state', async () => {});
  test('validateAndConsumeOAuthState returns false for expired state', async () => {});
  test('validateAndConsumeOAuthState deletes state after validation', async () => {});
});
```

#### Service Layer Tests (with mocked repository)
```typescript
describe('QuickBooksService', () => {
  test('initiateOAuth generates auth URL and stores state', async () => {});
  test('processCallback validates state and stores tokens', async () => {});
  test('processCallback throws on invalid state', async () => {});
  test('resolveCustomerId uses cached ID if available', async () => {});
  test('resolveCustomerId queries QB API if not cached', async () => {});
  test('resolveCustomerId throws if customer not found in QB', async () => {});
  test('resolveTaxCode resolves province → tax name → QB ID', async () => {});
  test('resolveTaxCode throws if no primary address', async () => {});
  test('processProductType skips Divider (type 25)', async () => {});
  test('processProductType creates DescriptionOnly for Subtotal (type 21)', async () => {});
  test('processProductType replaces colons in subtotal text', async () => {});
  test('buildLineItems aggregates missing items', async () => {});
  test('buildLineItems throws with all missing items listed', async () => {});
  test('createEstimateInQuickBooks throws if estimate not draft', async () => {});
  test('createEstimateInQuickBooks throws if already sent to QB', async () => {});
});
```

#### Controller Layer Tests (integration tests)
```typescript
describe('QuickBooksController', () => {
  test('POST /create-estimate returns 403 if debugMode && not owner', async () => {});
  test('POST /create-estimate returns 400 if missing estimateId', async () => {});
  test('POST /create-estimate returns 400 if estimate not draft', async () => {});
  test('POST /create-estimate returns 200 with qbEstimateId on success', async () => {});
  test('GET /start-auth redirects to QB authorization URL', async () => {});
  test('GET /callback returns HTML error if state invalid', async () => {});
  test('GET /callback returns HTML success if valid', async () => {});
  test('GET /status returns connected: false if no realm', async () => {});
  test('GET /status returns connected: true with realm info', async () => {});
});
```

### End-to-End Tests

```typescript
describe('QuickBooks E2E Flow', () => {
  test('Complete OAuth flow: start → callback → status', async () => {
    // 1. Start auth
    const startRes = await request(app)
      .get('/api/quickbooks/start-auth?token=valid-jwt')
      .expect(302);

    expect(startRes.header.location).toContain('appcenter.intuit.com');

    // 2. Simulate callback (mock QB response)
    const callbackRes = await request(app)
      .get('/api/quickbooks/callback?code=test&realmId=123&state=valid-state')
      .expect(200);

    expect(callbackRes.text).toContain('QuickBooks Connected');

    // 3. Check status
    const statusRes = await request(app)
      .get('/api/quickbooks/status')
      .set('Authorization', 'Bearer valid-jwt')
      .expect(200);

    expect(statusRes.body.connected).toBe(true);
    expect(statusRes.body.realmId).toBe('123');
  });

  test('Create estimate flow: all product types', async () => {
    const res = await request(app)
      .post('/api/quickbooks/create-estimate')
      .set('Authorization', 'Bearer valid-jwt')
      .send({
        estimateId: 1,
        estimatePreviewData: {
          customerName: 'Test Customer',
          items: [
            { productTypeId: 1, itemName: 'Sign', quantity: 1, unitPrice: 100 },
            { productTypeId: 21, calculationDisplay: 'Subtotal: $100' }, // Should convert colon
            { productTypeId: 25 }, // Should skip
          ],
          subtotal: 100,
          taxAmount: 13,
          total: 113
        }
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.qbEstimateId).toBeDefined();
  });
});
```

### Manual Testing Checklist

- [ ] OAuth Flow
  - [ ] Start auth opens QB authorization page
  - [ ] Callback stores tokens correctly
  - [ ] CSRF protection rejects invalid state
  - [ ] CSRF protection rejects expired state (wait 10+ min)
  - [ ] Success page auto-closes after 2 seconds
  - [ ] Error pages display correctly

- [ ] Connection Management
  - [ ] Status shows "not connected" initially
  - [ ] Status shows "connected" after OAuth
  - [ ] Disconnect removes tokens
  - [ ] Status shows "not connected" after disconnect

- [ ] Estimate Creation
  - [ ] Rejects non-draft estimates
  - [ ] Rejects already-sent estimates
  - [ ] Rejects if customer not in QB
  - [ ] Resolves customer ID from cache
  - [ ] Resolves tax code from province
  - [ ] Handles all product types correctly:
    - [ ] Type 25 (Divider) - skipped
    - [ ] Type 21 (Subtotal) - DescriptionOnly with text processing
    - [ ] Type 27 (Empty Row) - DescriptionOnly
    - [ ] Type 9 (Custom) - conditional DescriptionOnly vs. Item
    - [ ] Type 23 (Multiplier) - skipped
    - [ ] Type 22 (Discount/Fee) - regular item
  - [ ] Aggregates all missing items in single error
  - [ ] Creates estimate in QB successfully
  - [ ] Finalizes estimate (sets is_draft = false)
  - [ ] Returns QB estimate URL

- [ ] Debug Mode (Owner Only)
  - [ ] Manager cannot use debug mode (403)
  - [ ] Owner can use debug mode
  - [ ] Debug response includes comparison data
  - [ ] Logs show sent vs. returned lines

- [ ] OAuth Cleanup Job
  - [ ] Job runs at 2 AM daily
  - [ ] Deletes expired state tokens
  - [ ] Logs cleanup results

---

## 📈 SUCCESS METRICS

### Quantitative
- ✅ **File count**: 1 → 4 files
- ✅ **Largest file**: 1,191 lines → <500 lines (all compliant)
- ✅ **Testable units**: 10 endpoints → 52 methods
- ✅ **Code coverage**: 0% → 80%+ target
- ✅ **Average method size**: ~119 lines → ~21 lines

### Qualitative
- ✅ **Maintainability**: Clear layer separation, easy to navigate
- ✅ **Testability**: Unit tests for repository, service, controller
- ✅ **Reusability**: Service methods callable from jobs, CLI tools
- ✅ **Debugging**: Structured logging, isolated layers
- ✅ **Onboarding**: New developers understand architecture quickly
- ✅ **Code review**: Reviewers can thoroughly review 20-40 line methods

---

## 🚧 IMPLEMENTATION SEQUENCE

### Step 1: Create Repository Layer (45 min)
**File**: `/backend/web/src/repositories/quickbooksRepository.ts`
- [ ] Create QuickBooksRepository class
- [ ] Implement estimate data access methods (4 methods)
- [ ] Implement customer resolution methods (3 methods)
- [ ] Implement tax resolution methods (3 methods)
- [ ] Implement item resolution methods (3 methods)
- [ ] Implement settings methods (2 methods)
- [ ] Implement OAuth state methods (3 methods)
- [ ] Export singleton instance
- [ ] Write unit tests for repository

**Validation**: Run repository unit tests

### Step 2: Create Service Layer (90 min)
**File**: `/backend/web/src/services/quickbooksService.ts`
- [ ] Create QuickBooksService class
- [ ] Implement OAuth methods (3 methods)
- [ ] Implement connection methods (2 methods)
- [ ] Implement estimate validation method
- [ ] Implement customer resolution method
- [ ] Implement tax resolution method
- [ ] Implement line item building method
- [ ] Implement product type processing method (with all 7 types)
- [ ] Implement estimate finalization method
- [ ] Implement debug/analysis methods (2 methods)
- [ ] Export singleton instance
- [ ] Write unit tests with mocked repository

**Validation**: Run service unit tests (mock repository)

### Step 3: Create Structured Logger (15 min)
**File**: `/backend/web/src/utils/logger.ts`
- [ ] Install Winston: `npm install winston`
- [ ] Configure logger with levels
- [ ] Add file transports (error.log, combined.log)
- [ ] Add console transport for development
- [ ] Export logger instance
- [ ] Replace all console.log/error with logger calls

**Validation**: Test logging at different levels

### Step 4: Create OAuth Cleanup Job (15 min)
**File**: `/backend/web/src/jobs/quickbooksCleanup.ts`
- [ ] Install node-cron: `npm install node-cron @types/node-cron`
- [ ] Create cleanup function
- [ ] Schedule cron job (daily at 2 AM)
- [ ] Add logging
- [ ] Register job in server.ts startup

**Validation**: Manually trigger cleanup, verify expired tokens deleted

### Step 5: Create Controller Layer (60 min)
**File**: `/backend/web/src/controllers/quickbooksController.ts`
- [ ] Create QuickBooksController class
- [ ] Implement checkConfigStatus method
- [ ] Implement startAuth method
- [ ] Implement handleCallback method (with HTML templates)
- [ ] Implement getStatus method
- [ ] Implement getItems method
- [ ] Implement createEstimate method (with owner-only debug check)
- [ ] Implement disconnect method
- [ ] Implement testLogging method
- [ ] Implement getEstimate method
- [ ] Export singleton instance
- [ ] Write integration tests

**Validation**: Run controller integration tests

### Step 6: Update Route Layer (30 min)
**File**: `/backend/web/src/routes/quickbooks.ts`
- [ ] Import controller
- [ ] Replace all inline logic with controller method calls
- [ ] Keep authenticateToken middleware
- [ ] Keep authenticateTokenFromQuery custom middleware
- [ ] Remove /estimate-test/:id endpoint
- [ ] Remove all old code (lines 34-1189)
- [ ] Verify file is ~90 lines

**Validation**: Run end-to-end tests for all endpoints

### Step 7: Cleanup & Documentation (30 min)
- [ ] Remove commented code
- [ ] Add JSDoc comments to all public methods
- [ ] Update API documentation
- [ ] Run full test suite
- [ ] Run type checking: `npm run type-check`
- [ ] Run linting: `npm run lint`
- [ ] Manual smoke test of all endpoints
- [ ] Create backup of old file
- [ ] Git commit with detailed message

**Validation**: All tests pass, no TypeScript errors, manual testing complete

### Step 8: Production Deployment
- [ ] Create PR for review
- [ ] Address review feedback
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Run staging tests
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Monitor OAuth flow success rate

---

## ⚠️ RISK MITIGATION

### Before Implementation
- [x] ✅ Complete analysis of current implementation
- [x] ✅ Map all data flows
- [x] ✅ Document critical preservation areas
- [ ] Create git branch: `refactor/quickbooks-3-layer-architecture`
- [ ] Create backup: `cp quickbooks.ts quickbooks.ts.backup.2024-11-12`
- [ ] Run manual tests on current implementation (document results)

### During Implementation
- **Incremental approach**: Build new layers without touching existing route
- **Test each layer**: Unit tests before moving to next layer
- **Parallel implementation**: New code coexists with old until final cutover
- **No changes to utilities**: Keep oauthClient, apiClient, dbManager as-is

### Testing Checkpoints
- [ ] Repository tests pass (unit)
- [ ] Service tests pass (unit with mocks)
- [ ] Controller tests pass (integration)
- [ ] End-to-end OAuth flow works
- [ ] End-to-end estimate creation works (all product types)
- [ ] Debug mode restricted to owner only
- [ ] CSRF protection still works
- [ ] Error messages unchanged
- [ ] HTML callback pages unchanged

### Rollback Plan
If issues arise:
1. Keep backup file available
2. Git revert to previous commit
3. Investigate issue in separate branch
4. Fix and redeploy

### Monitoring After Deployment
- Watch error logs for 24 hours
- Monitor OAuth success rate (should be ~100%)
- Monitor estimate creation success rate
- Check for any new error patterns
- Verify cleanup job runs successfully

---

## 📚 REFERENCE DOCUMENTATION

### Database Tables Used
```sql
-- Core QuickBooks tables
qb_oauth_tokens             -- OAuth tokens (encrypted)
qb_customer_id_mappings     -- Customer ID cache
qb_tax_code_mappings        -- Tax code cache
qb_item_mappings            -- Item ID cache
qb_settings                 -- Configuration settings
qb_oauth_states             -- CSRF protection tokens

-- Related tables
job_estimates               -- Estimates (is_draft, qb_estimate_id)
customer_addresses          -- Customer billing addresses
provinces_tax               -- Province to tax name mapping
```

### External Dependencies
```typescript
// OAuth & API (existing utilities - no changes)
utils/quickbooks/oauthClient.ts
utils/quickbooks/apiClient.ts
utils/quickbooks/dbManager.ts

// Services
services/encryptionService.ts   // Token encryption (existing)
services/credentialService.ts   // QB credentials (existing)

// Middleware
middleware/auth.ts              // authenticateToken (existing)
```

### API Endpoint Summary
| Endpoint | Method | Auth | Purpose | Response |
|----------|--------|------|---------|----------|
| `/config-status` | GET | Required | Check credentials | `{ configured, errors, environment }` |
| `/start-auth` | GET | Query Token | Start OAuth | 302 Redirect |
| `/callback` | GET | None | OAuth callback | HTML page |
| `/status` | GET | Required | Connection status | `{ connected, realmId, ... }` |
| `/items` | GET | Required | Get QB items | `{ items: [...] }` |
| `/create-estimate` | POST | Required | Create estimate | `{ qbEstimateId, qbDocNumber, ... }` |
| `/disconnect` | POST | Required | Disconnect | `{ success, message }` |
| `/test-logging` | GET | Required | Test logging | `{ success, timestamp }` |
| `/estimate/:id` | GET | Required | Fetch estimate | `{ estimate: {...} }` |

---

## 🎓 LESSONS LEARNED (To Be Updated Post-Implementation)

### What Went Well
- (To be filled after implementation)

### Challenges Encountered
- (To be filled after implementation)

### Improvements for Future Refactoring
- (To be filled after implementation)

---

**Document Version**: 1.0
**Last Updated**: November 12, 2024
**Status**: Ready for implementation
**Estimated Total Time**: 4 hours (240 minutes)
**Next Step**: Begin Phase 1 - Repository Layer

---

## APPENDIX A: Product Type Reference

| Type ID | Name | QB Line Type | Behavior |
|---------|------|--------------|----------|
| 1-8 | Standard Products | SalesItemLineDetail | Regular item lookup |
| 9 | Custom | Conditional | If price > 0: SalesItem, else: DescriptionOnly |
| 21 | Subtotal | DescriptionOnly | Format calculation display, replace colons |
| 22 | Discount/Fee | SalesItemLineDetail | Regular item lookup |
| 23 | Multiplier | N/A | Skip (already applied) |
| 25 | Divider | N/A | Skip entirely |
| 27 | Empty Row | DescriptionOnly | Spacing/comments |

## APPENDIX B: Error Messages to Preserve

```
"Missing estimateId or estimatePreviewData"
"Only draft estimates can be sent to QuickBooks. This estimate is already finalized."
"Estimate already sent to QuickBooks."
"Customer QuickBooks name is not configured."
"Customer '{name}' not found in QuickBooks. Please create this customer in QuickBooks first."
"Customer does not have a primary address. Please set a primary address first."
"No tax configuration found for province {X}. Please check provinces_tax table."
"No QuickBooks tax code mapping found for '{taxName}'. Please configure the mapping."
"The following items were not found in QuickBooks. Please create them first:\n{list}"
"No valid line items found in estimate."
"Debug mode is only available to system owners"
```

## APPENDIX C: File Size Breakdown

| File | Current Lines | Target Lines | Reduction |
|------|---------------|--------------|-----------|
| `routes/quickbooks.ts` | 1,191 | 90 | -92% |
| `controllers/quickbooksController.ts` | 0 | 260 | NEW |
| `services/quickbooksService.ts` | 0 | 450 | NEW |
| `repositories/quickbooksRepository.ts` | 0 | 280 | NEW |
| `utils/logger.ts` | 0 | 50 | NEW |
| `jobs/quickbooksCleanup.ts` | 0 | 30 | NEW |
| **TOTAL** | **1,191** | **1,160** | -3% |

**Note**: Slight increase due to:
- Structured logging (+50 lines)
- OAuth cleanup job (+30 lines)
- Class structure overhead (~40 lines)

**Benefit**: 420% increase in testable units (10 → 52 methods)
