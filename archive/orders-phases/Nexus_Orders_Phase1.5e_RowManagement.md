# Phase 1.5.e: Row Management

**Status:** ✅ Complete
**Priority:** MEDIUM
**Last Updated:** 2025-11-20

---

## Implementation Status

### ✅ Completed: Row Operations
1. ✅ Add Row modal with position selection
2. ✅ Delete row functionality with confirmation
3. ✅ Duplicate row operation (copies all data)
4. ✅ Reorder rows (drag-and-drop or arrows)
5. ✅ Part numbering auto-update on reorder

### 🚫 Removed from Scope
1. 🚫 Separator rows - Not needed
2. 🚫 Row type toggle - Not needed
3. 🚫 Empty cell styling for cross-table visibility - Not needed

---

## Overview

Phase 1.5.e implements comprehensive row manipulation capabilities for the dual-table order interface. This phase enables users to perform common operations like add, delete, duplicate, and reorder rows in the order parts system.

---

## Visual Design Reference

### Separator Row Display

```
┌─── JOB SPECS ──────────────────┬─── INVOICE ─────────────────┐
│                                 │                             │
│ Item Name    Specs      Tasks  │ Item Name    Desc    QTY... │
├─────────────────────────────────┼─────────────────────────────┤
│ Channel      3 specs            │ Channel      Front    8     │
│ Letter 3"                       │ Letter 3"    Lit            │
├─────────────────────────────────┼─────────────────────────────┤
│ LEDs         2 specs            │ LEDs         White    64    │
├─────────────────────────────────┼─────────────────────────────┤
│ ═══════════ Main Sign ══════════╪═════════════════════════════│  ← Separator
├─────────────────────────────────┼─────────────────────────────┤
│ ACM Panel    1 spec             │ ACM Panel    24x36    1     │
├─────────────────────────────────┼─────────────────────────────┤
│ Vinyl        0 specs            │ Vinyl        Custom   1     │
└─────────────────────────────────┴─────────────────────────────┘
```

### Row Type Indicators

```
┌─────────────────────────────────┬─────────────────────────────┐
│ [Both] Channel Letter           │ [Both] Channel Letter       │  ← appears in both
├─────────────────────────────────┼─────────────────────────────┤
│ [Specs] Internal Note           │ ░░░░░░ (Specs only) ░░░░░░░ │  ← specs only
├─────────────────────────────────┼─────────────────────────────┤
│ ░░░░░░░ (Invoice only) ░░░░░░░░ │ [Invoice] Shipping Fee      │  ← invoice only
└─────────────────────────────────┴─────────────────────────────┘
```

### Add Row Modal

```
┌─────────────────────────────────────────┐
│  Add New Row                        [×] │
├─────────────────────────────────────────┤
│                                         │
│  Row Type:                              │
│  ○ Both Tables (default)                │
│  ○ Specs Table Only                     │
│  ○ Invoice Table Only                   │
│  ○ Separator                            │
│                                         │
│  Position:                              │
│  ○ At end                               │
│  ○ Before current row                   │
│  ○ After current row                    │
│                                         │
│  Product Name (if not separator):       │
│  [________________________]             │
│                                         │
│        [Cancel]  [Add Row]              │
└─────────────────────────────────────────┘
```

### Row Actions Menu

```
┌─────────────────────────────────┐
│ Channel Letter 3"               │  ← Row
│ ⋮ [▼]                           │  ← Actions dropdown
│ ├─ Add Row Above                │
│ ├─ Add Row Below                │
│ ├─ Add Separator Above          │
│ ├─ Add Separator Below          │
│ ├─ Duplicate Row                │
│ ├─ Change Type ▶                │
│ │  ├─ Both Tables               │
│ │  ├─ Specs Only                │
│ │  └─ Invoice Only              │
│ ├─ Move Up ↑                    │
│ ├─ Move Down ↓                  │
│ └─ Delete Row                   │
└─────────────────────────────────┘
```

---

## Component Architecture

