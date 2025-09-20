/**
 * DragDropRow - Individual draggable row component
 * Matches original GridRow formatting exactly with drag gripper and 12 fields
 * Uses Base Layer architecture for row state and capabilities
 */

import React from 'react';
import { Plus, GripVertical, Trash2, Copy } from 'lucide-react';
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
  isReadOnly: boolean;
  fieldPrompts?: Record<string, string>; // Field prompts for this product type
  fieldEnabled?: Record<string, boolean>; // Field enable states
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
  isReadOnly,
  fieldPrompts,
  fieldEnabled,
  staticOptions,
  validationStates
}) => {
  // Use sortable for draggable rows only
  const sortableConfig = row.isDraggable ? useSortable({ 
    id: row.id,
    animateLayoutChanges: () => false  // Disable row movement animations
  }) : null;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = sortableConfig || {
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false
  };

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

  // Get field data for 12 columns - using existing row data structure
  const getFieldData = (colIndex: number) => {
    const fieldKeys = Object.keys(row.data);
    const fieldName = fieldKeys[colIndex];
    const fieldValue = fieldName ? row.data[fieldName] : '';
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
      <td className="w-4 px-0.5 py-1 border-r">
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
      <td className="px-2 py-0.5" style={indentStyle}>
        <ProductTypeSelector
          row={row}
          rowIndex={rowIndex}
          productTypes={productTypes}
          onProductTypeSelect={onProductTypeSelect}
          isReadOnly={isReadOnly}
        />
      </td>
      
      {/* QTY Column */}
      <td className="px-1 py-0.5 w-5 border-l border-gray-100">
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
          <td key={colIndex} className="px-1 py-0.5 w-6 border-l border-gray-100">
            {fieldName && (
              <FieldCell
                fieldName={fieldName}
                fieldValue={fieldValue}
                fieldType={(staticOptions?.[fieldName] && staticOptions[fieldName].length > 0) ? "select" : "text"}
                placeholder={`F${colIndex + 1}`}
                isEditable={!isReadOnly && row.editableFields.includes(fieldName)}
                onCommit={(value) => onFieldCommit(rowIndex, fieldName, value)}
                staticDataCache={staticDataCache}
                fieldPrompt={fieldPrompts?.[fieldName]}
                fieldEnabled={fieldPrompts?.[`${fieldName}_enabled`] === true}
                options={staticOptions?.[fieldName]}
                validationState={validationStates?.[fieldName]}
              />
            )}
          </td>
        );
      })}
      
      {/* Actions - add row button on all rows except continuation rows */}
      <td className="w-4 px-1.5 py-0.5 border-l">
        <div className="flex items-center space-x-1">
          {/* Add Row button - show on all rows except continuation rows */}
          {!isReadOnly && row.rowType !== 'continuation' ? (
            <button
              onClick={() => onInsertRow(rowIndex)}
              className="w-3 h-3 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Insert row"
            >
              <Plus className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-3 h-3"></div>
          )}
          
          {/* Duplicate button - show when allowed */}
          {!isReadOnly && row.canDuplicate ? (
            <button
              onClick={() => onDuplicateRow(rowIndex)}
              className="w-3 h-3 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-3 h-3"></div>
          )}
          
          {/* Delete button - show when allowed */}
          {!isReadOnly && row.canDelete ? (
            <button
              onClick={() => onDeleteRow(rowIndex)}
              className="w-3 h-3 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-3 h-3"></div>
          )}
        </div>
      </td>
    </tr>
  );
});