# Task System Unification Plan

## Problem Statement

The Nexus Orders system currently has **two disconnected sources of truth** for tasks:

1. **Task Generation Rules** (`/backend/web/src/services/taskGeneration/taskRules.ts`)
   - Defines 26 production tasks in `TASK_ORDER`
   - Maps tasks to roles in `TASK_ROLE_MAP`
   - Used when generating tasks for NEW orders based on part specifications

2. **Database Tasks** (`order_tasks` table)
   - Contains only tasks that were actually generated for specific orders
   - May contain legacy tasks that no longer exist in the rules
   - May be missing tasks that should exist based on current rules

---

## Current State Analysis

### Task Generation System (taskRules.ts)

**TASK_ORDER** (26 production tasks in workflow sequence):
```
1.  Vinyl Plotting
2.  Sanding (320) before cutting
3.  Scuffing before cutting
4.  Paint before cutting
5.  Vinyl Face Before Cutting
6.  Vinyl Wrap Return/Trim
7.  CNC Router Cut
8.  Laser Cut
9.  Cut & Bend Return
10. Cut & Bend Trim
11. Sanding (320) after cutting
12. Scuffing after cutting
13. Paint After Cutting
14. Backer/Raceway Bending
15. Paint After Bending
16. Vinyl Face After Cutting
17. Trim Fabrication
18. Return Fabrication
19. Return Gluing
20. Mounting Hardware
21. Face Assembling
22. LEDs
23. Backer/Raceway Fabrication
24. Vinyl after Fabrication
25. Paint after Fabrication
26. Assembly
```

**Status-Based Tasks** (NOT in TASK_ORDER - tracked via order.status):
- Design Files → `pending_production_files_creation` status
- Design Approval → `pending_production_files_approval` status
- Quality Control → `qc_packing` status
- Packing → `qc_packing` status

### Database Reality (order_tasks table)

Current unique task names in database:
```sql
SELECT DISTINCT task_name, COUNT(*) FROM order_tasks GROUP BY task_name;
```

Results show:
- Some valid production tasks (CNC Router Cut, LEDs, etc.)
- Legacy status-based tasks still exist (Design Files, Design Approval, Quality Control, Packing)
- Only 2 painting tasks exist (Paint before cutting, Scuffing before cutting)
- Many TASK_ORDER tasks have never been generated (no orders with matching specs)

---

## Root Causes

### 1. Task Generation is Spec-Driven
Tasks are only created when an order's parts have specifications that trigger them:
- Painting specs → Painting tasks
- Return spec → Cut & Bend Return, Return Fabrication, Return Gluing
- Face spec → CNC Router Cut
- etc.

**Problem**: If no orders have Painting specs, no painting tasks exist in the database.

### 2. Legacy Data from Before Status-Based Tracking
Before the system moved to status-based tracking for design/QC/packing:
- `Design Files` and `Design Approval` were per-part tasks
- `Quality Control` and `Packing` were per-part tasks

These still exist in the database for old orders.

### 3. No Task Regeneration on Rule Changes
When task generation rules are updated:
- New orders get correct tasks
- Existing orders are NOT updated
- No mechanism to "sync" existing orders with current rules

### 4. Manual Task Addition Uses Same Template List
The "Add Task" dropdown (Job Progress tab) uses `TASK_ROLE_MAP` which includes:
- All 26 production tasks
- Plus legacy tasks (Design Files, Design Approval, QC & Packing)

---

## Proposed Solution

### Phase 1: Clean Up TASK_ROLE_MAP

Remove status-based tasks from `TASK_ROLE_MAP` since they shouldn't be manually addable:

```typescript
// REMOVE from TASK_ROLE_MAP:
// 'Design Files': 'designer',
// 'Design Approval': 'manager',
// 'QC & Packing': 'qc_packer',
```

**Files to modify:**
- `/backend/web/src/services/taskGeneration/taskRules.ts`
- `/frontend/web/src/components/orders/tasksTable/roleColors.ts`

### Phase 2: Database Cleanup Script

Create a migration/script to clean legacy tasks:

