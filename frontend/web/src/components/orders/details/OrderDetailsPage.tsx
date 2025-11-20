import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProgressView from '../progress/ProgressView';
import DualTableLayout from './DualTableLayout';
import OrderImage from '../common/OrderImage';

// Import the new custom hooks
import { useOrderDetails } from './hooks/useOrderDetails';
import { useEditableFields } from './hooks/useEditableFields';
import { useOrderPrinting } from './hooks/useOrderPrinting';
import { useOrderCalculations } from './hooks/useOrderCalculations';

// Import API
import { ordersApi } from '../../../services/api';

// Import field configuration
import { FIELD_CONFIGS, getFieldConfig } from './constants/orderFieldConfigs';

// Import components
import EditableField from './components/EditableField';
import OrderHeader from './components/OrderHeader';
import PrintFormsWithPreview from './components/PrintFormsWithPreview';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import TaxDropdown from './components/TaxDropdown';
import PrepareOrderModal from '../preparation/PrepareOrderModal';

export const OrderDetailsPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Phase 1.5.c.6.1: Prepare Order Modal State
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);

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
    scrollContainerRef
  );

  const {
    printConfig,
    setPrintConfig,
    handleOpenPrintModal,
    handleClosePrintModal,
    handlePrintForms,
    handlePrintMasterEstimate,
    handlePrintShopPacking,
    handleGenerateForms,
    handlePrintMasterForm,
    formUrls
  } = useOrderPrinting(orderData, setUiState);

  const {
    recalculate
  } = useOrderCalculations(orderData.order, setCalculatedValues);

  // Get scroll preservation refs from editableFields hook
  const { savedScrollPosition, isSavingRef } = getScrollPreservationRefs();

  // Memoized callback for parts updates to prevent unnecessary re-renders
  const handlePartsChange = useCallback((updatedParts: typeof orderData.parts) => {
    setOrderData(prev => ({ ...prev, parts: updatedParts }));
  }, [setOrderData]);

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

  if (uiState.initialLoad) {
    return <LoadingState />;
  }

  if (uiState.error || !orderData.order) {
    return <ErrorState error={uiState.error} />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Tabs */}
      <OrderHeader
        order={orderData.order}
        activeTab={uiState.activeTab}
        onTabChange={(tab) => setUiState(prev => ({ ...prev, activeTab: tab }))}
        onGenerateForms={handleGenerateForms}
        onOpenPrint={handleOpenPrintModal}
        onOpenFolder={handleOpenFolder}
        onPrepareOrder={handlePrepareOrder}
        generatingForms={uiState.generatingForms}
        printingForm={uiState.printingForm}
      />

      {/* Main Content: Tabbed Layout */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="px-4 py-4 h-full">
          {/* TAB 1: Specs & Invoice - Full Width */}
          {uiState.activeTab === 'specs' && (
            <div className="flex flex-col gap-4 h-full">
              {/* Top Row: Order Info (Left) and Invoice Info (Right) */}
              <div className="flex gap-4">
                {/* Left: Order Info Panel - Narrower */}
                <div className="flex-shrink-0 bg-white rounded-lg shadow p-4 flex gap-6" style={{ width: '1123px', minHeight: '240px', maxHeight: '250px' }}>
                {/* Left: Order Image - 32% of panel width */}
                <div style={{ width: '32%' }}>
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

                {/* Right: Order Details - 68% of panel width */}
                <div className="flex flex-col gap-4" style={{ width: '68%' }}>
                  {/* Row 1: Order Date, Customer PO, Customer Job #, Shipping Method */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Order Date:</span>
                      <p className="font-medium text-gray-900 text-base">
                        {FIELD_CONFIGS.due_date.displayFormatter(orderData.order.order_date)}
                      </p>
                    </div>

                    {/* Customer PO - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.customer_po.label}:</span>
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
                      />
                    </div>

                    {/* Customer Job # - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Customer Job #:</span>
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
                      />
                    </div>

                    {/* Shipping Method - Dropdown (uses shipping_required boolean) */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.shipping_required.label}:</span>
                      <EditableField
                        field="shipping_required"
                        value={orderData.order.shipping_required}
                        type={FIELD_CONFIGS.shipping_required.type}
                        options={FIELD_CONFIGS.shipping_required.options}
                        isEditing={editState.editingField === 'shipping_required'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        displayFormatter={FIELD_CONFIGS.shipping_required.displayFormatter}
                      />
                    </div>
                  </div>

                  {/* Row 2: Due Date, Hard Due Time, Turnaround Time, Due In */}
                  <div className="flex gap-4 items-end">
                    {/* Due Date - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.due_date.label}:</span>
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
                      />
                    </div>

                    {/* Hard Due Time - Editable */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{FIELD_CONFIGS.hard_due_date_time.label}:</span>
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
                      />
                    </div>

                    {/* Turnaround Time */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Turnaround Time:</span>
                      <p className="font-medium text-gray-900 text-base h-6 flex items-center">
                        {calculatedValues.turnaroundDays !== null ? `${calculatedValues.turnaroundDays} days` : 'Calculating...'}
                      </p>
                    </div>

                    {/* Due In */}
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">Due in:</span>
                      <p className="font-medium text-gray-900 text-base h-6 flex items-center">
                        {calculatedValues.daysUntilDue !== null ? `${calculatedValues.daysUntilDue} days` : 'Calculating...'}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Special Instructions & Internal Notes - Side by Side */}
                  <div className="mt-2 flex gap-4">
                    {/* Special Instructions */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Special Instructions</h3>
                      <EditableField
                        field="manufacturing_note"
                        value={orderData.order.manufacturing_note}
                        type="textarea"
                        height="60px"
                        placeholder="Enter special manufacturing instructions..."
                        isEditing={editState.editingField === 'manufacturing_note'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>

                    {/* Internal Notes */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Internal Notes</h3>
                      <EditableField
                        field="internal_note"
                        value={orderData.order.internal_note}
                        type="textarea"
                        height="60px"
                        placeholder="Enter internal notes..."
                        isEditing={editState.editingField === 'internal_note'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

                {/* Right: Contact & Invoice Details Panel */}
                <div className="flex-shrink-0 bg-white rounded-lg shadow p-4" style={{ width: '749px', minHeight: '240px', maxHeight: '250px' }}>
                  <div className="h-full flex flex-col gap-4">
                    {/* Top Section: Point Persons, Accounting Email, Terms */}
                    <div className="flex gap-4">
                      {/* Point Persons - Display only, flex-2 (managed via order_point_persons table) */}
                      <div className="flex-[2]">
                        <span className="text-gray-500 text-sm">Point Person(s):</span>
                        <p className="font-medium text-gray-900 text-base">
                          {orderData.order.point_persons && orderData.order.point_persons.length > 0
                            ? orderData.order.point_persons.map(person => person.contact_email).join(', ')
                            : '-'}
                        </p>
                      </div>

                      {/* Accounting Email - Editable (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Accounting Email:</span>
                        <EditableField
                          field="invoice_email"
                          value={orderData.order.invoice_email}
                          type="email"
                          isEditing={editState.editingField === 'invoice_email'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>

                      {/* Terms - Editable (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Terms:</span>
                        <EditableField
                          field="terms"
                          value={orderData.order.terms}
                          type="text"
                          isEditing={editState.editingField === 'terms'}
                          isSaving={uiState.saving}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>
                    </div>

                    {/* Middle Section: Deposit Required, Cash, Discount, Tax */}
                    <div className="flex gap-4">

                      {/* Deposit Required - Checkbox (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Deposit Required:</span>
                        <EditableField
                          field="deposit_required"
                          value={orderData.order.deposit_required}
                          type="checkbox"
                          isEditing={false}
                          isSaving={uiState.saving}
                          onEdit={(field, value) => {
                            setEditState(prev => ({ ...prev, editingField: field }));
                            saveEdit(field, value);
                          }}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>

                      {/* Cash Job - Checkbox (from Customer) - Custom handler for tax override */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Cash Job:</span>
                        <EditableField
                          field="cash"
                          value={orderData.order.cash}
                          type="checkbox"
                          isEditing={false}
                          isSaving={uiState.saving}
                          onEdit={(field, value) => {
                            // Use custom handler that manages tax override
                            handleCashJobChange(value === 'true');
                          }}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          editValue={editState.editValue}
                          onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                        />
                      </div>

                      {/* Discount - Display Only (from Customer) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Discount:</span>
                        <div className="flex items-center h-6">
                          <p className="font-medium text-gray-900 text-base">
                            {orderData.customerDiscount && parseFloat(String(orderData.customerDiscount)) > 0
                              ? `${parseFloat(String(orderData.customerDiscount))}%`
                              : '-'}
                          </p>
                        </div>
                      </div>

                      {/* Tax - Editable Dropdown (from billing address) */}
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Tax:</span>
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

                    {/* Bottom Section: Invoice Notes - Editable (from Customer) */}
                    <div className="mt-2">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Invoice Notes</h3>
                      <EditableField
                        field="invoice_notes"
                        value={orderData.order.invoice_notes}
                        type="textarea"
                        height="60px"
                        placeholder="Enter invoice notes..."
                        isEditing={editState.editingField === 'invoice_notes'}
                        isSaving={uiState.saving}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        editValue={editState.editValue}
                        onEditValueChange={(value) => setEditState(prev => ({ ...prev, editValue: value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Job Details & Invoice (Dual-Table) - Full Width */}
              <div className="flex-shrink-0" style={{ width: '1888px' }}>
                <DualTableLayout
                  orderNumber={orderData.order.order_number}
                  initialParts={orderData.parts}
                  taxName={orderData.order.tax_name}
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
                  onOrderUpdated={() => refetch()}
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
      />

      {/* Prepare Order Modal - Phase 1.5.c.6.1 */}
      <PrepareOrderModal
        isOpen={isPrepareModalOpen}
        onClose={handleClosePrepareModal}
        order={orderData.order}
        onComplete={handlePreparationComplete}
      />
    </div>
  );
};

export default OrderDetailsPage;
