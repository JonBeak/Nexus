# QuickBooks Integration - Phase 2 Implementation Prompt

## Context

Phase 1 (COMPLETED ✅) implemented the backend OAuth infrastructure for QuickBooks integration:
- Database tables for tokens and ID mappings
- OAuth2 authentication flow (`/api/quickbooks/*` routes)
- API client with auto-refresh
- Entity lookup and caching system

**Phase 2 Goal:** Add frontend UI for QuickBooks connection and implement estimate creation from job estimation data.

---

## Project Structure Overview

```
/home/jon/Nexus/
├── backend/web/
│   ├── src/
│   │   ├── utils/quickbooks/
│   │   │   ├── dbManager.ts          ← Token & ID mapping storage
│   │   │   ├── oauthClient.ts        ← OAuth flow
│   │   │   └── apiClient.ts          ← QB API calls (has createEstimate function)
│   │   ├── routes/
│   │   │   └── quickbooks.ts         ← OAuth routes (/start-auth, /callback, /status)
│   │   └── controllers/
│   │       └── estimateVersioningController.ts  ← Estimate data retrieval
│   └── .env                          ← QB_CLIENT_ID, QB_CLIENT_SECRET
│
├── frontend/web/
│   ├── src/
│   │   ├── components/jobEstimation/
│   │   │   ├── JobEstimationDashboard.tsx      ← MAIN COMPONENT TO MODIFY
│   │   │   ├── EstimateTable.tsx               ← Shows estimate preview
│   │   │   ├── VersionManager.tsx              ← Version selection UI
│   │   │   └── types/index.ts                  ← EstimateVersion type
│   │   ├── services/
│   │   │   └── api.ts                          ← API client (add QB methods here)
│   │   └── types/index.ts                      ← Global types
│   └── .env.production                         ← Frontend config
│
└── QUICKBOOKS_INTEGRATION_PHASE1.md            ← Phase 1 documentation
```

---

## Required Reading Before Starting

### **Critical Files to Understand:**

1. **Backend QB Integration (Phase 1):**
   - `/home/jon/Nexus/backend/web/src/routes/quickbooks.ts`
     - Review all available endpoints
     - Note the `/status`, `/start-auth`, `/disconnect` routes

   - `/home/jon/Nexus/backend/web/src/utils/quickbooks/apiClient.ts`
     - Study `createEstimate()` function signature
     - Review `QBEstimateLine` and `QBEstimatePayload` interfaces
     - Note the entity lookup functions: `getCustomerIdByName()`, `getTaxCodeIdByName()`, `getItemIdByName()`

   - `/home/jon/Nexus/QUICKBOOKS_INTEGRATION_PHASE1.md`
     - Understand the OAuth flow
     - Review ID mapping/caching strategy

2. **Frontend Architecture:**
   - `/home/jon/Nexus/CLAUDE.md` (Project Instructions)
     - Section: `<CodeStandards>` → Frontend patterns
     - Section: `<MandatoryWorkflow>` → Research → Proposal → Implementation
     - Section: `<ResponsePatterns>` → Follow established patterns

   - `/home/jon/Nexus/frontend/web/src/components/jobEstimation/JobEstimationDashboard.tsx`
     - **Lines 1-100:** Component structure, state management
     - **Lines 44-70:** Customer context and pricing state
     - Study how `estimatePreviewData` is managed (around line 69)
     - Note the existing button patterns and UI structure

3. **Estimate Data Structure:**
   - `/home/jon/Nexus/frontend/web/src/components/jobEstimation/types/index.ts`
     - Review `EstimateVersion` interface (lines 151-189)
     - This contains job info, customer data, status, totals

   - `/home/jon/Nexus/frontend/web/src/components/jobEstimation/core/layers/CalculationLayer.ts`
     - Review `EstimatePreviewData` interface (lines 32-44)
     - Review `EstimateLineItem` interface (lines 7-30)
     - This is the data structure you'll map to QuickBooks

