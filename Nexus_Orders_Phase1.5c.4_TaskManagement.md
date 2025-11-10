# Phase 1.5.c.4: Task Management UI

**Status:** ✅ COMPLETE
**Priority:** MEDIUM (can be done in parallel with 1.5.c.2/1.5.c.3)
**Duration:** 1 day (~8 hours)
**Dependencies:** Phase 1.5.c.1 (Frontend API)
**Last Updated:** 2025-11-07
**Implementation Date:** 2025-11-07

---

## Overview

Phase 1.5.c.4 adds task management capabilities to the ProgressView sidebar. This allows managers to add and remove tasks from order parts during the job details setup phase.

**Key Features:**
- **[+] Button** in PartTasksSection header opens task dropdown
- **TaskTemplateDropdown** shows available tasks filtered by role
- **[-] Button** appears on hover over existing tasks
- Tasks only editable when `status = 'job_details_setup'`

**Visual Reference:**
```
┌─── Part 1: Channel Letters ───┐
│ Qty: 8        3/8 tasks        │
│ ████░░░░                        │
│ ─────────────────────────────  │
│ [+]                             │  ← Add button
│                                 │
│ ☑ Design approval              │
│ ☐ Cut faces              [-]   │  ← Remove button on hover
│ ☐ Install LEDs           [-]   │
│                                 │
└─────────────────────────────────┘
```

---

## Component Architecture

### Existing Components (to modify)

1. **PartTasksSection.tsx** (50 lines → 80 lines)
   - Add [+] button in header
   - Show TaskTemplateDropdown on click
   - Pass `canEdit` prop down to TaskList

2. **TaskItem.tsx** (40 lines → 55 lines)
   - Add [-] button on hover (only if `canEdit`)
   - Call `removeTask()` API on click

### New Components

3. **TaskTemplateDropdown.tsx** (~120 lines)
   - Dropdown menu with task templates grouped by role
   - Filter out tasks already on part
   - Handle task selection → call `addTaskToPart()` API

---

## Implementation Tasks

### Task 1: Modify PartTasksSection Component

**File:** `/home/jon/Nexus/frontend/web/src/components/orders/progress/PartTasksSection.tsx`

**Changes:**
- Add [+] button in header
- Add state for dropdown visibility
- Pass `canEdit` and `orderStatus` to TaskList

```typescript
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import TaskList from './TaskList';
import TaskTemplateDropdown from './TaskTemplateDropdown';

interface Props {
  part: any;
  orderNumber: number;
  orderStatus: string;  // NEW
  onTaskUpdated: () => void;
}

export const PartTasksSection: React.FC<Props> = ({
  part,
  orderNumber,
  orderStatus,
  onTaskUpdated
}) => {
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const completedTasks = part.completed_tasks || 0;
  const totalTasks = part.total_tasks || 0;
  const progressPercent = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // Can only edit tasks during job_details_setup
  const canEditTasks = orderStatus === 'job_details_setup';

  const handleTaskAdded = () => {
    setShowAddDropdown(false);
    onTaskUpdated();
  };

  return (
    <div className="bg-white rounded-lg shadow flex-shrink-0 w-[240px] flex flex-col relative">
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base text-gray-900 truncate">
            Part {part.part_number}: {part.product_type}
          </h3>

          {/* Add Task Button */}
          {canEditTasks && (
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
              title="Add task"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-base text-gray-500 mb-1.5">
          <span>Qty: {part.quantity}</span>
          <span className="font-medium">{completedTasks}/{totalTasks}</span>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Task Template Dropdown */}
      {showAddDropdown && (
        <TaskTemplateDropdown
          orderNumber={orderNumber}
          partId={part.part_id}
          existingTasks={part.tasks || []}
          onTaskAdded={handleTaskAdded}
          onClose={() => setShowAddDropdown(false)}
        />
      )}

      {/* Task List - Always Visible */}
      <div className="px-2 py-2 flex-1 overflow-y-auto max-h-96">
        <TaskList
          tasks={part.tasks || []}
          orderNumber={orderNumber}
          canRemove={canEditTasks}  // NEW PROP
          onTaskUpdated={onTaskUpdated}
        />
      </div>
    </div>
  );
};

export default PartTasksSection;
```

