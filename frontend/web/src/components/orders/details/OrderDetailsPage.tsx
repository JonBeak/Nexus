import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProgressView from '../progress/ProgressView';
import DualTableLayout from './DualTableLayout';
import OrderImage from '../common/OrderImage';
import { PAGE_STYLES } from '../../../constants/moduleColors';

// Import the new custom hooks
import { useOrderDetails } from './hooks/useOrderDetails';
import { useEditableFields } from './hooks/useEditableFields';
import { useOrderPrinting } from './hooks/useOrderPrinting';
import { useOrderCalculations } from './hooks/useOrderCalculations';

// Import API
import { ordersApi, orderStatusApi, qbInvoiceApi, InvoiceSyncStatus, InvoiceDifference } from '../../../services/api';

// Import field configuration
import { FIELD_CONFIGS, getFieldConfig } from './constants/orderFieldConfigs';

// Import components
import EditableField from './components/EditableField';
import OrderHeader from './components/OrderHeader';
import PrintFormsWithPreview from './components/PrintFormsWithPreview';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import TaxDropdown from './components/TaxDropdown';
import PointPersonsEditor from './components/PointPersonsEditor';
import AccountingEmailsEditor from './components/AccountingEmailsEditor';
import PrepareOrderModal from '../preparation/PrepareOrderModal';
import ConfirmationModal from './components/ConfirmationModal';
import { InvoiceAction } from './components/InvoiceButton';
import InvoiceActionModal from '../modals/InvoiceActionModal';
import RecordPaymentModal from '../modals/RecordPaymentModal';
import LinkInvoiceModal from '../modals/LinkInvoiceModal';
import InvoiceConflictModal from '../modals/InvoiceConflictModal';

