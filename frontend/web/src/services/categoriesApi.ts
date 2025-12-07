// File Clean up Finished: 2025-11-25
// Note: Future feature scaffolding - backend routes not yet implemented (part of Supply Chain feature)
import api from './api';

// Types
export interface CategoryField {
  id?: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'decimal' | 'select' | 'boolean' | 'date';
  field_options?: string[];
  is_required: boolean;
  sort_order: number;
  validation_rules?: Record<string, any>;
}

export interface MaterialCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
  product_count?: number;
  fields?: CategoryField[];
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
  minimum_order_qty: number;
  reorder_point?: number;
  reorder_quantity?: number;
  specifications: Record<string, any>;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_icon?: string;
  supplier_name?: string;
  supplier_email?: string;
  lead_time_days?: number;
  created_by_name?: string;
  updated_by_name?: string;
  inventory?: {
    total_quantity: number;
    total_reserved: number;
    available_quantity: number;
    inventory_items: number;
    earliest_expiration?: string;
  };
  stock_status?: 'critical' | 'low' | 'ok';
}

// Categories API
export const getCategoriesApi = async (params: {
  active_only?: boolean;
  include_fields?: boolean;
} = {}) => {
  const response = await api.get('/categories', {
    params: {
      active_only: params.active_only !== false,
      include_fields: params.include_fields || false,
    },
  });
  return response.data as MaterialCategory[];
};

export const getCategoryApi = async (id: number) => {
  const response = await api.get(`/categories/${id}`);
  return response.data as MaterialCategory;
};

export const createCategoryApi = async (category: {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  fields?: Omit<CategoryField, 'id'>[];
}) => {
  const response = await api.post('/categories', category);
  return response.data;
};

export const updateCategoryApi = async (
  id: number,
  updates: Partial<MaterialCategory> & { fields?: CategoryField[] }
) => {
  const response = await api.put(`/categories/${id}`, updates);
  return response.data;
};

export const deleteCategoryApi = async (id: number) => {
  const response = await api.delete(`/categories/${id}`);
  return response.data;
};

export const reorderCategoriesApi = async (categoryOrders: { id: number; sort_order: number }[]) => {
  const response = await api.put('/categories/reorder', {
    category_orders: categoryOrders,
  });
  return response.data;
};

export const getCategoryStatsApi = async () => {
  const response = await api.get('/categories/stats/summary');
  return response.data;
};

// Product Standards API
export const getProductStandardsApi = async (params: {
  category_id?: number;
  supplier_id?: number;
  active_only?: boolean;
  include_inventory?: boolean;
  search?: string;
} = {}) => {
  const response = await api.get('/product-standards', {
    params: {
      category_id: params.category_id,
      supplier_id: params.supplier_id,
      active_only: params.active_only !== false,
      include_inventory: params.include_inventory || false,
      search: params.search,
    },
  });
  return response.data as ProductStandard[];
};

export const getProductStandardApi = async (id: number) => {
  const response = await api.get(`/product-standards/${id}`);
  return response.data as ProductStandard;
};

export const createProductStandardApi = async (product: {
  category_id: number;
  name: string;
  description?: string;
  supplier_id?: number;
  supplier_part_number?: string;
  current_price?: number;
  minimum_order_qty?: number;
  reorder_point?: number;
  reorder_quantity?: number;
  specifications: Record<string, any>;
  notes?: string;
}) => {
  const response = await api.post('/product-standards', product);
  return response.data;
};

export const updateProductStandardApi = async (
  id: number,
  updates: Partial<Omit<ProductStandard, 'id' | 'created_at' | 'updated_at'>>
) => {
  const response = await api.put(`/product-standards/${id}`, updates);
  return response.data;
};

export const deleteProductStandardApi = async (id: number) => {
  const response = await api.delete(`/product-standards/${id}`);
  return response.data;
};

export const getLowStockItemsApi = async (params: {
  status_filter?: 'all' | 'critical' | 'low';
  category_id?: number;
  supplier_id?: number;
} = {}) => {
  const response = await api.get('/product-standards/low-stock/items', {
    params: {
      status_filter: params.status_filter || 'all',
      category_id: params.category_id,
      supplier_id: params.supplier_id,
    },
  });
  return response.data;
};