```sql
-- Option A: Delete status-based tasks (if they're truly obsolete)
DELETE FROM order_tasks
WHERE task_name IN ('Design Files', 'Design Approval', 'Quality Control', 'Packing', 'QC & Packing');

-- Option B: Archive them to a separate table first (safer)
CREATE TABLE order_tasks_legacy AS
SELECT * FROM order_tasks
WHERE task_name IN ('Design Files', 'Design Approval', 'Quality Control', 'Packing', 'QC & Packing');

DELETE FROM order_tasks
WHERE task_name IN ('Design Files', 'Design Approval', 'Quality Control', 'Packing', 'QC & Packing');
```

### Phase 3: Task Regeneration Tool (Optional)

Create an admin tool to regenerate tasks for existing orders:

**Use Cases:**
1. Order's specs changed → regenerate tasks
2. Task rules updated → bulk regenerate for affected orders
3. Manual trigger for specific order

**Implementation:**
- New endpoint: `POST /api/orders/:orderNumber/regenerate-tasks`
- Options:
  - `preserveCompleted: true` - Don't remove completed tasks
  - `addMissing: true` - Only add tasks that should exist but don't
  - `removeExtra: true` - Remove tasks that shouldn't exist based on specs

### Phase 4: Tasks Table Column Strategy

**Current approach** (implemented): Show ALL 26 columns from TASK_ORDER
- Pros: Consistent layout, see all possible tasks
- Cons: Many empty columns for simple orders

**Alternative approach**: Dynamic columns based on data
- Pros: Compact view, only relevant columns
- Cons: Inconsistent layout between page loads

**Recommendation**: Keep current approach (all columns) but add:
- Column visibility toggle
- Filter by role to show subset of columns

---

## Data Model Considerations

### Current Schema
```sql
CREATE TABLE order_tasks (
  task_id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  part_id INT NOT NULL,
  task_name VARCHAR(100) NOT NULL,
  assigned_role VARCHAR(50),
  sort_order INT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  completed_by INT,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id)
);
```

### Potential Enhancement: Task Templates Table
```sql
CREATE TABLE task_templates (
  template_id INT PRIMARY KEY AUTO_INCREMENT,
  task_name VARCHAR(100) NOT NULL UNIQUE,
  assigned_role VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  category VARCHAR(50), -- 'cutting', 'painting', 'fabrication', etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Benefits:**
- Single source of truth for task definitions
- Easy to add/modify tasks without code changes
- Can track task history/changes
- Frontend and backend pull from same source

---

## Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| HIGH | Phase 1: Clean TASK_ROLE_MAP | Low | Prevents adding obsolete tasks |
| HIGH | Phase 2: Database cleanup | Low | Removes legacy data |
| MEDIUM | Phase 4: Column visibility | Medium | Better UX |
| LOW | Phase 3: Regeneration tool | High | Edge case utility |
| LOW | Task Templates table | High | Architecture improvement |

---

## Questions to Resolve

1. **Should we delete legacy tasks or archive them?**
   - If orders with legacy tasks are still active, deleting might lose history
   - Archive table preserves data for reference

2. **What happens to completed legacy tasks?**
   - If "Design Approval" was marked complete, that info is valuable
   - Could migrate completion status to order audit log

3. **Should task regeneration be automatic or manual?**
   - Automatic: When specs change, tasks update
   - Manual: Admin explicitly triggers regeneration
   - Hybrid: Notify admin when tasks might be stale

4. **Do we need task versioning?**
   - Track which version of rules generated a task
   - Allow rollback if rules change breaks things

---

## Next Steps

1. [ ] Review and approve this plan
2. [ ] Decide on legacy task handling (delete vs archive)
3. [ ] Implement Phase 1 (clean TASK_ROLE_MAP)
4. [ ] Create and test Phase 2 database migration
5. [ ] Update documentation (Nexus_Orders_TaskGeneration.md)

---

## Related Documentation

- `/home/jon/Nexus/Nexus_Orders_TaskGeneration.md` - Task generation specification
- `/home/jon/Nexus/Nexus_Orders_Phase2a_TasksTable.md` - Tasks Table feature spec
- `/backend/web/src/services/taskGeneration/` - Task generation code
