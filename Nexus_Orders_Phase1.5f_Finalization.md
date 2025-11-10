# Phase 1.5.f: Order Finalization Workflow

**Status:** 📋 Ready to Implement
**Priority:** HIGH
**Duration:** 2-3 days
**Last Updated:** 2025-11-05

---

## Overview

Phase 1.5.f implements the critical finalization workflow that transitions orders from the "Job Details Setup" phase to customer approval. This phase introduces comprehensive validation, irreversible separation of specs and invoice data, change tracking, and the ability to return orders to setup when needed.

**Key Deliverables:**
1. Comprehensive validation system (15+ checks)
2. "Finalize Order" button with confirmation workflow
3. "Finalize & Send to Customer" placeholder (Phase 2 feature)
4. Irreversible separation of specs and invoice after finalization
5. Change tracking system (flags modifications after finalization)
6. "Return to Job Details Setup" button (Manager+ only)
7. Visual indicators for finalized orders
8. Validation checklist UI component

---

## Visual Design Reference

### Finalization Panel (Before Finalization)

```
┌─────────────────────────────────────────────────────────────┐
│  ORDER #200001 - Job Details Setup                          │
├─────────────────────────────────────────────────────────────┤
│  [Order Info Section]                                        │
│  [Dual Table Layout]                                         │
│                                                              │
│  ┌─── FINALIZE ORDER ───────────────────────────────────┐   │
│  │                                                        │   │
│  │  Before sending to customer, please review:          │   │
│  │                                                        │   │
│  │  Validation Status:                                   │   │
│  │  ✓ Job name provided                                  │   │
│  │  ✓ Customer selected                                  │   │
│  │  ✓ Due date set                                       │   │
│  │  ✓ All parts have valid data                         │   │
│  │  ⚠ Specs and invoice differ (rows 2, 5)             │   │
│  │    → Warning: Review differences before finalizing    │   │
│  │  ✓ No circular task dependencies                     │   │
│  │  ✓ Invoice totals calculated                         │   │
│  │                                                        │   │
│  │  ⚠ 1 warning found (can proceed with caution)        │   │
│  │                                                        │   │
│  │  [ Run Validation ]                                   │   │
│  │                                                        │   │
│  │  [ Finalize Order ]  [ Finalize & Send to Customer ] │   │
│  │   (confirm only)     (Phase 2 - not implemented)     │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Finalization Confirmation Dialog

```
┌──────────────────────────────────────────────┐
│  Finalize Order #200001?                 [×] │
├──────────────────────────────────────────────┤
│                                              │
│  You are about to finalize this order.      │
│                                              │
│  After finalization:                         │
│  • Specs and invoice can differ permanently  │
│  • Order status → Pending Confirmation       │
│  • Changes will be tracked and flagged       │
│  • Cannot be undone (Manager+ can return)    │
│                                              │
│  ⚠ 1 Warning Found:                         │
│  • Specs/invoice differ in 2 rows           │
│                                              │
│  Do you want to proceed?                     │
│                                              │
│         [Cancel]  [Yes, Finalize Order]      │
└──────────────────────────────────────────────┘
```

### After Finalization (Status Banner)

```
┌─────────────────────────────────────────────────────────────┐
│  ORDER #200001 - Pending Confirmation                       │
│                                                              │
│  ✓ Order finalized on Nov 5, 2025 at 2:34 PM by Jon Smith  │
│    Specs and invoice are now independent.                   │
│                                                              │
│  [ Return to Job Details Setup ] (Manager+ only)            │
└─────────────────────────────────────────────────────────────┘
```

### After Modification Post-Finalization

```
┌─────────────────────────────────────────────────────────────┐
│  ORDER #200001 - Pending Confirmation                       │
│                                                              │
│  ⚠️ CHANGES MADE AFTER FINALIZATION                         │
│  Order finalized on Nov 5, 2025 at 2:34 PM                  │
│  Last modified on Nov 5, 2025 at 3:15 PM                    │
│                                                              │
│  ⚠ Customer may have outdated information                   │
│                                                              │
│  [ Return to Job Details Setup ] [ Resend to Customer ]     │
└─────────────────────────────────────────────────────────────┘
```

### Return to Setup Confirmation

```
┌──────────────────────────────────────────────┐
│  Return Order to Job Details Setup?      [×] │
├──────────────────────────────────────────────┤
│                                              │
│  This will move the order back to:           │
│  Job Details Setup                           │
│                                              │
│  ⚠ Warning:                                  │
│  This order was finalized and may have been  │
│  sent to the customer. Returning to setup    │
│  will allow full editing again.              │
│                                              │
│  Reason (optional):                          │
│  ┌────────────────────────────────────────┐  │
│  │ Customer requested changes...          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│         [Cancel]  [Yes, Return to Setup]     │
└──────────────────────────────────────────────┘
```

---

## Component Architecture

### Component Hierarchy

```
JobDetailsSetupView.tsx (from Phase 1.5.c)
├── ... order info, dual table ...
│
└── FinalizationPanel.tsx (~250 lines) [NEW]
    ├── ValidationChecklist.tsx (~180 lines) [NEW]
    │   ├── ValidationItem components
    │   │   ├── ✓ Pass (green)
    │   │   ├── ⚠ Warning (yellow)
    │   │   └── ✗ Error (red)
    │   └── ValidationSummary
    │
    ├── FinalizeButton.tsx (~80 lines) [NEW]
    │   └── FinalizeConfirmationModal.tsx (~120 lines) [NEW]
    │
    ├── SendToCustomerButton.tsx (~40 lines) [NEW]
    │   └── Placeholder (Phase 2)
    │
    └── RunValidationButton.tsx (~50 lines) [NEW]

