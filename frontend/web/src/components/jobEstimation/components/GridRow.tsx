import React from 'react';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EstimateRow, AssemblyOperations, RowOperations, AssemblyItemsCache } from '../types';
import { getRowNumber, shouldShowField, getFieldForColumn } from '../utils/rowUtils';
import { FieldRenderer } from './FieldRenderer';
import { useDragDropContext } from '../managers/DragDropManager';
import { CellStylingEngine } from '../utils/cellStylingEngine';

interface GridRowProps {
  row: EstimateRow;
  rowIndex: number;
  rows: EstimateRow[];
  productTypes: any[];
  assemblyColors: string[];
  rowOperations: RowOperations;
  assemblyOperations: AssemblyOperations;
  assemblyItemsCache?: AssemblyItemsCache;
  validationErrors?: Record<string, string[]>;
  hasFieldBeenBlurred?: (rowId: string, fieldName: string) => boolean; // ✅ BLUR-ONLY
}

export const GridRow: React.FC<GridRowProps> = ({
  row,
  rowIndex,
  rows,
  productTypes,
  rowOperations,
  assemblyOperations,
  assemblyItemsCache,
  validationErrors,
  hasFieldBeenBlurred
}) => {
  const { activeId, draggedRowIds } = useDragDropContext();
  // Allow dragging of main rows AND sub-items, but NOT continuation rows
  // Sub-items: !isMainRow but are actual products (not continuation rows from database)
  const canDragRow = row.isMainRow || (!row.isMainRow && row.productTypeId);
  
  // Only use sortable for main rows - continuation rows are just regular rows
  const sortableConfig = canDragRow ? useSortable({ id: row.id }) : null;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = sortableConfig || {
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
  };

  // Check if this row is part of the currently dragged group - O(1) lookup
  const isPartOfDraggedGroup = activeId && draggedRowIds.has(row.id);
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isPartOfDraggedGroup ? 0.5 : 1,
    borderLeft: isPartOfDraggedGroup ? '3px solid #3b82f6' : 'none',
  };

  const indentStyle = { paddingLeft: `${row.indent * 16}px` };
  const rowNumber = getRowNumber(rowIndex, rows);
  
  // Get assembly color if this item is part of an assembly
  let assemblyColor = '';
  if (row.data?.assemblyGroup !== undefined) {
    assemblyColor = assemblyOperations.getAssemblyColor(row.data.assemblyGroup);
    // DEBUG: Log color assignments (DISABLED - causing render loop)
    // console.log(`🎨 RENDER: Item ${row.id} has assemblyGroup ${row.data.assemblyGroup}, color: ${assemblyColor}`);
  }
  
  const renderMainContent = () => {
    // Show dropdown for ALL rows - both main rows and sub-items!
    return (
      <select
        value={row.productTypeId || ""}
        onChange={async (e) => {
          const value = e.target.value;
          if (value) {
            await rowOperations.handleProductTypeSelect(rowIndex, parseInt(value));
          } else {
            // Handle deselection - reset to empty product row
            rowOperations.handleFieldCommit(rowIndex, 'productTypeId', 27);
            rowOperations.handleFieldCommit(rowIndex, 'productTypeName', 'Empty Row');
          }
        }}
        className={`w-36 px-2 py-1 text-xs border border-gray-300 rounded focus:border-blue-300 appearance-none ${
          row.isMainRow 
            ? 'text-gray-500' 
            : row.parentProductId === null 
              ? 'text-red-600 bg-red-50 border-red-300' 
              : 'text-blue-600 bg-blue-50'
        }`}
      >
        <option value="">Select Type</option>
        
        {/* Normal Products */}
        <optgroup label="Products">
          {productTypes
            .filter(pt => pt.category === 'normal')
            .map(pt => (
              <option key={pt.id} value={pt.id} className="text-black">{pt.name}</option>
            ))}
        </optgroup>
        
        {/* Sub-items */}
        {productTypes.some(pt => pt.category === 'sub_item') && (
          <optgroup label="Sub-items">
            {productTypes
              .filter(pt => pt.category === 'sub_item')
              .map(pt => (
                <option key={pt.id} value={pt.id} className="text-black">{pt.name}</option>
              ))}
          </optgroup>
        )}
        
        {/* Special Items - ALL from database now */}
        <optgroup label="Special Items">
          {productTypes
            .filter(pt => pt.category === 'special')
            .map(pt => (
              <option key={pt.id} value={pt.id} className="text-black">{pt.name}</option>
            ))}
        </optgroup>
      </select>
    );
  };
  
  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 group hover:bg-gray-50 ${
        isPartOfDraggedGroup ? 'ring-2 ring-blue-300 bg-blue-50' : ''
      } ${
        assemblyColor ? `${assemblyColor} hover:brightness-95` : ''
      }`}
    >
      {/* Row Number & Drag Handle */}
      <td className="w-12 px-2 py-1 border-r">
        <div className="flex items-center justify-between h-full">
          {/* Drag Handle - Left Aligned */}
          <div className="flex items-center">
            {canDragRow && (
              <div 
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
              >
                <GripVertical className="w-4 h-4 opacity-60 group-hover:opacity-100 text-gray-500" />
              </div>
            )}
          </div>
          
          {/* Row Number - Right Aligned */}
          <div className="flex items-center space-x-1">
            {rowNumber && (
              <span className={`${
                typeof rowNumber === 'string' && rowNumber.includes('.')
                  ? 'text-xs text-gray-500'  // Sub-item numbering (1.a, 1.b)
                  : 'text-sm text-black font-bold'  // Main numbering (1, 2, 3)
              }`}>
                {rowNumber}
              </span>
            )}
          </div>
        </div>
      </td>
      
      {/* Main Content Area */}
      <td className={`px-2 py-0.5 ${
        assemblyColor ? assemblyColor : ''
      }`} style={indentStyle}>
        {renderMainContent()}
      </td>
      
      
      {/* Dynamic Field Columns */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(colIndex => {
        // ✅ TEMPLATE-FIRST: Get field info using database product templates
        const field = getFieldForColumn(row, colIndex, productTypes);
        const fieldName = field?.name;
        const fieldValue = fieldName ? row.data?.[fieldName] : undefined;
        const hasValidationErrors = fieldName && validationErrors?.[fieldName] ? (validationErrors[fieldName].length > 0) : false;
        
        // Get conditional cell styling based on field value and business rules
        const cellClasses = CellStylingEngine.getCellClasses(
          row,
          field,
          fieldValue,
          colIndex,
          hasValidationErrors,
          'px-1 py-0.5 w-16 border-l border-gray-100' // base classes
        );
        
        return (
          <td key={colIndex} className={cellClasses}>
          {field && shouldShowField(row, colIndex) && (
            <FieldRenderer
              row={row}
              rowIndex={rowIndex}
              field={field}
              fieldIndex={colIndex}
              onFieldCommit={rowOperations.handleFieldCommit}
              onSubItemCommit={rowOperations.handleSubItemCommit}
              assemblyOperations={assemblyOperations}
              assemblyItemsCache={assemblyItemsCache}
              allRows={rows} // ✅ NEW: Required for database ID assembly reference conversion
              validationErrors={(() => {
                // ✅ TEMPLATE-FIRST: Use field name from template-based resolution
                // No more fieldConfig dependency - uses getFieldForColumn helper
                let effectiveFieldName = fieldName;
                
                // Template-first approach should always provide fieldName from database
                
                const errors = effectiveFieldName ? validationErrors?.[effectiveFieldName] : undefined;
                return errors;
              })()}
              hasFieldBeenBlurred={hasFieldBeenBlurred}
            />
          )}
          </td>
        );
      })}
      
      {/* Actions */}
      <td className="w-12 px-1 py-0.5 border-l">
        <div className="flex items-center space-x-1">
          {/* Add Line button - only show on parent lines, invisible spacer otherwise */}
          {row.isMainRow ? (
            <button
              onClick={() => rowOperations.handleInsertRow(rowIndex)}
              className="w-5 h-5 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Insert row"
            >
              <Plus className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-5 h-5"></div>
          )}
          
          {/* Sub-item button removed - sub-items are now regular products selected from dropdown */}
          
          {/* Delete button - show on main rows, not continuation rows */}
          {row.isMainRow ? (
            <button
              onClick={() => rowOperations.handleDeleteRow(rowIndex)}
              className="w-5 h-5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-5 h-5"></div>
          )}
        </div>
      </td>
    </tr>
  );
};