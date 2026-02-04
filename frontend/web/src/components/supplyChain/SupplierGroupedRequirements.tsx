/**
 * Supplier Grouped Requirements
 * Displays pending requirements grouped by supplier for easy order generation
 * Created: 2026-02-02
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Package,
  RefreshCw,
  ShoppingCart,
  Mail,
  Phone,
  Check,
} from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { materialRequirementsApi, supplierOrdersApi } from '../../services/api';
import type { GroupedBySupplierResponse, SupplierRequirementGroup, GroupedRequirement } from '../../types/supplierOrders';

interface SupplierGroupedRequirementsProps {
  showNotification: (message: string, type?: 'success' | 'error') => void;
  onOrderGenerated?: () => void;
}

interface SelectedItems {
  [supplierId: number]: Set<number>;
}

export const SupplierGroupedRequirements: React.FC<SupplierGroupedRequirementsProps> = ({
  showNotification,
  onOrderGenerated,
}) => {
  const [data, setData] = useState<GroupedBySupplierResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({});
  const [generatingOrders, setGeneratingOrders] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await materialRequirementsApi.getGroupedBySupplier();
      setData(result);

      // Auto-expand suppliers with items
      const suppliersWithItems = new Set(result.groups.map(g => g.supplier_id));
      setExpandedSuppliers(suppliersWithItems);

      // Initialize all items as selected by default
      const initialSelected: SelectedItems = {};
      result.groups.forEach(group => {
        initialSelected[group.supplier_id] = new Set(
          group.requirements.map(r => r.requirement_id)
        );
      });
      setSelectedItems(initialSelected);
    } catch (error) {
      console.error('Error loading grouped requirements:', error);
      showNotification('Failed to load requirements', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleSupplierExpanded = (supplierId: number) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const toggleItem = (supplierId: number, requirementId: number) => {
    setSelectedItems(prev => {
      const supplierSet = new Set(prev[supplierId] || []);
      if (supplierSet.has(requirementId)) {
        supplierSet.delete(requirementId);
      } else {
        supplierSet.add(requirementId);
      }
      return { ...prev, [supplierId]: supplierSet };
    });
  };

  const toggleAllForSupplier = (supplierId: number, requirements: GroupedRequirement[]) => {
    setSelectedItems(prev => {
      const supplierSet = prev[supplierId] || new Set();
      const allSelected = requirements.every(r => supplierSet.has(r.requirement_id));

      if (allSelected) {
        // Deselect all
        return { ...prev, [supplierId]: new Set() };
      } else {
        // Select all
        return {
          ...prev,
          [supplierId]: new Set(requirements.map(r => r.requirement_id)),
        };
      }
    });
  };

  const getSelectedCount = (supplierId: number): number => {
    return selectedItems[supplierId]?.size || 0;
  };

  const handleGenerateOrder = async (group: SupplierRequirementGroup) => {
    const selected = selectedItems[group.supplier_id];
    if (!selected || selected.size === 0) {
      showNotification('Please select at least one item', 'error');
      return;
    }

    try {
      setGeneratingOrders(prev => new Set(prev).add(group.supplier_id));

      const result = await supplierOrdersApi.generateOrder({
        supplier_id: group.supplier_id,
        requirement_ids: Array.from(selected),
      });

      showNotification(
        `Order ${result.order_number} created with ${result.items_created} items`,
        'success'
      );

      // Refresh data and notify parent
      void loadData();
      onOrderGenerated?.();
    } catch (error) {
      console.error('Error generating order:', error);
      showNotification('Failed to generate order', 'error');
    } finally {
      setGeneratingOrders(prev => {
        const next = new Set(prev);
        next.delete(group.supplier_id);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 ${MODULE_COLORS.supplyChain.border}`}></div>
        <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading requirements...</p>
      </div>
    );
  }

  if (!data || data.groups.length === 0) {
    return (
      <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium mb-1">No pending requirements</p>
        <p className="text-sm">All requirements have been ordered or received</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Requirements by Supplier</h3>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {data.total_requirements} pending items across {data.total_suppliers} suppliers
          </div>
        </div>
        <button
          onClick={() => void loadData()}
          className={`p-1.5 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Supplier Groups */}
      <div className="divide-y divide-gray-200">
        {data.groups.map((group) => {
          const isExpanded = expandedSuppliers.has(group.supplier_id);
          const selectedCount = getSelectedCount(group.supplier_id);
          const isGenerating = generatingOrders.has(group.supplier_id);

          return (
            <div key={group.supplier_id}>
              {/* Supplier Header */}
              <div
                className={`px-4 py-3 ${PAGE_STYLES.header.background} cursor-pointer hover:bg-gray-100 flex items-center justify-between`}
                onClick={() => toggleSupplierExpanded(group.supplier_id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <div className={`font-medium ${PAGE_STYLES.panel.text}`}>{group.supplier_name}</div>
                    <div className={`text-sm ${PAGE_STYLES.panel.textMuted} flex items-center gap-3`}>
                      <span>{group.item_count} items</span>
                      {group.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {group.contact_email}
                        </span>
                      )}
                      {group.contact_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {group.contact_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                    {selectedCount} of {group.item_count} selected
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleGenerateOrder(group);
                    }}
                    disabled={selectedCount === 0 || isGenerating}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${MODULE_COLORS.supplyChain.base} text-white ${MODULE_COLORS.supplyChain.hover} flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Generate Order
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Requirements Table */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
                      <tr>
                        <th className="px-4 py-2 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selectedCount === group.requirements.length && selectedCount > 0}
                            onChange={() => toggleAllForSupplier(group.supplier_id, group.requirements)}
                            className={`w-4 h-4 ${MODULE_COLORS.supplyChain.text} rounded`}
                          />
                        </th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase`}>Date</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase`}>Product</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase`}>Size</th>
                        <th className={`px-4 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase`}>Qty</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase`}>For</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase`}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.requirements.map((req) => {
                        const isSelected = selectedItems[group.supplier_id]?.has(req.requirement_id) || false;
                        return (
                          <tr
                            key={req.requirement_id}
                            className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? MODULE_COLORS.supplyChain.light : ''}`}
                          >
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItem(group.supplier_id, req.requirement_id)}
                                className={`w-4 h-4 ${MODULE_COLORS.supplyChain.text} rounded`}
                              />
                            </td>
                            <td className={`px-4 py-2 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                              {formatDate(req.entry_date)}
                            </td>
                            <td className={`px-4 py-2 text-sm ${PAGE_STYLES.panel.text}`}>
                              {req.archetype_name || req.custom_product_type || '-'}
                            </td>
                            <td className={`px-4 py-2 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                              {req.size_description || '-'}
                            </td>
                            <td className={`px-4 py-2 text-sm text-right ${PAGE_STYLES.panel.text}`}>
                              {req.quantity_ordered} {req.unit_of_measure || ''}
                            </td>
                            <td className={`px-4 py-2 text-sm`}>
                              {req.is_stock_item ? (
                                <span className={`${MODULE_COLORS.supplyChain.text} font-medium`}>Stock</span>
                              ) : (
                                <span className="text-blue-600">{req.order_number || 'Job'}</span>
                              )}
                            </td>
                            <td className={`px-4 py-2 text-sm ${PAGE_STYLES.panel.textMuted} max-w-[150px] truncate`}>
                              {req.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SupplierGroupedRequirements;
