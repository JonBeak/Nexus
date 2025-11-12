/**
 * Order System Type Definitions
 * Phase 1.b - Backend Order Conversion & Management
 */

// =============================================
// ORDER TYPES
// =============================================

export interface Order {
  order_id: number;
  order_number: number;  // Sequential starting at 200000
  version_number: number;
  order_name: string;
  estimate_id?: number;
  customer_id: number;
  customer_po?: string;
  customer_job_number?: string;
  order_date: Date;
  due_date?: Date;
  hard_due_date_time?: Date;
  production_notes?: string;
  manufacturing_note?: string;  // Auto-filled from customer special_instructions
  internal_note?: string;       // Auto-filled from customer comments
  invoice_email?: string;       // Auto-filled from customer invoice_email
  terms?: string;               // Auto-filled from customer payment_terms
  deposit_required?: boolean;   // Auto-filled from customer deposit_required
  invoice_notes?: string;       // Auto-filled from customer invoice_email_preference
  cash?: boolean;               // Auto-filled from customer cash_yes_or_no
  discount?: number;            // Auto-filled from customer discount
  tax_name?: string;            // Auto-filled from billing address province tax, editable per order
  sign_image_path?: string;
  crop_top?: number;            // Pixels to crop from top edge (auto-crop feature)
  crop_right?: number;          // Pixels to crop from right edge (auto-crop feature)
  crop_bottom?: number;         // Pixels to crop from bottom edge (auto-crop feature)
  crop_left?: number;           // Pixels to crop from left edge (auto-crop feature)

  // Phase 1.5.g: Folder tracking fields
  folder_name?: string;
  folder_exists?: boolean;
  folder_location?: 'active' | 'finished' | 'none';
  is_migrated?: boolean;        // True for orders created from existing SMB folders (legacy tracking)

  form_version: number;
  shipping_required: boolean;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
  created_by: number;

  // From JOIN queries
  customer_name?: string;

  // Progress aggregation (from list queries)
  total_tasks?: number;
  completed_tasks?: number;
}

export type OrderStatus =
  | 'job_details_setup'  // Phase 1.5: First status for new orders (was 'initiated')
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

// =============================================
// ORDER PART TYPES
// =============================================

export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  display_number?: string;  // Phase 1.5: "1", "1a", "1b" numbering
  is_parent?: boolean;      // Phase 1.5: Mark first item in section
  product_type: string;  // Human-readable
  part_scope?: string;  // Text identifier for the part (e.g., "Main Sign", "Logo", "Border")
  qb_item_name?: string;  // QuickBooks item name (for invoice/QB sync)
  specs_display_name?: string;  // Mapped display name for Specs section
  product_type_id: string;  // Machine-readable
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number;
  specifications: any;  // JSON
  production_notes?: string;
  // Phase 1.5: Invoice data (nullable = determines row "type")
  invoice_description?: string;
  unit_price?: number;
  extended_price?: number;
}

export interface CreateOrderPartData {
  order_id: number;
  part_number: number;
  display_number?: string;  // Phase 1.5
  is_parent?: boolean;      // Phase 1.5
  product_type: string;
  part_scope?: string;  // Text identifier for the part
  qb_item_name?: string;  // QuickBooks item name (for invoice/QB sync)
  specs_display_name?: string;  // Mapped display name for Specs section
  product_type_id: string;
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number;
  specifications: any;
  production_notes?: string;
  // Phase 1.5: Invoice fields
  invoice_description?: string;
  unit_price?: number;
  extended_price?: number;
}

// =============================================
// ORDER TASK TYPES
// =============================================

export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  completed: boolean;
  completed_at?: Date;
  completed_by?: number;
}

export interface CreateOrderTaskData {
  order_id: number;
  part_id?: number;
  task_name: string;
  assigned_role?: 'designer' | 'vinyl_cnc' | 'painting' | 'cut_bend' | 'leds' | 'packing' | null;
}

// =============================================
// ORDER STATUS HISTORY TYPES
// =============================================

export interface OrderStatusHistory {
  history_id: number;
  order_id: number;
  status: string;
  changed_at: Date;
  changed_by: number;
  notes?: string;
}

export interface CreateStatusHistoryData {
  order_id: number;
  status: string;
  changed_by: number;
  notes?: string;
}

// =============================================
// ORDER POINT PERSON TYPES
// =============================================

export interface OrderPointPerson {
  id: number;
  order_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
  created_at: Date;
}

export interface CreateOrderPointPersonData {
  order_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
}

export interface PointPersonInput {
  contact_id?: number;           // If selecting from existing customer_contacts
  contact_email: string;
  contact_name?: string;         // Required for new contacts
  contact_phone?: string;
  contact_role?: string;
}

// =============================================
// ORDER CONVERSION TYPES
// =============================================

export interface ConvertEstimateRequest {
  estimateId: number;
  orderName: string;
  customerPo?: string;
  customerJobNumber?: string;        // Phase 1.5.a.5: Customer's internal job number
  dueDate?: string;                  // ISO date string (YYYY-MM-DD)
  hardDueDateTime?: string;          // Phase 1.5.a.5: ISO datetime string (YYYY-MM-DDTHH:MM:SS)
  pointPersons?: PointPersonInput[]; // Array of point persons (from order_point_persons table)
  productionNotes?: string;
  // Phase 1.5: Include full estimate preview data for order creation
  estimatePreviewData?: EstimatePreviewData;
}

export interface ConvertEstimateResponse {
  success: boolean;
  order_id: number;
  order_number: number;
  message?: string;
}

// =============================================
// ESTIMATE PREVIEW TYPES (Phase 1.5)
// =============================================

export interface EstimatePreviewData {
  items: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  customerId?: number;
  customerName?: string | null;
  estimateId?: number;
  cashCustomer?: boolean;
}

export interface EstimateLineItem {
  rowId: string;
  inputGridDisplayNumber: string;
  estimatePreviewDisplayNumber?: string;  // "1", "1a", "1b", "1c"
  isParent?: boolean;
  productTypeId: number;
  productTypeName: string;
  itemName: string;
  description: string;
  calculationDisplay: string;  // e.g., "8 Letters × $45/letter"
  calculationComponents?: any[];
  unitPrice: number;
  quantity: number;
  extendedPrice: number;
  assemblyGroupId?: string;
  isDescriptionOnly?: boolean;
}

// =============================================
// TASK TEMPLATE TYPES
// =============================================

export interface TaskTemplate {
  task_name: string;
}

export interface ProductTypeTaskTemplate {
  product_type_id: string;
  tasks: TaskTemplate[];
}

// =============================================
// ORDER WITH RELATIONS
// =============================================

export interface OrderWithDetails extends Order {
  customer_name?: string;
  parts: OrderPart[];
  tasks: OrderTask[];
  point_persons: OrderPointPerson[];
  completed_tasks_count: number;
  total_tasks_count: number;
  progress_percent: number;
}

// =============================================
// ORDER QUERY FILTERS
// =============================================

export interface OrderFilters {
  status?: string;
  customer_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

// =============================================
// ORDER UPDATE DATA
// =============================================

export interface UpdateOrderData {
  order_name?: string;
  customer_po?: string;
  customer_job_number?: string;
  due_date?: Date;
  hard_due_date_time?: Date;
  production_notes?: string;
  manufacturing_note?: string;
  internal_note?: string;
  invoice_email?: string;
  terms?: string;
  deposit_required?: boolean;
  invoice_notes?: string;
  cash?: boolean;
  discount?: number;
  tax_name?: string;
  shipping_required?: boolean;
}

// =============================================
// REPOSITORY RESPONSE TYPES
// =============================================

export interface CreateOrderData {
  order_number: number;
  version_number?: number;
  order_name: string;
  estimate_id?: number;
  customer_id: number;
  customer_po?: string;
  customer_job_number?: string;      // Phase 1.5.b
  order_date: Date;
  due_date?: Date;
  hard_due_date_time?: string;       // Phase 1.5.b - formatted string for MySQL (YYYY-MM-DD HH:MM:SS)
  production_notes?: string;
  manufacturing_note?: string;        // Auto-filled from customer special_instructions
  internal_note?: string;             // Auto-filled from customer comments
  invoice_email?: string;             // Auto-filled from customer invoice_email
  terms?: string;                     // Auto-filled from customer payment_terms
  deposit_required?: boolean;         // Auto-filled from customer deposit_required
  invoice_notes?: string;             // Auto-filled from customer invoice_email_preference
  cash?: boolean;                     // Auto-filled from customer cash_yes_or_no
  discount?: number;                  // Auto-filled from customer discount
  tax_name?: string;                  // Auto-filled from billing address province tax, editable per order
  sign_image_path?: string;
  crop_top?: number;                  // Pixels to crop from top edge (auto-crop feature)
  crop_right?: number;                // Pixels to crop from right edge (auto-crop feature)
  crop_bottom?: number;               // Pixels to crop from bottom edge (auto-crop feature)
  crop_left?: number;                 // Pixels to crop from left edge (auto-crop feature)
  form_version?: number;
  shipping_required?: boolean;
  status?: OrderStatus;
  created_by: number;
}

// =============================================
// ESTIMATE TYPES (for conversion)
// =============================================

export interface EstimateForConversion {
  id: number;
  customer_id: number;
  status: string;
  job_id: number;
}

export interface EstimateItem {
  id: number;
  estimate_id: number;
  product_type_id: number;
  item_name: string;
  grid_data: any;
  item_order: number;
}

// =============================================
// PRODUCT TYPE INFO
// =============================================

export interface ProductTypeInfo {
  id: number;
  name: string;
  category: string;
  is_channel_letter: boolean;
}
