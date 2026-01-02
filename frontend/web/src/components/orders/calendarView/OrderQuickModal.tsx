/**
 * OrderQuickModal Component
 * Quick action modal for order management from Calendar View
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ExternalLink,
  Calendar,
  FolderOpen,
  FileText,
  ChevronDown,
  Loader2,
  Plus
} from 'lucide-react';
import { CalendarOrder } from './types';
import { Order, OrderPart, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { ordersApi, orderStatusApi, orderTasksApi } from '../../../services/api';
import { TaskTemplateDropdown } from '../progress/TaskTemplateDropdown';
import { TaskMetadataResource } from '../../../services/taskMetadataResource';
import { TaskRow } from '../common/TaskRow';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface OrderQuickModalProps {
  isOpen: boolean;
  order: CalendarOrder;
  onClose: () => void;
  onOrderUpdated: () => void;
}

// Status groups for dropdown
const STATUS_GROUPS = [
  {
    label: 'Pre-Production',
    statuses: ['job_details_setup', 'pending_confirmation', 'pending_production_files_creation', 'pending_production_files_approval'] as OrderStatus[]
  },
  {
    label: 'Production',
    statuses: ['production_queue', 'in_production', 'overdue', 'qc_packing'] as OrderStatus[]
  },
  {
    label: 'Post-Production',
    statuses: ['shipping', 'pick_up', 'awaiting_payment'] as OrderStatus[]
  },
  {
    label: 'Final',
    statuses: ['completed', 'cancelled'] as OrderStatus[]
  },
  {
    label: 'Other',
    statuses: ['on_hold'] as OrderStatus[]
  }
];

export const OrderQuickModal: React.FC<OrderQuickModalProps> = ({
  isOpen,
  order,
  onClose,
  onOrderUpdated
}) => {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [parts, setParts] = useState<OrderPart[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const statusButtonRef = useRef<HTMLButtonElement>(null);

  // Add task dropdown state
  const [showAddTaskForPart, setShowAddTaskForPart] = useState<number | null>(null);

  // Task ordering from metadata
  const [taskOrder, setTaskOrder] = useState<string[]>([]);

  // Fetch order details when modal opens
  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [result, orderFromMetadata] = await Promise.all([
        ordersApi.getOrderWithParts(order.order_number),
        TaskMetadataResource.getTaskOrder()
      ]);
      setOrderDetails(result.order);
      setParts(result.parts || []);
      setNewDueDate(result.order.due_date?.split('T')[0] || '');
      setNoteText(result.order.internal_note || '');
      setTaskOrder(orderFromMetadata);
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      setLoading(false);
    }
  }, [order.order_number]);

  useEffect(() => {
    if (isOpen) {
      fetchOrderDetails();
    }
  }, [isOpen, fetchOrderDetails]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(true);
      setShowStatusDropdown(false);
      await orderStatusApi.updateOrderStatus(order.order_number, newStatus);
      await fetchOrderDetails();
      onOrderUpdated();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Helper to update order status locally from API response
  const handleStatusUpdates = (statusUpdates?: Record<number, string>) => {
    if (statusUpdates && orderDetails) {
      const newStatus = statusUpdates[orderDetails.order_id];
      if (newStatus) {
        setOrderDetails(prev => prev ? { ...prev, status: newStatus as OrderStatus } : prev);
      }
    }
  };

  // Helper to sort tasks by task order
  const sortTasks = (tasks: any[]) => {
    if (!tasks || taskOrder.length === 0) return tasks;
    return [...tasks].sort((a, b) => {
      const indexA = taskOrder.indexOf(a.task_name);
      const indexB = taskOrder.indexOf(b.task_name);
      // Tasks not in taskOrder go to end
      const orderA = indexA >= 0 ? indexA : 999;
      const orderB = indexB >= 0 ? indexB : 999;
      return orderA - orderB;
    });
  };

  // Handle task start
  const handleTaskStart = async (taskId: number) => {
    try {
      const result = await orderTasksApi.batchUpdateTasks([{ task_id: taskId, started: true }]);
      handleStatusUpdates(result.statusUpdates);
      onOrderUpdated();
    } catch (err) {
      console.error('Error starting task:', err);
      await fetchOrderDetails(); // Refetch to restore correct state
    }
  };

  // Handle task complete
  const handleTaskComplete = async (taskId: number) => {
    try {
      const result = await orderTasksApi.batchUpdateTasks([{ task_id: taskId, completed: true }]);
      handleStatusUpdates(result.statusUpdates);
      onOrderUpdated();
    } catch (err) {
      console.error('Error completing task:', err);
      await fetchOrderDetails(); // Refetch to restore correct state
    }
  };

  // Handle task uncomplete (revert to started state)
  const handleTaskUncomplete = async (taskId: number) => {
    try {
      const result = await orderTasksApi.batchUpdateTasks([{ task_id: taskId, completed: false }]);
      handleStatusUpdates(result.statusUpdates);
      onOrderUpdated();
    } catch (err) {
      console.error('Error uncompleting task:', err);
      await fetchOrderDetails(); // Refetch to restore correct state
    }
  };

  // Handle task unstart (revert to not started state)
  const handleTaskUnstart = async (taskId: number) => {
    try {
      const result = await orderTasksApi.batchUpdateTasks([{ task_id: taskId, started: false }]);
      handleStatusUpdates(result.statusUpdates);
      onOrderUpdated();
    } catch (err) {
      console.error('Error un-starting task:', err);
      await fetchOrderDetails(); // Refetch to restore correct state
    }
  };

  // Handle task notes change
  const handleTaskNotesChange = async (taskId: number, notes: string) => {
    try {
      await orderTasksApi.updateTaskNotes(taskId, notes);
      onOrderUpdated();
    } catch (err) {
      console.error('Error saving task notes:', err);
      await fetchOrderDetails(); // Refetch to restore correct state
    }
  };

  // Handle task added from dropdown
  const handleTaskAdded = async () => {
    setShowAddTaskForPart(null);
    await fetchOrderDetails();
    onOrderUpdated();
  };

  // Handle task removal
  const handleRemoveTask = async (taskId: number) => {
    // Remove from local state immediately
    setParts(prevParts => prevParts.map(part => ({
      ...part,
      tasks: part.tasks?.filter(task => task.task_id !== taskId)
    })));
    try {
      await orderTasksApi.removeTask(taskId);
      onOrderUpdated();
    } catch (err) {
      console.error('Error removing task:', err);
      // Refetch on error to restore state
      await fetchOrderDetails();
    }
  };

  // Handle due date change
  const handleDueDateSave = async () => {
    try {
      await ordersApi.updateOrder(order.order_number, { due_date: newDueDate });
      setShowDatePicker(false);
      await fetchOrderDetails();
      onOrderUpdated();
    } catch (err) {
      console.error('Error updating due date:', err);
    }
  };

  // Handle note save
  const handleNoteSave = async () => {
    try {
      setSavingNote(true);
      await ordersApi.updateOrder(order.order_number, { internal_note: noteText });
      setShowNoteInput(false);
      await fetchOrderDetails();
      onOrderUpdated();
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Handle open folder
  const handleOpenFolder = () => {
    if (!orderDetails?.folder_name || orderDetails.folder_location === 'none') {
      return;
    }
    // Construct UNC path based on folder location (same as OrderDetailsPage)
    let folderPath = '\\\\192.168.2.85\\Channel Letter\\Orders\\';
    if (orderDetails.folder_location === 'finished') {
      folderPath += '1Finished\\';
    }
    folderPath += orderDetails.folder_name;
    window.location.href = `nexus://open?path=${encodeURIComponent(folderPath)}`;
  };

  // Handle go to order
  const handleGoToOrder = () => {
    navigate(`/orders/${order.order_number}`);
  };

  if (!isOpen) return null;

  const currentStatus = orderDetails?.status || order.status;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className={`text-xl font-bold ${PAGE_STYLES.panel.text}`}>{order.order_name}</h2>
              <p className={`text-sm ${PAGE_STYLES.header.text}`}>
                {order.customer_name} &bull; #{order.order_number}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 rounded`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className={`w-8 h-8 animate-spin ${PAGE_STYLES.panel.textMuted}`} />
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Left Column - Status & Tasks */}
              <div className="flex-1 space-y-6">
                {/* Status Section */}
                <div>
                  <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                    Status
                  </h3>
                  <div className="relative">
                    <button
                      ref={statusButtonRef}
                      onClick={() => {
                        if (!showStatusDropdown && statusButtonRef.current) {
                          const rect = statusButtonRef.current.getBoundingClientRect();
                          setDropdownPosition({
                            top: rect.bottom + 4,
                            left: rect.left,
                            width: rect.width
                          });
                        }
                        setShowStatusDropdown(!showStatusDropdown);
                      }}
                      disabled={updatingStatus}
                      className={`
                        w-full flex items-center justify-between px-4 py-2 rounded-lg border
                        ${ORDER_STATUS_COLORS[currentStatus]}
                        hover:opacity-90 transition-opacity
                      `}
                    >
                      <span className="font-medium">
                        {updatingStatus ? 'Updating...' : ORDER_STATUS_LABELS[currentStatus]}
                      </span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showStatusDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-[60]"
                          onClick={() => setShowStatusDropdown(false)}
                        />
                        <div
                          className={`fixed ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg shadow-lg z-[70] max-h-96 overflow-y-auto`}
                          style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
                        >
                          {STATUS_GROUPS.map(group => (
                            <div key={group.label}>
                              <div className={`px-3 py-1.5 text-xs font-semibold ${PAGE_STYLES.panel.textMuted} uppercase ${PAGE_STYLES.page.background}`}>
                                {group.label}
                              </div>
                              {group.statuses.map(status => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(status)}
                                  disabled={status === currentStatus}
                                  className={`
                                    w-full px-3 py-2 text-left text-sm ${PAGE_STYLES.interactive.hover}
                                    ${status === currentStatus ? `${PAGE_STYLES.header.background} font-medium` : ''}
                                  `}
                                >
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${ORDER_STATUS_COLORS[status]}`}>
                                    {ORDER_STATUS_LABELS[status]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tasks Section */}
                <div>
                  <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                    Tasks
                  </h3>
                  {parts.filter(p => p.is_parent).length === 0 ? (
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>No parts found</p>
                  ) : (
                    <div className="space-y-4">
                      {parts.filter(p => p.is_parent).map((part, idx) => (
                        <div key={part.part_id} className={`border ${PAGE_STYLES.panel.border} rounded-lg`}>
                          <div className={`px-3 py-2 ${PAGE_STYLES.page.background} border-b ${PAGE_STYLES.panel.border} rounded-t-lg`}>
                            <span className={`text-sm font-medium ${PAGE_STYLES.header.text}`}>
                              Part {idx + 1}: {part.product_type}
                              {part.part_scope && ` - ${part.part_scope}`}
                            </span>
                          </div>
                          <div className="p-2">
                            {!part.tasks || part.tasks.length === 0 ? (
                              <p className={`text-xs ${PAGE_STYLES.panel.textMuted} px-2 py-1`}>No tasks</p>
                            ) : (
                              <div className="space-y-0">
                                {sortTasks(part.tasks).map(task => (
                                  <TaskRow
                                    key={task.task_id}
                                    task={task}
                                    onStart={() => handleTaskStart(task.task_id)}
                                    onComplete={() => handleTaskComplete(task.task_id)}
                                    onUncomplete={() => handleTaskUncomplete(task.task_id)}
                                    onUnstart={() => handleTaskUnstart(task.task_id)}
                                    onNotesChange={(notes) => handleTaskNotesChange(task.task_id, notes)}
                                    onRemove={() => handleRemoveTask(task.task_id)}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Add Task Button */}
                            <button
                              onClick={() => setShowAddTaskForPart(part.part_id)}
                              className={`mt-2 flex items-center gap-1 px-2 py-1 text-xs ${MODULE_COLORS.orders.text} hover:bg-orange-50 rounded transition-colors`}
                            >
                              <Plus className="w-3 h-3" />
                              Add Task
                            </button>

                            {/* Task Template Dropdown */}
                            {showAddTaskForPart === part.part_id && orderDetails && (
                              <TaskTemplateDropdown
                                orderNumber={orderDetails.order_number}
                                partId={part.part_id}
                                existingTasks={part.tasks || []}
                                onTaskAdded={handleTaskAdded}
                                onClose={() => setShowAddTaskForPart(null)}
                                centered={true}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Actions */}
              <div className="w-48 space-y-2">
                <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                  Actions
                </h3>

                {/* Go to Order */}
                <button
                  onClick={handleGoToOrder}
                  className={`w-full flex items-center gap-2 px-4 py-2 ${MODULE_COLORS.orders.base} text-white ${MODULE_COLORS.orders.hover} transition-colors text-sm font-medium rounded-lg`}
                >
                  <ExternalLink className="w-4 h-4" />
                  Go to Order
                </button>

                {/* Change Due Date */}
                {showDatePicker ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm`}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleDueDateSave}
                        className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className={`flex-1 px-2 py-1 ${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text} rounded text-xs font-medium ${PAGE_STYLES.interactive.hover}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className={`w-full flex items-center gap-2 px-4 py-2 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors text-sm font-medium`}
                  >
                    <Calendar className="w-4 h-4" />
                    Change Due Date
                  </button>
                )}

                {/* Open Folder */}
                <button
                  onClick={handleOpenFolder}
                  disabled={!orderDetails?.folder_name || orderDetails.folder_location === 'none'}
                  className={`
                    w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${orderDetails?.folder_name && orderDetails.folder_location !== 'none'
                      ? `${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} ${PAGE_STYLES.interactive.hover}`
                      : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                    }
                  `}
                >
                  <FolderOpen className="w-4 h-4" />
                  Open Folder
                </button>

                {/* Add Note */}
                {showNoteInput ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Internal note..."
                      rows={3}
                      className={`w-full px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm resize-none`}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleNoteSave}
                        disabled={savingNote}
                        className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {savingNote ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setShowNoteInput(false);
                          setNoteText(orderDetails?.internal_note || '');
                        }}
                        className={`flex-1 px-2 py-1 ${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text} rounded text-xs font-medium ${PAGE_STYLES.interactive.hover}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className={`w-full flex items-center gap-2 px-4 py-2 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors text-sm font-medium`}
                  >
                    <FileText className="w-4 h-4" />
                    Add Note
                  </button>
                )}

                {/* Show existing note if present */}
                {!showNoteInput && orderDetails?.internal_note && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <strong>Note:</strong> {orderDetails.internal_note}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderQuickModal;
