/**
 * Supplier Orders System TypeScript Types (Frontend)
 * Types for supplier order management UI components
 * Created: 2026-02-02
 */

// ============================================================================
// STATUS AND ENUM TYPES
// ============================================================================

export type SupplierOrderStatus =
  | 'submitted'
  | 'acknowledged'
  | 'partial_received'
  | 'delivered'
  | 'cancelled';

export type DeliveryMethod = 'pickup' | 'shipping';

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

/**
 * Supplier Order - Full entity with joined data
 */
export interface SupplierOrder {
  order_id: number;
  order_number: string;
  supplier_id: number;

  // Status
  status: SupplierOrderStatus;

  // Dates
  order_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;

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
  created_at: string;
  created_by: number | null;
  updated_at: string | null;
  updated_by: number | null;
  submitted_by: number | null;
  submitted_at: string | null;

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
  received_date: string | null;
  received_by: number | null;

  // Audit
  created_at: string;
  updated_at: string | null;

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
  changed_at: string;
  notes: string | null;
  changed_by_name?: string | null;
}

// ============================================================================
// REQUEST/INPUT TYPES
// ============================================================================

export interface CreateSupplierOrderRequest {
  supplier_id: number;
  expected_delivery_date?: string | null;
  delivery_method?: DeliveryMethod;
  shipping_address?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  items?: CreateSupplierOrderItemRequest[];
}

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

export interface UpdateSupplierOrderRequest {
  supplier_id?: number;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  delivery_method?: DeliveryMethod;
  shipping_address?: string | null;
  supplier_reference?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  tax_amount?: number;
  shipping_cost?: number;
}

export interface UpdateSupplierOrderItemRequest {
  supplier_product_id?: number | null;
  product_description?: string;
  sku?: string | null;
  quantity_ordered?: number;
  unit_of_measure?: string;
  unit_price?: number;
  notes?: string | null;
}

export interface GenerateOrderRequest {
  supplier_id: number;
  requirement_ids: number[];
  expected_delivery_date?: string | null;
  delivery_method?: DeliveryMethod;
  notes?: string | null;
}

export interface ReceiveItemsRequest {
  items: ReceiveItemRequest[];
  received_date?: string;
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
  order_date_from?: string;
  order_date_to?: string;
  expected_delivery_from?: string;
  expected_delivery_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface GenerateOrderResponse {
  order_id: number;
  order_number: string;
  items_created: number;
  requirements_linked: number;
}

export interface ReceiveItemsResponse {
  items_received: number;
  order_status: SupplierOrderStatus;
  fully_delivered: boolean;
}

export interface SupplierOrderStatusCounts {
  submitted: number;
  acknowledged: number;
  partial_received: number;
  delivered: number;
  cancelled: number;
}

// ============================================================================
// GROUPED BY SUPPLIER (for order generation)
// ============================================================================

export interface GroupedRequirement {
  requirement_id: number;
  entry_date: string;
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

export interface SupplierRequirementGroup {
  supplier_id: number;
  supplier_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  item_count: number;
  total_quantity: number;
  requirements: GroupedRequirement[];
}

export interface GroupedBySupplierResponse {
  groups: SupplierRequirementGroup[];
  total_requirements: number;
  total_suppliers: number;
}
