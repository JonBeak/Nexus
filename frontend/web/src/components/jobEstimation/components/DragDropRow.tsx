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
import { StructureValidationError } from '../core/validation/ValidationResultsManager';
import { ProductType } from '../hooks/useProductTypes';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface DragDropRowProps {
  row: GridRow;
  rowIndex: number;
  productTypes: ProductType[];
  staticDataCache?: Record<string, string[]>;
  onFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  onInsertRow: (afterIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDuplicateRow: (rowIndex: number) => void;
  onClearRow: (rowIndex: number) => void;
  isReadOnly: boolean;
  fieldPrompts?: Record<string, string>; // Field prompts for this product type
  staticOptions?: Record<string, string[]>; // Static dropdown options
  validationStates?: Record<string, 'error' | 'valid'>; // Validation states
  structureError?: StructureValidationError; // Structure validation error
  hoveredRowId?: string | null; // Cross-component hover state
  onRowHover?: (rowId: string | null) => void; // Hover handler
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
  validationStates,
  structureError,
  hoveredRowId = null,
  onRowHover = () => {}
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

  const getFieldData = (colIndex: number) => {
    const fieldName = `field${colIndex + 1}`;
    const fieldValue = row.data?.[fieldName] ?? '';
    return { fieldName, fieldValue };
  };

  const isHighlighted = hoveredRowId === row.id;
  const isDivider = row.productTypeId === 25; // Divider special item
  const isSubtotal = row.productTypeId === 21; // Subtotal special item

  // Get cell background for QTY and Field columns only
  const getCellBackground = () => {
    if (isDivider) return 'bg-orange-200';
    if (isSubtotal) return PAGE_STYLES.header.background;
    return '';
  };

  const cellBackgroundClass = getCellBackground();

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b ${PAGE_STYLES.border} group transition-colors ${PAGE_STYLES.interactive.hover} ${
        isDragging ? 'ring-2 ring-blue-300 bg-blue-50' : ''
      } ${
        isHighlighted ? `relative z-10 outline outline-2 outline-blue-300 ${PAGE_STYLES.interactive.selected}` : ''
      }`}
      onMouseEnter={() => onRowHover(row.id)}
      onMouseLeave={() => onRowHover(null)}
    >
      {/* Row Number & Drag Handle - matches original exactly */}
      <td className={`w-4 px-0.5 py-0.25 border-r ${PAGE_STYLES.border}`}>
        <div className="flex items-center h-full">
          {/* Drag Handle - Left Aligned */}
          {row.isDraggable && (
            <div
              {...attributes}
              {...listeners}
              className={`cursor-grab active:cursor-grabbing p-1 ${PAGE_STYLES.interactive.hoverOnHeader} rounded mr-1`}
            >
              <GripVertical className={`w-4 h-4 opacity-60 group-hover:opacity-100 ${PAGE_STYLES.panel.textMuted}`} />
            </div>
          )}

          {/* Row Number - Left Justified after handle */}
          {row.showRowNumber && (
            <span className={
              row.nestingLevel === 'sub'
                ? `text-xs ${PAGE_STYLES.panel.textMuted} pr-1.5`  // Sub-item numbering (1.a, 1.b)
                : 'text-sm text-black font-bold pr-1.5'  // Main numbering (1, 2, 3)
            }>
              {row.displayNumber}
            </span>
          )}
        </div>
      </td>

      {/* Product Type Selector */}
      <td className={`py-0 ${row.nestingLevel === 'sub' ? 'pl-5 pr-0' : 'px-0'}`}>
        <ProductTypeSelector
          row={row}
          rowIndex={rowIndex}
          productTypes={productTypes}
          onProductTypeSelect={onProductTypeSelect}
          isReadOnly={isReadOnly}
          validationState={structureError ? 'error' : 'valid'}
          errorMessage={structureError?.message}
        />
      </td>
      
      {/* QTY Column */}
      <td className={`px-0 py-0 w-4 border-l ${PAGE_STYLES.border} ${cellBackgroundClass}`}>
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
          allowExpansion={fieldPrompts?.['quantity_expandable'] === true}
          productTypeId={row.productTypeId}
        />
      </td>
      
      {/* 10 Dynamic Field Columns */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(colIndex => {
        const { fieldName, fieldValue } = getFieldData(colIndex);

        return (
          <td key={colIndex} className={`px-0 py-0 w-6 border-l ${PAGE_STYLES.border} ${cellBackgroundClass}`}>
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
              allowExpansion={fieldPrompts?.[`${fieldName}_expandable`] === true}
              productTypeId={row.productTypeId}
              fieldTooltip={fieldPrompts?.[`${fieldName}_tooltip`]}
            />
          </td>
        );
      })}
      
      {/* Actions - add row button on all rows except continuation rows */}
      <td className={`w-5 px-1 py-0 border-l ${PAGE_STYLES.border}`}>
        <div className="flex items-center justify-center gap-0.5">
          {/* Add Row button - show on all rows except continuation rows */}
          {!isReadOnly && row.rowType !== 'continuation' ? (
            <button
              onClick={() => onInsertRow(rowIndex)}
              className={`w-5 h-5 flex items-center justify-center rounded ${PAGE_STYLES.panel.textMuted} hover:text-green-600 hover:bg-green-50 transition-colors`}
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
              className={`w-5 h-5 flex items-center justify-center rounded ${PAGE_STYLES.panel.textMuted} hover:text-blue-600 hover:bg-blue-50 transition-colors`}
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
              className={`w-5 h-5 flex items-center justify-center rounded ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 hover:bg-orange-50 transition-colors`}
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
              className={`w-5 h-5 flex items-center justify-center rounded ${PAGE_STYLES.panel.textMuted} hover:text-red-600 hover:bg-red-50 transition-colors`}
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
