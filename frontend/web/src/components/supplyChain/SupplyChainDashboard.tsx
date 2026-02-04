import React, { useCallback, useEffect, useState } from 'react';
import { HomeButton } from '../common/HomeButton';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Dashboard stats for supply chain overview
interface DashboardStats {
  total_categories: number;
  total_products: number;
  total_inventory_items: number;
  total_available_quantity: number;
  critical_items: number;
  low_items: number;
}
import { ProductCatalog } from './ProductCatalog';
import { UnifiedInventory } from './UnifiedInventory';
import { LowStockDashboard } from './LowStockDashboard';
import { OrderMaterialRequirements } from './OrderMaterialRequirements';
import { LowStockAlerts } from './LowStockAlerts';
import { AllOrdersMaterialRequirements } from './AllOrdersMaterialRequirements';
import { SupplierGroupedRequirements } from './SupplierGroupedRequirements';
import { SupplierOrdersList } from './SupplierOrdersList';
import { ShoppingCartComponent } from './ShoppingCart';
import { SuppliersManager } from './SuppliersManager';
import { ProductArchetypesManager } from './ProductArchetypesManager';
import { InventoryTab } from '../inventory/InventoryTab';
import { ShoppingCartProvider } from '../../contexts/ShoppingCartContext';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

interface SupplyChainDashboardProps {
  user: AccountUser | null;
}

type TabType = 'overview' | 'all-orders' | 'by-supplier' | 'supplier-orders' | 'shopping-cart' | 'vinyl-inventory' | 'inventory' | 'suppliers' | 'product-types' | 'products' | 'low-stock';