Standard Order View (After Finalization)
├── OrderStatusBanner.tsx (~100 lines) [NEW]
│   ├── Finalization info display
│   ├── Change warning (if modified)
│   └── Action buttons
│
├── ReturnToSetupButton.tsx (~80 lines) [NEW]
│   └── ReturnToSetupModal.tsx (~100 lines) [NEW]
│
└── ChangeWarningBadge.tsx (~60 lines) [NEW]

Backend Services
├── orderFinalizationService.ts (~280 lines) [NEW]
│   ├── validateOrder(orderId)
│   ├── finalizeOrder(orderId, userId)
│   ├── returnToSetup(orderId, userId, reason)
│   ├── trackChange(orderId)
│   └── detectSpecsInvoiceDiscrepancies(orderId)
│
└── orderValidationService.ts (~200 lines) [NEW]
    ├── validateRequiredFields(order)
    ├── validateParts(parts)
    ├── validateTasks(tasks)
    ├── detectCircularDependencies(tasks)
    └── generateValidationReport(order)
```

---

## Data Structures

### Validation Result

```typescript
interface ValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  canProceed: boolean;  // True if no errors (warnings allowed)
}

interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  field?: string;
  part_id?: number;
  task_id?: number;
}
```

### Example Validation Response

```json
{
  "isValid": false,
  "hasWarnings": true,
  "canProceed": false,
  "errors": [
    {
      "code": "MISSING_CUSTOMER",
      "severity": "error",
      "message": "Customer must be selected",
      "field": "customer_id"
    }
  ],
  "warnings": [
    {
      "code": "SPECS_INVOICE_MISMATCH",
      "severity": "warning",
      "message": "Specs and invoice differ in rows 2, 5",
      "part_id": null
    },
    {
      "code": "NO_TASKS_GENERATED",
      "severity": "warning",
      "message": "Part 'ACM Panel' has no production tasks",
      "part_id": 123
    }
  ]
}
```

### Finalization Record (in database)

```typescript
interface OrderFinalization {
  order_id: number;
  finalized_at: Date;
  finalized_by: number;
  modified_after_finalization: boolean;
  last_modified_at?: Date;
  return_to_setup_count: number;  // Track how many times returned
}
```

---

## Implementation Tasks

### Task 1: Validation Service (1 day)

**File:** `/backend/web/src/services/orderValidationService.ts`

**Purpose:** Comprehensive order validation before finalization

**Implementation:**

```typescript
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

interface ValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  canProceed: boolean;
}

interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  field?: string;
  part_id?: number;
  task_id?: number;
}