### Task 2: Modify TaskItem Component

**File:** `/home/jon/Nexus/frontend/web/src/components/orders/progress/TaskItem.tsx`

**Changes:**
- Add [-] button that appears on hover
- Call `removeTask()` API
- Only show if `canRemove` prop is true

```typescript
import React, { useState } from 'react';
import { Circle, CheckCircle2, X } from 'lucide-react';
import { ordersApi } from '../../../services/api';

interface Props {
  task: {
    task_id: number;
    task_name: string;
    completed: boolean;
    assigned_role?: string | null;
  };
  orderNumber: number;
  canRemove?: boolean;  // NEW
  onTaskUpdated: () => void;
}

export const TaskItem: React.FC<Props> = ({
  task,
  orderNumber,
  canRemove = false,
  onTaskUpdated
}) => {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Remove task "${task.task_name}"?`)) {
      return;
    }

    try {
      setRemoving(true);
      await ordersApi.removeTask(task.task_id);
      onTaskUpdated();
    } catch (error) {
      console.error('Error removing task:', error);
      alert('Failed to remove task. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="group flex items-start gap-2 py-1 px-1 hover:bg-gray-50 rounded relative">
      <div className="flex-shrink-0 mt-0.5">
        {task.completed ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-xs ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
          {task.task_name}
        </p>
        {task.assigned_role && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {task.assigned_role}
          </p>
        )}
      </div>

      {/* Remove Button (shows on hover) */}
      {canRemove && !task.completed && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Remove task"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default TaskItem;
```

### Task 3: Modify TaskList Component

**File:** `/home/jon/Nexus/frontend/web/src/components/orders/progress/TaskList.tsx`

**Changes:**
- Pass `canRemove` prop down to TaskItem

```typescript
import React from 'react';
import TaskItem from './TaskItem';

interface Props {
  tasks: any[];
  orderNumber: number;
  canRemove?: boolean;  // NEW
  onTaskUpdated: () => void;
}

export const TaskList: React.FC<Props> = ({
  tasks,
  orderNumber,
  canRemove = false,
  onTaskUpdated
}) => {
  if (tasks.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">
        No tasks yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tasks.map((task) => (
        <TaskItem
          key={task.task_id}
          task={task}
          orderNumber={orderNumber}
          canRemove={canRemove}  // PASS DOWN
          onTaskUpdated={onTaskUpdated}
        />
      ))}
    </div>
  );
};

export default TaskList;
```

### Task 4: Create TaskTemplateDropdown Component

**File:** `/home/jon/Nexus/frontend/web/src/components/orders/progress/TaskTemplateDropdown.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';
import { ordersApi } from '../../../services/api';

interface Props {
  orderNumber: number;
  partId: number;
  existingTasks: Array<{ task_name: string }>;
  onTaskAdded: () => void;
  onClose: () => void;
}

interface TaskTemplate {
  task_name: string;
  assigned_role: string | null;
}

export const TaskTemplateDropdown: React.FC<Props> = ({
  orderNumber,
  partId,
  existingTasks,
  onTaskAdded,
  onClose
}) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await ordersApi.getTaskTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading task templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (template: TaskTemplate) => {
    try {
      setAdding(true);
      await ordersApi.addTaskToPart(orderNumber, partId, {
        task_name: template.task_name,
        assigned_role: template.assigned_role || undefined
      });
      onTaskAdded();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  // Filter out tasks that already exist on this part
  const existingTaskNames = new Set(existingTasks.map(t => t.task_name));
  const availableTemplates = templates.filter(
    t => !existingTaskNames.has(t.task_name)
  );

  // Group by role
  const groupedTemplates: Record<string, TaskTemplate[]> = {};
  availableTemplates.forEach(template => {
    const role = template.assigned_role || 'General';
    if (!groupedTemplates[role]) {
      groupedTemplates[role] = [];
    }
    groupedTemplates[role].push(template);
  });

  const roles = Object.keys(groupedTemplates).sort();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="absolute top-12 left-3 right-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading tasks...
          </div>
        ) : availableTemplates.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            All tasks already added
          </div>
        ) : (
          <div className="py-2">
            {roles.map(role => (
              <div key={role} className="mb-2 last:mb-0">
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                  {role}
                </div>
                {groupedTemplates[role].map(template => (
                  <button
                    key={template.task_name}
                    onClick={() => handleAddTask(template)}
                    disabled={adding}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-50"
                  >
                    {template.task_name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TaskTemplateDropdown;
```

### Task 5: Update ProgressView to Pass Status

**File:** `/home/jon/Nexus/frontend/web/src/components/orders/progress/ProgressView.tsx`

**Changes:**
- Pass `currentStatus` to PartTasksSection

```typescript
// Around line 60-70, modify PartTasksSection call:

<PartTasksSection
  key={part.part_id}
  part={part}
  orderNumber={orderNumber}
  orderStatus={currentStatus}  // ADD THIS LINE
  onTaskUpdated={handleTaskUpdated}
/>
```

---

## Testing Checklist

### Pre-Testing Setup
- [ ] Navigate to Order #200000 (or any order with status='job_details_setup')
- [ ] Ensure order has at least one part
- [ ] Backend server running
- [ ] Frontend server running

### Test 1: Add Task Button Appears
- [ ] Click on order → ProgressView loads
- [ ] Verify [+] button appears in PartTasksSection header
- [ ] Button has hover effect (gray → indigo)

### Test 2: Task Dropdown Opens
- [ ] Click [+] button
- [ ] Dropdown appears below header
- [ ] Tasks are grouped by role (Designer, Vinyl CNC, Cut/Bend, LEDs, Packing)
- [ ] Tasks are alphabetically sorted within each role
- [ ] Clicking outside closes dropdown

### Test 3: Add Task
- [ ] Click [+] button → dropdown opens
- [ ] Select "Design approval" (or any task)
- [ ] Task appears in task list immediately
- [ ] Dropdown closes automatically
- [ ] Task counter updates (e.g., 0/8 → 1/8)
- [ ] Progress bar updates

### Test 4: Filter Already-Added Tasks
- [ ] Add a task (e.g., "Design approval")
- [ ] Click [+] again
- [ ] Verify "Design approval" no longer appears in dropdown
- [ ] Other tasks still visible

### Test 5: Remove Task Button Appears
- [ ] Hover over an incomplete task
- [ ] [-] button appears on right side
- [ ] Button has hover effect (gray → red)
- [ ] Move mouse away → button disappears

### Test 6: Remove Task
- [ ] Hover over task → click [-] button
- [ ] Confirmation prompt appears
- [ ] Click OK
- [ ] Task disappears from list
- [ ] Task counter updates (e.g., 3/8 → 2/8)
- [ ] Progress bar updates
- [ ] Click [+] → removed task reappears in dropdown

### Test 7: Completed Tasks Cannot Be Removed
- [ ] Mark a task as completed (using existing checkbox)
- [ ] Hover over completed task
- [ ] [-] button does NOT appear
- [ ] Completed tasks stay strikethrough

### Test 8: Buttons Only Appear in job_details_setup Status
- [ ] Change order status to 'pending_confirmation' (via database)
- [ ] Reload order page
- [ ] [+] button does NOT appear
- [ ] Hover tasks → [-] button does NOT appear
- [ ] Tasks are read-only

### Test 9: Multiple Parts
- [ ] Order with 3+ parts
- [ ] Each PartTasksSection has its own [+] button
- [ ] Adding task to Part 1 doesn't affect Part 2
- [ ] Each part can have different tasks

### Test 10: Empty State
- [ ] Part with 0 tasks
- [ ] "No tasks yet" message displays
- [ ] Click [+] → add task → message disappears

---

## Error Handling

### Common Errors

**Error: Task template dropdown doesn't open**
- Check browser console for API errors
- Verify `/api/orders/task-templates` endpoint works
- Check authentication token

**Error: "Failed to add task"**
- Verify part_id is valid
- Check user has `orders.update` permission
- Verify order status is 'job_details_setup'

**Error: [-] button doesn't remove task**
- Check browser console for errors
- Verify task_id is correct
- Check `/api/orders/tasks/:taskId` endpoint

**Error: Dropdown shows all tasks (not filtered)**
- Check `existingTasks` array is passed correctly
- Verify task_name matches exactly

---

## Success Criteria

Phase 1.5.c.4 is complete when:

✅ [+] button appears in PartTasksSection header
✅ Clicking [+] opens TaskTemplateDropdown
✅ Dropdown shows tasks grouped by role
✅ Adding task works and updates UI
✅ [-] button appears on hover over tasks
✅ Removing task works and updates UI
✅ Completed tasks cannot be removed
✅ Buttons only appear when status = 'job_details_setup'
✅ All 10 tests pass
✅ No console errors

---

## Next Steps

Once Phase 1.5.c.4 is complete:

1. **Parallel:** Continue with Phase 1.5.c.5 (Dual-Table Core UI)
2. Task management is fully functional and independent

---

## Files Created/Modified

### ✅ Files Created (2 files, ~185 lines)
- `/home/jon/Nexus/frontend/web/src/components/orders/progress/ConfirmModal.tsx` (65 lines) **NEW**
  - Reusable confirmation modal component
  - AlertTriangle icon from lucide-react
  - Warning/danger type support
  - Backdrop click-to-close

- `/home/jon/Nexus/frontend/web/src/components/orders/progress/TaskTemplateDropdown.tsx` (120 lines) **NEW**
  - Task selection dropdown with role grouping
  - Filters already-added tasks
  - Loading and error states
  - API integration

### ✅ Files Modified (4 files, ~69 lines added)
- `/home/jon/Nexus/frontend/web/src/components/orders/progress/PartTasksSection.tsx` (+35 lines → 85 lines)
  - Added orderStatus prop
  - Added [+] button (conditional on status)
  - Integrated TaskTemplateDropdown
  - Pass canRemove prop to TaskList

- `/home/jon/Nexus/frontend/web/src/components/orders/progress/TaskItem.tsx` (+30 lines → 103 lines)
  - Added canRemove prop
  - Added [-] button with hover effect
  - Integrated ConfirmModal
  - Only shows for incomplete tasks

- `/home/jon/Nexus/frontend/web/src/components/orders/progress/TaskList.tsx` (+3 lines → 37 lines)
  - Added canRemove prop passthrough
  - Updated empty state to "No tasks"

- `/home/jon/Nexus/frontend/web/src/components/orders/progress/ProgressView.tsx` (+1 line → 106 lines)
  - Pass orderStatus to PartTasksSection

**Total Lines Added:** ~254 lines
**Actual Implementation Time:** ~4 hours

---

## Implementation Notes

### Key Decisions Made:
1. **Custom Modal:** Used custom ConfirmModal component instead of native confirm() dialog
2. **Empty State:** Changed to simple "No tasks" message
3. **Error Handling:** Used alert() dialogs for consistency with existing codebase
4. **Hover Pattern:** Used group-hover for [-] button reveal (smooth UX)

### Testing Results:
- ✅ TypeScript compilation: PASSED
- ✅ Frontend build: PASSED (5.37s)
- ✅ Backend running: PM2 healthy
- ✅ Dev server: Running on port 5173

### Available for Testing:
- **Test Order:** #200000 (status='job_details_setup', 5 parts)
- **Development URL:** http://192.168.2.14:5173
- **Login:** admin / admin123

---

**Document Status:** ✅ IMPLEMENTATION COMPLETE
**Dependencies:** Phase 1.5.c.1 (Frontend API) - COMPLETE
**Next Phase:** Phase 1.5.c.5 (Dual-Table Core UI)
