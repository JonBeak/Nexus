/**
 * CreateInvoiceViewParts - Sub-components for CreateInvoiceView
 *
 * TotalsSection: Shared totals display (subtotal, tax, total, deposit)
 * MobileCreateContent: Card-based line items for mobile
 * DesktopCreateContent: Table-based line items for desktop
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Order } from '../../../../types/orders';
import { Address } from '../../../../types';

/** Normalize \r\n and \r to \n so whitespace-pre-wrap renders line breaks */
const normalizeLF = (s: string) => s.replace(/\r\n?/g, '\n');

export interface InvoiceDisplayPart {
  key: number;
  qb_item_name: string | undefined;
  qb_description: string;
  quantity: number | undefined;
  unit_price: number | undefined;
  extended_price: number | undefined;
  is_header_row: boolean | undefined;
  is_description_only: boolean;
  is_default_description: boolean;
}

export interface TotalsResult {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  deposit: number;
  taxNotFound: boolean;
  taxName: string | null;
}

export const TotalsSection: React.FC<{
  totals: TotalsResult;
  isCash: boolean;
  depositRequired: boolean;
  compact?: boolean;
}> = ({ totals, isCash, depositRequired, compact }) => {
  const w1 = compact ? 'w-24' : 'w-28';
  const w2 = compact ? 'w-20' : 'w-24';
  return (
    <div className={`border-t border-gray-300 ${compact ? 'pt-3 space-y-1 text-sm' : 'pt-4 space-y-1 text-sm'}`}>
      <div className="flex justify-end">
        <span className={`${w1} text-gray-600`}>Subtotal:</span>
        <span className={`${w2} text-right font-medium`}>${totals.subtotal.toFixed(2)}</span>
      </div>
      {!isCash && (
        <div className="flex justify-end">
          <span className={`${w1} ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
            {totals.taxNotFound ? `${totals.taxName}:` : `Tax (${(totals.taxRate * 100).toFixed(0)}%):`}
          </span>
          <span className={`${w2} text-right font-medium ${totals.taxNotFound ? 'text-red-600' : ''}`}>
            {totals.taxNotFound ? 'ERROR' : `$${totals.tax.toFixed(2)}`}
          </span>
        </div>
      )}
      <div className={`flex justify-end border-t border-gray-200 ${compact ? 'pt-1' : 'pt-2'}`}>
        <span className={`${w1} font-semibold text-gray-900`}>Total:</span>
        <span className={`${w2} text-right font-bold text-gray-900`}>${totals.total.toFixed(2)}</span>
      </div>
      {!!depositRequired && (
        <div className={`flex justify-end bg-green-50 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} rounded`}>
          <span className={`${w1} font-semibold text-green-700`}>Deposit (50%):</span>
          <span className={`${w2} text-right font-bold text-green-700`}>${totals.deposit.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

interface ContentProps {
  companySettings: { company_name: string | null; company_address: string | null } | null;
  order: Order;
  customerBillingAddress: Address | null;
  formattedDate: string;
  loadingInvoicePreview: boolean;
  invoiceDisplayParts: InvoiceDisplayPart[];
  totals: TotalsResult;
  formatAddress: (addr: Address | null) => string;
}

export const MobileCreateContent: React.FC<ContentProps> = ({
  companySettings, order, customerBillingAddress, formattedDate,
  loadingInvoicePreview, invoiceDisplayParts, totals, formatAddress
}) => (
  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
    <div className="flex flex-col gap-4 mb-4">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
        <p className="text-sm font-medium text-gray-900">{companySettings?.company_name || 'Sign House'}</p>
        <p className="text-xs text-gray-600 whitespace-pre-line">{companySettings?.company_address || ''}</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
        <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
        <p className="text-xs text-gray-600 whitespace-pre-line">{formatAddress(customerBillingAddress)}</p>
      </div>
    </div>
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</h4>
      <p className="text-sm text-gray-900">{formattedDate}</p>
    </div>
    <div className="mb-4 space-y-3">
      {loadingInvoicePreview ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">Loading preview...</span>
        </div>
      ) : invoiceDisplayParts.map((part) => (
        part.is_header_row ? (
          <div key={part.key} className="bg-gray-100 border border-gray-300 rounded-lg p-3">
            <div className="font-semibold text-gray-900 text-sm">{part.qb_description || 'Section Header'}</div>
          </div>
        ) : (
          <div key={part.key} className="bg-white border border-gray-300 rounded-lg p-3">
            <div className="font-medium text-gray-900 text-sm">{part.qb_item_name || '-'}</div>
            {part.is_default_description ? (
              <div className="text-xs text-amber-600 italic mt-0.5">Default template description</div>
            ) : null}
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-gray-600">Qty: <span className="font-medium">{part.quantity}</span></span>
              <span className="text-gray-600">@ ${Number(part.unit_price || 0).toFixed(2)}</span>
              <span className="font-semibold text-gray-900">${Number(part.extended_price || 0).toFixed(2)}</span>
            </div>
          </div>
        )
      ))}
    </div>
    <TotalsSection totals={totals} isCash={!!order.cash} depositRequired={!!order.deposit_required} compact />
  </div>
);

export const DesktopCreateContent: React.FC<ContentProps> = ({
  companySettings, order, customerBillingAddress, formattedDate,
  loadingInvoicePreview, invoiceDisplayParts, totals, formatAddress
}) => (
  <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
    <div className="grid grid-cols-2 gap-5 mb-5">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
        <p className="text-sm font-medium text-gray-900">{companySettings?.company_name || 'Sign House'}</p>
        <p className="text-xs text-gray-600 whitespace-pre-line">{companySettings?.company_address || ''}</p>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
        <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
        <p className="text-xs text-gray-600 whitespace-pre-line">{formatAddress(customerBillingAddress)}</p>
      </div>
    </div>
    <div className="mb-5">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</h4>
      <p className="text-sm text-gray-900">{formattedDate}</p>
    </div>
    <div className="mb-5">
      {loadingInvoicePreview ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">Loading preview...</span>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 font-medium text-gray-700 w-24">Item</th>
              <th className="text-left py-2 font-medium text-gray-700">QB Description</th>
              <th className="text-right py-2 font-medium text-gray-700 w-12">Qty</th>
              <th className="text-right py-2 font-medium text-gray-700 w-16">Price</th>
              <th className="text-right py-2 font-medium text-gray-700 w-16">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoiceDisplayParts.map((part) => (
              part.is_header_row ? (
                <tr key={part.key} className="bg-gray-100">
                  <td className="py-2"></td>
                  <td className="py-2 font-semibold text-gray-900 whitespace-pre-wrap">{part.qb_description || 'Section Header'}</td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                </tr>
              ) : (
                <tr key={part.key} className="border-b border-gray-200 align-top">
                  <td className="py-2 text-gray-900">{part.qb_item_name || '-'}</td>
                  <td className={`py-2 whitespace-pre-wrap ${part.is_default_description ? 'text-amber-600' : 'text-gray-600'}`}>
                    {!part.qb_description || !part.qb_description.trim() ? '' : <>{normalizeLF(part.qb_description)}{part.is_default_description && <div className="text-amber-500 italic text-[10px]">(default)</div>}</>}
                  </td>
                  <td className="py-2 text-right text-gray-600">{part.quantity}</td>
                  <td className="py-2 text-right text-gray-600">${Number(part.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2 text-right text-gray-900">${Number(part.extended_price || 0).toFixed(2)}</td>
                </tr>
              )
            ))}
            {invoiceDisplayParts.filter(p => !p.is_header_row).length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-500 italic">No line items</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
    <TotalsSection totals={totals} isCash={!!order.cash} depositRequired={!!order.deposit_required} />
  </div>
);
