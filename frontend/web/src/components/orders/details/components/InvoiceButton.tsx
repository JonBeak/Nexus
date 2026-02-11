import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Send, Eye, RefreshCw, ChevronDown, Link, AlertTriangle, AlertOctagon, CheckCircle } from 'lucide-react';
import { Order, DEPOSIT_TRACKING_STATUSES } from '../../../../types/orders';
import { qbInvoiceApi, InvoiceSyncStatus, InvoiceDifference } from '../../../../services/api';

export type InvoiceAction = 'create' | 'update' | 'send' | 'view' | 'qb_modified' | 'conflict' | 'reassign';

interface InvoiceButtonProps {
  order: Order;
  onAction: (action: InvoiceAction, differences?: InvoiceDifference[]) => void;
  onLinkInvoice?: () => void;
  /** Called when invoice needs reassignment (deleted in QB). Passes current invoice info and whether it was deleted */
  onReassignInvoice?: (currentInvoice: { invoiceId: string | null; invoiceNumber: string | null; isDeleted: boolean }) => void;
  /** Called when user manually marks invoice as sent */
  onMarkAsSent?: () => void;
  disabled?: boolean;
  /** If true, performs deep QB comparison (slower but detects QB-side changes) */
  deepCheck?: boolean;
}

interface ButtonState {
  action: InvoiceAction;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  needsShine: boolean;
}

// Statuses where Create Invoice SHOULD shine (invoice needed but not created yet)
const INVOICE_NEEDED_STATUSES = ['shipping', 'pick_up', 'awaiting_payment', 'completed'];


/**
 * InvoiceButton - Dynamic button with 6 states based on invoice status
 *
 * States:
 * - create: No invoice exists -> Green "Create Invoice" (+ shine if in late-stage status)
 *           Also has dropdown with "Link Existing Invoice" option
 * - update: Invoice exists, local data stale -> Orange "Update Invoice" + shine
 * - qb_modified: Invoice exists, QB was edited externally -> Purple "Review Changes" + shine
 * - conflict: Both local and QB changed -> Red "Resolve Conflict" + shine
 * - send: Invoice exists, not sent -> Blue "Send Invoice" + shine
 * - view: Invoice exists, already sent -> Gray "View Invoice"
 */
