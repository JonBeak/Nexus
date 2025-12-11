# Phase 2.a: Tasks Table Feature Specification

**Status:** Implemented (Core Features)
**Priority:** HIGH
**Parent Phase:** Phase 2 - Essential Features
**Last Updated:** 2025-12-10

---

## Overview

The Tasks Table is a NEW tab in the Orders page that provides part-level task management. Unlike the Jobs Table (order-level), each row represents an individual order part with all its tasks displayed as columns.

---

## Key Differentiator

| Table | Row Granularity | Primary Use |
|-------|-----------------|-------------|
| Jobs Table | One row per ORDER | Order overview, status tracking |
| **Tasks Table** | One row per ORDER PART | Task management, completion tracking |

---

## User Interface Design

### Tab Addition

```
OrdersPage Tabs:
┌──────────┬─────────────────┬────────────┬──────────────┐
│Dashboard │ Role-based Tasks│ Jobs Table │ Tasks Table  │
└──────────┴─────────────────┴────────────┴──────────────┘
                                              ↑ NEW
```

### Task View Layout

One column per task with diagonalized headers, ordered by the existing `TASK_ORDER`.

**Column Strategy:** Consolidate Order+Part#+Scope into single column to maximize task column space.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Hide Completed ☐]    [Filter ▼]    [Search 🔍]                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                          ╱Vinyl  ╱CNC    ╱Cut&  ╱Paint ╱LEDs  ╱Assem       │
│                                          ╱Plot   ╱Router ╱Bend  ╱      ╱      ╱bly         │
│ ☐ │ Order / Part               │Due     │       │       │      │      │      │             │
├───┼────────────────────────────┼────────┼───────┼───────┼──────┼──────┼──────┼─────────────┤
│ ☐ │ 200001-1                   │ 12/15  │  ✓    │  ✓    │  ✓   │  ◯   │  ◯   │  ◯          │
│   │ Channel Letter (8 letters) │        │       │       │      │      │      │             │
│ ☐ │ 200001-1a                  │ 12/15  │  -    │  -    │  -   │  -   │  ✓   │  -          │
│   │ LEDs (White 5mm)           │        │       │       │      │      │      │             │
│ ☐ │ 200002-1                   │ 12/16  │  ✓    │  ◯    │  ◯   │  ◯   │  -   │  ◯          │
│   │ ACM Panel (24x36)          │        │       │       │      │      │      │             │
└───┴────────────────────────────┴────────┴───────┴───────┴──────┴──────┴──────┴─────────────┘

