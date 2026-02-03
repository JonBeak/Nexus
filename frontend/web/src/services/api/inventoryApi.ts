// Supply Chain: Inventory API
// Purpose: Frontend API client for inventory management
// Created: 2026-02-02

import api from './index';

// ==========================================
// TYPES
// ==========================================

export interface SupplierProductStock {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  brand_name: string | null;
  archetype_id: number;
  archetype_name: string;
  category: string;
  subcategory: string | null;
  unit_of_measure: string;
  supplier_id: number;
  supplier_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  location: string | null;
  unit_cost: number | null;
  last_count_date: string | null;
  reorder_point: number | null;
  min_order_quantity: number | null;
  lead_time_days: number | null;
  is_preferred: boolean;
  is_active: boolean;
  stock_status: 'out_of_stock' | 'critical' | 'low' | 'ok';
}

export interface ArchetypeStockLevel {
  archetype_id: number;
  archetype_name: string;
  category: string;
  subcategory: string | null;
  unit_of_measure: string;
  default_reorder_point: number | null;
  is_active: boolean;
  supplier_product_count: number;
  supplier_count: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  min_unit_cost: number | null;
  max_unit_cost: number | null;
  avg_unit_cost: number | null;
  stock_status: 'out_of_stock' | 'critical' | 'low' | 'ok';
}

export interface LowStockAlert {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  archetype_id: number;
  archetype_name: string;
  category: string;
  supplier_id: number;
  supplier_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number | null;
  min_order_quantity: number | null;
  unit_cost: number | null;
  lead_time_days: number | null;
  alert_level: 'out_of_stock' | 'critical' | 'low';
}

export interface StockSummaryByCategory {
  category: string;
  archetype_count: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  out_of_stock_count: number;
  critical_count: number;
  low_count: number;
}

export interface InventoryTransaction {
  transaction_id: number;
  supplier_product_id: number;
  transaction_type: 'received' | 'used' | 'adjusted' | 'returned' | 'scrapped' | 'transferred';
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reference_type: string | null;
  reference_id: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  location_from: string | null;
  location_to: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  product_name?: string;
  sku?: string;
  archetype_name?: string;
  category?: string;
  supplier_name?: string;
  created_by_name?: string;
}

export interface StockAdjustmentResult {
  transaction_id: number;
  quantity_before: number;
  quantity_after: number;
}

export interface TransactionSummary {
  transaction_type: string;
  transaction_count: number;
  total_quantity: number;
  total_cost: number | null;
}

// ==========================================
// STOCK LEVEL ENDPOINTS
// ==========================================

/**
 * Get supplier product stock levels
 */
export const getStockLevels = async (params?: {
  archetype_id?: number;
  supplier_id?: number;
  category?: string;
  stock_status?: 'out_of_stock' | 'critical' | 'low' | 'ok';
  search?: string;
}): Promise<SupplierProductStock[]> => {
  const response = await api.get('/inventory/stock', { params });
  return response.data?.data || response.data || [];
};

/**
 * Get aggregated archetype stock levels
 */
export const getArchetypeStockLevels = async (params?: {
  category?: string;
  stock_status?: 'out_of_stock' | 'critical' | 'low' | 'ok';
  search?: string;
}): Promise<ArchetypeStockLevel[]> => {
  const response = await api.get('/inventory/stock/archetypes', { params });
  return response.data?.data || response.data || [];
};

/**
 * Get low stock alerts
 */
export const getLowStockAlerts = async (params?: {
  category?: string;
  supplier_id?: number;
  alert_level?: 'out_of_stock' | 'critical' | 'low';
}): Promise<LowStockAlert[]> => {
  const response = await api.get('/inventory/stock/alerts', { params });
  return response.data?.data || response.data || [];
};

/**
 * Get stock summary by category
 */
export const getStockSummaryByCategory = async (): Promise<StockSummaryByCategory[]> => {
  const response = await api.get('/inventory/stock/summary');
  return response.data?.data || response.data || [];
};

// ==========================================
// STOCK ADJUSTMENT ENDPOINTS
// ==========================================

/**
 * Generic stock adjustment
 */
