/**
 * Order Confirmation Dialog
 * Shows a preview of the PO email before sending.
 * PO number is a placeholder (generated server-side on confirm).
 * Created: 2026-02-11
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Loader2,
  Mail,
  User,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { supplierOrdersApi } from '../../../services/api/supplierOrdersApi';
import type { ContactChip } from './ContactChipSelector';

interface OrderConfirmationDialogProps {
  open: boolean;
  submitting: boolean;
  supplierName: string;
  deliveryMethod: 'shipping' | 'pickup';
  toChips: ContactChip[];
  ccChips: ContactChip[];
  bccChips: ContactChip[];
  companyEmail: string;
  subject: string;
  opening: string;
  closing: string;
  items: Array<{
    description: string;
    totalQuantity: number;
    unit: string;
    sku: string | null;
    unitPrice: number | null;
    lineTotal: number | null;
    currency?: string | null;
  }>;
  onConfirm: () => void;
  onCancel: () => void;
}

const PO_PLACEHOLDER = '{PO#}';

/** Format chip list for display */
function formatChips(chips: ContactChip[]): string {
  return chips.map(c => c.name !== c.email ? `${c.name} <${c.email}>` : c.email).join(', ');
}

export const OrderConfirmationDialog: React.FC<OrderConfirmationDialogProps> = ({
  open,
  submitting,
  supplierName,
  deliveryMethod,
  toChips,
  ccChips,
  bccChips,
  companyEmail,
  subject,
  opening,
  closing,
  items,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [supplierPreviewHtml, setSupplierPreviewHtml] = useState<string>('');
  const [internalPreviewHtml, setInternalPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Fetch BOTH preview HTMLs from backend when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchPreviews = async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        // Fetch supplier preview (without pricing)
        const supplierPreview = await supplierOrdersApi.getEmailPreview({
          items: items.map(i => ({
            product_description: i.description,
            sku: i.sku || undefined,
            quantity_ordered: i.totalQuantity,
            unit: i.unit,
            unit_price: i.unitPrice ?? 0,
            line_total: i.lineTotal ?? 0,
          })),
          deliveryMethod,
          opening: opening || undefined,
          closing: closing || undefined,
          supplierName,
          showPricing: false,  // NO PRICING for supplier
        });

        // Fetch internal preview (with pricing)
        const internalPreview = await supplierOrdersApi.getEmailPreview({
          items: items.map(i => ({
            product_description: i.description,
            sku: i.sku || undefined,
            quantity_ordered: i.totalQuantity,
            unit: i.unit,
            unit_price: i.unitPrice ?? 0,
            line_total: i.lineTotal ?? 0,
          })),
          deliveryMethod,
          opening: `[Internal Record - Includes Pricing]\n\n${opening || ''}`,
          closing: closing || undefined,
          supplierName,
          showPricing: true,  // SHOW PRICING for internal
        });

        if (!cancelled) {
          setSupplierPreviewHtml(supplierPreview.html);
          setInternalPreviewHtml(internalPreview.html);
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewError((err as any)?.message || 'Failed to load previews');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    fetchPreviews();
    return () => { cancelled = true; };
  }, [open, items, deliveryMethod, opening, closing, supplierName]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, submitting, onCancel]);

  // Trap focus on open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const displaySubject = subject;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={submitting ? undefined : onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={`relative w-full max-w-7xl max-h-[90vh] mx-4 flex flex-col rounded-lg shadow-2xl ${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border overflow-hidden`}
      >
        {/* Dialog Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.background}`}>
          <div className="flex items-center gap-2">
            <Mail className={`w-5 h-5 ${PAGE_STYLES.panel.textSecondary}`} />
            <h2 className={`text-base font-semibold ${PAGE_STYLES.panel.text}`}>
              Confirm Purchase Order — {supplierName}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className={`p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${PAGE_STYLES.panel.textMuted} disabled:opacity-50`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recipient Info — Two Sections */}
        <div className={`px-5 py-3 border-b ${PAGE_STYLES.panel.border} text-xs`}>
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier PO Email */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Supplier PO Email</span>
              </div>
              {toChips.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>To:</span>
                  <span className={PAGE_STYLES.panel.text}>{formatChips(toChips)}</span>
                </div>
              )}
              {ccChips.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>CC:</span>
                  <span className={PAGE_STYLES.panel.text}>{formatChips(ccChips)}</span>
                </div>
              )}
              {bccChips.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>BCC:</span>
                  <span className={PAGE_STYLES.panel.text}>{formatChips(bccChips)}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>Subj:</span>
                <span className={PAGE_STYLES.panel.text}>{displaySubject}</span>
              </div>
            </div>

            {/* Internal Copy */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">Internal Copy</span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>BCC:</span>
                <span className={PAGE_STYLES.panel.text}>{companyEmail || 'Not configured'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>Subj:</span>
                <span className={PAGE_STYLES.panel.text}>[INTERNAL] {displaySubject}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PO Placeholder Notice */}
        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            The PO number will be auto-generated when the order is confirmed. It appears as "{PO_PLACEHOLDER}" in this preview.
          </p>
        </div>

        {/* Email Previews (scrollable, side-by-side) */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-100 dark:bg-gray-900">
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-6 h-6 animate-spin ${PAGE_STYLES.panel.textMuted}`} />
              <span className={`ml-2 text-sm ${PAGE_STYLES.panel.textSecondary}`}>Loading previews...</span>
            </div>
          ) : previewError ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm">{previewError}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Preview 1: To Supplier (No Pricing) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    To Supplier (No Pricing)
                  </h3>
                </div>
                <div
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                  dangerouslySetInnerHTML={{ __html: supplierPreviewHtml }}
                />
              </div>

              {/* Preview 2: Internal (With Pricing) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-2">
                  <Building2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Internal Record (With Pricing)
                  </h3>
                </div>
                <div
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                  dangerouslySetInnerHTML={{ __html: internalPreviewHtml }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        <div className={`flex items-center justify-end gap-3 px-5 py-3.5 border-t ${PAGE_STYLES.panel.border}`}>
          <button
            onClick={onCancel}
            disabled={submitting}
            className={`px-4 py-2 text-sm rounded-md border ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.text} hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitting ? 'Sending...' : 'Confirm & Send'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
