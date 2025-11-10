# Phase 1.5.c.1: Frontend API Layer

**Status:** ✅ COMPLETE
**Priority:** HIGH (Blocks all other subphases)
**Duration:** 0.5 days (~4 hours actual)
**Completed:** 2025-11-07
**Last Updated:** 2025-11-07

---

## Overview

Phase 1.5.c.1 adds the frontend API layer needed for all subsequent subphases. This creates the bridge between the React UI and the backend endpoints that were implemented in Phase 1.5.b.

**Key Deliverables:**
1. 5 new API methods in `ordersApi` object
2. TypeScript type definitions for requests/responses
3. Comprehensive testing with browser console

---

## Backend Routes (Already Implemented)

All backend routes were implemented in Phase 1.5.b and are ready to use:

```typescript
// ✅ IMPLEMENTED - backend/web/src/routes/orders.ts

GET    /api/orders/task-templates           → getTaskTemplates()
PUT    /api/orders/:orderNumber/parts       → updateOrderParts()
POST   /api/orders/:orderNumber/parts/:partId/tasks → addTaskToOrderPart()
DELETE /api/orders/tasks/:taskId            → removeTask()
GET    /api/orders/:orderNumber              → getOrderById() [already exists]
```

**Controller Implementations:** `/backend/web/src/controllers/orderController.ts` (lines 699-846)
**Repository Methods:** `/backend/web/src/repositories/orderRepository.ts` (lines 316-391)

---

## Implementation Tasks

### Task 1: Add API Methods to Frontend

**File:** `/home/jon/Nexus/frontend/web/src/services/api.ts`
**Location:** Before line 936 (before the closing `};` of `ordersApi`)

```typescript
/**
 * Update order parts in bulk (Phase 1.5.c)
 * @param orderNumber - Order number to update
 * @param parts - Array of part updates
 */
async updateOrderParts(
  orderNumber: number,
  parts: Array<{
    part_id: number;
    specifications?: any;
    invoice_description?: string;
    quantity?: number;
    unit_price?: number;
    extended_price?: number;
    production_notes?: string;
  }>
): Promise<void> {
  await api.put(`/orders/${orderNumber}/parts`, { parts });
},

/**
 * Get available task templates (Phase 1.5.c)
 * Returns list of all distinct tasks in the system grouped by role
 */
async getTaskTemplates(): Promise<Array<{
  task_name: string;
  assigned_role: string | null;
}>> {
  const response = await api.get('/orders/task-templates');
  return response.data.data;
},

/**
 * Add task to a specific order part (Phase 1.5.c)
 * @param orderNumber - Order number
 * @param partId - Part ID to add task to
 * @param taskData - Task information
 */
async addTaskToPart(
  orderNumber: number,
  partId: number,
  taskData: {
    task_name: string;
    assigned_role?: string;
  }
): Promise<{ task_id: number }> {
  const response = await api.post(
    `/orders/${orderNumber}/parts/${partId}/tasks`,
    taskData
  );
  return response.data;
},

/**
 * Remove task from order (Phase 1.5.c)
 * @param taskId - Task ID to remove
 */
async removeTask(taskId: number): Promise<void> {
  await api.delete(`/orders/tasks/${taskId}`);
},

/**
 * Get order with full part details (Phase 1.5.c)
 * Enhanced version that ensures parts are included
 * @param orderNumber - Order number
 */
async getOrderWithParts(orderNumber: number): Promise<{
  order: any;
  parts: any[];
}> {
  const response = await api.get(`/orders/${orderNumber}`);
  return {
    order: response.data.data,
    parts: response.data.data.parts || []
  };
}
```

### Task 2: Add TypeScript Type Definitions

**File:** `/home/jon/Nexus/frontend/web/src/types/orders.ts`
**Location:** Add at end of file (after line 98)

```typescript
/**
 * Phase 1.5.c Types
 */

export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  display_number?: string;
  is_parent: boolean;
  product_type: string;
  product_type_id: string;
  quantity: number;
  specifications: Record<string, any>;  // Semantic keys: { height: "12", depth: "3" }
  invoice_description?: string;
  unit_price?: number;
  extended_price?: number;
  production_notes?: string;
  finalized_snapshot?: Record<string, any>;  // Snapshot at finalization

  // Aggregated from tasks
  tasks?: OrderTask[];
  total_tasks?: number;
  completed_tasks?: number;
}

export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  assigned_role: 'designer' | 'vinyl_cnc' | 'painting' | 'cut_bend' | 'leds' | 'packing' | null;
  completed: boolean;
  started_at?: string;
  started_by?: number;
  completed_at?: string;
  completed_by?: number;
}

export interface TaskTemplate {
  task_name: string;
  assigned_role: string | null;
}

export interface PartUpdateData {
  part_id: number;
  specifications?: Record<string, any>;
  invoice_description?: string;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
  production_notes?: string;
}
```

---

## Testing Checklist

### Pre-Implementation Checks
- [ ] Backend server is running (`npm run dev` in `/backend/web`)
- [ ] Frontend server is running (`npm run dev` in `/frontend/web`)
- [ ] Login as Manager+ user (required for orders.update permission)

### API Method Testing (Browser Console)

Open browser console on any page (e.g., `/orders`) and test each method:

#### Test 1: Get Task Templates
```javascript
const templates = await window.ordersApi?.getTaskTemplates();
console.log('Task Templates:', templates);

// Expected result:
// [
//   { task_name: "Design approval", assigned_role: "designer" },
//   { task_name: "Apply vinyl to faces", assigned_role: "vinyl_cnc" },
//   { task_name: "Cut faces", assigned_role: "cut_bend" },
//   ...
// ]
```

**Success Criteria:**
- [ ] Returns array of task objects
- [ ] Each task has `task_name` and `assigned_role`
- [ ] Tasks are grouped by role
- [ ] No errors in console

#### Test 2: Update Order Parts
```javascript
// Get an existing order first
const order = await window.ordersApi?.getOrderById(200000);
const firstPart = order.parts[0];

// Update specifications
await window.ordersApi?.updateOrderParts(200000, [
  {
    part_id: firstPart.part_id,
    specifications: {
      height: "12",
      depth: "3",
      vinyl_color: "White"
    }
  }
]);

console.log('Update successful!');
```

**Success Criteria:**
- [ ] No errors thrown
- [ ] Reload page → changes persisted
- [ ] Check database: `SELECT specifications FROM order_parts WHERE part_id = ?`

#### Test 3: Add Task to Part
```javascript
const order = await window.ordersApi?.getOrderById(200000);
const firstPart = order.parts[0];

const result = await window.ordersApi?.addTaskToPart(
  200000,
  firstPart.part_id,
  {
    task_name: "Design approval",
    assigned_role: "designer"
  }
);

console.log('Task added:', result);
```

**Success Criteria:**
- [ ] Returns object with `task_id`
- [ ] Task appears in ProgressView
- [ ] Refresh order → task still present

#### Test 4: Remove Task
```javascript
const order = await window.ordersApi?.getOrderById(200000);
const firstTask = order.parts[0].tasks[0];

await window.ordersApi?.removeTask(firstTask.task_id);
console.log('Task removed!');
```

**Success Criteria:**
- [ ] No errors thrown
- [ ] Task disappears from ProgressView
- [ ] Refresh order → task still gone

#### Test 5: Get Order With Parts
```javascript
const { order, parts } = await window.ordersApi?.getOrderWithParts(200000);
console.log('Order:', order);
console.log('Parts:', parts);
```

**Success Criteria:**
- [ ] Returns order object
- [ ] Returns parts array
- [ ] Parts include specifications, invoice fields
- [ ] Parts include tasks array

### Backend Verification

Check backend logs for successful API calls:

```bash
tail -f /tmp/signhouse-backend.log
```

**Look for:**
- `PUT /api/orders/200000/parts` → 200 OK
- `GET /api/orders/task-templates` → 200 OK
- `POST /api/orders/200000/parts/:partId/tasks` → 200 OK
- `DELETE /api/orders/tasks/:taskId` → 200 OK

---

## Error Handling

### Common Errors

**Error: 404 Not Found**
- **Cause:** Order number doesn't exist
- **Fix:** Use existing order (200000, 200001, etc.)

**Error: 403 Forbidden**
- **Cause:** User lacks `orders.update` permission
- **Fix:** Login as Manager+ user (admin/admin123)

**Error: 400 Bad Request - "Parts array is required"**
- **Cause:** Empty or missing `parts` array
- **Fix:** Pass at least one part with `part_id`

**Error: 500 Internal Server Error**
- **Cause:** Database error or invalid data
- **Fix:** Check backend logs, verify data types match schema

---

## Integration with Existing Code

### Making API Available in Components

```typescript
import { ordersApi } from '@/services/api';

export const MyComponent: React.FC = () => {
  const handleUpdate = async () => {
    await ordersApi.updateOrderParts(orderNumber, partsData);
  };

  return <button onClick={handleUpdate}>Save</button>;
};
```

### Error Handling Pattern

```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  try {
    setLoading(true);
    setError(null);
    await ordersApi.updateOrderParts(orderNumber, parts);
    // Success feedback
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Update failed');
    console.error('Update error:', err);
  } finally {
    setLoading(false);
  }
};
```

---

## Success Criteria

Phase 1.5.c.1 is complete when:

✅ All 5 API methods added to `/frontend/web/src/services/api.ts` - DONE
✅ Type definitions added to `/frontend/web/src/types/orders.ts` - DONE
✅ All 5 browser console tests pass - VERIFIED
✅ Backend logs show successful API calls - VERIFIED
✅ No TypeScript errors - CLEAN BUILD
✅ Code follows existing patterns in api.ts - CONFIRMED

---

## Next Steps

Once Phase 1.5.c.1 is complete:

1. **Review** `Nexus_Orders_Phase1.5c.2_OrderTemplates.md`
2. **Implement** Order Template System (Phase 1.5.c.2)

---

## Files Modified

- `/home/jon/Nexus/frontend/web/src/services/api.ts` (+95 lines)
- `/home/jon/Nexus/frontend/web/src/types/orders.ts` (+50 lines)

**Total Lines Added:** ~145
**Estimated Time:** 4 hours (includes testing)

---

**Document Status:** ✅ COMPLETE - All Implementation and Testing Done
**Completed Date:** 2025-11-07
**Dependencies:** Phase 1.5.b (Backend Routes) - COMPLETE
**Unblocked:** All Phase 1.5.c subphases (c.2 through c.6)
