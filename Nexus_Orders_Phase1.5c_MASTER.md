# Phase 1.5.c: Job Details Setup UI - MASTER PLAN

**Status:** 🚧 IN PROGRESS - Subphases 1.5.c.1 through 1.5.c.5 COMPLETE ✅ | Phase 1.5.c.6 READY
**Priority:** HIGH
**Total Duration:** 6-7 days (broken into 6 subphases)
**Last Updated:** 2025-11-07

---

## Overview

Phase 1.5.c implements the complete Job Details Setup interface - the core UI where managers configure order specifications, invoice details, and prepare orders for production. This phase has been broken down into 6 manageable subphases for systematic implementation and testing.

---

## Architecture Decisions

### 1. **Template System - NEW Order Template System**

**IMPORTANT:** This is NOT the same template system as the Estimation Modal.

- **Estimation Templates:** Used in job estimation (field1-field12 with prompts)
- **Order Templates:** NEW system with semantic keys (height, depth, vinyl_color, etc.)
- **Rationale:** Orders need production-ready semantic data for manufacturing, while estimation needs flexible field-based input

**Storage Format:**
```json
// order_parts.specifications (semantic keys)
{
  "height": "12",
  "depth": "3",
  "vinyl_color": "White",
  "led_modules": "Yes",
  "power_supply": "12V 5A Indoor"
}
```

**Template Structure:**
```typescript
interface OrderProductTemplate {
  product_type: string;  // "Channel Letters"
  fields: OrderTemplateField[];
}

interface OrderTemplateField {
  key: string;           // "height" (semantic)
  label: string;         // "Letter Height"
  type: 'text' | 'number' | 'select';
  unit?: string;         // "inches"
  required: boolean;
  options?: string[];    // For select type
}
```

### 2. **Snapshot & Versioning System**

**Purpose:** Track changes after finalization with unlimited version history

**✅ IMPLEMENTED (Phase 1.5.c.3):**
```sql
-- NEW: Dedicated snapshots table with version history
CREATE TABLE order_part_snapshots (
  snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
  part_id INT NOT NULL,
  version_number INT NOT NULL,  -- 1, 2, 3...
  specifications JSON,
  invoice_description TEXT,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  production_notes TEXT,
  snapshot_type ENUM('finalization', 'manual'),
  notes TEXT,
  created_at TIMESTAMP,
  created_by INT,
  UNIQUE KEY (part_id, version_number)
);

-- orders table (Phase 1.5.b):
orders.finalized_at TIMESTAMP NULL
orders.finalized_by INT UNSIGNED
orders.modified_after_finalization BOOLEAN
```

**Architecture Decision:** Use snapshots TABLE (not JSON column) for unlimited version history

**Workflow:**
1. User clicks "Finalize Order" → Create Version 1 snapshots for all parts
2. User edits specs/invoice → Detect changes by comparing to latest version
3. UI highlights changed fields in yellow/orange
4. `modified_after_finalization` flag set to true
5. Re-finalize → Create Version 2 (Version 1 preserved for audit trail)

### 3. **Component Architecture**

```
OrderDetailsPage (520 lines)
├── Order Info Section (existing, no changes)
├── FinalizationPanel (new - Phase 1.5.c.6)
└── DualTableLayout (new - Phase 1.5.c.5)
    ├── JobSpecsTable
    │   ├── Semantic field editors
    │   └── Save button
    └── InvoiceTable
        ├── Invoice field editors
        └── Invoice summary

ProgressView (right column - existing)
└── PartTasksSection (modified - Phase 1.5.c.4)
    ├── [+] button → TaskTemplateDropdown
    └── TaskItem[] with [-] button on hover
```

---

## Subphase Breakdown

### **Phase 1.5.c.1: Frontend API Layer** (0.5 days)
**Status:** ✅ COMPLETE (2025-11-07)
**File:** `Nexus_Orders_Phase1.5c.1_FrontendAPI.md`

**Deliverables:**
- ✅ 5 new API methods in `/frontend/web/src/services/api.ts` (+78 lines)
- ✅ Type definitions for API request/response
- ✅ Methods: updateOrderParts, getTaskTemplates, addTaskToPart, removeTask, getOrderWithParts

**Testing:**
- ✅ TypeScript compilation successful
- ✅ Build successful
- ✅ All API routes connected to backend
- ✅ All browser console tests passed

---

### **Phase 1.5.c.2: Order Template System** (1 day)
**Status:** ✅ COMPLETE (2025-11-07)
**File:** `Nexus_Orders_Phase1.5c.2_OrderTemplates.md`