export class OrderValidationService {
  /**
   * Run full validation on an order
   */
  async validateOrder(orderId: number): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    try {
      // Get order data
      const [orders] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM orders WHERE order_id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        errors.push({
          code: 'ORDER_NOT_FOUND',
          severity: 'error',
          message: 'Order not found'
        });
        return { isValid: false, hasWarnings: false, errors, warnings, canProceed: false };
      }

      const order = orders[0];

      // 1. Validate required fields
      await this.validateRequiredFields(order, errors);

      // 2. Validate parts
      await this.validateParts(orderId, errors, warnings);

      // 3. Validate tasks
      await this.validateTasks(orderId, errors, warnings);

      // 4. Detect specs/invoice discrepancies
      await this.detectSpecsInvoiceDiscrepancies(orderId, warnings);

      // 5. Validate invoice totals
      await this.validateInvoiceTotals(orderId, warnings);

      const isValid = errors.length === 0;
      const hasWarnings = warnings.length > 0;
      const canProceed = isValid; // Can proceed if no errors (warnings OK)

      return {
        isValid,
        hasWarnings,
        errors,
        warnings,
        canProceed
      };
    } catch (error) {
      console.error('Validation error:', error);
      errors.push({
        code: 'VALIDATION_FAILED',
        severity: 'error',
        message: 'Validation failed: ' + (error as Error).message
      });
      return { isValid: false, hasWarnings: false, errors, warnings, canProceed: false };
    }
  }

  /**
   * Validate required order fields
   */
  private async validateRequiredFields(order: any, errors: ValidationIssue[]): Promise<void> {
    // Job name required
    if (!order.order_name || order.order_name.trim() === '') {
      errors.push({
        code: 'MISSING_JOB_NAME',
        severity: 'error',
        message: 'Job name is required',
        field: 'order_name'
      });
    }

    // Customer required
    if (!order.customer_id) {
      errors.push({
        code: 'MISSING_CUSTOMER',
        severity: 'error',
        message: 'Customer must be selected',
        field: 'customer_id'
      });
    }

    // Due date required
    if (!order.due_date) {
      errors.push({
        code: 'MISSING_DUE_DATE',
        severity: 'error',
        message: 'Due date is required',
        field: 'due_date'
      });
    }
  }

  /**
   * Validate order parts
   */
  private async validateParts(
    orderId: number,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): Promise<void> {
    const [parts] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM order_parts WHERE order_id = ? ORDER BY part_number',
      [orderId]
    );

    // Must have at least one part
    if (parts.length === 0) {
      errors.push({
        code: 'NO_PARTS',
        severity: 'error',
        message: 'Order must have at least one part'
      });
      return;
    }

    // Validate each part
    for (const part of parts) {
      // Separators can skip validation
      // Skip separators (both specs and invoice fields NULL)
      const hasSpecs = part.specifications != null;
      const hasInvoice = part.invoice_description != null || part.unit_price != null;
      if (!hasSpecs && !hasInvoice) continue;  // Separator

      // Product name required
      if (!part.product_type || part.product_type.trim() === '') {
        errors.push({
          code: 'MISSING_PRODUCT_NAME',
          severity: 'error',
          message: `Part #${part.part_number}: Product name is required`,
          part_id: part.part_id,
          field: 'product_type'
        });
      }

      // Parent parts should have at least one spec
      if (part.is_parent) {
        const specs = part.specifications ? JSON.parse(part.specifications) : { specs: [] };
        if (!specs.specs || specs.specs.length === 0) {
          warnings.push({
            code: 'NO_SPECS',
            severity: 'warning',
            message: `Part "${part.product_type}": No specifications defined`,
            part_id: part.part_id
          });
        }
      }

      // Invoice parts should have quantity and price
      // Check if row has invoice data (both or invoice-only)
      if (hasInvoice) {
        if (!part.quantity || part.quantity <= 0) {
          warnings.push({
            code: 'MISSING_QUANTITY',
            severity: 'warning',
            message: `Part "${part.product_type}": Quantity not set`,
            part_id: part.part_id,
            field: 'quantity'
          });
        }

        if (!part.unit_price || part.unit_price <= 0) {
          warnings.push({
            code: 'MISSING_PRICE',
            severity: 'warning',
            message: `Part "${part.product_type}": Unit price not set`,
            part_id: part.part_id,
            field: 'unit_price'
          });
        }
      }
    }
  }

  /**
   * Validate tasks
   */
  private async validateTasks(
    orderId: number,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): Promise<void> {
    const [tasks] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM order_tasks WHERE order_id = ? ORDER BY task_id',
      [orderId]
    );

    // Warn if no tasks
    if (tasks.length === 0) {
      warnings.push({
        code: 'NO_TASKS',
        severity: 'warning',
        message: 'No production tasks defined'
      });
      return;
    }

    // Detect circular dependencies
    const circularCheck = await this.detectCircularDependencies(tasks);
    if (circularCheck.hasCircular) {
      errors.push({
        code: 'CIRCULAR_DEPENDENCIES',
        severity: 'error',
        message: `Circular task dependencies detected: ${circularCheck.cycle.join(' → ')}`
      });
    }

    // Validate each task
    for (const task of tasks) {
      // Task name required
      if (!task.task_name || task.task_name.trim() === '') {
        errors.push({
          code: 'MISSING_TASK_NAME',
          severity: 'error',
          message: `Task #${task.task_id}: Task name is required`,
          task_id: task.task_id,
          field: 'task_name'
        });
      }

      // Role required
      if (!task.assigned_role) {
        errors.push({
          code: 'MISSING_TASK_ROLE',
          severity: 'error',
          message: `Task "${task.task_name}": Assigned role is required`,
          task_id: task.task_id,
          field: 'assigned_role'
        });
      }

      // Validate dependency exists
      if (task.depends_on_task_id) {
        const dependsOnExists = tasks.some(t => t.task_id === task.depends_on_task_id);
        if (!dependsOnExists) {
          errors.push({
            code: 'INVALID_DEPENDENCY',
            severity: 'error',
            message: `Task "${task.task_name}": Depends on non-existent task #${task.depends_on_task_id}`,
            task_id: task.task_id,
            field: 'depends_on_task_id'
          });
        }
      }
    }
  }

  /**
   * Detect circular dependencies in task chain
   */
  private async detectCircularDependencies(tasks: any[]): Promise<{
    hasCircular: boolean;
    cycle: string[];
  }> {
    const graph: Map<number, number[]> = new Map();

    // Build dependency graph
    tasks.forEach(task => {
      if (!graph.has(task.task_id)) {
        graph.set(task.task_id, []);
      }
      if (task.depends_on_task_id) {
        graph.get(task.task_id)!.push(task.depends_on_task_id);
      }
    });

    const visited = new Set<number>();
    const recStack = new Set<number>();
    let cycle: string[] = [];

    const dfs = (taskId: number, path: string[]): boolean => {
      visited.add(taskId);
      recStack.add(taskId);

      const task = tasks.find(t => t.task_id === taskId);
      const currentPath = [...path, task?.task_name || `Task ${taskId}`];

      const neighbors = graph.get(taskId) || [];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          if (dfs(neighborId, currentPath)) {
            return true;
          }
        } else if (recStack.has(neighborId)) {
          // Cycle detected
          const neighbor = tasks.find(t => t.task_id === neighborId);
          cycle = [...currentPath, neighbor?.task_name || `Task ${neighborId}`];
          return true;
        }
      }

      recStack.delete(taskId);
      return false;
    };

    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        if (dfs(taskId, [])) {
          return { hasCircular: true, cycle };
        }
      }
    }

    return { hasCircular: false, cycle: [] };
  }

  /**
   * Detect specs/invoice discrepancies
   */
  private async detectSpecsInvoiceDiscrepancies(
    orderId: number,
    warnings: ValidationIssue[]
  ): Promise<void> {
    // Get all parts that have both specs and invoice data
    const [parts] = await pool.execute<RowDataPacket[]>(
      `SELECT part_id, part_number, display_number, product_type, specifications, invoice_description, quantity
       FROM order_parts
       WHERE order_id = ?
         AND specifications IS NOT NULL
         AND (invoice_description IS NOT NULL OR unit_price IS NOT NULL)
       ORDER BY part_number`,
      [orderId]
    );

    const discrepantRows: string[] = [];

    for (const part of parts) {
      // Compare specs vs invoice description
      // Simple heuristic: if specs exist but invoice description is empty/different
      const specs = part.specifications ? JSON.parse(part.specifications) : { specs: [] };
      const hasSpecs = specs.specs && specs.specs.length > 0;
      const hasInvoiceDesc = part.invoice_description && part.invoice_description.trim() !== '';

      if (hasSpecs !== hasInvoiceDesc) {
        discrepantRows.push(part.display_number || `#${part.part_number}`);
      }
    }

    if (discrepantRows.length > 0) {
      warnings.push({
        code: 'SPECS_INVOICE_MISMATCH',
        severity: 'warning',
        message: `Specs and invoice differ in rows: ${discrepantRows.join(', ')}`
      });
    }
  }

  /**
   * Validate invoice totals
   */
  private async validateInvoiceTotals(
    orderId: number,
    warnings: ValidationIssue[]
  ): Promise<void> {
    const [parts] = await pool.execute<RowDataPacket[]>(
      `SELECT extended_price
       FROM order_parts
       WHERE order_id = ? AND (invoice_description IS NOT NULL OR unit_price IS NOT NULL)`,
      [orderId]
    );

    const subtotal = parts.reduce((sum, part) => sum + (part.extended_price || 0), 0);

    if (subtotal === 0) {
      warnings.push({
        code: 'ZERO_TOTAL',
        severity: 'warning',
        message: 'Invoice total is $0.00'
      });
    }
  }
}

