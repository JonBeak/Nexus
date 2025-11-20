# Phase 1.5.c: Job Details Setup UI - Layout & Structure

**Status:** 📋 Ready to Implement
**Priority:** HIGH
**Duration:** 4-5 days
**Last Updated:** 2025-11-05

---

## Overview

Phase 1.5.c implements the complete Job Details Setup interface - the core UI where managers configure order specs, invoice details, and prepare orders for production. This is the most substantial frontend component of Phase 1.5.

**Key Deliverables:**
1. Dual-table layout (Job Specs left, Invoice right)
2. Order-wide editable fields (top section)
3. Synchronized row heights between tables
4. Parent/sub-part visual differentiation
5. Inline editing for all fields
6. Row type management (both, specs_only, invoice_only, separator)
7. Real-time field validation
8. Specs/Invoice discrepancy warnings

---

## Visual Design Reference

### Full Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Orders   ORDER #200001 - Job Details Setup            [Save] [Preview]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─── ORDER INFORMATION ─────────────────────────────────────────────────┐  │
│ │                                                                         │  │
│ │ Job Name: [Acme Corp Storefront Signs_________________]                │  │
│ │                                                                         │  │
│ │ Customer: [Acme Corp ▼]   PO#: [PO-12345]   Job#: [ACM-2024-11]      │  │
│ │                                                                         │  │
│ │ Point Person: [john@acme.com______]  Due: [2025-11-20 ▼]             │  │
│ │                                                                         │  │
│ │ Hard Deadline: [☐] Include time: [--:-- ▼]                            │  │
│ │                                                                         │  │
│ │ Manufacturing Note (Customer-Facing):                                  │  │
│ │ ┌───────────────────────────────────────────────────────────────────┐ │  │
│ │ │ Use outdoor-rated materials. Customer prefers white LEDs...       │ │  │
│ │ └───────────────────────────────────────────────────────────────────┘ │  │
│ │                                                                         │  │
│ │ Internal Note (Private - Manager+ Only):                               │  │
│ │ ┌───────────────────────────────────────────────────────────────────┐ │  │
│ │ │ Watch for rush requests, they pay late sometimes...               │ │  │
│ │ └───────────────────────────────────────────────────────────────────┘ │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ ⚠️ Warning: Specs and Invoice differ. Review before finalizing.            │
│                                                                             │
│ ┌─── JOB SPECS ──────────────┬─── INVOICE ──────────────────────────────┐  │
│ │                             │                                          │  │
│ │ Item Name    Specs ▼  Tasks│ Item Name    Desc    QTY  Unit    Total  │  │
│ ├─────────────────────────────┼──────────────────────────────────────────┤  │
│ │ Channel      [Expanded]     │ Channel      Front    8   $45.00  $360  │  │
│ │ Letter 3"    LEDs: White... │ Letter 3"    Lit                        │  │
│ │ (Parent)     PS: 12V 5A...  │ Front Lit                               │  │
│ ├─────────────────────────────┼──────────────────────────────────────────┤  │
│ │ LEDs         [Collapsed]    │ LEDs         White    64  $0.25   $16   │  │
│ │              2 specs         │              5mm                        │  │
│ ├─────────────────────────────┼──────────────────────────────────────────┤  │
│ │ Power Supply [Collapsed]    │ Power Supply 12V 5A   2   $40.00  $80   │  │
│ │              2 specs         │                                         │  │
│ ├─────────────────────────────┼──────────────────────────────────────────┤  │
│ │ ─────── Section ────────────┼──────────────────────────────────────────│  │
│ ├─────────────────────────────┼──────────────────────────────────────────┤  │
│ │ ACM Panel    [Collapsed]    │ ACM Panel    24x36    1   $120.00 $120  │  │
│ │ 24x36        1 spec          │                                         │  │
│ └─────────────────────────────┴──────────────────────────────────────────┘  │
│                                                                             │
│ [+ Add Row ▼]  [Generate Tasks for All]                   Subtotal: $576   │
│                                                                  Tax: $23    │
│                                                                Total: $599   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Component Hierarchy

