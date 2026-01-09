/**
 * EditableOptionsList - Sortable list of specification options with drag-and-drop
 * Uses @dnd-kit for drag-and-drop reordering
 */

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, Lock } from 'lucide-react';
import { SpecificationOption } from '../../services/api/settings';

// =============================================================================
// Sortable Option Row Component
// =============================================================================

interface SortableOptionRowProps {
  option: SpecificationOption;
  onEdit: (option: SpecificationOption) => void;
  onDeactivate: (optionId: number) => void;
}

const SortableOptionRow: React.FC<SortableOptionRowProps> = ({
  option,
  onEdit,
  onDeactivate
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: option.option_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: isDragging ? '3px solid #3b82f6' : 'none'
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      {/* Drag Handle */}
      <td className="px-4 py-3 w-12">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      </td>

      {/* Option Value */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-900">{option.option_value}</span>
          {!!option.is_system && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              title="System option - cannot be deleted"
            >
              <Lock className="w-3 h-3" />
              System
            </span>
          )}
        </div>
      </td>

      {/* Display Order */}
      <td className="px-4 py-3 w-16 text-center">
        <span className="text-sm text-gray-500">{option.display_order}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-24">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(option)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit option"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {!option.is_system && (
            <button
              onClick={() => {
                if (window.confirm(`Deactivate "${option.option_value}"? It will no longer appear in dropdowns.`)) {
                  onDeactivate(option.option_id);
                }
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Deactivate option"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// =============================================================================
// Main Editable Options List Component
// =============================================================================

interface EditableOptionsListProps {
  options: SpecificationOption[];
  onEdit: (option: SpecificationOption) => void;
  onDeactivate: (optionId: number) => void;
  onReorder: (newOrder: SpecificationOption[]) => void;
  disabled?: boolean;
}

export const EditableOptionsList: React.FC<EditableOptionsListProps> = ({
  options,
  onEdit,
  onDeactivate,
  onReorder,
  disabled = false
}) => {
  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px movement before starting drag
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Handle drag end - reorder the list
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = options.findIndex(o => o.option_id === active.id);
      const newIndex = options.findIndex(o => o.option_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create new array with moved item
        const newOptions = arrayMove(options, oldIndex, newIndex);
        // Update display_order values
        const reordered = newOptions.map((opt, idx) => ({
          ...opt,
          display_order: idx + 1
        }));
        onReorder(reordered);
      }
    }
  };

  if (options.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No options in this category yet.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={options.map(o => o.option_id)}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  {/* Drag handle column */}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {options.map(option => (
                <SortableOptionRow
                  key={option.option_id}
                  option={option}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default EditableOptionsList;