export const adjustStock = async (
  supplierProductId: number,
  data: {
    adjustment: number;
    transaction_type: 'received' | 'used' | 'adjusted' | 'returned' | 'scrapped';
    reference_type?: string;
    reference_id?: number;
    unit_cost?: number;
    notes?: string;
  }
): Promise<StockAdjustmentResult> => {
  const response = await api.post(`/inventory/${supplierProductId}/adjust`, data);
  return response.data?.data || response.data;
};

/**
 * Receive stock from supplier order
 */
export const receiveStock = async (
  supplierProductId: number,
  data: {
    quantity: number;
    unit_cost?: number;
    supplier_order_id?: number;
    notes?: string;
  }
): Promise<StockAdjustmentResult> => {
  const response = await api.post(`/inventory/${supplierProductId}/receive`, data);
  return response.data?.data || response.data;
};

/**
 * Use/consume stock for production
 */
export const useStock = async (
  supplierProductId: number,
  data: {
    quantity: number;
    order_id?: number;
    notes?: string;
  }
): Promise<StockAdjustmentResult> => {
  const response = await api.post(`/inventory/${supplierProductId}/use`, data);
  return response.data?.data || response.data;
};

/**
 * Manual inventory count adjustment
 */
export const makeAdjustment = async (
  supplierProductId: number,
  data: {
    new_quantity: number;
    notes?: string;
  }
): Promise<StockAdjustmentResult> => {
  const response = await api.post(`/inventory/${supplierProductId}/count`, data);
  return response.data?.data || response.data;
};

/**
 * Update stock settings
 */
export const updateStockSettings = async (
  supplierProductId: number,
  data: {
    location?: string;
    reorder_point?: number;
    last_count_date?: string;
  }
): Promise<void> => {
  await api.put(`/inventory/${supplierProductId}/settings`, data);
};

// ==========================================
// RESERVATION ENDPOINTS
// ==========================================

/**
 * Reserve stock for an order
 */
export const reserveStock = async (
  supplierProductId: number,
  quantity: number
): Promise<void> => {
  await api.post(`/inventory/${supplierProductId}/reserve`, { quantity });
};

/**
 * Release reserved stock
 */
export const releaseReservation = async (
  supplierProductId: number,
  quantity: number
): Promise<void> => {
  await api.post(`/inventory/${supplierProductId}/release`, { quantity });
};

// ==========================================
// TRANSACTION HISTORY ENDPOINTS
// ==========================================

/**
 * Get transaction history
 */
export const getTransactions = async (params?: {
  supplier_product_id?: number;
  archetype_id?: number;
  supplier_id?: number;
  transaction_type?: string;
  reference_type?: string;
  reference_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}): Promise<InventoryTransaction[]> => {
  const response = await api.get('/inventory/transactions', { params });
  return response.data?.data || response.data || [];
};

/**
 * Get transactions for a specific supplier product
 */
export const getProductTransactions = async (
  supplierProductId: number,
  limit?: number
): Promise<InventoryTransaction[]> => {
  const response = await api.get(`/inventory/${supplierProductId}/transactions`, {
    params: limit ? { limit } : undefined
  });
  return response.data?.data || response.data || [];
};

/**
 * Get recent activity
 */
export const getRecentActivity = async (limit?: number): Promise<InventoryTransaction[]> => {
  const response = await api.get('/inventory/transactions/recent', {
    params: limit ? { limit } : undefined
  });
  return response.data?.data || response.data || [];
};

/**
 * Get transaction summary
 */
export const getTransactionSummary = async (params?: {
  start_date?: string;
  end_date?: string;
  supplier_id?: number;
  archetype_id?: number;
}): Promise<TransactionSummary[]> => {
  const response = await api.get('/inventory/transactions/summary', { params });
  return response.data?.data || response.data || [];
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default {
  // Stock levels
  getStockLevels,
  getArchetypeStockLevels,
  getLowStockAlerts,
  getStockSummaryByCategory,

  // Stock adjustments
  adjustStock,
  receiveStock,
  useStock,
  makeAdjustment,
  updateStockSettings,

  // Reservations
  reserveStock,
  releaseReservation,

  // Transactions
  getTransactions,
  getProductTransactions,
  getRecentActivity,
  getTransactionSummary
};
