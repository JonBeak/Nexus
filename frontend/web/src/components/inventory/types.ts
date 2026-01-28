import type { UserRole } from '../../types/user';

export type InventoryDisposition = 'in_stock' | 'used' | 'waste' | 'returned' | 'damaged';
export type InventoryFilterType = InventoryDisposition | 'all';
export type ProductFilterType = 'all' | 'active' | 'inactive';

export interface InventoryUser {
  user_id: number;
  role: UserRole;
  first_name: string;
  last_name: string;
}

export interface SupplierDetail {
  supplier_id: number;
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

export interface SupplierSummary {
  supplier_id: number;
  name: string;
}

export interface ProductSupplier {
  product_id: number;
  supplier_id: number;
  supplier_name: string;
  is_primary: boolean;
  created_at: string;
}

export interface VinylProduct {
  product_id: number;
  brand: string;
  series: string;
  colour?: string;
  colour_number?: string;
  colour_name?: string;
  default_width?: number | null;
  default_length_yards?: number | null;
  suppliers?: string | ProductSupplier[]; // Can be string (legacy) or array of ProductSupplier objects
  supplier_ids?: number[];
  supplier_details?: SupplierDetail[];
  available_widths?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface VinylProductStats {
  total_products?: number;
  active_products?: number;
  brand_count?: number;
  supplier_count?: number;
}

export interface VinylItemOrderAssociation {
  order_id: number;
  order_number: number;
  order_name: string;
  customer_name: string;
  sequence_order: number;
}

export interface VinylItem {
  id: number;
  brand: string;
  series: string;
  colour?: string;
  colour_number?: string;
  colour_name?: string;
  display_colour?: string;
  width: number;
  length_yards: number;
  location: string;
  product_name?: string;
  current_stock?: number;
  minimum_stock?: number;
  unit?: string;
  last_updated?: string;
  purchase_date?: string;
  storage_date?: string;
  usage_date?: string;
  expiration_date?: string;
  return_date?: string;
  notes?: string;
  supplier?: string;
  disposition: InventoryDisposition;
  label_id?: string;
  storage_user_name?: string;
  usage_user_name?: string;
  storage_note?: string;
  usage_note?: string;
  supplier_id?: number;
  supplier_name?: string;
  order_associations?: VinylItemOrderAssociation[];
  created_at?: string;
  updated_at?: string;
}

export interface InventoryStats {
  total_items?: number;
  total_yards_all?: number;
  in_stock_count?: number;
  total_yards_in_stock?: number;
  used_count?: number;
  total_yards_used?: number;
  waste_count?: number;
  total_yards_waste?: number;
}

export interface VinylAutofillCombination {
  brand: string;
  series: string;
  colour?: string;
  colour_number?: string;
  colour_name?: string;
  supplier_ids?: number[];
  default_width?: number | null;
  available_widths?: string | null;
}

export interface VinylAutofillSuggestions {
  combinations?: VinylAutofillCombination[];
}

export interface VinylFormSubmission {
  brand: string;
  series: string;
  colour_number?: string;
  colour_name?: string;
  width: number;
  length_yards: number;
  location?: string;
  disposition: InventoryDisposition;
  supplier_id: number | null;
  purchase_date?: string;
  storage_date?: string;
  notes?: string;
  order_ids: number[];
}

export interface VinylProductFormSubmission {
  brand: string;
  series: string;
  colour_number?: string;
  colour_name?: string;
  default_width: number | null;
  supplier_ids: number[];
}

export interface StatusChangePayload {
  vinyl_id: number;
  disposition: InventoryDisposition;
  status_change_date: string;
  notes: string;
  order_ids: number[];
}