4. **API Client Pattern:**
   - `/home/jon/Nexus/frontend/web/src/services/api.ts`
     - Study existing API methods (customers, jobs, estimates)
     - Note the error handling pattern
     - Follow the same pattern for QB methods

5. **NexusLite Reference (Proven Implementation):**
   - `/home/jon/NexusLite/Main.py`
     - **Lines 399-431:** `run_create_qb_estimate_via_backend()`
     - See how it builds the payload and calls `/api/create-estimate`
     - **Lines 432-436:** `go_to_qb_estimate()` - Opens QB estimate in browser

   - `/home/jon/NexusLite/backend/server.py`
     - **Lines 189-305:** `handle_create_estimate()` - Backend estimate creation
     - **Lines 555-568:** `resolve_qb_ref()` - ID lookup with caching pattern
     - This shows the complete flow: lookup IDs → build payload → create estimate

---

## Phase 2 Implementation Tasks

### **Task 1: Add QuickBooks Service to Frontend API Client**

**File to Modify:** `/home/jon/Nexus/frontend/web/src/services/api.ts`

**What to Add:**

```typescript
// QuickBooks Integration API Methods
export const quickbooksApi = {
  // Check connection status
  async getStatus(): Promise<{
    connected: boolean;
    realmId?: string;
    environment?: string;
    tokenExpiresAt?: string;
    message: string;
  }> {
    const response = await apiClient.get('/quickbooks/status');
    return response.data;
  },

  // Check if QB credentials are configured
  async getConfigStatus(): Promise<{
    configured: boolean;
    errors: string[];
    environment: string;
  }> {
    const response = await apiClient.get('/quickbooks/config-status');
    return response.data;
  },

  // Initiate OAuth flow (opens QB authorization in new window)
  async startAuth(): Promise<void> {
    // Open in new window
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${apiClient.defaults.baseURL}/quickbooks/start-auth`,
      'QuickBooks Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  },

  // Disconnect from QuickBooks
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/quickbooks/disconnect');
    return response.data;
  },

  // Create estimate in QuickBooks
  async createEstimate(estimateData: {
    estimateId: number;
    estimatePreviewData: any; // Will be EstimatePreviewData from CalculationLayer
  }): Promise<{
    success: boolean;
    qbEstimateId?: string;
    qbDocNumber?: string;
    qbEstimateUrl?: string;
    error?: string;
  }> {
    const response = await apiClient.post('/quickbooks/create-estimate', estimateData);
    return response.data;
  }
};
```

**Pattern to Follow:** Look at existing APIs in the same file (e.g., `customerApi`, `jobVersioningApi`)

---

### **Task 2: Add QuickBooks UI to Job Estimation Dashboard**

**File to Modify:** `/home/jon/Nexus/frontend/web/src/components/jobEstimation/JobEstimationDashboard.tsx`

#### **2a. Add State Management (near line 40)**

```typescript
// QuickBooks integration state
const [qbConnected, setQbConnected] = useState(false);
const [qbRealmId, setQbRealmId] = useState<string | null>(null);
const [qbCheckingStatus, setQbCheckingStatus] = useState(true);
const [qbCreatingEstimate, setQbCreatingEstimate] = useState(false);
```

#### **2b. Add Status Check Effect (after existing useEffect hooks)**

```typescript
// Check QuickBooks connection status on mount
useEffect(() => {
  checkQBConnectionStatus();
}, []);

const checkQBConnectionStatus = async () => {
  try {
    setQbCheckingStatus(true);
    const status = await quickbooksApi.getStatus();
    setQbConnected(status.connected);
    setQbRealmId(status.realmId || null);
  } catch (error) {
    console.error('Error checking QB status:', error);
    setQbConnected(false);
  } finally {
    setQbCheckingStatus(false);
  }
};
```

#### **2c. Add QB Connect/Disconnect Handlers**

```typescript
const handleConnectToQuickBooks = async () => {
  try {
    // Check if credentials are configured first
    const configStatus = await quickbooksApi.getConfigStatus();

    if (!configStatus.configured) {
      alert('QuickBooks credentials not configured. Please contact administrator.');
      return;
    }

    // Open OAuth window
    await quickbooksApi.startAuth();

    // Poll for connection status (OAuth happens in popup)
    const pollInterval = setInterval(async () => {
      const status = await quickbooksApi.getStatus();
      if (status.connected) {
        setQbConnected(true);
        setQbRealmId(status.realmId || null);
        clearInterval(pollInterval);
        alert('✅ Connected to QuickBooks successfully!');
      }
    }, 2000); // Check every 2 seconds

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);

  } catch (error) {
    console.error('Error connecting to QuickBooks:', error);
    alert('Failed to connect to QuickBooks. Please try again.');
  }
};

