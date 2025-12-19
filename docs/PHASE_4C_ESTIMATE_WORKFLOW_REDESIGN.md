# Phase 4c: Estimate Workflow Redesign

## Overview

Redesign the job estimation workflow from a single-step "Create QB Estimate" flow to a two-step "Prepare to Send" → "Send to Customer" workflow. Includes layout changes, point person integration at the estimate level, and email composition functionality.

---

## New Workflow

### Before (Current)
```
[Create QB Estimate] → Creates in QB immediately → Locks grid → Done
```

### After (New)
```
[Prepare to Send] → Cleans empty rows → Saves point persons + email → Locks grid
        ↓
[Send to Customer] → Creates QB estimate → Downloads PDF → Sends email → Done
```

---

## Progress Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database migration | ✅ Complete |
| 2 | Backend repository & types | ✅ Complete |
| 3 | Backend service layer | ✅ Complete |
| 4 | Backend routes & controller | ✅ Complete |
| 5 | Frontend API | ✅ Complete |
| 6 | Layout CSS changes | ✅ Complete |
| 7 | EstimateTable + new components | ✅ Complete |
| 8 | Workflow hook redesign | ✅ Complete |
| 9 | EstimateEditorPage updates | ✅ Complete |
| 10 | Testing & verification | ⏳ Pending |

---

## Phase 1: Database Migration ✅

**File:** `/database/migrations/phase4c_estimate_workflow.sql`

### Changes Applied:
```sql
-- New table for estimate point persons
CREATE TABLE estimate_point_persons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  estimate_id INT NOT NULL,
  contact_id INT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NULL,
  contact_phone VARCHAR(50) NULL,
  contact_role VARCHAR(100) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES customer_contacts(contact_id) ON DELETE SET NULL
);

-- New columns on job_estimates
ALTER TABLE job_estimates
  ADD COLUMN is_prepared TINYINT(1) NOT NULL DEFAULT 0 AFTER is_draft,
  ADD COLUMN email_subject VARCHAR(500) NULL,
  ADD COLUMN email_body TEXT NULL;

-- Email template for estimates
INSERT INTO email_templates (template_key, template_name, subject, body, variables, is_active)
VALUES ('estimate_send', 'Estimate - Send to Customer', ...);
```

---

## Phase 2: Backend Repository & Types ✅

### New Files Created:
- `/backend/web/src/types/estimatePointPerson.ts` - Type definitions
- `/backend/web/src/repositories/estimatePointPersonRepository.ts` - Database access

### Types Defined:
```typescript
interface EstimatePointPerson { id, estimate_id, contact_id?, contact_email, ... }
interface CreateEstimatePointPersonData { ... }
interface EstimatePointPersonInput { contact_id?, contact_email, saveToDatabase?, ... }
interface PrepareEstimateRequest { emailSubject?, emailBody?, pointPersons? }
interface PrepareEstimateResult { success, estimateId, deletedRowCount, remainingRowCount }
interface SendEstimateResult { success, estimateId, qbEstimateId?, emailSentTo? }
```

### Repository Methods:
- `getPointPersonsByEstimateId(estimateId)`
- `createPointPerson(data, connection?)`
- `updatePointPersons(estimateId, pointPersons[], connection?)`
- `deletePointPersonsByEstimateId(estimateId, connection?)`
- `copyPointPersonsToOrder(estimateId, orderId, connection)` - For order conversion

### Extended `estimateRepository.ts`:
- `prepareEstimate(estimateId, userId, emailSubject?, emailBody?)`
- `checkEstimateIsPrepared(estimateId)`
- `getEstimateWithPreparedCheck(estimateId)`
- `updateEmailContent(estimateId, subject, body, userId)`
- `getEstimateEmailContent(estimateId)`
- `markEstimateAsSent(estimateId, userId, qbEstimateId?)`
- `getEstimateForSending(estimateId)`

---

## Phase 3: Backend Service Layer ✅

### New File Created:
- `/backend/web/src/services/estimate/estimateWorkflowService.ts`

### Key Methods:

#### `prepareEstimateForSending(estimateId, userId, request)`
1. Validates estimate is in draft mode
2. Cleans empty rows (keeps structural rows: Empty Row type 27, Subtotal type 21)
3. Saves point persons if provided
4. Sets `is_prepared=true, is_draft=false` (locks the estimate)
5. Saves email subject/body

#### `sendEstimateToCustomer(estimateId, userId, estimatePreviewData?)`
1. Validates estimate is prepared but not sent
2. Creates QB estimate (TODO: integrate with quickbooksService)
3. Downloads PDF (TODO: integrate with qbEstimateService)
4. Sends email to point persons (TODO: integrate with gmailService)
5. Marks estimate as sent

### Row Cleanup Logic:
```typescript
// Structural row types that are KEPT even if empty
const STRUCTURAL_ROW_TYPES = [21, 27]; // Subtotal, Empty Row

// Rows are DELETED if:
// - No product type AND no field data in field1-field12 or quantity
```

