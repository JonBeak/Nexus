/**
 * Order Confirmation Dialog
 * Shows a preview of the PO email before sending.
 * PO number is a placeholder (generated server-side on confirm).
 * Created: 2026-02-11
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Loader2,
  Mail,
  User,
  Users,
  EyeOff,
  Building2,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import type { ContactChip } from './ContactChipSelector';

interface OrderConfirmationDialogProps {
  open: boolean;
  submitting: boolean;
  supplierName: string;
  deliveryMethod: 'shipping' | 'pickup';
  toChips: ContactChip[];
  ccChips: ContactChip[];
  companyEmail: string;
  subject: string;
  opening: string;
  closing: string;
  items: Array<{
    description: string;
    totalQuantity: number;
    unit: string;
    sku: string | null;
  }>;
  companyName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const PO_PLACEHOLDER = '{PO#}';

/** Navy blue color scheme matching the backend email template */
const COLORS = {
  primary: '#1e3a5f',
  headerText: '#ffffff',
  footer: '#f8fafc',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

function buildPreviewHtml(props: {
  supplierName: string;
  deliveryMethod: 'shipping' | 'pickup';
  opening: string;
  closing: string;
  items: Array<{ description: string; totalQuantity: number; unit: string; sku: string | null }>;
  companyName: string;
}): string {
  const { supplierName, deliveryMethod, opening, closing, items, companyName } = props;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const delivery = deliveryMethod === 'pickup' ? 'Pickup' : 'Shipping';

  const itemRows = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 12px; font-size: 14px;">${escapeHtml(item.description)}</td>
      <td style="padding: 10px 12px; font-size: 14px; color: #6b7280;">${escapeHtml(item.sku || '\u2014')}</td>
      <td style="padding: 10px 12px; font-size: 14px; text-align: center;">${item.totalQuantity} ${escapeHtml(item.unit)}</td>
    </tr>
  `).join('');

  return `
    <div style="max-width: 640px; margin: 0 auto; font-family: Arial, Helvetica, sans-serif;">
      <!-- Header -->
      <div style="background: ${COLORS.primary}; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <span style="font-size: 18px; font-weight: bold; color: ${COLORS.headerText};">${escapeHtml(companyName)}</span>
      </div>

      <!-- Body -->
      <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <!-- Opening -->
        <div style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.6;">
          ${nl2br(opening)}
        </div>

        <!-- PO Details -->
        <div style="margin-bottom: 16px; padding: 12px 14px; background: #f0f4f8; border-radius: 6px; border-left: 4px solid ${COLORS.primary};">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 3px 0;"><strong>PO Number:</strong> <span style="color: #9ca3af; font-style: italic;">${PO_PLACEHOLDER}</span></td>
              <td style="padding: 3px 0; text-align: right;"><strong>Date:</strong> ${today}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0;"><strong>Delivery:</strong> ${delivery}</td>
              <td></td>
            </tr>
          </table>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: ${COLORS.primary}; color: ${COLORS.headerText};">
              <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600;">Description</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600;">SKU</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px; font-weight: 600;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- Closing -->
        <div style="margin-top: 20px; font-size: 14px; color: #374151; line-height: 1.6;">
          ${nl2br(closing)}
        </div>
      </div>

      <!-- Footer -->
      <div style="background: ${COLORS.footer}; padding: 12px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
        <div style="font-size: 13px; color: #6b7280;">${escapeHtml(companyName)}</div>
      </div>
    </div>
  `;
}

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
  companyEmail,
  subject,
  opening,
  closing,
  items,
  companyName,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  const previewHtml = buildPreviewHtml({
    supplierName,
    deliveryMethod,
    opening,
    closing,
    items,
    companyName,
  });

  // Replace PO placeholder in subject for display
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
        className={`relative w-full max-w-2xl max-h-[90vh] mx-4 flex flex-col rounded-lg shadow-2xl ${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border overflow-hidden`}
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

        {/* Dual Email Recipients */}
        <div className={`border-b ${PAGE_STYLES.panel.border}`}>
          {/* Email 1: Supplier PO */}
          <div className={`px-5 py-2.5 border-b ${PAGE_STYLES.panel.border}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Send className={`w-3 h-3 ${PAGE_STYLES.panel.textMuted}`} />
              <span className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted}`}>
                Supplier PO Email
              </span>
            </div>
            <div className="space-y-1 text-xs ml-[18px]">
              {toChips.length > 0 && (
                <div className="flex items-start gap-2">
                  <User className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${PAGE_STYLES.panel.textMuted}`} />
                  <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>To:</span>
                  <span className={PAGE_STYLES.panel.text}>{formatChips(toChips)}</span>
                </div>
              )}
              {ccChips.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${PAGE_STYLES.panel.textMuted}`} />
                  <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>CC:</span>
                  <span className={PAGE_STYLES.panel.text}>{formatChips(ccChips)}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Mail className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${PAGE_STYLES.panel.textMuted}`} />
                <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>Subj:</span>
                <span className={PAGE_STYLES.panel.text}>{displaySubject}</span>
              </div>
            </div>
          </div>

          {/* Email 2: Internal Copy */}
          <div className="px-5 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Building2 className={`w-3 h-3 ${PAGE_STYLES.panel.textMuted}`} />
              <span className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted}`}>
                Internal Copy
              </span>
            </div>
            <div className="space-y-1 text-xs ml-[18px]">
              <div className="flex items-start gap-2">
                <EyeOff className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${PAGE_STYLES.panel.textMuted}`} />
                <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>BCC:</span>
                <span className={PAGE_STYLES.panel.text}>{companyEmail}</span>
              </div>
              <div className="flex items-start gap-2">
                <Mail className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${PAGE_STYLES.panel.textMuted}`} />
                <span className={`font-medium ${PAGE_STYLES.panel.textSecondary} w-6 shrink-0`}>Subj:</span>
                <span className={PAGE_STYLES.panel.text}>{displaySubject}</span>
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

        {/* Email Preview (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-100 dark:bg-gray-900">
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
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
