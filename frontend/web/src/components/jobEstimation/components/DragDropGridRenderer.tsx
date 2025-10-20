/**
 * DragDropGridRenderer - New drag-and-drop grid implementation
 * Replaces SimpleGridRenderer with full 12-column table layout and drag functionality
 * Uses Base Layer architecture and matches original GridBody formatting exactly
 */

import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GridRow } from '../core/types/LayerTypes';
import { DragDropRow } from './DragDropRow';
import { ProductType } from '../hooks/useProductTypes';
import { GridEngine } from '../core/GridEngine';

interface DragDropGridRendererProps {
  rows: GridRow[];
  productTypes: ProductType[];
  staticDataCache?: Record<string, string[]>;
  onFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  onInsertRow: (afterIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDuplicateRow: (rowIndex: number) => void;
  onClearRow: (rowIndex: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
  isReadOnly: boolean;
  fieldPromptsMap?: Record<number, Record<string, string>>; // Prompts by product type
  staticOptionsMap?: Record<number, Record<string, string[]>>; // Options by product type
  validationEngine?: GridEngine;
  validationVersion?: number;
  hoveredRowId?: string | null; // Cross-component hover state
  onRowHover?: (rowId: string | null) => void; // Hover handler
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
  onClearRow,
  onDragEnd,
  isReadOnly,
  fieldPromptsMap,
  staticOptionsMap,
  validationEngine,
  validationVersion = 0,
  hoveredRowId = null,
  onRowHover = () => {}
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
    <div>
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
          <table className="w-full text-sm table-fixed min-w-[1100px]">
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
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                // Calculate validation states for this row if validation engine provided
                const validationManager = validationEngine?.getValidationResults?.();
                const baseFieldNames = ['quantity', 'field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8', 'field9', 'field10'];
                const dataFieldNames = Object.keys(row.data || {});
                const fieldNames = new Set<string>([...baseFieldNames, ...dataFieldNames]);
                void validationVersion; // Ensure updates trigger re-computation
                const validationStates = validationManager
                  ? Object.fromEntries(
                      Array.from(fieldNames).map(fieldName => [
                        fieldName,
                        validationManager.getCellValidationState(row.id, fieldName)
                      ])
                    )
                  : undefined;

                // Check for structure errors (e.g., sub-item placement issues)
                const structureError = validationManager?.getStructureError?.(row.id);

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
                    onClearRow={onClearRow}
                    isReadOnly={isReadOnly}
                    fieldPrompts={fieldPromptsMap?.[row.productTypeId || 0]}
                    staticOptions={staticOptionsMap?.[row.productTypeId || 0]}
                    validationStates={validationStates}
                    structureError={structureError}
                    hoveredRowId={hoveredRowId}
                    onRowHover={onRowHover}
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
