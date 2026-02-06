import React, { useCallback, useEffect, useState } from 'react';
import { Package, AlertTriangle, CheckCircle, ShoppingCart, Plus, Calendar, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { formatMonthDay } from '../../utils/dateUtils';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface MaterialRequirement {
  id: string;
  category: string;
  specification: string;
  quantity_needed: number;
  quantity_available: number;
  quantity_used?: number;
  unit: string;
  status: 'in_stock' | 'partial' | 'out_of_stock' | 'used';
  suggested_products?: {
    id: number;
    name: string;
    supplier_name: string;
    current_price?: number;
  }[];
}

interface OrderMaterialRequirement {
  order_id: number;
  order_number: string;
  order_name: string;
  customer_name: string;
  start_date?: string;
  due_date?: string;
  priority: 'high' | 'medium' | 'low';
  materials_planned: boolean;
  materials_needed: MaterialRequirement[];
  total_missing_items: number;
}

interface OrderMaterialRequirementsProps {
  user?: AccountUser;
  onAddToCart?: (items: MaterialRequirement[]) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

type SortMode = 'order' | 'material';

interface MaterialWithOrder extends MaterialRequirement {
  order_id: number;
  order_number: string;
  order_name: string;
}

export const OrderMaterialRequirements: React.FC<OrderMaterialRequirementsProps> = ({
  user,
  onAddToCart,
  showNotification
}) => {
  void user;
  const [orders, setOrders] = useState<OrderMaterialRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [, setEditingOrderId] = useState<number | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<{orderId: number, materialId: string} | null>(null);
  const [usageQuantity, setUsageQuantity] = useState<number>(0);

  const loadOrdersNeedingMaterials = useCallback(async () => {
    try {
      setLoading(true);

      // Mock data for now - will connect to real API later
      const mockOrders: OrderMaterialRequirement[] = [
        {
          order_id: 1234,
          order_number: 'O-2025-001',
          order_name: '24"x36" Vinyl Sign - Main Street Store',
          customer_name: 'Acme Signage Co.',
          start_date: '2025-01-20',
          due_date: '2025-01-25',
          priority: 'high',
          materials_planned: true,
          total_missing_items: 2,
          materials_needed: [
            {
              id: '1',
              category: 'Vinyl',
              specification: '3M 180C Red, 24" width',
              quantity_needed: 5,
              quantity_available: 0,
              unit: 'yards',
              status: 'out_of_stock',
              suggested_products: [
                { id: 1, name: '3M 180C Red 24"', supplier_name: '3M Preferred', current_price: 12.50 }
              ]
            },
            {
              id: '2',
              category: 'Vinyl',
              specification: '3M 180C White, 24" width',
              quantity_needed: 2,
              quantity_available: 8,
              unit: 'yards',
              status: 'in_stock'
            },
            {
              id: '3',
              category: 'LED',
              specification: '12mm White LEDs',
              quantity_needed: 50,
              quantity_available: 12,
              unit: 'pieces',
              status: 'partial',
              suggested_products: [
                { id: 2, name: '12mm White LED Module', supplier_name: 'LED Supply Co', current_price: 2.75 }
              ]
            }
          ]
        },
        {
          order_id: 1235,
          order_number: 'O-2025-002',
          order_name: 'LED Channel Letters - Downtown Restaurant',
          customer_name: 'Metro Signs Ltd.',
          start_date: '2025-01-22',
          due_date: '2025-01-30',
          priority: 'medium',
          materials_planned: false,
          total_missing_items: 0,
          materials_needed: []
        },
        {
          order_id: 1236,
          order_number: 'O-2025-003',
          order_name: 'Vehicle Wrap - Delivery Van',
          customer_name: 'QuickPrint Solutions',
          start_date: '2025-01-25',
          due_date: '2025-02-01',
          priority: 'medium',
          materials_planned: true,
          total_missing_items: 3,
          materials_needed: [
            {
              id: '4',
              category: 'Vinyl',
              specification: 'Avery 1005 White, 54" width',
              quantity_needed: 15,
              quantity_available: 5,
              unit: 'yards',
              status: 'partial',
              suggested_products: [
                { id: 3, name: 'Avery 1005 White 54"', supplier_name: 'Avery Dennison', current_price: 8.95 }
              ]
            }
          ]
        }
      ];

      setOrders(mockOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      showNotification('Failed to load orders needing materials', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadOrdersNeedingMaterials();
  }, [loadOrdersNeedingMaterials]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" />In Stock</span>;
      case 'partial':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Partial</span>;
      case 'out_of_stock':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Out</span>;
      case 'used':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><Check className="w-3 h-3" />Used</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">High</span>;
      case 'medium': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Medium</span>;
      case 'low': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Low</span>;
      default: return null;
    }
  };

  const getOrderStatusBadge = (order: OrderMaterialRequirement) => {
    if (!order.materials_planned) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">Not Planned</span>;
    }
    if (order.total_missing_items > 0) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">{order.total_missing_items} Missing</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Ready</span>;
  };

  const handleAddMissingToCart = (order: OrderMaterialRequirement, e: React.MouseEvent) => {
    e.stopPropagation();
    const missingItems = order.materials_needed.filter(m => m.status !== 'in_stock' && m.status !== 'used');

    if (missingItems.length === 0) {
      showNotification('No missing materials to add to cart');
      return;
    }

    showNotification(`Added ${missingItems.length} missing items from ${order.order_number} to cart`, 'success');

    if (onAddToCart) {
      onAddToCart(missingItems);
    }
  };

  const handlePlanMaterials = (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOrderId(orderId);
    setShowAddMaterialModal(true);
  };

  const handleMarkAsUsed = (orderId: number, materialId: string, quantityNeeded: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMaterial({ orderId, materialId });
    setUsageQuantity(quantityNeeded);
  };

  const handleAddSingleToCart = (material: MaterialRequirement, e: React.MouseEvent) => {
    e.stopPropagation();
    showNotification(`Added ${material.specification} to cart`, 'success');
    if (onAddToCart) {
      onAddToCart([material]);
    }
  };

  const confirmUsage = () => {
    if (!editingMaterial) return;

    setOrders(prevOrders =>
      prevOrders.map(order => {
        if (order.order_id === editingMaterial.orderId) {
          return {
            ...order,
            materials_needed: order.materials_needed.map(material => {
              if (material.id === editingMaterial.materialId) {
                return {
                  ...material,
                  status: 'used' as const,
                  quantity_used: usageQuantity
                };
              }
              return material;
            })
          };
        }
        return order;
      })
    );

    showNotification(`Marked ${usageQuantity} units as used`, 'success');
    setEditingMaterial(null);
    setUsageQuantity(0);
  };

  const cancelUsage = () => {
    setEditingMaterial(null);
    setUsageQuantity(0);
  };

  // Get all materials with their order info for material-sorted view
  const getAllMaterialsWithOrders = (): MaterialWithOrder[] => {
    const materials: MaterialWithOrder[] = [];
    orders.forEach(order => {
      order.materials_needed.forEach(material => {
        materials.push({
          ...material,
          order_id: order.order_id,
          order_number: order.order_number,
          order_name: order.order_name
        });
      });
    });
    // Sort by specification
    return materials.sort((a, b) => a.specification.localeCompare(b.specification));
  };

  const thClass = `px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading orders...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Orders Needing Materials</h3>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {orders.filter(o => o.total_missing_items > 0).length} orders need materials
          </div>
        </div>

        {/* Sort Toggle */}
        <div className={`flex items-center ${PAGE_STYLES.panel.background} rounded-lg p-1`}>
          <button
            onClick={() => setSortMode('order')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortMode === 'order'
                ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} shadow`
                : PAGE_STYLES.panel.textMuted
            }`}
          >
            By Order
          </button>
          <button
            onClick={() => setSortMode('material')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              sortMode === 'material'
                ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} shadow`
                : PAGE_STYLES.panel.textMuted
            }`}
          >
            By Material
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className={`text-center py-8 ${PAGE_STYLES.header.background}`}>
          <Calendar className={`w-8 h-8 ${PAGE_STYLES.panel.textMuted} mx-auto mb-2`} />
          <p className={PAGE_STYLES.panel.textMuted}>No orders currently need material planning</p>
        </div>
      ) : sortMode === 'order' ? (
        /* Sort by Order View */
        <div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
                <tr>
                  <th className={`${thClass} w-8`}></th>
                  <th className={thClass}>Order #</th>
                  <th className={thClass}>Order Name</th>
                  <th className={thClass}>Start</th>
                  <th className={thClass}>Due</th>
                  <th className={thClass}>Priority</th>
                  <th className={thClass}>Materials</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className={PAGE_STYLES.panel.divider}>
                {orders.map(order => (
                  <React.Fragment key={order.order_id}>
                    {/* Order Row */}
                    <tr
                      onClick={() => setExpandedOrder(expandedOrder === order.order_id ? null : order.order_id)}
                      className="hover:bg-[var(--theme-hover-bg)] cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        {order.materials_needed.length > 0 && (
                          expandedOrder === order.order_id
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-purple-600">
                        {order.order_number}
                      </td>
                      <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.text}`}>
                        {order.order_name}
                      </td>
                      <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                        {formatMonthDay(order.start_date)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                        {formatMonthDay(order.due_date)}
                      </td>
                      <td className="px-4 py-3">
                        {getPriorityBadge(order.priority)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                        {order.materials_needed.length} items
                      </td>
                      <td className="px-4 py-3">
                        {getOrderStatusBadge(order)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!order.materials_planned ? (
                          <button
                            onClick={(e) => handlePlanMaterials(order.order_id, e)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            <Plus className="w-3 h-3" /> Plan
                          </button>
                        ) : order.total_missing_items > 0 ? (
                          <button
                            onClick={(e) => handleAddMissingToCart(order, e)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            <ShoppingCart className="w-3 h-3" /> Add Missing
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                            <CheckCircle className="w-3 h-3" /> Ready
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Materials Table */}
                    {expandedOrder === order.order_id && order.materials_needed.length > 0 && (
                      <tr>
                        <td colSpan={9} className={`px-4 py-3 ${PAGE_STYLES.header.background}`}>
                          <table className="w-full">
                            <thead>
                              <tr className={`text-xs ${PAGE_STYLES.panel.textSecondary} uppercase`}>
                                <th className="px-3 py-2 text-left">Category</th>
                                <th className="px-3 py-2 text-left">Specification</th>
                                <th className="px-3 py-2 text-right">Required</th>
                                <th className="px-3 py-2 text-right">Available</th>
                                <th className="px-3 py-2 text-right">Short</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.materials_needed.map(material => {
                                const shortage = Math.max(0, material.quantity_needed - material.quantity_available);
                                return (
                                  <tr key={material.id} className={`border-t ${PAGE_STYLES.panel.border}`}>
                                    <td className={`px-3 py-2 text-sm ${PAGE_STYLES.panel.textSecondary}`}>{material.category}</td>
                                    <td className={`px-3 py-2 text-sm font-medium ${PAGE_STYLES.panel.text}`}>{material.specification}</td>
                                    <td className={`px-3 py-2 text-sm ${PAGE_STYLES.panel.textSecondary} text-right`}>{material.quantity_needed} {material.unit}</td>
                                    <td className={`px-3 py-2 text-sm ${PAGE_STYLES.panel.textSecondary} text-right`}>{material.quantity_available} {material.unit}</td>
                                    <td className={`px-3 py-2 text-sm text-right font-medium ${shortage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {shortage > 0 ? `-${shortage}` : '0'}
                                    </td>
                                    <td className="px-3 py-2 text-center">{getStatusBadge(material.status)}</td>
                                    <td className="px-3 py-2 text-right">
                                      {material.status === 'in_stock' && !material.quantity_used && (
                                        <button
                                          onClick={(e) => handleMarkAsUsed(order.order_id, material.id, material.quantity_needed, e)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                        >
                                          <Check className="w-3 h-3" /> Mark Used
                                        </button>
                                      )}
                                      {material.status !== 'in_stock' && material.status !== 'used' && (
                                        <button
                                          onClick={(e) => handleAddSingleToCart(material, e)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                        >
                                          <ShoppingCart className="w-3 h-3" /> Add
                                        </button>
                                      )}
                                      {material.status === 'used' && (
                                        <span className="text-xs text-blue-600">Used: {material.quantity_used} {material.unit}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Sort by Material View */
        <div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
                <tr>
                  <th className={thClass}>Category</th>
                  <th className={thClass}>Specification</th>
                  <th className={thClass}>Order #</th>
                  <th className={thClass}>Order Name</th>
                  <th className={`${thClass} text-right`}>Required</th>
                  <th className={`${thClass} text-right`}>Available</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className={PAGE_STYLES.panel.divider}>
                {getAllMaterialsWithOrders().map((material, index) => (
                  <tr key={`${material.order_id}-${material.id}-${index}`} className="hover:bg-[var(--theme-hover-bg)]">
                    <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>{material.category}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${PAGE_STYLES.panel.text}`}>{material.specification}</td>
                    <td className="px-4 py-3 text-sm font-medium text-purple-600">{material.order_number}</td>
                    <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>{material.order_name}</td>
                    <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.text} text-right`}>{material.quantity_needed} {material.unit}</td>
                    <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary} text-right`}>{material.quantity_available} {material.unit}</td>
                    <td className="px-4 py-3">{getStatusBadge(material.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {material.status === 'in_stock' && !material.quantity_used && (
                        <button
                          onClick={(e) => handleMarkAsUsed(material.order_id, material.id, material.quantity_needed, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          <Check className="w-3 h-3" /> Mark Used
                        </button>
                      )}
                      {material.status !== 'in_stock' && material.status !== 'used' && (
                        <button
                          onClick={(e) => handleAddSingleToCart(material, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          <ShoppingCart className="w-3 h-3" /> Add
                        </button>
                      )}
                      {material.status === 'used' && (
                        <span className="text-xs text-blue-600">Used: {material.quantity_used} {material.unit}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {getAllMaterialsWithOrders().length === 0 && (
            <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
              No materials planned for any orders
            </div>
          )}
        </div>
      )}

      {/* Mark as Used Modal */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4`}>
            <div className="p-6">
              <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-4`}>Mark Material as Used</h2>
              <div className="mb-4">
                <p className={`${PAGE_STYLES.panel.textSecondary} mb-3`}>
                  How much of this material was actually used for this order?
                </p>
                <div className="flex items-center space-x-3">
                  <label className={`text-sm font-medium ${PAGE_STYLES.panel.textSecondary}`}>Quantity Used:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={usageQuantity}
                    onChange={(e) => setUsageQuantity(Number(e.target.value))}
                    className={`w-24 px-3 py-1 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded focus:ring-blue-500 focus:border-blue-500`}
                  />
                  <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                    {orders.find(o => o.order_id === editingMaterial.orderId)?.materials_needed.find(m => m.id === editingMaterial.materialId)?.unit}
                  </span>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelUsage}
                  className={`px-4 py-2 ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.header.background} rounded hover:opacity-80`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUsage}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Mark as Used
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Planning Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-2xl w-full mx-4`}>
            <div className="p-6">
              <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-4`}>Plan Materials for Order</h2>
              <p className={`${PAGE_STYLES.panel.textSecondary} mb-4`}>
                Material planning functionality will be implemented next. For now, you can manually add material requirements.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddMaterialModal(false)}
                  className={`px-4 py-2 ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.header.background} rounded hover:opacity-80`}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    showNotification('Material planning feature coming soon!');
                    setShowAddMaterialModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
