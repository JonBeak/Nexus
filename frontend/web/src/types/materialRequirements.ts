/**
 * Material Requirements System TypeScript Types (Frontend)
 * Types for material requirements tracking UI components
 * Created: 2025-01-27
 */

// ============================================================================
// STATUS AND ENUM TYPES
// ============================================================================

export type MaterialRequirementStatus =
  | 'pending'
  | 'ordered'
  | 'backordered'
  | 'partial_received'
  | 'received'
  | 'cancelled';

export type DeliveryMethod = 'pickup' | 'shipping';

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

/**
 * Material Requirement - Full entity with joined data
 */
export interface MaterialRequirement {
  requirement_id: number;

  // Order or Stock reference
  order_id: number | null;
  is_stock_item: boolean;

  // Product identification
  archetype_id: number | null;
  custom_product_type: string | null;
  supplier_product_id: number | null;

  // Size and quantity
  size_description: string | null;
  quantity_ordered: number;
  quantity_received: number;

  // Vendor
  supplier_id: number | null;

  // Dates
  entry_date: string;
  ordered_date: string | null;
  expected_delivery_date: string | null;
  received_date: string | null;

  // Delivery & Status
  delivery_method: DeliveryMethod;
  status: MaterialRequirementStatus;

  // Notes & Integration
  notes: string | null;
  cart_id: string | null;
  purchase_order_id: number | null;

  // Audit
  created_at: string;
  created_by: number | null;
  updated_at: string | null;
  updated_by: number | null;

  // Joined fields from order
  order_number?: string | null;
  order_name?: string | null;
  customer_name?: string | null;

  // Joined fields from archetype
  archetype_name?: string | null;
  archetype_category?: string | null;
  unit_of_measure?: string | null;

  // Joined fields from supplier_product
  supplier_product_name?: string | null;
  supplier_product_sku?: string | null;

  // Joined fields from supplier
  supplier_name?: string | null;

  // Computed fields
  quantity_remaining?: number;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

/**
 * Actionable requirement with priority info
 */
export interface ActionableMaterialRequirement extends MaterialRequirement {
  days_pending?: number;
  priority_score?: number;
}

// ============================================================================
// REQUEST/INPUT TYPES
// ============================================================================

export interface CreateMaterialRequirementRequest {
  order_id?: number | null;
  is_stock_item?: boolean;
  archetype_id?: number | null;
  custom_product_type?: string | null;
  supplier_product_id?: number | null;
  size_description?: string | null;
  quantity_ordered: number;
  supplier_id?: number | null;
  entry_date?: string;
  expected_delivery_date?: string | null;
  delivery_method?: DeliveryMethod;
  notes?: string | null;
}

export interface UpdateMaterialRequirementRequest {
  order_id?: number | null;
  is_stock_item?: boolean;
  archetype_id?: number | null;
  custom_product_type?: string | null;
  supplier_product_id?: number | null;
  size_description?: string | null;
  quantity_ordered?: number;
  supplier_id?: number | null;
  entry_date?: string;
  ordered_date?: string | null;
  expected_delivery_date?: string | null;
  received_date?: string | null;
  delivery_method?: DeliveryMethod;
  status?: MaterialRequirementStatus;
  notes?: string | null;
  cart_id?: string | null;
}

export interface ReceiveQuantityRequest {
  quantity: number;
  received_date?: string;
  notes?: string;
}

export interface BulkReceiveItem {
  requirement_id: number;
  quantity: number;
}

export interface BulkReceiveRequest {
  items: BulkReceiveItem[];
  received_date?: string;
}

export interface AddToCartRequest {
  requirement_ids: number[];
  cart_id: string;
}

// ============================================================================
// SEARCH/FILTER TYPES
// ============================================================================

export interface MaterialRequirementSearchParams {
  order_id?: number;
  supplier_id?: number;
  archetype_id?: number;
  status?: MaterialRequirementStatus | MaterialRequirementStatus[];
  is_stock_item?: boolean;
  entry_date_from?: string;
  entry_date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ReceiveQuantityResponse {
  requirement_id: number;
  new_quantity_received: number;
  status: MaterialRequirementStatus;
  fully_received: boolean;
}

export interface BulkReceiveResponse {
  updated_count: number;
  items: Array<{
    requirement_id: number;
    new_quantity_received: number;
    status: MaterialRequirementStatus;
  }>;
}

export interface ActionableRequirementsResponse {
  pending: ActionableMaterialRequirement[];
  backordered: ActionableMaterialRequirement[];
  total_pending: number;
  total_backordered: number;
}

export interface StatusCountsResponse {
  pending: number;
  ordered: number;
  backordered: number;
  partial_received: number;
  received: number;
  cancelled: number;
}

// ============================================================================
// DROPDOWN/REFERENCE DATA TYPES
// ============================================================================

export interface OrderDropdownOption {
  order_id: number;
  order_number: string;
  order_name: string;
  customer_name: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface MaterialRequirementFilters {
  status: MaterialRequirementStatus | 'all';
  isStockItem: boolean | 'all';
  supplierId: number | null;
  search: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

export type SortField =
  | 'entry_date'
  | 'order_number'
  | 'archetype_name'
  | 'supplier_name'
  | 'quantity_ordered'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}
