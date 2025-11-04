# Phase 1.e: Frontend - Order Dashboard

## Overview

This sub-phase implements the main Orders page frontend with dashboard view, order list, filters, search, and navigation structure.

**Duration Estimate:** 3-4 days
**Dependencies:** Phase 1.d (Progress Tracking Backend must be complete)
**Validates:** Orders display correctly, filters work, navigation functional

---

## File Structure

```
/frontend/web/src/
├── components/orders/
│   ├── OrdersPage.tsx                 # Main container with tabs
│   ├── dashboard/
│   │   ├── OrderDashboard.tsx         # Dashboard view
│   │   ├── OrderCard.tsx              # Individual order card
│   │   ├── OrderList.tsx              # List container
│   │   ├── StatusFilter.tsx           # Status filter dropdown
│   │   ├── SearchBar.tsx              # Search input
│   │   └── OrderStats.tsx             # Quick stats summary
│   └── common/
│       ├── StatusBadge.tsx            # Status badge component
│       └── OrderStatusDropdown.tsx    # Status update dropdown
├── services/
│   └── ordersApi.ts                   # API client for orders
└── types/
    └── orders.ts                      # Frontend TypeScript types
```

---

## TypeScript Types

### /frontend/web/src/types/orders.ts

```typescript
/**
 * Frontend order types
 */

export interface Order {
  order_id: number;
  order_number: number;
  version_number: number;
  order_name: string;
  estimate_id?: number;
  customer_id: number;
  customer_name?: string;  // From join
  customer_po?: string;
  point_person_email?: string;
  order_date: string;
  due_date?: string;
  production_notes?: string;
  sign_image_path?: string;
  form_version: number;
  shipping_required: boolean;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  created_by: number;

  // Progress info (from aggregate queries)
  total_tasks?: number;
  completed_tasks?: number;
  progress_percent?: number;
}

export type OrderStatus =
  | 'initiated'
  | 'pending_confirmation'
  | 'pending_production_files_creation'
  | 'pending_production_files_approval'
  | 'production_queue'
  | 'in_production'
  | 'on_hold'
  | 'overdue'
  | 'qc_packing'
  | 'shipping'
  | 'pick_up'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled';

export interface OrderFilters {
  status?: OrderStatus | 'all';
  customer_id?: number;
  search?: string;
}

export interface OrderListResponse {
  success: boolean;
  data: Order[];
  total?: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  initiated: 'Initiated',
  pending_confirmation: 'Pending Confirmation',
  pending_production_files_creation: 'Pending Files Creation',
  pending_production_files_approval: 'Pending Files Approval',
  production_queue: 'Production Queue',
  in_production: 'In Production',
  on_hold: 'On Hold',
  overdue: 'Overdue',
  qc_packing: 'QC & Packing',
  shipping: 'Shipping',
  pick_up: 'Ready for Pickup',
  awaiting_payment: 'Awaiting Payment',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  initiated: 'bg-gray-100 text-gray-800',
  pending_confirmation: 'bg-yellow-100 text-yellow-800',
  pending_production_files_creation: 'bg-orange-100 text-orange-800',
  pending_production_files_approval: 'bg-orange-100 text-orange-800',
  production_queue: 'bg-blue-100 text-blue-800',
  in_production: 'bg-indigo-100 text-indigo-800',
  on_hold: 'bg-red-100 text-red-800',
  overdue: 'bg-red-600 text-white',
  qc_packing: 'bg-purple-100 text-purple-800',
  shipping: 'bg-cyan-100 text-cyan-800',
  pick_up: 'bg-teal-100 text-teal-800',
  awaiting_payment: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-300 text-gray-600'
};
```

---

## API Service

### /frontend/web/src/services/ordersApi.ts

```typescript
import { apiClient } from './api';
import { Order, OrderFilters, OrderListResponse } from '../types/orders';

class OrdersApiService {
  /**
   * Get all orders with optional filters
   */
  async getOrders(filters?: OrderFilters): Promise<Order[]> {
    const params: any = {};

    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.customer_id) {
      params.customer_id = filters.customer_id;
    }
    if (filters?.search) {
      params.search = filters.search;
    }

    const response = await apiClient.get<OrderListResponse>('/orders', { params });
    return response.data.data;
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: number): Promise<Order> {
    const response = await apiClient.get<{ success: boolean; data: Order }>(`/orders/${orderId}`);
    return response.data.data;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string, notes?: string): Promise<void> {
    await apiClient.put(`/orders/${orderId}/status`, { status, notes });
  }

  /**
   * Convert estimate to order
   */
  async convertEstimateToOrder(data: {
    estimateId: number;
    orderName: string;
    customerPo?: string;
    dueDate?: string;
    pointPersonEmail?: string;
    productionNotes?: string;
  }): Promise<{ order_id: number; order_number: number }> {
    const response = await apiClient.post<{
      success: boolean;
      data: { order_id: number; order_number: number };
    }>('/orders/convert-estimate', data);
    return response.data.data;
  }

  /**
   * Delete order
   */
  async deleteOrder(orderId: number): Promise<void> {
    await apiClient.delete(`/orders/${orderId}`);
  }
}

export const ordersApi = new OrdersApiService();
```

