import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Send, Eye, RefreshCw } from 'lucide-react';
import { Order } from '../../../../types/orders';
import { qbInvoiceApi } from '../../../../services/api/orders/qbInvoiceApi';

export type InvoiceAction = 'create' | 'update' | 'send' | 'view';

interface InvoiceButtonProps {
  order: Order;
  onAction: (action: InvoiceAction) => void;
  disabled?: boolean;
}

interface ButtonState {
  action: InvoiceAction;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  needsShine: boolean;
}

/**
 * InvoiceButton - Dynamic button with 4 states based on invoice status
 *
 * States:
 * - create: No invoice exists -> Green "Create Invoice"
 * - update: Invoice exists but stale -> Orange "Update Invoice" + shine
 * - send: Invoice exists, not sent -> Blue "Send Invoice" + shine
 * - view: Invoice exists, already sent -> Gray "View Invoice"
 */
const InvoiceButton: React.FC<InvoiceButtonProps> = ({
  order,
  onAction,
  disabled = false
}) => {
  const [isStale, setIsStale] = useState(false);
  const [checking, setChecking] = useState(false);

  // Check invoice staleness on mount and when order data changes
  const checkStaleness = useCallback(async () => {
    if (!order.qb_invoice_id) {
      setIsStale(false);
      return;
    }

    try {
      setChecking(true);
      const result = await qbInvoiceApi.checkUpdates(order.order_number);
      setIsStale(result.isStale);
    } catch (error) {
      console.error('Failed to check invoice staleness:', error);
      setIsStale(false);
    } finally {
      setChecking(false);
    }
  }, [order.qb_invoice_id, order.order_number]);

  useEffect(() => {
    checkStaleness();
  }, [checkStaleness, order.qb_invoice_data_hash]);

  // Determine button state
  const getButtonState = (): ButtonState => {
    const hasInvoice = !!order.qb_invoice_id;
    const invoiceSent = !!order.invoice_sent_at;

    if (!hasInvoice) {
      return {
        action: 'create',
        label: 'Create Invoice',
        icon: <FileText className="w-4 h-4" />,
        colorClass: 'bg-green-600 hover:bg-green-700 text-white',
        needsShine: false
      };
    }

    if (isStale) {
      return {
        action: 'update',
        label: 'Update Invoice',
        icon: <RefreshCw className="w-4 h-4" />,
        colorClass: 'bg-orange-500 hover:bg-orange-600 text-white',
        needsShine: true
      };
    }

    if (!invoiceSent) {
      return {
        action: 'send',
        label: 'Send Invoice',
        icon: <Send className="w-4 h-4" />,
        colorClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        needsShine: true
      };
    }

    return {
      action: 'view',
      label: 'View Invoice',
      icon: <Eye className="w-4 h-4" />,
      colorClass: 'bg-gray-500 hover:bg-gray-600 text-white',
      needsShine: false
    };
  };

  const buttonState = getButtonState();

  const handleClick = () => {
    if (!disabled && !checking) {
      onAction(buttonState.action);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || checking}
      className={`
        flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium
        transition-colors relative overflow-hidden
        ${buttonState.colorClass}
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
            rgba(255, 255, 255, 0.4),
            transparent
          );
          animation: shine 2s infinite;
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
    </button>
  );
};

export default InvoiceButton;