```
OrderDetailsPage.tsx (~150 lines)
├── useOrderDetails() hook
├── Status detection (job_details_setup vs others)
│
├── JobDetailsSetupView.tsx (~400 lines) [IF status = 'job_details_setup']
│   ├── State management (order data, parts, validation)
│   ├── OrderInfoSection.tsx (~200 lines)
│   │   ├── Job name input
│   │   ├── Customer dropdown (loads from customers API)
│   │   ├── Customer PO# input
│   │   ├── Customer Job# input
│   │   ├── Point person email input (validated)
│   │   ├── Due date picker
│   │   ├── Hard deadline checkbox + time picker
│   │   ├── Manufacturing note textarea (auto-resize)
│   │   └── Internal note textarea (Manager+ only)
│   │
│   ├── DiscrepancyWarning.tsx (~50 lines)
│   │   └── Shows when specs ≠ invoice
│   │
│   ├── DualTableLayout.tsx (~300 lines)
│   │   ├── Container with fixed column widths
│   │   ├── Synchronized scroll (vertical only)
│   │   ├── JobSpecsTable (~200 lines)
│   │   │   ├── Table header (Item Name | Specs | Tasks)
│   │   │   └── TableRow[] components
│   │   │       ├── ItemNameCell (~80 lines)
│   │   │       ├── SpecsCell (~150 lines) [Phase 1.5.d]
│   │   │       └── TasksCell (~100 lines) [Phase 1.5.d]
│   │   │
│   │   └── InvoiceTable (~200 lines)
│   │       ├── Table header (Item Name | Desc | QTY | Unit | Total)
│   │       └── TableRow[] components
│   │           ├── ItemNameCell (~80 lines)
│   │           ├── DescriptionCell (~60 lines)
│   │           ├── QuantityCell (~60 lines)
│   │           ├── UnitPriceCell (~60 lines)
│   │           └── ExtendedPriceCell (~60 lines)
│   │
│   ├── InvoiceSummary.tsx (~80 lines)
│   │   ├── Subtotal calculation
│   │   ├── Tax calculation
│   │   └── Total calculation
│   │
│   └── ActionBar.tsx (~100 lines)
│       ├── Add Row button + dropdown
│       ├── Generate Tasks button
│       └── Save Changes button
│
└── StandardPhaseView.tsx (~250 lines) [IF status ≠ 'job_details_setup']
    └── Existing Phase 1 UI (progress tracking, etc.)
```

---

## Implementation Tasks

### Task 1: OrderDetailsPage Router (0.5 days)

**File:** `/frontend/web/src/components/orders/details/OrderDetailsPage.tsx`

**Purpose:** Route between Job Details Setup view and standard view based on order status

**Implementation:**

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/api';
import { JobDetailsSetupView } from './JobDetailsSetupView';
import { StandardPhaseView } from './StandardPhaseView';
import { Loader } from '@/components/shared/Loader';
import { ErrorMessage } from '@/components/shared/ErrorMessage';

interface OrderDetailsPageProps {}