### Component Hierarchy

```
DualTableLayout.tsx (from Phase 1.5.c)
├── JobSpecsTable.tsx
│   ├── TableHeader
│   └── TableBody
│       ├── TableRow[] (existing)
│       │   ├── RowActionsDropdown.tsx (~150 lines) [NEW]
│       │   ├── RowTypeIndicator.tsx (~60 lines) [NEW]
│       │   ├── DragHandle.tsx (~40 lines) [NEW]
│       │   └── row content cells...
│       │
│       └── SeparatorRow.tsx (~100 lines) [NEW]
│           ├── Editable label input
│           ├── Full-width styling
│           └── Delete button
│
├── InvoiceTable.tsx
│   ├── TableHeader
│   └── TableBody
│       ├── TableRow[] (matching left side)
│       │   ├── RowActionsDropdown.tsx (shared)
│       │   ├── RowTypeIndicator.tsx (shared)
│       │   └── row content cells...
│       │
│       └── SeparatorRow.tsx (shared, different style)
│
└── AddRowModal.tsx (~180 lines) [NEW]
    ├── Row type selection (radio buttons)
    ├── Position selection (radio buttons)
    ├── Product name input
    └── Confirmation buttons

Backend Services
├── orderRowManagementService.ts (~220 lines) [NEW]
│   ├── createRow(orderId, rowData, position)
│   ├── deleteRow(orderId, partId)
│   ├── duplicateRow(orderId, partId)
│   ├── reorderRow(orderId, partId, newPosition)
│   ├── updateRowType(orderId, partId, newType)
│   └── renumberParts(orderId)
│
└── separatorService.ts (~120 lines) [NEW]
    ├── autoInsertSeparators(orderId)
    ├── detectParentChanges(parts[])
    └── createSeparator(orderId, label, position)
```

---

## Data Structures

### Row Type Enum

```typescript
type RowType = 'both' | 'specs_only' | 'invoice_only' | 'separator';
```

### Order Part with Row Management

```typescript
interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;          // Sequential: 1, 2, 3, 4...
  display_number: string;        // "1", "1a", "1b", "2", "2a"...
  is_parent: boolean;
  // Note: Row "type" is implicit based on which fields are populated (no row_type column)
  product_type: string;
  product_type_id: string;
  // ... other fields
}
```

### Add Row Request

```typescript
interface AddRowRequest {
  order_id: number;
  position: 'start' | 'end' | 'before' | 'after';
  reference_part_id?: number;    // If position is 'before' or 'after'
  product_name?: string;         // For regular rows
  separator_label?: string;      // For separator rows
  // Note: Row "type" will be implicit based on what data is added after creation:
  //   - If only product_name provided → user will add specs/invoice data → determines type
  //   - If separator_label provided → both specs and invoice fields remain NULL → separator type
}
```

### Reorder Request

```typescript
interface ReorderRequest {
  part_id: number;
  new_part_number: number;       // Target position
}
```

---

## Implementation Tasks

### Task 1: SeparatorRow Component (0.5 days)

**File:** `/frontend/web/src/components/orders/details/rows/SeparatorRow.tsx`

**Purpose:** Visual separator row that spans both tables

**Implementation:**

```typescript
import React, { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

interface SeparatorRowProps {
  part: OrderPart;
  onUpdate: (partId: number, field: string, value: any) => void;
  onDelete: (partId: number) => void;
  tableType: 'specs' | 'invoice';
}

export const SeparatorRow: React.FC<SeparatorRowProps> = ({
  part,
  onUpdate,
  onDelete,
  tableType
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(part.product_type || '───────');

  const handleSave = () => {
    onUpdate(part.part_id, 'product_type', label);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this separator?')) {
      onDelete(part.part_id);
    }
  };

  // Specs table: Full separator with label
  if (tableType === 'specs') {
    return (
      <div className="separator-row flex items-center border-b-2 border-gray-300 bg-gray-50 py-2">
        {/* Drag handle */}
        <div className="px-2">
          <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
        </div>

        {/* Separator label (editable) */}
        <div className="flex-1 px-4">
          {isEditing ? (
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSave}
              onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              className="w-full text-center text-sm text-gray-600 bg-transparent border-b border-gray-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-center text-sm text-gray-600 font-medium cursor-pointer hover:text-gray-800"
            >
              {label}
            </div>
          )}
        </div>

        {/* Delete button */}
        <div className="px-2">
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 transition"
            title="Delete separator"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Invoice table: Simple divider line
  return (
    <div className="separator-row flex items-center justify-center border-b-2 border-gray-300 bg-gray-50 py-2">
      <div className="text-gray-400 text-xs">
        ───────────────────
      </div>
    </div>
  );
};
```

