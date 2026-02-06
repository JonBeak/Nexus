import React, { useState } from 'react';
import { Building } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { CustomerSelector, Customer } from './CustomerSelector';
import { QBInvoicePaymentSection } from './QBInvoicePaymentSection';
import { CashOrderPaymentSection } from './CashOrderPaymentSection';

export const PaymentsTab: React.FC = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Customer Selector - Top Bar */}
        <CustomerSelector
          selectedCustomer={selectedCustomer}
          onSelectCustomer={handleSelectCustomer}
          onClearCustomer={handleClearCustomer}
        />

        {/* Two-Column Layout: QB Invoices | Cash Orders */}
        {!selectedCustomer ? (
          <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-12 text-center`}>
            <Building className="w-12 h-12 text-[var(--theme-text-muted)] mx-auto mb-4" />
            <p className={PAGE_STYLES.panel.textMuted}>Select a customer to view their open invoices and cash orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Left: QB Invoices */}
            <div>
              <QBInvoicePaymentSection customerId={selectedCustomer.customer_id} />
            </div>

            {/* Right: Cash Orders */}
            <div>
              <CashOrderPaymentSection customerId={selectedCustomer.customer_id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsTab;
