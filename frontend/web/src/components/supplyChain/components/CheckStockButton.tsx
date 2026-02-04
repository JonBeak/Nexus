/**
 * Check Stock Button Component
 * Shows stock availability and triggers stock selection modal
 * Created: 2026-02-04
 */

import React from 'react';
import { Package } from 'lucide-react';
import { MaterialRequirement } from '../../../types/materialRequirements';
import { useStockAvailability } from '../hooks/useStockAvailability';

interface CheckStockButtonProps {
  requirement: MaterialRequirement;
  onCheckStock: (stockType: 'vinyl' | 'general') => void;
}

export const CheckStockButton: React.FC<CheckStockButtonProps> = ({
  requirement,
  onCheckStock,
}) => {
  const { hasStock, stockType, checking } = useStockAvailability(requirement);

  // Don't show if no product type selected
  if (!requirement.archetype_id) {
    return null;
  }

  // Don't show if vendor already selected
  if (requirement.supplier_id !== null) {
    return null;
  }

  // Don't show if already has a hold
  if (requirement.held_vinyl_id !== null || requirement.held_supplier_product_id !== null) {
    return null;
  }

  if (checking) {
    return (
      <span className="text-xs text-gray-400 italic flex items-center gap-1">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Checking...
      </span>
    );
  }

  if (!hasStock || !stockType) {
    return (
      <span className="text-xs text-gray-400 italic">
        No stock
      </span>
    );
  }

  return (
    <button
      onClick={() => onCheckStock(stockType)}
      className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors flex items-center gap-1"
      title="Check existing inventory for this item"
    >
      <Package className="h-3 w-3" />
      Check Stock
    </button>
  );
};

export default CheckStockButton;