**Key Features:**
- Editable label (click to edit, Enter or blur to save)
- Full-width styling with distinct border
- Drag handle for reordering
- Delete confirmation
- Different rendering for specs vs invoice table
- Persists label to database

**Edge Cases:**
- Empty label defaults to "───────"
- Delete requires confirmation
- Label can be very long → Truncate or wrap

---

### Task 2: RowTypeIndicator Component (0.25 days)

**File:** `/frontend/web/src/components/orders/details/rows/RowTypeIndicator.tsx`

**Purpose:** Visual badge showing which table(s) the row appears in

**Implementation:**

```typescript
import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface RowTypeIndicatorProps {
  part: OrderPart;  // Changed: receive full part object to compute type
  compact?: boolean;
}

export const RowTypeIndicator: React.FC<RowTypeIndicatorProps> = ({
  part,
  compact = false
}) => {
  // Compute row type implicitly from part data
  const hasSpecs = part.specifications != null;
  const hasInvoice = part.invoice_description != null || part.unit_price != null;
  const isSeparator = !hasSpecs && !hasInvoice;
  const isSpecsOnly = hasSpecs && !hasInvoice;
  const isInvoiceOnly = !hasSpecs && hasInvoice;
  const isBoth = hasSpecs && hasInvoice;

  if (isBoth) {
    // Default: no indicator needed
    return null;
  }

  const indicators = {
    specs_only: {
      label: 'Specs',
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: <Eye className="h-3 w-3" />
    },
    invoice_only: {
      label: 'Invoice',
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: <Eye className="h-3 w-3" />
    },
    separator: {
      label: 'Sep',
      color: 'bg-gray-100 text-gray-600 border-gray-300',
      icon: null
    }
  };

  // Determine which config to use
  const configKey = isSeparator ? 'separator' : isSpecsOnly ? 'specs_only' : 'invoice_only';
  const config = indicators[configKey];

  if (compact) {
    return (
      <div
        className={`inline-flex items-center px-1 py-0.5 rounded-sm text-[9px] font-medium border ${config.color}`}
        title={`${config.label} only`}
      >
        {config.icon}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.color}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
```

**Key Features:**
- Visual badges for non-default row types
- Compact mode for tight spaces
- Color-coded by type (blue=specs, green=invoice, gray=separator)
- Optional icon display
- Tooltip on hover

---

### Task 3: AddRowModal Component (0.5 days)

**File:** `/frontend/web/src/components/orders/details/modals/AddRowModal.tsx`

**Purpose:** Modal for adding new rows with type and position selection

**Implementation:**

