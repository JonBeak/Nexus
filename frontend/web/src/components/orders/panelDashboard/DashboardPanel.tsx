/**
 * DashboardPanel Component
 * Single collapsible panel for displaying filtered orders
 *
 * Created: 2025-12-17
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { PanelWithData, PanelActionType, PanelOrderRow } from '../../../types/dashboardPanel';
import CompactOrderRow from './CompactOrderRow';

interface Props {
  panel: PanelWithData;
  onToggleCollapse: (panelId: number, collapsed: boolean) => void;
  onAction?: (order: PanelOrderRow, action: PanelActionType) => void;
}

// Helper to get icon component by name
const getIconComponent = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || LucideIcons.LayoutList;
};

export const DashboardPanel: React.FC<Props> = ({ panel, onToggleCollapse, onAction }) => {
  const [isCollapsed, setIsCollapsed] = useState(panel.is_collapsed);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggleCollapse(panel.panel_id, newState);
  };

  const IconComponent = getIconComponent(panel.icon_name);
  const showDaysInStatus = panel.filters?.showDaysInStatus;
  const showDaysOverdue = panel.filters?.dueDateRange === 'overdue';
  const hideStatus = panel.filters?.hideStatus;
  const hasActions = panel.filters?.actions && panel.filters.actions.length > 0;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer ${panel.color_class}`}
        onClick={handleToggle}
      >
        <div className="flex items-center space-x-3">
          <IconComponent className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">{panel.panel_name}</h3>
            {panel.description && (
              <p className="text-xs opacity-80">{panel.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="px-2 py-1 bg-white/30 rounded-full text-sm font-medium">
            {panel.total_count}
          </span>
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 py-2">
          {panel.orders.length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              No orders match this filter
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="text-xs text-gray-500 uppercase">
                  <tr className="border-b border-gray-200">
                    <th className="py-2 px-3 text-left font-medium">Order</th>
                    <th className="py-2 px-3 text-left font-medium">Customer</th>
                    <th className="py-2 px-3 text-left font-medium">Name</th>
                    <th className="py-2 px-3 text-left font-medium">Due</th>
                    {showDaysOverdue && (
                      <th className="py-2 px-3 text-left font-medium">Days Overdue</th>
                    )}
                    {!hideStatus && (
                      <th className="py-2 px-3 text-left font-medium">Status</th>
                    )}
                    {showDaysInStatus && (
                      <th className="py-2 px-3 text-left font-medium">Days</th>
                    )}
                    <th className="py-2 px-3 text-left font-medium w-20"></th>
                    {hasActions && (
                      <th className="py-2 px-3 text-left font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {panel.orders.map((order) => (
                    <CompactOrderRow
                      key={order.order_id}
                      order={order}
                      filters={panel.filters}
                      onAction={onAction}
                    />
                  ))}
                </tbody>
              </table>

              {/* View All Link */}
              {panel.total_count > panel.orders.length && (
                <div className="py-2 text-center border-t border-gray-100 mt-2">
                  <a
                    href={`/orders/table?panel=${panel.panel_key}`}
                    className="text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>View all {panel.total_count} orders</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPanel;