### Service Chain:
```
EstimateVersioningService (facade)
  → EstimateService (facade)
    → EstimateWorkflowService (implementation)
      → EstimateRepository
      → EstimatePointPersonRepository
```

---

## Phase 4: Backend Routes & Controller ✅

### New Endpoints:

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/estimates/template/send-email` | Get email template for estimates |
| POST | `/estimates/:id/prepare` | Prepare estimate for sending |
| POST | `/estimates/:id/send-to-customer` | Send estimate to customer |
| GET | `/estimates/:id/point-persons` | Get point persons |
| PUT | `/estimates/:id/point-persons` | Update point persons |
| GET | `/estimates/:id/email-content` | Get email subject/body |
| PUT | `/estimates/:id/email-content` | Update email subject/body |

### Controller Methods Added to `estimateVersionController.ts`:
- `prepareEstimate`
- `sendEstimate`
- `getEstimatePointPersons`
- `updateEstimatePointPersons`
- `getEstimateEmailContent`
- `updateEstimateEmailContent`
- `getEstimateSendTemplate`

---

## Phase 5: Frontend API ✅

### Extended `jobVersioningApi.ts`:

```typescript
// Get email template
getEstimateSendTemplate()

// Prepare estimate (locks it, cleans rows)
prepareEstimate(estimateId, { emailSubject?, emailBody?, pointPersons? })

// Send to customer (creates QB estimate, sends email)
sendEstimateToCustomer(estimateId, estimatePreviewData?)

// Point persons management
getEstimatePointPersons(estimateId)
updateEstimatePointPersons(estimateId, pointPersons[])

