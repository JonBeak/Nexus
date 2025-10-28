import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardStats } from '../../services/supplyChainApi';
import api from '../../services/api';
import { ProductCatalog } from './ProductCatalog';
import { UnifiedInventory } from './UnifiedInventory';
import { LowStockDashboard } from './LowStockDashboard';
import { JobMaterialRequirements } from './JobMaterialRequirements';
import { LowStockAlerts } from './LowStockAlerts';
import { ShoppingCartComponent } from './ShoppingCart';
import { SuppliersManager } from './SuppliersManager';
import { InventoryTab } from '../inventory/InventoryTab';
import { ShoppingCartProvider } from '../../contexts/ShoppingCartContext';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface SupplyChainDashboardProps {
  user: AccountUser | null;
}

type TabType = 'overview' | 'shopping-cart' | 'vinyl-inventory' | 'inventory' | 'suppliers' | 'products' | 'low-stock';

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

      {/* Jobs and Low Stock Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <JobMaterialRequirements
            user={user || undefined}
            showNotification={showNotification}
            onAddToCart={(items) => showNotification(`Added ${items.length} items to cart`)}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <LowStockAlerts
            user={user || undefined}
            showNotification={showNotification}
            onAddToCart={(item) => showNotification(`Added ${item.name} to cart`)}
          />
        </div>
      </div>

    </div>
  );

  if (!user || (user.role !== 'manager' && user.role !== 'owner')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
          <p className="text-gray-500 mb-4">Supply Chain Management is available to managers and owners only.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Supply Chain Management</h1>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              
              <button
                onClick={() => setActiveTab('shopping-cart')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'shopping-cart'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Vinyl Inventory
              </button>
              
              <button
                onClick={() => setActiveTab('inventory')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inventory'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Inventory
              </button>
              
              <button
                onClick={() => setActiveTab('suppliers')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'suppliers'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Suppliers
              </button>
              
              <button
                onClick={() => setActiveTab('products')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'products'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Product Catalog
              </button>
              
              <button
                onClick={() => setActiveTab('low-stock')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'low-stock'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Low Stock ({(stats?.critical_items || 0) + (stats?.low_items || 0)})
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ShoppingCartProvider showNotification={showNotification}>
          {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-medium mb-2">Error</div>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={loadStats}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
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
                user={user}
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
