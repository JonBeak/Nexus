/**
 * Simple grid renderer using Base Layer architecture
 * Replaces the complex GridBody component
 */

import React from 'react';
import { GridRow } from '../types/LayerTypes';

interface SimpleGridRendererProps {
  rows: GridRow[];
  onFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  onInsertRow: (afterIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDuplicateRow: (rowIndex: number) => void;
  isReadOnly: boolean;
}

export const SimpleGridRenderer: React.FC<SimpleGridRendererProps> = ({
  rows,
  onFieldCommit,
  onProductTypeSelect,
  onInsertRow,
  onDeleteRow,
  onDuplicateRow,
  isReadOnly
}) => {
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
    <div className="grid-container">
      {/* Grid Header */}
      <div className="grid-header bg-gray-50 border-b p-4">
        <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-700">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Product Type</div>
          <div className="col-span-6">Fields</div>
          <div className="col-span-2">Display #</div>
          <div className="col-span-1">Actions</div>
        </div>
      </div>

      {/* Grid Rows */}
      <div className="grid-body">
        {rows.map((row, index) => (
          <SimpleGridRow
            key={row.id}
            row={row}
            rowIndex={index}
            onFieldCommit={onFieldCommit}
            onProductTypeSelect={onProductTypeSelect}
            onInsertRow={onInsertRow}
            onDeleteRow={onDeleteRow}
            onDuplicateRow={onDuplicateRow}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>
    </div>
  );
};

interface SimpleGridRowProps {
  row: GridRow;
  rowIndex: number;
  onFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  onInsertRow: (afterIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDuplicateRow: (rowIndex: number) => void;
  isReadOnly: boolean;
}

const SimpleGridRow: React.FC<SimpleGridRowProps> = ({
  row,
  rowIndex,
  onFieldCommit,
  onProductTypeSelect,
  onInsertRow,
  onDeleteRow,
  onDuplicateRow,
  isReadOnly
}) => {
  const handleFieldChange = (fieldName: string, value: string) => {
    onFieldCommit(rowIndex, fieldName, value);
  };

  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productTypeId = parseInt(e.target.value);
    if (productTypeId) {
      onProductTypeSelect(rowIndex, productTypeId);
    }
  };

  // Style based on row type
  const rowClassName = `
    grid grid-cols-12 gap-2 p-4 border-b hover:bg-gray-50
    ${row.rowType === 'main' ? 'bg-white' : 'bg-gray-25 ml-8'}
    ${row.rowType === 'continuation' ? 'border-l-4 border-blue-200' : ''}
  `;

  return (
    <div className={rowClassName}>
      {/* Row Number */}
      <div className="col-span-1 flex items-center">
        {row.showRowNumber && (
          <span className="text-sm font-medium text-gray-600">
            {row.displayNumber}
          </span>
        )}
      </div>

      {/* Product Type Selector */}
      <div className="col-span-2">
        {!isReadOnly && row.rowType === 'main' ? (
          <select
            value={row.productTypeId || ''}
            onChange={handleProductTypeChange}
            className="w-full p-2 border rounded text-sm"
          >
            <option value="">Select Product...</option>
            <option value="1">Sign Panel</option>
            <option value="2">Vinyl Lettering</option>
            <option value="3">Banner</option>
            {/* TODO: Load from actual product types */}
          </select>
        ) : (
          <span className="text-sm text-gray-600">
            {row.productTypeName || 'No Product'}
          </span>
        )}
      </div>

      {/* Field Values */}
      <div className="col-span-6">
        <div className="grid grid-cols-6 gap-2">
          {Object.entries(row.data).slice(0, 6).map(([fieldName, value]) => (
            <input
              key={fieldName}
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldName}
              disabled={isReadOnly || !row.editableFields.includes(fieldName)}
              className="p-1 border rounded text-sm"
            />
          ))}
          {/* Show placeholder inputs if no data */}
          {Object.keys(row.data).length === 0 && (
            <div className="col-span-6 text-sm text-gray-400 italic">
              Select a product type to see fields
            </div>
          )}
        </div>
      </div>

      {/* Display Number */}
      <div className="col-span-2 flex items-center">
        <span className="text-sm text-gray-500">
          Type: {row.rowType}
        </span>
      </div>

      {/* Actions */}
      <div className="col-span-1 flex gap-1">
        {!isReadOnly && (
          <>
            {row.canAddRow && (
              <button
                onClick={() => onInsertRow(rowIndex)}
                className="p-1 text-green-600 hover:bg-green-100 rounded"
                title="Add Row"
              >
                +
              </button>
            )}
            {row.canDuplicate && (
              <button
                onClick={() => onDuplicateRow(rowIndex)}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                title="Duplicate"
              >
                ⧉
              </button>
            )}
            {row.canDelete && (
              <button
                onClick={() => onDeleteRow(rowIndex)}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
                title="Delete"
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};