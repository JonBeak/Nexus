import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { VinylItemOrderAssociation } from '../types';

interface JobChipProps {
  order: VinylItemOrderAssociation;
}

/**
 * JobChip - Displays a single job association as a clickable chip
 *
 * Shows job in format: "#1234 - Customer Name - Order Name"
 * Clicking navigates to the order detail page
 * Uses orange theme to match order module colors
 */
export const JobChip: React.FC<JobChipProps> = ({ order }) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click if chip is in a clickable row
    navigate(`/orders/${order.order_number}`);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer"
      title={`Order #${order.order_number}: ${order.order_name} (${order.customer_name})`}
    >
      #{order.order_number} - {order.customer_name} - {order.order_name}
    </button>
  );
};
