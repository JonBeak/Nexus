/**
 * @deprecated Use DocumentActionModal from './document' with documentType="estimate" and mode="create" instead.
 * This component will be removed in a future release.
 *
 * Create Estimate Modal (Cash Jobs)
 *
 * Shows a preview of invoice line items before creating a QB estimate.
 * Displays loading state while waiting for QB response and shows
 * success/failure confirmation.
 */

import React, { useState, useRef, useMemo } from 'react';
import { X, Loader2, Receipt, CheckCircle, AlertCircle } from 'lucide-react';
import { OrderPart } from '../../../types/orders';
import { orderPreparationApi } from '../../../services/api';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

interface CreateEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  orderName: string;
  customerName: string;
  parts: OrderPart[];
  taxName: string | null;
  taxPercent: number;  // Decimal (e.g., 0.13 for 13%)
  onSuccess: () => void;
}

type ModalState = 'preview' | 'loading' | 'success' | 'error';

export const CreateEstimateModal: React.FC<CreateEstimateModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  orderName,
  customerName,
  parts,
  taxName,
  taxPercent,
  onSuccess
}) => {
  const [state, setState] = useState<ModalState>('preview');
  const [error, setError] = useState<string | null>(null);
  const [estimateNumber, setEstimateNumber] = useState<string | null>(null);

  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);

  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Separate billable parts (for totals) and display parts (includes headers)
  const billableParts = useMemo(() => {
    return parts.filter(p =>
      !p.is_header_row &&
      p.qb_item_name &&
      p.quantity &&
      p.quantity > 0 &&
      p.unit_price &&
      p.unit_price > 0
    );
  }, [parts]);

  // All parts to display (headers + billable) - preserves original order
  const displayParts = useMemo(() => {
    return parts.filter(p =>
      p.is_header_row ||
      (p.qb_item_name && p.quantity && p.quantity > 0 && p.unit_price && p.unit_price > 0)
    );
  }, [parts]);

  // Calculate totals (billable parts only)
  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = billableParts.reduce((sum, p) =>
      sum + parseFloat(p.extended_price?.toString() || '0'), 0
    );
    const tax = sub * taxPercent;
    return {
      subtotal: sub,
      taxAmount: tax,
      total: sub + tax
    };
  }, [billableParts, taxPercent]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Handle backdrop click
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current
      ? !modalContentRef.current.contains(e.target as Node)
      : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (state === 'loading') return; // Don't allow close during loading
    if (mouseDownOutsideRef.current && modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      handleClose();
    }
    mouseDownOutsideRef.current = false;
  };

  // Handle close
  const handleClose = () => {
    if (state === 'loading') return; // Don't allow close during loading
    setState('preview');
    setError(null);
    setEstimateNumber(null);
    onClose();
  };

  // Handle create estimate
  const handleCreate = async () => {
    setState('loading');
    setError(null);

    try {
      const result = await orderPreparationApi.createQBEstimate(orderNumber);
      setEstimateNumber(result.qbEstimateDocNumber || result.estimateNumber || 'Created');
      setState('success');

      // Auto-close after success
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Error creating estimate:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create estimate';
      setError(errorMessage);
      setState('error');
    }
  };

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'loading') {
        e.stopImmediatePropagation();
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${PAGE_STYLES.panel.border} flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-green-600" />
            <div>
              <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
                Create QuickBooks Estimate
              </h2>
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                Order #{orderNumber} &bull; {customerName}
              </p>
            </div>
          </div>
          {state !== 'loading' && (
            <button
              onClick={handleClose}
              className={`p-2 ${PAGE_STYLES.panel.textMuted} hover:text-gray-700 rounded transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {state === 'preview' && (
            <>
              {/* Order Name */}
              <div className="mb-4">
                <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Job Name</p>
                <p className={`text-base font-semibold ${PAGE_STYLES.panel.text}`}>{orderName}</p>
              </div>

              {/* Line Items Table */}
              {billableParts.length === 0 ? (
                <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
                  <p className="font-medium">No invoice items to include</p>
                  <p className="text-sm mt-1">
                    Add QB Item names, quantities, and prices to parts before creating an estimate.
                  </p>
                </div>
              ) : (
                <>
                  <div className={`border ${PAGE_STYLES.panel.border} rounded-lg overflow-hidden`}>
                    <table className="w-full text-sm">
                      <thead className={`${PAGE_STYLES.header.background}`}>
                        <tr>
                          <th className={`px-3 py-2 text-left font-medium ${PAGE_STYLES.header.text}`}>
                            Item
                          </th>
                          <th className={`px-3 py-2 text-left font-medium ${PAGE_STYLES.header.text} hidden sm:table-cell`}>
                            Description
                          </th>
                          <th className={`px-3 py-2 text-center font-medium ${PAGE_STYLES.header.text} w-16`}>
                            Qty
                          </th>
                          <th className={`px-3 py-2 text-right font-medium ${PAGE_STYLES.header.text} w-24`}>
                            Price
                          </th>
                          <th className={`px-3 py-2 text-right font-medium ${PAGE_STYLES.header.text} w-24`}>
                            Extended
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${PAGE_STYLES.panel.border}`}>
                        {displayParts.map((part) => (
                          part.is_header_row ? (
                            // Header row - spans full width, bold, different background
                            <tr key={part.part_id} className="bg-gray-100">
                              <td colSpan={5} className={`px-3 py-2 font-semibold ${PAGE_STYLES.panel.text}`}>
                                {part.qb_description || part.invoice_description || 'Section Header'}
                              </td>
                            </tr>
                          ) : (
                            // Regular billable row
                            <tr key={part.part_id} className={PAGE_STYLES.interactive.hover}>
                              <td className={`px-3 py-2 ${PAGE_STYLES.panel.text}`}>
                                {part.qb_item_name}
                              </td>
                              <td className={`px-3 py-2 ${PAGE_STYLES.panel.textMuted} hidden sm:table-cell truncate max-w-[200px]`}>
                                {part.invoice_description || part.qb_description || '-'}
                              </td>
                              <td className={`px-3 py-2 text-center ${PAGE_STYLES.panel.text}`}>
                                {part.quantity}
                              </td>
                              <td className={`px-3 py-2 text-right ${PAGE_STYLES.panel.text}`}>
                                {formatCurrency(part.unit_price || 0)}
                              </td>
                              <td className={`px-3 py-2 text-right font-medium ${PAGE_STYLES.panel.text}`}>
                                {formatCurrency(part.extended_price || 0)}
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={PAGE_STYLES.panel.textMuted}>Subtotal:</span>
                        <span className={PAGE_STYLES.panel.text}>{formatCurrency(subtotal)}</span>
                      </div>
                      {taxPercent > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className={PAGE_STYLES.panel.textMuted}>
                            Tax ({taxName || 'Tax'} {(taxPercent * 100).toFixed(0)}%):
                          </span>
                          <span className={PAGE_STYLES.panel.text}>{formatCurrency(taxAmount)}</span>
                        </div>
                      )}
                      <div className={`flex justify-between text-base font-semibold pt-2 border-t ${PAGE_STYLES.panel.border}`}>
                        <span className={PAGE_STYLES.panel.text}>Total:</span>
                        <span className={PAGE_STYLES.panel.text}>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-green-600 mb-4" />
              <p className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>
                Creating estimate...
              </p>
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
                Please wait for QuickBooks response
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <p className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
                Estimate Created Successfully
              </p>
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
                QB Estimate #{estimateNumber}
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <p className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
                Failed to create estimate
              </p>
              <p className={`text-sm text-red-600 mt-2 text-center max-w-md`}>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${PAGE_STYLES.panel.border} flex justify-end gap-3 flex-shrink-0`}>
          {state === 'preview' && (
            <>
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={billableParts.length === 0}
                className={`px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                Create Estimate
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className={`px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors`}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateEstimateModal;
