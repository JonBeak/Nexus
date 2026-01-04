import React from 'react';
import { Customer } from '../../../types';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface CustomerTableRowProps {
  customer: Customer;
  onDetailsClick: (customer: Customer) => Promise<void>;
  onReactivateClick: (customerId: number) => Promise<void>;
}

export const CustomerTableRow: React.FC<CustomerTableRowProps> = React.memo(({
  customer,
  onDetailsClick,
  onReactivateClick
}) => {
  const isDeactivated = !customer.active;

  return (
    <tr className={`${isDeactivated ? 'opacity-60' : ''} ${PAGE_STYLES.header.background} hover:bg-[var(--theme-hover-bg)] transition-colors`}>
      {/* Company */}
      <td className="px-2 py-1 min-w-48 max-w-56">
        <div className={`text-sm font-medium ${isDeactivated ? PAGE_STYLES.panel.textMuted : PAGE_STYLES.panel.text} truncate`} title={customer.company_name}>
          {customer.company_name}
        </div>
        {customer.quickbooks_name && customer.quickbooks_name !== customer.company_name && (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`} title={customer.quickbooks_name}>QB: {customer.quickbooks_name}</div>
        )}
      </td>

      {/* Location */}
      <td className={`px-2 py-1 text-sm ${PAGE_STYLES.panel.text}`}>
        {customer.city ? `${customer.city}, ${customer.state || ''}` : (customer.state || '-')}
      </td>
      
      {/* Cash */}
      <td className="px-1 py-1 text-center text-xs">
        {customer.cash_yes_or_no
          ? <span className="inline-block px-1 rounded bg-green-100 text-green-800">Y</span>
          : <span className={PAGE_STYLES.panel.textMuted}>-</span>
        }
      </td>

      {/* LEDs */}
      <td className={`px-2 py-1 text-xs ${PAGE_STYLES.panel.text}`}>
        {customer.leds_yes_or_no ? (customer.leds_default_type || 'Default') : '-'}
      </td>

      {/* Power Supply */}
      <td className={`px-2 py-1 text-xs ${PAGE_STYLES.panel.text} min-w-20`}>
        {customer.powersupply_yes_or_no ? (customer.powersupply_default_type || 'Default') : '-'}
      </td>

      {/* UL */}
      <td className="px-1 py-1 text-center text-xs">
        {customer.ul_yes_or_no
          ? <span className="inline-block px-1 rounded bg-purple-100 text-purple-800">Y</span>
          : <span className={PAGE_STYLES.panel.textMuted}>-</span>
        }
      </td>

      {/* Drain Holes */}
      <td className="px-1 py-1 text-center text-xs">
        {customer.drain_holes_yes_or_no
          ? <span className="inline-block px-1 rounded bg-blue-100 text-blue-800">Y</span>
          : <span className={PAGE_STYLES.panel.textMuted}>-</span>
        }
      </td>

      {/* Plug & Play */}
      <td className="px-1 py-1 text-center text-xs">
        {customer.plug_n_play_yes_or_no
          ? <span className="inline-block px-1 rounded bg-indigo-100 text-indigo-800">Y</span>
          : <span className={PAGE_STYLES.panel.textMuted}>-</span>
        }
      </td>

      {/* Special Instructions */}
      <td className={`px-2 py-1 text-xs ${PAGE_STYLES.panel.text} min-w-40 max-w-48 truncate`} title={customer.special_instructions || ''}>
        {customer.special_instructions || '-'}
      </td>

      {/* Notes */}
      <td className={`px-2 py-1 text-xs ${PAGE_STYLES.panel.text} min-w-40 max-w-48 truncate`} title={customer.comments || ''}>
        {customer.comments || '-'}
      </td>

      {/* Actions */}
      <td className="px-1 py-1 text-right">
        {isDeactivated ? (
          <button
            onClick={() => onReactivateClick(customer.customer_id)}
            className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-xs transition-colors"
          >
            Reactivate
          </button>
        ) : (
          <button
            onClick={() => onDetailsClick(customer)}
            className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-2 py-0.5 rounded text-xs transition-colors`}
          >
            Details
          </button>
        )}
      </td>
    </tr>
  );
});