Legend: ✓ = Complete, ◯ = Pending, - = N/A for this part
```

**Column Layout:**
1. **Selection** - Checkbox (narrow)
2. **Order / Part** - Two-line display:
   - Line 1: `{orderNumber}-{displayNumber}` (clickable link)
   - Line 2: `{productType} ({scope})` in smaller/muted text
3. **Due** - Due date (compact: MM/DD)
4. **Task Columns** - One per task in TASK_ORDER, only shown if task exists in dataset

**Scope Field:** Optional field on parent parts. If empty, show only Product Type.

---

## Task Column Order

Uses existing `TASK_ORDER` from `/backend/web/src/services/taskGeneration/taskRules.ts`:

| # | Task Name | Role |
|---|-----------|------|
| 1 | Vinyl Plotting | designer |
| 2 | Sanding (320) before cutting | painter |
| 3 | Scuffing before cutting | painter |
| 4 | Paint before cutting | painter |
| 5 | Vinyl Face Before Cutting | vinyl_applicator |
| 6 | Vinyl Wrap Return/Trim | vinyl_applicator |
| 7 | CNC Router Cut | cnc_router_operator |
| 8 | Laser Cut | manager |
| 9 | Cut & Bend Return | cut_bender_operator |
| 10 | Cut & Bend Trim | cut_bender_operator |
| 11 | Sanding (320) after cutting | painter |
| 12 | Scuffing after cutting | painter |
| 13 | Paint After Cutting | painter |
| 14 | Backer/Raceway Bending | backer_raceway_fabricator |
| 15 | Paint After Bending | painter |
| 16 | Vinyl Face After Cutting | vinyl_applicator |
| 17 | Trim Fabrication | trim_fabricator |
| 18 | Return Fabrication | return_fabricator |
| 19 | Return Gluing | return_gluer |
| 20 | Mounting Hardware | mounting_assembler |
| 21 | Face Assembling | face_assembler |
| 22 | LEDs | led_installer |
| 23 | Backer/Raceway Fabrication | backer_raceway_fabricator |
| 24 | Vinyl after Fabrication | vinyl_applicator |
| 25 | Paint after Fabrication | painter |
| 26 | Assembly | backer_raceway_assembler |

**Dynamic Column Visibility:** Only show columns for tasks that exist in the current data set.

---

## Column Headers

- **Diagonalized (45-degree angle)** for compactness
- **Color-coded by role** (background tint)
- Task name displayed at angle

---

## Color Coding by Role

| Color Category | Color | Hex | ProductionRole Values |
|----------------|-------|-----|----------------------|
| Design/Vinyl | Blue | #3B82F6 | `designer`, `vinyl_applicator` |
| Painter | Purple | #A855F7 | `painter` |
| LEDs | Yellow | #EAB308 | `led_installer` |
| Cut & Bend | Orange | #F97316 | `cut_bender_operator` |
| CNC Router | Red | #EF4444 | `cnc_router_operator` |
| Fabricators | Teal | #14B8A6 | `trim_fabricator`, `return_fabricator`, `return_gluer`, `mounting_assembler`, `face_assembler`, `backer_raceway_fabricator`, `backer_raceway_assembler` |
| Manager | Gray | #6B7280 | `manager` |

---

## Cell States

| State | Display | Description |
|-------|---------|-------------|
| Complete | `✓` (green) | Task completed |
| Pending | `◯` (outline) | Task not yet done |
| N/A | `-` (gray) | Task doesn't apply to this part |

Cell background color matches the task's assigned role.

---

## Interaction Behaviors

### Row Clicks
- **Order # + Part #**: Opens order details page
- **Task cell**: Toggles task completion (if user has permission)
- **Row background**: No action

### Batch Actions
When one or more rows are selected:
```
┌────────────────────────────────────────────────────────────────────┐
│ 3 parts selected    [Mark Complete ▼]  [Export]  [Clear Selection] │
└────────────────────────────────────────────────────────────────────┘
```

### Filtering
- By order status
- By due date range
- By role (show only parts with tasks for specific role)
- By completion status (pending/complete/all)

### Sorting
**Default:** Due Date → Order # → Part Number

Sortable columns:
- Order # + Part #
- Product Type
- Due Date

---

## Database Query

```sql
SELECT
  op.part_id,
  op.order_id,
  o.order_number,
  op.display_number,
  op.product_type,
  op.specifications,
  o.due_date,
  o.status,
  ot.task_id,
  ot.task_name,
  ot.assigned_role,
  ot.completed,
  ot.completed_at,
  ot.completed_by
FROM order_parts op
JOIN orders o ON op.order_id = o.order_id
LEFT JOIN order_tasks ot ON op.part_id = ot.part_id
WHERE o.status NOT IN ('completed', 'cancelled')
ORDER BY o.due_date, o.order_number, op.part_number;
```

---

## Component Structure

```
frontend/web/src/components/orders/tasksTable/
├── TasksTable.tsx           # Main table component
├── TasksTableHeader.tsx     # Filters, search, hide completed toggle
├── DiagonalHeader.tsx       # Angled column header component
├── PartRow.tsx              # Single part row
├── TaskCell.tsx             # Task completion cell
├── BatchActionsBar.tsx      # Actions when items selected
└── hooks/
    └── usePartsWithTasks.ts # Data fetching hook
