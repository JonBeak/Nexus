// File Clean up Finished: 2025-11-15 (Added tax fields to OrderDataForPDF)
// Changes (Pass 3 - Tax calculation support):
//   - Added tax_name field to OrderDataForPDF interface (fetched from orders table)
//   - Added tax_percent field to OrderDataForPDF interface (pre-calculated tax rate)
//   - Supports estimatePdfGenerator architecture fix (tax calculated in service layer, not generator)
//
// File Clean up Finished: 2025-11-15
// Changes (Pass 1 - Previous cleanup):
//   - Removed misleading OrderSpecifications interface from orderTemplates.ts
//   - Replaced import('./orderTemplates').OrderSpecifications with Record<string, any>
//   - Deleted orderTemplates.ts file (interface didn't match actual data structure)
//   - Actual structure is template-based: _template_N, rowN_field, _qb_description, specs_qty
//   - Deleted 45 lines of misleading type definitions
//
// Changes (Pass 2 - Type safety improvements):
//   - Added missing finalization fields to Order interface (finalized_at, finalized_by, modified_after_finalization)
//   - Fixed hard_due_date_time type from Date to string (matches database TIME type and query formatting)
//   - Updated in Order, UpdateOrderData interfaces (CreateOrderData and OrderDataForPDF already correct)
//   - Preserved ProductTypeTaskTemplate for future task template implementation

import { OrderAccountingEmail } from './customerAccountingEmails';

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
  hard_due_date_time?: string;  // TIME string from database formatted as "HH:MM" (e.g., "14:30")
  production_notes?: string;
  manufacturing_note?: string;  // Auto-filled from customer special_instructions
  internal_note?: string;       // Auto-filled from customer comments
  terms?: string;               // Auto-filled from customer payment_terms
  deposit_required?: boolean;   // Auto-filled from customer deposit_required
  invoice_notes?: string;       // Auto-filled from customer invoice_email_preference
  cash?: boolean;               // Auto-filled from customer cash_yes_or_no
  discount?: number;            // Auto-filled from customer discount
  tax_name?: string;            // Auto-filled from billing address province tax, editable per order
  original_tax_name?: string;   // Saved tax_name before cash job override - restored when cash job unchecked

  // Accounting emails (snapshot from customer at order creation)
  accounting_emails?: OrderAccountingEmail[];

  // QB Invoice fields (Phase 2.e)
  qb_invoice_id?: string | null;
  qb_invoice_doc_number?: string | null;
  qb_invoice_url?: string | null;
  qb_invoice_synced_at?: Date | null;
  qb_invoice_data_hash?: string | null;
  invoice_sent_at?: Date | null;

  // Invoice balance cache (Phase 2.f)
  cached_balance?: number | null;
  cached_balance_at?: Date | null;
  cached_invoice_total?: number | null;

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

  // Order finalization tracking (Phase 1.5.c.3 - Snapshot/Versioning)
  finalized_at?: Date;
  finalized_by?: number;
  modified_after_finalization?: boolean;

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

// Statuses where deposit tracking applies (after customer confirmation, before completion)
export const DEPOSIT_TRACKING_STATUSES: OrderStatus[] = [
  'pending_production_files_creation',
  'pending_production_files_approval',
  'production_queue',
  'in_production',
  'overdue',
  'qc_packing',
  'shipping',
  'pick_up',
  'awaiting_payment'
];

// =============================================
// ORDER PART TYPES
// =============================================

export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  is_header_row?: boolean;  // True for auto-generated invoice header row (part_number=0)
  display_number?: string;  // Phase 1.5: "1", "1a", "1b" numbering
  is_parent?: boolean;      // Phase 1.5: Mark first item in section
  product_type: string;  // Human-readable
  part_scope?: string;  // Text identifier for the part (e.g., "Main Sign", "Logo", "Border")
  qb_item_name?: string;  // QuickBooks item name (for invoice/QB sync)
  qb_description?: string;  // QuickBooks estimate description (extracted from specifications JSON)
  specs_display_name?: string;  // Mapped display name for Specs section
  specs_qty?: number;  // Manufacturing quantity (extracted from specifications JSON to dedicated column)
  product_type_id: string;  // Machine-readable
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number;
  specifications: Record<string, any>;  // JSON - Template-based dynamic structure (_template_N, rowN_field) - specs_qty moved to column
  production_notes?: string;
  // Phase 1.5: Invoice data (nullable = determines row "type")
  invoice_description?: string;
  unit_price?: number;
  extended_price?: number;
}

export interface CreateOrderPartData {
  order_id: number;
  part_number: number;
  is_header_row?: boolean;  // True for auto-generated invoice header row (part_number=0)
  display_number?: string;  // Phase 1.5
  is_parent?: boolean;      // Phase 1.5
  product_type: string;
  part_scope?: string;  // Text identifier for the part
  qb_item_name?: string;  // QuickBooks item name (for invoice/QB sync)
  qb_description?: string;  // QuickBooks estimate description
  specs_display_name?: string;  // Mapped display name for Specs section
  specs_qty?: number;  // Manufacturing quantity (dedicated column)
  product_type_id: string;
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number | null;
  specifications: Record<string, any>;  // JSON - Template-based dynamic structure (_template_N, rowN_field) - specs_qty moved to column
  production_notes?: string;
  // Phase 1.5: Invoice fields
  invoice_description?: string;
  unit_price?: number;
  extended_price?: number;
}

// =============================================
// ORDER TASK TYPES
// =============================================

/**
 * Production role types for task assignment
 */
