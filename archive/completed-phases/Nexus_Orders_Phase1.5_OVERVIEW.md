# Phase 1.5: Order Building System - Overview

**Status:** ✅ COMPLETE - 100% (All phases done: a, a.5, b, c.1-c.6.3, d, e, g ✅)
**Priority:** CRITICAL - Fills gap between Phase 1 and Phase 2
**Total Duration:** 3-4 weeks (Phase 1.5.g added in parallel)
**Last Updated:** 2025-12-09

---

## 📊 Progress Tracker

### Completed (22/20 criteria) - 110% (exceeds baseline with Phase 1.5.g)
- ✅ **Phase 1.5.a - COMPLETE** (2025-11-06)
  - ✅ Numbering displays correctly (1, 1a, 1b, 1c)
  - ✅ No duplicate numbers
  - ✅ Multiple parent items numbered sequentially
  - ✅ Sub-Item rows continue parent's letter sequence
  - ✅ Sequential base numbering regardless of input grid gaps
  - ✅ Edge cases handled
  - ✅ EstimateTable displays correct field
  - ✅ No console errors
  - ✅ Order creation modal implemented
  - ✅ Real-time order name validation (case-insensitive)
  - ✅ Estimate-to-order conversion working
  - ✅ Accepts 'sent' and 'approved' estimates
  - ✅ Redirects to order details page
- ✅ **Phase 1.5.a.5 - COMPLETE** (2025-11-06)
  - ✅ Business days calculation with holiday awareness
  - ✅ Customer contact management (customer_contacts table)
  - ✅ Hard due date/time support
  - ✅ Auto-calculated due dates from customer defaults
  - ✅ Manual override detection and warnings
- ✅ **Phase 1.5.b - COMPLETE** (2025-11-06)
  - ✅ Database schema updated (customer_job_number, hard_due_date_time, etc.)
  - ✅ customer_contacts table created
  - ✅ Migrations applied successfully
- ✅ **Phase 1.5.c.1 - Frontend API Layer - COMPLETE** (2025-11-07)
  - ✅ 5 new API methods in ordersApi
  - ✅ Type definitions for Order Parts and Tasks
  - ✅ TypeScript compilation clean
  - ✅ All browser console tests passed
- ✅ **Phase 1.5.c.2 - Order Template System - COMPLETE** (2025-11-07)
  - ✅ Order template configuration created (6 product types)
  - ✅ Semantic key mapping (height, depth, vinyl_color, etc.)
  - ✅ Template validation functions
  - ✅ Backend types for type safety
  - ✅ 366 lines of template configuration
- ✅ **Phase 1.5.c.3 - Snapshot & Versioning - COMPLETE** (2025-11-06)
  - ✅ order_part_snapshots table created (unlimited version history)
  - ✅ Backend finalization service methods
  - ✅ Frontend comparison utilities
  - ✅ Highlight styling components
  - ✅ Architecture: Snapshots TABLE (not JSON column)
- ✅ **Phase 1.5.c.4 - Task Management UI - COMPLETE** (2025-11-07)
  - ✅ [+] button in PartTasksSection header
  - ✅ TaskTemplateDropdown with role grouping
  - ✅ [-] button on hover for task removal
  - ✅ ConfirmModal for safe deletion
  - ✅ Only editable in 'job_details_setup' status
- ✅ **Phase 1.5.c.5 - Dual-Table Core UI - COMPLETE** (2025-11-07)
  - ✅ DualTableLayout with synchronized scrolling
  - ✅ JobSpecsTable with template-driven fields
  - ✅ InvoiceTable with auto-calculation
  - ✅ Batch save functionality
  - ✅ Parent/child row styling
  - ✅ 572 lines of new UI components

- ✅ **Phase 1.5.c.6 - Order Preparation Workflow - COMPLETE** (2025-11-18 to 2025-11-20)
  - ✅ PrepareOrderModal with 4-step workflow
  - ✅ Step 1: Validation (25 specification templates)
  - ✅ Step 2: QB Estimate creation with staleness detection
  - ✅ Step 3: PDF Generation (Order Form, Packing List, Internal Estimate, QB Estimate)
  - ✅ Step 4: Task Generation (intelligent rules-based system)
  - ✅ Live PDF preview panel
  - ✅ Compact step UI with real-time status updates
  - ✅ order_qb_estimates table for QB estimate tracking
  - ✅ Build management system (dual dev/production builds)

### Phase 1.5.d - Task Generation System
- ✅ **Phase 1.5.d - COMPLETE** (2025-11-21 to 2025-11-24)
  - ✅ Intelligent task generation engine (`/backend/web/src/services/taskGeneration/`)
  - ✅ Spec-driven task generation with 25+ product rules
  - ✅ Painting task matrix with substrate/finish combinations
  - ✅ Automatic task sorting and role assignment (15 production roles)
  - ✅ Part grouping (parent + sub-parts processed together)
  - ✅ Task deduplication and dependency management
  - ✅ Spec parser for extracting paint specifications
  - ✅ Backer product support in specs autofill
  - ✅ Point person management endpoints

### Phase 1.5.g - Order Folder & Image Management
- ✅ **Phase 1.5.g - COMPLETE** (2025-11-12)
  - ✅ Database migrations for folder tracking (1,978 orders migrated from SMB)
  - ✅ Order creation with automatic folder creation
  - ✅ Folder movement to 1Finished on completion
  - ✅ Image API endpoints (orderImageController.ts)
  - ✅ Image picker modal (ImagePickerModal.tsx, OrderImage.tsx components)
  - ✅ Print service implementation (printController.ts, printService.ts)
  - ✅ Image crop coordinate storage and management
  - ✅ Order folder service for folder operations

- ✅ **Phase 1.5.c.6.3 - Send to Customer - COMPLETE** (2025-11-25)
  - ✅ SendToCustomerPanel with point person selection
  - ✅ Email preview with template and attachments
  - ✅ Gmail API integration (fully functional)
  - ✅ Order finalization service with status updates
  - ✅ Status change to pending_confirmation
  - ✅ 9 test scripts for Gmail functionality verification