```

---

## API Endpoints

### GET /api/orders/parts/with-tasks (NEW)

Returns all parts with their tasks for the Tasks Table.

**Query Parameters:**
- `status` - Filter by order status (optional)
- `hideCompleted` - Hide parts with all tasks completed (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "partId": 1,
      "orderId": 200001,
      "orderNumber": 200001,
      "displayNumber": "1",
      "productType": "Channel Letter",
      "scope": "8 letters front-lit",
      "dueDate": "2025-12-15",
      "status": "in_production",
      "tasks": [
        {
          "taskId": 101,
          "taskName": "Vinyl Plotting",
          "role": "designer",
          "completed": true,
          "completedAt": "2025-12-10T14:30:00Z"
        },
        {
          "taskId": 102,
          "taskName": "CNC Router Cut",
          "role": "cnc_router_operator",
          "completed": false
        }
      ]
    }
  ]
}
```

### PUT /api/orders/tasks/batch-update (EXISTING)

**Use existing endpoint** for task completion toggle. Single task updates wrap this endpoint.

**Request:**
```json
{
  "updates": [
    { "task_id": 101, "completed": true }
  ]
}
```

**Note:** No new toggle endpoint needed - reuse existing batch API.

---

## Implementation Sub-Phases

### Phase 2.a.1: Core Table Structure ✅ COMPLETE
- [x] Create `TasksTable.tsx` base component
- [x] Add "Tasks Table" tab to `OrdersPage.tsx`
- [x] Implement left columns (selection, order/part info, due date)
- [x] Default sorting by due date → order # → part number
- [x] Basic row rendering

### Phase 2.a.2: Task Columns ✅ COMPLETE
- [x] Create `DiagonalHeader.tsx` component (45-degree angled text)
- [x] Implement role color coding using TASK_ROLE_MAP
- [x] Create `TaskCell.tsx` with completion states (✓, ◯, -)
- [x] Use TASK_ORDER for column sequence
- [x] Dynamic column visibility (only show tasks that exist in data)
- [x] Task completion toggle on cell click (uses existing batch API)

### Phase 2.a.3: Backend Part Data ✅ COMPLETE
- [x] Create `/api/orders/parts/with-tasks` endpoint
- [x] Optimize query for performance (JOIN parts + orders + tasks)
- [x] Add filtering support (status, hideCompleted, search)
- [x] Add sorting support (client-side)

### Phase 2.a.4: Batch Actions & Polish (PARTIAL)
- [x] Basic selection and clear selection
- [x] Hide/show completed tasks toggle
- [ ] Full `BatchActionsBar.tsx` component with bulk actions
- [ ] "Mark Complete" dropdown for selected tasks
- [ ] Export functionality (CSV/PDF)
- [ ] Status filter dropdown
- [ ] Performance optimization for large datasets
- [ ] Cross-browser testing

---

## FUTURE FEATURE: Step View with Dependencies

> **Deferred to future phase.** When implemented, Step View would:
> - Group tasks by dependency level (Step 1, Step 2, etc.)
> - Show parallel vs sequential tasks
> - Draw SVG connector lines between dependent tasks
> - Global toggle between Task View and Step View

---

## Testing Checklist

- [ ] Table loads with all parts and tasks
- [ ] Task View shows correct diagonalized headers
- [ ] Columns ordered by TASK_ORDER
- [ ] Only columns for existing tasks are shown
- [ ] Task completion toggle works
- [ ] Role color coding is correct
- [ ] Batch actions work on selected items
- [ ] Sorting works correctly
- [ ] Filtering by role/status works
- [ ] Performance acceptable with 500+ parts

---

## Related Documentation

- `Nexus_OrdersPage_Overview.md` - System overview
- `Nexus_Orders_Phase1.5_OVERVIEW.md` - Phase 1.5 completion
- `/backend/web/src/services/taskGeneration/taskRules.ts` - TASK_ORDER and TASK_ROLE_MAP
- `/home/jon/.claude/plans/greedy-singing-sloth.md` - Phase 2 plan

---

**Document Status:** Ready for Implementation
**Next Action:** Phase 2.a.1 - Core Table Structure
