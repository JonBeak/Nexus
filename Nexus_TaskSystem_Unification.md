# Task System Unification Plan

**Status:** ✅ COMPLETE (Dec 2025)
**Last Updated:** 2025-12-11

---

## Summary

This plan addressed the disconnection between task generation rules and database tasks. All critical phases have been completed.

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Clean TASK_ROLE_MAP | ✅ COMPLETE | Legacy tasks removed from code |
| Phase 2: Database Cleanup | ✅ NOT NEEDED | No legacy tasks exist in database |
| Phase 3: Task Regeneration Tool | ⏸️ DEFERRED | Optional future enhancement |
| Phase 4: Column Visibility | ✅ COMPLETE | 11 core + 15 auto-hide columns |

---

## Problem Statement (Historical)

The Nexus Orders system had **two disconnected sources of truth** for tasks:

1. **Task Generation Rules** (`/backend/web/src/services/taskGeneration/taskRules.ts`)
   - Defines 26 production tasks in `TASK_ORDER`
   - Maps tasks to roles in `TASK_ROLE_MAP`
   - Used when generating tasks for NEW orders based on part specifications

2. **Database Tasks** (`order_tasks` table)
   - Contains only tasks that were actually generated for specific orders
   - Could contain legacy tasks that no longer exist in the rules
   - Could be missing tasks that should exist based on current rules

---

## Phase 1: Clean TASK_ROLE_MAP ✅ COMPLETE

**Goal:** Remove status-based tasks from `TASK_ROLE_MAP` since they shouldn't be manually addable.

**Implementation:**
- `TASK_ROLE_MAP` in `taskRules.ts:67-95` contains ONLY the 26 production tasks
- Legacy tasks (`Design Files`, `Design Approval`, `QC & Packing`) are NOT included
- Comment at line 64 explicitly documents this decision
- Deprecated `generateBaseTasks()` and `generateClosingTasks()` functions kept for reference

**Files modified:**
- `/backend/web/src/services/taskGeneration/taskRules.ts`

---

## Phase 2: Database Cleanup ✅ NOT NEEDED

**Goal:** Clean legacy status-based tasks from `order_tasks` table.

**Verification (Dec 2025):**
```sql
SELECT task_name, COUNT(*) FROM order_tasks
WHERE task_name IN ('Design Files', 'Design Approval', 'Quality Control', 'Packing', 'QC & Packing')
GROUP BY task_name;
-- Result: 0 rows - No legacy tasks exist
```

**Current database state:**
- 45 total tasks across 3 orders
- All task names are valid production tasks from `TASK_ORDER`
- No cleanup required

**Task distribution in database:**
| Task Name | Count |
|-----------|-------|
| CNC Router Cut | 10 |
| Cut & Bend Return | 5 |
| Return Fabrication | 5 |
| Return Gluing | 5 |
| Cut & Bend Trim | 4 |
| Trim Fabrication | 4 |
| LEDs | 4 |
| Mounting Hardware | 3 |
| Backer/Raceway Fabrication | 2 |
| Assembly | 2 |
| Paint before cutting | 1 |

---

## Phase 3: Task Regeneration Tool ⏸️ DEFERRED

**Goal:** Admin tool to regenerate tasks for existing orders when specs change.

**Status:** Deferred to optional future enhancement.

**Rationale:**
- Current workflow handles task generation via "Prepare Order" modal
- Re-running "Prepare Order" achieves same result for individual orders
- Low frequency use case doesn't justify implementation effort
- Can revisit if bulk regeneration becomes necessary

**If implemented later:**
- New endpoint: `POST /api/orders/:orderNumber/regenerate-tasks`
- Options: `preserveCompleted`, `addMissing`, `removeExtra`

---

## Phase 4: Column Visibility ✅ COMPLETE

**Goal:** Smart column visibility strategy for Tasks Table.

**Implementation:**
- **11 core task columns** always visible (main production workflow)
- **15 optional task columns** auto-hide when no data exists
- Single source of truth via `GET /api/orders/metadata/tasks` API
- Frontend `TaskMetadataResource.ts` caches metadata for 30 minutes

**Core tasks (always visible):**
1. CNC Router Cut
2. Cut & Bend Return
3. Cut & Bend Trim
4. Trim Fabrication
5. Return Fabrication
6. Return Gluing
7. Mounting Hardware
8. Face Assembly
9. LEDs
10. Backer/Raceway Fabrication
11. Assembly

**Auto-hide tasks (shown when data exists):**
- Vinyl-related: Vinyl Plotting, Vinyl Face Before/After Cutting, Vinyl Wrap Return/Trim, Vinyl after Fabrication
- Paint-related: All 8 painting tasks (sanding, scuffing, paint before/after cutting/bending/fabrication)
- Laser Cut, Backer/Raceway Bending

---

## Single Source of Truth API

**Endpoint:** `GET /api/orders/metadata/tasks`

**Response:**
```json
{
  "success": true,
  "data": {
    "taskOrder": ["Vinyl Plotting", "Sanding (320) before cutting", ...],
    "taskRoleMap": {
      "Vinyl Plotting": "designer",
      "CNC Router Cut": "cnc_router_operator",
      ...
    },
    "autoHideColumns": ["Vinyl Plotting", "Sanding (320) before cutting", ...]
  }
}
```

**Files:**
- Backend: `/backend/web/src/controllers/orders/TaskMetadataController.ts`
- Frontend: `/frontend/web/src/services/taskMetadataResource.ts`
- Source: `/backend/web/src/services/taskGeneration/taskRules.ts`

---

## Task Order Reference

The canonical 26-task workflow sequence (from `taskRules.ts`):

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
| 21 | Face Assembly | face_assembler |
| 22 | LEDs | led_installer |
| 23 | Backer/Raceway Fabrication | backer_raceway_fabricator |
| 24 | Vinyl after Fabrication | vinyl_applicator |
| 25 | Paint after Fabrication | painter |
| 26 | Assembly | backer_raceway_assembler |

**Status-based tasks** (tracked via `order.status`, NOT in task table):
- Design Files → `pending_production_files_creation` status
- Design Approval → `pending_production_files_approval` status
- Quality Control → `qc_packing` status
- Packing → `qc_packing` status

---

## Related Documentation

- `/home/jon/Nexus/Nexus_Orders_TaskGeneration.md` - Task generation specification
- `/home/jon/Nexus/Nexus_Orders_Phase2a_TasksTable.md` - Tasks Table feature spec
- `/backend/web/src/services/taskGeneration/` - Task generation code

---

**Document Status:** ✅ COMPLETE
**Completion Date:** 2025-12-11