export const OrderDetailsPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Phase 1.5.c.6.1: Prepare Order Modal State
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);

  // Confirmation Modal States for Phase Transitions
  const [showCustomerApprovedModal, setShowCustomerApprovedModal] = useState(false);
  const [showFilesCreatedModal, setShowFilesCreatedModal] = useState(false);

  // Phase 2.e: Invoice Modal States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState<'create' | 'update' | 'send' | 'view'>('create');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLinkInvoiceModal, setShowLinkInvoiceModal] = useState(false);
  const [invoicePromptType, setInvoicePromptType] = useState<'deposit' | 'full' | 'send' | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);

  // State for reassign invoice modal (when invoice is deleted in QB)
  const [reassignInvoiceInfo, setReassignInvoiceInfo] = useState<{
    invoiceId: string | null;
    invoiceNumber: string | null;
  } | null>(null);

  // Phase 2: Bi-directional sync - Conflict Modal States
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictStatus, setConflictStatus] = useState<InvoiceSyncStatus>('in_sync');
  const [conflictDifferences, setConflictDifferences] = useState<InvoiceDifference[]>([]);
  const [deepCheckLoading, setDeepCheckLoading] = useState(false);

  // Order Name Editing State
  const [orderNameEditState, setOrderNameEditState] = useState({
    isEditing: false,
    editValue: '',
    error: null as string | null,
    isSaving: false
  });

  // Use the custom hooks
  const {
    orderData,
    setOrderData,
    uiState,
    setUiState,
    calculatedValues,
    setCalculatedValues,
    loading,
    error,
    refetch
  } = useOrderDetails(orderNumber);

  const {
    editState,
    setEditState,
    startEdit,
    cancelEdit,
    saveEdit,
    handleKeyDown,
    isEditing,
    getScrollPreservationRefs
  } = useEditableFields(
    orderData,
    setOrderData,
    uiState,
    setUiState,
    setCalculatedValues,
    scrollContainerRef,
    refetch
  );

  const {
    printConfig,
    setPrintConfig,
    printMode,
    handleOpenPrintModal,
    handleClosePrintModal,
    handlePrintForms,
    handlePrintMasterEstimate,
    handlePrintShopPacking,
    handlePrintAndMoveToProduction,
    handleMoveToProductionWithoutPrinting,
    handleGenerateForms,
    handlePrintMasterForm,
    formUrls
  } = useOrderPrinting(orderData, setUiState, refetch);

  const {
    recalculate
  } = useOrderCalculations(orderData.order, setCalculatedValues);

  // Get scroll preservation refs from editableFields hook
  const { savedScrollPosition, isSavingRef } = getScrollPreservationRefs();

  // Memoized callback for parts updates to prevent unnecessary re-renders
  const handlePartsChange = useCallback((updatedParts: typeof orderData.parts) => {
    setOrderData(prev => ({ ...prev, parts: updatedParts }));
  }, [setOrderData]);

  // Scroll-preserving refetch for progress tab updates
  const handleProgressRefetch = useCallback(async () => {
    // Save current scroll position
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;

    // Refetch data and wait for it to complete
    await refetch();

    // Restore scroll position after React re-renders from state update
    // Use multiple frames to ensure we catch the render
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollTop;
        }
      });
    });
  }, [refetch]);

  // Scroll preservation: Restore scroll position synchronously before each paint during save operations
  useLayoutEffect(() => {
    if (isSavingRef.current && savedScrollPosition.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollPosition.current;

      // Also schedule restoration after paint to catch any late renders
      requestAnimationFrame(() => {
        if (isSavingRef.current && savedScrollPosition.current !== null && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollPosition.current;
        }
      });
    }
  }, [orderData.order, editState.editingField, calculatedValues.turnaroundDays, calculatedValues.daysUntilDue, uiState.saving]);

  // Phase 1.5.c.6.1: Prepare Order Modal Handlers
  const handlePrepareOrder = () => {
    setIsPrepareModalOpen(true);
  };

  const handleClosePrepareModal = () => {
    setIsPrepareModalOpen(false);
  };

  const handlePreparationComplete = () => {
    setIsPrepareModalOpen(false);
    refetch(); // Reload order data to get updated status
  };

  // Phase Transition Handlers
  const handleCustomerApproved = () => {
    setShowCustomerApprovedModal(true);
  };

  const handleConfirmCustomerApproved = async () => {
    if (!orderData.order) return;

    const newStatus = 'pending_production_files_creation';
    setShowCustomerApprovedModal(false);

    // Check if invoice prompt is needed (deposit orders)
    const promptType = checkInvoicePromptTrigger(newStatus);
    if (promptType) {
      setInvoicePromptType(promptType);
      setPendingStatusChange(newStatus);
      setInvoiceModalMode(promptType === 'send' ? 'send' : 'create');
      setShowInvoiceModal(true);
      return;
    }

    // No prompt needed, proceed with status change
    try {
      setUiState(prev => ({ ...prev, saving: true }));
      await orderStatusApi.updateOrderStatus(
        orderData.order.order_number,
        newStatus,
        'Customer approved the estimate'
      );
      alert('Order status updated to Pending Files Creation');
      refetch();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  };

  const handleFilesCreated = () => {
    setShowFilesCreatedModal(true);
  };

  const handleConfirmFilesCreated = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, saving: true }));
      // TODO: Add validation to check if expected files exist based on specs
      await orderStatusApi.updateOrderStatus(
        orderData.order.order_number,
        'pending_production_files_approval',
        'Production files created and ready for approval'
      );
      setShowFilesCreatedModal(false);
      alert('Order status updated to Pending Files Approval');
      refetch();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  };

  const handleOpenPrintMasterEstimate = () => {
    handleOpenPrintModal('master_estimate');
  };

  const handleApproveFilesAndPrint = () => {
    handleOpenPrintModal('shop_packing_production');
  };

  // Phase 2.e: Invoice Action Handlers
  const handleInvoiceAction = async (action: InvoiceAction, differences?: InvoiceDifference[]) => {
    // If button already detected conflict/qb_modified, show conflict modal directly
    if ((action === 'qb_modified' || action === 'conflict') && differences) {
      setConflictStatus(action);
      setConflictDifferences(differences);
      setShowConflictModal(true);
      return;
    }

    // For existing invoices (not 'create'), do a deep check before showing modal
    if (action !== 'create' && orderData.order?.qb_invoice_id) {
      try {
        setDeepCheckLoading(true);
        const result = await qbInvoiceApi.compareWithQB(orderData.order.order_number);

        // Defensive check - if result is undefined, fall through to normal modal
        if (result && result.status) {
          // If QB was modified or there's a conflict, show conflict modal
          if (result.status === 'qb_modified' || result.status === 'conflict') {
            setConflictStatus(result.status);
            setConflictDifferences(result.differences || []);
            setShowConflictModal(true);
            return;
          }

          // If local is stale, switch to update mode
          if (result.status === 'local_stale') {
            setInvoiceModalMode('update');
            setShowInvoiceModal(true);
            return;
          }
        }
      } catch (error) {
        console.error('Deep check failed:', error);
        // Fall through to show normal modal on error
      } finally {
        setDeepCheckLoading(false);
      }
    }

    // All other cases: open the normal modal
    setInvoiceModalMode(action as 'create' | 'update' | 'send' | 'view');
    setShowInvoiceModal(true);
  };

  const handleInvoiceSuccess = () => {
    setShowInvoiceModal(false);
    refetch();
  };

  const handlePaymentSuccess = (newBalance: number) => {
    setShowPaymentModal(false);
    refetch();
  };

  const handleLinkInvoiceSuccess = () => {
    setShowLinkInvoiceModal(false);
    setReassignInvoiceInfo(null);
    refetch();
  };

  // Handler for invoice reassignment (when invoice is deleted in QB)
  const handleReassignInvoice = (currentInvoice: { invoiceId: string | null; invoiceNumber: string | null }) => {
    setReassignInvoiceInfo(currentInvoice);
    setShowLinkInvoiceModal(true);
  };

  // Handler for manually marking invoice as sent
  const handleMarkAsSent = async () => {
    if (!orderData.order) return;
    try {
      await qbInvoiceApi.markAsSent(orderData.order.order_number);
      refetch();
    } catch (error) {
      console.error('Failed to mark invoice as sent:', error);
    }
  };

  // Phase 2: Conflict resolution handler
  const handleConflictResolved = () => {
    setShowConflictModal(false);
    setConflictDifferences([]);
    refetch();
  };

  // Check if an invoice prompt should be shown during status change
  const checkInvoicePromptTrigger = (newStatus: string): 'deposit' | 'full' | 'send' | null => {
    if (!orderData.order) return null;

    const order = orderData.order;

    // Deposit orders moving from pending_confirmation to pending_files_creation
    if (order.deposit_required &&
        order.status === 'pending_confirmation' &&
        newStatus === 'pending_production_files_creation' &&
        !order.qb_invoice_id) {
      return 'deposit';
    }

    // Moving to QC & Packing without an invoice
    if (newStatus === 'qc_packing' && !order.qb_invoice_id) {
      return 'full';
    }

    // Moving to shipping/pickup/awaiting_payment with an unsent invoice
    if (['shipping', 'pick_up', 'awaiting_payment'].includes(newStatus) &&
        order.qb_invoice_id &&
        !order.invoice_sent_at) {
      return 'send';
    }

    return null;
  };

  // Handle skipping invoice during status change prompt
  const handleSkipInvoiceAndProceed = async () => {
    setShowInvoiceModal(false);
    setInvoicePromptType(null);

    if (pendingStatusChange) {
      // Proceed with the original status change
      await performStatusChange(pendingStatusChange);
      setPendingStatusChange(null);
    }
  };

  // Perform the actual status change
  const performStatusChange = async (newStatus: string) => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, saving: true }));
      await orderStatusApi.updateOrderStatus(
        orderData.order.order_number,
        newStatus,
        `Status updated to ${newStatus}`
      );
      refetch();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  };

  // Handle invoice success during status change prompt
  const handleInvoiceSuccessWithStatusChange = () => {
    setShowInvoiceModal(false);
    setInvoicePromptType(null);

    if (pendingStatusChange) {
      // Proceed with status change after invoice action
      performStatusChange(pendingStatusChange);
      setPendingStatusChange(null);
    } else {
      refetch();
    }
  };

  // Handle opening order folder in Windows Explorer
  const handleOpenFolder = () => {
    console.log('Order data:', {
      folder_name: orderData.order.folder_name,
      folder_location: orderData.order.folder_location,
      folder_exists: orderData.order.folder_exists
    });

    if (!orderData.order.folder_name || orderData.order.folder_location === 'none') {
      alert('No folder exists for this order');
      return;
    }

    // Construct UNC path based on folder location
    let folderPath = '\\\\192.168.2.85\\Channel Letter\\Orders\\';
    if (orderData.order.folder_location === 'finished') {
      folderPath += '1Finished\\';
    }
    folderPath += orderData.order.folder_name;

    console.log('Opening folder:', folderPath);
    console.log('Nexus URL:', `nexus://open?path=${encodeURIComponent(folderPath)}`);

    // Open folder using nexus:// protocol
    const nexusUrl = `nexus://open?path=${encodeURIComponent(folderPath)}`;
    window.location.href = nexusUrl;
  };

  // Order Name Edit Handlers
  const handleEditOrderName = () => {
    setOrderNameEditState({
      isEditing: true,
      editValue: orderData.order?.order_name || '',
      error: null,
      isSaving: false
    });
  };

  const handleCancelOrderNameEdit = () => {
    setOrderNameEditState({
      isEditing: false,
      editValue: '',
      error: null,
      isSaving: false
    });
  };

  const handleSaveOrderName = async () => {
    if (!orderData.order) return;

    const newName = orderNameEditState.editValue.trim();

    // Skip if unchanged
    if (newName === orderData.order.order_name) {
      handleCancelOrderNameEdit();
      return;
    }

    // Clear error and start saving
    setOrderNameEditState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      await ordersApi.updateOrder(orderData.order.order_number, {
        order_name: newName
      });

      // Success - refetch to get updated data (folder_name may have changed too)
      await refetch();
      handleCancelOrderNameEdit();
    } catch (err: any) {
      // Extract error message from API response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update order name';
      setOrderNameEditState(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage
      }));
    }
  };

  const handleOrderNameChange = (value: string) => {
    setOrderNameEditState(prev => ({ ...prev, editValue: value, error: null }));
  };

  // Handle Cash Job checkbox change with tax override logic
  const handleCashJobChange = async (newCashValue: boolean) => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, saving: true }));

      if (newCashValue) {
        // Checking Cash Job: Always save current tax, then set to "Out of Scope"
        const updatesData: any = {
          cash: true,
          tax_name: 'Out of Scope'
        };

        // Always save current tax as original (preserves manual changes)
        if (orderData.order.tax_name) {
          updatesData.original_tax_name = orderData.order.tax_name;
        }

        await ordersApi.updateOrder(orderData.order.order_number, updatesData);

        // Update local state
        setOrderData(prev => ({
          ...prev,
          order: {
            ...prev.order!,
            cash: true,
            tax_name: 'Out of Scope',
            original_tax_name: updatesData.original_tax_name
          }
        }));
      } else {
        // Unchecking Cash Job: Restore original tax
        let restoredTax = orderData.order.original_tax_name;

        // If no saved original tax, fetch from billing address
        if (!restoredTax) {
          restoredTax = await ordersApi.getCustomerTax(orderData.order.order_number);
        }

        await ordersApi.updateOrder(orderData.order.order_number, {
          cash: false,
          tax_name: restoredTax
        });

        // Update local state
        setOrderData(prev => ({
          ...prev,
          order: {
            ...prev.order!,
            cash: false,
            tax_name: restoredTax!
          }
        }));
      }
    } catch (err) {
      console.error('Error updating cash job:', err);
      alert('Failed to update cash job. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  };

  // Handler for saving point persons
  const handlePointPersonsSave = async (pointPersons: any[]) => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, saving: true }));

      // Transform point persons to API format
      const apiPointPersons = pointPersons.map(pp => ({
        contact_id: pp.contact_id,
        contact_email: pp.contact_email,
        contact_name: pp.contact_name,
        contact_phone: pp.contact_phone,
        contact_role: pp.contact_role,
        saveToDatabase: pp.saveToDatabase
      }));

      await ordersApi.updateOrderPointPersons(orderData.order.order_number, apiPointPersons);

      // Refresh order data after save
      await refetch();
    } catch (err) {
      console.error('Error updating point persons:', err);
      alert('Failed to update point persons. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  };

  // Handler for saving accounting emails
  const handleAccountingEmailsSave = async (accountingEmails: any[]) => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, saving: true }));

      // Transform accounting emails to API format
      const apiAccountingEmails = accountingEmails.map(ae => ({
        email: ae.email,
        email_type: ae.email_type,
        label: ae.label,
        saveToDatabase: ae.saveToDatabase
      }));

      await ordersApi.updateOrderAccountingEmails(orderData.order.order_number, apiAccountingEmails);

      // Refresh order data after save
      await refetch();
    } catch (err) {
      console.error('Error updating accounting emails:', err);
      alert('Failed to update accounting emails. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  };

  if (uiState.initialLoad) {
    return <LoadingState />;
  }

  if (uiState.error || !orderData.order) {
    return <ErrorState error={uiState.error} />;
  }

  return (
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Header with Tabs */}
      <OrderHeader
        order={orderData.order}
        activeTab={uiState.activeTab}
        onTabChange={(tab) => setUiState(prev => ({ ...prev, activeTab: tab }))}
        onGenerateForms={handleGenerateForms}
        onOpenPrint={() => handleOpenPrintModal()}
        onOpenPrintMasterEstimate={handleOpenPrintMasterEstimate}
        onOpenFolder={handleOpenFolder}
        onPrepareOrder={handlePrepareOrder}
        onCustomerApproved={handleCustomerApproved}
        onFilesCreated={handleFilesCreated}
        onApproveFilesAndPrint={handleApproveFilesAndPrint}
        onInvoiceAction={handleInvoiceAction}
        onLinkInvoice={() => setShowLinkInvoiceModal(true)}
        onReassignInvoice={handleReassignInvoice}
        onMarkAsSent={handleMarkAsSent}
        generatingForms={uiState.generatingForms}
        printingForm={uiState.printingForm}
        // Order name editing props
        isEditingOrderName={orderNameEditState.isEditing}
        orderNameEditValue={orderNameEditState.editValue}
        orderNameError={orderNameEditState.error}
        isSavingOrderName={orderNameEditState.isSaving}
        onEditOrderName={handleEditOrderName}
        onCancelOrderNameEdit={handleCancelOrderNameEdit}
        onSaveOrderName={handleSaveOrderName}
        onOrderNameChange={handleOrderNameChange}
      />

      {/* Main Content: Tabbed Layout */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto overflow-y-overlay">
        <div className="px-4 py-4 h-full">
          {/* TAB 1: Specs & Invoice - Full Width */}
          {uiState.activeTab === 'specs' && (
            <div className="flex flex-col gap-4 h-full">
              {/* Top Row: 4 Horizontal Panels - Image | Order Details | Notes | Contact/Invoice */}
              <div className="flex gap-4">
                {/* Panel 1: Order Image (no panel styling, just the image) */}
                <div className="flex-shrink-0" style={{ width: '420px', height: '280px' }}>
                  <OrderImage
                    orderNumber={orderData.order.order_number}
                    signImagePath={orderData.order.sign_image_path}
                    cropTop={orderData.order.crop_top}
                    cropRight={orderData.order.crop_right}
                    cropBottom={orderData.order.crop_bottom}
                    cropLeft={orderData.order.crop_left}
                    folderName={orderData.order.folder_name}
                    folderLocation={orderData.order.folder_location}
                    isMigrated={orderData.order.is_migrated}
                    onImageUpdated={() => refetch()}
                  />
                </div>

                {/* Panel 2: General Order Details */}
                <div className={`flex-shrink-0 ${PAGE_STYLES.composites.panelContainer} p-4`} style={{ width: '300px', height: '280px' }}>
                  <div className={`${PAGE_STYLES.composites.tableBody}`}>
                    {/* Order Date */}
                    <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Order Date</span>
                      <span className={`italic ${PAGE_STYLES.panel.text} text-sm pr-6`}>
                        {FIELD_CONFIGS.due_date.displayFormatter(orderData.order.order_date)}
                      </span>
                    </div>
                    {/* PO # */}
                    <div className="flex justify-between items-center py-1 px-1">
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>PO #</span>
                      <EditableField
                        field="customer_po"
                        value={orderData.order.customer_po}
                        type={FIELD_CONFIGS.customer_po.type}
                        isEditing={editState.editingField === 'customer_po'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        valueSize="sm"
                      />
                    </div>
                    {/* Job # */}
                    <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Job #</span>
                      <EditableField
                        field="customer_job_number"
                        value={orderData.order.customer_job_number}
                        type="text"
                        isEditing={editState.editingField === 'customer_job_number'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        valueSize="sm"
                      />
                    </div>
                    {/* Due Date */}
                    <div className="flex justify-between items-center py-1 px-1">
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Due Date</span>
                      <EditableField
                        field="due_date"
                        value={orderData.order.due_date}
                        type={FIELD_CONFIGS.due_date.type}
                        isEditing={editState.editingField === 'due_date'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.due_date.displayFormatter}
                        valueSize="sm"
                      />
                    </div>
                    {/* Hard Due Time */}
                    <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Hard Due Time</span>
                      <EditableField
                        field="hard_due_date_time"
                        value={orderData.order.hard_due_date_time}
                        type={FIELD_CONFIGS.hard_due_date_time.type}
                        isEditing={editState.editingField === 'hard_due_date_time'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.hard_due_date_time.displayFormatter}
                        valueSize="sm"
                      />
                    </div>
                    {/* Turnaround Time (calculated) */}
                    <div className="flex justify-between items-center py-1 px-1">
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Turnaround</span>
                      <span className={`italic ${PAGE_STYLES.panel.text} text-sm pr-6`}>
                        {calculatedValues.turnaroundDays !== null ? `${calculatedValues.turnaroundDays} days` : '-'}
                      </span>
                    </div>
                    {/* Due In (calculated) */}
                    <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Due In</span>
                      <span className={`italic ${PAGE_STYLES.panel.text} text-sm pr-6`}>
                        {calculatedValues.daysUntilDue !== null ? `${calculatedValues.daysUntilDue} days left` : '-'}
                      </span>
                    </div>
                    {/* Shipping */}
                    <div className="flex justify-between items-center py-1 px-1">
                      <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Shipping Method</span>
                      <EditableField
                        field="shipping_required"
                        value={orderData.order.shipping_required}
                        type={FIELD_CONFIGS.shipping_required.type}
                        options={[...FIELD_CONFIGS.shipping_required.options]}
                        isEditing={editState.editingField === 'shipping_required'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.shipping_required.displayFormatter}
                        valueSize="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Panel 3: Notes */}
                <div className={`flex-shrink-0 ${PAGE_STYLES.composites.panelContainer} p-4`} style={{ width: '360px', height: '280px' }}>
                  <div className="h-full flex flex-col gap-1">
                    {/* Special Instructions */}
                    <div className="flex-1">
                      <h3 className={`text-xs font-semibold ${PAGE_STYLES.header.text} mb-1`}>Special Instructions</h3>
                      <EditableField
                        field="manufacturing_note"
                        value={orderData.order.manufacturing_note}
                        type="textarea"
                        height="55px"
                        placeholder="Enter special manufacturing instructions..."
                        isEditing={editState.editingField === 'manufacturing_note'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        autoSave={true}
                        valueSize="sm"
                      />
                    </div>
                    {/* Internal Notes */}
                    <div className="flex-1">
                      <h3 className={`text-xs font-semibold ${PAGE_STYLES.header.text} mb-1`}>Internal Notes (Hidden)</h3>
                      <EditableField
                        field="internal_note"
                        value={orderData.order.internal_note}
                        type="textarea"
                        height="55px"
                        placeholder="Enter internal notes..."
                        isEditing={editState.editingField === 'internal_note'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        autoSave={true}
                        valueSize="sm"
                      />
                    </div>
                    {/* Invoice Notes */}
                    <div className="flex-1">
                      <h3 className={`text-xs font-semibold ${PAGE_STYLES.header.text} mb-1`}>Invoice Notes</h3>
                      <EditableField
                        field="invoice_notes"
                        value={orderData.order.invoice_notes}
                        type="textarea"
                        height="55px"
                        placeholder="Enter invoice notes..."
                        isEditing={editState.editingField === 'invoice_notes'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        autoSave={true}
                        valueSize="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Panel 4: Contact & Invoice Settings */}
                <div className={`flex-shrink-0 ${PAGE_STYLES.composites.panelContainer} p-4`} style={{ width: '700px', height: '280px' }}>
                  <div className="h-full flex gap-4">
                    {/* Left Column: Accounting Emails & Point Persons */}
                    <div className="overflow-y-auto" style={{ width: '470px' }}>
                      {/* Accounting Emails */}
                      <h3 className={`text-xs font-semibold ${PAGE_STYLES.header.text} mb-2`}>Accounting Emails</h3>
                      <AccountingEmailsEditor
                        customerId={orderData.order.customer_id}
                        orderId={orderData.order.order_id}
                        initialAccountingEmails={orderData.order.accounting_emails || []}
                        onSave={handleAccountingEmailsSave}
                        disabled={uiState.saving}
                      />
                      <h3 className={`text-xs font-semibold ${PAGE_STYLES.header.text} mb-2 border-t ${PAGE_STYLES.panel.border} pt-2 mt-3`}>Point Persons</h3>
                      <PointPersonsEditor
                        customerId={orderData.order.customer_id}
                        orderId={orderData.order.order_id}
                        initialPointPersons={orderData.order.point_persons || []}
                        onSave={handlePointPersonsSave}
                        disabled={uiState.saving}
                      />
                    </div>
                    {/* Right Column: Invoice Settings */}
                    <div className={`${PAGE_STYLES.composites.tableBody}`} style={{ width: '222px' }}>
                      {/* Terms */}
                      <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                        <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Terms</span>
                        <EditableField
                          field="terms"
                          value={orderData.order.terms}
                          type="select"
                          options={[
                            { value: 'Due on Receipt', label: 'Due on Receipt' },
                            { value: 'Net 30', label: 'Net 30' }
                          ]}
                          isEditing={editState.editingField === 'terms'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                          valueSize="sm"
                        />
                      </div>
                      {/* Deposit Required - Yes/No Dropdown */}
                      <div className="flex justify-between items-center py-1 px-1">
                        <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Deposit</span>
                        <EditableField
                          field="deposit_required"
                          value={orderData.order.deposit_required ? 'Yes' : 'No'}
                          type="select"
                          options={[
                            { value: 'Yes', label: 'Yes' },
                            { value: 'No', label: 'No' }
                          ]}
                          isEditing={editState.editingField === 'deposit_required'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={(field, value) => saveEdit(field, value === 'Yes' ? 'true' : 'false')}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                          valueSize="sm"
                        />
                      </div>
                      {/* Cash Job - Yes/No Dropdown */}
                      <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                        <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Cash Job</span>
                        <EditableField
                          field="cash"
                          value={orderData.order.cash ? 'Yes' : 'No'}
                          type="select"
                          options={[
                            { value: 'Yes', label: 'Yes' },
                            { value: 'No', label: 'No' }
                          ]}
                          isEditing={editState.editingField === 'cash'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={(field, value) => handleCashJobChange(value === 'Yes')}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                          valueSize="sm"
                        />
                      </div>
                      {/* Discount */}
                      <div className="flex justify-between items-center py-1 px-1">
                        <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Discount</span>
                        <span className={`italic ${PAGE_STYLES.panel.text} text-sm pr-6`}>
                          {orderData.customerDiscount && parseFloat(String(orderData.customerDiscount)) > 0
                            ? `${parseFloat(String(orderData.customerDiscount))}%`
                            : '-'}
                        </span>
                      </div>
                      {/* Tax */}
                      <div className={`flex justify-between items-center py-1 px-1 ${PAGE_STYLES.header.background}`}>
                        <span className={`${PAGE_STYLES.panel.textMuted} text-xs`}>Tax</span>
                        <TaxDropdown
                          currentTaxName={orderData.order.tax_name}
                          taxRules={orderData.taxRules}
                          isEditing={editState.editingField === 'tax_name'}
                          editValue={editState.editValue}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                          onKeyDown={handleKeyDown}
                          isSaving={uiState.saving}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Job Details & Invoice (Dual-Table) - Full Width */}
              <div style={{ width: '1871px' }}>
                <DualTableLayout
                  orderNumber={orderData.order.order_number}
                  initialParts={orderData.parts}
                  taxName={orderData.order.tax_name}
                  cash={orderData.order.cash}
                  estimateId={orderData.order.estimate_id}
                  onPartsChange={handlePartsChange}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Job Progress - 2/3 Width Centered */}
          {uiState.activeTab === 'progress' && (
            <div className="flex justify-center h-full">
              <div className="w-full max-w-[1280px]">
                <ProgressView
                  orderNumber={orderData.order.order_number}
                  currentStatus={orderData.order.status}
                  productionNotes={orderData.order.production_notes}
                  onOrderUpdated={handleProgressRefetch}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Modal with Preview */}
      <PrintFormsWithPreview
        isOpen={uiState.showPrintModal}
        onClose={handleClosePrintModal}
        printConfig={printConfig}
        onPrintConfigChange={setPrintConfig}
        onPrint={handlePrintForms}
        onPrintMasterEstimate={handlePrintMasterEstimate}
        onPrintShopPacking={handlePrintShopPacking}
        printing={uiState.printingForm}
        formUrls={formUrls}
        mode={printMode}
        onPrintAndMoveToProduction={handlePrintAndMoveToProduction}
        onMoveToProductionWithoutPrinting={handleMoveToProductionWithoutPrinting}
      />

      {/* Prepare Order Modal - Phase 1.5.c.6.1 */}
      <PrepareOrderModal
        isOpen={isPrepareModalOpen}
        onClose={handleClosePrepareModal}
        order={orderData.order}
        onComplete={handlePreparationComplete}
        onDataChanged={refetch}
      />

      {/* Confirmation Modals for Phase Transitions */}
      <ConfirmationModal
        isOpen={showCustomerApprovedModal}
        onClose={() => setShowCustomerApprovedModal(false)}
        onConfirm={handleConfirmCustomerApproved}
        title="Confirm Customer Approval"
        message="Are you sure the customer has approved this estimate? This will move the order to Pending Files Creation status."
        confirmText="Confirm Approval"
        confirmColor="green"
      />

      <ConfirmationModal
        isOpen={showFilesCreatedModal}
        onClose={() => setShowFilesCreatedModal(false)}
        onConfirm={handleConfirmFilesCreated}
        title="Confirm Files Created"
        message="Have all production files been created for this order? This will move the order to Pending Files Approval status."
        confirmText="Confirm Files Created"
        confirmColor="purple"
        warningNote="TODO: Add validation to check if expected files exist based on specs (AI files, vector files, etc.)"
      />

      {/* Phase 2.e: Invoice Modals */}
      <InvoiceActionModal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setInvoicePromptType(null);
          setPendingStatusChange(null);
          refetch(); // Re-check staleness after closing modal
        }}
        order={orderData.order}
        mode={invoiceModalMode}
        onSuccess={pendingStatusChange ? handleInvoiceSuccessWithStatusChange : handleInvoiceSuccess}
        onSkip={pendingStatusChange ? handleSkipInvoiceAndProceed : undefined}
        onReassign={() => {
          setShowInvoiceModal(false);
          handleReassignInvoice({
            invoiceId: orderData.order.qb_invoice_id || null,
            invoiceNumber: orderData.order.qb_invoice_doc_number || null
          });
        }}
        onLinkExisting={() => {
          setShowInvoiceModal(false);
          setShowLinkInvoiceModal(true);
        }}
      />

      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        orderNumber={orderData.order.order_number}
        onSuccess={handlePaymentSuccess}
      />

      <LinkInvoiceModal
        isOpen={showLinkInvoiceModal}
        onClose={() => {
          setShowLinkInvoiceModal(false);
          setReassignInvoiceInfo(null);
        }}
        orderNumber={orderData.order.order_number}
        onSuccess={handleLinkInvoiceSuccess}
        currentInvoice={reassignInvoiceInfo || undefined}
        invoiceStatus={reassignInvoiceInfo ? 'not_found' : 'not_linked'}
      />

      {/* Phase 2: Invoice Conflict Modal for bi-directional sync */}
      <InvoiceConflictModal
        isOpen={showConflictModal}
        onClose={() => {
          setShowConflictModal(false);
          setConflictDifferences([]);
        }}
        order={orderData.order}
        status={conflictStatus}
        differences={conflictDifferences}
        onResolved={handleConflictResolved}
      />
    </div>
  );
};

export default OrderDetailsPage;