// Email content management
getEstimateEmailContent(estimateId)
updateEstimateEmailContent(estimateId, subject, body)
```

---

## Phase 6: Layout CSS Changes ✅

### Files Modified:
- `/frontend/web/src/components/jobEstimation/JobEstimation.css`
- `/frontend/web/src/components/jobEstimation/EstimateEditorPage.tsx`

### Dynamic Layout Based on Workflow State

**Draft Mode (building):** Grid fills available space, Preview fixed at 700px
**Prepared Mode (ready to send):** Preview expands (~60%), Grid shrinks (~40%)

### Implementation:

#### EstimateEditorPage.tsx - Conditional class
```tsx
<div className={`estimate-builder-layout-container ${currentEstimate.is_prepared ? 'estimate-prepared' : ''}`}>
```

#### JobEstimation.css - Dynamic proportions
```css
@media (min-width: 1700px) {
  /* Default (draft/building mode): Grid fills space, preview fixed */
  .estimate-builder-grid-wrapper {
    flex: 1;
    max-width: 1200px;
  }
  .estimate-builder-preview-wrapper {
    width: 700px;
    max-width: 700px;
    flex-shrink: 0;
  }

  /* Prepared mode: Preview wider for email composition */
  .estimate-prepared .estimate-builder-grid-wrapper {
    flex: 0 0 40%;
    max-width: 800px;
  }
  .estimate-prepared .estimate-builder-preview-wrapper {
    flex: 1;
    width: auto;
    max-width: none;
    min-width: 800px;
  }
}
```

### Workflow States Mapping:
| State | `is_prepared` | Layout |
|-------|---------------|--------|
| Draft (building) | false | Grid fills space, Preview 700px fixed |
| Prepared (ready to send) | true | Grid 40%, Preview ~60% |
| Sent | true | Grid 40%, Preview ~60% |

---

## Phase 7: EstimateTable + New Components 🔄

### New Components Created:

#### `EstimatePointPersonsEditor.tsx` ✅
- Based on orders `PointPersonsEditor.tsx` pattern
- Supports "Existing" (from customer contacts) and "New" (custom) modes
- Props: `customerId`, `initialPointPersons`, `onChange`, `disabled`
- Auto-loads customer contacts
- Filters out already-selected contacts from dropdown

#### `EstimateEmailComposer.tsx` ✅
- Email subject and body fields
- Auto-fills from `estimate_send` template on mount
- Template variable substitution: `{{customerName}}`, `{{jobName}}`, `{{estimateNumber}}`, `{{total}}`
- "Reset to Template" button
- Variables help tooltip

### Completed Work:
- [x] Update `EstimateTable.tsx` props interface
- [x] Import new components
- [x] Add Point Persons section after totals
- [x] Add Email Composer section
- [x] Update button logic for "Prepare to Send" / "Send to Customer"
- [ ] Add QB Description editable column (optional - future enhancement)

---

## Phase 8: Workflow Hook Redesign ✅

### File: `/frontend/web/src/components/jobEstimation/hooks/useQuickBooksIntegration.ts`

### Current Flow:
```
handleCreateQBEstimate() → Creates in QB → Sets is_draft=false
```

### New Flow:
```
handlePrepareEstimate() → Calls /prepare API → Sets is_prepared=true, is_draft=false
handleSendToCustomer() → Calls /send-to-customer API → Creates QB, sends email
```

### New State Variables Needed:
- `isPreparing: boolean`
- `isSending: boolean`
- `showPrepareConfirmModal: boolean`
- `showSendConfirmModal: boolean`

### New Handlers Needed:
- `handlePrepareEstimate(pointPersons, emailSubject, emailBody)`
- `handleSendToCustomer()`

---

## Phase 9: EstimateEditorPage Updates ✅

### File: `/frontend/web/src/components/jobEstimation/EstimateEditorPage.tsx`

### Changes Needed:
1. Move `CustomerPreferencesPanel` from above preview to above grid
2. Pass new props to `EstimateTable`:
   - `customerId`
   - `pointPersons` / `onPointPersonsChange`
   - `emailSubject` / `emailBody` / `onEmailChange`
   - `onPrepareEstimate`
   - `onSendToCustomer`
   - `isPrepared` / `isSent` state
3. Update `isReadOnly` logic (already correct: `!currentEstimate.is_draft`)
4. Wire up workflow buttons

---

## Phase 10: Testing & Verification ⏳

### Test Cases:
1. **Prepare Flow**
   - Draft estimate → Click "Prepare to Send" → Estimate locks
   - Empty rows cleaned (except structural)
   - Point persons saved
   - Email content saved

2. **Send Flow**
   - Prepared estimate → Click "Send to Customer"
   - QB estimate created
   - PDF downloaded
   - Email sent to point persons
   - Estimate marked as sent

3. **Order Conversion**
   - Point persons copied from estimate to order
   - Order conversion modal pre-populated

4. **Edge Cases**
   - No point persons selected
   - No email content
   - QB not connected
   - Email send failure

---

## Key Files Reference

### Created:
| File | Purpose |
|------|---------|
| `database/migrations/phase4c_estimate_workflow.sql` | Database schema |
| `backend/web/src/types/estimatePointPerson.ts` | Type definitions |
| `backend/web/src/repositories/estimatePointPersonRepository.ts` | Point person DB access |
| `backend/web/src/services/estimate/estimateWorkflowService.ts` | Workflow business logic |
| `frontend/web/src/components/jobEstimation/EstimatePointPersonsEditor.tsx` | Point person UI |
| `frontend/web/src/components/jobEstimation/EstimateEmailComposer.tsx` | Email composer UI |

### Modified:
| File | Changes |
|------|---------|
| `backend/web/src/repositories/estimateRepository.ts` | Added prepare/send methods |
| `backend/web/src/services/estimateService.ts` | Added workflow facade methods |
| `backend/web/src/services/estimateVersioningService.ts` | Added workflow facade methods |
| `backend/web/src/controllers/estimates/estimateVersionController.ts` | Added endpoint handlers |
| `backend/web/src/routes/jobEstimation.ts` | Added new routes |
| `frontend/web/src/services/jobVersioningApi.ts` | Added API methods |
| `frontend/web/src/components/jobEstimation/JobEstimation.css` | Swapped layout proportions |

### Still Needs Modification:
| File | Changes Needed |
|------|----------------|
| `frontend/web/src/components/jobEstimation/EstimateTable.tsx` | Add new sections |
| `frontend/web/src/components/jobEstimation/hooks/useQuickBooksIntegration.ts` | Add prepare/send handlers |
| `frontend/web/src/components/jobEstimation/EstimateEditorPage.tsx` | Move Customer Prefs, wire buttons |

---

## UI Changes Summary

### EstimateTable New Layout:
```
+------------------------------------------+
|  Header with status + buttons            |
+------------------------------------------+
|  Customer Info                           |
+------------------------------------------+
|  Line Items Table                        |
|  (with optional QB Description column)   |
+------------------------------------------+
|  Totals (Subtotal, Tax, Total)           |
+------------------------------------------+
|  Point Person(s) Section          [NEW]  |
+------------------------------------------+
|  Email Composition Section        [NEW]  |
|  - Subject field                         |
|  - Body textarea                         |
+------------------------------------------+
|  [Prepare to Send] or                    |
|  [Send to Customer]               [NEW]  |
+------------------------------------------+
```

### Button States:
| State | Button Shown |
|-------|--------------|
| Draft | "Prepare to Send" (green) |
| Prepared | "Send to Customer" (blue) |
| Sent | "Convert to Order" (green) |

---

## Next Steps

1. ~~Complete Phase 7: Integrate components into EstimateTable~~ ✅
2. ~~Complete Phase 8: Update workflow hook with prepare/send handlers~~ ✅
3. ~~Complete Phase 9: Wire up EstimateEditorPage~~ ✅
4. Complete Phase 10: End-to-end testing

---

*Last Updated: 2025-12-19*
