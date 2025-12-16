/**
 * PanelSelectionModal Component
 * Modal for users to select and reorder their dashboard panels
 *
 * Created: 2025-12-17
 */

import React, { useState, useEffect } from 'react';
import { X, GripVertical, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { DashboardPanelDefinition } from '../../../types/dashboardPanel';

interface Props {
  availablePanels: DashboardPanelDefinition[];
  selectedPanelIds: number[];
  onSave: (panelIds: number[]) => void;
  onClose: () => void;
}

// Helper to get icon component by name
const getIconComponent = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || LucideIcons.LayoutList;
};

export const PanelSelectionModal: React.FC<Props> = ({
  availablePanels,
  selectedPanelIds,
  onSave,
  onClose
}) => {
  const [selected, setSelected] = useState<number[]>(selectedPanelIds);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  // Initialize selected panels in order
  useEffect(() => {
    setSelected(selectedPanelIds);
  }, [selectedPanelIds]);

  const handleTogglePanel = (panelId: number) => {
    setSelected(prev => {
      if (prev.includes(panelId)) {
        return prev.filter(id => id !== panelId);
      } else {
        return [...prev, panelId];
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, panelId: number) => {
    setDraggedItem(panelId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetId) return;

    setSelected(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedItem);
      const targetIndex = newOrder.indexOf(targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);

      return newOrder;
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleSave = () => {
    onSave(selected);
  };

  // Get panels in display order (selected first in their order, then unselected)
  const selectedPanels = selected
    .map(id => availablePanels.find(p => p.panel_id === id))
    .filter((p): p is DashboardPanelDefinition => p !== undefined);

  const unselectedPanels = availablePanels.filter(
    p => !selected.includes(p.panel_id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Configure Dashboard Panels</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Selected Panels Section */}
          {selectedPanels.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Selected Panels (drag to reorder)
              </h3>
              <div className="space-y-2">
                {selectedPanels.map((panel) => {
                  const IconComponent = getIconComponent(panel.icon_name);
                  return (
                    <div
                      key={panel.panel_id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, panel.panel_id)}
                      onDragOver={(e) => handleDragOver(e, panel.panel_id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleTogglePanel(panel.panel_id)}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        draggedItem === panel.panel_id
                          ? 'border-indigo-500 bg-indigo-50 opacity-50'
                          : 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100'
                      }`}
                    >
                      <GripVertical className="w-5 h-5 text-gray-400 mr-3 cursor-grab" />
                      <div className={`p-2 rounded-lg ${panel.color_class} mr-3`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{panel.panel_name}</div>
                        {panel.description && (
                          <div className="text-xs text-gray-500">{panel.description}</div>
                        )}
                      </div>
                      <div className="p-1 bg-indigo-500 rounded-full">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Panels Section */}
          {unselectedPanels.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Available Panels
              </h3>
              <div className="space-y-2">
                {unselectedPanels.map((panel) => {
                  const IconComponent = getIconComponent(panel.icon_name);
                  return (
                    <div
                      key={panel.panel_id}
                      onClick={() => handleTogglePanel(panel.panel_id)}
                      className="flex items-center p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-all"
                    >
                      <div className="w-5 h-5 mr-3" /> {/* Spacer for alignment */}
                      <div className={`p-2 rounded-lg ${panel.color_class} mr-3`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{panel.panel_name}</div>
                        {panel.description && (
                          <div className="text-xs text-gray-500">{panel.description}</div>
                        )}
                      </div>
                      <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {availablePanels.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No panels available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {selected.length} panel{selected.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelSelectionModal;