export const OrderDetailsPage: React.FC<OrderDetailsPageProps> = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    loadOrderData();
  }, [orderNumber]);

  const loadOrderData = async () => {
    if (!orderNumber) {
      setError('Order number is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/api/orders/${orderNumber}`);

      if (response.data.success) {
        setOrderData(response.data.order);
      } else {
        setError(response.data.message || 'Failed to load order');
      }
    } catch (err: any) {
      console.error('Error loading order:', err);
      setError(err.response?.data?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderUpdate = async () => {
    await loadOrderData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader text="Loading order..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorMessage message={error} />
        <button
          onClick={() => navigate('/orders')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="p-8">
        <ErrorMessage message="Order not found" />
        <button
          onClick={() => navigate('/orders')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  // Route based on status
  const isJobDetailsSetup = orderData.status === 'job_details_setup';

  return (
    <div className="order-details-page">
      {isJobDetailsSetup ? (
        <JobDetailsSetupView
          order={orderData}
          onUpdate={handleOrderUpdate}
        />
      ) : (
        <StandardPhaseView
          order={orderData}
          onUpdate={handleOrderUpdate}
        />
      )}
    </div>
  );
};
```

---

### Task 2: OrderInfoSection Component (1 day)

**File:** `/frontend/web/src/components/orders/details/OrderInfoSection.tsx`

**Purpose:** Order-wide editable fields at the top of the page

**Implementation:**

```typescript
import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface OrderInfoSectionProps {
  order: any;
  onChange: (field: string, value: any) => void;
  isManager: boolean;
}

export const OrderInfoSection: React.FC<OrderInfoSectionProps> = ({
  order,
  onChange,
  isManager
}) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [useHardDeadline, setUseHardDeadline] = useState(!!order.hard_due_date_time);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await apiClient.get('/api/customers');
      if (response.data.success) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleHardDeadlineToggle = (checked: boolean) => {
    setUseHardDeadline(checked);
    if (!checked) {
      onChange('hard_due_date_time', null);
    }
  };

  const formatDateForInput = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  };

  const formatTimeForInput = (datetime: string | null) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="order-info-section bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Order Information</h2>

      {/* Row 1: Job Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Job Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={order.order_name || ''}
          onChange={(e) => onChange('order_name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter job name"
          required
        />
      </div>

      {/* Row 2: Customer, PO#, Job# */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer <span className="text-red-500">*</span>
          </label>
          <select
            value={order.customer_id || ''}
            onChange={(e) => onChange('customer_id', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loadingCustomers}
            required
          >
            <option value="">Select customer...</option>
            {customers.map(customer => (
              <option key={customer.customer_id} value={customer.customer_id}>
                {customer.customer_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer PO#
          </label>
          <input
            type="text"
            value={order.customer_po || ''}
            onChange={(e) => onChange('customer_po', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="PO-12345"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Job#
          </label>
          <input
            type="text"
            value={order.customer_job_number || ''}
            onChange={(e) => onChange('customer_job_number', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="JOB-2024-11"
          />
        </div>
      </div>

      {/* Row 3: Point Person, Due Date */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Point Person Email
          </label>
          <input
            type="email"
            value={order.point_person_email || ''}
            onChange={(e) => onChange('point_person_email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="contact@customer.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Due Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={formatDateForInput(order.due_date)}
              onChange={(e) => onChange('due_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Row 4: Hard Deadline */}
      <div className="mb-4">
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <input
            type="checkbox"
            checked={useHardDeadline}
            onChange={(e) => handleHardDeadlineToggle(e.target.checked)}
            className="mr-2"
          />
          Critical Deadline (requires exact time)
        </label>
        {useHardDeadline && (
          <div className="ml-6">
            <input
              type="time"
              value={formatTimeForInput(order.hard_due_date_time)}
              onChange={(e) => {
                const date = order.due_date || new Date().toISOString().split('T')[0];
                const datetime = `${date}T${e.target.value}:00`;
                onChange('hard_due_date_time', datetime);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-500">
              Must be completed by this time
            </span>
          </div>
        )}
      </div>

      {/* Row 5: Manufacturing Note */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Manufacturing Note (Customer-Facing)
        </label>
        <textarea
          value={order.manufacturing_note || ''}
          onChange={(e) => onChange('manufacturing_note', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="Instructions from customer, preferences, special requirements..."
        />
        <p className="text-xs text-gray-500 mt-1">
          This note will be visible on customer-facing documents
        </p>
      </div>

      {/* Row 6: Internal Note (Manager+ only) */}
      {isManager && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Internal Note (Private - Manager+ Only)
          </label>
          <textarea
            value={order.internal_note || ''}
            onChange={(e) => onChange('internal_note', e.target.value)}
            className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            rows={3}
            placeholder="Private notes, payment concerns, special handling..."
          />
          <p className="text-xs text-amber-600 mt-1">
            🔒 Only visible to Manager and Owner roles
          </p>
        </div>
      )}
    </div>
  );
};
```

---

### Task 3: DualTableLayout Component (1.5 days)

**File:** `/frontend/web/src/components/orders/details/DualTableLayout.tsx`

**Purpose:** Container for synchronized dual tables

**Implementation:**

```typescript
import React, { useRef, useEffect } from 'react';
import { JobSpecsTable } from './JobSpecsTable';
import { InvoiceTable } from './InvoiceTable';

interface DualTableLayoutProps {
  parts: OrderPart[];
  onPartUpdate: (partId: number, field: string, value: any) => void;
  onAddRow: (position?: number, type?: string) => void;
  onDeleteRow: (partId: number) => void;
  onReorderRow: (partId: number, direction: 'up' | 'down') => void;
}

export const DualTableLayout: React.FC<DualTableLayoutProps> = ({
  parts,
  onPartUpdate,
  onAddRow,
  onDeleteRow,
  onReorderRow
}) => {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Synchronize scroll between tables
  const handleLeftScroll = () => {
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  };

  useEffect(() => {
    const leftEl = leftScrollRef.current;
    const rightEl = rightScrollRef.current;

    if (leftEl && rightEl) {
      leftEl.addEventListener('scroll', handleLeftScroll);
      rightEl.addEventListener('scroll', handleRightScroll);

      return () => {
        leftEl.removeEventListener('scroll', handleLeftScroll);
        rightEl.removeEventListener('scroll', handleRightScroll);
      };
    }
  }, []);

  return (
    <div className="dual-table-layout bg-white rounded-lg shadow">
      <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
        <div className="px-4 py-3 bg-blue-50 font-semibold border-r border-gray-200">
          Job Specs
        </div>
        <div className="px-4 py-3 bg-green-50 font-semibold">
          Invoice
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0">
        {/* Left Table: Job Specs */}
        <div
          ref={leftScrollRef}
          className="overflow-y-auto max-h-[600px] border-r border-gray-200"
        >
          <JobSpecsTable
            parts={parts}
            onPartUpdate={onPartUpdate}
            onDeleteRow={onDeleteRow}
            onReorderRow={onReorderRow}
          />
        </div>

        {/* Right Table: Invoice */}
        <div
          ref={rightScrollRef}
          className="overflow-y-auto max-h-[600px]"
        >
          <InvoiceTable
            parts={parts}
            onPartUpdate={onPartUpdate}
            onDeleteRow={onDeleteRow}
            onReorderRow={onReorderRow}
          />
        </div>
      </div>
    </div>
  );
};
```

---

### Task 4: JobSpecsTable Component (1 day)

**File:** `/frontend/web/src/components/orders/details/JobSpecsTable.tsx`

**Purpose:** Left table showing item names, specs, and tasks

**Implementation:**

```typescript
import React from 'react';
import { ChevronDown, ChevronRight, Trash2, GripVertical } from 'lucide-react';

interface JobSpecsTableProps {
  parts: OrderPart[];
  onPartUpdate: (partId: number, field: string, value: any) => void;
  onDeleteRow: (partId: number) => void;
  onReorderRow: (partId: number, direction: 'up' | 'down') => void;
}

export const JobSpecsTable: React.FC<JobSpecsTableProps> = ({
  parts,
  onPartUpdate,
  onDeleteRow,
  onReorderRow
}) => {
  const renderRow = (part: OrderPart, index: number) => {
    // Determine row type implicitly based on populated fields
    const hasSpecs = part.specifications != null;
    const hasInvoice = part.invoice_description != null || part.unit_price != null;
    const isSeparator = !hasSpecs && !hasInvoice;
    const isSpecsOnly = hasSpecs && !hasInvoice;
    const isBoth = hasSpecs && hasInvoice;
    const showInThisTable = isSeparator || isSpecsOnly || isBoth;

    if (!showInThisTable) {
      // Invoice-only row: show empty cell with gray background
      return (
        <div
          key={part.part_id}
          className="flex items-center border-b border-gray-200 bg-gray-100 min-h-[60px]"
        >
          <div className="flex-1 px-4 py-3 text-gray-400 italic">
            (Invoice only)
          </div>
        </div>
      );
    }

    if (isSeparator) {
      return (
        <div
          key={part.part_id}
          className="flex items-center border-b border-gray-300 bg-gray-50 py-2"
        >
          <GripVertical className="h-4 w-4 text-gray-400 ml-2 cursor-move" />
          <input
            type="text"
            value={part.product_type || '─────── Section ───────'}
            onChange={(e) => onPartUpdate(part.part_id, 'product_type', e.target.value)}
            className="flex-1 px-4 py-1 text-center text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={() => onDeleteRow(part.part_id)}
            className="p-2 text-gray-400 hover:text-red-600"
            title="Delete separator"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      );
    }

    const isParent = part.is_parent;
    const displayNumber = part.display_number;

    return (
      <div
        key={part.part_id}
        className={`flex items-start border-b border-gray-200 min-h-[60px] ${
          isParent ? 'bg-blue-25' : 'bg-white'
        }`}
      >
        {/* Drag Handle */}
        <div className="flex flex-col items-center py-2 px-2">
          <GripVertical className="h-4 w-4 text-gray-400 cursor-move mb-1" />
          <span className={`text-xs text-gray-500 ${isParent ? 'font-semibold' : ''}`}>
            {displayNumber}
          </span>
        </div>

        {/* Item Name */}
        <div className="flex-1 px-3 py-3">
          <input
            type="text"
            value={part.product_type || ''}
            onChange={(e) => onPartUpdate(part.part_id, 'product_type', e.target.value)}
            className={`w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isParent ? 'font-semibold text-base' : 'text-sm'
            }`}
            placeholder="Item name"
          />
        </div>

        {/* Specs Column (Phase 1.5.d will expand) */}
        <div className="w-40 px-3 py-3">
          <div className="text-sm text-gray-500 text-center">
            Specs (Phase 1.5.d)
          </div>
        </div>

        {/* Tasks Column (Phase 1.5.d will expand) */}
        <div className="w-32 px-3 py-3">
          <div className="text-sm text-gray-500 text-center">
            Tasks (Phase 1.5.d)
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center py-2 px-2">
          <button
            onClick={() => onDeleteRow(part.part_id)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete row"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="job-specs-table">
      {/* Table Header */}
      <div className="flex items-center border-b-2 border-gray-300 bg-gray-50 font-semibold text-sm">
        <div className="w-10 px-2 py-2">#</div>
        <div className="flex-1 px-3 py-2">Item Name</div>
        <div className="w-40 px-3 py-2 text-center">Specs</div>
        <div className="w-32 px-3 py-2 text-center">Tasks</div>
        <div className="w-10 px-2 py-2"></div>
      </div>

      {/* Table Body */}
      <div>
        {parts.map((part, index) => renderRow(part, index))}
      </div>

      {/* Empty State */}
      {parts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No parts yet. Click "Add Row" to get started.
        </div>
      )}
    </div>
  );
};
```

---

### Task 5: InvoiceTable Component (1 day)

**File:** `/frontend/web/src/components/orders/details/InvoiceTable.tsx`

**Purpose:** Right table showing item names, descriptions, quantities, prices

**Implementation:**

```typescript
import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';

interface InvoiceTableProps {
  parts: OrderPart[];
  onPartUpdate: (partId: number, field: string, value: any) => void;
  onDeleteRow: (partId: number) => void;
  onReorderRow: (partId: number, direction: 'up' | 'down') => void;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  parts,
  onPartUpdate,
  onDeleteRow,
  onReorderRow
}) => {
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return value.toFixed(2);
  };

  const handlePriceChange = (partId: number, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    onPartUpdate(partId, field, numValue);

    // Auto-calculate extended price if quantity or unit price changes
    const part = parts.find(p => p.part_id === partId);
    if (part) {
      if (field === 'unit_price') {
        const extended = numValue * (part.quantity || 0);
        onPartUpdate(partId, 'extended_price', extended);
      } else if (field === 'quantity') {
        const extended = numValue * (part.unit_price || 0);
        onPartUpdate(partId, 'extended_price', extended);
      }
    }
  };

  const renderRow = (part: OrderPart, index: number) => {
    // Determine row type implicitly based on populated fields
    const hasSpecs = part.specifications != null;
    const hasInvoice = part.invoice_description != null || part.unit_price != null;
    const isSeparator = !hasSpecs && !hasInvoice;
    const isInvoiceOnly = !hasSpecs && hasInvoice;
    const isBoth = hasSpecs && hasInvoice;
    const showInThisTable = isSeparator || isInvoiceOnly || isBoth;

    if (!showInThisTable) {
      // Specs-only row: show empty cell with gray background
      return (
        <div
          key={part.part_id}
          className="flex items-center border-b border-gray-200 bg-gray-100 min-h-[60px]"
        >
          <div className="flex-1 px-4 py-3 text-gray-400 italic text-center">
            (Specs only)
          </div>
        </div>
      );
    }

    if (isSeparator) {
      return (
        <div
          key={part.part_id}
          className="flex items-center border-b border-gray-300 bg-gray-50 py-2"
        >
          <div className="flex-1 text-center text-gray-400">
            ───────────────────
          </div>
        </div>
      );
    }

    const isParent = part.is_parent;
    const displayNumber = part.display_number;

    return (
      <div
        key={part.part_id}
        className={`flex items-start border-b border-gray-200 min-h-[60px] ${
          isParent ? 'bg-green-25' : 'bg-white'
        }`}
      >
        {/* Display Number */}
        <div className="w-10 px-2 py-3 text-center">
          <span className={`text-xs text-gray-500 ${isParent ? 'font-semibold' : ''}`}>
            {displayNumber}
          </span>
        </div>

        {/* Item Name */}
        <div className="flex-1 px-2 py-3">
          <input
            type="text"
            value={part.product_type || ''}
            onChange={(e) => onPartUpdate(part.part_id, 'product_type', e.target.value)}
            className={`w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isParent ? 'font-semibold text-base' : 'text-sm'
            }`}
            placeholder="Item name"
          />
        </div>

        {/* Description */}
        <div className="w-48 px-2 py-3">
          <input
            type="text"
            value={part.invoice_description || ''}
            onChange={(e) => onPartUpdate(part.part_id, 'invoice_description', e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Description"
          />
        </div>

        {/* Quantity */}
        <div className="w-20 px-2 py-3">
          <input
            type="number"
            value={part.quantity || ''}
            onChange={(e) => handlePriceChange(part.part_id, 'quantity', e.target.value)}
            className="w-full px-2 py-1 text-sm text-right border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0"
            step="0.01"
            min="0"
          />
        </div>

        {/* Unit Price */}
        <div className="w-24 px-2 py-3">
          <div className="flex items-center">
            <span className="text-gray-500 mr-1">$</span>
            <input
              type="number"
              value={formatCurrency(part.unit_price)}
              onChange={(e) => handlePriceChange(part.part_id, 'unit_price', e.target.value)}
              className="flex-1 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        {/* Extended Price (calculated) */}
        <div className="w-28 px-2 py-3">
          <div className="text-sm text-right font-medium">
            ${formatCurrency(part.extended_price)}
          </div>
        </div>

        {/* Actions */}
        <div className="w-10 px-2 py-3">
          <button
            onClick={() => onDeleteRow(part.part_id)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete row"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="invoice-table">
      {/* Table Header */}
      <div className="flex items-center border-b-2 border-gray-300 bg-gray-50 font-semibold text-sm">
        <div className="w-10 px-2 py-2">#</div>
        <div className="flex-1 px-2 py-2">Item Name</div>
        <div className="w-48 px-2 py-2">Description</div>
        <div className="w-20 px-2 py-2 text-right">QTY</div>
        <div className="w-24 px-2 py-2 text-right">Unit Price</div>
        <div className="w-28 px-2 py-2 text-right">Total</div>
        <div className="w-10 px-2 py-2"></div>
      </div>

      {/* Table Body */}
      <div>
        {parts.map((part, index) => renderRow(part, index))}
      </div>

      {/* Empty State */}
      {parts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No parts yet. Click "Add Row" to get started.
        </div>
      )}
    </div>
  );
};
```

---

## Testing Checklist

### Visual Tests
- [ ] Dual tables display side-by-side
- [ ] Row heights synchronized between tables
- [ ] Scroll synchronized between tables
- [ ] Parent items visually distinct (bold, larger)
- [ ] Sub-parts indented or numbered correctly
- [ ] Separator rows span full width
- [ ] Empty cells show gray background
- [ ] All inputs editable inline

### Functional Tests
- [ ] Order info fields save correctly
- [ ] Customer dropdown loads customers
- [ ] Due date picker works
- [ ] Hard deadline toggle works
- [ ] Manufacturing note auto-resizes
- [ ] Internal note only visible to Manager+
- [ ] Item names editable in both tables
- [ ] Description editable in invoice table
- [ ] Quantity/price changes auto-calculate total
- [ ] Add row button works
- [ ] Delete row button works
- [ ] Reorder rows works

### Data Tests
- [ ] Changes saved to database
- [ ] Page reload preserves data
- [ ] Navigation away and back preserves changes
- [ ] Discrepancy warning shows when specs ≠ invoice

---

## Success Criteria

Phase 1.5.c is COMPLETE when:

1. ✅ Order info section displays all fields
2. ✅ All fields editable and save correctly
3. ✅ Dual-table layout renders correctly
4. ✅ Tables synchronized (scroll + row heights)
5. ✅ Parent/sub-part visual differentiation works
6. ✅ Separator rows display correctly
7. ✅ Empty cells show gray background
8. ✅ Add/delete/reorder rows works
9. ✅ Invoice calculations work (qty × price)
10. ✅ No layout issues or visual bugs

---

## Dependencies

**Requires:**
- Phase 1.5.a complete (order creation working)
- Phase 1.5.b complete (database schema updated)

**Blocks:**
- Phase 1.5.d (specs/tasks need this layout)
- Phase 1.5.e (row management needs this structure)

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-05
**Estimated Completion:** 4-5 days