**Deliverables:**
- ✅ `/frontend/web/src/config/orderProductTemplates.ts` (366 lines) - 6 product templates
- ✅ `/frontend/web/src/config/types.ts` (26 lines) - Type definitions
- ✅ `/backend/web/src/types/orderTemplates.ts` (44 lines) - Backend types
- ✅ Templates for: Channel Letters, LED Neon, Substrate Cut, Vinyl, Painting, Default
- ✅ Helper functions: getOrderTemplate, validateSpecifications, getAllTemplates

**Testing:**
- ✅ TypeScript compilation successful
- ✅ Build successful
- ✅ Template lookup works with prefix matching
- ✅ Validation functions work correctly
- ✅ Integration with Dual-Table UI tested

---

### **Phase 1.5.c.3: Snapshot & Versioning System** (0.5 days)
**Status:** ✅ COMPLETE (2025-11-06)
**File:** `Nexus_Orders_Phase1.5c.3_Snapshots.md`

**Deliverables:**
- ✅ `order_part_snapshots` table created (unlimited version history)
- ✅ Backend service methods (+247 lines): createPartSnapshot, finalizeOrder, getLatestSnapshot, getSnapshotHistory, compareWithLatestSnapshot
- ✅ Backend controller (+114 lines): 4 endpoints for finalization and comparison
- ✅ Backend routes (+44 lines): finalize, snapshots, compare endpoints
- ✅ Frontend comparison utility (223 lines): isPartModified, getModifiedFields, formatters
- ✅ Frontend highlight components (190 lines): ModifiedBadge, ModifiedBanner, ComparisonView, etc.

**Architecture:** Snapshots TABLE (not JSON column) for unlimited version history

**Testing:**
- ✅ TypeScript compilation successful
- ✅ Builds successful (backend + frontend)
- ✅ Database migration applied
- ✅ API endpoints functional

---

### **Phase 1.5.c.4: Task Management UI** (1 day)
**Status:** ✅ COMPLETE (2025-11-07)
**File:** `Nexus_Orders_Phase1.5c.4_TaskManagement.md`

**Deliverables:**
- ✅ `/frontend/web/src/components/orders/progress/ConfirmModal.tsx` (65 lines) - Reusable confirmation modal
- ✅ `/frontend/web/src/components/orders/progress/TaskTemplateDropdown.tsx` (120 lines) - Task selection dropdown
- ✅ Modified `PartTasksSection.tsx` (+35 lines) - Added [+] button and orderStatus prop
- ✅ Modified `TaskItem.tsx` (+30 lines) - Added [-] button with hover effect and modal confirmation
- ✅ Modified `TaskList.tsx` (+3 lines) - Pass canRemove prop
- ✅ Modified `ProgressView.tsx` (+1 line) - Pass orderStatus prop

**Testing:**
- ✅ TypeScript compilation successful
- ✅ Build successful
- ✅ [+] button shows available tasks grouped by role
- ✅ Tasks added successfully with real-time updates
- ✅ [-] button appears on hover for incomplete tasks
- ✅ Modal confirmation works for task removal
- ✅ Buttons only appear when status='job_details_setup'

---

### **Phase 1.5.c.5: Dual-Table Core UI** (1 day)
**Status:** ✅ COMPLETE (2025-11-07)
**File:** `Nexus_Orders_Phase1.5c.5_DualTableCoreUI.md`

**Deliverables:**
- ✅ `DualTableLayout.tsx` (189 lines) - Container with synchronized scroll, batch save
- ✅ `JobSpecsTable.tsx` (182 lines) - Template-driven spec editing with vertical expansion
- ✅ `InvoiceTable.tsx` (201 lines) - Invoice editing with auto-calculation
- ✅ Modified `OrderDetailsPage.tsx` - Integrated dual-table layout

**Key Features:**
- ✅ Uses existing orderProductTemplates.ts (Channel Letters: 9 fields)
- ✅ Specifications expand vertically (not limited to 4 columns)
- ✅ Always editable (no read-only mode)
- ✅ Auto-calculates extended_price (quantity × unit_price)
- ✅ Handles MySQL DECIMAL fields as strings
- ✅ Synchronized vertical scrolling
- ✅ Batch save with "Save All Changes" button

**Testing:**
- ✅ Verified synchronized scrolling
- ✅ Tested inline editing (specs + invoice)
- ✅ Save changes → reload → persistence verified
- ✅ Parent/child row styling working
- ✅ Currency formatting working

---

### **Phase 1.5.c.6: Finalization & Integration** (0.5 days)
**Status:** ⏳ Depends on 1.5.c.5
**File:** `Nexus_Orders_Phase1.5c.6_Finalization.md`

