/**
 * Supplier Orders System TypeScript Types
 * Types for supplier order management and tracking
 * Created: 2026-02-02
 */

// ============================================================================
// STATUS AND ENUM TYPES
// ============================================================================

export type SupplierOrderStatus =
  | 'draft'
  | 'submitted'
  | 'acknowledged'
  | 'partial_received'
  | 'delivered'
  | 'cancelled';

export type DeliveryMethod = 'pickup' | 'shipping';

// ============================================================================
// DATABASE ENTITY TYPES
// ============================================================================

/**
 * Supplier Order - Header entity for purchase orders
 */
export interface SupplierOrder {
  order_id: number;
  order_number: string;
  supplier_id: number;

  // Status
  status: SupplierOrderStatus;

  // Dates
  order_date: Date | string | null;
  expected_delivery_date: Date | string | null;
  actual_delivery_date: Date | string | null;

  // Totals
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_amount: number;

  // Delivery
  delivery_method: DeliveryMethod;
  shipping_address: string | null;

  // Reference and notes
  supplier_reference: string | null;
  notes: string | null;
  internal_notes: string | null;

  // Audit
  created_at: Date | string;
  created_by: number | null;
  updated_at: Date | string | null;
  updated_by: number | null;
  submitted_by: number | null;
  submitted_at: Date | string | null;

  // Joined fields
  supplier_name?: string;
  supplier_contact_email?: string;
  supplier_phone?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  submitted_by_name?: string | null;

  // Computed fields
  item_count?: number;
  items_received_count?: number;
}

/**
 * Supplier Order Item - Line items for each order
 */
export interface SupplierOrderItem {
  item_id: number;
  order_id: number;

  // Product identification
  supplier_product_id: number | null;
  product_description: string;
  sku: string | null;

  // Quantities
  quantity_ordered: number;
  quantity_received: number;
  unit_of_measure: string;

  // Pricing
  unit_price: number;
  line_total: number;

  // Link to material requirement
  material_requirement_id: number | null;

  // Notes
  notes: string | null;

  // Receiving tracking
  received_date: Date | string | null;
  received_by: number | null;

  // Audit
  created_at: Date | string;
  updated_at: Date | string | null;

  // Joined fields
  received_by_name?: string | null;
  material_requirement_order_number?: string | null;
}

/**
 * Supplier Order with Items - Full order with line items
 */
export interface SupplierOrderWithItems extends SupplierOrder {
  items: SupplierOrderItem[];
}

/**
 * Status History Entry
 */
export interface SupplierOrderStatusHistory {
  history_id: number;
  order_id: number;
  old_status: SupplierOrderStatus | null;
  new_status: SupplierOrderStatus;
  changed_by: number | null;
  changed_at: Date | string;
  notes: string | null;
  changed_by_name?: string | null;
}

// ============================================================================
// REQUEST/INPUT TYPES
// ============================================================================

/**
 * Create new supplier order
 */
export interface CreateSupplierOrderRequest {
  supplier_id: number;
  expected_delivery_date?: Date | string | null;
  delivery_method?: DeliveryMethod;
  shipping_address?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  items?: CreateSupplierOrderItemRequest[];
}

/**
 * Create order item
 */
export interface CreateSupplierOrderItemRequest {
  supplier_product_id?: number | null;
  product_description: string;
  sku?: string | null;
  quantity_ordered: number;
  unit_of_measure?: string;
  unit_price?: number;
  material_requirement_id?: number | null;
  notes?: string | null;
}

/**
 * Update supplier order
 */
export interface UpdateSupplierOrderRequest {
  supplier_id?: number;
  expected_delivery_date?: Date | string | null;
  actual_delivery_date?: Date | string | null;
  delivery_method?: DeliveryMethod;
  shipping_address?: string | null;
  supplier_reference?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  tax_amount?: number;
  shipping_cost?: number;
}

/**
 * Update order item
 */
export interface UpdateSupplierOrderItemRequest {
  supplier_product_id?: number | null;
  product_description?: string;
  sku?: string | null;
  quantity_ordered?: number;
  unit_of_measure?: string;
  unit_price?: number;
  notes?: string | null;
}

/**
 * Generate order from material requirements
 */
export interface GenerateOrderRequest {
  supplier_id: number;
  requirement_ids: number[];
  expected_delivery_date?: Date | string | null;
  delivery_method?: DeliveryMethod;
  notes?: string | null;
}

/**
 * Submit order to supplier
 */
export interface SubmitOrderRequest {
  order_date?: Date | string;
  notes?: string | null;
}

/**
 * Receive items on an order
 */
export interface ReceiveItemsRequest {
  items: ReceiveItemRequest[];
  received_date?: Date | string;
  notes?: string | null;
}

export interface ReceiveItemRequest {
  item_id: number;
  quantity_received: number;
}

// ============================================================================
// SEARCH/FILTER TYPES
// ============================================================================

export interface SupplierOrderSearchParams {
  supplier_id?: number;
  status?: SupplierOrderStatus | SupplierOrderStatus[];
  order_date_from?: Date | string;
  order_date_to?: Date | string;
  expected_delivery_from?: Date | string;
  expected_delivery_to?: Date | string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface SupplierOrderResponse {
  success: boolean;
  data: SupplierOrderWithItems;
}

export interface SupplierOrderListResponse {
  success: boolean;
  data: SupplierOrder[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface GenerateOrderResponse {
  success: boolean;
  data: {
    order_id: number;
    order_number: string;
    items_created: number;
    requirements_linked: number;
  };
}

export interface ReceiveItemsResponse {
  success: boolean;
  data: {
    items_received: number;
    order_status: SupplierOrderStatus;
    fully_delivered: boolean;
  };
}

// ============================================================================
// GROUPED BY SUPPLIER (for order generation)
// ============================================================================

export interface SupplierRequirementGroup {
  supplier_id: number;
  supplier_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  item_count: number;
  total_quantity: number;
  requirements: GroupedRequirement[];
}

export interface GroupedRequirement {
  requirement_id: number;
  entry_date: Date | string;
  custom_product_type: string | null;
  archetype_name: string | null;
  size_description: string | null;
  quantity_ordered: number;
  unit_of_measure: string | null;
  order_number: string | null;
  order_name: string | null;
  is_stock_item: boolean;
  notes: string | null;
}

export interface GroupedBySupplierResponse {
  success: boolean;
  data: SupplierRequirementGroup[];
  total_requirements: number;
  total_suppliers: number;
}
