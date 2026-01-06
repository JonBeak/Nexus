/**
 * Point Person Selector Component
 * Phase 1.5.c.6.3: Send to Customer
 *
 * Allows user to select which point persons should receive the order email
 * with To/CC/BCC options for each contact.
 *
 * Features:
 * - To/CC/BCC checkboxes per contact (matching EstimateEmailPreviewModal pattern)
 * - Column headers with labels
 * - "All To" / "Clear All" quick actions
 * - Visual indication of selected state
 * - Returns recipients grouped by type
 */

import React from 'react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';

export type RecipientType = 'to' | 'cc' | 'bcc';

export interface PointPerson {
  id: number;
  name: string | null;
  email: string;
}

export interface RecipientSelection {
  to: string[];
  cc: string[];
  bcc: string[];
}

interface Props {
  pointPersons: PointPerson[];
  recipientTypes: Map<string, RecipientType>;
  onRecipientTypeChange: (email: string, type: RecipientType | null) => void;
  onSelectAllTo: () => void;
  onClearAll: () => void;
}

export const PointPersonSelector: React.FC<Props> = ({
  pointPersons,
  recipientTypes,
  onRecipientTypeChange,
  onSelectAllTo,
  onClearAll
}) => {
  // Filter to only show contacts with email addresses
  const pointPersonsWithEmail = pointPersons.filter(p => p.email);

  // Empty state
  if (pointPersonsWithEmail.length === 0) {
    return (
      <div className={`p-6 ${PAGE_STYLES.header.background} border ${PAGE_STYLES.border} rounded-lg text-center`}>
        <p className={`text-sm ${PAGE_STYLES.panel.text}`}>
          No point persons configured for this order.
        </p>
        <p className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-2`}>
          Point persons can be added in the order details page.
        </p>
      </div>
    );
  }

  // Count selections
  const toCount = Array.from(recipientTypes.values()).filter(t => t === 'to').length;
  const ccCount = Array.from(recipientTypes.values()).filter(t => t === 'cc').length;
  const bccCount = Array.from(recipientTypes.values()).filter(t => t === 'bcc').length;
  const totalSelected = toCount + ccCount + bccCount;

  return (
    <div className={`border ${PAGE_STYLES.border} rounded-lg overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.border}`}>
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
            Select Recipients
          </h3>
          {totalSelected > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              {totalSelected} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onSelectAllTo}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            All To
          </button>
          <span className={PAGE_STYLES.panel.textMuted}>|</span>
          <button
            onClick={onClearAll}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${PAGE_STYLES.border} ${PAGE_STYLES.header.background}`}>
        <div className={`flex-1 text-xs font-medium ${PAGE_STYLES.header.text}`}>Contact</div>
        <div className={`flex items-center gap-4 text-xs font-medium ${PAGE_STYLES.header.text}`}>
          <span className="w-10 text-center">To</span>
          <span className="w-10 text-center">CC</span>
          <span className="w-10 text-center">BCC</span>
        </div>
      </div>

      {/* Point Person List */}
      <div className={`${PAGE_STYLES.composites.tableBody}`}>
        {pointPersonsWithEmail.map((person) => {
          const currentType = recipientTypes.get(person.email);
          const isSelected = currentType !== undefined;

          return (
            <div
              key={person.id}
              className={`flex items-center gap-2 px-4 py-3 transition-colors ${
                isSelected ? 'bg-blue-50' : PAGE_STYLES.interactive.hover
              }`}
            >
              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                  {person.name || person.email}
                </p>
                {person.name && person.name !== person.email && (
                  <p className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`}>
                    {person.email}
                  </p>
                )}
              </div>

              {/* To/CC/BCC Checkboxes */}
              <div className="flex items-center gap-4">
                <label className="w-10 flex justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentType === 'to'}
                    onChange={() => onRecipientTypeChange(
                      person.email,
                      currentType === 'to' ? null : 'to'
                    )}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <label className="w-10 flex justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentType === 'cc'}
                    onChange={() => onRecipientTypeChange(
                      person.email,
                      currentType === 'cc' ? null : 'cc'
                    )}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <label className="w-10 flex justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentType === 'bcc'}
                    onChange={() => onRecipientTypeChange(
                      person.email,
                      currentType === 'bcc' ? null : 'bcc'
                    )}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PointPersonSelector;
