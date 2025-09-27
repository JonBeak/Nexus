/**
 * DragDropRow - Individual draggable row component
 * Matches original GridRow formatting exactly with drag gripper and 12 fields
 * Uses Base Layer architecture for row state and capabilities
 */

import React from 'react';
import { Plus, GripVertical, Trash2, Copy, Eraser } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GridRow } from '../core/types/LayerTypes';
import { FieldCell } from './FieldCell';
import { ProductTypeSelector } from './ProductTypeSelector';

interface DragDropRowProps {
  row: GridRow;
  rowIndex: number;
  productTypes: any[]; // Database product types
  staticDataCache?: Record<string, any[]>; // Database options cache
  onFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  onInsertRow: (afterIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDuplicateRow: (rowIndex: number) => void;
  onClearRow: (rowIndex: number) => void;
  isReadOnly: boolean;
  fieldPrompts?: Record<string, string>; // Field prompts for this product type
  staticOptions?: Record<string, string[]>; // Static dropdown options
  validationStates?: Record<string, 'error' | 'warning' | 'valid'>; // Validation states
}

export const DragDropRow: React.FC<DragDropRowProps> = React.memo(({
  row,
  rowIndex,
  productTypes,
  staticDataCache,
  onFieldCommit,
  onProductTypeSelect,
  onInsertRow,
  onDeleteRow,
  onDuplicateRow,
  onClearRow,
  isReadOnly,
  fieldPrompts,
  staticOptions,
  validationStates
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: row.id,
    animateLayoutChanges: () => false,
    disabled: !row.isDraggable
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: isDragging ? '3px solid #3b82f6' : 'none',
  };

  // Calculate indentation for sub-items and continuation rows
  const indentStyle = { 
    paddingLeft: row.nestingLevel === 'sub' ? '16px' : '0px' 
  };

  const getFieldData = (colIndex: number) => {
    const fieldName = `field${colIndex + 1}`;
    const fieldValue = row.data?.[fieldName] ?? '';
    return { fieldName, fieldValue };
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 group hover:bg-gray-50 ${
        isDragging ? 'ring-2 ring-blue-300 bg-blue-50' : ''
      }`}
    >
      {/* Row Number & Drag Handle - matches original exactly */}
      <td className="w-4 px-0.5 py-0.25 border-r">
        <div className="flex items-center h-full">
          {/* Drag Handle - Left Aligned */}
          {row.isDraggable && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded mr-1"
            >
              <GripVertical className="w-4 h-4 opacity-60 group-hover:opacity-100 text-gray-500" />
            </div>
          )}

          {/* Row Number - Left Justified after handle */}
          {row.showRowNumber && (
            <span className={
              row.nestingLevel === 'sub'
                ? 'text-xs text-gray-500 pr-1.5'  // Sub-item numbering (1.a, 1.b)
                : 'text-sm text-black font-bold pr-1.5'  // Main numbering (1, 2, 3)
            }>
              {row.displayNumber}
            </span>
          )}
        </div>
      </td>
      
      {/* Product Type Selector */}
      <td className="px-2 py-0" style={indentStyle}>
        <ProductTypeSelector
          row={row}
          rowIndex={rowIndex}
          productTypes={productTypes}
          onProductTypeSelect={onProductTypeSelect}
          isReadOnly={isReadOnly}
        />
      </td>
      
      {/* QTY Column */}
      <td className="px-0.5 py-0 w-4 border-l border-gray-100">
        <FieldCell
          fieldName="quantity"
          fieldValue={row.data?.quantity || ''}
          fieldType="number"
          placeholder="QTY"
          isEditable={!isReadOnly && row.editableFields.includes('quantity')}
          onCommit={(value) => onFieldCommit(rowIndex, 'quantity', value)}
          staticDataCache={staticDataCache}
          fieldPrompt={fieldPrompts?.['quantity']}
          fieldEnabled={fieldPrompts?.['qty_enabled'] === true}
          validationState={validationStates?.['quantity']}
        />
      </td>
      
      {/* 10 Dynamic Field Columns */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(colIndex => {
        const { fieldName, fieldValue } = getFieldData(colIndex);

        return (
          <td key={colIndex} className="px-0.5 py-0 w-6 border-l border-gray-100">
            <FieldCell
              fieldName={fieldName}
              fieldValue={fieldValue}
              fieldType={(staticOptions?.[fieldName] && staticOptions[fieldName].length > 0) ? 'select' : 'text'}
              placeholder={`F${colIndex + 1}`}
              isEditable={!isReadOnly && row.editableFields.includes(fieldName)}
              onCommit={(value) => onFieldCommit(rowIndex, fieldName, value)}
              staticDataCache={staticDataCache}
              fieldPrompt={fieldPrompts?.[fieldName]}
              fieldEnabled={fieldPrompts?.[`${fieldName}_enabled`] === true}
              options={staticOptions?.[fieldName]}
              validationState={validationStates?.[fieldName]}
            />
          </td>
        );
      })}
      
      {/* Actions - add row button on all rows except continuation rows */}
      <td className="w-5 px-1 py-0 border-l">
        <div className="flex items-center justify-center gap-0.5">
          {/* Add Row button - show on all rows except continuation rows */}
          {!isReadOnly && row.rowType !== 'continuation' ? (
            <button
              onClick={() => onInsertRow(rowIndex)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Insert row"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}
          
          {/* Duplicate button - show when allowed */}
          {!isReadOnly && row.canDuplicate ? (
            <button
              onClick={() => onDuplicateRow(rowIndex)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}

          {/* Clear button - resets editable fields and quantity */}
          {!isReadOnly && row.editableFields?.length ? (
            <button
              onClick={() => onClearRow(rowIndex)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
              title="Clear row"
            >
              <Eraser className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}
          
          {/* Delete button - show when allowed */}
          {!isReadOnly && row.canDelete ? (
            <button
              onClick={() => onDeleteRow(rowIndex)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}
        </div>
      </td>
    </tr>
  );
});
