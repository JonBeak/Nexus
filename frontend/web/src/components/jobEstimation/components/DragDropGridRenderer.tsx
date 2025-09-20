/**
 * DragDropGridRenderer - New drag-and-drop grid implementation
 * Replaces SimpleGridRenderer with full 12-column table layout and drag functionality
 * Uses Base Layer architecture and matches original GridBody formatting exactly
 */

import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GridRow } from '../core/types/LayerTypes';
import { DragDropRow } from './DragDropRow';

interface DragDropGridRendererProps {
  rows: GridRow[];
  productTypes: any[]; // Database product types
  staticDataCache?: Record<string, any[]>; // Database options cache
  onFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  onInsertRow: (afterIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDuplicateRow: (rowIndex: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
  isReadOnly: boolean;
  fieldPromptsMap?: Record<number, Record<string, string>>; // Prompts by product type
  fieldEnabledMap?: Record<number, Record<string, boolean>>; // Enable states by product type
  staticOptionsMap?: Record<number, Record<string, string[]>>; // Options by product type
  validationEngine?: any; // Reference to validation engine (placeholder)
}

export const DragDropGridRenderer: React.FC<DragDropGridRendererProps> = ({
  rows,
  productTypes,
  staticDataCache,
  onFieldCommit,
  onProductTypeSelect,
  onInsertRow,
  onDeleteRow,
  onDuplicateRow,
  onDragEnd,
  isReadOnly,
  fieldPromptsMap,
  fieldEnabledMap,
  staticOptionsMap,
  validationEngine
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
      // Throttle to 24fps for better performance
      pointerOptions: {
        throttle: 42, // ~24fps (1000ms / 24 = 41.7ms)
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get sortable items - only draggable rows
  const sortableItems = rows.filter(row => row.isDraggable).map(row => row.id);

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No rows to display</p>
        {!isReadOnly && (
          <button
            onClick={() => onInsertRow(-1)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add First Row
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        // Reduce animation frame rate for better performance
        measuring={{
          droppable: {
            strategy: 'when-dragging',
            frequency: 'optimized'
          }
        }}
      >
        <SortableContext 
          items={sortableItems} 
          strategy={verticalListSortingStrategy}
        >
          <table className="w-full text-sm table-fixed">
            {/* Header - matches original GridBody exactly */}
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="w-3.5 px-0 py-1 text-xs font-medium text-gray-600 text-center">#</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-left w-10">Product / Item</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-4">QTY</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 1</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 2</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 3</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 4</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 5</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 6</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 7</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 8</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 9</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Field 10</th>
                <th className="w-4 px-1 py-1 text-xs font-medium text-gray-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                // Calculate validation states for this row if validation engine provided
                const validationStates = validationEngine?.getValidationResults
                  ? Object.fromEntries(
                      Object.keys(row.data || {}).map(fieldName => [
                        fieldName,
                        validationEngine.getValidationResults().getCellValidationState(row.id, fieldName)
                      ])
                    )
                  : undefined;

                return (
                  <DragDropRow
                    key={row.id}
                    row={row}
                    rowIndex={index}
                    productTypes={productTypes}
                    staticDataCache={staticDataCache}
                    onFieldCommit={onFieldCommit}
                    onProductTypeSelect={onProductTypeSelect}
                    onInsertRow={onInsertRow}
                    onDeleteRow={onDeleteRow}
                    onDuplicateRow={onDuplicateRow}
                    isReadOnly={isReadOnly}
                    fieldPrompts={fieldPromptsMap?.[row.productTypeId || 0]}
                    fieldEnabled={fieldEnabledMap?.[row.productTypeId || 0]}
                    staticOptions={staticOptionsMap?.[row.productTypeId || 0]}
                    validationStates={validationStates}
                  />
                );
              })}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
};