/**
 * Order Item Tooltip — Portal-rendered tooltip for DraftPO order items
 * Shows material requirement details on hover: order name, customer, notes.
 * For consolidated lines, shows all underlying material requirements.
 * Created: 2026-02-11
 */

import React, { useRef, useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import type { DraftPORequirement } from '../../../types/materialRequirements';

/** A grouped line item combining identical products across MRs */
export interface GroupedLineItem {
  groupKey: string;
  description: string;
  totalQuantity: number;
  unit: string;
  sku: string | null;
  orderRefs: string[];
  items: DraftPORequirement[];
}

/** Format a single MR for the tooltip display */
function formatTooltipItem(req: DraftPORequirement): {
  label: string;
  detail: string | null;
  notes: string | null;
} {
  const unit = req.unit || req.unit_of_measure || 'each';
  const qty = `${req.quantity_ordered} ${unit}`;

  let label: string;
  if (req.order_number) {
    const namePart = req.order_name ? ` — ${req.order_name}` : '';
    label = `${qty} — Order #${req.order_number}${namePart}`;
  } else if (req.is_stock_item) {
    label = `${qty} — Stock`;
  } else {
    label = qty;
  }

  const detail = req.customer_name || null;

  return { label, detail, notes: req.notes || null };
}

/** Portal-rendered tooltip showing material requirement details on hover */
export const OrderItemTooltip: React.FC<{
  group: GroupedLineItem;
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ group, anchorRect, onMouseEnter, onMouseLeave }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();

    // Position above the item by default, fall back to below if no room
    let top = anchorRect.top - tooltipRect.height - 6;
    if (top < 8) top = anchorRect.bottom + 6;

    // Center horizontally on the item, clamp to viewport
    let left = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    setPosition({ top, left });
  }, [anchorRect]);

  const isConsolidated = group.items.length > 1;

  return (
    <div
      ref={tooltipRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg shadow-xl z-[9999] py-2 px-3 max-w-[320px] pointer-events-auto"
      style={{ top: position.top, left: position.left }}
    >
      {isConsolidated && (
        <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-700">
          <Info className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">
            {group.items.length} orders consolidated
          </span>
        </div>
      )}
      <div className="space-y-1.5">
        {group.items.map((req) => {
          const { label, detail, notes } = formatTooltipItem(req);
          return (
            <div key={req.requirement_id} className={isConsolidated ? 'pl-1' : ''}>
              <div className="text-xs font-medium text-gray-100 leading-snug">{label}</div>
              {detail && (
                <div className="text-[10px] text-gray-400 leading-snug">{detail}</div>
              )}
              {notes && (
                <div className="text-[10px] text-amber-400 leading-snug mt-0.5 italic">
                  {notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
