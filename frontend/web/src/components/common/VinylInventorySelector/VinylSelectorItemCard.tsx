/**
 * Vinyl Selector Item Card
 * Detailed card for list view combining features from both old modals:
 * - Holds display with badges (from Supply Chain)
 * - Order associations (from Bulk Entries)
 * - Availability color coding (from Bulk Entries)
 * - Supplier, dates, notes (from Bulk Entries)
 */

import React from 'react';
import { CheckCircle, X, MapPin, Calendar, User } from 'lucide-react';
import { VinylItemWithHolds, VinylHold } from '../../../types/materialRequirements';

interface VinylSelectorItemCardProps {
  item: VinylItemWithHolds;
  isSelected: boolean;
  onSelect: () => void;
}

export const VinylSelectorItemCard: React.FC<VinylSelectorItemCardProps> = ({
  item,
  isSelected,
  onSelect,
}) => {
  const hasHolds = item.holds && item.holds.length > 0;
  const hasOrderAssociations = item.order_associations && item.order_associations.length > 0;

  return (
    <div
      onClick={onSelect}
      className={`border rounded p-3 cursor-pointer transition-all duration-200 hover:shadow-sm ${
        isSelected
          ? 'border-purple-500 bg-purple-50 shadow-sm'
          : 'border-green-200 bg-green-50 hover:border-purple-300'
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Item Details - ID, location, supplier */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className={`h-4 w-4 ${isSelected ? 'text-purple-600' : 'text-green-500'}`} />
            <span className="font-medium text-sm">#{item.id}</span>
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            {item.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{item.location}</span>
              </div>
            )}
            {item.supplier_name && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{item.supplier_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Size - Large and prominent */}
        <div className="lg:col-span-3 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">{item.width}"</span>
              <span className="text-xs text-gray-600">width</span>
            </div>
            <span className="text-gray-400">&times;</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-purple-600">{item.length_yards}</span>
              <span className="text-xs text-gray-600">yds ({Math.round(item.length_yards * 36)}")</span>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="lg:col-span-2 text-xs text-gray-600">
          <div className="space-y-1">
            {item.storage_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Stored: {new Date(item.storage_date).toLocaleDateString()}</span>
              </div>
            )}
            {item.usage_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Used: {new Date(item.usage_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Associations */}
        <div className="lg:col-span-3 text-xs text-gray-600">
          {hasOrderAssociations ? (
            <div>
              <div className="font-medium text-gray-700 mb-1">Orders:</div>
              <div className="space-y-0.5">
                {item.order_associations!.map((order, index) => (
                  <div key={index} className="text-blue-600 truncate">
                    {order.order_number} - {order.customer_name} - {order.order_name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">No order associations</span>
          )}
        </div>

        {/* Holds */}
        <div className="lg:col-span-2 text-right">
          {hasHolds ? (
            <div className="text-xs">
              <div className="font-medium text-orange-600 mb-1">
                {item.holds.length} hold{item.holds.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-0.5 max-w-[180px] ml-auto">
                {item.holds.slice(0, 3).map((hold) => (
                  <div key={hold.hold_id} className="text-blue-600 truncate">
                    {hold.quantity_held} - {hold.order_number || 'Stock'}: {hold.order_name || 'N/A'}
                  </div>
                ))}
                {item.holds.length > 3 && (
                  <div className="text-gray-400">+{item.holds.length - 3} more</div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-green-600">No holds</span>
          )}
        </div>
      </div>

      {/* Notes */}
      {item.notes && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Notes:</span> {item.notes}
          </p>
        </div>
      )}
    </div>
  );
};
