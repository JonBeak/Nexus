# Phase 1.g: Frontend - Orders Table

## Overview

This sub-phase implements a comprehensive table view of all orders with sorting, filtering, search, and batch operations.

**Duration Estimate:** 2-3 days
**Dependencies:** Phase 1.f (Progress Tracking UI must be complete)
**Validates:** Table displays all orders, sorting/filtering works, batch operations functional
**Backend Status:** ✅ COMPLETE (2025-11-04) - API endpoint ready with progress aggregation

---

## Backend Preparation (COMPLETED 2025-11-04)

### API Endpoint Ready
- **Endpoint:** `GET /api/orders`
- **Status:** ✅ Working
- **Features:**
  - Progress aggregation (total_tasks, completed_tasks)
  - Filtering by status, customer_id, search term
  - Pagination with limit/offset
  - Joins with customers table for company_name

### Architecture Note: MySQL Prepared Statement Limitation

**Issue Discovered:** MySQL prepared statements with `LIMIT ?` placeholders fail when the query contains correlated subqueries in the SELECT clause.

**Error:** `ER_WRONG_ARGUMENTS: Incorrect arguments to mysqld_stmt_execute`

**Our Use Case:**
```sql
SELECT o.*,
  (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id) as total_tasks,
  (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id AND completed = 1) as completed_tasks
FROM orders o
LIMIT ?  -- This fails with correlated subqueries above
```

**Solution Implemented:**
```typescript
// Use validated literal values instead of placeholders
const limit = parseInt(String(filters.limit));
if (isNaN(limit) || limit < 0) {
  throw new Error('Invalid limit value');
}
sql += ` LIMIT ${limit}`;
```

**Security:** Integer parsing and validation prevents SQL injection.

**Location:** `/backend/web/src/repositories/orderRepository.ts` (lines 103-119)

**Reference:** This is a documented MySQL limitation with prepared statements and correlated subqueries. The literal value approach with validation is the recommended solution.

---

## File Structure

```
/frontend/web/src/
├── components/orders/
│   ├── table/
│   │   ├── OrdersTable.tsx            # Main table component
│   │   ├── TableHeader.tsx            # Sortable column headers
│   │   ├── TableRow.tsx               # Individual table row
│   │   ├── TableFilters.tsx           # Advanced filter panel
│   │   ├── BatchActions.tsx           # Batch operation toolbar
│   │   └── Pagination.tsx             # Pagination controls
│   └── OrdersPage.tsx                 # Update to show table tab
```

---

## Orders Table Component

### /frontend/web/src/components/orders/table/OrdersTable.tsx

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderFilters, OrderStatus } from '../../../types/orders';
import { ordersApi } from '../../../services/ordersApi';
import TableHeader from './TableHeader';
import TableRow from './TableRow';
import TableFilters from './TableFilters';
import BatchActions from './BatchActions';
import Pagination from './Pagination';

type SortField = 'order_number' | 'order_name' | 'customer_name' | 'status' | 'due_date' | 'created_at' | 'progress_percent';
type SortDirection = 'asc' | 'desc';

export const OrdersTable: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

  // Filters
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    search: ''
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField>('order_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersApi.getOrders(filters);
      setOrders(data);
      setSelectedOrders(new Set());
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sort orders
  const sortedOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle dates
      if (sortField === 'due_date' || sortField === 'created_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return sorted;
  }, [orders, sortField, sortDirection]);

  // Paginate orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(paginatedOrders.map(o => o.order_id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: number, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const isAllSelected = paginatedOrders.length > 0 &&
    paginatedOrders.every(o => selectedOrders.has(o.order_id));

  // Handle batch status update
  const handleBatchStatusUpdate = async (status: OrderStatus) => {
    if (selectedOrders.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedOrders).map(orderId =>
          ordersApi.updateOrderStatus(orderId, status)
        )
      );
      await fetchOrders();
      setSelectedOrders(new Set());
    } catch (error) {
      console.error('Error updating orders:', error);
      alert('Failed to update some orders. Please try again.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <TableFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Toolbar */}
      {selectedOrders.size > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <BatchActions
            selectedCount={selectedOrders.size}
            onStatusUpdate={handleBatchStatusUpdate}
            onClear={() => setSelectedOrders(new Set())}
          />
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading orders...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <TableHeader
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isAllSelected={isAllSelected}
                    onSelectAll={handleSelectAll}
                  />
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedOrders.map((order) => (
                      <TableRow
                        key={order.order_id}
                        order={order}
                        isSelected={selectedOrders.has(order.order_id)}
                        onSelect={handleSelectOrder}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedOrders.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default OrdersTable;
```

---

## Table Header

### /frontend/web/src/components/orders/table/TableHeader.tsx

```typescript
import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface Props {
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: any) => void;
  isAllSelected: boolean;
  onSelectAll: (checked: boolean) => void;
}

export const TableHeader: React.FC<Props> = ({
  sortField,
  sortDirection,
  onSort,
  isAllSelected,
  onSelectAll
}) => {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <Minus className="w-4 h-4 text-gray-300" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="w-4 h-4 text-indigo-600" /> :
      <ArrowDown className="w-4 h-4 text-indigo-600" />;
  };

  const HeaderCell = ({ field, label, sortable = true }: { field: string; label: string; sortable?: boolean }) => (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      {sortable ? (
        <button
          onClick={() => onSort(field)}
          className="flex items-center space-x-1 hover:text-gray-700"
        >
          <span>{label}</span>
          <SortIcon field={field} />
        </button>
      ) : (
        <span>{label}</span>
      )}
    </th>
  );

  return (
    <thead className="bg-gray-50">
      <tr>
        <th scope="col" className="px-6 py-3 w-12">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
        </th>
        <HeaderCell field="order_number" label="Order #" />
        <HeaderCell field="order_name" label="Order Name" />
        <HeaderCell field="customer_name" label="Customer" />
        <HeaderCell field="status" label="Status" />
        <HeaderCell field="due_date" label="Due Date" />
        <HeaderCell field="progress_percent" label="Progress" />
        <HeaderCell field="created_at" label="Created" />
        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
  );
};

export default TableHeader;
```

---

## Table Row

### /frontend/web/src/components/orders/table/TableRow.tsx

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Order } from '../../../types/orders';
import StatusBadge from '../common/StatusBadge';

interface Props {
  order: Order;
  isSelected: boolean;
  onSelect: (orderId: number, checked: boolean) => void;
}

export const TableRow: React.FC<Props> = ({ order, isSelected, onSelect }) => {
  const navigate = useNavigate();

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking checkbox
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    navigate(`/orders/${order.order_id}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const progressPercent = order.progress_percent || 0;

  return (
    <tr
      onClick={handleRowClick}
      className="hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(order.order_id, e.target.checked);
          }}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {order.order_number}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {order.order_name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {order.customer_name || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {formatDate(order.due_date)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">{progressPercent}%</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {formatDate(order.created_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orders/${order.order_id}`);
          }}
          className="text-indigo-600 hover:text-indigo-900"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

export default TableRow;
```

---

## Table Filters

### /frontend/web/src/components/orders/table/TableFilters.tsx

```typescript
import React from 'react';
import { OrderFilters, OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';
import { Search } from 'lucide-react';

interface Props {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
}

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
    value: value as OrderStatus,
    label
  }))
];