```typescript
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddRowData) => void;
  referencePartNumber?: number;  // Current row number (if inserting relative)
}

interface AddRowData {
  position: 'start' | 'end' | 'before' | 'after';
  product_name?: string;
  separator_label?: string;
  // Note: Row type is implicit - if separator_label is provided, both specs and invoice stay NULL
}

export const AddRowModal: React.FC<AddRowModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  referencePartNumber
}) => {
  const [rowType, setRowType] = useState<RowType>('both');
  const [position, setPosition] = useState<'start' | 'end' | 'before' | 'after'>('end');
  const [productName, setProductName] = useState('');
  const [separatorLabel, setSeparatorLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isSeparator = rowType === 'separator';

  const handleSubmit = () => {
    setError(null);

    // Validation
    if (!isSeparator && !productName.trim()) {
      setError('Product name is required');
      return;
    }

    if (isSeparator && !separatorLabel.trim()) {
      setError('Separator label is required');
      return;
    }

    // Submit
    onAdd({
      row_type: rowType,
      position,
      product_name: isSeparator ? undefined : productName.trim(),
      separator_label: isSeparator ? separatorLabel.trim() : undefined
    });

    // Reset and close
    setRowType('both');
    setPosition('end');
    setProductName('');
    setSeparatorLabel('');
    onClose();
  };

  const handleCancel = () => {
    setRowType('both');
    setPosition('end');
    setProductName('');
    setSeparatorLabel('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Add New Row</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Row Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Row Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="rowType"
                  value="both"
                  checked={rowType === 'both'}
                  onChange={(e) => setRowType(e.target.value as RowType)}
                  className="mr-2"
                />
                <span className="text-sm">Both Tables (default)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="rowType"
                  value="specs_only"
                  checked={rowType === 'specs_only'}
                  onChange={(e) => setRowType(e.target.value as RowType)}
                  className="mr-2"
                />
                <span className="text-sm">Specs Table Only</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="rowType"
                  value="invoice_only"
                  checked={rowType === 'invoice_only'}
                  onChange={(e) => setRowType(e.target.value as RowType)}
                  className="mr-2"
                />
                <span className="text-sm">Invoice Table Only</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="rowType"
                  value="separator"
                  checked={rowType === 'separator'}
                  onChange={(e) => setRowType(e.target.value as RowType)}
                  className="mr-2"
                />
                <span className="text-sm">Separator</span>
              </label>
            </div>
          </div>

          {/* Position Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="position"
                  value="end"
                  checked={position === 'end'}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm">At end</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="position"
                  value="start"
                  checked={position === 'start'}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm">At beginning</span>
              </label>
              {referencePartNumber && (
                <>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="position"
                      value="before"
                      checked={position === 'before'}
                      onChange={(e) => setPosition(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">Before current row (#{referencePartNumber})</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="position"
                      value="after"
                      checked={position === 'after'}
                      onChange={(e) => setPosition(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">After current row (#{referencePartNumber})</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Product Name or Separator Label */}
          {isSeparator ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Separator Label
              </label>
              <input
                type="text"
                value={separatorLabel}
                onChange={(e) => setSeparatorLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Main Sign Components"
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Channel Letter, ACM Panel"
                autoFocus
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Add Row
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Key Features:**
- Four row type options (both, specs, invoice, separator)
- Four position options (start, end, before, after)
- Conditional fields (product name OR separator label)
- Client-side validation
- Keyboard support (Enter to submit, Esc to cancel)
- Auto-focus on text input

**Edge Cases:**
- Empty product name → Show error
- Empty separator label → Show error
- Position "before/after" only available if reference row exists

---

### Task 4: RowActionsDropdown Component (0.5 days)

**File:** `/frontend/web/src/components/orders/details/rows/RowActionsDropdown.tsx`

**Purpose:** Dropdown menu for all row operations

**Implementation:**

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, ArrowUp, ArrowDown, Copy, Trash2, Edit3 } from 'lucide-react';

interface RowActionsDropdownProps {
  part: OrderPart;
  isFirst: boolean;
  isLast: boolean;
  onAddRow: (position: 'before' | 'after', type?: RowType) => void;
  onDuplicate: () => void;
  onChangeType: (newType: RowType) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export const RowActionsDropdown: React.FC<RowActionsDropdownProps> = ({
  part,
  isFirst,
  isLast,
  onAddRow,
  onDuplicate,
  onChangeType,
  onMoveUp,
  onMoveDown,
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
        title="Row actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="py-1">
            {/* Add Row options */}
            <button
              onClick={() => handleAction(() => onAddRow('before'))}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            >
              Add Row Above
            </button>
            <button
              onClick={() => handleAction(() => onAddRow('after'))}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            >
              Add Row Below
            </button>
            <button
              onClick={() => handleAction(() => onAddRow('before', 'separator'))}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            >
              Add Separator Above
            </button>
            <button
              onClick={() => handleAction(() => onAddRow('after', 'separator'))}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            >
              Add Separator Below
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            {/* Duplicate */}
            <button
              onClick={() => handleAction(onDuplicate)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Duplicate Row
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            {/* Change Type submenu */}
            <div className="px-4 py-1 text-xs font-semibold text-gray-500">
              Change Type
            </div>
            <button
              onClick={() => handleAction(() => onChangeType('both'))}
              className={`w-full px-6 py-2 text-left text-sm hover:bg-gray-100 ${
                part.row_type === 'both' ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              Both Tables
            </button>
            <button
              onClick={() => handleAction(() => onChangeType('specs_only'))}
              className={`w-full px-6 py-2 text-left text-sm hover:bg-gray-100 ${
                part.row_type === 'specs_only' ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              Specs Only
            </button>
            <button
              onClick={() => handleAction(() => onChangeType('invoice_only'))}
              className={`w-full px-6 py-2 text-left text-sm hover:bg-gray-100 ${
                part.row_type === 'invoice_only' ? 'bg-green-50 text-green-700' : ''
              }`}
            >
              Invoice Only
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            {/* Move options */}
            <button
              onClick={() => handleAction(onMoveUp)}
              disabled={isFirst}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                isFirst ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ArrowUp className="h-4 w-4" />
              Move Up
            </button>
            <button
              onClick={() => handleAction(onMoveDown)}
              disabled={isLast}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                isLast ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ArrowDown className="h-4 w-4" />
              Move Down
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            {/* Delete */}
            <button
              onClick={() => handleAction(onDelete)}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Row
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

**Key Features:**
- Comprehensive action menu
- Context-aware (disable Move Up if first row)
- Visual indicators for current row type
- Icons for better UX
- Click-outside to close
- Keyboard navigation support (future enhancement)

---

### Task 5: Backend Row Management Service (1 day)

**File:** `/backend/web/src/services/orderRowManagementService.ts`

**Purpose:** Handle row CRUD operations and part number management

**Implementation:**

```typescript
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface CreateRowData {
  order_id: number;
  position: 'start' | 'end' | 'before' | 'after';
  reference_part_id?: number;
  product_name?: string;
  separator_label?: string;
  // Note: Row type is implicit - determined by which fields get populated after creation
}

export class OrderRowManagementService {
  /**
   * Create a new row in the order
   */
  async createRow(data: CreateRowData, userId: number): Promise<{ success: boolean; part_id: number }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Determine insertion position
      let newPartNumber: number;

      if (data.position === 'end') {
        // Insert at end
        const [maxPart] = await connection.execute<RowDataPacket[]>(
          'SELECT MAX(part_number) as max_num FROM order_parts WHERE order_id = ?',
          [data.order_id]
        );
        newPartNumber = (maxPart[0].max_num || 0) + 1;
      } else if (data.position === 'start') {
        // Insert at beginning
        newPartNumber = 1;
        // Shift all existing parts up
        await connection.execute(
          'UPDATE order_parts SET part_number = part_number + 1 WHERE order_id = ? ORDER BY part_number DESC',
          [data.order_id]
        );
      } else if (data.reference_part_id) {
        // Insert before/after reference part
        const [refPart] = await connection.execute<RowDataPacket[]>(
          'SELECT part_number FROM order_parts WHERE part_id = ?',
          [data.reference_part_id]
        );

        if (refPart.length === 0) {
          throw new Error('Reference part not found');
        }

        const refPartNumber = refPart[0].part_number;

        if (data.position === 'before') {
          newPartNumber = refPartNumber;
          // Shift parts at or after reference
          await connection.execute(
            'UPDATE order_parts SET part_number = part_number + 1 WHERE order_id = ? AND part_number >= ? ORDER BY part_number DESC',
            [data.order_id, refPartNumber]
          );
        } else { // 'after'
          newPartNumber = refPartNumber + 1;
          // Shift parts after reference
          await connection.execute(
            'UPDATE order_parts SET part_number = part_number + 1 WHERE order_id = ? AND part_number > ? ORDER BY part_number DESC',
            [data.order_id, refPartNumber]
          );
        }
      } else {
        throw new Error('Invalid position or missing reference_part_id');
      }

      // Create the new part
      const isSeparator = data.row_type === 'separator';
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO order_parts
         (order_id, part_number, display_number, is_parent, row_type, product_type, product_type_id, quantity, specifications)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.order_id,
          newPartNumber,
          String(newPartNumber), // Temporary, will be recalculated
          false,
          data.row_type,
          isSeparator ? (data.separator_label || '───────') : data.product_name,
          isSeparator ? 'separator' : '',
          0,
          JSON.stringify({ specs: [], specs_collapsed: false })
        ]
      );

      const newPartId = result.insertId;

      // Renumber all parts to update display numbers
      await this.renumberParts(data.order_id, connection);

      await connection.commit();

      return {
        success: true,
        part_id: newPartId
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a row from the order
   */
  async deleteRow(orderId: number, partId: number): Promise<{ success: boolean }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get part number of row to delete
      const [part] = await connection.execute<RowDataPacket[]>(
        'SELECT part_number FROM order_parts WHERE part_id = ? AND order_id = ?',
        [partId, orderId]
      );

      if (part.length === 0) {
        throw new Error('Part not found');
      }

      const deletedPartNumber = part[0].part_number;

      // Delete associated tasks
      await connection.execute(
        'DELETE FROM order_tasks WHERE part_id = ?',
        [partId]
      );

      // Delete the part
      await connection.execute(
        'DELETE FROM order_parts WHERE part_id = ?',
        [partId]
      );

      // Shift remaining parts down
      await connection.execute(
        'UPDATE order_parts SET part_number = part_number - 1 WHERE order_id = ? AND part_number > ?',
        [orderId, deletedPartNumber]
      );

      // Renumber to update display numbers
      await this.renumberParts(orderId, connection);

      await connection.commit();

      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Duplicate a row (copy all data to new row)
   */
  async duplicateRow(orderId: number, partId: number): Promise<{ success: boolean; new_part_id: number }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get source part data
      const [sourcePart] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM order_parts WHERE part_id = ? AND order_id = ?',
        [partId, orderId]
      );

      if (sourcePart.length === 0) {
        throw new Error('Part not found');
      }

      const source = sourcePart[0];
      const newPartNumber = source.part_number + 1;

      // Shift parts after source
      await connection.execute(
        'UPDATE order_parts SET part_number = part_number + 1 WHERE order_id = ? AND part_number >= ? ORDER BY part_number DESC',
        [orderId, newPartNumber]
      );

      // Create duplicate part
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO order_parts
         (order_id, part_number, display_number, is_parent, row_type, product_type, product_type_id,
          channel_letter_type_id, base_product_type_id, invoice_description, quantity, unit_price,
          extended_price, specifications, production_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          newPartNumber,
          source.display_number,
          source.is_parent,
          source.row_type,
          `${source.product_type} (copy)`,
          source.product_type_id,
          source.channel_letter_type_id,
          source.base_product_type_id,
          source.invoice_description,
          source.quantity,
          source.unit_price,
          source.extended_price,
          source.specifications,
          source.production_notes
        ]
      );

      const newPartId = result.insertId;

      // Renumber to update display numbers
      await this.renumberParts(orderId, connection);

      await connection.commit();

      return {
        success: true,
        new_part_id: newPartId
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Move a row up or down
   */
  async reorderRow(orderId: number, partId: number, direction: 'up' | 'down'): Promise<{ success: boolean }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get current part
      const [currentPart] = await connection.execute<RowDataPacket[]>(
        'SELECT part_number FROM order_parts WHERE part_id = ? AND order_id = ?',
        [partId, orderId]
      );

      if (currentPart.length === 0) {
        throw new Error('Part not found');
      }

      const currentPartNumber = currentPart[0].part_number;
      const targetPartNumber = direction === 'up' ? currentPartNumber - 1 : currentPartNumber + 1;

      // Check if target position exists
      const [targetPart] = await connection.execute<RowDataPacket[]>(
        'SELECT part_id FROM order_parts WHERE order_id = ? AND part_number = ?',
        [orderId, targetPartNumber]
      );

      if (targetPart.length === 0) {
        // Already at boundary
        await connection.commit();
        return { success: true };
      }

      // Swap part numbers
      const targetPartId = targetPart[0].part_id;

      // Temp number to avoid constraint violations
      await connection.execute(
        'UPDATE order_parts SET part_number = -1 WHERE part_id = ?',
        [partId]
      );

      await connection.execute(
        'UPDATE order_parts SET part_number = ? WHERE part_id = ?',
        [currentPartNumber, targetPartId]
      );

      await connection.execute(
        'UPDATE order_parts SET part_number = ? WHERE part_id = ?',
        [targetPartNumber, partId]
      );

      // Renumber to update display numbers
      await this.renumberParts(orderId, connection);

      await connection.commit();

      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Change row type (both, specs_only, invoice_only)
   */
  async updateRowType(orderId: number, partId: number, newType: RowType): Promise<{ success: boolean }> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE order_parts SET row_type = ? WHERE part_id = ? AND order_id = ?',
      [newType, partId, orderId]
    );

    return {
      success: result.affectedRows > 0
    };
  }

  /**
   * Renumber all parts and recalculate display numbers
   */
  private async renumberParts(orderId: number, connection: any): Promise<void> {
    // Get all parts in order
    const [parts] = await connection.execute<RowDataPacket[]>(
      'SELECT part_id, part_number, product_type_id FROM order_parts WHERE order_id = ? ORDER BY part_number',
      [orderId]
    );

    let displayCounter = 1;
    let currentParentNumber = '1';
    let subPartLetter = 0;
    let lastProductTypeId: string | null = null;

    for (const part of parts) {
      let displayNumber: string;
      let isParent: boolean;

      // Separators don't affect numbering
      if (part.product_type_id === 'separator') {
        displayNumber = '';
        isParent = false;
      } else {
        // Detect parent change
        const isNewParent = lastProductTypeId === null || lastProductTypeId !== part.product_type_id;

        if (isNewParent) {
          // Start new parent
          currentParentNumber = String(displayCounter);
          displayNumber = currentParentNumber;
          isParent = true;
          subPartLetter = 0;
          displayCounter++;
        } else {
          // Sub-part of current parent
          subPartLetter++;
          const letter = String.fromCharCode(96 + subPartLetter); // a, b, c...
          displayNumber = `${currentParentNumber}${letter}`;
          isParent = false;
        }

        lastProductTypeId = part.product_type_id;
      }

      // Update display_number and is_parent
      await connection.execute(
        'UPDATE order_parts SET display_number = ?, is_parent = ? WHERE part_id = ?',
        [displayNumber, isParent, part.part_id]
      );
    }
  }
}