export type ProductionRole =
  | 'designer'
  | 'manager'
  | 'vinyl_applicator'
  | 'cnc_router_operator'
  | 'cut_bender_operator'
  | 'return_fabricator'
  | 'trim_fabricator'
  | 'painter'
  | 'return_gluer'
  | 'mounting_assembler'
  | 'face_assembler'
  | 'led_installer'
  | 'backer_raceway_fabricator'
  | 'backer_raceway_assembler'
  | 'qc_packer';

export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  completed: boolean;
  completed_at?: Date;
  completed_by?: number;
  assigned_role?: ProductionRole | null;
  notes?: string | null;
  depends_on_task_id?: number | null;
  started_at?: Date;
  started_by?: number;
}

export interface CreateOrderTaskData {
  order_id: number;
  part_id?: number;
  task_name: string;
  assigned_role?: ProductionRole | null;
  notes?: string | null;
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
  saveToDatabase?: boolean;      // If true, save custom contact to customer_contacts table
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
  modalSpecialInstructions?: string; // Special instructions from conversion modal (appended to customer special_instructions)
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
  qbDescription?: string;  // QB Description from estimate preview
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
  hard_due_date_time?: string;  // TIME string formatted as "HH:MM"
  production_notes?: string;
  manufacturing_note?: string;
  internal_note?: string;
  terms?: string;
  deposit_required?: boolean;
  invoice_notes?: string;
  cash?: boolean;
  discount?: number;
  tax_name?: string;
  original_tax_name?: string;
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
  terms?: string;                     // Auto-filled from customer payment_terms
  deposit_required?: boolean;         // Auto-filled from customer deposit_required
  invoice_notes?: string;             // Auto-filled from customer invoice_email_preference
  cash?: boolean;                     // Auto-filled from customer cash_yes_or_no
  discount?: number;                  // Auto-filled from customer discount
  tax_name?: string;                  // Auto-filled from billing address province tax, editable per order
  accounting_emails?: OrderAccountingEmail[];  // Snapshot from customer at order creation
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

// =============================================
// PDF GENERATION TYPES
// =============================================

/**
 * Paths to generated PDF forms for an order
 */
export interface FormPaths {
  masterForm: string;
  estimateForm: string;  // Estimate PDF (order folder root)
  shopForm: string;
  customerForm: string;
  packingList: string;
}

/**
 * Complete order data structure for PDF generation
 * Includes order, customer, and parts information
 */
export interface OrderDataForPDF {
  // Order info
  order_id: number;
  order_number: number;
  order_name: string;
  order_date: Date;
  due_date?: Date;
  hard_due_date_time?: string;  // TIME format "HH:mm:ss" or "HH:mm" from database
  customer_po?: string;
  customer_job_number?: string;
  production_notes?: string;
  manufacturing_note?: string;
  internal_note?: string;
  status: string;
  form_version: number;
  sign_image_path?: string;  // Filename only (e.g., "design.jpg")
  crop_top?: number;         // Auto-crop coordinates
  crop_right?: number;
  crop_bottom?: number;
  crop_left?: number;
  shipping_required: boolean;
  tax_name?: string;         // Tax rule name (e.g., "HST ON", "GST")
  tax_percent?: number;      // Pre-calculated tax rate (e.g., 0.13 for 13%)

  // Folder info (for constructing full image path)
  folder_name?: string;
  folder_location?: 'active' | 'finished' | 'none';
  is_migrated?: boolean;

  // Customer info
  customer_id: number;
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  phone?: string;
  email?: string;

  // Customer packing preferences
  pattern_yes_or_no?: number;              // For packing list pattern logic
  pattern_type?: string;                   // "Paper" or "Digital"
  wiring_diagram_yes_or_no?: number;       // For packing list wiring diagram logic

  // Parts
  parts: OrderPartForPDF[];
}

/**
 * Order part structure for PDF generation
 */
export interface OrderPartForPDF {
  part_id: number;
  part_number: number;
  display_number?: string;
  is_parent?: boolean;
  product_type: string;
  part_scope?: string;
  specs_display_name?: string;
  product_type_id: string;
  quantity: number;
  specifications: Record<string, any>;  // JSON - Template-based dynamic structure (_template_N, rowN_field, _qb_description, specs_qty)
  production_notes?: string;
  // Invoice/Pricing fields (for Estimate PDF)
  qb_item_name?: string;         // QuickBooks item name (QB Item column)
  invoice_description?: string;  // Invoice description (calculation display, e.g., "8 Letters × $45/letter")
  unit_price?: number;           // Unit price
  extended_price?: number;       // Extended price (unit_price * quantity)
}

// ============================================================================
// Phase 1.6: QB Estimate Comparison Types
// Used for comparing app estimate structure with QB Estimate during order conversion
// ============================================================================

/**
 * Represents a line item from a QuickBooks Estimate
 * Used during estimate-to-order conversion to pull QB values
 */
export interface QBEstimateLineItem {
  /** QB Item name (e.g., "Channel Letters 3\"") */
  itemName: string;
  /** QB Description (may have been edited in QB) */
  description: string;
  /** Quantity from QB */
  quantity: number;
  /** Unit price from QB */
  unitPrice: number;
  /** Line detail type - SalesItemLineDetail for products, DescriptionOnly for notes */
  detailType: 'SalesItemLineDetail' | 'DescriptionOnly';
  /** Original line ID from QB (for reference) */
  lineId?: string;
}

/**
 * Result of comparing app estimate with QB Estimate structure
 */
export interface QBComparisonResult {
  /** Whether to use QB values for order parts */
  useQBValues: boolean;
  /** Reason for the decision (for logging) */
  reason: string;
  /** QB line items to use (only populated if useQBValues is true) */
  qbLineItems?: QBEstimateLineItem[];
  /** Any warnings encountered during comparison */
  warnings?: string[];
}