const handleDisconnectFromQuickBooks = async () => {
  if (!confirm('Disconnect from QuickBooks? You will need to reconnect to create estimates.')) {
    return;
  }

  try {
    const result = await quickbooksApi.disconnect();
    if (result.success) {
      setQbConnected(false);
      setQbRealmId(null);
      alert('✅ Disconnected from QuickBooks');
    }
  } catch (error) {
    console.error('Error disconnecting from QuickBooks:', error);
    alert('Failed to disconnect. Please try again.');
  }
};
```

#### **2d. Add Create QB Estimate Handler**

```typescript
const handleCreateQuickBooksEstimate = async () => {
  if (!currentEstimate || !estimatePreviewData) {
    alert('No estimate data available. Please ensure estimate is loaded.');
    return;
  }

  // Only allow finalized estimates to be sent to QB
  if (currentEstimate.is_draft) {
    alert('Please finalize the estimate before creating in QuickBooks.');
    return;
  }

  try {
    setQbCreatingEstimate(true);

    const result = await quickbooksApi.createEstimate({
      estimateId: currentEstimate.id,
      estimatePreviewData: estimatePreviewData,
    });

    if (result.success && result.qbEstimateUrl) {
      alert(`✅ Estimate created in QuickBooks!\nDoc #: ${result.qbDocNumber}`);

      // Open QB estimate in new tab
      window.open(result.qbEstimateUrl, '_blank');
    } else {
      alert(`❌ Failed to create estimate: ${result.error || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('Error creating QB estimate:', error);
    alert(`❌ Failed to create estimate in QuickBooks:\n${error.message || 'Unknown error'}`);
  } finally {
    setQbCreatingEstimate(false);
  }
};
```

#### **2e. Add UI Elements (in the render section)**

**Location:** Find the section with action buttons (likely near where you have "Create New Version", "Finalize", etc.)

**Add this button group:**

```tsx
{/* QuickBooks Integration Section */}
{!isInBuilderMode && selectedEstimateId && currentEstimate && (
  <div style={{
    borderTop: '1px solid #ddd',
    marginTop: '20px',
    paddingTop: '20px'
  }}>
    <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>
      QuickBooks Integration
    </h3>

    {qbCheckingStatus ? (
      <div style={{ color: '#666' }}>Checking QuickBooks connection...</div>
    ) : qbConnected ? (
      <div>
        <div style={{
          color: '#2e7d32',
          fontSize: '14px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✅</span>
          <span>Connected to QuickBooks</span>
          {qbRealmId && (
            <span style={{ color: '#666', fontSize: '12px' }}>
              (Company ID: {qbRealmId.substring(0, 8)}...)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleCreateQuickBooksEstimate}
            disabled={qbCreatingEstimate || currentEstimate.is_draft}
            style={{
              padding: '10px 20px',
              backgroundColor: currentEstimate.is_draft ? '#ccc' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentEstimate.is_draft ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            title={currentEstimate.is_draft ? 'Finalize estimate first' : 'Create estimate in QuickBooks'}
          >
            {qbCreatingEstimate ? '⏳ Creating in QB...' : '📤 Create QB Estimate'}
          </button>

          <button
            onClick={handleDisconnectFromQuickBooks}
            disabled={qbCreatingEstimate}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🔌 Disconnect QB
          </button>
        </div>

        {currentEstimate.is_draft && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#d32f2f',
            fontStyle: 'italic'
          }}>
            ℹ️ Finalize this estimate before creating in QuickBooks
          </div>
        )}
      </div>
    ) : (
      <div>
        <div style={{
          color: '#d32f2f',
          fontSize: '14px',
          marginBottom: '10px'
        }}>
          ⚠️ Not connected to QuickBooks
        </div>

        <button
          onClick={handleConnectToQuickBooks}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          🔗 Connect to QuickBooks
        </button>
      </div>
    )}
  </div>
)}
```

**Where to Place This:** Look for the section in the render that shows estimate actions. It's likely in a panel or card on the right side when an estimate is selected. Place this QB section below other action buttons.

---

### **Task 3: Create Backend Estimate Creation Route**

**File to Create:** `/home/jon/Nexus/backend/web/src/routes/quickbooks.ts` (already exists, add to it)

**What to Add:** Add this new route to the existing file (after the `/disconnect` route):

```typescript
/**
 * POST /api/quickbooks/create-estimate
 * Create estimate in QuickBooks from Nexus estimate data
 */
router.post('/create-estimate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { estimateId, estimatePreviewData } = req.body;

    if (!estimateId || !estimatePreviewData) {
      return res.status(400).json({
        success: false,
        error: 'Missing estimateId or estimatePreviewData',
      });
    }

    const realmId = await getDefaultRealmId();
    if (!realmId) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to QuickBooks. Please connect first.',
      });
    }

    // Import QB API functions
    const {
      createEstimate,
      getCustomerIdByName,
      getTaxCodeIdByName,
      getItemIdByName,
      getEstimatePdfUrl,
    } = await import('../utils/quickbooks/apiClient');

    const {
      getQBCustomerIdByLocalId,
      getQBCustomerIdByName,
      storeCustomerMapping,
      getQBTaxCodeId,
      storeTaxCodeMapping,
      getQBItemId,
      storeItemMapping,
    } = await import('../utils/quickbooks/dbManager');

    // Get estimate details from database to get customer_id
    const { pool } = await import('../config/database');
    const [estimateRows] = await pool.execute<RowDataPacket[]>(
      `SELECT customer_id, job_id FROM job_estimates WHERE id = ?`,
      [estimateId]
    );

    if (estimateRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found',
      });
    }

    const { customer_id } = estimateRows[0];

    // 1. RESOLVE CUSTOMER ID (with caching)
    let qbCustomerId = await getQBCustomerIdByLocalId(customer_id);

    if (!qbCustomerId) {
      // Not in cache, lookup in QuickBooks
      console.log(`Looking up customer in QB: ${estimatePreviewData.customerName}`);
      qbCustomerId = await getCustomerIdByName(estimatePreviewData.customerName, realmId);

      if (!qbCustomerId) {
        return res.status(400).json({
          success: false,
          error: `Customer "${estimatePreviewData.customerName}" not found in QuickBooks`,
        });
      }

      // Cache it for next time
      await storeCustomerMapping({
        customer_id,
        qb_customer_id: qbCustomerId,
        qb_customer_name: estimatePreviewData.customerName,
      });
      console.log(`✅ Cached customer mapping: ${customer_id} → ${qbCustomerId}`);
    } else {
      console.log(`✅ Using cached customer ID: ${qbCustomerId}`);
    }

    // 2. RESOLVE TAX CODE (with caching)
    // Convert tax rate to tax code name (e.g., 0.13 → "HST 13%")
    const taxRatePercent = (estimatePreviewData.taxRate * 100).toFixed(0);
    const taxCodeName = `HST ${taxRatePercent}%`; // Adjust format to match your QB tax codes

    let qbTaxCodeId = await getQBTaxCodeId(taxCodeName);

    if (!qbTaxCodeId) {
      console.log(`Looking up tax code in QB: ${taxCodeName}`);
      qbTaxCodeId = await getTaxCodeIdByName(taxCodeName, realmId);

      if (!qbTaxCodeId) {
        // Fallback to "TAX" or "Taxable" - common default
        qbTaxCodeId = await getTaxCodeIdByName('TAX', realmId);
        if (!qbTaxCodeId) {
          return res.status(400).json({
            success: false,
            error: `Tax code "${taxCodeName}" not found in QuickBooks`,
          });
        }
      }

      await storeTaxCodeMapping({
        tax_name: taxCodeName,
        qb_tax_code_id: qbTaxCodeId,
        tax_rate: estimatePreviewData.taxRate,
      });
      console.log(`✅ Cached tax code mapping: ${taxCodeName} → ${qbTaxCodeId}`);
    } else {
      console.log(`✅ Using cached tax code ID: ${qbTaxCodeId}`);
    }

    // 3. BUILD LINE ITEMS (with item ID caching)
    const lines = [];

    for (const item of estimatePreviewData.items) {
      // Skip subtotal items (productTypeId 21)
      if (item.productTypeId === 21) {
        continue;
      }

      // Resolve item ID (with caching)
      let qbItemId = await getQBItemId(item.itemName);

      if (!qbItemId) {
        console.log(`Looking up item in QB: ${item.itemName}`);
        qbItemId = await getItemIdByName(item.itemName, realmId);

        if (!qbItemId) {
          console.warn(`⚠️  Item "${item.itemName}" not found in QB, skipping line`);
          continue; // Skip this line item
        }

        await storeItemMapping({
          item_name: item.itemName,
          qb_item_id: qbItemId,
        });
        console.log(`✅ Cached item mapping: ${item.itemName} → ${qbItemId}`);
      } else {
        console.log(`✅ Using cached item ID for ${item.itemName}: ${qbItemId}`);
      }

      lines.push({
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: {
            value: qbItemId,
            name: item.itemName,
          },
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
          TaxCodeRef: {
            value: qbTaxCodeId,
          },
        },
        Amount: item.extendedPrice,
        Description: item.description || item.calculationDisplay || '',
      });
    }

    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid line items found. Ensure items exist in QuickBooks.',
      });
    }

    // 4. CREATE ESTIMATE IN QUICKBOOKS
    const qbPayload = {
      CustomerRef: { value: qbCustomerId },
      TxnDate: new Date().toISOString().split('T')[0], // Today's date YYYY-MM-DD
      Line: lines,
    };

    console.log(`📤 Creating estimate in QB with ${lines.length} line items...`);
    const result = await createEstimate(qbPayload, realmId);

    const qbEstimateUrl = getEstimatePdfUrl(result.estimateId, realmId);

    console.log(`✅ QB Estimate created: ID=${result.estimateId}, Doc#=${result.docNumber}`);

    res.json({
      success: true,
      qbEstimateId: result.estimateId,
      qbDocNumber: result.docNumber,
      qbEstimateUrl,
      linesCreated: lines.length,
    });
  } catch (error) {
    console.error('❌ Error creating QB estimate:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create estimate',
    });
  }
});
```

**Import Statement to Add at Top of File:**

```typescript
import { RowDataPacket } from 'mysql2';
```

---

### **Task 4: Test and Debug**

**Testing Checklist:**

1. **QB Connection Test:**
   - [ ] Click "Connect to QuickBooks" button
   - [ ] OAuth window opens
   - [ ] After authorization, status changes to "Connected"
   - [ ] Realm ID displays correctly
   - [ ] Backend logs show token storage

2. **Disconnect Test:**
   - [ ] Click "Disconnect QB" button
   - [ ] Status changes to "Not connected"
   - [ ] Database `qb_oauth_tokens` table is cleared

3. **Estimate Creation Test:**
   - [ ] Select a finalized estimate
   - [ ] "Create QB Estimate" button is enabled
   - [ ] Click button
   - [ ] Backend logs show:
     - Customer ID lookup/cache
     - Tax code ID lookup/cache
     - Item ID lookups/cache
     - Estimate creation success
   - [ ] QB estimate opens in new tab
   - [ ] Verify data matches in QuickBooks

4. **Edge Cases:**
   - [ ] Draft estimate: Button should be disabled
   - [ ] Missing customer in QB: Shows error message
   - [ ] Missing item in QB: Skips line, logs warning
   - [ ] Token expired: Auto-refreshes and retries

**Debug Locations:**

- Frontend console: `console.log` in handlers
- Backend logs: `pm2 logs signhouse-backend`
- Database check:
  ```sql
  SELECT * FROM qb_oauth_tokens;
  SELECT * FROM qb_customer_id_mappings;
  SELECT * FROM qb_tax_code_mappings;
  SELECT * FROM qb_item_mappings;
  ```

---

## Important Implementation Notes

### **Architecture Compliance:**

1. **Follow CLAUDE.md Guidelines:**
   - Research existing patterns FIRST
   - Propose changes BEFORE implementing
   - Keep files under 500 lines
   - Use existing error handling patterns

2. **Match Existing Patterns:**
   - Look at how other APIs are called in `JobEstimationDashboard.tsx`
   - Follow the button styling used elsewhere
   - Match the notification/alert pattern
   - Use similar state management approach

3. **Error Handling:**
   - Always wrap API calls in try/catch
   - Show user-friendly error messages
   - Log errors to console
   - Don't crash on failures

### **Data Mapping Notes:**

**EstimatePreviewData → QuickBooks Estimate:**

```typescript
// Nexus Structure (from CalculationLayer.ts)
interface EstimatePreviewData {
  items: EstimateLineItem[];  // Map to QB Line items
  subtotal: number;           // QB calculates this
  taxRate: number;            // Convert to tax code lookup
  taxAmount: number;          // QB calculates this
  total: number;              // QB calculates this
  customerName: string;       // Lookup QB customer ID
}