export const TableFilters: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const handleStatusChange = (status: OrderStatus | 'all') => {
    onFiltersChange({ ...filters, status });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Status Filter */}
      <div className="flex items-center space-x-2">
        <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
          Status:
        </label>
        <select
          id="status-filter"
          value={filters.status || 'all'}
          onChange={(e) => handleStatusChange(e.target.value as OrderStatus | 'all')}
          className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search orders, customers..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default TableFilters;
```

---

## Batch Actions

### /frontend/web/src/components/orders/table/BatchActions.tsx

```typescript
import React, { useState } from 'react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';

interface Props {
  selectedCount: number;
  onStatusUpdate: (status: OrderStatus) => void;
  onClear: () => void;
}

export const BatchActions: React.FC<Props> = ({
  selectedCount,
  onStatusUpdate,
  onClear
}) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const handleStatusUpdate = (status: OrderStatus) => {
    if (confirm(`Update ${selectedCount} orders to status: ${ORDER_STATUS_LABELS[status]}?`)) {
      onStatusUpdate(status);
      setShowStatusMenu(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium text-gray-700">
        {selectedCount} selected
      </span>

      <div className="relative">
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          Update Status
        </button>

        {showStatusMenu && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-10">
            <div className="py-1 max-h-96 overflow-y-auto">
              {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status as OrderStatus)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onClear}
        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
      >
        Clear Selection
      </button>
    </div>
  );
};

export default BatchActions;
```

---

## Pagination

### /frontend/web/src/components/orders/table/Pagination.tsx

```typescript
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<Props> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
```

---

## Update Orders Page

### /frontend/web/src/components/orders/OrdersPage.tsx

Update to include table tab:

```typescript
// ... existing imports ...
import OrdersTable from './table/OrdersTable';

// ... in the content section:
      {activeTab === 'dashboard' && <OrderDashboard />}
      {activeTab === 'progress' && <ProgressView orderId={selectedOrderId} />}  // Needs selected order
      {activeTab === 'table' && <OrdersTable />}  // ADD THIS
```

---

## Testing Checklist

### Visual Testing

- [ ] **Table Displays**
  - Navigate to table tab
  - Verify all columns visible
  - Verify rows display correctly
  - Verify responsive on different screens

- [ ] **Sorting**
  - Click each column header
  - Verify sort direction changes (asc/desc)
  - Verify arrow indicator updates
  - Verify data sorts correctly

- [ ] **Selection**
  - Check "select all" checkbox
  - Verify all rows selected
  - Uncheck individual rows
  - Verify selection count updates

- [ ] **Batch Actions**
  - Select multiple orders
  - Click "Update Status"
  - Select new status
  - Verify confirmation dialog
  - Verify orders updated

- [ ] **Pagination**
  - With 100+ orders, verify pages work
  - Click next/previous
  - Verify page numbers update
  - Verify items count correct

### Interaction Testing

- [ ] Click table row → navigates to order details
- [ ] Checkbox click doesn't navigate
- [ ] Sort maintains selection
- [ ] Filter resets to page 1
- [ ] Clear selection button works

### Performance

- [ ] Table loads < 300ms with 100 orders
- [ ] Sorting instant (< 50ms)
- [ ] Selection updates smooth

---

## Next Steps

After completing Phase 1.g:

1. ✅ Table view functional
2. ✅ Sorting, filtering, pagination working
3. ✅ Batch operations working
4. → Proceed to **Phase 1.h: Integration & Testing**

---

**Sub-Phase Status:** Ready for Implementation
**Estimated Time:** 2-3 days
**Blockers:** None
**Dependencies:** Phase 1.f must be complete
