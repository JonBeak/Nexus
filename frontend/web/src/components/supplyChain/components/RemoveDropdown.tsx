/**
 * Remove Dropdown — Portal-rendered dropdown for removing items from grouped PO lines
 * Shows individual material requirements within a consolidated line for selective removal.
 * Created: 2026-02-11 (extracted from DraftPOCard)
 */

import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import type { GroupedLineItem } from './OrderItemTooltip';
import type { DraftPORequirement } from '../../../types/materialRequirements';

/** Format a single MR for the remove dropdown — shows qty, order/job name, and notes */
function formatDropdownItem(req: DraftPORequirement): { primary: string; secondary: string | null } {
  const unit = req.unit || req.unit_of_measure || 'each';
  const parts: string[] = [`${req.quantity_ordered} ${unit}`];
  if (req.order_number) parts.push(`Order #${req.order_number}`);
  if (req.order_name) parts.push(req.order_name);
  else if (req.is_stock_item) parts.push('Stock');
  return { primary: parts.join(' — '), secondary: req.notes || null };
}

/** Portal-rendered dropdown for removing individual items from a grouped line */
export const RemoveDropdown: React.FC<{
  group: GroupedLineItem; anchorRect: DOMRect;
  onRemoveItem: (id: number) => void; onRemoveAll: () => void; onClose: () => void;
}> = ({ group, anchorRect, onRemoveItem, onRemoveAll, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div ref={menuRef} className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-[9999] py-1 min-w-[180px]"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.right - 180 }}>
      <div className={`px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted}`}>
        Remove which item?
      </div>
      {group.items.map((req) => {
        const { primary, secondary } = formatDropdownItem(req);
        return (
          <button key={req.requirement_id} onClick={() => onRemoveItem(req.requirement_id)}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-start gap-2">
            <X className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className={PAGE_STYLES.panel.text}>{primary}</div>
              {secondary && (
                <div className={`${PAGE_STYLES.panel.textMuted} text-[10px] truncate`}>{secondary}</div>
              )}
            </div>
          </button>
        );
      })}
      <div className={`border-t ${PAGE_STYLES.panel.border} mt-1 pt-1`}>
        <button onClick={onRemoveAll}
          className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium">
          <X className="h-3 w-3 shrink-0" />
          Remove All ({group.items.length})
        </button>
      </div>
    </div>
  );
};
