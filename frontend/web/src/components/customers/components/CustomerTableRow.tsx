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
      <td className="px-2 py-2 w-48">
        <div className="flex items-center">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 ${isDeactivated ? 'bg-gray-400' : MODULE_COLORS.customers.base}`}>
            <span className="text-white font-bold text-xs">
              {customer.company_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className={`text-sm font-medium ${isDeactivated ? PAGE_STYLES.panel.textMuted : PAGE_STYLES.panel.text}`}>
              {customer.company_name}
            </div>
            {customer.quickbooks_name && customer.quickbooks_name !== customer.company_name && (
              <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>QB: {customer.quickbooks_name}</div>
            )}
          </div>
        </div>
      </td>
      
      {/* Invoice Email */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-32`}>
        <div className="truncate" title={customer.invoice_email || ''}>
          {customer.invoice_email || '-'}
        </div>
      </td>

      {/* Invoice Instructions */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-20`}>
        <div className="break-words" title={customer.invoice_email_preference || ''}>
          {customer.invoice_email_preference || '-'}
        </div>
      </td>

      {/* Location */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-24`}>
        <div>
          <div>{customer.city || '-'}</div>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>{customer.state || '-'}</div>
        </div>
      </td>
      
      {/* Cash */}
      <td className="px-2 py-2 whitespace-nowrap text-center text-sm">
        <span className={`inline-flex px-1 py-0.5 text-sm font-semibold rounded ${
          customer.cash_yes_or_no 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {customer.cash_yes_or_no ? 'Yes' : 'No'}
        </span>
      </td>
      
      {/* LEDs */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-20`}>
        <div className="break-words" title={
          customer.leds_yes_or_no ?
            (customer.leds_default_type ?
              customer.leds_default_type
              : 'System Default'
            ) : 'No'
        }>
          {customer.leds_yes_or_no ?
            (customer.leds_default_type ?
              customer.leds_default_type
              : 'Default'
            ) : 'No'
          }
        </div>
      </td>

      {/* Power Supply */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-20`}>
        <div className="break-words" title={
          customer.powersupply_yes_or_no ?
            (customer.powersupply_default_type ?
              customer.powersupply_default_type
              : 'System Default'
            ) : 'No'
        }>
          {customer.powersupply_yes_or_no ?
            (customer.powersupply_default_type ?
              customer.powersupply_default_type
              : 'Default'
            ) : 'No'
          }
        </div>
      </td>
      
      {/* UL */}
      <td className="px-2 py-2 whitespace-nowrap text-center text-sm">
        <span className={`inline-flex px-1 py-0.5 text-sm font-semibold rounded ${
          customer.ul_yes_or_no 
            ? 'bg-purple-100 text-purple-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {customer.ul_yes_or_no ? 'Yes' : 'No'}
        </span>
      </td>
      
      {/* Drain Holes */}
      <td className="px-2 py-2 whitespace-nowrap text-center text-sm">
        <span className={`inline-flex px-1 py-0.5 text-sm font-semibold rounded ${
          customer.drain_holes_yes_or_no
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {customer.drain_holes_yes_or_no ? 'Yes' : 'No'}
        </span>
      </td>
      
      {/* Plug & Play */}
      <td className="px-2 py-2 whitespace-nowrap text-center text-sm">
        <span className={`inline-flex px-1 py-0.5 text-sm font-semibold rounded ${
          customer.plug_n_play_yes_or_no 
            ? 'bg-indigo-100 text-indigo-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {customer.plug_n_play_yes_or_no ? 'Yes' : 'No'}
        </span>
      </td>
      
      {/* Special Instructions */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-20`}>
        <div className="break-words" title={customer.special_instructions || ''}>
          {customer.special_instructions || '-'}
        </div>
      </td>

      {/* Notes */}
      <td className={`px-2 py-2 text-sm ${PAGE_STYLES.panel.text} w-20`}>
        <div className="break-words" title={customer.comments || ''}>
          {customer.comments || '-'}
        </div>
      </td>

      {/* Actions */}
      <td className="px-2 py-2 whitespace-nowrap text-right text-xs font-medium w-16">
        <div className="flex justify-end">
          {isDeactivated ? (
            <button
              onClick={() => onReactivateClick(customer.customer_id)}
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-semibold transition-colors"
            >
              Reactivate
            </button>
          ) : (
            <button
              onClick={() => onDetailsClick(customer)}
              className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-2 py-1 rounded text-xs font-semibold transition-colors`}
            >
              Details
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});
