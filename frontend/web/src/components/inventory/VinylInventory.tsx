import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { vinylApi, vinylProductsApi } from '../../services/api';

// Import extracted components
import { BulkEntriesTab } from './BulkEntriesTab';
import { InventoryTab } from './InventoryTab';
import { ProductsTab } from './ProductsTab';
import { Notification } from './Notification';
import { ConfirmationModal } from './ConfirmationModal';
import { VinylModal } from './VinylModal';
import { ProductModal } from './ProductModal';
import { StatusChangeModal } from './StatusChangeModal';
import {
  InventoryStats,
  InventoryUser,
  StatusChangePayload,
  VinylAutofillSuggestions,
  VinylFormSubmission,
  VinylItem,
  VinylProduct,
  VinylProductFormSubmission
} from './types';
interface VinylInventoryProps {
  user: InventoryUser;
}

const VinylInventory: React.FC<VinylInventoryProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'bulk' | 'inventory' | 'products'>('bulk');

  // Refs to hold refresh functions from child tabs
  const refreshProductsRef = useRef<(() => void) | null>(null);

  // Data state
  const [vinylItems, setVinylItems] = useState<VinylItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [products, setProducts] = useState<VinylProduct[]>([]);
  const [loadingVinyl, setLoadingVinyl] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VinylItem | null>(null);
  const [editingProduct, setEditingProduct] = useState<VinylProduct | null>(null);
  const [changingStatusItem, setChangingStatusItem] = useState<VinylItem | null>(null);

  // Bulk entries state for autofill
  const [bulkAutofillSuggestions, setBulkAutofillSuggestions] = useState<VinylAutofillSuggestions>({ combinations: [] });
  const [bulkLoadingSuggestions, setBulkLoadingSuggestions] = useState(false);

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    show: boolean;
  }>({
    message: '',
    type: 'success',
    show: false
  });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: string;
    confirmText: string;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning',
    confirmText: 'Confirm'
  });

  // Utility functions
  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type, show: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  }, []);

  const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: string = 'warning',
    confirmText: string = 'Confirm'
  ) => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm,
      type,
      confirmText
    });
  };

  const loadVinylData = useCallback(async () => {
    try {
      setLoadingVinyl(true);
      const [itemsResponse, statsResponse] = await Promise.all([
        vinylApi.getVinylItems({}),
        vinylApi.getVinylStats()
      ]);

      // Interceptor unwraps ServiceResult, so we get data directly
      setVinylItems((itemsResponse || []) as VinylItem[]);
      setStats((statsResponse || {}) as InventoryStats);
    } catch (error) {
      console.error('Failed to load vinyl data:', error);
      showNotification('Failed to load vinyl data', 'error');
    } finally {
      setLoadingVinyl(false);
    }
  }, [showNotification]);

  const loadBulkAutofillSuggestions = useCallback(async () => {
    setBulkLoadingSuggestions(true);
    try {
      const response = await vinylProductsApi.getAutofillSuggestions({});
      // Interceptor unwraps ServiceResult, so we get data directly
      setBulkAutofillSuggestions(response || { combinations: [] });
    } catch (error) {
      console.error('Failed to load autofill suggestions:', error);
      setBulkAutofillSuggestions({ combinations: [] });
    } finally {
      setBulkLoadingSuggestions(false);
    }
  }, []);

  const loadProductsData = useCallback(async () => {
    try {
      const productsResponse = await vinylProductsApi.getVinylProducts();
      // Interceptor unwraps ServiceResult, so we get data directly
      setProducts((productsResponse || []) as VinylProduct[]);
    } catch (error) {
      console.error('Failed to load product catalog:', error);
      setProducts([]);
    }
  }, []);

  // Load autofill suggestions once on mount
  useEffect(() => {
    void loadBulkAutofillSuggestions();
  }, [loadBulkAutofillSuggestions]);

  // Load vinyl and product data when component mounts or tab changes
  useEffect(() => {
    void loadVinylData();
    void loadProductsData();
  }, [activeTab, loadVinylData, loadProductsData]);

  // Event handlers
  const handleDeleteVinyl = async (id: number) => {
    showConfirmation(
      'Delete Vinyl Item',
      'Are you sure you want to delete this vinyl item? This action cannot be undone.',
      async () => {
        try {
          await vinylApi.deleteVinylItem(id);
          await loadVinylData(); // Reload data to update inventory count
          showNotification('Vinyl item deleted successfully', 'success');
        } catch (error) {
          console.error('Failed to delete vinyl item:', error);
          showNotification('Failed to delete vinyl item', 'error');
        }
      },
      'danger',
      'Delete'
    );
  };

  const handleDeleteProduct = async (id: number) => {
    showConfirmation(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      async () => {
        try {
          await vinylProductsApi.deleteVinylProduct(id);
          // Refresh the products tab
          if (refreshProductsRef.current) {
            refreshProductsRef.current();
          }
          await loadBulkAutofillSuggestions(); // Reload suggestions - product catalog changed
          showNotification('Product deleted successfully', 'success');
        } catch (error) {
          console.error('Failed to delete product:', error);
          showNotification('Failed to delete product', 'error');
        }
      },
      'danger',
      'Delete'
    );
  };

  const handleAddVinyl = async (vinylData: VinylFormSubmission) => {
    try {
      await vinylApi.createVinylItem(vinylData);
      setShowAddModal(false);
      await loadVinylData();
      showNotification('Vinyl item added successfully', 'success');
    } catch (error) {
      console.error('Failed to add vinyl item:', error);
      showNotification('Failed to add vinyl item', 'error');
    }
  };

  const handleEditVinyl = async (id: number, updates: VinylFormSubmission) => {
    try {
      // Extract job_ids from updates to handle separately
      const { job_ids, ...vinylUpdates } = updates;
      
      
      // Update vinyl item
      await vinylApi.updateVinylItem(id, vinylUpdates);
      
      // Update job associations if provided (including empty arrays to clear associations)
      if (job_ids !== undefined && Array.isArray(job_ids)) {
        try {
          await vinylApi.updateJobLinks(id, job_ids);
        } catch (jobLinkError) {
          console.warn('Job links update failed, but vinyl status was updated:', jobLinkError);
          // Don't throw here - the main update succeeded
        }
      }
      
      setEditingItem(null);
      await loadVinylData();
      showNotification('Vinyl item updated successfully', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(`Failed to update vinyl item: ${errorMessage}`, 'error');
    }
  };

  const handleAddProduct = async (productData: VinylProductFormSubmission) => {
    try {
      await vinylProductsApi.createVinylProduct(productData);
      setShowAddProductModal(false);
      // Refresh the products tab
      if (refreshProductsRef.current) {
        refreshProductsRef.current();
      }
      await loadBulkAutofillSuggestions(); // Reload suggestions - product catalog changed
      showNotification('Product added successfully', 'success');
    } catch (error) {
      console.error('Failed to add product:', error);
      showNotification('Failed to add product', 'error');
    }
  };

  const handleEditProduct = async (id: number, updates: VinylProductFormSubmission) => {
    try {
      await vinylProductsApi.updateVinylProduct(id, updates);
      setEditingProduct(null);
      // Refresh the products tab
      if (refreshProductsRef.current) {
        refreshProductsRef.current();
      }
      await loadBulkAutofillSuggestions(); // Reload suggestions - product catalog changed
      showNotification('Product updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update product:', error);
      showNotification('Failed to update product', 'error');
    }
  };

  const handleEditItem = (item: VinylItem) => {
    setEditingItem(item);
  };

  const handleEditProductClick = (product: VinylProduct) => {
    setEditingProduct(product);
  };

  const handleChangeStatus = (item: VinylItem) => {
    setChangingStatusItem(item);
  };

  const handleStatusChange = async (statusData: StatusChangePayload) => {
    try {
      if (statusData.disposition === 'used') {
        // Use the specialized endpoint that handles job associations
        await vinylApi.markVinylAsUsed(statusData.vinyl_id, {
          usage_note: statusData.notes,
          job_ids: statusData.job_ids
        });
      } else {
        // Use general update for other status changes
        await vinylApi.updateVinylItem(statusData.vinyl_id, {
          disposition: statusData.disposition,
          status_change_date: statusData.status_change_date,
          notes: statusData.notes
        });
      }
      setChangingStatusItem(null);
      await loadVinylData();
      showNotification('Item status updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update item status:', error);
      showNotification('Failed to update item status', 'error');
    }
  };

  // Data loading function for BulkEntriesTab
  const loadData = async () => {
    await loadVinylData();
  };

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
              <h1 className="text-3xl font-bold text-gray-900">Vinyl Management</h1>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('bulk')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bulk'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Bulk Entries
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inventory'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Inventory ({vinylItems.filter(item => item.disposition === 'in_stock').length})
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
            </nav>
          </div>
        </div>
      </div>

      {/* Bulk Entries Tab - Full Width */}
      {activeTab === 'bulk' && (
        <div className="w-full px-4 py-8">
          <BulkEntriesTab
            vinylItems={vinylItems}
            onSuccess={loadData}
            showConfirmation={showConfirmation}
            showNotification={showNotification}
            bulkAutofillSuggestions={bulkAutofillSuggestions}
            bulkLoadingSuggestions={bulkLoadingSuggestions}
          />
        </div>
      )}

      {/* Inventory & Products Tabs - Normal Width */}
      {(activeTab === 'inventory' || activeTab === 'products') && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'inventory' && (
            <InventoryTab
              user={user}
              vinylItems={vinylItems}
              stats={stats}
              loading={loadingVinyl}
              onShowAddModal={() => setShowAddModal(true)}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteVinyl}
              onChangeStatus={handleChangeStatus}
              onDataLoad={loadVinylData}
            />
          )}

          {activeTab === 'products' && (
            <ProductsTab
              user={user}
              onShowAddModal={() => setShowAddProductModal(true)}
              onEditProduct={handleEditProductClick}
              onDeleteProduct={handleDeleteProduct}
              onRefreshReady={(refreshFn) => { refreshProductsRef.current = refreshFn; }}
            />
          )}
        </div>
      )}

      {/* Notification */}
      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal(prev => ({ ...prev, show: false }));
        }}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
      />

      {/* Add Vinyl Modal */}
      {showAddModal && (
        <VinylModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddVinyl}
          title="Add New Vinyl Item"
          autofillSuggestions={bulkAutofillSuggestions}
          products={products}
        />
      )}

      {/* Edit Vinyl Modal */}
      {editingItem && (
        <VinylModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={(data) => handleEditVinyl(editingItem.id, data)}
          title="Edit Vinyl Item"
          initialData={editingItem}
          autofillSuggestions={bulkAutofillSuggestions}
          products={products}
        />
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <ProductModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          onSubmit={handleAddProduct}
          title="Add New Product"
          autofillSuggestions={bulkAutofillSuggestions}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <ProductModal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={(data) => handleEditProduct(editingProduct.product_id, data)}
          title="Edit Product"
          initialData={editingProduct}
          autofillSuggestions={bulkAutofillSuggestions}
        />
      )}

      {/* Status Change Modal */}
      {changingStatusItem && (
        <StatusChangeModal
          isOpen={!!changingStatusItem}
          onClose={() => setChangingStatusItem(null)}
          onSubmit={handleStatusChange}
          item={changingStatusItem}
        />
      )}
    </div>
  );
};

export default VinylInventory;
