/**
 * Supplier Products & Orders
 * Two-view component: supplier list with stats → drill into products + order history
 * Created: 2026-02-10
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Package,
  Search,
  RefreshCw,
  Mail,
  Phone,
} from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { formatDateWithYear } from '../../utils/dateUtils';
import { suppliersApi } from '../../services/api';
import { SupplierOrdersList } from './SupplierOrdersList';
import api from '../../services/api';

interface SupplierProductsAndOrdersProps {
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

interface SupplierStats {
  supplier_id: number;
  supplier_name: string;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  product_count: number;
  total_order_count: number;
  open_order_count: number;
  last_order_date: string | null;
}

interface SupplierProduct {
  supplier_product_id: number;
  supplier_id: number;
  archetype_id: number | null;
  product_name: string;
  sku: string | null;
  current_price: number;
  unit_of_measure: string | null;
  archetype_unit_of_measure?: string;
  effective_unit_of_measure?: string;
  lead_time_days: number | null;
  minimum_order_quantity: number | null;
  is_active: boolean;
  archetype_name?: string;
}

export const SupplierProductsAndOrders: React.FC<SupplierProductsAndOrdersProps> = ({
  showNotification,
}) => {
  const [supplierStats, setSupplierStats] = useState<SupplierStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await suppliersApi.getSupplyChainStats();
      setSupplierStats(data);
    } catch (error) {
      console.error('Error loading supplier stats:', error);
      showNotification('Failed to load supplier stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const loadProducts = useCallback(async (suppId: number) => {
    try {
      setProductsLoading(true);
      const response = await api.get(`/supplier-products`, { params: { supplier_id: suppId } });
      const data = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
      setSupplierProducts(data);
    } catch (error) {
      console.error('Error loading supplier products:', error);
      showNotification('Failed to load products', 'error');
    } finally {
      setProductsLoading(false);
    }
  }, [showNotification]);

  const handleSelectSupplier = (suppId: number, name: string) => {
    setSelectedSupplierId(suppId);
    setSelectedSupplierName(name);
    void loadProducts(suppId);
  };

  const handleBack = () => {
    setSelectedSupplierId(null);
    setSelectedSupplierName('');
    setSupplierProducts([]);
  };

  const filtered = supplierStats.filter(s =>
    s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const thClass = `px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  // ========== SUPPLIER DETAIL VIEW ==========
  if (selectedSupplierId) {
    const supplier = supplierStats.find(s => s.supplier_id === selectedSupplierId);

    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className={`p-2 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border} hover:bg-[var(--theme-hover-bg)]`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>{selectedSupplierName}</h3>
            <div className={`flex items-center gap-4 text-sm ${PAGE_STYLES.panel.textMuted}`}>
              {supplier?.primary_contact_email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {supplier.primary_contact_email}
                </span>
              )}
              {supplier?.primary_contact_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {supplier.primary_contact_phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
          <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b ${PAGE_STYLES.header.background}`}>
            <h4 className={`font-medium ${PAGE_STYLES.panel.text} flex items-center gap-2`}>
              <Package className="w-4 h-4" />
              Products ({supplierProducts.length})
            </h4>
          </div>
          {productsLoading ? (
            <div className="text-center py-6">
              <div className={`inline-block animate-spin rounded-full h-5 w-5 border-b-2 ${MODULE_COLORS.supplyChain.border}`}></div>
            </div>
          ) : supplierProducts.length === 0 ? (
            <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No products from this supplier</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
                  <tr>
                    <th className={thClass}>Product</th>
                    <th className={thClass}>SKU</th>
                    <th className={thClass}>Category</th>
                    <th className={`${thClass} text-right`}>Price</th>
                    <th className={thClass}>Unit</th>
                    <th className={`${thClass} text-center`}>Lead Time</th>
                    <th className={`${thClass} text-center`}>Min Order</th>
                  </tr>
                </thead>
                <tbody className={PAGE_STYLES.panel.divider}>
                  {supplierProducts.map((p) => (
                    <tr key={p.supplier_product_id} className="hover:bg-[var(--theme-hover-bg)]">
                      <td className={`px-4 py-2.5 text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                        {p.product_name}
                      </td>
                      <td className={`px-4 py-2.5 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                        {p.sku || '-'}
                      </td>
                      <td className={`px-4 py-2.5 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                        {p.archetype_name || '-'}
                      </td>
                      <td className={`px-4 py-2.5 text-sm text-right font-medium ${PAGE_STYLES.panel.text}`}>
                        {formatCurrency(p.current_price)}
                      </td>
                      <td className={`px-4 py-2.5 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                        {p.effective_unit_of_measure || p.unit_of_measure || p.archetype_unit_of_measure || '-'}
                      </td>
                      <td className={`px-4 py-2.5 text-sm text-center ${PAGE_STYLES.panel.textMuted}`}>
                        {p.lead_time_days ? `${p.lead_time_days}d` : '-'}
                      </td>
                      <td className={`px-4 py-2.5 text-sm text-center ${PAGE_STYLES.panel.textMuted}`}>
                        {p.minimum_order_quantity || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order History Section */}
        <div>
          <SupplierOrdersList
            showNotification={showNotification}
            supplierId={selectedSupplierId}
            onViewOrder={(orderId) => showNotification(`View order ${orderId} (detail view coming soon)`)}
          />
        </div>
      </div>
    );
  }

  // ========== SUPPLIER LIST VIEW ==========
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${MODULE_COLORS.supplyChain.border}`}></div>
        <p className={`mt-2 ${PAGE_STYLES.page.text}`}>Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Supplier Products & Orders</h3>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {supplierStats.length} active suppliers
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-9 pr-3 py-1.5 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md focus:ring-purple-500 focus:border-purple-500 w-56`}
            />
          </div>
          <button
            onClick={() => void loadStats()}
            className={`p-1.5 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
            <tr>
              <th className={thClass}>Supplier</th>
              <th className={thClass}>Contact</th>
              <th className={`${thClass} text-center`}>Products</th>
              <th className={`${thClass} text-center`}>Total Orders</th>
              <th className={`${thClass} text-center`}>Open Orders</th>
              <th className={thClass}>Last Order</th>
            </tr>
          </thead>
          <tbody className={PAGE_STYLES.panel.divider}>
            {filtered.map((s) => (
              <tr
                key={s.supplier_id}
                className="hover:bg-[var(--theme-hover-bg)] cursor-pointer"
                onClick={() => handleSelectSupplier(s.supplier_id, s.supplier_name)}
              >
                <td className={`px-4 py-3 text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                  <div className="flex items-center gap-2">
                    <Building2 className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
                    {s.supplier_name}
                  </div>
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                  {s.primary_contact_email || s.primary_contact_phone || '-'}
                </td>
                <td className={`px-4 py-3 text-sm text-center ${PAGE_STYLES.panel.text}`}>
                  {s.product_count}
                </td>
                <td className={`px-4 py-3 text-sm text-center ${PAGE_STYLES.panel.text}`}>
                  {s.total_order_count}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  {s.open_order_count > 0 ? (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {s.open_order_count}
                    </span>
                  ) : (
                    <span className={PAGE_STYLES.panel.textMuted}>0</span>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {formatDateWithYear(s.last_order_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No suppliers found</p>
          {searchTerm && <p className="text-sm">Try a different search term</p>}
        </div>
      )}
    </div>
  );
};