### All Phases Complete ✅
- ✅ Phase 1.5.e - Row operations polish (add row, delete row, drag-drop, duplicate row modal) - COMPLETE (2025-12-09)
- ✅ Phase 1.5.f - Order finalization workflow (merged with c.6.3)

---

## Executive Summary

Phase 1.5 was **discovered during Phase 1.h integration testing** as a critical missing piece in the Orders workflow. While Phase 1 implemented the backend order creation API and order management dashboard, it **lacked the UI for converting estimates to orders** and the **interactive Job Details Setup interface**.

**What Phase 1.5 Delivers:**
- Seamless estimate approval → order creation workflow
- Fix Estimate Preview numbering system (1, 1a, 1b, 1c...)
- Interactive "Job Details Setup" dual-table interface
- Dynamic specs and tasks management per item
- Auto-population from estimate data
- Order finalization workflow with validation
- Status management: "Job Details Setup" → "Pending Confirmation"

---

## The Gap We're Filling

### ❌ What Was Missing

**From Job Estimation Side:**
- "Approve" button exists but doesn't create orders
- **Estimate Preview numbering broken** (shows "1. Item", "1. Item", "1a. Item" instead of "1", "1a", "1b")
- "Go to Order" button is a non-functional placeholder (TODO)
- No way to convert approved estimates into orders

**From Orders Side:**
- Orders can only be created manually via API
- No "Job Details Setup" phase interface
- No way to manage job specs, tasks, or invoice details
- Parts have no relationship structure
- No finalization workflow

### ✅ What Phase 1.5 Provides

**Complete Workflow:**
1. Manager approves estimate → Confirmation dialog appears
2. Order auto-created in "Job Details Setup" state
3. Estimate Preview data auto-populates dual-table interface
4. "Go to Order" button navigates to order page
5. Order page shows interactive job builder (dual-table layout)
6. Manager refines specs, tasks, invoice details
7. Manager finalizes order (optionally sends to customer)
8. Order moves to "Pending Confirmation" status
9. Normal order workflow continues (Phase 1 features work)

---

## Key Architectural Decisions (Confirmed 2025-11-05)

### 1. Status Rename: "initiated" → "job_details_setup"

**Why:** More descriptive, indicates action required

**Changes Required:**
- ✅ Database enum value in `orders` table status column
- ✅ All backend code references
- ✅ All frontend code references
- ✅ All markdown documentation files
- ✅ UI displays: "Job Details Setup"
- ✅ Status badge styling: Amber/Orange color

**Migration:**
```sql
-- Update enum type
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'job_details_setup',           -- NEW (was 'initiated')
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production',
    'on_hold',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up',
    'awaiting_payment',
    'completed',
    'cancelled'
  ) DEFAULT 'job_details_setup';

-- Update existing records
UPDATE orders SET status = 'job_details_setup' WHERE status = 'initiated';
```

### 2. Tasks Architecture: Normalized Table (NOT JSON)

**Decision:** Keep `order_tasks` table for task management, do NOT use JSON in `order_parts.tasks`

**Rationale:**
- Task completion tracking requires timestamps (completed_at, completed_by)
- Production role assignments need referential integrity
- Task dependencies need FK relationships (depends_on_task_id)
- Task timing tracking (started_at, started_by)
- Normalized structure supports complex queries

