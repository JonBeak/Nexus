import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShoppingCart, Package, Layers, Zap, Battery } from 'lucide-react';
import { useShoppingCart } from '../../contexts/ShoppingCartContext';

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
  user: any;
  onAddToCart?: (item: LowStockItem) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'layers': return Layers;
    case 'zap': return Zap;
    case 'battery': return Battery;
    default: return Package;
  }
};

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  user,
  onAddToCart,
  showNotification
}) => {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'low'>('all');
  const { addLowStockItemToCart } = useShoppingCart();

  const loadLowStockItems = async () => {
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
  };

  useEffect(() => {
    loadLowStockItems();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'low': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const filteredItems = lowStockItems.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const criticalCount = lowStockItems.filter(item => item.status === 'critical').length;
  const lowCount = lowStockItems.filter(item => item.status === 'low').length;

  const handleAddToCart = async (item: LowStockItem) => {
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
      
      // Also call the legacy callback if provided
      if (onAddToCart) {
        onAddToCart(item);
      }
    } catch (error) {
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
      showNotification('Failed to add some items to cart', 'error');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
        <p className="mt-2 text-sm text-gray-600">Loading low stock alerts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Low Stock Alerts</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
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
            className="flex items-center space-x-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Add All Critical</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: `All (${lowStockItems.length})` },
            { key: 'critical', label: `Critical (${criticalCount})` },
            { key: 'low', label: `Low (${lowCount})` }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === tab.key
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No {filter === 'all' ? '' : filter} stock items found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const IconComponent = getIconComponent(item.category_icon);
            
            return (
              <div key={item.id} className={`border rounded-lg p-3 ${getStatusColor(item.status)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded ${
                      item.status === 'critical' ? 'bg-red-200' : 'bg-yellow-200'
                    }`}>
                      <IconComponent className={`w-4 h-4 ${
                        item.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                      }`} />
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.category} • {item.supplier_name}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Stock: {item.current_stock} {item.unit} | 
                        Reorder at: {item.reorder_point} {item.unit} |
                        Order qty: {item.reorder_quantity} {item.unit}
                        {item.current_price && (
                          <span> • ${item.current_price}/unit</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {item.status === 'critical' && (
                      <span className="text-xs font-medium text-red-700">
                        {item.current_stock === 0 ? 'OUT OF STOCK' : 'CRITICAL LOW'}
                      </span>
                    )}
                    
                    <button
                      onClick={() => handleAddToCart(item)}
                      className={`p-2 rounded ${
                        item.status === 'critical' 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'bg-yellow-600 text-white hover:bg-yellow-700'
                      }`}
                      title={`Add ${item.reorder_quantity} ${item.unit} to cart`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Stock Level Visual */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Stock Level</span>
                    <span>{item.current_stock} / {item.reorder_point} {item.unit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.current_stock === 0 ? 'bg-red-600' :
                        item.current_stock <= item.reorder_point * 0.5 ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (item.current_stock / item.reorder_point) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};