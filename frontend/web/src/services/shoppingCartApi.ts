// File Clean up Finished: 2025-11-25
// Note: Future feature scaffolding - backend routes not yet implemented (part of Supply Chain feature)
import api from './api';

export interface CartItem {
  id: string;
  product_standard_id?: number;
  name: string;
  category: string;
  supplier_id?: number;
  supplier_name: string;
  quantity: number;
  unit: string;
  estimated_price?: number;
  total_estimated_cost?: number;
  job_id?: number;
  job_number?: string;
  material_specification?: string;
  notes?: string;
  created_at: string;
}

export interface SupplierCart {
  supplier_id: number;
  supplier_name: string;
  items: CartItem[];
  total_items: number;
  total_estimated_cost: number;
  contact_email?: string;
  preferred_payment_terms?: string;
  minimum_order_amount?: number;
  estimated_shipping?: number;
}

export interface ShoppingCart {
  id: string;
  user_id: number;
  name: string;
  status: 'draft' | 'sent' | 'approved' | 'ordered' | 'received';
  supplier_carts: SupplierCart[];
  total_suppliers: number;
  total_items: number;
  total_estimated_cost: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Shopping Cart API
export const getShoppingCartsApi = () =>
  api.get<ShoppingCart[]>('/supply-chain/shopping-carts');

export const getShoppingCartByIdApi = (id: string) =>
  api.get<ShoppingCart>(`/supply-chain/shopping-carts/${id}`);

export const createShoppingCartApi = (data: {
  name: string;
  notes?: string;
}) => api.post<ShoppingCart>('/supply-chain/shopping-carts', data);

export const addToCartApi = (cartId: string, items: Partial<CartItem>[]) =>
  api.post<void>(`/supply-chain/shopping-carts/${cartId}/items`, { items });

export const removeFromCartApi = (cartId: string, itemId: string) =>
  api.delete<void>(`/supply-chain/shopping-carts/${cartId}/items/${itemId}`);

export const updateCartItemApi = (cartId: string, itemId: string, updates: Partial<CartItem>) =>
  api.put<void>(`/supply-chain/shopping-carts/${cartId}/items/${itemId}`, updates);

export const deleteShoppingCartApi = (id: string) =>
  api.delete<void>(`/supply-chain/shopping-carts/${id}`);

// Generate Orders
export const generateSupplierOrdersApi = (cartId: string) =>
  api.post<{
    supplier_id: number;
    supplier_name: string;
    order_id: string;
    email_sent: boolean;
  }[]>(`/supply-chain/shopping-carts/${cartId}/generate-orders`);

// Email Templates
export const previewSupplierEmailApi = (cartId: string, supplierId: number) =>
  api.get<{
    subject: string;
    body: string;
    attachments: string[];
  }>(`/supply-chain/shopping-carts/${cartId}/supplier-email-preview/${supplierId}`);

// Quick Add Functions (for components)
export const quickAddJobMaterialsToCartApi = (materials: {
  job_id: number;
  job_number: string;
  materials: Array<{
    name: string;
    category: string;
    quantity: number;
    unit: string;
    supplier_name: string;
    supplier_id?: number;
    estimated_price?: number;
  }>;
}) => api.post<{ cart_id: string; items_added: number }>('/supply-chain/quick-add-job-materials', materials);

export const quickAddLowStockToCartApi = (items: Array<{
  id: number;
  name: string;
  category: string;
  supplier_id: number;
  supplier_name: string;
  reorder_quantity: number;
  unit: string;
  current_price?: number;
}>) => api.post<{ cart_id: string; items_added: number }>('/supply-chain/quick-add-low-stock', { items });