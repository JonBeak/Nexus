// File Clean up Finished: 2025-11-15
// Changes:
// - Removed unused User import (was never used in file)
// - Added 'damaged' to all disposition type unions (matches DB schema)
// - Added status_change_date field to VinylItem (exists in DB, used in code)
// - Removed ProductSupplier.id field (doesn't exist in DB - composite PK only)
// - Added missing Supplier fields (website, notes, supplier_type, created_by, updated_by)
// - Refactored VinylInventoryData and VinylProductData to use Omit<> utility types (DRY principle)
// - Reduced from 347 → 295 lines (15% reduction, ~50 lines saved via type refactoring)
// File Clean up Finished: 2025-11-15 (Second pass - repository refactoring)
// - Confirmed status_change_date properly defined in VinylItem and UpdateVinylItemRequest
// - Confirmed return_reference not in types (never was - only exists in DB, to be removed via migration)
// - All types properly aligned with refactored repository structure

/**
 * Vinyl System TypeScript Types
 * Comprehensive types for vinyl inventory management
 */

// Base entity types
export interface VinylItem {
  id: number;
  brand: string;
  series: string;
  colour_number?: string;
  colour_name?: string;
  width: number;
  length_yards: number;
  location?: string;
  supplier_id?: number;
  purchase_date?: Date | null;
  storage_date?: Date | null;
  usage_date?: Date | null;
  expiration_date?: Date | null;
  return_date?: Date | null;
  status_change_date?: Date | null;
  disposition: 'in_stock' | 'used' | 'waste' | 'returned' | 'damaged';
  waste_reason?: string;
  storage_user?: number;
  usage_user?: number;
  created_by?: number;
  updated_by?: number;
  label_id?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;

  // Computed/joined fields
  storage_user_name?: string;
  usage_user_name?: string;
  supplier?: Supplier | null;
  supplier_name?: string | null;
  order_associations?: OrderLink[];
  display_colour?: string;
  current_stock?: number;
  minimum_stock?: number;
  unit?: string;
  last_updated?: Date;
}

export interface VinylProduct {
  product_id: number;
  brand: string;
  series: string;
  colour_number?: string;
  colour_name?: string;
  default_width?: number;
  is_active: boolean;
  created_by?: number;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;

  // Computed fields
  display_colour?: string;
  inventory_count?: number;
  total_yards?: number;
  suppliers?: ProductSupplier[];
}

export interface OrderLink {
  link_id: number;
  vinyl_id: number;
  order_id: number;
  sequence_order?: number;

  // Joined fields
  order_number?: number;
  order_name?: string;
  customer_name?: string;
}

export interface ProductSupplier {
  product_id: number;
  supplier_id: number;
  is_primary: boolean;

  // Joined fields
  supplier_name?: string;
}

export interface Supplier {
  supplier_id: number;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
  supplier_type?: 'general' | 'vinyl' | 'both';
  created_at: Date;
  updated_at: Date;
  created_by?: number;
  updated_by?: number;
}

// Request/Input types
export interface CreateVinylItemRequest {
  brand: string;
  series: string;
  colour_number?: string;
  colour_name?: string;
  width: number;
  length_yards: number;
  location?: string;
  supplier_id?: number;
  purchase_date?: string | Date;
  storage_date?: string | Date;
  expiration_date?: string | Date;
  storage_user?: number;
  notes?: string;
  order_ids?: number[];
}

export interface UpdateVinylItemRequest {
  brand?: string;
  series?: string;
  colour_number?: string;
  colour_name?: string;
  width?: number;
  length_yards?: number;
  location?: string;
  supplier_id?: number;
  purchase_date?: string | Date;
  storage_date?: string | Date;
  usage_date?: string | Date;
  expiration_date?: string | Date;
  return_date?: string | Date;
  disposition?: 'in_stock' | 'used' | 'waste' | 'returned' | 'damaged';
  waste_reason?: string;
  storage_user?: number;
  usage_user?: number;
  notes?: string;
  status_change_date?: string | Date;
}

