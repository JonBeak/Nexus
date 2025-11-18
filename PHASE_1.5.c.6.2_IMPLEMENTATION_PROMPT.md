# Phase 1.5.c.6.2: Prepare Steps Implementation

## 🎯 Objective
Implement all 6 preparation step components with full functionality including QB estimate creation, PDF generation, staleness detection, and live PDF previews. This phase builds on the core infrastructure from Phase 1.5.c.6.1.

---

## 📋 Context: What's Already Complete (Phase 1.5.c.6.1)

### ✅ Database Schema
- `order_qb_estimates` table created with staleness detection support
- Columns: `id`, `order_id`, `qb_estimate_id`, `qb_estimate_number`, `created_at`, `created_by`, `is_current`, `estimate_data_hash`, `qb_estimate_url`

### ✅ Type Definitions
- **Backend:** `/backend/web/src/types/orderPreparation.ts`
  - QBEstimateRecord, StalenessCheckResult, StepResult, etc.
- **Frontend:** `/frontend/web/src/types/orderPreparation.ts`
  - PrepareStep, PreparationState, QBEstimateInfo, PDFPreview, etc.

### ✅ Step Orchestration
- **File:** `/frontend/web/src/utils/stepOrchestration.ts`
- Functions: `canRunStep()`, `updateStepStatus()`, `calculateProgress()`, `areRequiredStepsComplete()`, `initializeSteps()`

### ✅ Modal Shell
- **File:** `/frontend/web/src/components/orders/preparation/PrepareOrderModal.tsx`
- Two-phase modal (Prepare → Send) with phase transition logic
- Split-view layout (40% left, 60% right for PDF previews)
- Ready for step components to be plugged in

### ✅ Integration
- "Prepare Order" button added to OrderHeader (shows when status = `job_details_setup`)
- Modal integrated with OrderDetailsPage
- Backend and frontend build successfully with no errors

---

## 🏗️ Architecture & Existing Patterns

### QuickBooks Integration (FULLY WORKING)
**Location:** `/backend/web/src/utils/quickbooks/apiClient.ts`
- `createEstimate(estimatePayload, realmId)` - Creates QB estimate (line 283)
- `getEstimatePdfUrl(estimateId, realmId)` - Gets PDF URL from QB
- OAuth tokens managed automatically

**QuickBooks Repository:** `/backend/web/src/repositories/quickbooksRepository.ts`
- `getCustomerIdByNexusId(customerId)` - Maps Nexus customer to QB customer
- `getBatchQBItemMappings(productTypes)` - Maps product types to QB items
- `getTaxCodeByName(taxName)` - Maps tax names to QB tax codes

**QuickBooks Service:** `/backend/web/src/services/quickbooksService.ts`
- Contains estimate creation orchestration logic for job estimates
- We'll create similar service for orders

### PDF Generation (FULLY WORKING)
**Location:** `/backend/web/src/services/pdf/pdfGenerationService.ts`
- `generateAllForms(options)` - Generates all order form PDFs (line 100)
- Saves PDFs to SMB share in order folders
- Returns `FormPaths` with URLs to all generated PDFs

### Database Query Pattern
**Always use:** `query()` helper from `/backend/web/src/config/database.ts`
```typescript
import { query } from '../config/database';
const rows = await query('SELECT * FROM table WHERE id = ?', [id]) as RowDataPacket[];
```

### 3-Layer Architecture (MANDATORY)
```
Route → Controller → Service → Repository → Database
```
- **Routes:** HTTP routing, middleware chains only
- **Controllers:** Request/response handling, data extraction
- **Services:** Business logic, orchestration, calculations
- **Repositories:** Database queries only, no business logic

---

## 📦 Implementation Plan (Phase 1.5.c.6.2)

### Part 1: Backend Services & Routes (4-5 hours)

#### 1.1 Create QB Estimate Service for Orders
**File:** `/backend/web/src/services/qbEstimateService.ts` (NEW)