**Deliverables:**
- `FinalizationPanel.tsx` (120 lines) - Finalize button + validation
- Integration into `OrderDetailsPage.tsx`
- End-to-end testing checklist

**Testing:**
- Complete finalization workflow
- Verify invoice validation
- Test snapshot creation
- Test modification highlighting
- Verify status transition: job_details_setup → pending_confirmation

---

## Implementation Order

```
Start → 1.5.c.1 (API) → 1.5.c.2 (Templates) → 1.5.c.3 (Snapshots)
                    ↓
                1.5.c.4 (Tasks)
                    ↓
    1.5.c.5 (Dual-Table) → 1.5.c.6 (Finalization) → Done
```

**Critical Path:** 1 → 2 → 3 → 5 → 6
**Parallel Track:** 1 → 4 (can be done independently)

---

## Database Schema Requirements

**Already Implemented in Phase 1.5.b:**
```sql
-- orders table
finalized_at TIMESTAMP NULL
finalized_by INT UNSIGNED
modified_after_finalization BOOLEAN DEFAULT false

-- order_parts table
specifications JSON  -- Will use semantic keys
finalized_snapshot JSON NULL  -- Added in Phase 1.5.b
```

**No additional migrations needed.**

---

## Testing Strategy

### Per-Subphase Testing
Each subphase has its own testing checklist (see individual subphase docs)

### Integration Testing (After 1.5.c.6)
1. Create order from estimate → Verify parts populated
2. Navigate to Order Details → Verify dual-table displays
3. Edit specs → Save → Reload → Verify persistence
4. Edit invoice → Save → Reload → Verify persistence
5. Add tasks → Verify tasks appear in ProgressView
6. Remove tasks → Verify tasks disappear
7. Click "Finalize Order" → Verify snapshot created
8. Edit field after finalization → Verify highlight appears
9. Verify status changes: job_details_setup → pending_confirmation

### Regression Testing
- Ensure existing order workflow (Phase 1) still works
- Verify ProgressView still functions correctly
- Test with multiple product types
- Test parent/child row display

---

## Key Patterns & Standards

### Inline Editing Pattern
```typescript
const [editingField, setEditingField] = useState<string | null>(null);
const [editValue, setEditValue] = useState<any>('');

const startEdit = (field: string, value: any) => {
  setEditingField(field);
  setEditValue(value);
};

const saveEdit = async () => {
  await ordersApi.updateOrderParts(orderNumber, [{ part_id, [field]: editValue }]);
  setEditingField(null);
  refetch();
};
```

### Change Highlighting Pattern
```typescript
const isModified = (field: string, currentValue: any) => {
  if (!part.finalized_snapshot) return false;
  return part.finalized_snapshot[field] !== currentValue;
};

const fieldClassName = isModified('height', part.specifications.height)
  ? 'bg-yellow-100 border-yellow-500'
  : 'bg-white border-gray-200';
```

### Styling Standards
- Card: `bg-white rounded-lg shadow p-4`
- Input: `px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500`
- Button Primary: `px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700`
- Button Secondary: `px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300`
- Highlight: `bg-yellow-100 border-yellow-500 border-l-4`

---

## Success Criteria

Phase 1.5.c is complete when:

✅ All 6 subphases implemented and tested (5/6 COMPLETE)
✅ Dual-table displays specs and invoice correctly
✅ Inline editing works for all fields
✅ Task management (+/-) works in ProgressView
⏳ Finalization creates snapshot and transitions status (Phase 1.5.c.6 - READY)
⏳ Change highlighting works after finalization (Phase 1.5.c.6 - READY)
✅ All regression tests pass
✅ Documentation updated with actual implementation

---

## Next Steps

1. ✅ **COMPLETE:** Phases 1.5.c.1 through 1.5.c.5
2. **Read** `Nexus_Orders_Phase1.5c.6_Finalization.md`
3. **Implement** Phase 1.5.c.6 (Finalization & Integration)
4. **Test** complete end-to-end workflow

**Current Status:** Phase 1.5.c.5 complete. Ready for Phase 1.5.c.6 (Finalization).

---

**Document Status:** ✅ 5/6 Subphases COMPLETE - Phase 1.5.c.6 Ready to Implement
**Progress:** Phase 1.5.c.1 ✅ | 1.5.c.2 ✅ | 1.5.c.3 ✅ | 1.5.c.4 ✅ | 1.5.c.5 ✅ | 1.5.c.6 📋 READY
**Dependencies:** Phase 1.5.b (Database Schema) - COMPLETE
**Next Phase:** Phase 1.5.c.6 (Finalization - ~4 hours remaining)
**After 1.5.c:** Phase 1.5.d (Dynamic Specs & Tasks) deferred - may not be needed
