/**
 * Material Requirements System TypeScript Types
 * Comprehensive types for material requirements tracking
 * Created: 2025-01-27
 */

// ============================================================================
// DATABASE ENTITY TYPES (mirrors database schema)
// ============================================================================

export type MaterialRequirementStatus =
  | 'pending'
  | 'ordered'
  | 'backordered'
  | 'partial_received'
  | 'received'
  | 'cancelled';

export type DeliveryMethod = 'pickup' | 'shipping';

/**
 * Material Requirement - Core entity for tracking material needs
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
  vinyl_product_id: number | null;

  // Unit and quantity
  unit: string | null;
  quantity_ordered: number;
  quantity_received: number;

  // Vendor
  supplier_id: number | null;

  // Dates
  entry_date: Date | string;
  ordered_date: Date | string | null;
  expected_delivery_date: Date | string | null;
  received_date: Date | string | null;

  // Delivery & Status
  delivery_method: DeliveryMethod;
  status: MaterialRequirementStatus;

  // Notes & Integration
  notes: string | null;
  cart_id: string | null;
  purchase_order_id: number | null;

  // Audit
  created_at: Date | string;
  created_by: number | null;
  updated_at: Date | string | null;
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

  // Joined fields from vinyl_product (when archetype_id = -1)
  vinyl_product_brand?: string | null;
  vinyl_product_series?: string | null;
  vinyl_product_colour_number?: string | null;
  vinyl_product_colour_name?: string | null;
  vinyl_product_display?: string | null;

  // Joined fields from supplier
  supplier_name?: string | null;

  // Joined fields from held vinyl inventory
  held_vinyl_width?: number | null;
  held_vinyl_length_yards?: number | null;
  held_vinyl_quantity?: string | null;
  held_general_quantity?: string | null;

  // Computed fields
  quantity_remaining?: number;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

// ============================================================================
// REQUEST/INPUT TYPES
// ============================================================================

/**
 * Create new material requirement
 */
export interface CreateMaterialRequirementRequest {
  order_id?: number | null;
  is_stock_item?: boolean;
  archetype_id?: number | null;
  custom_product_type?: string | null;
  supplier_product_id?: number | null;
  vinyl_product_id?: number | null;
  unit?: string | null;
  quantity_ordered: number;
  supplier_id?: number | null;
  entry_date?: Date | string;
  expected_delivery_date?: Date | string | null;
  delivery_method?: DeliveryMethod;
  notes?: string | null;
}

/**
 * Update material requirement
 */
export interface UpdateMaterialRequirementRequest {
  order_id?: number | null;
  is_stock_item?: boolean;
  archetype_id?: number | null;
  custom_product_type?: string | null;
  supplier_product_id?: number | null;
  vinyl_product_id?: number | null;
  unit?: string | null;
  quantity_ordered?: number;
  quantity_received?: number;
  supplier_id?: number | null;
  entry_date?: Date | string;
  ordered_date?: Date | string | null;
  expected_delivery_date?: Date | string | null;
  received_date?: Date | string | null;
  delivery_method?: DeliveryMethod;
  status?: MaterialRequirementStatus;
  notes?: string | null;
  cart_id?: string | null;
}

/**
 * Receive quantity for a requirement (partial receipt support)
 */
export interface ReceiveQuantityRequest {
  quantity: number;
  received_date?: Date | string;
  notes?: string;
}

/**
 * Bulk receive multiple requirements
 */
export interface BulkReceiveRequest {
  items: Array<{
    requirement_id: number;
    quantity: number;
  }>;
  received_date?: Date | string;
}

/**
 * Add requirement to shopping cart
 */
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
  entry_date_from?: Date | string;
  entry_date_to?: Date | string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface MaterialRequirementResponse {
  success: boolean;
  data: MaterialRequirement;
}

export interface MaterialRequirementListResponse {
  success: boolean;
  data: MaterialRequirement[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ReceiveQuantityResponse {
  success: boolean;
  data: {
    requirement_id: number;
    new_quantity_received: number;
    status: MaterialRequirementStatus;
    fully_received: boolean;
  };
}

export interface BulkReceiveResponse {
  success: boolean;
  data: {
    updated_count: number;
    items: Array<{
      requirement_id: number;
      new_quantity_received: number;
      status: MaterialRequirementStatus;
    }>;
  };
}

// ============================================================================
// ACTIONABLE ITEMS (for Overview)
// ============================================================================

/**
 * Actionable requirement - pending or backordered items for Overview
 */
export interface ActionableMaterialRequirement extends MaterialRequirement {
  days_pending?: number;
  priority_score?: number;
}

export interface ActionableRequirementsResponse {
  success: boolean;
  data: {
    pending: ActionableMaterialRequirement[];
    backordered: ActionableMaterialRequirement[];
    total_pending: number;
    total_backordered: number;
  };
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

export interface ArchetypeDropdownOption {
  archetype_id: number;
  name: string;
  category: string;
  unit_of_measure: string;
}

export interface SupplierDropdownOption {
  supplier_id: number;
  name: string;
}

export interface SupplierProductDropdownOption {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name: string;
  archetype_id: number;
}