interface EstimateLineItem {
  itemName: string;           // Lookup QB item ID
  description: string;        // QB Line Description
  quantity: number;           // QB Qty
  unitPrice: number;          // QB UnitPrice
  extendedPrice: number;      // QB Amount
  productTypeId: number;      // Skip if 21 (Subtotal)
}
```

**QuickBooks expects:**

```typescript
{
  CustomerRef: { value: "123" },  // QB customer ID
  TxnDate: "2025-10-27",         // ISO date
  Line: [
    {
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: "456", name: "Channel Letters" },
        Qty: 8,
        UnitPrice: 45.00,
        TaxCodeRef: { value: "TAX" }
      },
      Amount: 360.00,
      Description: "8 Letters × $45/letter"
    }
  ]
}
```

### **Common Pitfalls to Avoid:**

1. ❌ **Don't** create QB items automatically - they must exist in QB first
2. ❌ **Don't** forget to cache ID mappings - reduces API calls dramatically
3. ❌ **Don't** send draft estimates to QB - only finalized ones
4. ❌ **Don't** include subtotal rows (productTypeId 21) in QB line items
5. ✅ **Do** handle missing customers/items gracefully with clear errors
6. ✅ **Do** test with QB sandbox first before production
7. ✅ **Do** log all lookups and cache hits for debugging

---

## Success Criteria

Phase 2 is complete when:

- [ ] "Connect to QuickBooks" button works and shows connection status
- [ ] "Create QB Estimate" button only enabled for finalized estimates
- [ ] Clicking create button:
  - [ ] Maps all estimate data correctly
  - [ ] Looks up and caches customer/tax/item IDs
  - [ ] Creates estimate in QuickBooks
  - [ ] Opens QB estimate in new tab
- [ ] ID mappings are cached in database
- [ ] Error messages are user-friendly
- [ ] All TypeScript compiles without errors
- [ ] No console errors in browser
- [ ] Backend logs show successful flow

---

## Reference Documentation

- **QuickBooks API Docs:** https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/estimate
- **Phase 1 Summary:** `/home/jon/Nexus/QUICKBOOKS_INTEGRATION_PHASE1.md`
- **NexusLite Example:** `/home/jon/NexusLite/` (working implementation)
- **Project Guidelines:** `/home/jon/Nexus/CLAUDE.md`

---

## Final Notes

This is a production system. Follow the established patterns, test thoroughly, and communicate any uncertainties before implementing. The goal is seamless integration that feels native to the Nexus job estimation workflow.

**Good luck with Phase 2!** 🚀
