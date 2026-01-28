import React, { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Package } from 'lucide-react';
import { useShoppingCart } from '../../contexts/ShoppingCartContext';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface LowStockItem {
  id: number;
  name: string;
  category: string;
  category_icon: string;
  current_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  unit: string;
  supplier_name: string;
  current_price?: number;
  status: 'critical' | 'low' | 'ok';
  last_ordered?: string;
}

interface LowStockAlertsProps {
  user?: AccountUser;
  onAddToCart?: (item: LowStockItem) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

type StockFilter = 'all' | 'critical' | 'low';

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  user,
  onAddToCart,
  showNotification
}) => {
  void user;
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StockFilter>('all');
  const { addLowStockItemToCart } = useShoppingCart();

  const loadLowStockItems = useCallback(async () => {
    try {
      setLoading(true);

      // Mock data for now - will connect to real API later
      const mockLowStockItems: LowStockItem[] = [
        {
          id: 1,
          name: '3M 180C White 24"',
          category: 'Vinyl',
          category_icon: 'layers',
          current_stock: 2,
          reorder_point: 5,
          reorder_quantity: 10,
          unit: 'rolls',
          supplier_name: '3M Preferred',
          current_price: 45.99,
          status: 'critical',
          last_ordered: '2024-12-15'
        },
        {
          id: 2,
          name: 'Avery 900 Black 24"',
          category: 'Vinyl',
          category_icon: 'layers',
          current_stock: 1,
          reorder_point: 3,
          reorder_quantity: 5,
          unit: 'rolls',
          supplier_name: 'Avery Dennison',
          current_price: 38.50,
          status: 'critical'
        },
        {
          id: 3,
          name: '12mm White LED Module',
          category: 'LED',
          category_icon: 'zap',
          current_stock: 15,
          reorder_point: 25,
          reorder_quantity: 50,
          unit: 'pieces',
          supplier_name: 'LED Supply Co',
          current_price: 2.75,
          status: 'low',
          last_ordered: '2024-11-20'
        },
        {
          id: 4,
          name: '60W 12V Power Supply',
          category: 'Power Supply',
          category_icon: 'battery',
          current_stock: 0,
          reorder_point: 2,
          reorder_quantity: 5,
          unit: 'units',
          supplier_name: 'Power Pro',
          current_price: 24.99,
          status: 'critical'
        },
        {
          id: 5,
          name: '3M 8518 Laminate 24"',
          category: 'Vinyl',
          category_icon: 'layers',
          current_stock: 4,
          reorder_point: 6,
          reorder_quantity: 8,
          unit: 'rolls',
          supplier_name: '3M Preferred',
          current_price: 52.00,
          status: 'low'
        }
      ];

      setLowStockItems(mockLowStockItems);
    } catch (error) {
      console.error('Error loading low stock items:', error);
      showNotification('Failed to load low stock alerts', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadLowStockItems();
  }, [loadLowStockItems]);

  const getStatusBadge = (status: string, currentStock: number) => {
    if (status === 'critical') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          {currentStock === 0 ? 'OUT' : 'CRITICAL'}
        </span>
      );
    }
    if (status === 'low') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">LOW</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">OK</span>;
  };

  const getStockColor = (item: LowStockItem) => {
    if (item.current_stock === 0) return 'text-red-600 font-semibold';
    if (item.current_stock <= item.reorder_point * 0.5) return 'text-red-500';
    if (item.current_stock <= item.reorder_point) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredItems = lowStockItems.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const criticalCount = lowStockItems.filter(item => item.status === 'critical').length;
  const lowCount = lowStockItems.filter(item => item.status === 'low').length;

  const handleAddToCart = async (item: LowStockItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await addLowStockItemToCart({
        id: item.id,
        name: item.name,
        category: item.category,
        supplier_name: item.supplier_name,
        reorder_quantity: item.reorder_quantity,
        unit: item.unit,
        current_price: item.current_price
      });

      if (onAddToCart) {
        onAddToCart(item);
      }
    } catch (error) {
      console.error('Error adding low stock item to cart:', error);
      showNotification('Failed to add item to cart', 'error');
    }
  };

  const handleAddAllCritical = async () => {
    const criticalItems = lowStockItems.filter(item => item.status === 'critical');

    try {
      for (const item of criticalItems) {
        await addLowStockItemToCart({
          id: item.id,
          name: item.name,
          category: item.category,
          supplier_name: item.supplier_name,
          reorder_quantity: item.reorder_quantity,
          unit: item.unit,
          current_price: item.current_price
        });
      }

      showNotification(`Added ${criticalItems.length} critical items to cart`, 'success');
    } catch (error) {
      console.error('Error adding critical low stock items:', error);
      showNotification('Failed to add some items to cart', 'error');
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const thClass = `px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
        <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading low stock alerts...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Low Stock Alerts</h3>
          <div className={`flex items-center space-x-4 text-sm ${PAGE_STYLES.panel.textMuted}`}>
            <span className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
              {criticalCount} critical
            </span>
            <span className="flex items-center">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
              {lowCount} low
            </span>
          </div>
        </div>

        {criticalCount > 0 && (
          <button
            onClick={handleAddAllCritical}
            className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Add All Critical</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className={`px-4 border-b ${PAGE_STYLES.panel.border}`}>
        <nav className="-mb-px flex space-x-8">
          {([
            { key: 'all' as const, label: `All (${lowStockItems.length})` },
            { key: 'critical' as const, label: `Critical (${criticalCount})` },
            { key: 'low' as const, label: `Low (${lowCount})` }
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === tab.key
                  ? 'border-red-500 text-red-600'
                  : `border-transparent ${PAGE_STYLES.panel.textMuted}`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className={`text-center py-8 ${PAGE_STYLES.header.background}`}>
          <Package className={`w-8 h-8 ${PAGE_STYLES.panel.textMuted} mx-auto mb-2`} />
          <p className={PAGE_STYLES.panel.textMuted}>No {filter === 'all' ? '' : filter} stock items found</p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
                <tr>
                  <th className={thClass}>Product</th>
                  <th className={thClass}>Category</th>
                  <th className={thClass}>Supplier</th>
                  <th className={`${thClass} text-right`}>Stock</th>
                  <th className={`${thClass} text-right`}>Reorder At</th>
                  <th className={`${thClass} text-right`}>Order Qty</th>
                  <th className={`${thClass} text-right`}>Price</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} w-12`}></th>
                </tr>
              </thead>
              <tbody className={PAGE_STYLES.panel.divider}>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-[var(--theme-hover-bg)] ${
                      item.status === 'critical' ? 'bg-red-50/50' : item.status === 'low' ? 'bg-yellow-50/30' : ''
                    }`}
                  >
                    <td className={`px-4 py-3 text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                      {item.name}
                    </td>
                    <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                      {item.category}
                    </td>
                    <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                      {item.supplier_name}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${getStockColor(item)}`}>
                      {item.current_stock} / {item.reorder_point}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${PAGE_STYLES.panel.textSecondary}`}>
                      {item.reorder_point} {item.unit}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${PAGE_STYLES.panel.text}`}>
                      {item.reorder_quantity} {item.unit}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${PAGE_STYLES.panel.text}`}>
                      {formatCurrency(item.current_price)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.status, item.current_stock)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => handleAddToCart(item, e)}
                        className={`p-1.5 rounded transition-colors ${
                          item.status === 'critical'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-yellow-600 text-white hover:bg-yellow-700'
                        }`}
                        title={`Add ${item.reorder_quantity} ${item.unit} to cart`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
