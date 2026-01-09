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
  Plus,
  Clock,
  Image as ImageIcon,
  Settings,
  CheckCircle,
  Printer,
  FileCheck,
  Send,
  Eye,
  RefreshCw,
  AlertTriangle,
  AlertOctagon
} from 'lucide-react';
import { CalendarOrder } from './types';
import { Order, OrderPart, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { ordersApi, orderStatusApi, orderTasksApi } from '../../../services/api';
import { qbInvoiceApi, InvoiceSyncStatus, InvoiceDifference } from '../../../services/api/orders/qbInvoiceApi';
import { TaskTemplateDropdown } from '../progress/TaskTemplateDropdown';
import { TaskMetadataResource } from '../../../services/taskMetadataResource';
import { TaskRow } from '../common/TaskRow';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import PrepareOrderModal from '../preparation/PrepareOrderModal';
import ConfirmationModal from '../details/components/ConfirmationModal';
import InvoiceActionModal from '../modals/InvoiceActionModal';
import InvoiceConflictModal from '../modals/InvoiceConflictModal';
import LinkInvoiceModal from '../modals/LinkInvoiceModal';
import PrintFormsModal from '../details/components/PrintFormsModal';
import { useOrderPrinting, PrintMode } from '../details/hooks/useOrderPrinting';
import { calculateShopCount } from '../details/services/orderCalculations';

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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get image URL for order
 */
const getOrderImageUrl = (order: {
  sign_image_path?: string;
  folder_name?: string;
  folder_location?: 'active' | 'finished' | 'none';
  is_migrated?: boolean;
}): string | null => {
  const { sign_image_path, folder_name, folder_location, is_migrated } = order;
  if (!sign_image_path || !folder_name || folder_location === 'none') return null;

  const serverUrl = API_BASE_URL.replace(/\/api$/, '');
  const basePath = `${serverUrl}/order-images`;
  const encodedFolder = encodeURIComponent(folder_name);
  const encodedFile = encodeURIComponent(sign_image_path);

  if (is_migrated) {
    return folder_location === 'active'
      ? `${basePath}/${encodedFolder}/${encodedFile}`
      : `${basePath}/1Finished/${encodedFolder}/${encodedFile}`;
  } else {
    return folder_location === 'active'
      ? `${basePath}/Orders/${encodedFolder}/${encodedFile}`
      : `${basePath}/Orders/1Finished/${encodedFolder}/${encodedFile}`;
  }
};

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
  const [newDueHour, setNewDueHour] = useState('');
  const [newDuePeriod, setNewDuePeriod] = useState<'AM' | 'PM'>('PM');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const statusButtonRef = useRef<HTMLButtonElement>(null);

  // Add task dropdown state
  const [showAddTaskForPart, setShowAddTaskForPart] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);

  // Task ordering from metadata
  const [taskOrder, setTaskOrder] = useState<string[]>([]);

  // Smart Action modals
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [showCustomerApprovedModal, setShowCustomerApprovedModal] = useState(false);
  const [showFilesCreatedModal, setShowFilesCreatedModal] = useState(false);

  // Invoice state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState<'create' | 'update' | 'send' | 'view'>('create');
  const [showLinkInvoiceModal, setShowLinkInvoiceModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictStatus, setConflictStatus] = useState<InvoiceSyncStatus>('in_sync');
  const [conflictDifferences, setConflictDifferences] = useState<InvoiceDifference[]>([]);
  const [invoiceSyncStatus, setInvoiceSyncStatus] = useState<InvoiceSyncStatus>('in_sync');
  const [actionLoading, setActionLoading] = useState(false);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('full');
  const [uiState, setUiState] = useState({ generatingForms: false, printingForm: false });
  const [defaultPrintConfig, setDefaultPrintConfig] = useState<{ master: number; estimate: number; shop: number; packing: number } | undefined>(undefined);

  // Printing hook - requires orderData with order, parts, taxRules, customerDiscount
  const orderDataForPrinting = {
    order: orderDetails,
    parts: parts,
    taxRules: [],
    customerDiscount: 0
  };

  const {
    printConfig,
    setPrintConfig,
    handlePrintForms,
    handlePrintMasterEstimate,
    handlePrintShopPacking,
    handlePrintAndMoveToProduction,
    handleMoveToProductionWithoutPrinting,
    handleOpenPrintModal
  } = useOrderPrinting(orderDataForPrinting, setUiState, () => {
    fetchOrderDetails();
    onOrderUpdated();
  });

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
      setImageError(false);
      setNewDueDate(result.order.due_date?.split('T')[0] || '');
      // Parse hard_due_date_time if exists (format: "HH:mm:ss")
      if (result.order.hard_due_date_time) {
        const [hours] = result.order.hard_due_date_time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        setNewDueHour(displayHour.toString());
        setNewDuePeriod(period);
      } else {
        setNewDueHour('');
        setNewDuePeriod('PM');
      }
      setNoteText(result.order.internal_note || '');
      setTaskOrder(orderFromMetadata);

      // Check invoice sync status if invoice exists
      if (result.order.qb_invoice_id) {
        try {
          const syncResult = await qbInvoiceApi.checkSyncStatus(result.order.order_number);
          setInvoiceSyncStatus(syncResult.status);
        } catch (syncErr) {
          console.error('Error checking invoice sync status:', syncErr);
          setInvoiceSyncStatus('in_sync'); // Default to in_sync on error
        }
      } else {
        setInvoiceSyncStatus('in_sync');
      }
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

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    // Optimistically update local state immediately
    setParts(prevParts => prevParts.map(part => ({
      ...part,
      tasks: part.tasks?.map(task =>
        task.task_id === taskId ? { ...task, notes } : task
      )
    })));
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
      // Convert 12-hour time to 24-hour format for API
      let hardDueTime: string | null = null;
      if (newDueHour) {
        let hour24 = parseInt(newDueHour);
        if (newDuePeriod === 'PM' && hour24 !== 12) hour24 += 12;
        if (newDuePeriod === 'AM' && hour24 === 12) hour24 = 0;
        hardDueTime = `${hour24.toString().padStart(2, '0')}:00:00`;
      }
      await ordersApi.updateOrder(order.order_number, {
        due_date: newDueDate,
        hard_due_date_time: hardDueTime as any
      });
      setShowDatePicker(false);
      await fetchOrderDetails();
      onOrderUpdated();
    } catch (err) {
      console.error('Error updating due date:', err);
    }
  };

  // Clear hard due time
  const handleClearTime = () => {
    setNewDueHour('');
    setNewDuePeriod('PM');
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

  // ===== SMART ACTION HANDLERS =====

  // Prepare Order
  const handlePrepareOrder = () => {
    setShowPrepareModal(true);
  };

  const handlePreparationComplete = () => {
    setShowPrepareModal(false);
    fetchOrderDetails();
    onOrderUpdated();
  };

  // Customer Approved
  const handleCustomerApproved = () => {
    setShowCustomerApprovedModal(true);
  };

  const handleConfirmCustomerApproved = async () => {
    if (!orderDetails) return;
    try {
      setActionLoading(true);
      await orderStatusApi.updateOrderStatus(
        orderDetails.order_number,
        'pending_production_files_creation',
        'Customer approved the estimate'
      );
      setShowCustomerApprovedModal(false);
      await fetchOrderDetails();
      onOrderUpdated();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Files Created
  const handleFilesCreated = () => {
    setShowFilesCreatedModal(true);
  };

  const handleConfirmFilesCreated = async () => {
    if (!orderDetails) return;
    try {
      setActionLoading(true);
      await orderStatusApi.updateOrderStatus(
        orderDetails.order_number,
        'pending_production_files_approval',
        'Production files created and ready for approval'
      );
      setShowFilesCreatedModal(false);
      await fetchOrderDetails();
      onOrderUpdated();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Print Forms - open print modal
  const openPrintModal = (mode: PrintMode = 'full') => {
    // Calculate default config based on mode (matches useOrderPrinting logic)
    const shopCount = calculateShopCount(parts);
    let defaults: { master: number; estimate: number; shop: number; packing: number };

    if (mode === 'master_estimate') {
      defaults = { master: 1, estimate: 1, shop: 0, packing: 0 };
    } else if (mode === 'shop_packing_production') {
      defaults = { master: 0, estimate: 0, shop: shopCount, packing: 2 };
    } else {
      defaults = { master: 1, estimate: 1, shop: shopCount, packing: 2 };
    }

    setDefaultPrintConfig(defaults);
    handleOpenPrintModal(mode);
    setPrintMode(mode);
    setShowPrintModal(true);
  };

  // Approve Files - opens print modal with production options
  // Status update happens when user clicks "Print and Move to Production" or "Approve without Printing"
  const handleApproveFiles = () => {
    openPrintModal('shop_packing_production');
  };

  // Wrapped handlers to close modal after production actions complete
  const handlePrintAndMoveToProductionWithClose = async () => {
    await handlePrintAndMoveToProduction();
    setShowPrintModal(false);
  };

  const handleMoveToProductionWithoutPrintingWithClose = async () => {
    await handleMoveToProductionWithoutPrinting();
    setShowPrintModal(false);
  };

  // Invoice Actions
  const handleInvoiceAction = async (action: string) => {
    if (!orderDetails) return;

    // For conflict/qb_modified, show conflict modal
    if (action === 'qb_modified' || action === 'conflict') {
      try {
        setActionLoading(true);
        const result = await qbInvoiceApi.compareWithQB(orderDetails.order_number);
        if (result) {
          setConflictStatus(result.status);
          setConflictDifferences(result.differences || []);
          setShowConflictModal(true);
        }
      } catch (err) {
        console.error('Error checking invoice conflicts:', err);
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // For other actions, check for conflicts first if invoice exists
    if (action !== 'create' && orderDetails.qb_invoice_id) {
      try {
        setActionLoading(true);
        const result = await qbInvoiceApi.compareWithQB(orderDetails.order_number);
        if (result && (result.status === 'qb_modified' || result.status === 'conflict')) {
          setConflictStatus(result.status);
          setConflictDifferences(result.differences || []);
          setShowConflictModal(true);
          return;
        }
        if (result && result.status === 'local_stale') {
          setInvoiceModalMode('update');
          setShowInvoiceModal(true);
          return;
        }
      } catch (err) {
        console.error('Error checking invoice:', err);
      } finally {
        setActionLoading(false);
      }
    }

    // Open invoice modal with appropriate mode
    setInvoiceModalMode(action as 'create' | 'update' | 'send' | 'view');
    setShowInvoiceModal(true);
  };

  const handleInvoiceSuccess = () => {
    setShowInvoiceModal(false);
    fetchOrderDetails();
    onOrderUpdated();
  };

  const handleConflictResolved = () => {
    setShowConflictModal(false);
    setConflictDifferences([]);
    fetchOrderDetails();
    onOrderUpdated();
  };

  const handleLinkInvoiceSuccess = () => {
    setShowLinkInvoiceModal(false);
    fetchOrderDetails();
    onOrderUpdated();
  };

  // Get invoice button state
  const getInvoiceButtonState = () => {
    if (!orderDetails) return null;

    const hasInvoice = !!orderDetails.qb_invoice_id;
    const invoiceSent = !!orderDetails.invoice_sent_at;

    if (!hasInvoice) {
      // Show Create Invoice for:
      // 1. Deposit-required orders (any workflow status)
      // 2. Non-deposit orders in shipping/pick_up/awaiting_payment (for final invoice)
      const needsInvoice = ['shipping', 'pick_up', 'awaiting_payment'].includes(orderDetails.status);
      if (!orderDetails.deposit_required && !needsInvoice) {
        return null;
      }
      return {
        action: 'create',
        label: 'Create Invoice',
        icon: <FileText className="w-4 h-4" />,
        colorClass: 'bg-green-600 hover:bg-green-700 text-white'
      };
    }

    switch (invoiceSyncStatus) {
      case 'local_stale':
        return {
          action: 'update',
          label: 'Update Invoice',
          icon: <RefreshCw className="w-4 h-4" />,
          colorClass: 'bg-orange-500 hover:bg-orange-600 text-white'
        };
      case 'qb_modified':
        return {
          action: 'qb_modified',
          label: 'Review Changes',
          icon: <AlertTriangle className="w-4 h-4" />,
          colorClass: 'bg-purple-600 hover:bg-purple-700 text-white'
        };
      case 'conflict':
        return {
          action: 'conflict',
          label: 'Resolve Conflict',
          icon: <AlertOctagon className="w-4 h-4" />,
          colorClass: 'bg-red-600 hover:bg-red-700 text-white'
        };
      default:
        if (!invoiceSent) {
          return {
            action: 'send',
            label: 'Send Invoice',
            icon: <Send className="w-4 h-4" />,
            colorClass: 'bg-blue-600 hover:bg-blue-700 text-white'
          };
        }
        return {
          action: 'view',
          label: 'View Invoice',
          icon: <Eye className="w-4 h-4" />,
          colorClass: 'bg-gray-500 hover:bg-gray-600 text-white'
        };
    }
  };

  if (!isOpen) return null;

  const currentStatus = orderDetails?.status || order.status;

  const imageUrl = orderDetails ? getOrderImageUrl(orderDetails) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <div className="flex gap-4 items-start max-h-[85vh]">
        {/* Image Panel - sized to fit image */}
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl overflow-hidden flex-shrink-0`}>
          {/* Header */}
          <div className={`px-4 py-3 border-b ${PAGE_STYLES.panel.border}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-bold ${PAGE_STYLES.panel.text}`}>{order.order_name}</h2>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    orderDetails?.shipping_required
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {orderDetails?.shipping_required ? 'Shipping' : 'Pick Up'}
                  </span>
                </div>
                <p className={`text-sm ${PAGE_STYLES.header.text}`}>
                  {order.customer_name} &bull; #{order.order_number}
                  {orderDetails?.customer_po && <> &bull; PO: {orderDetails.customer_po}</>}
                  {orderDetails?.customer_job_number && <> &bull; Job: {orderDetails.customer_job_number}</>}
                </p>
              </div>
              <button
                onClick={onClose}
                className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 rounded flex-shrink-0`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={order.order_name}
              className="block"
              style={{ width: '560px', maxHeight: '369px', objectFit: 'contain' }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center bg-gray-100" style={{ width: '280px', height: '200px' }}>
              <div className="text-center text-gray-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">No image</p>
              </div>
            </div>
          )}

          {/* Status, Due Date, Note, Actions - under image */}
          <div className="p-4 space-y-4">
            {/* Status & Due Date Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <h3 className={`text-base font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-1`}>
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
                      w-full flex items-center justify-between px-3 py-2 rounded border text-sm
                      ${ORDER_STATUS_COLORS[currentStatus]}
                      hover:opacity-90 transition-opacity
                    `}
                  >
                    <span className="font-medium">
                      {updatingStatus ? '...' : ORDER_STATUS_LABELS[currentStatus]}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
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

              {/* Due Date */}
              <div>
                <h3 className={`text-base font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-1`}>
                  Due Date
                </h3>
                {showDatePicker ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className={`w-full px-2 py-1.5 border ${PAGE_STYLES.panel.border} rounded text-sm`}
                    />
                    <div className={`flex items-center gap-1 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                      <Clock className="w-4 h-4" />
                      <span>Hard Due Time</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={newDueHour}
                        onChange={(e) => setNewDueHour(e.target.value)}
                        className={`w-14 px-1 py-1.5 border ${PAGE_STYLES.panel.border} rounded text-sm text-center`}
                      >
                        <option value="">--</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <select
                        value={newDuePeriod}
                        onChange={(e) => setNewDuePeriod(e.target.value as 'AM' | 'PM')}
                        className={`w-16 px-1 py-1.5 border ${PAGE_STYLES.panel.border} rounded text-sm text-center`}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                      {newDueHour && (
                        <button
                          onClick={handleClearTime}
                          className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:text-red-600 rounded`}
                          title="Clear time"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handleDueDateSave}
                        className="flex-1 px-2 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className={`flex-1 px-2 py-1.5 ${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text} rounded text-sm font-medium ${PAGE_STYLES.interactive.hover}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className={`w-full px-2 py-1.5 rounded border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.interactive.hover} text-left`}
                  >
                    <div className={`font-medium text-sm ${PAGE_STYLES.panel.text}`}>
                      {orderDetails?.due_date ? (
                        new Date(orderDetails.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      ) : (
                        <span className={PAGE_STYLES.panel.textMuted}>Not set</span>
                      )}
                    </div>
                    {orderDetails?.hard_due_date_time && (
                      <div className="text-sm text-red-600 font-medium">
                        {(() => {
                          const [hours] = orderDetails.hard_due_date_time.split(':').map(Number);
                          const period = hours >= 12 ? 'PM' : 'AM';
                          const displayHour = hours % 12 || 12;
                          return `${displayHour} ${period}`;
                        })()}
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Note Section - only show if note exists or editing */}
            {(showNoteInput || orderDetails?.internal_note) && (
              <div>
                <h3 className={`text-base font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-1`}>
                  Note
                </h3>
                {showNoteInput ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Internal note..."
                      rows={2}
                      className={`w-full px-2 py-1.5 border ${PAGE_STYLES.panel.border} rounded text-sm resize-none`}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleNoteSave}
                        disabled={savingNote}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {savingNote ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setShowNoteInput(false);
                          setNoteText(orderDetails?.internal_note || '');
                        }}
                        className={`px-2 py-1 ${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text} rounded text-sm font-medium ${PAGE_STYLES.interactive.hover}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className={`w-full text-left px-2 py-1.5 rounded border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.interactive.hover}`}
                  >
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>{orderDetails?.internal_note}</p>
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleGoToOrder}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 ${MODULE_COLORS.orders.base} text-white ${MODULE_COLORS.orders.hover} transition-colors text-sm font-medium rounded`}
              >
                <ExternalLink className="w-4 h-4" />
                Go to Order
              </button>
              <button
                onClick={handleOpenFolder}
                disabled={!orderDetails?.folder_name || orderDetails.folder_location === 'none'}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors
                  ${orderDetails?.folder_name && orderDetails.folder_location !== 'none'
                    ? `${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} ${PAGE_STYLES.interactive.hover}`
                    : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                  }
                `}
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </button>
              {!orderDetails?.internal_note && (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} rounded ${PAGE_STYLES.interactive.hover} transition-colors text-sm font-medium`}
                >
                  <FileText className="w-4 h-4" />
                  Note
                </button>
              )}
            </div>

            {/* Smart Actions */}
            <div className={`pt-3 border-t ${PAGE_STYLES.panel.border}`}>
              <h3 className={`text-base font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                Workflow
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* Prepare Order - job_details_setup */}
                {orderDetails?.status === 'job_details_setup' && (
                  <button
                    onClick={handlePrepareOrder}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Settings className="w-4 h-4" />
                    Prepare Order
                  </button>
                )}

                {/* Customer Approved - pending_confirmation */}
                {orderDetails?.status === 'pending_confirmation' && (
                  <button
                    onClick={handleCustomerApproved}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Customer Approved
                  </button>
                )}

                {/* Print Master/Estimate + Files Created - pending_production_files_creation */}
                {orderDetails?.status === 'pending_production_files_creation' && (
                  <>
                    <button
                      onClick={() => openPrintModal('master_estimate')}
                      disabled={uiState.printingForm}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4" />
                      {uiState.printingForm ? 'Printing...' : 'Print Master/Estimate'}
                    </button>
                    <button
                      onClick={handleFilesCreated}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <FileCheck className="w-4 h-4" />
                      Mark Files Created
                    </button>
                  </>
                )}

                {/* Approve Files - pending_production_files_approval */}
                {orderDetails?.status === 'pending_production_files_approval' && (
                  <button
                    onClick={handleApproveFiles}
                    disabled={actionLoading || uiState.printingForm}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    Approve Files
                  </button>
                )}

                {/* Invoice Button - excludes setup/confirmation and final statuses */}
                {orderDetails && !['job_details_setup', 'pending_confirmation', 'completed', 'cancelled', 'on_hold'].includes(orderDetails.status) && (() => {
                  const invoiceState = getInvoiceButtonState();
                  if (!invoiceState) return null;
                  return (
                    <button
                      onClick={() => handleInvoiceAction(invoiceState.action)}
                      disabled={actionLoading}
                      className={`flex items-center gap-1.5 px-3 py-2 ${invoiceState.colorClass} rounded text-sm font-medium transition-colors disabled:opacity-50`}
                    >
                      {invoiceState.icon}
                      {invoiceState.label}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Panel */}
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-h-[85vh] flex flex-col`} style={{ width: '480px' }}>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className={`w-8 h-8 animate-spin ${PAGE_STYLES.panel.textMuted}`} />
              </div>
            ) : (
              <div>
                  <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                    Tasks
                  </h3>
                  {parts.filter(p => p.is_parent && p.specs_display_name?.trim()).length === 0 ? (
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>No parts found</p>
                  ) : (
                    <div className="space-y-4">
                      {parts.filter(p => p.is_parent && p.specs_display_name?.trim()).map((part, idx) => (
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
              )}
          </div>
        </div>
      </div>

      {/* Prepare Order Modal */}
      {showPrepareModal && orderDetails && (
        <PrepareOrderModal
          isOpen={showPrepareModal}
          onClose={() => setShowPrepareModal(false)}
          order={orderDetails}
          onComplete={handlePreparationComplete}
        />
      )}

      {/* Customer Approved Confirmation */}
      {showCustomerApprovedModal && (
        <ConfirmationModal
          isOpen={showCustomerApprovedModal}
          title="Confirm Customer Approval"
          message="Mark this order as approved by customer? This will move the order to 'Pending Files Creation'."
          onConfirm={handleConfirmCustomerApproved}
          onClose={() => setShowCustomerApprovedModal(false)}
          confirmText="Confirm"
          confirmColor="green"
        />
      )}

      {/* Files Created Confirmation */}
      {showFilesCreatedModal && (
        <ConfirmationModal
          isOpen={showFilesCreatedModal}
          title="Files Created"
          message="Confirm production files have been created? This will move the order to 'Pending Files Approval'."
          onConfirm={handleConfirmFilesCreated}
          onClose={() => setShowFilesCreatedModal(false)}
          confirmText="Confirm"
          confirmColor="purple"
        />
      )}

      {/* Invoice Action Modal */}
      {showInvoiceModal && orderDetails && (
        <InvoiceActionModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          order={orderDetails}
          mode={invoiceModalMode}
          onSuccess={handleInvoiceSuccess}
          onLinkExisting={() => {
            setShowInvoiceModal(false);
            setShowLinkInvoiceModal(true);
          }}
        />
      )}

      {/* Invoice Conflict Modal */}
      {showConflictModal && orderDetails && (
        <InvoiceConflictModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          order={orderDetails}
          conflictStatus={conflictStatus}
          differences={conflictDifferences}
          onResolved={handleConflictResolved}
        />
      )}

      {/* Link Invoice Modal */}
      {showLinkInvoiceModal && orderDetails && (
        <LinkInvoiceModal
          isOpen={showLinkInvoiceModal}
          onClose={() => setShowLinkInvoiceModal(false)}
          orderNumber={orderDetails.order_number}
          customerName={orderDetails.customer_name || ''}
          onSuccess={handleLinkInvoiceSuccess}
        />
      )}

      {/* Print Forms Modal */}
      {showPrintModal && orderDetails && (
        <PrintFormsModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          printConfig={printConfig}
          onPrintConfigChange={setPrintConfig}
          onPrint={handlePrintForms}
          onPrintMasterEstimate={handlePrintMasterEstimate}
          onPrintShopPacking={handlePrintShopPacking}
          printing={uiState.printingForm}
          mode={printMode}
          onPrintAndMoveToProduction={handlePrintAndMoveToProductionWithClose}
          onMoveToProductionWithoutPrinting={handleMoveToProductionWithoutPrintingWithClose}
          order={orderDetails}
          defaultConfig={defaultPrintConfig}
        />
      )}
    </div>
  );
};

export default OrderQuickModal;
