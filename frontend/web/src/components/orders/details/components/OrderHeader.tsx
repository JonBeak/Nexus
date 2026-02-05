import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, FolderOpen, Settings, CheckCircle, FileCheck, RefreshCw, Send, ChevronDown, Eye, AlertTriangle, AlertOctagon, Link, DollarSign } from 'lucide-react';
import { Order, DEPOSIT_TRACKING_STATUSES } from '../../../../types/orders';
import StatusBadge from '../../common/StatusBadge';
import InvoiceButton, { InvoiceAction } from './InvoiceButton';
import EditableOrderName from './EditableOrderName';
import { PAGE_STYLES, MODULE_COLORS } from '../../../../constants/moduleColors';

export type CashEstimateAction = 'create_estimate' | 'update_estimate' | 'send_estimate' | 'view_estimate' | 'review_changes';
export type EstimateSyncStatus = 'in_sync' | 'local_stale' | 'qb_modified' | 'conflict' | 'not_found' | 'error';

interface OrderHeaderProps {
  order: Order;
  activeTab: 'specs' | 'progress';
  onTabChange: (tab: 'specs' | 'progress') => void;
  onGenerateForms: () => void;
  onOpenPrint: () => void;
  onOpenPrintMasterEstimate: () => void;  // NEW: Print Master/Estimate only
  onOpenFolder: () => void;
  onPrepareOrder: () => void;
  onCustomerApproved: () => void;  // NEW: Customer approved transition
  onFilesCreated: () => void;  // NEW: Files created transition
  onApproveFilesAndPrint: () => void;  // NEW: Approve files and print
  onInvoiceAction: (action: InvoiceAction) => void;  // Phase 2.e: Invoice actions
  onLinkInvoice?: () => void;  // Phase 2.e: Link existing invoice
  onReassignInvoice?: (currentInvoice: { invoiceId: string | null; invoiceNumber: string | null; isDeleted: boolean }) => void;  // Reassign invoice (deleted or user choice)
  onMarkAsSent?: () => void;  // Mark invoice as sent manually
  // Cash job estimate actions
  onCashEstimateAction?: (action: CashEstimateAction) => void;
  onLinkEstimate?: () => void;  // Open Link Existing Estimate modal
  onSyncFromQB?: () => void;  // Sync QB estimate lines to order
  onRecordPayment?: () => void;  // Open Cash Payment modal
  estimateIsStale?: boolean;  // Whether the QB estimate is stale (local_stale)
  estimateSyncStatus?: EstimateSyncStatus;  // Full sync status
  estimateSent?: boolean;  // Whether estimate has been sent
  generatingForms: boolean;
  printingForm: boolean;
  // Order name editing props
  isEditingOrderName?: boolean;
  orderNameEditValue?: string;
  orderNameError?: string | null;
  isSavingOrderName?: boolean;
  onEditOrderName?: () => void;
  onCancelOrderNameEdit?: () => void;
  onSaveOrderName?: () => void;
  onOrderNameChange?: (value: string) => void;
}

// Cash Estimate Button Component (for cash jobs)
interface CashEstimateButtonProps {
  order: Order;
  onCashEstimateAction: (action: CashEstimateAction) => void;
  onLinkEstimate?: () => void;
  onSyncFromQB?: () => void;
  estimateIsStale: boolean;
  estimateSyncStatus?: EstimateSyncStatus;
  estimateSent?: boolean;
  disabled?: boolean;
}

