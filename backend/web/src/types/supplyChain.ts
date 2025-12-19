/**
 * Supply Chain System TypeScript Types
 * Comprehensive types for supplier products and pricing management
 */

// ============================================================================
// DATABASE ENTITY TYPES (mirrors database schema)
// ============================================================================

/**
 * Supplier Product - Link between Product Archetypes and Suppliers with pricing
 * One archetype can have multiple supplier products (different suppliers/SKUs)
 */
export interface SupplierProduct {
  supplier_product_id: number;
  archetype_id: number;
  supplier_id: number;
  brand_name: string | null;
  sku: string | null;
  product_name: string | null;
  min_order_quantity: number | null;
  lead_time_days: number | null;
  specifications: Record<string, any> | null;
  notes: string | null;
  is_active: boolean;
  is_preferred: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  updated_by: number | null;

  // Joined fields from archetype
  archetype_name?: string;
  archetype_category?: string;
  archetype_unit_of_measure?: string;

  // Joined fields from supplier
  supplier_name?: string;
  supplier_default_lead_days?: number | null;

  // Computed fields
  created_by_name?: string;
  updated_by_name?: string;
  effective_lead_time?: number;
  current_price?: number | null;
  cost_currency?: string;
  price_effective_date?: Date | null;
}

/**
 * Pricing History - Time-series price tracking with effective dates
 * No UPDATE operations - always INSERT for history preservation
 */
export interface PricingHistory {
  pricing_id: number;
  supplier_product_id: number;
  unit_price: number;
  cost_currency: string;
  effective_start_date: Date;
  effective_end_date: Date | null; // NULL = current price
  price_change_percent: number | null;
  notes: string | null;
  created_at: Date;
  created_by: number | null;

  // Joined fields
  created_by_name?: string;
}

/**
 * Price Range - Min/max pricing info for an archetype
 */
export interface PriceRange {
  min_price: number;
  max_price: number;
  supplier_count: number;
  currency: string;
}

// ============================================================================
// REPOSITORY ROW TYPES (what comes from database queries)
// ============================================================================

export interface SupplierProductRow extends SupplierProduct {}

export interface PricingHistoryRow extends PricingHistory {}

export interface PriceRangeRow extends PriceRange {}

// ============================================================================
// REQUEST/INPUT TYPES
// ============================================================================

/**
 * Create new supplier product
 */
export interface CreateSupplierProductRequest {
  archetype_id: number;
  supplier_id: number;
  brand_name?: string;
  sku?: string;
  product_name?: string;
  min_order_quantity?: number;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
  is_preferred?: boolean;
  initial_price?: {
    unit_price: number;
    cost_currency?: string;
    effective_start_date: Date;
    notes?: string;
  };
}

/**
 * Update supplier product
 */
export interface UpdateSupplierProductRequest {
  brand_name?: string;
  sku?: string;
  product_name?: string;
  min_order_quantity?: number;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
  is_preferred?: boolean;
  is_active?: boolean;
}

/**
 * Add price to supplier product
 * Creates new pricing history entry and closes current price
 */
export interface AddPriceRequest {
  unit_price: number;
  cost_currency?: string;
  effective_start_date: Date;
  notes?: string;
}

// ============================================================================
// SEARCH/FILTER TYPES
// ============================================================================

export interface SupplierProductSearchParams {
  archetype_id?: number;
  supplier_id?: number;
  search?: string; // Searches in brand_name, sku, supplier_name
  active_only?: boolean;
  has_price?: boolean;
  limit?: number;
  offset?: number;
}

export interface PricingHistorySearchParams {
  supplier_product_id: number;
  start_date?: Date;
  end_date?: Date;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface SupplierProductResponse {
  success: boolean;
  data: SupplierProduct;
}

export interface SupplierProductListResponse {
  success: boolean;
  data: SupplierProduct[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface PriceRangeResponse {
  success: boolean;
  data: PriceRange;
}

export interface PricingHistoryResponse {
  success: boolean;
  data: PricingHistory[];
}

export interface AddPriceResponse {
  success: boolean;
  data: {
    pricing_id: number;
    alert: boolean; // True if price change > threshold
    price_change_percent?: number;
  };
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export interface BulkCreateSupplierProductsRequest {
  products: CreateSupplierProductRequest[];
}

export interface BatchPriceRangeRequest {
  archetype_ids: number[];
}

export interface BatchPriceRangeResponse {
  success: boolean;
  data: {
    [archetypeId: number]: PriceRange | null;
  };
}

// ============================================================================
// SERVICE LAYER TYPES
// ============================================================================

/**
 * Duplicate detection result
 */
export interface DuplicateCheckResult {
  exists: boolean;
  existingId?: number;
  message?: string;
}

/**
 * Price update transaction result
 */
export interface PriceUpdateResult {
  pricing_id: number;
  alert: boolean;
  price_change_percent?: number;
  message?: string;
}

/**
 * Archetype with price range
 */
export interface ArchetypeWithPriceRange {
  archetype_id: number;
  name: string;
  price_range?: PriceRange | null;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface SupplyChainError {
  code:
    | 'FETCH_ERROR'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'DUPLICATE_ERROR'
    | 'CONSTRAINT_ERROR'
    | 'TRANSACTION_ERROR'
    | 'PRICE_ALERT';
  message: string;
  details?: any;
}

export interface SupplyChainErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

// ============================================================================
// COMBINED RESPONSE TYPES
// ============================================================================

export type SupplyChainResponse<T> =
  | { success: true; data: T }
  | SupplyChainErrorResponse;

// ============================================================================
// FORM DATA TYPES (frontend request objects)
// ============================================================================

/**
 * SupplierProductEditor form data
 */
export interface SupplierProductFormData {
  archetype_id: number;
  supplier_id: number;
  brand_name?: string;
  sku?: string;
  product_name?: string;
  min_order_quantity?: number;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
  is_preferred?: boolean;
  initial_price?: {
    unit_price: number;
    cost_currency?: string;
    effective_start_date: string; // ISO date string
    notes?: string;
  };
}

/**
 * PriceHistoryModal form data
 */
export interface PriceFormData {
  unit_price: number;
  cost_currency?: string;
  effective_start_date: string; // ISO date string
  notes?: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface PricingSystemConfig {
  supplier_cost_alert_threshold: number; // Percent (e.g., 5.0 for 5%)
}

// ============================================================================
// INTERNAL TYPES (repository-specific)
// ============================================================================

/**
 * Raw data type from database (without computed fields)
 */
export type SupplierProductData = Omit<
  SupplierProduct,
  | 'archetype_name'
  | 'archetype_category'
  | 'archetype_unit_of_measure'
  | 'supplier_name'
  | 'supplier_default_lead_days'
  | 'created_by_name'
  | 'updated_by_name'
  | 'effective_lead_time'
  | 'current_price'
  | 'cost_currency'
  | 'price_effective_date'
>;

export type PricingHistoryData = Omit<PricingHistory, 'created_by_name'>;
