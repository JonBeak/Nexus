/**
 * TasksTable Component
 * Main component for the Tasks Table tab - displays one row per order part
 * with task completion columns
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PartWithTasks, TasksTableFilters, TasksTableSortField, SortDirection } from './types';
import { getTaskRoleSync, ProductionRole } from './roleColors';
import { TaskMetadataResource } from '../../../services/taskMetadataResource';
import TaskHeader from './TaskHeader';
import PartRow from './PartRow';
import StatusSelectModal from './StatusSelectModal';
import Pagination from '../table/Pagination';
import { orderTasksApi, orderStatusApi, api } from '../../../services/api';
import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { ChevronDown } from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

export const TasksTable: React.FC = () => {
  // Data state
  const [parts, setParts] = useState<PartWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status modal state
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    orderNumber: number;
    orderName: string;
    currentStatus: OrderStatus;
  } | null>(null);

  // Default statuses to show (matches backend defaults)
  const DEFAULT_STATUSES: OrderStatus[] = [
    'production_queue',
    'in_production',
    'overdue',
    'qc_packing'
  ];

  // Filters state
  const [filters, setFilters] = useState<TasksTableFilters>({
    statuses: [],  // Empty means use defaults
    hideCompleted: false,
    hideEmptyTasks: false,
    search: ''
  });

  // Status filter dropdown state
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const statusButtonRef = useRef<HTMLButtonElement>(null);

  // Drag-to-scroll state for task columns
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);

  // Sorting state - default: due date asc, then order number, then display number
  const [sortField, setSortField] = useState<TasksTableSortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Task metadata state (fetched from API - single source of truth)
  const [taskMetadata, setTaskMetadata] = useState<{
    taskOrder: string[];
    taskRoleMap: Record<string, ProductionRole>;
    autoHideColumns: Set<string>;
  } | null>(null);

  // Fetch task metadata on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const metadata = await TaskMetadataResource.getTaskMetadata();
        setTaskMetadata({
          taskOrder: metadata.taskOrder,
          taskRoleMap: metadata.taskRoleMap,
          autoHideColumns: new Set(metadata.autoHideColumns)
        });
      } catch (error) {
        console.error('[TasksTable] Failed to fetch task metadata:', error);
        // Set empty defaults - table will still work but columns won't be ordered
        setTaskMetadata({
          taskOrder: [],
          taskRoleMap: {},
          autoHideColumns: new Set()
        });
      }
    };
    fetchMetadata();
  }, []);

  // Fetch parts with tasks
  const fetchPartsWithTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      // Status filtering is done client-side now
      if (filters.hideCompleted) {
        params.hideCompleted = 'true';
      }
      if (filters.search) {
        params.search = filters.search;
      }

      const response = await api.get('/orders/parts/with-tasks', { params });
      // Interceptor unwraps response, but just in case check for data structure
      const data = response.data?.data || response.data || [];

      // DEBUG: Log what we received from backend
      const statusCounts: Record<string, number> = {};
      data.forEach((p: any) => statusCounts[p.orderStatus] = (statusCounts[p.orderStatus] || 0) + 1);
      console.log('[TasksTable] Fetched parts:', data.length, 'By status:', statusCounts);

      setParts(data);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch parts');
      console.error('Error fetching parts with tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.hideCompleted, filters.search]);  // Only refetch when backend params change, not status (client-side filter)

  useEffect(() => {
    fetchPartsWithTasks();
  }, [fetchPartsWithTasks]);

  // Apply client-side filters (status + search)
  const filteredParts = useMemo(() => {
    let result = parts;

    // Filter by status (use selected statuses or defaults)
    const activeStatuses = filters.statuses.length > 0 ? filters.statuses : DEFAULT_STATUSES;
    result = result.filter(part => activeStatuses.includes(part.orderStatus));

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(part =>
        part.orderNumber.toString().includes(searchLower) ||
        part.orderName.toLowerCase().includes(searchLower) ||
        (part.customerName?.toLowerCase().includes(searchLower)) ||
        part.productType.toLowerCase().includes(searchLower) ||
        (part.specsDisplayName?.toLowerCase().includes(searchLower)) ||
        (part.scope?.toLowerCase().includes(searchLower))
      );
    }

    // Always exclude parts without a product type (they can't have tasks)
    result = result.filter(part => part.specsDisplayName?.trim());

    // Filter out parts with no tasks
    if (filters.hideEmptyTasks) {
      result = result.filter(part => part.tasks.length > 0);
    }

    return result;
  }, [parts, filters.statuses, filters.search, filters.hideEmptyTasks]);

  // Sort parts
  const sortedParts = useMemo(() => {
    const sorted = [...filteredParts].sort((a, b) => {
      // Primary sort by selected field
      let comparison = 0;

      if (sortField === 'dueDate') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = dateA - dateB;
      } else if (sortField === 'orderNumber') {
        comparison = a.orderNumber - b.orderNumber;
      } else if (sortField === 'displayNumber') {
        comparison = a.displayNumber.localeCompare(b.displayNumber, undefined, { numeric: true });
      }

      // Apply sort direction
      if (sortDirection === 'desc') {
        comparison = -comparison;
      }

      // Secondary sort: order number (if not primary)
      if (comparison === 0 && sortField !== 'orderNumber') {
        comparison = a.orderNumber - b.orderNumber;
      }

      // Tertiary sort: display number (if not primary)
      if (comparison === 0 && sortField !== 'displayNumber') {
        comparison = a.displayNumber.localeCompare(b.displayNumber, undefined, { numeric: true });
      }

      return comparison;
    });

    return sorted;
  }, [filteredParts, sortField, sortDirection]);

  // Paginate parts
  const paginatedParts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedParts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedParts, currentPage, itemsPerPage]);

  // Helper to extract base task name from composite key (taskName|notes -> taskName)
  const getBaseName = (taskKey: string) => (taskKey || '').split('|')[0];

  // Calculate visible task columns based on current page data
  // Always show columns from TASK_ORDER, only hide AUTO_HIDE_COLUMNS when no tasks exist
  const taskColumns = useMemo(() => {
    // Step 1: Find task types that have duplicates within a single part
    const taskTypesNeedingSplit = new Set<string>();
    for (const part of paginatedParts) {
      const taskTypeCounts = new Map<string, number>();
      for (const task of part.tasks) {
        taskTypeCounts.set(task.taskName, (taskTypeCounts.get(task.taskName) || 0) + 1);
      }
      for (const [taskType, count] of taskTypeCounts) {
        if (count > 1) taskTypesNeedingSplit.add(taskType);
      }
    }

    // Step 2: Build set of columns that exist in current data
    const existingColumnKeys = new Set<string>();
    for (const part of paginatedParts) {
      for (const task of part.tasks) {
        const baseName = task.taskName;
        if (taskTypesNeedingSplit.has(baseName)) {
          const key = task.taskKey || task.taskName;
          if (key) existingColumnKeys.add(key);
        } else {
          if (baseName) existingColumnKeys.add(baseName);
        }
      }
    }

    // Step 3: Start with ALL columns from taskOrder (fetched from API), plus any composite keys from data
    const taskOrder = taskMetadata?.taskOrder ?? [];
    const autoHideColumns = taskMetadata?.autoHideColumns ?? new Set<string>();
    const allColumns = new Set<string>(taskOrder);
    for (const key of existingColumnKeys) {
      allColumns.add(key); // Add composite keys like "taskName|notes"
    }

    // Step 4: Filter and sort - only show columns that should be visible
    return Array.from(allColumns)
      .filter(taskKey => {
        const baseName = getBaseName(taskKey);

        // If this task type needs splitting, only show if it exists in data
        // This hides the "no scope" base column when all tasks have scopes
        if (taskTypesNeedingSplit.has(baseName)) {
          return existingColumnKeys.has(taskKey);
        }

        // For non-split types, apply AUTO_HIDE logic as before
        if (!autoHideColumns.has(baseName)) {
          return true;
        }
        return existingColumnKeys.has(taskKey);
      })
      .sort((a, b) => {
        const nameA = getBaseName(a);
        const nameB = getBaseName(b);
        const orderA = taskOrder.indexOf(nameA);
        const orderB = taskOrder.indexOf(nameB);
        const posA = orderA >= 0 ? orderA : 999;
        const posB = orderB >= 0 ? orderB : 999;
        if (posA !== posB) return posA - posB;
        return a.localeCompare(b);
      });
  }, [paginatedParts, taskMetadata]);

  // Memoize which task types need splitting (for PartRow to use correct keys)
  const taskTypesNeedingSplit = useMemo(() => {
    const needsSplit = new Set<string>();
    for (const part of paginatedParts) {
      const taskTypeCounts = new Map<string, number>();
      for (const task of part.tasks) {
        taskTypeCounts.set(task.taskName, (taskTypeCounts.get(task.taskName) || 0) + 1);
      }
      for (const [taskType, count] of taskTypeCounts) {
        if (count > 1) needsSplit.add(taskType);
      }
    }
    return needsSplit;
  }, [paginatedParts]);

  const totalPages = Math.ceil(sortedParts.length / itemsPerPage);

  // Handle task toggle
  const handleTaskToggle = async (taskId: number, completed: boolean) => {
    try {
      // Optimistic update for task completion
      setParts(prevParts =>
        prevParts.map(part => ({
          ...part,
          tasks: part.tasks.map(task =>
            task.taskId === taskId
              ? { ...task, completed }
              : task
          )
        }))
      );

      // Call API using existing batch update endpoint
      await orderTasksApi.batchUpdateTasks([{ task_id: taskId, completed }]);

      // Refetch to get updated statuses
      const params: Record<string, string> = {};
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.hideCompleted) params.hideCompleted = 'true';
      if (filters.search) params.search = filters.search;

      const response = await api.get('/orders/parts/with-tasks', { params });
      const data = response.data?.data || response.data || [];
      setParts(data);
    } catch (err) {
      console.error('Error updating task:', err);
      // Revert on error
      fetchPartsWithTasks();
    }
  };

  // Handle sorting
  const handleSort = (field: TasksTableSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle filter changes
  const handleHideCompletedChange = (hide: boolean) => {
    setFilters(prev => ({ ...prev, hideCompleted: hide }));
    setCurrentPage(1);
  };

  // All available statuses for filtering (excluding completed/cancelled by default)
  const AVAILABLE_STATUSES: OrderStatus[] = [
    'production_queue',
    'in_production',
    'overdue',
    'qc_packing',
    'job_details_setup',
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'on_hold',
    'shipping',
    'pick_up',
    'awaiting_payment'
  ];

  // Toggle a status in the filter
  const handleStatusToggle = (status: OrderStatus) => {
    setFilters(prev => {
      const currentStatuses = prev.statuses.length > 0 ? prev.statuses : [...DEFAULT_STATUSES];
      const newStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter(s => s !== status)
        : [...currentStatuses, status];
      return { ...prev, statuses: newStatuses };
    });
  };

  // Get display statuses (use defaults if empty)
  const displayStatuses = filters.statuses.length > 0 ? filters.statuses : DEFAULT_STATUSES;

  // Handle status click - open modal
  const handleStatusClick = (orderNumber: number, orderName: string, currentStatus: OrderStatus) => {
    setStatusModal({
      isOpen: true,
      orderNumber,
      orderName,
      currentStatus
    });
  };

  // Handle status change from modal
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!statusModal) return;

    try {
      // Optimistic update
      setParts(prevParts =>
        prevParts.map(part =>
          part.orderNumber === statusModal.orderNumber
            ? { ...part, orderStatus: newStatus }
            : part
        )
      );

      // Close modal
      setStatusModal(null);

      // Call API
      await orderStatusApi.updateOrderStatus(statusModal.orderNumber, newStatus);

      // Refetch to ensure consistency
      fetchPartsWithTasks();
    } catch (err) {
      console.error('Error updating status:', err);
      // Revert on error
      fetchPartsWithTasks();
    }
  };

  const handleSearchChange = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
  };

  // Drag-to-scroll handlers for task columns (only on N/A cells with "-")
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on N/A task cells (gray cells with "-")
    const target = e.target as HTMLElement;
    const cell = target.closest('td[data-task-cell]');
    if (!cell) return;

    // Check if it's an N/A cell (has bg-gray-200 class)
    if (!cell.classList.contains('bg-gray-200')) return;

    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    setScrollStartX(scrollContainerRef.current?.scrollLeft || 0);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;

    const deltaX = dragStartX - e.clientX;
    scrollContainerRef.current.scrollLeft = scrollStartX + deltaX;
  }, [isDragging, dragStartX, scrollStartX]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Filters Bar */}
      <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={`pl-3 pr-10 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-64`}
              />
            </div>

            {/* Status Multi-Select Filter */}
            <div>
              <button
                ref={statusButtonRef}
                onClick={() => {
                  if (!statusDropdownOpen && statusButtonRef.current) {
                    const rect = statusButtonRef.current.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + 4,
                      left: rect.left
                    });
                  }
                  setStatusDropdownOpen(!statusDropdownOpen);
                }}
                className={`flex items-center space-x-2 px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm ${PAGE_STYLES.panel.background} ${PAGE_STYLES.interactive.hover} focus:outline-none focus:ring-2 focus:ring-orange-500`}
              >
                <span className={PAGE_STYLES.header.text}>
                  Status ({displayStatuses.length})
                </span>
                <ChevronDown className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted} transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {statusDropdownOpen && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setStatusDropdownOpen(false)}
                  />
                  {/* Dropdown panel - fixed positioning to escape overflow */}
                  <div
                    className={`fixed w-64 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto`}
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                  >
                    <div className={`p-2 border-b ${PAGE_STYLES.panel.border}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase`}>Filter by Status</span>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, statuses: [] }))}
                          className={`text-xs ${MODULE_COLORS.orders.text} hover:text-orange-600`}
                        >
                          Reset to defaults
                        </button>
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      {AVAILABLE_STATUSES.map(status => (
                        <label
                          key={status}
                          className={`flex items-center space-x-2 px-2 py-1.5 rounded ${PAGE_STYLES.interactive.hover} cursor-pointer`}
                        >
                          <input
                            type="checkbox"
                            checked={displayStatuses.includes(status)}
                            onChange={() => handleStatusToggle(status)}
                            className={`h-4 w-4 text-orange-500 focus:ring-orange-500 ${PAGE_STYLES.panel.border} rounded`}
                          />
                          <span className={`text-xs px-2 py-0.5 rounded ${ORDER_STATUS_COLORS[status]}`}>
                            {ORDER_STATUS_LABELS[status]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Hide Completed Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hideCompleted}
                onChange={(e) => handleHideCompletedChange(e.target.checked)}
                className={`h-4 w-4 text-orange-500 focus:ring-orange-500 ${PAGE_STYLES.panel.border} rounded`}
              />
              <span className={`text-sm ${PAGE_STYLES.header.text}`}>Hide completed</span>
            </label>

            {/* Hide Empty Tasks Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hideEmptyTasks}
                onChange={(e) => { setFilters(prev => ({ ...prev, hideEmptyTasks: e.target.checked })); setCurrentPage(1); }}
                className={`h-4 w-4 text-orange-500 focus:ring-orange-500 ${PAGE_STYLES.panel.border} rounded`}
              />
              <span className={`text-sm ${PAGE_STYLES.header.text}`}>Hide empty tasks</span>
            </label>
          </div>

          <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedParts.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className={PAGE_STYLES.page.text}>Loading parts...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchPartsWithTasks}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : parts.length === 0 ? (
          <div className={`${PAGE_STYLES.composites.panelContainer} p-8 text-center`}>
            <p className={PAGE_STYLES.panel.textMuted}>No parts found</p>
          </div>
        ) : (
          <>
            <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
              <div
                ref={scrollContainerRef}
                className={`overflow-auto max-h-[calc(100vh-120px)] ${isDragging ? 'cursor-grabbing select-none' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                <table style={{ width: '100%', minWidth: `${544 + taskColumns.length * 72}px`, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
                  {/* Column widths: Left 4 columns FIXED (544px total) | Task columns expand equally (min 72px each) */}
                  <colgroup>
                    <col style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} />
                    <col style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }} />
                    <col style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }} />
                    <col style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }} />
                    {taskColumns.map((taskKey) => (
                      <col key={taskKey} style={{ minWidth: '72px' }} />
                    ))}
                  </colgroup>
                  {/* Header */}
                  <thead className={`${PAGE_STYLES.header.background} sticky top-0 z-30`}>
                    <tr>
                      {/* Order / Part column - sticky, fixed width */}
                      <th
                        className={`px-2 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider border-b border-r ${PAGE_STYLES.panel.border} cursor-pointer ${PAGE_STYLES.interactive.hoverOnHeader} sticky z-20`}
                        style={{ left: 0, width: '280px', backgroundColor: 'var(--theme-header-bg)' }}
                        onClick={() => handleSort('orderNumber')}
                      >
                        Order / Part
                        {sortField === 'orderNumber' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>

                      {/* Status column - sticky, fixed width */}
                      <th
                        className={`px-1 py-3 text-center text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider border-b border-r ${PAGE_STYLES.panel.border} sticky z-20`}
                        style={{ left: '280px', width: '120px', backgroundColor: 'var(--theme-header-bg)' }}
                      >
                        Status
                      </th>

                      {/* Due Date column - sticky, fixed width */}
                      <th
                        className={`px-1 py-3 text-center text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider border-b border-r ${PAGE_STYLES.panel.border} cursor-pointer ${PAGE_STYLES.interactive.hoverOnHeader} sticky z-20`}
                        style={{ left: '400px', width: '80px', backgroundColor: 'var(--theme-header-bg)' }}
                        onClick={() => handleSort('dueDate')}
                      >
                        Due
                        {sortField === 'dueDate' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>

                      {/* Hard Due Time column - sticky, fixed width */}
                      <th
                        className={`px-1 py-3 text-center text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider border-b border-r ${PAGE_STYLES.panel.border} sticky z-20`}
                        style={{ left: '480px', width: '64px', backgroundColor: 'var(--theme-header-bg)' }}
                      >
                        Time
                      </th>

                      {/* Task columns */}
                      {taskColumns.map((taskKey) => (
                        <TaskHeader
                          key={taskKey}
                          taskKey={taskKey}
                          role={getTaskRoleSync(taskKey, taskMetadata?.taskRoleMap ?? {})}
                        />
                      ))}
                    </tr>
                  </thead>

                  {/* Body */}
                  <tbody>
                    {paginatedParts.map((part) => (
                      <PartRow
                        key={part.partId}
                        part={part}
                        taskColumns={taskColumns}
                        taskTypesNeedingSplit={taskTypesNeedingSplit}
                        onTaskToggle={handleTaskToggle}
                        onStatusClick={handleStatusClick}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status Select Modal */}
      {statusModal && (
        <StatusSelectModal
          isOpen={statusModal.isOpen}
          currentStatus={statusModal.currentStatus}
          orderNumber={statusModal.orderNumber}
          orderName={statusModal.orderName}
          onSelect={handleStatusChange}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  );
};

export default TasksTable;