export const orderValidationService = new OrderValidationService();
```

**Key Features:**
- 15+ validation checks
- Errors vs warnings distinction
- Circular dependency detection
- Specs/invoice discrepancy detection
- Detailed error messages with context

---

### Task 2: Finalization Service (0.5 days)

**File:** `/backend/web/src/services/orderFinalizationService.ts`

**Purpose:** Handle order finalization and status transitions

**Implementation:**

```typescript
import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { orderValidationService } from './orderValidationService';

export class OrderFinalizationService {
  /**
   * Finalize an order (move to pending_confirmation status)
   */
  async finalizeOrder(
    orderId: number,
    userId: number
  ): Promise<{ success: boolean; message?: string }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Validate order
      const validation = await orderValidationService.validateOrder(orderId);

      if (!validation.canProceed) {
        const errorMessages = validation.errors.map(e => e.message).join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      // 2. Update order status
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET status = 'pending_confirmation',
             finalized_at = NOW(),
             finalized_by = ?,
             modified_after_finalization = FALSE
         WHERE order_id = ?`,
        [userId, orderId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Order not found');
      }

      // 3. Create status history entry
      await connection.execute(
        `INSERT INTO order_status_history
         (order_id, status, changed_by, changed_at, notes)
         VALUES (?, 'pending_confirmation', ?, NOW(), 'Order finalized and ready for customer approval')`,
        [orderId, userId]
      );

      await connection.commit();

      return {
        success: true,
        message: 'Order finalized successfully'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Return order to job details setup
   */
  async returnToSetup(
    orderId: number,
    userId: number,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Update order status back to job_details_setup
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET status = 'job_details_setup'
         WHERE order_id = ?`,
        [orderId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Order not found');
      }

      // Create status history entry
      const notes = reason
        ? `Returned to setup: ${reason}`
        : 'Returned to job details setup for editing';

      await connection.execute(
        `INSERT INTO order_status_history
         (order_id, status, changed_by, changed_at, notes)
         VALUES (?, 'job_details_setup', ?, NOW(), ?)`,
        [orderId, userId, notes]
      );

      await connection.commit();

      return {
        success: true,
        message: 'Order returned to setup successfully'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Track change after finalization
   */
  async trackChange(orderId: number): Promise<void> {
    // Check if order is finalized
    const [orders] = await pool.execute<RowDataPacket[]>(
      'SELECT finalized_at FROM orders WHERE order_id = ?',
      [orderId]
    );

    if (orders.length > 0 && orders[0].finalized_at) {
      // Mark as modified
      await pool.execute(
        'UPDATE orders SET modified_after_finalization = TRUE WHERE order_id = ?',
        [orderId]
      );
    }
  }
}

export const orderFinalizationService = new OrderFinalizationService();
```

---

### Task 3: Validation Checklist Component (0.5 days)

**File:** `/frontend/web/src/components/orders/finalization/ValidationChecklist.tsx`

**Purpose:** Display validation results to user

**Implementation:**

```typescript
import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface ValidationChecklistProps {
  validationResult: ValidationResult | null;
  loading: boolean;
  onRunValidation: () => void;
}

export const ValidationChecklist: React.FC<ValidationChecklistProps> = ({
  validationResult,
  loading,
  onRunValidation
}) => {
  if (!validationResult) {
    return (
      <div className="validation-checklist bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Validation Status</h3>
        <p className="text-gray-500 mb-4">
          Run validation to check if this order is ready to finalize.
        </p>
        <button
          onClick={onRunValidation}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? 'Running Validation...' : 'Run Validation'}
        </button>
      </div>
    );
  }

  const { isValid, hasWarnings, errors, warnings, canProceed } = validationResult;

  return (
    <div className="validation-checklist bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Validation Status</h3>
        <button
          onClick={onRunValidation}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Re-run
        </button>
      </div>

      {/* Summary */}
      <div className={`p-4 rounded-md mb-4 ${
        isValid
          ? 'bg-green-50 border border-green-200'
          : canProceed
          ? 'bg-yellow-50 border border-yellow-200'
          : 'bg-red-50 border border-red-200'
      }`}>
        {isValid && (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Ready to finalize</span>
          </div>
        )}
        {!isValid && canProceed && (
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''} found (can proceed)
            </span>
          </div>
        )}
        {!isValid && !canProceed && (
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">
              {errors.length} error{errors.length !== 1 ? 's' : ''} must be fixed
            </span>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-red-700 mb-2">
            Errors ({errors.length})
          </h4>
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-red-700">{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-yellow-700 mb-2">
            Warnings ({warnings.length})
          </h4>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span className="text-yellow-700">{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

---

### Task 4: Finalization Panel Component (0.5 days)

**File:** `/frontend/web/src/components/orders/finalization/FinalizationPanel.tsx`

**Purpose:** Main finalization UI with buttons and confirmation

**Implementation:**

```typescript
import React, { useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { apiClient } from '@/services/api';
import { ValidationChecklist } from './ValidationChecklist';
import { FinalizeConfirmationModal } from './FinalizeConfirmationModal';

interface FinalizationPanelProps {
  orderId: number;
  orderNumber: number;
  onFinalized: () => void;
}

export const FinalizationPanel: React.FC<FinalizationPanelProps> = ({
  orderId,
  orderNumber,
  onFinalized
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const handleRunValidation = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/api/orders/${orderNumber}/validate`);
      if (response.data.success) {
        setValidationResult(response.data.validation);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmFinalize = async () => {
    setFinalizing(true);
    try {
      const response = await apiClient.post(`/api/orders/${orderNumber}/finalize`);
      if (response.data.success) {
        setShowConfirmModal(false);
        onFinalized();
      }
    } catch (error) {
      console.error('Finalization failed:', error);
      alert('Failed to finalize order: ' + (error as any).response?.data?.message);
    } finally {
      setFinalizing(false);
    }
  };

  const canFinalize = validationResult?.canProceed === true;

  return (
    <div className="finalization-panel bg-gray-50 rounded-lg border border-gray-300 p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">Finalize Order</h2>

      <ValidationChecklist
        validationResult={validationResult}
        loading={loading}
        onRunValidation={handleRunValidation}
      />

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleFinalizeClick}
          disabled={!canFinalize || finalizing}
          className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium ${
            canFinalize && !finalizing
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Lock className="h-5 w-5" />
          {finalizing ? 'Finalizing...' : 'Finalize Order'}
        </button>

        <button
          disabled
          className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-400 rounded-md cursor-not-allowed"
          title="Phase 2 feature - not yet implemented"
        >
          <Send className="h-5 w-5" />
          Finalize & Send to Customer
          <span className="text-xs">(Phase 2)</span>
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        <strong>Note:</strong> Finalizing locks the relationship between specs and invoice.
        They can still be edited independently after finalization.
      </p>

      <FinalizeConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmFinalize}
        validationResult={validationResult}
        orderNumber={orderNumber}
      />
    </div>
  );
};
```

---

### Task 5: Order Status Banner Component (0.5 days)

**File:** `/frontend/web/src/components/orders/details/OrderStatusBanner.tsx`

**Purpose:** Display finalization info and change warnings

**Implementation:**

```typescript
import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { ReturnToSetupModal } from './ReturnToSetupModal';

interface OrderStatusBannerProps {
  order: any;
  isManager: boolean;
  onReturnToSetup: () => void;
}

export const OrderStatusBanner: React.FC<OrderStatusBannerProps> = ({
  order,
  isManager,
  onReturnToSetup
}) => {
  const [showReturnModal, setShowReturnModal] = useState(false);

  if (!order.finalized_at) {
    return null;
  }

  const finalizedDate = new Date(order.finalized_at).toLocaleString();
  const modifiedAfter = order.modified_after_finalization;

  return (
    <div className={`order-status-banner rounded-lg p-6 mb-6 ${
      modifiedAfter
        ? 'bg-yellow-50 border-2 border-yellow-300'
        : 'bg-green-50 border-2 border-green-300'
    }`}>
      {modifiedAfter ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">
              Changes Made After Finalization
            </h3>
          </div>
          <p className="text-yellow-800 mb-2">
            Order was finalized on {finalizedDate} by {order.finalized_by_name}
          </p>
          <p className="text-yellow-800 mb-4">
            ⚠️ Customer may have outdated information. Consider resending the order details.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">
              Order Finalized
            </h3>
          </div>
          <p className="text-green-800 mb-2">
            Finalized on {finalizedDate} by {order.finalized_by_name}
          </p>
          <p className="text-green-800 mb-4">
            Specs and invoice are now independent. Changes can be made to either side.
          </p>
        </>
      )}

      {isManager && (
        <button
          onClick={() => setShowReturnModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Return to Job Details Setup
        </button>
      )}

      <ReturnToSetupModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={onReturnToSetup}
        orderNumber={order.order_number}
        wasSentToCustomer={modifiedAfter}
      />
    </div>
  );
};
```

---

## API Endpoints

### POST /api/orders/:orderNumber/validate

**Response:**
```json
{
  "success": true,
  "validation": {
    "isValid": true,
    "hasWarnings": true,
    "canProceed": true,
    "errors": [],
    "warnings": [
      {
        "code": "SPECS_INVOICE_MISMATCH",
        "severity": "warning",
        "message": "Specs and invoice differ in rows: 2, 5"
      }
    ]
  }
}
```

### POST /api/orders/:orderNumber/finalize

**Response:**
```json
{
  "success": true,
  "message": "Order finalized successfully"
}
```

### POST /api/orders/:orderNumber/return-to-setup

**Request:**
```json
{
  "reason": "Customer requested changes to specifications"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order returned to setup successfully"
}
```

---

## Business Logic

### Validation Rules

**Required (Errors):**
1. Job name must be provided
2. Customer must be selected
3. Due date must be set
4. At least one part must exist
5. All parts must have product names (except separators)
6. All tasks must have names
7. All tasks must have assigned roles
8. No circular task dependencies
9. Task dependencies must reference existing tasks

**Optional (Warnings):**
1. Specs and invoice data differ
2. Parent parts have no specifications
3. Invoice parts missing quantity or price
4. No production tasks defined
5. Invoice total is $0.00

### Finalization Workflow

```
┌─────────────────────┐
│ Job Details Setup   │
│ (status initial)    │
└──────────┬──────────┘
           │
           │ User clicks "Finalize Order"
           ▼
    ┌──────────────┐
    │  Validation  │
    │   Runs       │
    └──────┬───────┘
           │
     ┌─────┴──────┐
     │            │
 Errors?      No Errors
     │            │
     ▼            ▼
  ❌ Stop    ✓ Proceed
               │
               │ Confirmation modal
               ▼
         ┌──────────────┐
         │   Finalize   │
         │   (commit)   │
         └──────┬───────┘
                │
                ▼
   ┌─────────────────────────┐
   │  Status →               │
   │  pending_confirmation   │
   │                         │
   │  finalized_at = NOW()   │
   │  finalized_by = userId  │
   └─────────────────────────┘
```

### Change Tracking Logic

```typescript
// On any order part update after finalization
if (order.finalized_at && order.status !== 'job_details_setup') {
  UPDATE orders SET modified_after_finalization = TRUE;
}
```

---

## Testing Checklist

### Validation Tests
- [ ] Required field errors show correctly
- [ ] Part validation catches missing names
- [ ] Task validation catches circular dependencies
- [ ] Specs/invoice discrepancy warning shows
- [ ] Warnings allow proceeding
- [ ] Errors block proceeding
- [ ] Re-run validation updates results

### Finalization Tests
- [ ] Finalize button disabled until validation passes
- [ ] Confirmation modal shows warnings
- [ ] Finalize updates database correctly
- [ ] Status changes to pending_confirmation
- [ ] finalized_at timestamp recorded
- [ ] finalized_by user recorded
- [ ] Status history entry created

### Change Tracking Tests
- [ ] Modifications after finalization set flag
- [ ] Warning banner appears when modified
- [ ] Change warning shows correct dates
- [ ] Unchanged finalized orders show success banner

### Return to Setup Tests
- [ ] Return button only visible to Manager+
- [ ] Return modal shows confirmation
- [ ] Return changes status back to job_details_setup
- [ ] Status history records return
- [ ] Reason field captured if provided

### UI/UX Tests
- [ ] Validation checklist displays all items
- [ ] Error/warning icons correct
- [ ] Colors match severity (red=error, yellow=warning, green=success)
- [ ] Loading states during operations
- [ ] Success/error messages display
- [ ] Phase 2 button disabled with tooltip

---

## Success Criteria

Phase 1.5.f is COMPLETE when:

1. ✅ Validation service runs 15+ checks
2. ✅ Errors vs warnings correctly distinguished
3. ✅ Finalize button works (with confirmation)
4. ✅ Order status changes to pending_confirmation
5. ✅ finalized_at and finalized_by recorded
6. ✅ Change tracking flags modifications
7. ✅ Warning banner appears for modified orders
8. ✅ Return to setup works (Manager+ only)
9. ✅ Status history tracks all transitions
10. ✅ Validation checklist UI clear and informative
11. ✅ All operations transaction-safe
12. ✅ No console errors
13. ✅ Performance acceptable (< 1s validation)
14. ✅ Circular dependency detection works
15. ✅ Phase 2 placeholder button visible but disabled

---

## Dependencies

**Requires:**
- Phase 1.5.e complete (all row management working)
- order_parts validation complete
- order_tasks validation complete
- orders.finalized_at column exists
- orders.finalized_by column exists
- orders.modified_after_finalization column exists

**Blocks:**
- None (final phase of 1.5)

---

## Files Created/Modified

### New Files (8)
- `/frontend/web/src/components/orders/finalization/FinalizationPanel.tsx` (~250 lines)
- `/frontend/web/src/components/orders/finalization/ValidationChecklist.tsx` (~180 lines)
- `/frontend/web/src/components/orders/finalization/FinalizeConfirmationModal.tsx` (~120 lines)
- `/frontend/web/src/components/orders/details/OrderStatusBanner.tsx` (~100 lines)
- `/frontend/web/src/components/orders/details/ReturnToSetupModal.tsx` (~100 lines)
- `/backend/web/src/services/orderValidationService.ts` (~200 lines)
- `/backend/web/src/services/orderFinalizationService.ts` (~120 lines)
- `/backend/web/src/routes/orderFinalizationRoutes.ts` (~80 lines)

### Modified Files (2)
- `/frontend/web/src/components/orders/details/JobDetailsSetupView.tsx` (integrate FinalizationPanel)
- `/frontend/web/src/components/orders/details/OrderDetailsPage.tsx` (show OrderStatusBanner)

**Total Lines Added:** ~1,150 lines
**Complexity:** Medium-High

---

## Future Enhancements (Phase 2)

1. **Email Integration:**
   - "Finalize & Send to Customer" button functional
   - Generate PDF of specs + invoice
   - Email template system
   - Customer approval tracking

2. **Advanced Validation:**
   - Custom validation rules per product type
   - Material availability checks
   - Lead time calculations
   - Pricing validation

3. **Versioning:**
   - Track versions when returning to setup
   - Compare finalized vs current data
   - Show diff view to customer

4. **Approval Workflow:**
   - Customer approval link
   - Digital signature
   - Approval notifications
   - Auto-status change on approval

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-05
**Estimated Completion:** 2-3 days after start