**Key Changes:**
- ❌ Remove `task_order` column (order derived from depends_on_task_id chain)
- ✅ Manual task entry (no auto-generation from templates)
- ✅ Hard-coded role assignment rules (locked, cannot be changed)
- ✅ Delete existing auto-generated tasks (Order #200003's 97 tasks)

**Task Creation Workflow:**
1. User creates tasks manually in Job Details Setup UI
2. System assigns `task_id` (auto-increment)
3. User specifies task dependencies by task name
4. System parses dependency names and links `depends_on_task_id` after all tasks created
5. Roles auto-assigned based on hard-coded rules (product_type + task name)

### 3. Specs Data Source: calculationDisplay (NOT Input Fields)

**Decision:** Extract specs from `EstimatePreviewData.items[].calculationDisplay`

**Rationale:**
- calculationDisplay has the "rendered truth" of calculations
- Already includes all pricing, quantities, descriptions
- Avoids parsing complex input grid structures
- Simpler data flow

**Data Flow:**
```
Estimate Preview (calculationDisplay)
  → Order Creation
  → order_parts.specifications JSON
  → Job Details Setup UI (editable)
```

**calculationDisplay Examples:**
- `"8 Letters × $45/letter"`
- `"64 @ $0.25, White 5mm"`
- `"UL Listing Fee"`

### 4. Invoice & Specs Relationship

**Decision:** Auto-populate from estimate, editable, irreversible separation after approval

**Workflow:**
1. **Initial Population:** calculationDisplay data populates BOTH:
   - Left Table (Job Specs - job instructions)
   - Right Table (Invoice - billing details)
2. **During Job Details Setup:**
   - Both tables editable independently
   - ⚠️ Warning displays if specs ≠ invoice
3. **"Send for Approval" Action:**
   - **IRREVERSIBLE SEPARATION** occurs
   - Specs and Invoice become completely independent
   - No more warnings
   - Changes to either don't affect the other
4. **After Approval:**
   - Order moves to `pending_confirmation`
   - Specs can be modified (affects production)
   - Invoice can be modified (affects billing)
   - No cross-contamination

### 5. Task Generation: Hard-Coded Rules

**Decision:** Manual task entry with hard-coded role assignment rules

**Rule-Based Logic (to be defined in Phase 1.5.d):**
```
IF product_type = "Channel Letters" AND specs contains "LEDs":
  → Auto-assign role: "leds"
  → Suggested tasks: "Install LEDs", "Wire PS", "Test LEDs"

IF product_type = "Channel Letters" AND specs contains "Paint":
  → Auto-assign role: "painting"
  → Suggested tasks: "Prep surface", "Paint", "Clear coat"
```

**User Workflow:**
1. Set up part specs in left table
2. Click "Generate Tasks" button per part
3. System suggests tasks based on rules
4. User accepts/modifies/deletes tasks
5. User manually specifies dependencies
6. System auto-assigns roles (locked)

---

## Sub-Phase Breakdown

Phase 1.5 is divided into **7 sub-phases** for manageable implementation:

### Phase 1.5.a: Estimate Numbering Fix & Order Creation (3-4 days)
**Status:** 🚧 IN PROGRESS (Numbering Fix ✅ COMPLETE & TESTED, Order Creation ⏳ PENDING)
**Focus:** Fix numbering + bridge Job Estimation → Orders

**Deliverables:**
- ✅ **COMPLETE & TESTED (2025-11-06) - Fix Estimate Preview numbering logic (Helper Function Approach)**
  - ✅ Fixed bug: "1", "1", "1", "1a" → now shows "1", "1a", "1b", "1c"
  - ✅ Created dedicated `assignEstimatePreviewNumbers()` helper function
  - ✅ Handles Sub-Item rows by continuing parent's letter sequence
  - ✅ Uses `parentId` from metadata to traverse to root parent
  - ✅ Marks first component as parent with `isParent` flag
  - ✅ Sequential base numbering (1, 2, 3...) regardless of input grid gaps
  - ✅ Fixed EstimateTable UI to display correct field
  - ✅ All manual tests passed (Channel Letters, Multiple Parents, Sub-Items, Edge Cases)
  - ✅ No console errors or warnings
- ⏳ PENDING - Confirmation dialog on estimate approval
- ⏳ PENDING - Auto-create order from Estimate Preview data
- ⏳ PENDING - Map all estimate items → order table rows
- ⏳ PENDING - Preserve display numbers (1, 1a, 1b)
- ⏳ PENDING - Mark first item per section as "parent"
- ⏳ PENDING - Fix "Go to Order" button navigation
- ⏳ PENDING - Create order with "job_details_setup" status

**Files Modified (Numbering Fix - 2025-11-06):**
- ✅ `/frontend/web/src/components/jobEstimation/core/layers/CalculationLayer.ts` (+70 lines, -22 lines)
- ✅ `/frontend/web/src/components/jobEstimation/EstimateTable.tsx` (1 line)

**Testing Completed (2025-11-06):**
- ✅ Test Case 1: Simple estimate with Channel Letters (4 components) - PASSED
- ✅ Test Case 2: Multiple parent items with different product types - PASSED
- ✅ Test Case 3: Sub-Item rows continuing parent sequence - PASSED
- ✅ Test Case 4: Sequential base numbering with input grid gaps - PASSED
- ✅ Test Case 5: Edge cases (Empty Row, Divider, Subtotal, Special Items) - PASSED

**Files Pending (Order Creation):**
- `/frontend/web/src/components/jobEstimation/VersionManager.tsx` (update)
- `/frontend/web/src/components/orders/ApproveEstimateModal.tsx` (new)
- `/backend/web/src/services/orderConversionService.ts` (enhance)

---

### Phase 1.5.a.5: Approve Estimate Modal Enhancements (1-2 days)
**Status:** ⏳ NEXT - Ready for Implementation
**Priority:** High
**Estimated Effort:** 8-11 hours
**Dependencies:** Phase 1.5.a (Numbering Fix) - COMPLETE ✅

**Focus:** Enhance ApproveEstimateModal with intelligent date calculations, customer contact management, and optional hard deadline support

**Key Features:**
- **Auto-calculate Due Date:** Today + customer's default_turnaround (business days, excluding weekends & holidays)
- **Business Days Display:** Show calculation next to due date (e.g., "15 business days from today")
- **Manual Override Indicator:** Visual indicator when user manually changes auto-calculated date
- **Hard Due Date/Time:** Optional time input for rush orders (e.g., "Must ship by 2:00 PM Friday")
- **Customer Contacts System:** New `customer_contacts` table with dropdown + "Add New Contact" inline form
- **Customer Job Number:** Optional field for customer's internal job tracking

**Database Changes:**
- Create `customer_contacts` table (NEW)
- All order fields already exist ✅ (customer_po, customer_job_number, point_person_email, due_date, hard_due_date_time)

**New Backend Components:**
- `BusinessDaysCalculator` utility (leverages existing `TimeAnalyticsRepository.getHolidaysInRange()`)
- Customer contacts repository, controller, routes
- Order controller endpoints: `calculate-due-date`, `calculate-business-days`

**Frontend Updates:**
- ApproveEstimateModal: ~295 → ~480 lines (under 500 limit ✅)
- New state for date tracking, business days display, contacts management
- Enhanced UX with auto-calculation and manual override indicators

**Documentation:**
- See `Nexus_Orders_Phase1.5a.5_ApproveModalEnhancements.md` for full implementation details

---

### Phase 1.5.b: Database Schema Updates (1 day)
**Focus:** Extend schema for dual-table data

**Deliverables:**
- Rename status enum value: `initiated` → `job_details_setup`
- Add `display_number` to order_parts (e.g., "1", "1a", "1b") - nullable for invoice-only rows
- Add `is_parent` boolean to order_parts
- No `row_type` column - type is implicit based on which columns are populated
- Extend `specifications` JSON structure for multi-row specs
- Add `tasks` JSON array to order_parts
- Add finalization tracking fields to orders table
- Create migration scripts
- Update TypeScript types

**Database Changes:**
```sql
-- Update status enum
ALTER TABLE orders
  MODIFY COLUMN status ENUM('job_details_setup', ...) DEFAULT 'job_details_setup';

UPDATE orders SET status = 'job_details_setup' WHERE status = 'initiated';

-- Extend order_parts table (NO tasks JSON - uses order_tasks table)
-- Note: Row "type" is implicit based on which columns are populated
ALTER TABLE order_parts
  ADD COLUMN display_number VARCHAR(10) NULL AFTER part_number,
  ADD COLUMN is_parent BOOLEAN DEFAULT FALSE AFTER display_number,
  ADD COLUMN invoice_description TEXT,
  ADD COLUMN unit_price DECIMAL(10,2),
  ADD COLUMN extended_price DECIMAL(10,2),
  ADD INDEX idx_display_number (display_number),
  ADD INDEX idx_is_parent (is_parent);

-- Add finalization tracking to orders
ALTER TABLE orders
  ADD COLUMN customer_job_number VARCHAR(100),
  ADD COLUMN hard_due_date_time DATETIME,
  ADD COLUMN manufacturing_note TEXT,
  ADD COLUMN internal_note TEXT,
  ADD COLUMN finalized_at TIMESTAMP NULL,
  ADD COLUMN finalized_by INT NULL,
  ADD COLUMN modified_after_finalization BOOLEAN DEFAULT FALSE,
  ADD FOREIGN KEY (finalized_by) REFERENCES users(user_id);

-- Update order_tasks table (remove task_order)
ALTER TABLE order_tasks
  DROP COLUMN task_order;

-- Delete existing auto-generated tasks
DELETE FROM order_tasks;
ALTER TABLE order_tasks AUTO_INCREMENT = 1;
```

**JSON Structures:**
```typescript
// order_parts.specifications
{
  "specs": [
    { "name": "LEDs", "spec1": "White", "spec2": "5mm", "spec3": "8 count" },
    { "name": "PS", "spec1": "12V", "spec2": "5A", "spec3": "Indoor" }
  ],
  "specs_collapsed": false  // UI state: whether specs are collapsed
}

// Tasks stored in order_tasks table (NOT JSON):
CREATE TABLE order_tasks (
  task_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  part_id INT NULL,
  task_name VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  completed_by INT NULL,
  assigned_role ENUM('designer','vinyl_cnc','painting','cut_bend','leds','packing'),
  depends_on_task_id INT NULL,
  started_at TIMESTAMP NULL,
  started_by INT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES order_tasks(task_id) ON DELETE SET NULL
);
```

---

### Phase 1.5.c: Job Details Setup UI - Layout & Structure (4-5 days)
**Focus:** Build the dual-table interface

**Deliverables:**
- **Top Section:** Order-wide editable fields
  - Job Name (editable)
  - Customer (editable - dropdown)
  - Customer PO# (text input)
  - Customer Job# (text input)
  - Point Person Email (email input, validated)
  - Due Date (date picker)
  - Hard Due Date Time (optional time picker - makes it a hard deadline)
  - Manufacturing Note (from customer prefs, editable textarea)
  - Internal Note (Manager+ only, from customer prefs, editable textarea)

- **Main Section:** Dual-table layout (horizontally aligned rows)
  - **Left Table: Job Specs**
    - Columns: Item Name | Specs (4 sub-cols) | Tasks (2 sub-cols)
    - Expand/collapse toggle on Specs column header
    - Expand/collapse toggle on Tasks column header
    - Default: Specs expanded, Tasks collapsed
  - **Right Table: Invoice**
    - Columns: Item Name | Description | QTY | Unit Price | Ext. Price
  - Rows synchronized (same height, aligned horizontally)
  - Empty cells shown with medium gray background
  - Parent rows: Bold, larger text
  - Sub-part rows: Regular font/size

- **Actions:**
  - Add row button (creates new row with both specs and invoice data)
  - Delete row button (per row)
  - Reorder rows (drag-and-drop)
  - Duplicate row button (modal to choose: specs only, invoice only, or both)
  - Edit all fields inline

**Files:**
- `/frontend/web/src/components/orders/details/JobDetailsSetupView.tsx` (new, ~300 lines)
- `/frontend/web/src/components/orders/details/OrderInfoSection.tsx` (new, ~150 lines)
- `/frontend/web/src/components/orders/details/DualTableLayout.tsx` (new, ~200 lines)
- `/frontend/web/src/components/orders/details/JobSpecsTable.tsx` (new, ~250 lines)
- `/frontend/web/src/components/orders/details/InvoiceTable.tsx` (new, ~150 lines)
- `/frontend/web/src/components/orders/details/TableRow.tsx` (new, ~200 lines)

---

### Phase 1.5.d: Dynamic Specs & Tasks System (3-4 days)
**Focus:** Multi-row specs/tasks within each item

**Deliverables:**
- **Specs Cell Expansion:**
  - Click expand button → Show all spec rows
  - Each spec row has 4 inputs: Name, Spec1, Spec2, Spec3
  - Spec2 and Spec3 are optional (can be blank)
  - Add spec row button (+ icon)
  - Delete spec row button (X icon per row)
  - Validation: Spec Name and Spec1 required

- **Tasks Cell Expansion:**
  - Click expand button → Show all task rows
  - Each task row has 2 inputs: Task, Dependencies
  - Dependencies dropdown: Select from all other tasks in order
  - Add task row button (+ icon)
  - Delete task row button (X icon per row)
  - Validation: Task name required

- **Dynamic Dropdowns:**
  - Product types (if editable)
  - Dependency tasks (autocomplete)
  - Shipping methods
  - Common spec values (LEDs type, PS voltage, etc.)

- **Auto-expanding Inputs:**
  - Text inputs grow with content
  - Textareas auto-resize
  - Row height adjusts to fit content

**Files:**
- `/frontend/web/src/components/orders/specs/SpecsCell.tsx` (new, ~180 lines)
- `/frontend/web/src/components/orders/specs/SpecRow.tsx` (new, ~100 lines)
- `/frontend/web/src/components/orders/tasks/TasksCell.tsx` (new, ~180 lines)
- `/frontend/web/src/components/orders/tasks/TaskRow.tsx` (new, ~120 lines)
- `/frontend/web/src/components/orders/shared/ExpandableCell.tsx` (new, ~80 lines)

---

### Phase 1.5.e: Row Operations Polish (1-2 days)
**Focus:** Refine row manipulation controls and UI polish

**Status:** ✅ COMPLETE (2025-12-09)
- ✅ Add row functionality
- ✅ Delete row functionality
- ✅ Drag-and-drop row reordering
- ✅ Duplicate row modal (DuplicateRowModal.tsx with 3 options: Specs Only, Invoice Only, Both)

**Deliverables:**
- **Row Operations (Existing - Keep):**
  - ✅ Add row - Working
  - ✅ Delete row with confirmation - Working
  - ✅ Drag-and-drop reordering - Working

- **New: Duplicate Row Modal:**
  - Duplicate button on each row
  - Modal with three options:
    1. Duplicate SPECS ONLY (left table data)
    2. Duplicate INVOICE ONLY (right table data)
    3. Duplicate BOTH (specs + invoice data)
  - Creates new row below current row with selected data

- **UI Enhancement: Controls Column Separation:**
  - Add vertical divider between CONTROLS and ITEM NAME columns
  - Clarifies that CONTROLS column applies to both SPECS and INVOICE sections
  - Visual separation improves readability

**Design Changes from Original Plan:**
- ❌ **Removed:** Auto-inserted separators (no longer needed)
- ❌ **Removed:** Manual separator management (no longer needed)
- ❌ **Removed:** Explicit row type toggles (Both/Specs Only/Invoice Only)
  - Row type is now **implicit** based on which side has data
  - No explicit indicators needed

**Files:** ✅ ALL IMPLEMENTED
- `/frontend/web/src/components/orders/modals/DuplicateRowModal.tsx` (~153 lines) ✅
- `/frontend/web/src/components/orders/details/dualtable/components/PartRow.tsx` (duplicate button + modal integration) ✅
- `/frontend/web/src/components/orders/details/dualtable/hooks/usePartUpdates.ts` (duplicatePart hook) ✅
- `/frontend/web/src/services/api/orders/orderPartsApi.ts` (duplicatePart API call) ✅
- `/backend/web/src/controllers/orders/OrderPartsController.ts` (duplicatePart controller) ✅
- `/backend/web/src/services/orderPartsService.ts` (duplicatePart service) ✅
- `/backend/web/src/routes/orders.ts` (POST /:orderNumber/parts/:partId/duplicate route) ✅

---

### Phase 1.5.f: Order Finalization Workflow (2-3 days)
**Focus:** Validate, finalize, and status management

**Deliverables:**
- **Validation System:**
  - Check required fields (job name, customer, due date)
  - Check each row has valid data
  - Check tasks have no circular dependencies
  - Check invoice totals match
  - Display validation warnings/errors
  - Allow override with confirmation

- **Finalization Buttons:**
  - "Finalize Order" → Change status to `pending_confirmation`
  - "Finalize & Send to Customer" → Placeholder (logs intent, shows message)
  - Both buttons run validation first
  - Confirmation dialog before finalizing

- **Post-Finalization:**
  - Track `finalized_at` timestamp
  - Track `finalized_by` user
  - Show "Return to Job Details Setup" button
  - On return: Confirm dialog, change status back
  - If changes made after finalization: Set flag, show warning

- **Change Tracking:**
  - Detect modifications after finalization
  - Show warning: "Changes made after details sent to customer"
  - Flag: `modified_after_finalization = TRUE`

**Files:**
- `/frontend/web/src/components/orders/finalization/FinalizationPanel.tsx` (new, ~200 lines)
- `/frontend/web/src/components/orders/finalization/ValidationChecklist.tsx` (new, ~150 lines)
- `/frontend/web/src/components/orders/finalization/ChangeWarning.tsx` (new, ~80 lines)
- `/backend/web/src/services/orderFinalizationService.ts` (new, ~180 lines)
- `/backend/web/src/routes/orders.ts` (add endpoints)

**API Endpoints:**
- `POST /api/orders/:orderNumber/validate` - Run validation
- `POST /api/orders/:orderNumber/finalize` - Finalize order
- `POST /api/orders/:orderNumber/finalize-and-send` - Finalize + send (placeholder)
- `POST /api/orders/:orderNumber/return-to-setup` - Revert to job_details_setup

---

## Data Flow: Estimate → Order

### Estimate Preview Structure (FIXED)

**Before Fix (Broken):**
```javascript
items: [
  { displayNumber: "1.", itemName: "Channel Letter 3"" },    // Wrong
  { displayNumber: "1.", itemName: "LEDs" },                 // Wrong
  { displayNumber: "1.", itemName: "Power Supply" },         // Wrong
  { displayNumber: "1a.", itemName: "Vinyl" },               // Wrong position
]
```

**After Fix (Correct):**
```javascript
items: [
  { displayNumber: "1", itemName: "Channel Letter 3"", ... },   // Parent
  { displayNumber: "1a", itemName: "LEDs", ... },               // Sub-part
  { displayNumber: "1b", itemName: "Power Supply", ... },       // Sub-part
  { displayNumber: "1c", itemName: "Vinyl", ... },              // Sub-part
  { displayNumber: "2", itemName: "ACM Panel", ... },           // Next parent
]
```

**Numbering Logic Fix (Helper Function Approach):**
1. Create helper function `assignEstimatePreviewNumbers(items, rowMetadata)`
2. Use `parentProductId` from metadata to find logical parent for Sub-Item rows
3. Group all items by their logical parent's display number
4. First component of each group → Base number ("1", "2", "3") with `isParent=true`
5. Additional components → Add letter suffix ("1a", "1b", "1c") with `isParent=false`
6. Sub-Item INPUT rows continue their parent's letter sequence

**Location:** `/frontend/web/src/components/jobEstimation/core/layers/CalculationLayer.ts`
- Add helper function before `createCalculationOperations()`
- Replace inline logic at lines 122-143 with function call

### Mapping to Order Table Rows

**Estimate Preview → Order Parts:**

| Estimate Item | Display # | Item Name | → | Order Row | Is Parent | Implicit Type |
|---|---|---|---|---|---|---|
| Component 1 | 1 | Channel Letter 3" | → | Row 1 | TRUE | both (specs + invoice) |
| Component 2 | 1a | LEDs (White 5mm) | → | Row 2 | FALSE | both (specs + invoice) |
| Component 3 | 1b | Power Supply (12V 5A) | → | Row 3 | FALSE | both (specs + invoice) |
| Component 4 | 1c | Vinyl | → | Row 4 | FALSE | invoice_only (no specs) |
| Component 5 | 2 | ACM Panel 24x36 | → | Row 5 | TRUE | both (specs + invoice) |

**Database Records:**
```sql
-- Row 1: Parent part (both specs + invoice)
INSERT INTO order_parts (
  order_id, part_number, display_number, is_parent,
  product_type, quantity, unit_price, extended_price,
  specifications, invoice_description
) VALUES (
  200001, 1, '1', TRUE,
  'Channel Letter - 3"', 8, 45.00, 360.00,
  '{"specs": [{"name": "Height", "spec1": "3 inch", "spec2": "Front Lit", "spec3": null}]}',
  'Channel Letter 3" Front Lit'
);

-- Row 2: Sub-part (both specs + invoice)
INSERT INTO order_parts (
  order_id, part_number, display_number, is_parent,
  product_type, quantity, unit_price, extended_price,
  specifications, invoice_description
) VALUES (
  200001, 2, '1a', FALSE,
  'LEDs', 8, 2.50, 20.00,
  '{"specs": [{"name": "LEDs", "spec1": "White", "spec2": "5mm", "spec3": "8 count"}]}',
  'LEDs White 5mm'
);

-- Row 4: Invoice-only (no specs)
INSERT INTO order_parts (
  order_id, part_number, display_number, is_parent,
  product_type, quantity, unit_price, extended_price,
  specifications, invoice_description
) VALUES (
  200001, 4, '1c', FALSE,
  'Vinyl', 1, 25.00, 25.00,
  NULL,  -- No specs = invoice-only
  'Vinyl application'
);
```

---

## Dual-Table Interface Design

### Visual Layout

**Note on Table Structure:**
- **CONTROLS Column:** Each row has a controls column (add, delete, drag handle, duplicate) that applies to BOTH the specs and invoice sections
- **Vertical Divider:** A vertical divider separates CONTROLS from ITEM NAME to clarify that controls affect the entire row (both sides)
- **Row Type:** Implicit based on data presence - no explicit indicators needed
  - If specs data exists: row has specs
  - If invoice data exists: row has invoice data
  - A row can have both, one, or neither (empty row)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ORDER #200001 - Job Details Setup                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Job Name: [Acme Corp Storefront Signs_________________]  Customer: [Acme▼] │
│                                                                             │
│ Customer PO#: [PO-12345___]  Customer Job#: [ACM-2024-11___]              │
│ Point Person: [john@acme.com__________]  Due Date: [2025-11-20▼]          │
│ Hard Due Date: [ ] Include time: [2:00 PM▼]                               │
│                                                                             │
│ Manufacturing Note: ┌────────────────────────────────────────────────────┐ │
│                     │ Use outdoor-rated materials. Customer prefers...   │ │
│                     └────────────────────────────────────────────────────┘ │
│ Internal Note:      ┌────────────────────────────────────────────────────┐ │
│ (Manager+ only)     │ Watch for rush requests, they pay late sometimes  │ │
│                     └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LEFT TABLE: JOB SPECS              │  RIGHT TABLE: INVOICE                │
│                                      │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Item Name │ Specs ▼   │ Tasks ▶     │ Item Name      │ Desc │ QTY │ Price │
├───────────┼───────────┼─────────────┼────────────────┼──────┼─────┼───────┤
│ Channel   │┌─────────┐│ [Collapsed] │ Channel Letter │Front │ 8   │$360.00│
│ Letter 3" ││Name: LED││             │ 3" Front Lit   │ Lit  │     │       │
│ (Parent)  ││S1: White││             │                │      │     │       │
│           ││S2: 5mm  ││             │                │      │     │       │
│           ││S3: 8ct  ││             │                │      │     │       │
│           │├─────────┤│             │                │      │     │       │
│           ││Name: PS ││             │                │      │     │       │
│           ││S1: 12V  ││             │                │      │     │       │
│           ││S2: 5A   ││             │                │      │     │       │
│           │└─────────┘│             │                │      │     │       │
├───────────┼───────────┼─────────────┼────────────────┼──────┼─────┼───────┤
│ LEDs      │┌─────────┐│ [Collapsed] │ LEDs           │White │ 8   │ $20.00│
│ (Sub-part)││Name: LED││             │                │ 5mm  │     │       │
│           ││S1: White││             │                │      │     │       │
│           ││S2: 5mm  ││             │                │      │     │       │
│           ││S3: 8ct  ││             │                │      │     │       │
│           │└─────────┘│             │                │      │     │       │
├───────────┼───────────┼─────────────┼────────────────┼──────┼─────┼───────┤
│ Power     │┌─────────┐│ [Collapsed] │ Power Supply   │12V   │ 2   │ $80.00│
│ Supply    ││Name: PS ││             │                │ 5A   │     │       │
│ (Sub-part)││S1: 12V  ││             │                │      │     │       │
│           ││S2: 5A   ││             │                │      │     │       │
│           ││S3: Ind. ││             │                │      │     │       │
│           │└─────────┘│             │                │      │     │       │
├───────────┼───────────┼─────────────┼────────────────┼──────┼─────┼───────┤
│ ACM Panel │┌─────────┐│ [Collapsed] │ ACM Panel      │24x36 │ 1   │$120.00│
│ 24x36     ││Name: Mnt││             │                │      │     │       │
│ (Parent)  ││S1: Stud ││             │                │      │     │       │
│           │└─────────┘│             │                │      │     │       │
└───────────┴───────────┴─────────────┴────────────────┴──────┴─────┴───────┘
```

### Cell Expansion States

**Specs Column - Expanded (Default):**
```
│ Specs ▼                     │
├─────────────────────────────┤
│ ┌─────┬──────┬─────┬──────┐│
│ │Name │ Spec1│ Spec2│Spec3││
│ ├─────┼──────┼──────┼──────┤│
│ │LEDs │White │ 5mm  │8 ct ││
│ ├─────┼──────┼──────┼──────┤│
│ │PS   │12V   │ 5A   │Indor││
│ └─────┴──────┴──────┴──────┘│
│ [+ Add Spec]                │
```

**Specs Column - Collapsed:**
```
│ Specs ▶      │
├──────────────┤
│ 2 specs      │
│ (Click to    │
│  expand)     │
```

**Tasks Column - Collapsed (Default):**
```
│ Tasks ▶      │
├──────────────┤
│ 3 tasks      │
│ (Click to    │
│  expand)     │
```

**Tasks Column - Expanded:**
```
│ Tasks ▼                     │
├─────────────────────────────┤
│ ┌────────────┬─────────────┐│
│ │Task        │Dependencies ││
│ ├────────────┼─────────────┤│
│ │Install LEDs│Cut channel  ││
│ ├────────────┼─────────────┤│
│ │Wire PS     │Install LEDs ││
│ ├────────────┼─────────────┤│
│ │Test LEDs   │Wire PS      ││
│ └────────────┴─────────────┘│
│ [+ Add Task]                │
```

---

## Technical Architecture

### Frontend Component Structure

```
frontend/web/src/components/orders/
├── details/
│   ├── OrderDetailsPage.tsx               [Router - status detection]
│   ├── JobDetailsSetupView.tsx            [Main container for job_details_setup]
│   ├── OrderInfoSection.tsx               [Top: editable order fields]
│   ├── DualTableLayout.tsx                [Container: left + right tables]
│   ├── JobSpecsTable.tsx                  [Left table component]
│   ├── InvoiceTable.tsx                   [Right table component]
│   ├── TableRow.tsx                       [Shared row component]
│   └── StandardPhaseView.tsx              [Other statuses - Phase 1 UI]
├── specs/
│   ├── SpecsCell.tsx                      [Expandable specs cell]
│   ├── SpecRow.tsx                        [Individual spec row inputs]
│   └── SpecsColumnHeader.tsx              [Header with expand/collapse]
├── tasks/
│   ├── TasksCell.tsx                      [Expandable tasks cell]
│   ├── TaskRow.tsx                        [Individual task row inputs]
│   └── TasksColumnHeader.tsx              [Header with expand/collapse]
├── rows/
│   ├── SeparatorRow.tsx                   [Visual divider row]
│   ├── RowTypeToggle.tsx                  [Switch: both/specs/invoice]
│   ├── RowActions.tsx                     [Add/delete/move buttons]
│   └── ParentRowIndicator.tsx             [Bold styling for parents]
├── finalization/
│   ├── FinalizationPanel.tsx              [Buttons + validation]
│   ├── ValidationChecklist.tsx            [List of issues/warnings]
│   └── ChangeWarning.tsx                  [Post-finalization notice]
├── modals/
│   ├── ApproveEstimateModal.tsx           [Confirmation on approve]
│   ├── AddRowModal.tsx                    [Add new row]
│   └── DuplicateRowModal.tsx              [Duplicate row: specs only, invoice only, or both]
└── shared/
    ├── ExpandableCell.tsx                 [Generic expand/collapse cell]
    ├── InlineEditInput.tsx                [Auto-expanding text input]
    └── EmptyCell.tsx                      [Gray background for empty cells]
```

### Backend Structure

```
backend/web/src/
├── services/
│   ├── orderConversionService.ts          [Enhanced: estimate → order rows]
│   ├── orderFinalizationService.ts        [NEW: validation + finalization]
│   └── estimatePreviewService.ts          [NEW: fix numbering logic]
├── routes/
│   └── orders.ts                          [Add finalization endpoints]
└── types/
    └── orders.ts                          [Updated: specs, tasks, row types]
```

### Database Schema

```sql
-- Updated orders table
CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  order_number INT UNIQUE NOT NULL,
  order_name VARCHAR(255) NOT NULL,
  customer_id INT NOT NULL,
  customer_po VARCHAR(100),
  customer_job_number VARCHAR(100),
  point_person_email VARCHAR(255),
  due_date DATE,
  hard_due_date_time DATETIME,
  manufacturing_note TEXT,
  internal_note TEXT,
  status ENUM('job_details_setup', 'pending_confirmation', ...) DEFAULT 'job_details_setup',
  finalized_at TIMESTAMP NULL,
  finalized_by INT NULL,
  modified_after_finalization BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  FOREIGN KEY (finalized_by) REFERENCES users(user_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Updated order_parts table
CREATE TABLE order_parts (
  part_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  part_number TINYINT UNSIGNED NOT NULL,
  display_number VARCHAR(10) NULL,  -- Nullable for invoice-only rows
  is_parent BOOLEAN DEFAULT FALSE,
  -- Note: Row "type" is implicit based on which columns are populated:
  --   - Both: specifications + invoice fields populated
  --   - Specs only: specifications populated, invoice fields NULL
  --   - Invoice only: specifications NULL, invoice fields populated

  -- Product info
  product_type VARCHAR(100),
  product_type_id VARCHAR(100),
  channel_letter_type_id INT NULL,
  base_product_type_id INT NULL,

  -- Invoice data (nullable)
  invoice_description TEXT NULL,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2) NULL,
  extended_price DECIMAL(10,2) NULL,

  -- Job specs data (nullable)
  specifications JSON NULL,  -- {"specs": [...], "specs_collapsed": false}
  production_notes TEXT,

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_letter_type_id) REFERENCES channel_letter_types(id),
  FOREIGN KEY (base_product_type_id) REFERENCES product_types(id),
  INDEX idx_display_number (display_number),
  INDEX idx_is_parent (is_parent)
);

