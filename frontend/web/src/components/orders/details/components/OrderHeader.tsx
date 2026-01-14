import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, FolderOpen, Settings, CheckCircle, FileCheck } from 'lucide-react';
import { Order, DEPOSIT_TRACKING_STATUSES } from '../../../../types/orders';
import StatusBadge from '../../common/StatusBadge';
import InvoiceButton, { InvoiceAction } from './InvoiceButton';
import { PAGE_STYLES, MODULE_COLORS } from '../../../../constants/moduleColors';

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
  onReassignInvoice?: (currentInvoice: { invoiceId: string | null; invoiceNumber: string | null }) => void;  // Reassign deleted invoice
  onMarkAsSent?: () => void;  // Mark invoice as sent manually
  generatingForms: boolean;
  printingForm: boolean;
}

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
  generatingForms,
  printingForm
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
                <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>
                  {order.order_name}
                </h1>
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
                <span>{printingForm ? 'Printing...' : 'Approve Files and Print Forms'}</span>
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

            {/* Invoice Button - Show after customer approval (Phase 2.e) */}
            {!['job_details_setup', 'pending_confirmation'].includes(order.status) && (
              <InvoiceButton
                order={order}
                onAction={onInvoiceAction}
                onLinkInvoice={onLinkInvoice}
                onReassignInvoice={onReassignInvoice}
                onMarkAsSent={onMarkAsSent}
                disabled={generatingForms || printingForm}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderHeader;