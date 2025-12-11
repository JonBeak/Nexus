/**
 * Frontend order types
 * Phase 1.e - Frontend Order Dashboard
 */

export interface Order {
  order_id: number;
  order_number: number;
  version_number: number;
  order_name: string;
  estimate_id?: number;
  customer_id: number;
  customer_name?: string;  // From join
  customer_po?: string;
  customer_job_number?: string;
  order_date: string;
  due_date?: string;
  hard_due_date_time?: string;
  production_notes?: string;
  manufacturing_note?: string;  // Auto-filled from customer special_instructions, editable per order
  internal_note?: string;        // Auto-filled from customer comments, editable per order
  invoice_email?: string;        // Auto-filled from customer invoice_email, editable per order
  terms?: string;                // Auto-filled from customer payment_terms, editable per order
  deposit_required?: boolean;    // Auto-filled from customer deposit_required, editable per order
  invoice_notes?: string;        // Auto-filled from customer invoice_email_preference, editable per order
  cash?: boolean;                // Auto-filled from customer cash_yes_or_no, editable per order
  discount?: number;             // Auto-filled from customer discount, editable per order
  tax_name?: string;             // Auto-filled from billing address province tax, editable per order
  original_tax_name?: string;    // Saved tax_name before cash job override - restored when cash job unchecked
  sign_image_path?: string;
  crop_top?: number;             // Pixels to crop from top edge (auto-crop feature)
  crop_right?: number;           // Pixels to crop from right edge (auto-crop feature)
  crop_bottom?: number;          // Pixels to crop from bottom edge (auto-crop feature)
  crop_left?: number;            // Pixels to crop from left edge (auto-crop feature)

  // Phase 1.5g - Folder & Image Management
  folder_name?: string;          // Full folder name "{order_name} ----- {customer_company_name}"
  folder_exists?: boolean;       // Whether folder exists on disk
  folder_location?: 'active' | 'finished' | 'none';  // Folder location
  is_migrated?: boolean;         // true for legacy orders, false for app-created

  form_version: number;
  shipping_required: boolean;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  created_by: number;

  // Progress info (from aggregate queries)
  total_tasks?: number;
  completed_tasks?: number;
  progress_percent?: number;

  // Relations (included in detailed order response)
  point_persons?: OrderPointPerson[];  // Phase 1.5: Multiple point persons per order
  parts?: OrderPart[];
  tasks?: OrderTask[];
}

export type OrderStatus =
  | 'job_details_setup'
  | 'pending_confirmation'
  | 'pending_production_files_creation'
  | 'pending_production_files_approval'
  | 'production_queue'
  | 'in_production'
  | 'on_hold'
  | 'overdue'
  | 'qc_packing'
  | 'shipping'
  | 'pick_up'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled';

export interface OrderFilters {
  statuses: OrderStatus[];  // Multi-select: empty array means use defaults (all except completed/cancelled)
  customer_id?: number;
  search?: string;
}

export interface OrderListResponse {
  success: boolean;
  data: Order[];
  total?: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  job_details_setup: 'Job Details Setup',
  pending_confirmation: 'Pending Confirmation',
  pending_production_files_creation: 'Pending Files Creation',
  pending_production_files_approval: 'Pending Files Approval',
  production_queue: 'Production Queue',
  in_production: 'In Production',
  on_hold: 'On Hold',
  overdue: 'Overdue',
  qc_packing: 'QC & Packing',
  shipping: 'Shipping',
  pick_up: 'Pick Up',
  awaiting_payment: 'Awaiting Payment',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  job_details_setup: 'bg-amber-100 text-amber-800',
  pending_confirmation: 'bg-yellow-100 text-yellow-800',
  pending_production_files_creation: 'bg-orange-100 text-orange-800',
  pending_production_files_approval: 'bg-orange-100 text-orange-800',
  production_queue: 'bg-blue-100 text-blue-800',
  in_production: 'bg-indigo-100 text-indigo-800',
  on_hold: 'bg-red-100 text-red-800',
  overdue: 'bg-red-600 text-white',
  qc_packing: 'bg-purple-100 text-purple-800',
  shipping: 'bg-cyan-100 text-cyan-800',
  pick_up: 'bg-teal-100 text-teal-800',
  awaiting_payment: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-300 text-gray-600'
};

/**
 * Phase 1.5.c Types
 */

export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  display_number?: string;
  is_parent: boolean;
  product_type: string;
  part_scope?: string;  // Text identifier for the part (e.g., "Main Sign", "Logo", "Border")
  qb_item_name?: string;  // QuickBooks item name (for invoice/QB sync)
  qb_description?: string;  // QuickBooks estimate description (extracted from specifications JSON)
  specs_display_name?: string;  // Mapped display name for Specs section
  specs_qty?: number;  // Manufacturing quantity (dedicated column)
  product_type_id: string;
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number | null;  // Nullable - 0 is converted to null
  specifications: Record<string, any>;  // Semantic keys: { height: "12", depth: "3" }
  invoice_description?: string;
  unit_price?: number | null;  // Nullable - 0 is converted to null
  extended_price?: number | null;
  production_notes?: string;

  // Aggregated from tasks
  tasks?: OrderTask[];
  total_tasks?: number;
  completed_tasks?: number;
}

export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  assigned_role: 'designer' | 'vinyl_cnc' | 'painting' | 'cut_bend' | 'leds' | 'packing' | null;
  completed: boolean;
  started_at?: string;
  started_by?: number;
  completed_at?: string;
  completed_by?: number;
  depends_on_task_id?: number;
  notes?: string;
}

export interface TaskTemplate {
  task_name: string;
  assigned_role: string | null;
}

/**
 * Point Person Types (Multiple point persons per order)
 */
export interface OrderPointPerson {
  id: number;
  order_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
  created_at: string;
}

export interface PointPersonInput {
  contact_id?: number;       // If selecting from existing customer_contacts
  contact_email: string;
  contact_name?: string;      // Required for new contacts
  contact_phone?: string;
  contact_role?: string;
  saveToDatabase?: boolean;   // If true, save custom contact to customer_contacts table
}

export interface PartUpdateData {
  part_id: number;
  product_type?: string;
  part_scope?: string;  // Text identifier for the part
  qb_item_name?: string;  // QuickBooks item name (for invoice/QB sync)
  specifications?: Record<string, any>;
  invoice_description?: string;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
  production_notes?: string;
}