**Key Methods:**
```typescript
class QBEstimateService {
  // Check if QB estimate is stale (order data changed since estimate created)
  async checkEstimateStaleness(orderId: number): Promise<StalenessCheckResult>

  // Create QB estimate from order
  async createEstimateFromOrder(orderId: number, userId: number): Promise<{
    estimateId: string;
    estimateNumber: string;
    dataHash: string;
  }>

  // Download QB estimate PDF
  async downloadEstimatePDF(qbEstimateId: string, orderNumber: number): Promise<{
    pdfUrl: string;
    pdfBuffer: Buffer;
  }>

  // Calculate hash of order parts for staleness detection
  private async calculateOrderDataHash(orderId: number): Promise<string>

  // Map order to QuickBooks estimate format
  private async mapOrderToQBEstimate(order, parts, qbCustomerId): Promise<QBEstimatePayload>

  // Get order data and parts
  private async getOrderData(orderId: number)
  private async getOrderParts(orderId: number)
}
```

**Implementation Details:**
- Use SHA256 hash of order parts data (JSON.stringify) for staleness detection
- Query `order_qb_estimates` table to get current estimate
- Mark previous estimates as `is_current = FALSE` when creating new estimate
- Reuse existing QB API client functions: `createEstimate()` from `/backend/web/src/utils/quickbooks/apiClient.ts`
- Filter invoice parts only (parts with `invoice_description` or `unit_price`)
- Get QB customer ID using `quickbooksRepository.getCustomerIdByNexusId()`
- Get QB item mappings using `quickbooksRepository.getBatchQBItemMappings()`

**Reference Existing Pattern:**
See `/backend/web/src/services/quickbooksService.ts` (line 150+) for similar estimate creation logic

---

#### 1.2 Create Order Preparation Repository
**File:** `/backend/web/src/repositories/orderPreparationRepository.ts` (NEW)

**Key Methods:**
```typescript
class OrderPreparationRepository {
  // QB Estimates
  async getCurrentQBEstimate(orderId: number): Promise<QBEstimateRecord | null>
  async createQBEstimateRecord(data: {...}): Promise<number>
  async markPreviousEstimatesNotCurrent(orderId: number): Promise<void>

  // Order Parts (for hash calculation)
  async getOrderPartsForHash(orderId: number): Promise<any[]>

  // Point Persons (for Phase 1.5.c.6.3)
  async getOrderPointPersons(orderNumber: number): Promise<OrderPointPerson[]>
}
```

---

#### 1.3 Create Backend Routes
**File:** `/backend/web/src/routes/orderPreparation.ts` (NEW)

**Endpoints to Create:**
```typescript
// QB Estimate
GET    /api/orders/:orderNumber/qb-estimate/staleness
POST   /api/orders/:orderNumber/qb-estimate

// PDFs
POST   /api/orders/:orderNumber/generate-order-form-pdf
POST   /api/orders/:orderNumber/download-qb-estimate-pdf
POST   /api/orders/:orderNumber/save-pdfs-to-folder

// Validation & Tasks (Placeholders)
GET    /api/orders/:orderNumber/validate-preparation
POST   /api/orders/:orderNumber/generate-tasks

// Point Persons (for Phase 1.5.c.6.3)
GET    /api/orders/:orderNumber/point-persons
```

**Register Routes:**
Add to `/backend/web/src/server.ts`:
```typescript
import orderPreparationRoutes from './routes/orderPreparation';
app.use('/api/orders', orderPreparationRoutes);
```

---

#### 1.4 Create Backend Controllers
**File:** `/backend/web/src/controllers/orderPreparationController.ts` (NEW)

**Controllers to Create:**
- `checkQBEstimateStaleness` - Check if estimate is stale
- `createQBEstimate` - Create new QB estimate
- `generateOrderFormPDF` - Generate order form PDF (wrapper around pdfGenerationService)
- `downloadQBEstimatePDF` - Download QB estimate PDF
- `savePDFsToFolder` - Save PDFs to SMB folder
- `validateForPreparation` - Placeholder (always returns success)
- `generateProductionTasks` - Placeholder (always returns success)

---

### Part 2: Frontend Step Components (4-5 hours)

#### 2.1 Create Common UI Components
**Directory:** `/frontend/web/src/components/orders/preparation/common/`

