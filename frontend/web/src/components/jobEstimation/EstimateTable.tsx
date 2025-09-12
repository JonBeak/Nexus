import React, { useState, useRef, useMemo } from 'react';
import { Copy, Download, FileText, AlertTriangle, Package } from 'lucide-react';
import { transformRowsToAssemblyPreview, getAssemblyColorIndicator } from './systems/UnifiedAssemblySystem';

interface EstimateTableProps {
  estimate: any;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  hasValidationErrors?: boolean;
  validationErrorCount?: number;
  // New props for assembly groups support
  gridRows?: any[]; // Raw grid rows from GridJobBuilder
  useAssemblyGroups?: boolean; // Flag to use new assembly system
}

export const EstimateTable: React.FC<EstimateTableProps> = ({ 
  estimate, 
  showNotification, 
  hasValidationErrors = false, 
  validationErrorCount = 0,
  gridRows = [],
  useAssemblyGroups = false 
}) => {
  const [format, setFormat] = useState<'customer' | 'internal'>('customer');
  const tableRef = useRef<HTMLDivElement>(null);
  
  // ✅ PHASE 1 FIX: Memoize assembly data transformation to prevent infinite rerenders
  const assemblyData = useMemo(() => {
    if (!useAssemblyGroups || gridRows.length === 0) {
      return null;
    }
    return transformRowsToAssemblyPreview(gridRows);
  }, [
    useAssemblyGroups,
    // Create stable signature for gridRows to prevent unnecessary recalculations
    JSON.stringify(gridRows.map(row => ({
      id: row.id,
      productTypeId: row.productTypeId,
      assemblyGroup: row.assemblyGroup,
      dataKeys: Object.keys(row.data || {}).sort().join(',')
    })))
  ]);

  const copyTableToClipboard = () => {
    if (!estimate && !(useAssemblyGroups && assemblyData)) {
      showNotification('No estimate data to copy', 'error');
      return;
    }

    // Generate tab-separated table text for Illustrator
    let tableText = '';
    
    if (format === 'customer') {
      tableText = 'Product/Service\tDescription\tUnit Price\tQty\tExt. Price\n';
    } else {
      tableText = 'Product/Service\tDescription\tCalculation\tUnit Price\tQty\tExt. Price\n';
    }
    
    // Use assembly groups system if available
    if (useAssemblyGroups && assemblyData) {
      // Assembly groups
      assemblyData.assemblyItems.forEach((group) => {
        // Add group header
        if (group.items.length > 0) {
          tableText += `\n${group.group_name.toUpperCase()}\n`;
        }
        
        // Add group items
        group.items.forEach((item) => {
          if (format === 'customer') {
            tableText += `${item.item_name}\t${item.customer_description}\t$${item.unit_price.toFixed(2)}\t${item.base_quantity}\t$${item.extended_price.toFixed(2)}\n`;
          } else {
            tableText += `${item.item_name}\t${item.customer_description}\t${item.internal_notes}\t$${item.unit_price.toFixed(2)}\t${item.base_quantity}\t$${item.extended_price.toFixed(2)}\n`;
          }
          
          // Add continuation rows
          if (item.continuation_rows && item.continuation_rows.length > 0) {
            item.continuation_rows.forEach((contRow) => {
              if (format === 'customer') {
                tableText += `  ${contRow.item_name}\t${contRow.customer_description}\t-\t-\t-\n`;
              } else {
                tableText += `  ${contRow.item_name}\t${contRow.customer_description}\t${contRow.internal_notes}\t-\t-\t-\n`;
              }
            });
          }
        });
        
        // Add assembly cost
        if (group.assembly_cost > 0) {
          if (format === 'customer') {
            tableText += `Assembly\t${group.assembly_description}\t$${group.assembly_cost.toFixed(2)}\t1\t$${group.assembly_cost.toFixed(2)}\n`;
          } else {
            tableText += `Assembly\t${group.assembly_description}\tAssembly fee\t$${group.assembly_cost.toFixed(2)}\t1\t$${group.assembly_cost.toFixed(2)}\n`;
          }
        }
      });
      
      // Ungrouped items
      if (assemblyData.ungroupedItems.length > 0) {
        tableText += `\nINDIVIDUAL ITEMS\n`;
        assemblyData.ungroupedItems.forEach((item) => {
          if (format === 'customer') {
            tableText += `${item.item_name}\t${item.customer_description}\t$${item.unit_price.toFixed(2)}\t${item.base_quantity}\t$${item.extended_price.toFixed(2)}\n`;
          } else {
            tableText += `${item.item_name}\t${item.customer_description}\t${item.internal_notes}\t$${item.unit_price.toFixed(2)}\t${item.base_quantity}\t$${item.extended_price.toFixed(2)}\n`;
          }
        });
      }
    } else {
      // Fallback to legacy groups system  
      if (estimate.groups) {
        estimate.groups.forEach((group: any) => {
          if (group.items && group.items.length > 0) {
            group.items.forEach((item: any) => {
              if (format === 'customer') {
                tableText += `${item.item_name || 'Channel Letters'}\t${item.customer_description || '12" Front Lit Letters'}\t$${item.unit_price || 45.00}\t${item.base_quantity || 8}\t$${item.extended_price || 360.00}\n`;
              } else {
                tableText += `${item.item_name || 'Channel Letters'}\t${item.customer_description || '12" Front Lit Letters'}\t${item.internal_notes || '8 Letters × $45/letter'}\t$${item.unit_price || 45.00}\t${item.base_quantity || 8}\t$${item.extended_price || 360.00}\n`;
              }
            });
          }
          
          // Add assembly cost if present
          if (group.assembly_cost > 0) {
            const assemblyDesc = group.assembly_description || 'Assembly to backer';
            if (format === 'customer') {
              tableText += `Assembly\t${assemblyDesc}\t$${group.assembly_cost}\t1\t$${group.assembly_cost}\n`;
            } else {
              tableText += `Assembly\t${assemblyDesc}\tAssembly fee\t$${group.assembly_cost}\t1\t$${group.assembly_cost}\n`;
            }
          }
        });
      }
    }
    
    // Add totals - ensure numeric values are parsed
    const subtotal = parseFloat(estimate.subtotal) || 750.00;
    const taxRate = parseFloat(estimate.tax_rate) || 0.13;
    const taxAmount = parseFloat(estimate.tax_amount) || (subtotal * taxRate);
    const total = parseFloat(estimate.total_amount) || (subtotal + taxAmount);
    
    tableText += '\t\t\t\t\t\n'; // Empty row
    tableText += `\t\t\tSubtotal:\t\t$${subtotal.toFixed(2)}\n`;
    tableText += `\t\t\tTax (${(taxRate * 100).toFixed(1)}%):\t\t$${taxAmount.toFixed(2)}\n`;
    tableText += `\t\t\tTotal:\t\t$${total.toFixed(2)}\n`;
    
    // Add job code at the end
    if (estimate.job_code) {
      tableText += `\nJob Code: ${estimate.job_code}`;
    }

    navigator.clipboard.writeText(tableText).then(() => {
      showNotification('Table copied to clipboard for Illustrator');
    }).catch(() => {
      showNotification('Failed to copy table', 'error');
    });
  };

  const generateEstimateRows = () => {
    // Use assembly groups system if available
    if (useAssemblyGroups && assemblyData) {
      return generateAssemblyGroupRows();
    }
    
    // Fallback to legacy groups system
    if (!estimate || !estimate.groups) {
      return (
        <tr>
          <td colSpan={format === 'customer' ? 5 : 6} className="px-4 py-8 text-center text-gray-500">
            No estimate data available
          </td>
        </tr>
      );
    }

    const rows: JSX.Element[] = [];

    estimate.groups.forEach((group: any, groupIndex: number) => {
      // Group items
      if (group.items && group.items.length > 0) {
        group.items.forEach((item: any, itemIndex: number) => {
          rows.push(
            <tr key={`group-${groupIndex}-item-${itemIndex}`} className="border-b border-gray-200">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {item.item_name || 'Channel Letters'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {format === 'customer' 
                  ? (item.customer_description || '12" Front Lit Letters')
                  : (item.customer_description || '12" Front Lit Letters')
                }
              </td>
              {format === 'internal' && (
                <td className="px-4 py-3 text-sm text-gray-500">
                  {item.internal_notes || '8 Letters × $45/letter'}
                </td>
              )}
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                ${(parseFloat(item.unit_price) || 45.00).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                {parseInt(item.base_quantity) || 8}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                ${(parseFloat(item.extended_price) || 360.00).toFixed(2)}
              </td>
            </tr>
          );
        });
      }
      
      // Assembly cost
      if (group.assembly_cost > 0) {
        rows.push(
          <tr key={`group-${groupIndex}-assembly`} className="border-b border-gray-200">
            <td className="px-4 py-3 text-sm font-medium text-gray-900">Assembly</td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {group.assembly_description || 'Assembly to backer'}
            </td>
            {format === 'internal' && (
              <td className="px-4 py-3 text-sm text-gray-500">Assembly fee</td>
            )}
            <td className="px-4 py-3 text-sm text-gray-900 text-right">
              ${(parseFloat(group.assembly_cost) || 0).toFixed(2)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right">1</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
              ${(parseFloat(group.assembly_cost) || 0).toFixed(2)}
            </td>
          </tr>
        );
      }
    });

    return rows;
  };

  const generateAssemblyGroupRows = () => {
    if (!assemblyData) return null;
    
    const rows: JSX.Element[] = [];

    // Assembly groups with color indicators
    assemblyData.assemblyItems.forEach((group, groupIndex) => {
      // Assembly group header with color indicator
      if (group.items.length > 0) {
        rows.push(
          <tr key={`assembly-header-${groupIndex}`} className="bg-gray-50 border-b-2 border-gray-300">
            <td colSpan={format === 'customer' ? 5 : 6} className="px-4 py-2">
              <div className="flex items-center space-x-3">
                <div 
                  className={`w-3 h-3 rounded-full`} 
                  style={{ backgroundColor: getAssemblyColorIndicator(group.assembly_color) }}
                ></div>
                <span className="text-sm font-semibold text-gray-800">
                  {group.group_name}
                </span>
                <span className="text-xs text-gray-500">
                  ({group.item_count} item{group.item_count !== 1 ? 's' : ''})
                </span>
              </div>
            </td>
          </tr>
        );
      }
      
      // Assembly group items
      group.items.forEach((item, itemIndex) => {
        // Main item row
        rows.push(
          <tr key={`assembly-${groupIndex}-item-${itemIndex}`} className="border-b border-gray-200">
            <td className="px-4 py-3 text-sm font-medium text-gray-900 pl-8">
              {item.item_name}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {item.customer_description}
            </td>
            {format === 'internal' && (
              <td className="px-4 py-3 text-sm text-gray-500">
                {item.internal_notes}
              </td>
            )}
            <td className="px-4 py-3 text-sm text-gray-900 text-right">
              ${item.unit_price.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right">
              {item.base_quantity}
            </td>
            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
              ${item.extended_price.toFixed(2)}
            </td>
          </tr>
        );
        
        // Continuation rows (for multi-row items like Channel Letters)
        if (item.continuation_rows && item.continuation_rows.length > 0) {
          item.continuation_rows.forEach((contRow, contIndex) => {
            rows.push(
              <tr key={`assembly-${groupIndex}-item-${itemIndex}-cont-${contIndex}`} className="border-b border-gray-100">
                <td className="px-4 py-2 text-xs text-gray-500 pl-12">
                  └─ {contRow.item_name}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {contRow.customer_description}
                </td>
                {format === 'internal' && (
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {contRow.internal_notes}
                  </td>
                )}
                <td className="px-4 py-2 text-xs text-gray-400 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-400 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-400 text-right">-</td>
              </tr>
            );
          });
        }
      });
      
      // Assembly cost row
      if (group.assembly_cost > 0) {
        rows.push(
          <tr key={`assembly-${groupIndex}-cost`} className="border-b border-gray-200 bg-gray-25">
            <td className="px-4 py-3 text-sm font-medium text-gray-900 pl-8">
              Assembly
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {group.assembly_description}
            </td>
            {format === 'internal' && (
              <td className="px-4 py-3 text-sm text-gray-500">Assembly fee</td>
            )}
            <td className="px-4 py-3 text-sm text-gray-900 text-right">
              ${group.assembly_cost.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right">1</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
              ${group.assembly_cost.toFixed(2)}
            </td>
          </tr>
        );
      }
      
      // Assembly subtotal row
      if (group.items.length > 1 || group.assembly_cost > 0) {
        rows.push(
          <tr key={`assembly-${groupIndex}-subtotal`} className="border-b-2 border-gray-300 bg-gray-100">
            <td colSpan={format === 'customer' ? 4 : 5} className="px-4 py-2 text-sm font-medium text-gray-700 text-right pl-8">
              {group.group_name} Subtotal:
            </td>
            <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
              ${group.group_subtotal.toFixed(2)}
            </td>
          </tr>
        );
      }
    });

    // Ungrouped items
    if (assemblyData.ungroupedItems.length > 0) {
      rows.push(
        <tr key="ungrouped-header" className="bg-gray-50 border-b-2 border-gray-300">
          <td colSpan={format === 'customer' ? 5 : 6} className="px-4 py-2">
            <div className="flex items-center space-x-3">
              <Package className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">
                Individual Items
              </span>
              <span className="text-xs text-gray-500">
                ({assemblyData.ungroupedItems.length} item{assemblyData.ungroupedItems.length !== 1 ? 's' : ''})
              </span>
            </div>
          </td>
        </tr>
      );
      
      assemblyData.ungroupedItems.forEach((item, itemIndex) => {
        // Main ungrouped item row
        rows.push(
          <tr key={`ungrouped-item-${itemIndex}`} className="border-b border-gray-200">
            <td className="px-4 py-3 text-sm font-medium text-gray-900">
              {item.item_name}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {item.customer_description}
            </td>
            {format === 'internal' && (
              <td className="px-4 py-3 text-sm text-gray-500">
                {item.internal_notes}
              </td>
            )}
            <td className="px-4 py-3 text-sm text-gray-900 text-right">
              ${item.unit_price.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 text-right">
              {item.base_quantity}
            </td>
            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
              ${item.extended_price.toFixed(2)}
            </td>
          </tr>
        );
        
        // Continuation rows for ungrouped items (sub-items)
        if (item.continuation_rows && item.continuation_rows.length > 0) {
          item.continuation_rows.forEach((contRow, contIndex) => {
            rows.push(
              <tr key={`ungrouped-item-${itemIndex}-cont-${contIndex}`} className="border-b border-gray-100">
                <td className="px-4 py-2 text-xs text-gray-500 pl-8">
                  └─ {contRow.item_name}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {contRow.customer_description}
                </td>
                {format === 'internal' && (
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {contRow.internal_notes}
                  </td>
                )}
                <td className="px-4 py-2 text-xs text-gray-400 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-400 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-400 text-right">-</td>
              </tr>
            );
          });
        }
      });
    }

    return rows;
  };

  // Using unified system's getAssemblyColorIndicator

  const calculateTotals = () => {
    if (!estimate) {
      return { subtotal: 0, taxRate: 0, taxAmount: 0, total: 0 };
    }

    // Parse string values from database to numbers
    const subtotal = parseFloat(estimate.subtotal) || 750.00;
    const taxRate = parseFloat(estimate.tax_rate) || 0.13;
    const taxAmount = parseFloat(estimate.tax_amount) || (subtotal * taxRate);
    const total = parseFloat(estimate.total_amount) || (subtotal + taxAmount);

    return { subtotal, taxRate, taxAmount, total };
  };

  const { subtotal, taxRate, taxAmount, total } = calculateTotals();

  return (
    <div className="bg-white rounded-lg shadow relative">
      {/* Validation Error Overlay */}
      {hasValidationErrors && (
        <div className="absolute inset-0 bg-red-100 bg-opacity-75 z-10 flex items-center justify-center rounded-lg">
          <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-red-500 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-red-800 mb-1">Validation Errors</h3>
            <p className="text-red-700 text-sm">
              {validationErrorCount} field{validationErrorCount !== 1 ? 's' : ''} {validationErrorCount !== 1 ? 'have' : 'has'} validation errors.
            </p>
            <p className="text-red-600 text-xs mt-2">
              Fix the highlighted fields in the grid above to generate estimate.
            </p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Estimate Preview</h3>
          
          <div className="flex items-center space-x-3">
            {/* Format Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFormat('customer')}
                className={`px-3 py-1 text-sm rounded ${
                  format === 'customer'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Customer
              </button>
              <button
                onClick={() => setFormat('internal')}
                className={`px-3 py-1 text-sm rounded ${
                  format === 'internal'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Internal
              </button>
            </div>
            
            <button
              onClick={copyTableToClipboard}
              className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
            >
              <Copy className="w-4 h-4" />
              <span>Copy for Illustrator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden" ref={tableRef}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product/Service
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              {format === 'internal' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Calculation
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ext. Price
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {generateEstimateRows()}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t-2 border-gray-300 bg-gray-50">
          <div className="px-4 py-3">
            <div className="flex justify-end space-y-1">
              <div className="text-right space-y-1">
                <div className="flex justify-between items-center w-48">
                  <span className="text-sm text-gray-600">Subtotal:</span>
                  <span className="text-sm font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center w-48">
                  <span className="text-sm text-gray-600">Tax ({(taxRate * 100).toFixed(1)}%):</span>
                  <span className="text-sm font-medium text-gray-900">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center w-48 pt-1 border-t border-gray-300">
                  <span className="text-base font-semibold text-gray-900">Total:</span>
                  <span className="text-base font-bold text-gray-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Job Code */}
        {estimate?.job_code && (
          <div className="px-4 py-3 bg-gray-100 border-t">
            <div className="text-center">
              <span className="text-sm font-medium text-gray-600">Job Code: </span>
              <span className="text-sm font-mono font-semibold text-gray-900">
                {estimate.job_code}
              </span>
            </div>
          </div>
        )}
      </div>

      {!estimate && (
        <div className="px-6 py-12 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Create or select an estimate to see the preview</p>
        </div>
      )}
    </div>
  );
};