const InvoiceButton: React.FC<InvoiceButtonProps> = ({
  order,
  onAction,
  onLinkInvoice,
  onReassignInvoice,
  onMarkAsSent,
  disabled = false,
  deepCheck = false
}) => {
  const [syncStatus, setSyncStatus] = useState<InvoiceSyncStatus>('in_sync');
  const [differences, setDifferences] = useState<InvoiceDifference[]>([]);
  const [checking, setChecking] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check invoice sync status on mount and when order data changes
  const checkSyncStatus = useCallback(async () => {
    if (!order.qb_invoice_id) {
      setSyncStatus('in_sync');
      setDifferences([]);
      return;
    }

    try {
      setChecking(true);

      if (deepCheck) {
        // Deep comparison with QB API call
        const result = await qbInvoiceApi.compareWithQB(order.order_number);
        setSyncStatus(result.status);
        setDifferences(result.differences || []);
      } else {
        // Fast local-only check
        const result = await qbInvoiceApi.checkUpdates(order.order_number);
        setSyncStatus(result.isStale ? 'local_stale' : 'in_sync');
        setDifferences([]);
      }
    } catch (error) {
      console.error('Failed to check invoice sync status:', error);
      setSyncStatus('error');
      setDifferences([]);
    } finally {
      setChecking(false);
    }
  }, [order.qb_invoice_id, order.order_number, deepCheck]);

  useEffect(() => {
    checkSyncStatus();
  }, [checkSyncStatus, order.qb_invoice_data_hash]);

  // Determine button state based on sync status
  const getButtonState = (): ButtonState => {
    const hasInvoice = !!order.qb_invoice_id;
    const invoiceSent = !!order.invoice_sent_at;

    if (!hasInvoice) {
      // Shine when order is in late-stage status (invoice should exist by now)
      // OR for deposit-required orders in deposit statuses (deposit invoice needed early)
      const needsCreateShine = INVOICE_NEEDED_STATUSES.includes(order.status) ||
        !!(order.deposit_required && DEPOSIT_TRACKING_STATUSES.includes(order.status));
      return {
        action: 'create',
        label: 'Create Invoice',
        icon: <FileText className="w-4 h-4" />,
        colorClass: 'bg-green-600 hover:bg-green-700 text-white',
        needsShine: needsCreateShine
      };
    }

    // Handle sync statuses
    switch (syncStatus) {
      case 'local_stale':
        return {
          action: 'update',
          label: 'Update Invoice',
          icon: <RefreshCw className="w-4 h-4" />,
          colorClass: 'bg-orange-500 hover:bg-orange-600 text-white',
          needsShine: true
        };

      case 'qb_modified':
        return {
          action: 'qb_modified',
          label: 'Review Changes',
          icon: <AlertTriangle className="w-4 h-4" />,
          colorClass: 'bg-purple-600 hover:bg-purple-700 text-white',
          needsShine: true
        };

      case 'conflict':
        return {
          action: 'conflict',
          label: 'Resolve Conflict',
          icon: <AlertOctagon className="w-4 h-4" />,
          colorClass: 'bg-red-600 hover:bg-red-700 text-white',
          needsShine: true
        };

      case 'not_found':
        return {
          action: 'reassign',
          label: 'Invoice Missing',
          icon: <AlertTriangle className="w-4 h-4" />,
          colorClass: 'bg-red-500 hover:bg-red-600 text-white',
          needsShine: true
        };

      case 'error':
        return {
          action: 'view',
          label: 'Check Failed',
          icon: <AlertTriangle className="w-4 h-4" />,
          colorClass: 'bg-gray-400 hover:bg-gray-500 text-white',
          needsShine: false
        };

      default:
        // in_sync or unknown
        if (!invoiceSent) {
          return {
            action: 'send',
            label: 'Send Invoice',
            icon: <Send className="w-4 h-4" />,
            colorClass: 'bg-blue-600 hover:bg-blue-700 text-white',
            needsShine: true
          };
        }

        // Check if deposit order has unpaid deposit
        // Deposit is paid when balance < total (some payment made)
        const depositUnpaid = !!(order.deposit_required &&
          DEPOSIT_TRACKING_STATUSES.includes(order.status) &&
          (order.cached_balance == null ||
           order.cached_invoice_total == null ||
           order.cached_balance >= order.cached_invoice_total));

        return {
          action: 'view',
          label: 'View Invoice',
          icon: <Eye className="w-4 h-4" />,
          colorClass: 'bg-gray-500 hover:bg-gray-600 text-white',
          needsShine: depositUnpaid
        };
    }
  };

  const buttonState = getButtonState();

  const handleMainClick = () => {
    if (!disabled && !checking) {
      if (buttonState.action === 'reassign' && onReassignInvoice) {
        // For deleted invoices, trigger reassignment flow with current invoice info
        onReassignInvoice({
          invoiceId: order.qb_invoice_id || null,
          invoiceNumber: order.qb_invoice_doc_number || null,
          isDeleted: true  // Main button click for 'reassign' action means invoice is deleted in QB
        });
      } else {
        onAction(buttonState.action, differences.length > 0 ? differences : undefined);
      }
    }
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dropdownOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 208, // 208px = w-52
      });
    }
    setDropdownOpen(!dropdownOpen);
  };

  const handleLinkInvoice = () => {
    setDropdownOpen(false);
    onLinkInvoice?.();
  };

  const handleReassignClick = () => {
    setDropdownOpen(false);
    if (onReassignInvoice) {
      // User manually choosing to reassign via dropdown - invoice exists but user wants a different one
      onReassignInvoice({
        invoiceId: order.qb_invoice_id || null,
        invoiceNumber: order.qb_invoice_doc_number || null,
        isDeleted: false  // Dropdown click = user choice, not because invoice is deleted
      });
    }
  };

  // Show dropdown for 'create' (link option), when invoice exists (reassign option),
  // or when invoice not yet sent (mark as sent option)
  const hasInvoice = !!order.qb_invoice_id;
  const invoiceSent = !!order.invoice_sent_at;
  const showMarkAsSent = !invoiceSent && onMarkAsSent;
  const showDropdown = (buttonState.action === 'create' && onLinkInvoice) ||
                       (hasInvoice && onReassignInvoice) ||
                       showMarkAsSent;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex">
        {/* Main button */}
        <button
          onClick={handleMainClick}
          disabled={disabled || checking}
          className={`
            flex items-center gap-1.5 px-3 py-3 md:py-2 min-h-[44px] text-sm font-medium
            transition-colors relative overflow-hidden
            ${buttonState.colorClass}
            ${showDropdown ? 'rounded-l' : 'rounded'}
            ${disabled || checking ? 'opacity-50 cursor-not-allowed' : ''}
            ${buttonState.needsShine ? 'invoice-button-shine' : ''}
          `}
        >
          {checking ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            buttonState.icon
          )}
          <span>{checking ? 'Checking...' : buttonState.label}</span>

          {/* Shine animation overlay */}
          {buttonState.needsShine && !disabled && !checking && (
            <span className="absolute inset-0 shine-effect" />
          )}
        </button>

        {/* Dropdown toggle button */}
        {showDropdown && (
          <button
            onClick={handleDropdownToggle}
            disabled={disabled || checking}
            className={`
              px-2 py-3 md:py-2 min-h-[44px] text-sm font-medium rounded-r
              transition-colors border-l border-white/30
              ${buttonState.colorClass}
              ${disabled || checking ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Dropdown menu - fixed positioning to escape overflow-hidden ancestors */}
      {showDropdown && dropdownOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setDropdownOpen(false)} />
          <div
            className="fixed w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-[70] py-1"
            style={dropdownPosition ? { top: dropdownPosition.top, left: dropdownPosition.left } : undefined}
          >
          {/* Link option - only for create action */}
          {buttonState.action === 'create' && onLinkInvoice && (
            <button
              onClick={handleLinkInvoice}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Link className="w-4 h-4" />
              <span>Link Existing Invoice</span>
            </button>
          )}
          {/* Reassign option - when invoice exists */}
          {hasInvoice && onReassignInvoice && (
            <button
              onClick={handleReassignClick}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Link className="w-4 h-4" />
              <span>Reassign to Different Invoice</span>
            </button>
          )}
          {/* Mark as Sent option - when invoice not sent yet */}
          {showMarkAsSent && (
            <button
              onClick={() => {
                setDropdownOpen(false);
                onMarkAsSent?.();
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Mark as Sent</span>
            </button>
          )}
          </div>
        </>
      )}

      {/* Inline styles for shine animation */}
      <style>{`
        .invoice-button-shine {
          position: relative;
          overflow: hidden;
        }

        .shine-effect {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.6),
            transparent
          );
          animation: shine 1s infinite;
          pointer-events: none;
        }

        @keyframes shine {
          0% {
            left: -100%;
          }
          50%, 100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoiceButton;