**Files to Create:**
1. `StepCard.tsx` - Wrapper for each step with status badge
2. `StepButton.tsx` - Action button with loading/completed/failed states
3. `StepStatusBadge.tsx` - Visual status indicator (pending/running/completed/failed)
4. `ProgressBar.tsx` - Overall progress indicator

**Reference V3 spec** (lines 820-1031 in `Nexus_Orders_Phase1.5c.6.2_PrepareSteps.md`) for exact component code

---

#### 2.2 Create Individual Step Components
**Directory:** `/frontend/web/src/components/orders/preparation/steps/`

**Files to Create:**

1. **ValidationStep.tsx** (Placeholder - always passes)
   - Shows placeholder message
   - Simulates 1 second delay
   - Updates step status to completed

2. **QBEstimateStep.tsx** (FULL IMPLEMENTATION)
   - Check staleness on mount
   - Display QB estimate info (exists, number, created date, staleness warning)
   - "Create QB Estimate" / "Recreate QB Estimate" button
   - "Open in QuickBooks" link (external)
   - Handle staleness warning with AlertTriangle icon

3. **GeneratePDFsStep.tsx**
   - Call `/api/orders/:orderNumber/generate-order-form-pdf`
   - Update `preparationState.pdfs.orderForm` with URL
   - Show success message: "PDF generated successfully (visible in preview panel →)"

4. **DownloadQBPDFStep.tsx**
   - Requires QB estimate to exist (dependency check)
   - Call `/api/orders/:orderNumber/download-qb-estimate-pdf`
   - Update `preparationState.pdfs.qbEstimate` with URL
   - Show success message

5. **SaveToFolderStep.tsx**
   - Requires both PDFs to be generated (dependency check)
   - Call `/api/orders/:orderNumber/save-pdfs-to-folder`
   - Show success message with Folder icon

6. **GenerateTasksStep.tsx** (Placeholder for Phase 1.5.d)
   - Shows placeholder message
   - Simulates 1.5 second delay
   - Updates step status to completed

**Each step component should:**
- Use `StepCard` wrapper
- Use `StepButton` for action
- Call API via `ordersApi` (to be created)
- Update `preparationState` via `onStateChange` callback
- Use `updateStepStatus()` utility for status changes
- Handle loading/error states properly

---

#### 2.3 Create Step List Component
**File:** `/frontend/web/src/components/orders/preparation/StepList.tsx` (NEW)

**Purpose:** Maps steps to their components
```typescript
const getStepComponent = (step: PrepareStep) => {
  switch (step.id) {
    case 'validation': return <ValidationStep {...commonProps} />;
    case 'create_qb_estimate': return <QBEstimateStep {...commonProps} qbEstimate={qbEstimate} />;
    case 'generate_pdfs': return <GeneratePDFsStep {...commonProps} />;
    case 'download_qb_pdf': return <DownloadQBPDFStep {...commonProps} qbEstimate={qbEstimate} />;
    case 'save_to_folder': return <SaveToFolderStep {...commonProps} />;
    case 'generate_tasks': return <GenerateTasksStep {...commonProps} />;
  }
};
```

---

#### 2.4 Create Prepare Steps Panel
**File:** `/frontend/web/src/components/orders/preparation/PrepareStepsPanel.tsx` (NEW)

**Purpose:** Main container for left panel in "prepare" phase
- Displays ProgressBar
- Renders StepList
- Renders QuickActions ("Do All Steps" button)
- Manages step execution flow

---

#### 2.5 Create Live PDF Preview Panel
**File:** `/frontend/web/src/components/orders/preparation/LivePDFPreviewPanel.tsx` (NEW)

**Purpose:** Right panel showing PDF previews
- Order Form preview (landscape, 500px height)
- QB Estimate preview (portrait, 600px height)
- Loading states with spinner
- Error states
- "Not generated yet" placeholder states

**Use iframes for PDF display:**
```typescript
<iframe
  src={pdfUrl}
  className="w-full h-[500px]"
  title="Order Form Preview"
/>
```

---

#### 2.6 Create Quick Actions Component
**File:** `/frontend/web/src/components/orders/preparation/QuickActions.tsx` (NEW)

**Purpose:** "Do All Steps" button
- Disabled when all complete or some running
- Runs all pending steps in optimal order (respecting dependencies)
- Uses parallel execution where possible

---

#### 2.7 Update PrepareOrderModal
**File:** `/frontend/web/src/components/orders/preparation/PrepareOrderModal.tsx` (MODIFY)

**Changes Needed:**
1. Import new components: `PrepareStepsPanel`, `LivePDFPreviewPanel`
2. Add QB estimate staleness check on mount
3. Replace placeholder sections with actual components:
   - Left panel (prepare phase): `<PrepareStepsPanel />`
   - Right panel: `<LivePDFPreviewPanel />`

---

#### 2.8 Create Frontend API Methods
**File:** `/frontend/web/src/services/api/orderPreparationApi.ts` (NEW)

**Methods to Create:**
```typescript
export const orderPreparationApi = {
  checkQBEstimateStaleness(orderNumber: number),
  createQBEstimate(orderNumber: number),
  generateOrderFormPDF(orderNumber: number),
  downloadQBEstimatePDF(qbEstimateId: string, orderNumber: number),
  savePDFsToFolder(orderNumber: number),
  validateForPreparation(orderNumber: number),
  generateProductionTasks(orderNumber: number)
};
```

**Export in main API:**
Modify `/frontend/web/src/services/api/index.ts`:
```typescript
import { orderPreparationApi } from './orderPreparationApi';
export const ordersApi = {
  ...existingMethods,
  ...orderPreparationApi
};
```

---

## 🔍 Implementation Order (Recommended)

### Phase A: Backend Foundation (2-3 hours)
1. Create `orderPreparationRepository.ts`
2. Create `qbEstimateService.ts`
3. Create `orderPreparationController.ts`
4. Create `orderPreparation.ts` routes
5. Register routes in `server.ts`
6. Test endpoints with curl/Postman

### Phase B: Frontend Common Components (1 hour)
7. Create `StepCard.tsx`
8. Create `StepButton.tsx`
9. Create `StepStatusBadge.tsx`
10. Create `ProgressBar.tsx`

### Phase C: Frontend Step Components (2-3 hours)
11. Create `ValidationStep.tsx`
12. Create `QBEstimateStep.tsx`
13. Create `GeneratePDFsStep.tsx`
14. Create `DownloadQBPDFStep.tsx`
15. Create `SaveToFolderStep.tsx`
16. Create `GenerateTasksStep.tsx`

### Phase D: Frontend Integration (2 hours)
17. Create `StepList.tsx`
18. Create `PrepareStepsPanel.tsx`
19. Create `LivePDFPreviewPanel.tsx`
20. Create `QuickActions.tsx`
21. Create `orderPreparationApi.ts`
22. Update `PrepareOrderModal.tsx`

### Phase E: Testing & Refinement (1-2 hours)
23. Build backend and frontend
24. Test full workflow end-to-end
25. Fix any bugs or TypeScript errors

---

## 🧪 Testing Checklist

### Backend Testing
```bash
# Check QB estimate staleness
curl -H "Authorization: Bearer $TOKEN" \
  http://192.168.2.14:3001/api/orders/200077/qb-estimate/staleness

# Create QB estimate
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://192.168.2.14:3001/api/orders/200077/qb-estimate

# Generate order form PDF
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://192.168.2.14:3001/api/orders/200077/generate-order-form-pdf
```

### Frontend Testing
1. Open order #200077 (or any order with `job_details_setup` status)
2. Click "Prepare Order" button
3. Verify all 6 steps display correctly
4. Run Step 1 (Validation) - should complete in ~1 second
5. Run Step 2 (Create QB Estimate) - should:
   - Create estimate in QuickBooks
   - Store in `order_qb_estimates` table
   - Display estimate number and created date
   - Show "Open in QuickBooks" link
6. Run Step 3 (Generate PDFs) - should:
   - Generate order form PDF
   - Display PDF in right preview panel
7. Run Step 4 (Download QB PDF) - should:
   - Download PDF from QuickBooks
   - Display in right preview panel below order form
8. Run Step 5 (Save to Folder) - should complete successfully
9. Run Step 6 (Generate Tasks) - should complete in ~1.5 seconds
10. Click "Next: Send to Customer" - should be enabled after steps 2-5 complete
11. Test "Do All Steps" button - should run all steps sequentially

### Staleness Testing
1. Create QB estimate for an order
2. Modify order parts in database (change quantity or price)
3. Reload PrepareOrderModal
4. Verify staleness warning shows with AlertTriangle icon
5. Recreate estimate
6. Verify warning disappears

---

## 📊 Database Queries for Debugging

```sql
-- Check QB estimates
SELECT * FROM order_qb_estimates WHERE order_id = (
  SELECT order_id FROM orders WHERE order_number = 200077
);

-- Check order parts (for hash calculation)
SELECT part_id, invoice_description, quantity, unit_price, extended_price
FROM order_parts
WHERE order_id = (SELECT order_id FROM orders WHERE order_number = 200077)
ORDER BY part_number;

-- Check point persons (for Phase 1.5.c.6.3)
SELECT * FROM order_point_persons WHERE order_id = (
  SELECT order_id FROM orders WHERE order_number = 200077
);
```

---

## 🎯 Success Criteria

Phase 1.5.c.6.2 is **COMPLETE** when:

1. ✅ All 6 step components implemented and functional
2. ✅ QB estimate creation works with staleness detection
3. ✅ QB estimate warning shows when data changes
4. ✅ PDF generation works and displays in preview panel
5. ✅ QB PDF download works and displays in preview panel
6. ✅ Save to folder completes successfully
7. ✅ Step dependencies respected (can't run step 4 before step 2)
8. ✅ Individual step buttons work (run, re-run, show status)
9. ✅ "Do All Steps" button runs steps in optimal order
10. ✅ Progress bar updates correctly
11. ✅ "Next: Send to Customer" button enables after required steps (2-5) complete
12. ✅ No TypeScript errors
13. ✅ No console errors
14. ✅ Backend and frontend build successfully

---

## 📚 Key Files Reference

### Existing Files to Study
- `/backend/web/src/services/quickbooksService.ts` - QB estimate creation pattern
- `/backend/web/src/services/pdf/pdfGenerationService.ts` - PDF generation
- `/backend/web/src/utils/quickbooks/apiClient.ts` - QB API calls
- `/backend/web/src/repositories/quickbooksRepository.ts` - QB data access
- `/backend/web/src/config/database.ts` - Query helper

### Files Created in Phase 1.5.c.6.1
- `/backend/web/src/types/orderPreparation.ts`
- `/frontend/web/src/types/orderPreparation.ts`
- `/frontend/web/src/utils/stepOrchestration.ts`
- `/frontend/web/src/components/orders/preparation/PrepareOrderModal.tsx`

### Detailed Component Code
See `/home/jon/Nexus/Nexus_Orders_Phase1.5c.6.2_PrepareSteps.md` for exact component implementations

---

## 🚨 Important Notes

1. **ALWAYS use `query()` helper** - Never use `pool.execute()` directly
2. **Follow 3-layer architecture** - Route → Controller → Service → Repository
3. **QB OAuth is configured** - No need to set up OAuth, just use existing `createEstimate()` function
4. **PDF service exists** - Use existing `pdfGenerationService.generateAllForms()`
5. **Placeholders are OK** - Validation and task generation are placeholders for now
6. **Staleness is key** - Hash-based staleness detection prevents stale estimates
7. **Dependencies matter** - Use `canRunStep()` to check dependencies before running
8. **Error handling** - All API calls must have try/catch with proper error states

---

## 🎬 Ready to Start?

Follow the implementation order above, test thoroughly, and Phase 1.5.c.6.2 will be complete! Once done, we'll move to Phase 1.5.c.6.3 (Send to Customer).

**Estimated Total Time:** 10-12 hours
**Complexity:** High (QB integration, PDF handling, staleness detection)
**Dependencies:** Phase 1.5.c.6.1 (COMPLETE ✅)