-- order_tasks table (normalized, NOT JSON in order_parts)
CREATE TABLE order_tasks (
  task_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  part_id INT NULL COMMENT 'NULL for order-level tasks',
  task_name VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  completed_by INT NULL,
  assigned_role ENUM('designer','vinyl_cnc','painting','cut_bend','leds','packing'),
  depends_on_task_id INT NULL COMMENT 'FK to task_id - task that must complete first',
  started_at TIMESTAMP NULL,
  started_by INT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES order_tasks(task_id) ON DELETE SET NULL,
  FOREIGN KEY (completed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (started_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_part (part_id),
  INDEX idx_completed (completed),
  INDEX idx_assigned_role (assigned_role),
  INDEX idx_depends_on (depends_on_task_id)
);
```

---

## Implementation Timeline

### Week 1: Foundation
- **Days 1-4:** Phase 1.5.a (Fix numbering + order creation)
- **Day 5:** Phase 1.5.b (Database schema updates)

### Week 2: Core UI
- **Days 6-10:** Phase 1.5.c (Job Details Setup layout + dual tables)

### Week 3: Dynamic Features
- **Days 11-14:** Phase 1.5.d (Specs & tasks expansion)
- **Days 15-16:** Phase 1.5.e (Separators & row management)

### Week 4: Finalization & Testing
- **Days 17-19:** Phase 1.5.f (Finalization workflow)
- **Days 20-22:** Integration testing
- **Days 23-24:** Bug fixes and polish

**Total: ~4 weeks (24 working days)**

---

## Success Criteria

Phase 1.5 is COMPLETE when:

1. ✅ **DONE & TESTED (2025-11-06)** - Estimate Preview numbering fixed (1, 1a, 1b, 1c)
2. ✅ **DONE & TESTED (2025-11-06)** - No duplicate numbers in Estimate Preview
3. ✅ **DONE & TESTED (2025-11-06)** - Multiple parent items numbered sequentially (1, 2, 3...)
4. ✅ **DONE & TESTED (2025-11-06)** - Sub-Item rows continue parent's letter sequence
5. ✅ **DONE & TESTED (2025-11-06)** - Sequential base numbering regardless of input grid gaps
6. ✅ **DONE & TESTED (2025-11-06)** - Edge cases handled (Empty Row, Divider, Subtotal)
7. ✅ **DONE & TESTED (2025-11-06)** - EstimateTable displays correct field
8. ✅ **DONE & TESTED (2025-11-06)** - No console errors or warnings
9. ⏳ Estimate approval creates order automatically
10. ⏳ "Go to Order" button navigates to order page
11. ⏳ Order opens in Job Details Setup interface
12. ⏳ Dual-table layout displays correctly
13. ⏳ All estimate data auto-populates accurately
14. ⏳ Parent/sub-part relationships preserved
15. ⏳ Specs expand/collapse per item (default: expanded)
16. ⏳ Tasks expand/collapse per item (default: collapsed)
17. ⏳ Separator rows auto-insert between parents
18. ⏳ Row types work (both, specs-only, invoice-only, separator)
19. ⏳ Empty cells show medium gray background
20. ⏳ All fields editable inline
21. ⏳ Add/delete/reorder rows works
22. ⏳ Validation system catches missing data
23. ⏳ Finalization changes status to pending_confirmation
24. ⏳ Return to Job Details Setup button works
25. ⏳ Change tracking after finalization works
26. ⏳ No data loss during any operation
27. ⏳ Phase 1.h E2E tests pass

---

## Related Documentation

- **UI/UX Design:** `Nexus_Orders_Phase1.5_UI_Design.md` (to be created)
- **Sub-Phase Details:**
  - `Nexus_Orders_Phase1.5a_NumberingFix.md`
  - `Nexus_Orders_Phase1.5a.5_ApproveModalEnhancements.md` ← **NEW**
  - `Nexus_Orders_Phase1.5b_DatabaseSchema.md`
  - `Nexus_Orders_Phase1.5c_DualTableUI.md`
  - `Nexus_Orders_Phase1.5d_SpecsAndTasks.md`
  - `Nexus_Orders_Phase1.5e_RowManagement.md`
  - `Nexus_Orders_Phase1.5f_Finalization.md`
- **Phase 1 Summary:** `Nexus_Orders_Phase1_SUMMARY.md`
- **Phase 1.h Testing:** `Nexus_Orders_Phase1h_TestResults.md`

---

**Document Status:** ✅ 100% COMPLETE - All phases DONE
**Last Updated:** 2025-12-09
**Completed Phases:**
- Phase 1.5.a: Numbering fix + order creation ✅ (2025-11-06)
- Phase 1.5.a.5: ApproveEstimateModal enhancements ✅ (2025-11-06)
- Phase 1.5.b: Database schema updates ✅ (2025-11-06)
- Phase 1.5.c.1: Frontend API Layer ✅ (2025-11-07)
- Phase 1.5.c.2: Order Template System ✅ (2025-11-07)
- Phase 1.5.c.3: Snapshot & Versioning (unlimited history) ✅ (2025-11-06)
- Phase 1.5.c.4: Task Management UI ✅ (2025-11-07)
- Phase 1.5.c.5: Dual-Table Core UI ✅ (2025-11-07)
- **Phase 1.5.c.6: Order Preparation Workflow ✅ (2025-11-18 to 2025-11-20)**
- **Phase 1.5.c.6.3: Send to Customer (Gmail Integration) ✅ (2025-11-25)**
- **Phase 1.5.d: Task Generation System ✅ (2025-11-21 to 2025-11-24)**
- **Phase 1.5.e: Row Operations Polish ✅ (2025-12-09)**
  - DuplicateRowModal with 3 options (Specs Only, Invoice Only, Both)
  - Full backend API integration (controller, service, route)
- **Phase 1.5.g: Order Folder & Image Management ✅ (2025-11-12)**

**Production Stats (as of 2025-12-09):**
- 2,064+ orders in database
- 68 frontend components, 28 backend services

**Next Steps:**
1. **Phase 2.a - Tasks Table** (IN PROGRESS) - See `Nexus_Orders_Phase2a_TasksTable.md`
   - NEW tab for part-level task management with dependency visualization
2. Phase 2.b - Calendar View
3. Phase 2.c - Completed Jobs archive
4. Phase 2.d - Email notifications automation
5. Phase 2.e - QuickBooks Invoice Automation