const CashEstimateButton: React.FC<CashEstimateButtonProps> = ({
  order,
  onCashEstimateAction,
  onLinkEstimate,
  onSyncFromQB,
  estimateIsStale,
  estimateSyncStatus,
  estimateSent = false,
  disabled = false
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const hasEstimate = !!order.qb_estimate_id;

  // Determine button state based on sync status and sent status
  const getButtonState = () => {
    // No estimate exists yet - show Create button (green)
    if (!hasEstimate) {
      return {
        action: 'create_estimate' as CashEstimateAction,
        label: 'Create Estimate',
        icon: <FileText className="w-4 h-4" />,
        colorClass: 'bg-green-600 hover:bg-green-700',
        borderClass: 'border-green-700',
        showDropdown: true
      };
    }

    // Estimate exists - check sync status
    const status = estimateSyncStatus || (estimateIsStale ? 'local_stale' : 'in_sync');

    // Conflict or QB modified - show Review Changes (purple/red)
    if (status === 'conflict' || status === 'qb_modified') {
      return {
        action: 'review_changes' as CashEstimateAction,
        label: 'Review Changes',
        icon: <AlertOctagon className="w-4 h-4" />,
        colorClass: status === 'conflict' ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700',
        borderClass: status === 'conflict' ? 'border-red-700' : 'border-purple-700',
        showDropdown: true
      };
    }

    // Local stale - show Recreate Estimate (orange)
    if (status === 'local_stale' || estimateIsStale) {
      return {
        action: 'update_estimate' as CashEstimateAction,
        label: 'Recreate Estimate',
        icon: <RefreshCw className="w-4 h-4" />,
        colorClass: 'bg-orange-500 hover:bg-orange-600',
        borderClass: 'border-orange-600',
        showDropdown: true
      };
    }

    // In sync + already sent - show View Estimate (gray)
    if (estimateSent) {
      return {
        action: 'view_estimate' as CashEstimateAction,
        label: 'View Estimate',
        icon: <Eye className="w-4 h-4" />,
        colorClass: 'bg-gray-600 hover:bg-gray-700',
        borderClass: 'border-gray-700',
        showDropdown: true
      };
    }

    // In sync + not sent - show Send Estimate (blue)
    return {
      action: 'send_estimate' as CashEstimateAction,
      label: 'Send Estimate',
      icon: <Send className="w-4 h-4" />,
      colorClass: 'bg-blue-600 hover:bg-blue-700',
      borderClass: 'border-blue-700',
      showDropdown: true
    };
  };

  const buttonState = getButtonState();

  // Dropdown options depend on state
  const getDropdownOptions = () => {
    const options: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [];

    if (!hasEstimate) {
      // No estimate - only link option
      if (onLinkEstimate) {
        options.push({
          label: 'Link Existing Estimate',
          icon: <Link className="w-4 h-4" />,
          onClick: onLinkEstimate
        });
      }
    } else {
      // Has estimate - show reassign and sync options
      if (onLinkEstimate) {
        options.push({
          label: 'Reassign Estimate',
          icon: <Link className="w-4 h-4" />,
          onClick: onLinkEstimate
        });
      }
      if (onSyncFromQB && (estimateSyncStatus === 'qb_modified' || estimateSyncStatus === 'conflict')) {
        options.push({
          label: 'Sync from QuickBooks',
          icon: <RefreshCw className="w-4 h-4" />,
          onClick: onSyncFromQB
        });
      }
    }

    return options;
  };

  const dropdownOptions = getDropdownOptions();

  return (
    <div className="relative">
      <div className="inline-flex">
        <button
          onClick={() => onCashEstimateAction(buttonState.action)}
          disabled={disabled}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white ${buttonState.colorClass} transition-colors ${
            buttonState.showDropdown && dropdownOptions.length > 0 ? 'rounded-l-lg' : 'rounded-lg'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {buttonState.icon}
          <span>{buttonState.label}</span>
        </button>
        {buttonState.showDropdown && dropdownOptions.length > 0 && (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={disabled}
            className={`flex items-center px-2 py-2 text-white ${buttonState.colorClass} rounded-r-lg border-l ${buttonState.borderClass} transition-colors ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Cash Job Badge */}
      <div className="absolute -top-2 -left-2 px-1.5 py-0.5 bg-yellow-100 border border-yellow-300 rounded text-xs font-medium text-yellow-800">
        Cash
      </div>

      {/* Dropdown */}
      {showDropdown && dropdownOptions.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[70] min-w-[200px]">
            {dropdownOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setShowDropdown(false);
                  option.onClick();
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  activeTab,
  onTabChange,
  onGenerateForms,
  onOpenPrint,
  onOpenPrintMasterEstimate,
  onOpenFolder,
  onPrepareOrder,
  onCustomerApproved,
  onFilesCreated,
  onApproveFilesAndPrint,
  onInvoiceAction,
  onLinkInvoice,
  onReassignInvoice,
  onMarkAsSent,
  // Cash job estimate actions
  onCashEstimateAction,
  onLinkEstimate,
  onSyncFromQB,
  onRecordPayment,
  estimateIsStale = false,
  estimateSyncStatus,
  estimateSent = false,
  generatingForms,
  printingForm,
  // Order name editing props
  isEditingOrderName = false,
  orderNameEditValue = '',
  orderNameError = null,
  isSavingOrderName = false,
  onEditOrderName,
  onCancelOrderNameEdit,
  onSaveOrderName,
  onOrderNameChange
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/orders');
  };

  return (
    <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Order Info */}
          <div className="flex items-center space-x-4 flex-1">
            <button
              onClick={handleBack}
              className={`flex items-center space-x-1 px-3 py-1.5 ${PAGE_STYLES.header.background} ${PAGE_STYLES.interactive.hoverOnHeader} border ${PAGE_STYLES.panel.border} rounded-md transition-colors ${PAGE_STYLES.header.text}`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Orders</span>
            </button>
            <div>
              <div className="flex items-center space-x-3">
                {onEditOrderName && onCancelOrderNameEdit && onSaveOrderName && onOrderNameChange ? (
                  <EditableOrderName
                    orderName={order.order_name}
                    isEditing={isEditingOrderName}
                    isSaving={isSavingOrderName}
                    editValue={orderNameEditValue}
                    error={orderNameError}
                    onEdit={onEditOrderName}
                    onCancel={onCancelOrderNameEdit}
                    onSave={onSaveOrderName}
                    onEditValueChange={onOrderNameChange}
                  />
                ) : (
                  <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>
                    {order.order_name}
                  </h1>
                )}
                <StatusBadge status={order.status} />
                {/* Deposit status indicator - shows deposit required (red) or paid (green) */}
                {(() => {
                  if (!order.deposit_required) return null;

                  // Deposit is paid when invoice exists AND balance < total (some payment made)
                  const depositPaid = !!(order.qb_invoice_id &&
                    order.cached_balance != null &&
                    order.cached_invoice_total != null &&
                    order.cached_balance < order.cached_invoice_total);

                  if (!DEPOSIT_TRACKING_STATUSES.includes(order.status)) return null;

                  if (depositPaid) {
                    return (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-300 rounded-full">
                        Deposit Paid
                      </span>
                    );
                  }

                  return (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 border border-red-300 rounded-full">
                      Deposit Required
                    </span>
                  );
                })()}
              </div>
              <p className={`text-lg font-semibold ${PAGE_STYLES.panel.text} mt-1`}>{order.customer_name}</p>
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>Order #{order.order_number}</p>
            </div>
          </div>

          {/* Center: Tab Navigation */}
          <div className="flex items-center space-x-8 flex-1 justify-center">
            <button
              onClick={() => onTabChange('specs')}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                activeTab === 'specs'
                  ? `border-b-4 ${MODULE_COLORS.orders.border} ${MODULE_COLORS.orders.text}`
                  : `border-b-2 ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 hover:border-orange-400`
              }`}
            >
              Specs & Invoice
            </button>
            <button
              onClick={() => onTabChange('progress')}
              className={`py-4 px-1 font-medium text-base transition-colors ${
                activeTab === 'progress'
                  ? `border-b-4 ${MODULE_COLORS.orders.border} ${MODULE_COLORS.orders.text}`
                  : `border-b-2 ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 hover:border-orange-400`
              }`}
            >
              Job Progress
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center space-x-3 flex-1 justify-end">
            {/* Open Folder - Always visible */}
            <button
              onClick={onOpenFolder}
              className={`flex items-center space-x-2 px-4 py-2 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg ${PAGE_STYLES.interactive.hover} text-sm font-medium ${PAGE_STYLES.header.text}`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open Folder</span>
            </button>

            {/* Phase-Specific Actions */}
            {/* Job Details Setup - Prepare Order */}
            {order.status === 'job_details_setup' && (
              <button
                onClick={onPrepareOrder}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                <span>Prepare Order</span>
              </button>
            )}

            {/* Pending Confirmation - Customer Approved */}
            {order.status === 'pending_confirmation' && (
              <button
                onClick={onCustomerApproved}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Customer Approved</span>
              </button>
            )}

            {/* Pending Files Creation - Print Master/Estimate + Files Created */}
            {order.status === 'pending_production_files_creation' && (
              <>
                <button
                  onClick={onOpenPrintMasterEstimate}
                  disabled={printingForm}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printingForm ? 'Printing...' : 'Print Master/Estimate Forms'}</span>
                </button>
                <button
                  onClick={onFilesCreated}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Files Created</span>
                </button>
              </>
            )}

            {/* Pending Files Approval - Approve Files and Print Forms */}
            {order.status === 'pending_production_files_approval' && (
              <button
                onClick={onApproveFilesAndPrint}
                disabled={printingForm}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                <span>{printingForm ? 'Printing...' : 'Print Forms, Approve Files, Order Materials'}</span>
              </button>
            )}

            {/* All Other Statuses - Print Forms */}
            {!['job_details_setup', 'pending_confirmation', 'pending_production_files_creation', 'pending_production_files_approval'].includes(order.status) && (
              <button
                onClick={onOpenPrint}
                disabled={printingForm}
                className={`flex items-center space-x-2 px-4 py-2 ${MODULE_COLORS.orders.base} text-white rounded-lg ${MODULE_COLORS.orders.hover} disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium`}
              >
                <Printer className="w-4 h-4" />
                <span>{printingForm ? 'Printing...' : 'Print Forms'}</span>
              </button>
            )}

            {/* Invoice/Estimate Button - Show after customer approval (Phase 2.e) */}
            {!['job_details_setup', 'pending_confirmation'].includes(order.status) && (
              order.cash && onCashEstimateAction ? (
                // Cash job: Show estimate button + record payment button
                <>
                  <CashEstimateButton
                    order={order}
                    onCashEstimateAction={onCashEstimateAction}
                    onLinkEstimate={onLinkEstimate}
                    onSyncFromQB={onSyncFromQB}
                    estimateIsStale={estimateIsStale}
                    estimateSyncStatus={estimateSyncStatus}
                    estimateSent={estimateSent}
                    disabled={generatingForms || printingForm}
                  />
                  {onRecordPayment && (
                    <button
                      onClick={onRecordPayment}
                      className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Record Payment</span>
                    </button>
                  )}
                </>
              ) : !order.cash ? (
                // Regular job: Show invoice button
                <InvoiceButton
                  order={order}
                  onAction={onInvoiceAction}
                  onLinkInvoice={onLinkInvoice}
                  onReassignInvoice={onReassignInvoice}
                  onMarkAsSent={onMarkAsSent}
                  disabled={generatingForms || printingForm}
                />
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHeader;