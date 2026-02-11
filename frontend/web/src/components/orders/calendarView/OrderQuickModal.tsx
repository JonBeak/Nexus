/**
 * OrderQuickModal Component
 * Quick action modal for order management from Calendar View
 *
 * Updated: 2025-01-16 - Refactored to use AuthContext
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  AlertOctagon,
  DollarSign
} from 'lucide-react';
import { CalendarOrder } from './types';
import { Order, OrderPart, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { ordersApi, orderStatusApi, orderTasksApi, qbInvoiceApi, provincesApi, InvoiceSyncStatus, InvoiceDifference, orderPreparationApi } from '../../../services/api';
import { staffTasksApi } from '../../../services/api/staff/staffTasksApi';
import { TaskTemplateDropdown } from '../progress/TaskTemplateDropdown';
import { TaskMetadataResource } from '../../../services/taskMetadataResource';
import { TaskRow } from '../common/TaskRow';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { useAuth } from '../../../contexts/AuthContext';
import PrepareOrderModal from '../preparation/PrepareOrderModal';
import ConfirmationModal from '../details/components/ConfirmationModal';
// Unified document modals
import { DocumentActionModal, LinkDocumentModal, DocumentConflictModal, OrderTotals } from '../modals/document';
import { DocumentSyncStatus, DocumentDifference } from '../../../types/document';
import { CashPaymentModal } from '../modals/CashPaymentModal';
import PrintFormsModal from '../details/components/PrintFormsModal';
import AiFileValidationModal from '../details/components/AiFileValidationModal';
import MaterialRequirementsConfirmationModal from '../modals/MaterialRequirementsConfirmationModal';
import PDFViewerModal from '../modals/PDFViewerModal';
import SessionsModal from '../../staff/SessionsModal';
import { useOrderPrinting, PrintMode, PrintResult } from '../details/hooks/useOrderPrinting';
import { calculateShopCount } from '../details/services/orderCalculations';
import { useAlert } from '../../../contexts/AlertContext';
import { getFolderPathSegment } from '../../../utils/pdfUrls';

type FolderLocation = 'active' | 'finished' | 'cancelled' | 'hold' | 'none';

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

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

/**
 * Get image URL for order
 */
const getOrderImageUrl = (order: {
  sign_image_path?: string;
  folder_name?: string;
  folder_location?: FolderLocation;
  is_migrated?: boolean;
}): string | null => {
  const { sign_image_path, folder_name, folder_location, is_migrated } = order;
  if (!sign_image_path || !folder_name || folder_location === 'none') return null;

  const serverUrl = API_BASE_URL.replace(/\/api$/, '');
  const basePath = `${serverUrl}/order-images`;
  const encodedFolder = encodeURIComponent(folder_name);
  const encodedFile = encodeURIComponent(sign_image_path);

  // Get folder path segment based on location (active, finished, cancelled, hold)
  const pathSegment = getFolderPathSegment(folder_location, is_migrated);
  return `${basePath}/${pathSegment}${encodedFolder}/${encodedFile}`;
};

export const OrderQuickModal: React.FC<OrderQuickModalProps> = ({
  isOpen,
  order,
  onClose,
  onOrderUpdated
}) => {
  const isMobile = useIsMobile();

  // Lock body scroll on mobile when modal is open (and no child modal is open)
  // Child modals will handle their own scroll lock
  useBodyScrollLock(isOpen && isMobile);

  // State
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [parts, setParts] = useState<OrderPart[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
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
  const modalContentRef = useRef<HTMLDivElement>(null);
  const imagePanelRef = useRef<HTMLDivElement>(null);
  const tasksPanelRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Add task dropdown state
  const [showAddTaskForPart, setShowAddTaskForPart] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);

  // Task ordering from metadata
  const [taskOrder, setTaskOrder] = useState<string[]>([]);

  // Smart Action modals
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [showCustomerApprovedModal, setShowCustomerApprovedModal] = useState(false);
  const [showFilesCreatedModal, setShowFilesCreatedModal] = useState(false);
  const [showAiValidationModal, setShowAiValidationModal] = useState(false);

  // Invoice state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState<'create' | 'update' | 'send' | 'view'>('create');
  const [showLinkInvoiceModal, setShowLinkInvoiceModal] = useState(false);
  const [reassignInvoiceInfo, setReassignInvoiceInfo] = useState<{
    invoiceId: string | null;
    invoiceNumber: string | null;
    isDeleted: boolean;
  } | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictStatus, setConflictStatus] = useState<InvoiceSyncStatus>('in_sync');
  const [conflictDifferences, setConflictDifferences] = useState<InvoiceDifference[]>([]);
  const [invoiceSyncStatus, setInvoiceSyncStatus] = useState<InvoiceSyncStatus>('in_sync');
  const [actionLoading, setActionLoading] = useState(false);

  // Estimate conflict state (for cash jobs)
  const [showEstimateConflictModal, setShowEstimateConflictModal] = useState(false);
  const [estimateSyncStatus, setEstimateSyncStatus] = useState<DocumentSyncStatus>('in_sync');
  const [estimateDifferences, setEstimateDifferences] = useState<DocumentDifference[]>([]);
  const [showLinkEstimateModal, setShowLinkEstimateModal] = useState(false);
  const [reassignEstimateInfo, setReassignEstimateInfo] = useState<{
    estimateId: string | null;
    estimateNumber: string | null;
    isDeleted: boolean;
  } | null>(null);
  const [estimateIsStale, setEstimateIsStale] = useState(false);
  const [showEstimateDropdown, setShowEstimateDropdown] = useState(false);
  const [showCreateEstimateModal, setShowCreateEstimateModal] = useState(false);
  const [showEstimateActionModal, setShowEstimateActionModal] = useState(false);
  const [estimateActionMode, setEstimateActionMode] = useState<'send' | 'view'>('send');

  // Cash payment modal state
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);

  // Material Requirements Confirmation modal
  const [showMaterialRequirementsModal, setShowMaterialRequirementsModal] = useState(false);
  const [pendingPrintResult, setPendingPrintResult] = useState<PrintResult | null>(null);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('full');
  const [uiState, setUiState] = useState({ generatingForms: false, printingForm: false });
  const [defaultPrintConfig, setDefaultPrintConfig] = useState<{ master: number; estimate: number; shop: number; packing: number } | undefined>(undefined);

  // PDF Viewer modal state
  const [showPdfViewerModal, setShowPdfViewerModal] = useState(false);

  // Get user data from AuthContext (no API call needed!)
  const { userId: currentUserId, isManager } = useAuth();

  // Alert context for custom alerts
  const { showError } = useAlert();

  // Session modal state
  const [sessionsModalTask, setSessionsModalTask] = useState<{
    taskId: number;
    taskRole: string | null;
  } | null>(null);

  // Check if any child modal is open (for hiding parent content on mobile)
  const hasChildModalOpen = useMemo(() => {
    return showPrepareModal || showCustomerApprovedModal || showFilesCreatedModal ||
           showAiValidationModal || showInvoiceModal || showConflictModal || showLinkInvoiceModal ||
           showEstimateConflictModal || showLinkEstimateModal || showCreateEstimateModal ||
           showEstimateActionModal || showPrintModal || showPdfViewerModal ||
           showCashPaymentModal || showMaterialRequirementsModal ||
           sessionsModalTask !== null || showAddTaskForPart !== null;
  }, [showPrepareModal, showCustomerApprovedModal, showFilesCreatedModal,
      showAiValidationModal, showInvoiceModal, showConflictModal, showLinkInvoiceModal,
      showEstimateConflictModal, showLinkEstimateModal, showCreateEstimateModal,
      showEstimateActionModal, showPrintModal, showPdfViewerModal,
      showCashPaymentModal, showMaterialRequirementsModal,
      sessionsModalTask, showAddTaskForPart]);

  // Callback for when files are approved (from print modal) - opens material requirements modal
  const handleFilesApproved = useCallback((printResult: PrintResult | null) => {
    setShowPrintModal(false);
    setPendingPrintResult(printResult);
    setShowMaterialRequirementsModal(true);
  }, []);

  // Printing hook - requires orderData with order, parts, taxRules, customerDiscount
  const orderDataForPrinting = {
    order: orderDetails,
    parts: parts,
    taxRules: taxRules,
    customerDiscount: 0
  };

  const {
    printConfig,
    setPrintConfig,
    handlePrintForms,
    handlePrintMasterEstimate,
    handlePrintShopPacking,
    handlePrintAndApprove,
    handleApproveWithoutPrinting,
    handleMoveToProductionAfterMaterials,
    handleOpenPrintModal,
    shopRoles
  } = useOrderPrinting(orderDataForPrinting, setUiState, () => {
    fetchOrderDetails();
    onOrderUpdated();
  }, handleFilesApproved);

  // Called when materials are confirmed in the modal
  const handleMaterialsConfirmed = useCallback(async () => {
    setShowMaterialRequirementsModal(false);
    await handleMoveToProductionAfterMaterials(pendingPrintResult);
    setPendingPrintResult(null);
  }, [pendingPrintResult, handleMoveToProductionAfterMaterials]);

  // Calculate order totals for LinkDocumentModal comparison
  const orderTotals = useMemo((): OrderTotals | undefined => {
    if (!orderDetails || !parts || parts.length === 0) return undefined;

    const subtotal = parts.reduce((sum, part) => {
      if (part.is_header_row) return sum;
      return sum + parseFloat(part.extended_price?.toString() || '0');
    }, 0);

    // Look up actual tax rate from tax_rules based on order's tax_name
    const isCashJob = !!orderDetails.cash;
    const hasTaxName = !!orderDetails.tax_name;
    const taxRule = hasTaxName ? taxRules.find(r => r.tax_name === orderDetails.tax_name) : null;

    // Fail clearly if tax name exists but rule not found (and taxRules loaded)
    const taxNotFound = hasTaxName && !isCashJob && taxRules.length > 0 && !taxRule;
    const taxDecimal = isCashJob ? 0 : (taxRule ? parseFloat(taxRule.tax_percent.toString()) : 0);
    const taxPercent = taxDecimal * 100;
    const taxAmount = subtotal * taxDecimal;

    return {
      subtotal,
      taxName: taxNotFound ? `⚠️ ${orderDetails.tax_name} (NOT FOUND)` : (orderDetails.tax_name || (isCashJob ? 'No Tax' : 'No Tax Set')),
      taxPercent: taxNotFound ? -1 : taxPercent,  // -1 signals error
      taxAmount: taxNotFound ? 0 : taxAmount,
      total: taxNotFound ? subtotal : subtotal + taxAmount
    };
  }, [orderDetails, parts, taxRules]);

  // Fetch order details when modal opens
  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [result, orderFromMetadata, taxRulesData] = await Promise.all([
        ordersApi.getOrderWithParts(order.order_number),
        TaskMetadataResource.getTaskOrder(),
        provincesApi.getTaxRules()
      ]);
      setOrderDetails(result.order);
      setParts(result.parts || []);
      setTaxRules(taxRulesData || []);
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
          const syncResult = await qbInvoiceApi.compareWithQB(result.order.order_number);
          setInvoiceSyncStatus(syncResult.status);
        } catch (syncErr) {
          console.error('Error checking invoice sync status:', syncErr);
          setInvoiceSyncStatus('in_sync'); // Default to in_sync on error
        }
      } else {
        setInvoiceSyncStatus('in_sync');
      }

      // Check estimate staleness for cash jobs with existing estimates
      if (result.order.cash && result.order.qb_estimate_id) {
        try {
          const stalenessResult = await orderPreparationApi.checkQBEstimateStaleness(result.order.order_number);
          setEstimateIsStale(stalenessResult.isStale || false);
        } catch (stalenessErr) {
          console.error('Error checking estimate staleness:', stalenessErr);
          setEstimateIsStale(false);
        }
      } else {
        setEstimateIsStale(false);
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

  // Handle ESC key to close modal - only if no child modals are open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Use the memoized hasChildModalOpen variable (includes all child modals)
        if (!hasChildModalOpen) {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, hasChildModalOpen]);

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

  // Session modal handlers
  const handleOpenSessionsModal = (taskId: number, taskRole: string | null) => {
    setSessionsModalTask({ taskId, taskRole });
  };

  const handleCloseSessionsModal = () => {
    setSessionsModalTask(null);
  };

  const handleSessionChange = () => {
    // Refresh tasks when sessions change
    fetchOrderDetails();
    onOrderUpdated();
  };

  // Handle task start (non-manager session-based)
  const handleTaskStart = async (taskId: number) => {
    try {
      await staffTasksApi.startTask(taskId);
      await fetchOrderDetails();
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

  // Handle task unstart (non-manager session-based)
  const handleTaskUnstart = async (taskId: number) => {
    try {
      await staffTasksApi.stopTask(taskId);
      await fetchOrderDetails();
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

  // Folder dropdown state
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutsideFolder = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideFolder);
    return () => document.removeEventListener('mousedown', handleClickOutsideFolder);
  }, []);

  // Handle open folder
  const handleOpenFolder = (locationType: 'new' | 'legacy') => {
    if (!orderDetails?.folder_name || orderDetails.folder_location === 'none') {
      return;
    }

    const location = orderDetails.folder_location;
    let folderPath: string;

    if (locationType === 'new') {
      folderPath = '\\\\192.168.2.85\\Channel Letter\\Orders\\';
      if (location === 'finished') folderPath += '1Finished\\';
      else if (location === 'cancelled') folderPath += '1Cancelled\\';
      else if (location === 'hold') folderPath += '1Hold\\';
    } else {
      folderPath = '\\\\192.168.2.85\\Channel Letter\\';
      if (location === 'finished') folderPath += '1Finished\\';
    }

    folderPath += orderDetails.folder_name;
    window.location.href = `nexus://open?path=${encodeURIComponent(folderPath)}`;
  };

  // Helper to check if a point is inside either panel
  const isInsideAnyPanel = (target: Node): boolean => {
    const inImagePanel = imagePanelRef.current?.contains(target) ?? false;
    const inTasksPanel = tasksPanelRef.current?.contains(target) ?? false;
    return inImagePanel || inTasksPanel;
  };

  // Handle backdrop click - only close if both mousedown and mouseup are outside both panels
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    // Check if mousedown is outside both panels
    if (!isInsideAnyPanel(e.target as Node)) {
      mouseDownOutsideRef.current = true;
    } else {
      mouseDownOutsideRef.current = false;
    }
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    // Only close if both mousedown AND mouseup are outside both panels
    if (mouseDownOutsideRef.current && !isInsideAnyPanel(e.target as Node)) {
      // Use the memoized hasChildModalOpen variable (includes all child modals)
      if (!hasChildModalOpen) {
        onClose();
      }
    }
    mouseDownOutsideRef.current = false;
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
      showError('Failed to update order status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Files Created - show AI validation modal first
  const handleFilesCreated = () => {
    setShowAiValidationModal(true);
  };

  const handleAiValidationComplete = () => {
    setShowAiValidationModal(false);
    setShowFilesCreatedModal(true);
  };

  const handleSkipAiValidation = () => {
    setShowAiValidationModal(false);
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
      showError('Failed to update order status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Print Forms - open print modal
  const openPrintModal = (mode: PrintMode = 'full') => {
    // Calculate default config based on mode (matches useOrderPrinting logic)
    const shopResult = calculateShopCount(parts);
    let defaults: { master: number; estimate: number; shop: number; packing: number };

    if (mode === 'master_estimate') {
      defaults = { master: 1, estimate: 1, shop: 0, packing: 0 };
    } else if (mode === 'shop_packing_production') {
      defaults = { master: 0, estimate: 0, shop: shopResult.count, packing: 2 };
    } else {
      defaults = { master: 1, estimate: 1, shop: shopResult.count, packing: 2 };
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

  // Wrapped handlers to close modal after approval actions complete
  const handlePrintAndApproveWithClose = async () => {
    await handlePrintAndApprove();
    setShowPrintModal(false);
  };

  const handleApproveWithoutPrintingWithClose = async () => {
    await handleApproveWithoutPrinting();
    setShowPrintModal(false);
  };

  // Handle cash job estimate actions
  const handleEstimateAction = async (action: 'create_estimate' | 'update_estimate' | 'send_estimate' | 'view_estimate' | 'review_changes') => {
    if (!orderDetails) return;

    if (action === 'create_estimate') {
      // Open preview modal instead of direct API call
      setShowCreateEstimateModal(true);
      return;
    } else if (action === 'update_estimate' || action === 'review_changes') {
      // Recreate estimate or review changes - check for conflicts first
      try {
        setActionLoading(true);
        const compareResult = await orderPreparationApi.compareQBEstimate(orderDetails.order_number);

        // If there are differences or conflicts, show the conflict modal
        if (compareResult.status !== 'in_sync' && compareResult.status !== 'not_found') {
          setEstimateSyncStatus(compareResult.status);
          setEstimateDifferences(compareResult.differences || []);
          setShowEstimateConflictModal(true);
        } else {
          // No conflicts - just create new estimate
          await orderPreparationApi.createQBEstimate(orderDetails.order_number);
          fetchOrderDetails();
          onOrderUpdated();
        }
      } catch (err) {
        console.error('Error checking/updating estimate:', err);
        showError('Failed to update QB estimate. Please try again.');
      } finally {
        setActionLoading(false);
      }
    } else if (action === 'send_estimate') {
      // Open estimate action modal in 'send' mode
      setEstimateActionMode('send');
      setShowEstimateActionModal(true);
    } else if (action === 'view_estimate') {
      // Open estimate action modal in 'view' mode
      setEstimateActionMode('view');
      setShowEstimateActionModal(true);
    }
  };

  // Handle estimate conflict resolution
  const handleEstimateConflictResolved = () => {
    setShowEstimateConflictModal(false);
    setEstimateDifferences([]);
    fetchOrderDetails();
    onOrderUpdated();
  };

  // Handle link estimate success
  const handleLinkEstimateSuccess = () => {
    setShowLinkEstimateModal(false);
    fetchOrderDetails();
    onOrderUpdated();
  };

  // Invoice Actions
  const handleInvoiceAction = async (action: string) => {
    if (!orderDetails) return;

    // Handle cash job estimate actions
    if (action === 'create_estimate' || action === 'update_estimate' || action === 'send_estimate' || action === 'view_estimate' || action === 'review_changes') {
      await handleEstimateAction(action as 'create_estimate' | 'update_estimate' | 'send_estimate' | 'view_estimate' | 'review_changes');
      return;
    }

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

  // Auto-open send modal after invoice/estimate creation
  const handleInvoiceCreated = async () => {
    setShowInvoiceModal(false);
    await fetchOrderDetails();
    setInvoiceModalMode('send');
    setShowInvoiceModal(true);
  };

  // Auto-open send modal after estimate creation (cash jobs)
  const handleEstimateCreated = async () => {
    setShowCreateEstimateModal(false);
    await fetchOrderDetails();
    setEstimateActionMode('send');
    setShowEstimateActionModal(true);
  };

  const handleConflictResolved = () => {
    setShowConflictModal(false);
    setConflictDifferences([]);
    fetchOrderDetails();
    onOrderUpdated();
  };

  const handleLinkInvoiceSuccess = () => {
    setShowLinkInvoiceModal(false);
    setReassignInvoiceInfo(null);
    fetchOrderDetails();
    onOrderUpdated();
  };

  // Get estimate button state for cash jobs
  const getEstimateButtonState = () => {
    if (!orderDetails) return null;

    const hasEstimate = !!orderDetails.qb_estimate_id;
    const sentAt = orderDetails.invoice_sent_at;

    // No estimate exists yet - show Create button
    if (!hasEstimate) {
      return {
        action: 'create_estimate',
        label: 'Create Estimate',
        icon: <FileText className="w-4 h-4" />,
        colorClass: 'bg-green-600 hover:bg-green-700 text-white',
        showLinkOption: true  // Show dropdown with "Link Existing Estimate"
      };
    }

    // Check sync status for conflict/qb_modified
    if (estimateSyncStatus === 'conflict' || estimateSyncStatus === 'qb_modified') {
      return {
        action: 'review_changes',
        label: 'Review Changes',
        icon: <AlertOctagon className="w-4 h-4" />,
        colorClass: estimateSyncStatus === 'conflict' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
      };
    }

    // Estimate exists and is stale (local_stale) - show Recreate button (orange)
    if (estimateIsStale || estimateSyncStatus === 'local_stale') {
      return {
        action: 'update_estimate',
        label: 'Recreate Estimate',
        icon: <RefreshCw className="w-4 h-4" />,
        colorClass: 'bg-orange-500 hover:bg-orange-600 text-white'
      };
    }

    // Estimate exists, in sync + already sent - show View button (gray)
    if (sentAt) {
      return {
        action: 'view_estimate',
        label: 'View Estimate',
        icon: <Eye className="w-4 h-4" />,
        colorClass: 'bg-gray-600 hover:bg-gray-700 text-white'
      };
    }

    // Estimate exists, in sync, not sent - show Send button (blue)
    return {
      action: 'send_estimate',
      label: 'Send Estimate',
      icon: <Send className="w-4 h-4" />,
      colorClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    };
  };

  // Get invoice button state
  const getInvoiceButtonState = () => {
    if (!orderDetails) return null;

    // Cash jobs use estimate buttons instead of invoice buttons
    if (orderDetails.cash) {
      return getEstimateButtonState();
    }

    const hasInvoice = !!orderDetails.qb_invoice_id;
    const invoiceSent = !!orderDetails.invoice_sent_at;

    if (!hasInvoice) {
      // Show Create Invoice for:
      // 1. Deposit-required orders (any workflow status)
      // 2. Non-deposit orders in qc_packing/shipping/pick_up/awaiting_payment (for final invoice)
      const needsInvoice = ['qc_packing', 'shipping', 'pick_up', 'awaiting_payment'].includes(orderDetails.status);
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
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile
          ? 'overflow-y-auto' // Mobile: entire modal scrolls
          : 'flex items-center justify-center' // Desktop: centered, no scroll
      } p-2 md:p-4`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      {/* Main content - hidden on mobile when child modal is open */}
      <div
        ref={modalContentRef}
        className={`${
          isMobile
            ? 'flex flex-col gap-2 w-full' // Mobile: full width, no max-height, expands
            : 'flex flex-row gap-4 items-start max-h-[85vh] w-auto' // Desktop: side by side
        } ${isMobile && hasChildModalOpen ? 'hidden' : ''}`}
      >
        {/* Image Panel - sized to fit image */}
        <div ref={imagePanelRef} className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl overflow-hidden flex-shrink-0 w-full md:w-auto`}>
          {/* Header */}
          <div className={`px-3 md:px-4 py-2 md:py-3 border-b ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background}`}>
            <div className="flex items-start justify-between gap-2 md:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-bold ${PAGE_STYLES.panel.text}`}>{order.order_name}</h2>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    orderDetails?.shipping_required
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
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
                className={`p-2 md:p-1 ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 active:bg-gray-100 rounded flex-shrink-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center`}
              >
                <X className="w-6 h-6 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={order.order_name}
              className="block w-full md:w-[560px] md:max-h-[369px] object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center bg-gray-100 w-full md:w-[280px] h-[120px] md:h-[200px]">
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
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-sm ${PAGE_STYLES.panel.text}`}>
                        {orderDetails?.due_date ? (
                          new Date(orderDetails.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        ) : (
                          <span className={PAGE_STYLES.panel.textMuted}>Not set</span>
                        )}
                      </span>
                      {orderDetails?.hard_due_date_time && (
                        <span className="text-sm text-red-600 font-medium">
                          {(() => {
                            const [hours] = orderDetails.hard_due_date_time.split(':').map(Number);
                            const period = hours >= 12 ? 'PM' : 'AM';
                            const displayHour = hours % 12 || 12;
                            return `${displayHour} ${period}`;
                          })()}
                        </span>
                      )}
                    </div>
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
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/orders/${order.order_number}`}
                className={`flex-1 min-w-[45%] md:min-w-0 flex items-center justify-center gap-1.5 px-3 py-3 md:py-2 ${MODULE_COLORS.orders.base} text-white ${MODULE_COLORS.orders.hover} active:opacity-80 transition-colors text-sm font-medium rounded min-h-[44px]`}
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden md:inline">Go to Order</span>
                <span className="md:hidden">Order</span>
              </Link>
              <div className="relative flex-1 min-w-[45%] md:min-w-0" ref={folderDropdownRef}>
                <button
                  onClick={() => {
                    if (orderDetails?.folder_name && orderDetails.folder_location !== 'none') {
                      setShowFolderDropdown(!showFolderDropdown);
                    }
                  }}
                  disabled={!orderDetails?.folder_name || orderDetails.folder_location === 'none'}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-3 md:py-2 rounded text-sm font-medium transition-colors min-h-[44px]
                    ${orderDetails?.folder_name && orderDetails.folder_location !== 'none'
                      ? `${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} ${PAGE_STYLES.interactive.hover} active:bg-gray-200`
                      : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                    }
                  `}
                >
                  <FolderOpen className="w-4 h-4" />
                  Folder
                  <ChevronDown className={`w-3 h-3 transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showFolderDropdown && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[70] min-w-[170px]">
                    <button
                      onClick={() => { setShowFolderDropdown(false); handleOpenFolder('new'); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 rounded-t-lg"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Order Folder
                    </button>
                    <button
                      onClick={() => { setShowFolderDropdown(false); handleOpenFolder('legacy'); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 rounded-b-lg"
                    >
                      <FolderOpen className="w-4 h-4 text-gray-400" />
                      Legacy Folder
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowPdfViewerModal(true)}
                disabled={!orderDetails?.folder_name}
                className={`flex-1 min-w-[45%] md:min-w-0 flex items-center justify-center gap-1.5 px-3 py-3 md:py-2 rounded text-sm font-medium transition-colors min-h-[44px]
                  ${orderDetails?.folder_name
                    ? `${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} ${PAGE_STYLES.interactive.hover} active:bg-gray-200`
                    : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                  }
                `}
              >
                <Eye className="w-4 h-4" />
                PDFs
              </button>
              {!orderDetails?.internal_note && (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className={`flex-1 min-w-[45%] md:min-w-0 flex items-center justify-center gap-1.5 px-3 py-3 md:py-2 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.text} rounded ${PAGE_STYLES.interactive.hover} active:bg-gray-200 transition-colors text-sm font-medium min-h-[44px]`}
                >
                  <FileText className="w-4 h-4" />
                  Note
                </button>
              )}
            </div>

            {/* Smart Actions */}
            <div className={`pt-3 border-t ${PAGE_STYLES.panel.border}`}>
              <h3 className={`text-sm md:text-base font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                Workflow
              </h3>
              <div className="flex flex-wrap gap-2 [&>button]:min-h-[44px] [&>button]:py-3 md:[&>button]:py-2">
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

                {/* Invoice/Estimate Button - excludes setup/confirmation and final statuses */}
                {orderDetails && !['job_details_setup', 'pending_confirmation', 'completed', 'cancelled', 'on_hold'].includes(orderDetails.status) && (() => {
                  const invoiceState = getInvoiceButtonState();
                  if (!invoiceState) return null;

                  // For cash jobs with "Create Estimate" - show button with dropdown
                  if (orderDetails.cash && invoiceState.action === 'create_estimate') {
                    return (
                      <div className="relative inline-flex">
                        <button
                          onClick={() => handleInvoiceAction(invoiceState.action)}
                          disabled={actionLoading}
                          className={`flex items-center gap-1.5 px-3 py-2 ${invoiceState.colorClass} rounded-l text-sm font-medium transition-colors disabled:opacity-50`}
                        >
                          {invoiceState.icon}
                          {invoiceState.label}
                        </button>
                        <button
                          onClick={() => setShowEstimateDropdown(!showEstimateDropdown)}
                          disabled={actionLoading}
                          className={`flex items-center px-2 py-2 ${invoiceState.colorClass} rounded-r border-l border-green-700 text-sm font-medium transition-colors disabled:opacity-50`}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${showEstimateDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Cash badge */}
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-400 text-yellow-900 rounded">
                          CASH
                        </span>

                        {/* Dropdown menu */}
                        {showEstimateDropdown && (
                          <>
                            <div
                              className="fixed inset-0 z-[60]"
                              onClick={() => setShowEstimateDropdown(false)}
                            />
                            <div className={`absolute top-full left-0 mt-1 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg shadow-lg z-[70] min-w-[180px]`}>
                              <button
                                onClick={() => {
                                  setShowEstimateDropdown(false);
                                  setShowLinkEstimateModal(true);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm ${PAGE_STYLES.interactive.hover} rounded-lg`}
                              >
                                Link Existing Estimate
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }

                  // Regular button for all other cases
                  return (
                    <div className="relative inline-flex">
                      <button
                        onClick={() => handleInvoiceAction(invoiceState.action)}
                        disabled={actionLoading}
                        className={`flex items-center gap-1.5 px-3 py-2 ${invoiceState.colorClass} rounded text-sm font-medium transition-colors disabled:opacity-50`}
                      >
                        {invoiceState.icon}
                        {invoiceState.label}
                      </button>
                      {/* Cash badge for cash jobs */}
                      {!!orderDetails.cash && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-400 text-yellow-900 rounded">
                          CASH
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Record Payment - Cash jobs only */}
                {orderDetails && !!orderDetails.cash && !['job_details_setup', 'pending_confirmation'].includes(orderDetails.status) && (
                  <button
                    onClick={() => setShowCashPaymentModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Panel */}
        <div ref={tasksPanelRef} className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full md:w-[480px] ${
          isMobile ? '' : 'flex-none max-h-[85vh] flex flex-col overflow-hidden'
        }`}>
          {/* Content */}
          <div className={`p-4 ${isMobile ? '' : 'flex-1 overflow-y-auto'}`}>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className={`w-8 h-8 animate-spin ${PAGE_STYLES.panel.textMuted}`} />
              </div>
            ) : (
              <div>
                  <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wide mb-2`}>
                    Tasks
                  </h3>
                  {parts.filter(p => (p.is_parent && p.specs_display_name?.trim()) || p.is_order_wide).length === 0 && (!orderDetails?.jobLevelTasks || orderDetails.jobLevelTasks.length === 0) ? (
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>No parts found</p>
                  ) : (
                    <div className="space-y-4">
                      {parts.filter(p => (p.is_parent && p.specs_display_name?.trim()) || p.is_order_wide).map((part, idx) => {
                        // For order-wide parts, append job-level tasks at the end
                        const partTasks = part.tasks || [];
                        const jobLevelTasks = part.is_order_wide && orderDetails?.jobLevelTasks ? orderDetails.jobLevelTasks : [];
                        const allTasks = [...partTasks, ...jobLevelTasks];
                        const hasTasks = allTasks.length > 0;

                        return (
                        <div key={part.part_id} className={`border ${PAGE_STYLES.panel.border} rounded-lg`}>
                          <div className={`px-3 py-2 ${PAGE_STYLES.page.background} border-b ${PAGE_STYLES.panel.border} rounded-t-lg`}>
                            <span className={`text-sm font-medium ${PAGE_STYLES.header.text}`}>
                              {part.is_order_wide ? 'Order-wide' : `Part ${idx + 1}: ${part.product_type}${part.part_scope ? ` - ${part.part_scope}` : ''}`}
                            </span>
                          </div>
                          <div className="p-2">
                            {!hasTasks ? (
                              <p className={`text-xs ${PAGE_STYLES.panel.textMuted} px-2 py-1`}>No tasks</p>
                            ) : (
                              <div className="space-y-0">
                                {sortTasks(allTasks).map(task => (
                                  <TaskRow
                                    key={task.task_id}
                                    task={task}
                                    onStart={() => handleTaskStart(task.task_id)}
                                    onComplete={() => handleTaskComplete(task.task_id)}
                                    onUncomplete={() => handleTaskUncomplete(task.task_id)}
                                    onUnstart={() => handleTaskUnstart(task.task_id)}
                                    onNotesChange={(notes) => handleTaskNotesChange(task.task_id, notes)}
                                    onRemove={() => handleRemoveTask(task.task_id)}
                                    isManager={isManager}
                                    onOpenSessionsModal={isManager ? handleOpenSessionsModal : undefined}
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
                      );
                      })}

                      {/* Show Order-wide section for job-level tasks if no order-wide part exists */}
                      {!parts.some(p => p.is_order_wide) && orderDetails?.jobLevelTasks && orderDetails.jobLevelTasks.length > 0 && (
                        <div className={`border ${PAGE_STYLES.panel.border} rounded-lg`}>
                          <div className={`px-3 py-2 ${PAGE_STYLES.page.background} border-b ${PAGE_STYLES.panel.border} rounded-t-lg`}>
                            <span className={`text-sm font-medium ${PAGE_STYLES.header.text}`}>
                              Order-wide
                            </span>
                          </div>
                          <div className="p-2">
                            <div className="space-y-0">
                              {sortTasks(orderDetails.jobLevelTasks).map(task => (
                                <TaskRow
                                  key={task.task_id}
                                  task={task}
                                  onStart={() => handleTaskStart(task.task_id)}
                                  onComplete={() => handleTaskComplete(task.task_id)}
                                  onUncomplete={() => handleTaskUncomplete(task.task_id)}
                                  onUnstart={() => handleTaskUnstart(task.task_id)}
                                  onNotesChange={(notes) => handleTaskNotesChange(task.task_id, notes)}
                                  onRemove={() => handleRemoveTask(task.task_id)}
                                  isManager={isManager}
                                  onOpenSessionsModal={isManager ? handleOpenSessionsModal : undefined}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
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
          onDataChanged={fetchOrderDetails}
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

      {/* AI File Validation Modal */}
      {orderDetails && (
        <AiFileValidationModal
          isOpen={showAiValidationModal}
          onClose={() => setShowAiValidationModal(false)}
          orderNumber={orderDetails.order_number}
          onApproveComplete={handleAiValidationComplete}
          onSkipValidation={handleSkipAiValidation}
        />
      )}

      {/* Invoice Action Modal - Using unified DocumentActionModal */}
      {showInvoiceModal && orderDetails && (
        <DocumentActionModal
          documentType="invoice"
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          order={orderDetails}
          mode={invoiceModalMode}
          onSuccess={handleInvoiceSuccess}
          onCreated={invoiceModalMode === 'create' ? handleInvoiceCreated : undefined}
          onLinkExisting={() => {
            setShowInvoiceModal(false);
            setShowLinkInvoiceModal(true);
          }}
          onReassign={(isDeleted) => {
            setShowInvoiceModal(false);
            setReassignInvoiceInfo({
              invoiceId: orderDetails.qb_invoice_id || null,
              invoiceNumber: orderDetails.qb_invoice_doc_number || null,
              isDeleted
            });
            setShowLinkInvoiceModal(true);
          }}
          taxRules={taxRules}
        />
      )}

      {/* Invoice Conflict Modal - Using unified DocumentConflictModal */}
      {showConflictModal && orderDetails && (
        <DocumentConflictModal
          documentType="invoice"
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          orderNumber={orderDetails.order_number}
          orderName={orderDetails.order_name}
          syncStatus={conflictStatus}
          differences={conflictDifferences}
          onResolved={handleConflictResolved}
        />
      )}

      {/* Link Invoice Modal - Using unified LinkDocumentModal */}
      {showLinkInvoiceModal && orderDetails && (
        <LinkDocumentModal
          documentType="invoice"
          isOpen={showLinkInvoiceModal}
          onClose={() => {
            setShowLinkInvoiceModal(false);
            setReassignInvoiceInfo(null);
          }}
          orderNumber={orderDetails.order_number}
          onSuccess={handleLinkInvoiceSuccess}
          currentDocument={reassignInvoiceInfo ? {
            documentId: reassignInvoiceInfo.invoiceId,
            documentNumber: reassignInvoiceInfo.invoiceNumber
          } : undefined}
          documentStatus={reassignInvoiceInfo?.isDeleted ? 'not_found' : (reassignInvoiceInfo ? 'exists' : 'not_linked')}
          orderTotals={orderTotals}
        />
      )}

      {/* Estimate Conflict Modal (Cash Jobs) - Using unified DocumentConflictModal */}
      {showEstimateConflictModal && orderDetails && (
        <DocumentConflictModal
          documentType="estimate"
          isOpen={showEstimateConflictModal}
          onClose={() => setShowEstimateConflictModal(false)}
          orderNumber={orderDetails.order_number}
          orderName={orderDetails.order_name}
          syncStatus={estimateSyncStatus}
          differences={estimateDifferences}
          onResolved={handleEstimateConflictResolved}
        />
      )}

      {/* Link Estimate Modal (Cash Jobs) - Using unified LinkDocumentModal */}
      {showLinkEstimateModal && orderDetails && (
        <LinkDocumentModal
          documentType="estimate"
          isOpen={showLinkEstimateModal}
          onClose={() => {
            setShowLinkEstimateModal(false);
            setReassignEstimateInfo(null);
          }}
          orderNumber={orderDetails.order_number}
          onSuccess={() => {
            handleLinkEstimateSuccess();
            setReassignEstimateInfo(null);
          }}
          currentDocument={reassignEstimateInfo ? {
            documentId: reassignEstimateInfo.estimateId,
            documentNumber: reassignEstimateInfo.estimateNumber,
          } : (orderDetails.qb_estimate_id ? {
            documentId: orderDetails.qb_estimate_id,
            documentNumber: orderDetails.qb_estimate_doc_number || null,
          } : undefined)}
          documentStatus={reassignEstimateInfo?.isDeleted ? 'not_found' : (reassignEstimateInfo ? 'exists' : 'not_linked')}
        />
      )}

      {/* Create Estimate Modal (Cash Jobs) - Using unified DocumentActionModal */}
      {showCreateEstimateModal && orderDetails && (
        <DocumentActionModal
          documentType="estimate"
          mode="create"
          isOpen={showCreateEstimateModal}
          onClose={() => setShowCreateEstimateModal(false)}
          order={orderDetails}
          onSuccess={() => {
            setShowCreateEstimateModal(false);
            fetchOrderDetails();
            onOrderUpdated();
          }}
          onCreated={handleEstimateCreated}
          onLinkExisting={() => {
            setShowCreateEstimateModal(false);
            setShowLinkEstimateModal(true);
          }}
        />
      )}

      {/* Estimate Action Modal (Cash Jobs - Send/View) - Using unified DocumentActionModal */}
      {showEstimateActionModal && orderDetails && (
        <DocumentActionModal
          documentType="estimate"
          mode={estimateActionMode}
          isOpen={showEstimateActionModal}
          onClose={() => setShowEstimateActionModal(false)}
          order={orderDetails}
          onSuccess={() => {
            setShowEstimateActionModal(false);
            fetchOrderDetails();
            onOrderUpdated();
          }}
          onReassign={(isDeleted) => {
            setShowEstimateActionModal(false);
            setReassignEstimateInfo({
              estimateId: orderDetails!.qb_estimate_id || null,
              estimateNumber: orderDetails!.qb_estimate_doc_number || null,
              isDeleted,
            });
            setShowLinkEstimateModal(true);
          }}
          onLinkExisting={() => {
            setShowEstimateActionModal(false);
            setShowLinkEstimateModal(true);
          }}
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
          onPrintAndApprove={handlePrintAndApproveWithClose}
          onApproveWithoutPrinting={handleApproveWithoutPrintingWithClose}
          order={orderDetails}
          defaultConfig={defaultPrintConfig}
          shopRoles={shopRoles}
        />
      )}

      {/* Material Requirements Confirmation Modal */}
      {showMaterialRequirementsModal && orderDetails && (
        <MaterialRequirementsConfirmationModal
          isOpen={showMaterialRequirementsModal}
          onClose={() => {
            setShowMaterialRequirementsModal(false);
            setPendingPrintResult(null);
          }}
          orderId={orderDetails.order_id}
          orderNumber={orderDetails.order_number}
          orderName={orderDetails.order_name}
          onConfirm={handleMaterialsConfirmed}
          order={orderDetails}
        />
      )}

      {/* PDF Viewer Modal */}
      {showPdfViewerModal && orderDetails && (
        <PDFViewerModal
          isOpen={showPdfViewerModal}
          onClose={() => setShowPdfViewerModal(false)}
          order={orderDetails}
        />
      )}

      {/* Cash Payment Modal (Cash Jobs) */}
      {showCashPaymentModal && orderDetails && (
        <CashPaymentModal
          isOpen={showCashPaymentModal}
          onClose={() => setShowCashPaymentModal(false)}
          orderId={orderDetails.order_id}
          orderNumber={orderDetails.order_number}
          onSuccess={() => {
            fetchOrderDetails();
            onOrderUpdated();
          }}
        />
      )}

      {/* Sessions Modal for managers */}
      {sessionsModalTask && currentUserId && (
        <SessionsModal
          taskId={sessionsModalTask.taskId}
          taskRole={sessionsModalTask.taskRole}
          isOpen={true}
          onClose={handleCloseSessionsModal}
          currentUserId={currentUserId}
          isManager={isManager}
          onSessionChange={handleSessionChange}
          taskCompleted={orderDetails?.parts?.flatMap(p => p.tasks || []).find(t => t.task_id === sessionsModalTask.taskId)?.completed}
          onComplete={(taskId) => handleTaskComplete(taskId)}
        />
      )}
    </div>
  );
};

export default OrderQuickModal;
