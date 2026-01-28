import React, { useState, useEffect } from 'react';
import { AutofillComboBox } from './AutofillComboBox';

export interface OrderSuggestion {
  order_id: number;
  order_number: number;
  order_name?: string;
  customer_name?: string;
}

interface OrderDropdownProps {
  value: string;  // order_id as string or empty
  onChange: (orderId: string) => void;
  orders: OrderSuggestion[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Formats an order for display in the dropdown
 */
const formatOrderDisplay = (order: OrderSuggestion): string => {
  const orderLabel = order.order_name || `#${order.order_number}`;
  return order.customer_name ? `${order.customer_name} - ${orderLabel}` : orderLabel;
};

export const OrderDropdown: React.FC<OrderDropdownProps> = ({
  value,
  onChange,
  orders,
  placeholder = 'Search orders...',
  className = '',
  inputClassName = ''
}) => {
  const [searchValue, setSearchValue] = useState('');

  // Find selected order and set display value
  const selectedOrder = orders.find(o => String(o.order_id) === value);
  const displayValue = selectedOrder ? formatOrderDisplay(selectedOrder) : searchValue;

  // Create suggestions from order display names
  const suggestions = orders.map(order => formatOrderDisplay(order));

  // Update search value when external value changes
  useEffect(() => {
    if (selectedOrder) {
      setSearchValue(formatOrderDisplay(selectedOrder));
    } else if (value === '' || value === undefined) {
      setSearchValue('');
    }
  }, [value, selectedOrder]);

  const handleValueChange = (newValue: string) => {
    setSearchValue(newValue);

    // Find order by display name
    const matchedOrder = orders.find(o =>
      formatOrderDisplay(o).toLowerCase() === newValue.toLowerCase()
    );

    if (matchedOrder) {
      onChange(String(matchedOrder.order_id));
    } else if (newValue === '') {
      onChange('');
    }
    // If partial match, don't trigger onChange yet
  };

  return (
    <div className={className}>
      <AutofillComboBox
        label=""
        value={displayValue}
        onChange={handleValueChange}
        suggestions={suggestions}
        placeholder={placeholder}
        inputClassName={inputClassName}
      />
    </div>
  );
};