export const SupplyChainDashboard: React.FC<SupplyChainDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load real data from existing APIs
      const [vinylProductsRes, vinylInventoryRes] = await Promise.all([
        api.get<{ data?: unknown[] }>('/vinyl-products'),
        api.get<{ data?: Array<{ total_quantity: string | number }> }>('/vinyl')
      ]);

      const products = Array.isArray(vinylProductsRes.data)
        ? vinylProductsRes.data
        : vinylProductsRes.data?.data ?? [];
      const inventoryItems = Array.isArray(vinylInventoryRes.data)
        ? vinylInventoryRes.data
        : vinylInventoryRes.data?.data ?? [];

      const totalProducts = products.length;
      const totalInventoryItems = inventoryItems.length;
      const totalAvailableQuantity = inventoryItems.reduce((sum, item) => {
        const quantity = typeof item.total_quantity === 'string'
          ? parseFloat(item.total_quantity)
          : item.total_quantity;
        return sum + (Number.isFinite(quantity) ? Number(quantity) : 0);
      }, 0);

      const stats = {
        total_categories: 3, // Vinyl, LED, Power Supply
        total_products: totalProducts,
        total_inventory_items: totalInventoryItems,
        total_available_quantity: totalAvailableQuantity,
        critical_items: 5, // Mock for now
        low_items: 12 // Mock for now
      };
      
      setStats(stats);
    } catch (err: unknown) {
      console.error('Error loading dashboard stats:', err);
      setError('Unable to load supply chain stats right now. Showing sample data.');
      // Fallback to mock data if API fails
      const mockStats = {
        total_categories: 3,
        total_products: 215,
        total_inventory_items: 537,
        total_available_quantity: 1248.5,
        critical_items: 5,
        low_items: 12
      };
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    // TODO: Implement notification system
    console.log(`${type}: ${message}`);
  };

  const renderOverview = () => (
    <div className="space-y-6">

      {/* Orders Needing Materials - Full Width */}
      <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
        <OrderMaterialRequirements
          user={user || undefined}
          showNotification={showNotification}
          onAddToCart={(items) => showNotification(`Added ${items.length} items to cart`)}
        />
      </div>

      {/* Low Stock Alerts - Full Width */}
      <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
        <LowStockAlerts
          user={user || undefined}
          showNotification={showNotification}
          onAddToCart={(items) => showNotification(`Added ${items.length} items to cart`)}
        />
      </div>

    </div>
  );

  if (!user || (user.role !== 'manager' && user.role !== 'owner')) {
    return (
      <div className={`${PAGE_STYLES.fullPage} flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-red-400 text-xl font-semibold mb-2">Access Denied</div>
          <p className={`${PAGE_STYLES.page.text} mb-4`}>Supply Chain Management is available to managers and owners only.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className={`${MODULE_COLORS.supplyChain.base} text-white px-4 py-2 rounded-lg ${MODULE_COLORS.supplyChain.hover}`}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header */}
      <div className={`${PAGE_STYLES.panel.background} shadow`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <HomeButton />
              <h1 className={`text-3xl font-bold ${PAGE_STYLES.panel.text}`}>Supply Chain Management</h1>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className={`border-b ${PAGE_STYLES.panel.border}`}>
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Overview
              </button>
              
              <button
                onClick={() => setActiveTab('all-orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all-orders'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                All Requirements
              </button>

              <button
                onClick={() => setActiveTab('by-supplier')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'by-supplier'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                By Supplier
              </button>

              <button
                onClick={() => setActiveTab('supplier-orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'supplier-orders'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Supplier Orders
              </button>

              <button
                onClick={() => setActiveTab('shopping-cart')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'shopping-cart'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Shopping Cart
              </button>

              {/* Spacer */}
              <div className="flex-1"></div>
              
              <button
                onClick={() => setActiveTab('vinyl-inventory')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'vinyl-inventory'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Vinyl Inventory
              </button>
              
              <button
                onClick={() => setActiveTab('inventory')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inventory'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Inventory
              </button>
              
              <button
                onClick={() => setActiveTab('suppliers')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'suppliers'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Suppliers
              </button>

              <button
                onClick={() => setActiveTab('product-types')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'product-types'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Product Types
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'products'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Product Catalog
              </button>
              
              <button
                onClick={() => setActiveTab('low-stock')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'low-stock'
                    ? `${MODULE_COLORS.supplyChain.border} ${MODULE_COLORS.supplyChain.text}`
                    : 'border-transparent ${PAGE_STYLES.panel.textMuted}'
                }`}
              >
                Low Stock ({(stats?.critical_items || 0) + (stats?.low_items || 0)})
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ShoppingCartProvider showNotification={showNotification}>
          {loading ? (
          <div className="text-center py-12">
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${MODULE_COLORS.supplyChain.border}`}></div>
            <p className={`mt-2 ${PAGE_STYLES.page.text}`}>Loading...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-medium mb-2">Error</div>
            <p className={`${PAGE_STYLES.page.text} mb-4`}>{error}</p>
            <button
              onClick={loadStats}
              className={`${MODULE_COLORS.supplyChain.base} text-white px-4 py-2 rounded-lg ${MODULE_COLORS.supplyChain.hover}`}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'all-orders' && (
              <AllOrdersMaterialRequirements
                user={user || undefined}
                showNotification={showNotification}
              />
            )}
            {activeTab === 'by-supplier' && (
              <SupplierGroupedRequirements
                showNotification={showNotification}
                onOrderGenerated={() => void loadStats()}
              />
            )}
            {activeTab === 'supplier-orders' && (
              <SupplierOrdersList
                showNotification={showNotification}
                onViewOrder={(orderId) => showNotification(`View order ${orderId} (detail view coming soon)`)}
              />
            )}
            {activeTab === 'shopping-cart' && (
              <ShoppingCartComponent
                user={user}
                showNotification={showNotification}
              />
            )}
            {activeTab === 'vinyl-inventory' && (
              <InventoryTab
                user={user as any}
              />
            )}
            {activeTab === 'inventory' && (
              <UnifiedInventory 
                user={user} 
                onDataChange={loadStats}
                showNotification={showNotification}
              />
            )}
            {activeTab === 'suppliers' && (
              <SuppliersManager
                showNotification={showNotification}
              />
            )}
            {activeTab === 'product-types' && (
              <ProductArchetypesManager
                showNotification={showNotification}
              />
            )}
            {activeTab === 'products' && (
              <ProductCatalog 
                user={user} 
                onDataChange={loadStats}
                showNotification={showNotification}
              />
            )}
            {activeTab === 'low-stock' && (
              <LowStockDashboard 
                user={user} 
                onDataChange={loadStats}
                showNotification={showNotification}
              />
            )}
          </>
        )}
        </ShoppingCartProvider>
      </div>
    </div>
  );
};