---

## Main Orders Page

### /frontend/web/src/components/orders/OrdersPage.tsx

```typescript
import React, { useState } from 'react';
import { LayoutDashboard, ListChecks, Table } from 'lucide-react';
import OrderDashboard from './dashboard/OrderDashboard';

type TabId = 'dashboard' | 'progress' | 'table';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'progress', label: 'Progress', icon: <ListChecks className="w-5 h-5" /> },
  { id: 'table', label: 'Jobs Table', icon: <Table className="w-5 h-5" /> }
];

export const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-600 mt-1">Manage production orders and track progress</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <OrderDashboard />}
        {activeTab === 'progress' && (
          <div className="p-6">
            <p className="text-gray-500">Progress view (Phase 1.f)</p>
          </div>
        )}
        {activeTab === 'table' && (
          <div className="p-6">
            <p className="text-gray-500">Jobs table view (Phase 1.g)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
```

---

## Order Dashboard

### /frontend/web/src/components/orders/dashboard/OrderDashboard.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { Order, OrderFilters, OrderStatus } from '../../../types/orders';
import { ordersApi } from '../../../services/ordersApi';
import OrderList from './OrderList';
import StatusFilter from './StatusFilter';
import SearchBar from './SearchBar';
import OrderStats from './OrderStats';

export const OrderDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    search: ''
  });

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: OrderStatus | 'all') => {
    setFilters(prev => ({ ...prev, status }));
  };

  const handleSearchChange = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
  };

  const handleOrderUpdated = () => {
    fetchOrders();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Filters & Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between space-x-4">
          <StatusFilter
            selectedStatus={filters.status || 'all'}
            onStatusChange={handleStatusChange}
          />
          <SearchBar
            value={filters.search || ''}
            onChange={handleSearchChange}
            placeholder="Search by order number, name, or customer..."
          />
        </div>
      </div>

      {/* Stats */}
      <OrderStats orders={orders} />

      {/* Order List */}
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
            {filters.status !== 'all' || filters.search ? (
              <button
                onClick={() => setFilters({ status: 'all', search: '' })}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <OrderList orders={orders} onOrderUpdated={handleOrderUpdated} />
        )}
      </div>
    </div>
  );
};

export default OrderDashboard;
```

---

## Order List

### /frontend/web/src/components/orders/dashboard/OrderList.tsx

```typescript
import React from 'react';
import { Order } from '../../../types/orders';
import OrderCard from './OrderCard';

interface Props {
  orders: Order[];
  onOrderUpdated: () => void;
}

export const OrderList: React.FC<Props> = ({ orders, onOrderUpdated }) => {
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard
          key={order.order_id}
          order={order}
          onUpdated={onOrderUpdated}
        />
      ))}
    </div>
  );
};

export default OrderList;
```

---

## Order Card

### /frontend/web/src/components/orders/dashboard/OrderCard.tsx

```typescript
import React from 'react';
import { Order } from '../../../types/orders';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Package, ChevronRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

interface Props {
  order: Order;
  onUpdated: () => void;
}