export interface MarkVinylAsUsedRequest {
  usage_note?: string;
  order_ids?: number[];
}

export interface CreateVinylProductRequest {
  brand: string;
  series: string;
  colour_number?: string;
  colour_name?: string;
  default_width?: number;
  supplier_ids?: number[];
}

export interface UpdateVinylProductRequest {
  brand?: string;
  series?: string;
  colour_number?: string;
  colour_name?: string;
  default_width?: number;
  is_active?: boolean;
  supplier_ids?: number[];
}

// Filter types
export interface VinylInventoryFilters {
  disposition?: 'in_stock' | 'used' | 'waste' | 'returned' | 'damaged';
  search?: string;
  brand?: string;
  series?: string;
  location?: string;
  supplier_id?: number;
  date_from?: string | Date;
  date_to?: string | Date;
  limit?: number;
  offset?: number;
}

export interface VinylProductsFilters {
  search?: string;
  brand?: string;
  series?: string;
  is_active?: boolean;
  has_inventory?: boolean;
  limit?: number;
  offset?: number;
}

// Response types
export interface VinylInventoryResponse {
  success: boolean;
  data: VinylItem[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface VinylProductsResponse {
  success: boolean;
  data: VinylProduct[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface VinylStatsResponse {
  success: boolean;
  data: {
    total_items: number;
    in_stock_items: number;
    used_items: number;
    waste_items: number;
    returned_items: number;
    total_yards: number;
    in_stock_yards: number;
    brands_count: number;
    series_count: number;
    locations_count: number;
  };
}

export interface VinylProductStatsResponse {
  success: boolean;
  data: {
    total_products: number;
    active_products: number;
    inactive_products: number;
    brands_count: number;
    series_count: number;
  };
}

export interface AutofillSuggestionsResponse {
  success: boolean;
  data: {
    brands: string[];
    series: { [brand: string]: string[] };
    colours: { [brand: string]: { [series: string]: { colour_number?: string; colour_name?: string }[] } };
    widths: { [brand: string]: { [series: string]: number[] } };
    suppliers: Supplier[];
  };
}

// Bulk operations
export interface BulkCreateVinylRequest {
  items: CreateVinylItemRequest[];
}

export interface BulkUpdateVinylRequest {
  updates: { id: number; data: UpdateVinylItemRequest }[];
}

// Order association types
export interface UpdateOrderLinksRequest {
  order_ids: number[];
}

export interface OrderLinksResponse {
  success: boolean;
  data: OrderLink[];
}

// Status change types
export interface StatusChangeRequest {
  vinyl_id: number;
  disposition: 'in_stock' | 'used' | 'waste' | 'returned' | 'damaged';
  status_change_date?: string | Date;
  notes?: string;
  order_ids?: number[];
  waste_reason?: string;
}

// Repository data types (for internal use)
// Omit computed/joined fields that are not in the database
export type VinylInventoryData = Omit<VinylItem,
  'storage_user_name' | 'usage_user_name' | 'supplier' | 'supplier_name' |
  'order_associations' | 'display_colour' | 'current_stock' | 'minimum_stock' |
  'unit' | 'last_updated' | 'id' | 'created_at' | 'updated_at'
>;

export type VinylProductData = Omit<VinylProduct,
  'product_id' | 'display_colour' | 'inventory_count' | 'total_yards' |
  'suppliers' | 'created_at' | 'updated_at'
>;

// Error types
export interface VinylError {
  code: string;
  message: string;
  details?: any;
}

export interface VinylErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

// Combined response types
export type VinylResponse<T> =
  | { success: true; data: T }
  | VinylErrorResponse;

// Service layer types
export interface VinylInventoryServiceOptions {
  includeOrderLinks?: boolean;
  includeSupplier?: boolean;
  validatePermissions?: boolean;
}

export interface VinylProductServiceOptions {
  includeInventoryStats?: boolean;
  includeSuppliers?: boolean;
  validatePermissions?: boolean;
}