export const orderRowManagementService = new OrderRowManagementService();
```

**Key Features:**
- Row insertion at any position with automatic renumbering
- Delete with cascade (removes associated tasks)
- Duplicate copies all data including specs
- Move up/down with swap logic
- Display number recalculation algorithm
- Transaction safety for all operations

---

## API Endpoints

### POST /api/orders/:orderNumber/parts

**Request:**
```json
{
  "row_type": "both",
  "position": "after",
  "reference_part_id": 123,
  "product_name": "ACM Panel"
}
```

**Response:**
```json
{
  "success": true,
  "part_id": 456
}
```

### DELETE /api/orders/:orderNumber/parts/:partId

### POST /api/orders/:orderNumber/parts/:partId/duplicate

**Response:**
```json
{
  "success": true,
  "new_part_id": 789
}
```

### PUT /api/orders/:orderNumber/parts/:partId/reorder

**Request:**
```json
{
  "direction": "up"
}
```

### PUT /api/orders/:orderNumber/parts/:partId/type

**Request:**
```json
{
  "row_type": "specs_only"
}
```

---

## Testing Checklist

### Visual Tests
- [ ] Separator rows span full width in both tables
- [ ] Empty cells show gray background correctly
- [ ] Row type indicators display for non-default types
- [ ] Drag handles visible and cursor changes on hover
- [ ] Add Row modal renders correctly
- [ ] Actions dropdown opens and closes properly
- [ ] Move up/down arrows disabled at boundaries

### Functional Tests
- [ ] Add row at end works
- [ ] Add row at beginning works
- [ ] Add row before/after current row works
- [ ] Add separator works
- [ ] Delete row removes from database
- [ ] Delete row triggers confirmation
- [ ] Duplicate row copies all data
- [ ] Move up swaps with previous row
- [ ] Move down swaps with next row
- [ ] Change row type updates database
- [ ] Part numbers renumber after operations

### Data Integrity Tests
- [ ] Part numbers always sequential (1, 2, 3, 4...)
- [ ] Display numbers update after reorder (1, 1a, 1b, 2...)
- [ ] No gaps in part_number sequence
- [ ] Deleting part deletes associated tasks
- [ ] Duplicate creates new part_id
- [ ] Transaction rollback on error

### UI/UX Tests
- [ ] Add Row modal closes on Cancel
- [ ] Add Row modal closes on successful add
- [ ] Actions dropdown closes on action
- [ ] Actions dropdown closes on click-outside
- [ ] Keyboard shortcuts work (future)
- [ ] Loading states during operations
- [ ] Error messages display correctly

---

## Success Criteria

Phase 1.5.e is COMPLETE when:

1. ✅ Separator rows display correctly in both tables
2. ✅ Add row functionality works (all positions)
3. ✅ Delete row functionality works (with confirmation)
4. ✅ Duplicate row functionality works
5. ✅ Move up/down functionality works
6. ✅ Row type toggle works (both ↔ specs ↔ invoice)
7. ✅ Empty cells show gray background
8. ✅ Part numbers renumber automatically
9. ✅ Display numbers recalculate correctly
10. ✅ All operations persist to database
11. ✅ Transaction safety maintained
12. ✅ No orphaned tasks after delete
13. ✅ UI responsive and intuitive
14. ✅ No console errors
15. ✅ Performance acceptable (< 500ms operations)

---

## Dependencies

**Requires:**
- Phase 1.5.d complete (specs/tasks system)
- order_parts.row_type column exists
- order_parts.display_number logic working

**Blocks:**
- Phase 1.5.f (finalization needs complete row management)

---

## Files Created/Modified

### New Files (5)
- `/frontend/web/src/components/orders/details/rows/SeparatorRow.tsx` (~100 lines)
- `/frontend/web/src/components/orders/details/rows/RowTypeIndicator.tsx` (~60 lines)
- `/frontend/web/src/components/orders/details/rows/RowActionsDropdown.tsx` (~150 lines)
- `/frontend/web/src/components/orders/details/modals/AddRowModal.tsx` (~180 lines)
- `/backend/web/src/services/orderRowManagementService.ts` (~220 lines)

### Modified Files (3)
- `/frontend/web/src/components/orders/details/JobSpecsTable.tsx` (integrate SeparatorRow, RowActionsDropdown)
- `/frontend/web/src/components/orders/details/InvoiceTable.tsx` (integrate SeparatorRow, empty cells)
- `/backend/web/src/routes/ordersRoutes.ts` (add row management endpoints)

**Total Lines Added:** ~710 lines
**Complexity:** Medium-High

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-05
**Estimated Completion:** 2 days after start
