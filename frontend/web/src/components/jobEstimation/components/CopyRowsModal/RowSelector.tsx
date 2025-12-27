import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Check } from 'lucide-react';
import { jobVersioningApi } from '../../../../services/jobVersioningApi';
import { GridRowCore } from '../../core/types/CoreTypes';
import { SelectedEstimate } from './EstimateSelector';
import { useTemplateCache } from '../../hooks/useTemplateCache';

interface RowSelectorProps {
  estimate: SelectedEstimate;
  onRowsSelected: (rows: GridRowCore[]) => void;
  selectedRows: GridRowCore[];
}

// Product types that should ALWAYS be shown regardless of data content
const ALWAYS_SHOW_PRODUCT_TYPES = [21, 25]; // Subtotal, Divider

// System fields to exclude when checking for empty rows
const SYSTEM_FIELDS = [
  'qty', 'quantity', 'isMainRow', 'fieldConfig',
  'id', 'dbId', 'type', 'productTypeId', 'productTypeName',
  'indent', 'assemblyId', 'parentProductId', 'rowType',
  // Additional fields that are not user input
  'product_type_id', 'product_type_name', 'display_order',
  'is_main_row', 'parent_product_id', 'assembly_id'
];

/**
 * Check if a row has meaningful data (inverse of Clear Empty logic)
 * Returns true if row should be shown in the selection list
 */
const hasData = (row: GridRowCore): boolean => {
  // Subtotals and Dividers always have data
  if (ALWAYS_SHOW_PRODUCT_TYPES.includes(row.productTypeId || 0)) {
    return true;
  }

  // Child assembly rows (with parentProductId) need actual field data to be shown
  const isChildRow = row.parentProductId != null;

  // Check if any field has meaningful data
  if (row.data) {
    const hasInputData = Object.keys(row.data).some(key => {
      // Skip system fields
      if (SYSTEM_FIELDS.includes(key)) {
        return false;
      }

      const value = row.data[key];
      // Check for meaningful value (not null, undefined, or empty string)
      if (value == null || String(value).trim() === '') {
        return false;
      }

      // Skip values that are just the product type name (common in child rows)
      const strValue = String(value).trim();
      if (row.productTypeName && strValue === row.productTypeName) {
        return false;
      }
      // Skip values that start with indent marker
      if (strValue.startsWith('↳')) {
        return false;
      }

      return true;
    });

    if (hasInputData) return true;
  }

  // Child rows without data should not be shown
  if (isChildRow) {
    return false;
  }

  return false;
};

export const RowSelector: React.FC<RowSelectorProps> = ({
  estimate,
  onRowsSelected,
  selectedRows
}) => {
  const [rows, setRows] = useState<GridRowCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get field prompts for displaying friendly field names
  const { fieldPromptsMap } = useTemplateCache();

  // Load rows for the estimate
  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await jobVersioningApi.loadGridData(estimate.id);
        // Handle both { success, data } format and direct array format
        const rowsData = Array.isArray(response) ? response : (response.data || []);
        setRows(rowsData);
      } catch (err: any) {
        console.error('Failed to load rows:', err);
        setError(err.message || 'Failed to load estimate rows');
      } finally {
        setLoading(false);
      }
    };

    loadRows();
  }, [estimate.id]);

  // Filter rows to show (exclude empty rows, keep Subtotals/Dividers)
  const visibleRows = useMemo(() => {
    return rows.filter(hasData);
  }, [rows]);

  // Set of selected row IDs for quick lookup
  const selectedIds = useMemo(() => {
    return new Set(selectedRows.map(r => r.id));
  }, [selectedRows]);

  const handleToggleRow = useCallback((row: GridRowCore) => {
    if (selectedIds.has(row.id)) {
      onRowsSelected(selectedRows.filter(r => r.id !== row.id));
    } else {
      onRowsSelected([...selectedRows, row]);
    }
  }, [selectedIds, selectedRows, onRowsSelected]);

  const handleSelectAll = useCallback(() => {
    if (selectedRows.length === visibleRows.length) {
      // Deselect all
      onRowsSelected([]);
    } else {
      // Select all
      onRowsSelected([...visibleRows]);
    }
  }, [selectedRows.length, visibleRows, onRowsSelected]);

  const isAllSelected = visibleRows.length > 0 && selectedRows.length === visibleRows.length;
  const isSomeSelected = selectedRows.length > 0 && selectedRows.length < visibleRows.length;

  /**
   * Get preview text for a row (key:value pairs for non-empty fields)
   * Uses field prompts for friendly display names
   */
  const getRowPreview = useCallback((row: GridRowCore): { key: string; value: string }[] => {
    if (!row.data) return [];

    const previewFields: { key: string; value: string }[] = [];
    const productTypeId = row.productTypeId || 0;
    const prompts = fieldPromptsMap[productTypeId] || {};

    // Get non-system, non-empty fields
    for (const [key, value] of Object.entries(row.data)) {
      if (SYSTEM_FIELDS.includes(key)) continue;
      if (value == null || String(value).trim() === '') continue;

      const strValue = String(value).trim();
      // Skip values that are just the product type name
      if (row.productTypeName && strValue === row.productTypeName) continue;
      if (strValue.startsWith('↳')) continue;

      // Use prompt as display key, fallback to field name
      const promptValue = prompts[key];
      const displayKey = typeof promptValue === 'string' ? promptValue : key;

      // Truncate long values
      const displayValue = strValue.length > 30 ? strValue.substring(0, 30) + '...' : strValue;
      previewFields.push({ key: displayKey, value: displayValue });
    }

    return previewFields;
  }, [fieldPromptsMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (visibleRows.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        No rows with data found in this estimate.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with Select All */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center">
        <button
          onClick={handleSelectAll}
          className="flex items-center space-x-2 text-sm text-gray-700 hover:text-green-600"
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
            isAllSelected
              ? 'bg-green-600 border-green-600'
              : isSomeSelected
              ? 'bg-green-200 border-green-400'
              : 'border-gray-300'
          }`}>
            {(isAllSelected || isSomeSelected) && (
              <Check className="w-3.5 h-3.5 text-white" />
            )}
          </div>
          <span>
            {isAllSelected ? 'Deselect All' : 'Select All'}
            <span className="text-gray-400 ml-1">({visibleRows.length} rows)</span>
          </span>
        </button>
      </div>

      {/* Row list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {visibleRows.map((row, index) => {
          const isSelected = selectedIds.has(row.id);
          const preview = getRowPreview(row);

          return (
            <div
              key={row.id}
              className={`w-full px-6 py-3 flex items-center space-x-3 border-b border-gray-100 ${
                isSelected ? 'bg-green-50' : ''
              }`}
            >
              <button
                onClick={() => handleToggleRow(row)}
                className="flex items-center space-x-3 hover:opacity-80"
              >
                <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                {row.productTypeName && (
                  <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                    row.productTypeId === 21 ? 'bg-purple-100 text-purple-700' :
                    row.productTypeId === 25 ? 'bg-gray-200 text-gray-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {row.productTypeName}
                  </span>
                )}
              </button>
              {preview.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {preview.map((field, i) => (
                    <div key={i} className="flex flex-col">
                      <span className="text-xs text-gray-400">{field.key}</span>
                      <span className="text-sm text-gray-700">{field.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
