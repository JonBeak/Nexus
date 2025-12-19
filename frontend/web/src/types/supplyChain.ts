/**
 * Supply Chain System Frontend Types
 * Client-side types for supplier products and pricing management
 */

// ============================================================================
// ENTITY TYPES (from API responses)
// ============================================================================

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
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  created_by: number | null;
  updated_by: number | null;

  // Joined fields
  archetype_name?: string;
  archetype_category?: string;
  archetype_unit_of_measure?: string;
  supplier_name?: string;
  supplier_default_lead_days?: number | null;
  created_by_name?: string;
  updated_by_name?: string;

  // Computed fields
  effective_lead_time?: number;
  current_price?: number | null;
  cost_currency?: string;
  price_effective_date?: string | null;
}

export interface PricingHistory {
  pricing_id: number;
  supplier_product_id: number;
  unit_price: number;
  cost_currency: string;
  effective_start_date: string; // ISO date string
  effective_end_date: string | null; // ISO date string or null for current
  price_change_percent: number | null;
  notes: string | null;
  created_at: string; // ISO date string
  created_by: number | null;
  created_by_name?: string;
}

export interface PriceRange {
  min_price: number;
  max_price: number;
  supplier_count: number;
  currency: string;
}

// ============================================================================
// SUPPLIER TYPE (from API, used in dropdowns)
// ============================================================================

export interface Supplier {
  supplier_id: number;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
  default_lead_days?: number;
  is_active: boolean;
}

// ============================================================================
// ARCHETYPE TYPE (from API, used in context)
// ============================================================================

export interface ProductArchetype {
  archetype_id: number;
  name: string;
  category?: string;
  unit_of_measure?: string;
  reorder_point?: number;
  notes?: string;
  specifications?: Record<string, any>;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;

  // Computed by frontend
  price_range?: PriceRange | null;
}

// ============================================================================
// REQUEST/FORM TYPES
// ============================================================================

export interface CreateSupplierProductRequest {
  archetype_id: number;
  supplier_id: number;
  brand_name?: string;
  sku?: string;
  min_order_quantity?: number;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
  is_preferred?: boolean;
  initial_price?: {
    unit_price: number;
    cost_currency?: string;
    effective_start_date: string; // ISO date
    notes?: string;
  };
}

export interface UpdateSupplierProductRequest {
  brand_name?: string;
  sku?: string;
  min_order_quantity?: number;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
  is_preferred?: boolean;
  is_active?: boolean;
}

export interface AddPriceRequest {
  unit_price: number;
  cost_currency?: string;
  effective_start_date: string; // ISO date
  notes?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AddPriceResponse {
  success: boolean;
  data?: {
    pricing_id: number;
    alert: boolean;
    price_change_percent?: number;
  };
  error?: string;
}

export interface BatchPriceRangeResponse {
  success: boolean;
  data?: {
    [archetypeId: number]: PriceRange | null;
  };
  error?: string;
}

// ============================================================================
// COMPONENT STATE TYPES
// ============================================================================

/**
 * ArchetypeSupplierProducts component state
 */
export interface SupplierProductsState {
  products: SupplierProduct[];
  loading: boolean;
  error: string | null;
  selectedProduct: SupplierProduct | null;
  showEditor: boolean;
  showPriceHistory: boolean;
}

/**
 * SupplierProductEditor component props
 */
export interface SupplierProductEditorProps {
  archetypeId: number;
  product?: SupplierProduct | null;
  suppliers: Supplier[];
  onSave: (data: CreateSupplierProductRequest | UpdateSupplierProductRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * PriceHistoryModal component props
 */
export interface PriceHistoryModalProps {
  product: SupplierProduct;
  onClose: () => void;
  onAddPrice: (data: AddPriceRequest) => Promise<void>;
  loading?: boolean;
}

/**
 * ArchetypeSupplierProducts component props
 */
export interface ArchetypeSupplierProductsProps {
  archetypeId: number;
  onUpdate?: () => void;
  suppliers: Supplier[];
}

// ============================================================================
// FORM DATA TYPES
// ============================================================================

export interface SupplierProductFormData {
  archetype_id: number;
  supplier_id: number;
  brand_name: string;
  sku: string;
  min_order_quantity: string;
  lead_time_days: string;
  specifications: Record<string, any>;
  notes: string;
  is_preferred: boolean;
  initial_price: {
    unit_price: string;
    cost_currency: string;
    effective_start_date: string;
    notes: string;
  };
}

export interface PriceFormData {
  unit_price: string;
  cost_currency: string;
  effective_start_date: string;
  notes: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface EditingState {
  isEditing: boolean;
  product: SupplierProduct | null;
  field?: string;
}

export interface LoadingState {
  products: boolean;
  prices: boolean;
  saving: boolean;
  deleting: boolean;
}

export interface ErrorState {
  product?: string;
  price?: string;
  general?: string;
}

// ============================================================================
// DISPLAY TYPES (formatted for UI)
// ============================================================================

/**
 * Supplier product row for table display
 */
export interface SupplierProductRow {
  supplier_product_id: number;
  supplier_name: string;
  brand_name: string;
  sku: string;
  current_price: number | null;
  cost_currency: string;
  effective_lead_time: number | null;
  min_order_quantity: number | null;
  is_preferred: boolean;
  is_active: boolean;
}

/**
 * Price history row for table display
 */
export interface PriceHistoryRow {
  pricing_id: number;
  unit_price: number;
  cost_currency: string;
  effective_start_date: string;
  effective_end_date: string | null;
  price_change_percent: number | null;
  notes: string | null;
  created_by_name: string | null;
  is_current: boolean;
}

/**
 * Archetype card with price range
 */
export interface ArchetypeCardDisplay {
  archetype_id: number;
  name: string;
  category: string;
  price_range?: {
    min: number;
    max: number;
    currency: string;
    supplier_count: number;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidation {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// SORT/FILTER TYPES
// ============================================================================

export interface SupplierProductSort {
  field: 'supplier_name' | 'sku' | 'current_price' | 'lead_time' | 'created_at';
  direction: 'asc' | 'desc';
}

export interface SupplierProductFilter {
  supplier_id?: number;
  has_price?: boolean;
  is_preferred?: boolean;
  search?: string;
}

// ============================================================================
// BULK OPERATION TYPES
// ============================================================================

export interface BulkUploadRow {
  archetype_id: number;
  supplier_id: number;
  brand_name?: string;
  sku?: string;
  min_order_quantity?: number;
  lead_time_days?: number;
  unit_price?: number;
  cost_currency?: string;
  notes?: string;
  errors?: string[];
}

export interface BulkUploadResult {
  successful: number;
  failed: number;
  rows: BulkUploadRow[];
}
