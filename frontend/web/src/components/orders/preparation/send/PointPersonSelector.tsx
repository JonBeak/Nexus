/**
 * Point Person Selector Component
 * Phase 1.5.c.6.3: Send to Customer
 *
 * Allows user to select which point persons should receive the order email.
 * Features:
 * - Checkbox list of all point persons
 * - Select All / Deselect All buttons
 * - Counter showing N of M selected
 * - Visual indication of selected state
 */

import React from 'react';
import { Check } from 'lucide-react';

export interface PointPerson {
  id: number;
  name: string | null;
  email: string;
  selected: boolean;
}

interface Props {
  pointPersons: PointPerson[];
  onToggle: (personId: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const PointPersonSelector: React.FC<Props> = ({
  pointPersons,
  onToggle,
  onSelectAll,
  onDeselectAll
}) => {
  const selectedCount = pointPersons.filter(p => p.selected).length;
  const totalCount = pointPersons.length;

  // Empty state
  if (pointPersons.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-sm text-gray-600">
          No point persons configured for this order.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Point persons can be added in the order details page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with counter and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900">
            Select Recipients
          </h3>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            disabled={selectedCount === totalCount}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            disabled={selectedCount === 0}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Point person list */}
      <div className="space-y-2">
        {pointPersons.map((person) => (
          <button
            key={person.id}
            onClick={() => onToggle(person.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
              person.selected
                ? 'bg-indigo-50 border-indigo-300 hover:bg-indigo-100'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            {/* Checkbox */}
            <div
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                person.selected
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-white border-gray-300'
              }`}
            >
              {person.selected && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Person info */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                {person.name && (
                  <span className="text-sm font-medium text-gray-900">
                    {person.name}
                  </span>
                )}
                <span className={`text-sm ${person.name ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                  {person.email}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Warning if none selected */}
      {selectedCount === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            ⚠️ No recipients selected. You can finalize the order without sending an email,
            or select at least one recipient to send the email.
          </p>
        </div>
      )}
    </div>
  );
};
