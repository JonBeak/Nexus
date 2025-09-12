import api from './api';

export interface MaterialCategory {
  id: number;
  name: string;
  description?: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'decimal' | 'select' | 'boolean' | 'date' | 'textarea';
  field_options?: string[];
  default_value?: string;
  is_required: boolean;
  validation_rules?: Record<string, any>;
  help_text?: string;
  sort_order: number;
  is_active: boolean;
}

export interface ProductStandard {
  id: number;
  category_id: number;
  name: string;
  description?: string;
  supplier_id?: number;
  supplier_part_number?: string;
  current_price?: number;
  price_date?: string;
  price_currency: string;
  minimum_order_qty: number;
  unit_of_measure: string;
  reorder_point?: number;
  reorder_quantity?: number;
  lead_time_days: number;
  specifications: Record<string, any>;
  notes?: string;
  is_active: boolean;
  category_name?: string;
  supplier_name?: string;
  total_available?: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: number;
  product_standard_id: number;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  location?: string;
  lot_number?: string;
  serial_number?: string;
  received_date?: string;
  expiry_date?: string;
  cost_per_unit?: number;
  supplier_order_id?: number;
  condition_status: 'new' | 'used' | 'damaged' | 'returned';
  notes?: string;
  product_name?: string;
  category_name?: string;
  supplier_name?: string;
  unit_of_measure?: string;
  reorder_point?: number;
  created_at: string;
  updated_at: string;
}

export interface LowStockItem {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  supplier_id?: number;
  supplier_name?: string;
  available_quantity: number;
  reorder_point?: number;
  reorder_quantity?: number;
  current_price?: number;
  unit_of_measure: string;
  stock_status: 'out_of_stock' | 'critical' | 'low' | 'ok' | 'unknown';
  last_updated: string;
}

export interface DashboardStats {
  total_categories: number;
  total_products: number;
  total_inventory_items: number;
  total_available_quantity: number;
  critical_items: number;
  low_items: number;
}

// Material Categories API
export const getCategoriesApi = () => 
  api.get<MaterialCategory[]>('/supply-chain/categories');

export const createCategoryApi = (data: Partial<MaterialCategory>) =>
  api.post<MaterialCategory>('/supply-chain/categories', data);

export const updateCategoryApi = (id: number, data: Partial<MaterialCategory>) =>
  api.put<void>(`/supply-chain/categories/${id}`, data);

export const deleteCategoryApi = (id: number) =>
  api.delete<void>(`/supply-chain/categories/${id}`);

// Category Fields API
export const getCategoryFieldsApi = (categoryId: number) =>
  api.get<CategoryField[]>(`/supply-chain/categories/${categoryId}/fields`);

export const createCategoryFieldApi = (categoryId: number, data: Partial<CategoryField>) =>
  api.post<CategoryField>(`/supply-chain/categories/${categoryId}/fields`, data);

export const updateCategoryFieldApi = (categoryId: number, fieldId: number, data: Partial<CategoryField>) =>
  api.put<void>(`/supply-chain/categories/${categoryId}/fields/${fieldId}`, data);

export const deleteCategoryFieldApi = (categoryId: number, fieldId: number) =>
  api.delete<void>(`/supply-chain/categories/${categoryId}/fields/${fieldId}`);

// Product Standards API
export const getProductStandardsApi = (params?: {
  category_id?: number;
  supplier_id?: number;
  search?: string;
}) => api.get<ProductStandard[]>('/supply-chain/product-standards', { params });

export const getProductStandardByIdApi = (id: number) =>
  api.get<ProductStandard>(`/supply-chain/product-standards/${id}`);

export const createProductStandardApi = (data: Partial<ProductStandard>) =>
  api.post<ProductStandard>('/supply-chain/product-standards', data);

export const updateProductStandardApi = (id: number, data: Partial<ProductStandard>) =>
  api.put<void>(`/supply-chain/product-standards/${id}`, data);

export const deleteProductStandardApi = (id: number) =>
  api.delete<void>(`/supply-chain/product-standards/${id}`);

// Inventory API
export const getInventoryApi = (params?: {
  category_id?: number;
  location?: string;
  low_stock?: boolean;
}) => api.get<InventoryItem[]>('/supply-chain/inventory', { params });

export const getInventoryAvailabilityApi = (productStandardId: number) =>
  api.get<{
    total_quantity: number;
    total_reserved: number;
    total_available: number;
    reorder_point?: number;
    reorder_quantity?: number;
    unit_of_measure: string;
  }>(`/supply-chain/inventory/availability/${productStandardId}`);

export const createInventoryItemApi = (data: Partial<InventoryItem>) =>
  api.post<InventoryItem>('/supply-chain/inventory', data);

export const updateInventoryItemApi = (id: number, data: Partial<InventoryItem>) =>
  api.put<void>(`/supply-chain/inventory/${id}`, data);

export const deleteInventoryItemApi = (id: number) =>
  api.delete<void>(`/supply-chain/inventory/${id}`);

// Low Stock API
export const getLowStockItemsApi = (params?: { category_id?: number }) =>
  api.get<LowStockItem[]>('/supply-chain/low-stock', { params });

export const updateReorderSettingsApi = (id: number, data: {
  reorder_point?: number;
  reorder_quantity?: number;
}) => api.put<void>(`/supply-chain/product-standards/${id}/reorder-settings`, data);

// Dashboard Stats API
export const getDashboardStatsApi = () =>
  api.get<DashboardStats>('/supply-chain/dashboard-stats');