/**
 * InvoiceSummary Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Displays invoice totals: subtotal, tax, and total
 * Memoized calculation based on parts and tax rules
 */

import React, { useMemo } from 'react';
import { OrderPart } from '@/types/orders';
import { TaxRule } from '../constants/tableConstants';
import { formatCurrency } from '../utils/formatting';

interface InvoiceSummaryProps {
  parts: OrderPart[];
  taxName?: string;
  taxRules: TaxRule[];
}

export const InvoiceSummary: React.FC<InvoiceSummaryProps> = ({
  parts,
  taxName,
  taxRules
}) => {
  // Calculate invoice totals
  const invoiceSummary = useMemo(() => {
    // Calculate subtotal from all parts
    const subtotal = parts.reduce((sum, part) => {
      const extended = parseFloat(part.extended_price?.toString() || '0');
      return sum + extended;
    }, 0);

    // Calculate tax based on tax_name
    let taxDecimal = 0;
    let taxPercentDisplay = 0;
    if (taxName && taxRules.length > 0) {
      const taxRule = taxRules.find(rule => rule.tax_name === taxName);
      if (taxRule) {
        // tax_percent in DB is stored as decimal (e.g., 0.13 for 13%)
        taxDecimal = parseFloat(taxRule.tax_percent.toString());
        taxPercentDisplay = taxDecimal * 100; // Convert to percentage for display
      }
    }

    // Calculate tax amount (taxDecimal is already in decimal form, no division needed)
    const taxAmount = subtotal * taxDecimal;
    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxPercent: taxPercentDisplay,
      taxAmount,
      total
    };
  }, [parts, taxName, taxRules]);

  return (
    <div className="border-t-2 border-gray-300 bg-gray-50 p-3">
      <div className="flex flex-col space-y-1 max-w-xs ml-auto">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(invoiceSummary.subtotal)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {taxName ? `${taxName} ` : 'Tax '}({invoiceSummary.taxPercent.toFixed(2).replace(/\.00$/, '')}%):
          </span>
          <span className="font-medium text-gray-900">
            {formatCurrency(invoiceSummary.taxAmount)}
          </span>
        </div>

        <div className="flex justify-between text-base border-t pt-1">
          <span className="font-semibold text-gray-900">Total:</span>
          <span className="font-bold text-gray-900">
            {formatCurrency(invoiceSummary.total)}
          </span>
        </div>
      </div>
    </div>
  );
};
