/**
 * Multi-Hold Receive Modal
 * Handles receiving when multiple requirements hold the same vinyl
 * Created: 2026-02-04
 */

import React, { useState } from 'react';
import { X, AlertTriangle, CheckSquare, Square, Package } from 'lucide-react';
import { VinylHold, MaterialRequirement } from '../../../types/materialRequirements';
import { useModalBackdrop } from '../../../hooks/useModalBackdrop';

interface MultiHoldReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (alsoReceiveIds: number[]) => void;
  primaryRequirement: MaterialRequirement;
  otherHolds: VinylHold[];
}

export const MultiHoldReceiveModal: React.FC<MultiHoldReceiveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  primaryRequirement,
  otherHolds,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp
  } = useModalBackdrop({ isOpen, onClose });

  // Toggle selection for a hold
  const toggleSelection = (requirementId: number) => {
    setSelectedIds((prev) =>
      prev.includes(requirementId)
        ? prev.filter((id) => id !== requirementId)
        : [...prev, requirementId]
    );
  };

  // Select all
  const selectAll = () => {
    setSelectedIds(otherHolds.map((h) => h.material_requirement_id));
  };

  // Clear all
  const clearAll = () => {
    setSelectedIds([]);
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  if (!isOpen) return null;

  const unselectedCount = otherHolds.length - selectedIds.length;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className="relative top-20 mx-auto p-4 border w-full max-w-lg shadow-lg rounded bg-white"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Multiple Holds Detected</h3>
              <p className="text-xs text-gray-600 mt-1">
                This vinyl piece has holds from other orders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Primary Requirement */}
        <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
          <div className="text-xs font-medium text-purple-700 mb-1">Marking as Received:</div>
          <div className="text-sm text-gray-900">
            {primaryRequirement.order_number
              ? `${primaryRequirement.order_number}: ${primaryRequirement.order_name || 'N/A'}`
              : 'Stock Item'}
          </div>
          {primaryRequirement.customer_name && (
            <div className="text-xs text-gray-600">{primaryRequirement.customer_name}</div>
          )}
        </div>

        {/* Other Holds */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-medium text-gray-700">
              Also mark as received? ({otherHolds.length} other hold{otherHolds.length !== 1 ? 's' : ''})
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={clearAll}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {otherHolds.map((hold) => (
              <div
                key={hold.hold_id}
                onClick={() => toggleSelection(hold.material_requirement_id)}
                className={`border rounded p-2 cursor-pointer transition-colors ${
                  selectedIds.includes(hold.material_requirement_id)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {selectedIds.includes(hold.material_requirement_id) ? (
                    <CheckSquare className="h-4 w-4 text-purple-600" />
                  ) : (
                    <Square className="h-4 w-4 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm">
                      {hold.order_number
                        ? `${hold.order_number}: ${hold.order_name || 'N/A'}`
                        : 'Stock Item'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      {hold.customer_name && <span>{hold.customer_name}</span>}
                      <span className="text-purple-600">• {hold.quantity_held}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Warning for unselected */}
        {unselectedCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-orange-700">
                <span className="font-medium">{unselectedCount} unselected hold{unselectedCount !== 1 ? 's' : ''}</span>
                {' '}will be released. Those requirements will need to be sourced from a different vinyl piece or vendor.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-purple-600 hover:bg-purple-700"
          >
            Confirm & Receive ({selectedIds.length + 1})
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiHoldReceiveModal;