export const OrderCard: React.FC<Props> = ({ order, onUpdated }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/orders/${order.order_id}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const progressPercent = order.progress_percent || 0;

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-5 border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Order #{order.order_number}
            </h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-gray-600 mt-1">{order.order_name}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <User className="w-4 h-4 mr-2 text-gray-400" />
          <span className="truncate">{order.customer_name || 'Unknown'}</span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
          <span>Due: {formatDate(order.due_date)}</span>
        </div>

        {order.customer_po && (
          <div className="flex items-center text-sm text-gray-600">
            <Package className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">PO: {order.customer_po}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {order.total_tasks !== undefined && (
          <div className="text-xs text-gray-500 mt-1">
            {order.completed_tasks || 0} of {order.total_tasks} tasks complete
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
```

---

## Status Filter

### /frontend/web/src/components/orders/dashboard/StatusFilter.tsx

```typescript
import React from 'react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';

interface Props {
  selectedStatus: OrderStatus | 'all';
  onStatusChange: (status: OrderStatus | 'all') => void;
}

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Orders' },
  { value: 'initiated', label: ORDER_STATUS_LABELS.initiated },
  { value: 'pending_confirmation', label: ORDER_STATUS_LABELS.pending_confirmation },
  { value: 'pending_production_files_creation', label: ORDER_STATUS_LABELS.pending_production_files_creation },
  { value: 'pending_production_files_approval', label: ORDER_STATUS_LABELS.pending_production_files_approval },
  { value: 'production_queue', label: ORDER_STATUS_LABELS.production_queue },
  { value: 'in_production', label: ORDER_STATUS_LABELS.in_production },
  { value: 'on_hold', label: ORDER_STATUS_LABELS.on_hold },
  { value: 'overdue', label: ORDER_STATUS_LABELS.overdue },
  { value: 'qc_packing', label: ORDER_STATUS_LABELS.qc_packing },
  { value: 'shipping', label: ORDER_STATUS_LABELS.shipping },
  { value: 'pick_up', label: ORDER_STATUS_LABELS.pick_up },
  { value: 'awaiting_payment', label: ORDER_STATUS_LABELS.awaiting_payment },
  { value: 'completed', label: ORDER_STATUS_LABELS.completed },
  { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled }
];

export const StatusFilter: React.FC<Props> = ({ selectedStatus, onStatusChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
        Status:
      </label>
      <select
        id="status-filter"
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value as OrderStatus | 'all')}
        className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StatusFilter;
```

---

## Search Bar

### /frontend/web/src/components/orders/dashboard/SearchBar.tsx

```typescript
import React from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Search...'
}) => {
  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="relative flex-1 max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
        >
          <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
```

---

## Order Stats

### /frontend/web/src/components/orders/dashboard/OrderStats.tsx

```typescript
import React, { useMemo } from 'react';
import { Order } from '../../../types/orders';
import { Clock, AlertCircle, CheckCircle, Package } from 'lucide-react';

interface Props {
  orders: Order[];
}

export const OrderStats: React.FC<Props> = ({ orders }) => {
  const stats = useMemo(() => {
    const total = orders.length;
    const inProduction = orders.filter(o =>
      o.status === 'in_production' || o.status === 'production_queue'
    ).length;
    const overdue = orders.filter(o => o.status === 'overdue').length;
    const completed = orders.filter(o => o.status === 'completed').length;

    return { total, inProduction, overdue, completed };
  }, [orders]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          icon={<Package className="w-6 h-6 text-indigo-600" />}
          label="Total Orders"
          value={stats.total}
          color="indigo"
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-blue-600" />}
          label="In Production"
          value={stats.inProduction}
          color="blue"
        />
        <StatCard
          icon={<AlertCircle className="w-6 h-6 text-red-600" />}
          label="Overdue"
          value={stats.overdue}
          color="red"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          label="Completed"
          value={stats.completed}
          color="green"
        />
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'indigo' | 'blue' | 'red' | 'green';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    indigo: 'bg-indigo-50',
    blue: 'bg-blue-50',
    red: 'bg-red-50',
    green: 'bg-green-50'
  };

  return (
    <div className="flex items-center space-x-3">
      <div className={`${colorClasses[color]} rounded-lg p-3`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default OrderStats;
```

---

## Status Badge Component

### /frontend/web/src/components/orders/common/StatusBadge.tsx

```typescript
import React from 'react';
import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';

interface Props {
  status: OrderStatus;
  className?: string;
}

export const StatusBadge: React.FC<Props> = ({ status, className = '' }) => {
  const label = ORDER_STATUS_LABELS[status];
  const colorClass = ORDER_STATUS_COLORS[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
```

---

## Register Route in App

### /frontend/web/src/App.tsx

Add orders route:

```typescript
import OrdersPage from './components/orders/OrdersPage';

// In your routes:
<Route path="/orders" element={<OrdersPage />} />
<Route path="/orders/:orderNumber" element={<OrderDetailsPage />} /> {/* Phase 1.f */}
```

---

## Testing Checklist

### Visual Testing

- [ ] **Orders Page Loads**
  - Navigate to `/orders`
  - Verify page renders without errors
  - Verify tabs display correctly

- [ ] **Order Cards Display**
  - Verify all orders shown
  - Verify order number, name, customer visible
  - Verify status badge colored correctly
  - Verify progress bar shows correct percentage

- [ ] **Status Filter**
  - Select different statuses
  - Verify orders filter correctly
  - Verify "All Orders" shows everything

- [ ] **Search**
  - Search by order number
  - Search by order name
  - Search by customer name
  - Verify results update in real-time

- [ ] **Stats Summary**
  - Verify counts accurate
  - Verify updates when filters change

- [ ] **Responsive Design**
  - Test on different screen sizes
  - Verify layout adapts

### Interaction Testing

- [ ] Click order card → navigates to details (placeholder for now)
- [ ] Clear search button works
- [ ] Loading state displays while fetching
- [ ] Error state displays on failure
- [ ] Empty state displays when no orders

### Performance

- [ ] Dashboard loads < 500ms with 50 orders
- [ ] Search/filter updates < 100ms
- [ ] No unnecessary re-renders

---

## Next Steps

After completing Phase 1.e:

1. ✅ Dashboard displaying orders correctly
2. ✅ Filters and search functional
3. ✅ Navigation structure in place
4. → Proceed to **Phase 1.f: Frontend - Progress Tracking UI**

---

**Sub-Phase Status:** Ready for Implementation
**Estimated Time:** 3-4 days
**Blockers:** None
**Dependencies:** Phase 1.d must be complete
