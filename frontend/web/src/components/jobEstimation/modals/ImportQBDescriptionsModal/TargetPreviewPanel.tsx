/**
 * TargetPreviewPanel
 *
 * Right column of the Import QB Descriptions modal.
 * Shows read-only preview of current estimate items.
 * Highlights rows that will be affected by the import.
 */

import React from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import {
  TargetPreviewPanelProps,
  TargetPreparationItem,
  StagedRow
} from './types';

export const TargetPreviewPanel: React.FC<TargetPreviewPanelProps> = ({
  targetItems,
  stagedRows
}) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Check if a target row will be updated
  const willBeUpdated = (index: number) => {
    return index < stagedRows.length;
  };

  // Get the staged row for a target index
  const getStagedRowForIndex = (index: number): StagedRow | undefined => {
    return stagedRows[index];
  };

  // Calculate overflow rows
  const overflowCount = Math.max(0, stagedRows.length - targetItems.length);
  const overflowRows = stagedRows.slice(targetItems.length);

  return (
    <div className="flex flex-col h-full">
      {/* Column Headers */}
      <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
        <div className="w-8 px-2 py-1.5">#</div>
        <div className="flex-1 px-2 py-1.5">QB Description</div>
        <div className="w-16 px-2 py-1.5 text-center">Qty</div>
        <div className="w-20 px-2 py-1.5 text-right">Unit$</div>
      </div>

      {/* Target Rows */}
      <div className="flex-1 overflow-y-auto">
        {targetItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            No items in current estimate
          </div>
        ) : (
          <>
            {/* Existing Target Rows */}
            {targetItems.map((item, index) => {
              const isUpdating = willBeUpdated(index);
              const stagedRow = getStagedRowForIndex(index);

              return (
                <div
                  key={item.id}
                  className={`flex border-b text-sm ${
                    isUpdating
                      ? 'bg-amber-50 border-amber-200'
                      : 'border-gray-100'
                  }`}
                >
                  {/* Row Number */}
                  <div className="w-8 px-2 py-1.5 text-xs text-gray-400 flex items-center">
                    {index + 1}
                    {isUpdating && (
                      <ArrowRight className="w-3 h-3 ml-0.5 text-amber-500" />
                    )}
                  </div>

                  {/* QB Description */}
                  <div className="flex-1 px-2 py-1.5">
                    <div className="text-xs line-clamp-2">
                      {isUpdating && stagedRow?.selectedCells.has('qb_description') ? (
                        <span className="text-amber-700">
                          {stagedRow.data.qb_description || <em className="text-gray-400">empty</em>}
                        </span>
                      ) : (
                        item.qb_description || <span className="text-gray-400 italic">No description</span>
                      )}
                    </div>
                    {isUpdating && stagedRow?.selectedCells.has('qb_description') && item.qb_description && (
                      <div className="text-xs text-gray-400 line-through mt-0.5 line-clamp-1">
                        {item.qb_description}
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="w-16 px-2 py-1.5 text-xs text-center">
                    {isUpdating && stagedRow?.selectedCells.has('quantity') ? (
                      <>
                        <span className="text-amber-700">{stagedRow.data.quantity}</span>
                        {stagedRow.data.quantity !== item.quantity && (
                          <span className="text-gray-400 line-through ml-1">{item.quantity}</span>
                        )}
                      </>
                    ) : (
                      item.quantity
                    )}
                  </div>

                  {/* Unit Price */}
                  <div className="w-20 px-2 py-1.5 text-xs text-right">
                    {isUpdating && stagedRow?.selectedCells.has('unit_price') ? (
                      <>
                        <span className="text-amber-700">{formatCurrency(stagedRow.data.unit_price)}</span>
                        {stagedRow.data.unit_price !== item.unit_price && (
                          <div className="text-gray-400 line-through text-xs">
                            {formatCurrency(item.unit_price)}
                          </div>
                        )}
                      </>
                    ) : (
                      formatCurrency(item.unit_price)
                    )}
                  </div>
                </div>
              );
            })}

            {/* Overflow Rows (New Rows to be Created) */}
            {overflowRows.map((row, index) => (
              <div
                key={row.id}
                className="flex border-b border-green-200 bg-green-50 text-sm"
              >
                {/* Row Number */}
                <div className="w-8 px-2 py-1.5 text-xs text-green-600 flex items-center">
                  <Plus className="w-3 h-3 mr-0.5" />
                  {targetItems.length + index + 1}
                </div>

                {/* QB Description */}
                <div className="flex-1 px-2 py-1.5">
                  <div className="text-xs text-green-700 line-clamp-2">
                    {row.data.qb_description || <em className="text-gray-400">No description</em>}
                  </div>
                  <div className="text-xs text-green-500 mt-0.5">
                    New row from {row.sourceEstimateName}
                  </div>
                </div>

                {/* Quantity */}
                <div className="w-16 px-2 py-1.5 text-xs text-center text-green-700">
                  {row.data.quantity}
                </div>

                {/* Unit Price */}
                <div className="w-20 px-2 py-1.5 text-xs text-right text-green-700">
                  {formatCurrency(row.data.unit_price)}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-50 border border-amber-200 rounded"></div>
            <span>Will be updated</span>
          </div>
          {overflowCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
              <span>New row</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
