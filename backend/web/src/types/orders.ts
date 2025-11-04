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
  point_person_email?: string;
  order_date: Date;
  due_date?: Date;
  production_notes?: string;
  sign_image_path?: string;
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
  | 'initiated'
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
  product_type: string;  // Human-readable
  product_type_id: string;  // Machine-readable
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number;
  specifications: any;  // JSON
  production_notes?: string;
}

export interface CreateOrderPartData {
  order_id: number;
  part_number: number;
  product_type: string;
  product_type_id: string;
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number;
  specifications: any;
  production_notes?: string;
}

// =============================================
// ORDER TASK TYPES
// =============================================

export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  task_order: number;
  completed: boolean;
  completed_at?: Date;
  completed_by?: number;
}

export interface CreateOrderTaskData {
  order_id: number;
  part_id?: number;
  task_name: string;
  task_order: number;
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
// ORDER CONVERSION TYPES
// =============================================

export interface ConvertEstimateRequest {
  estimateId: number;
  orderName: string;
  customerPo?: string;
  dueDate?: string;  // ISO date string
  pointPersonEmail?: string;
  productionNotes?: string;
}

export interface ConvertEstimateResponse {
  success: boolean;
  order_id: number;
  order_number: number;
  message?: string;
}

// =============================================
// TASK TEMPLATE TYPES
// =============================================

export interface TaskTemplate {
  task_name: string;
  task_order: number;
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
  point_person_email?: string;
  due_date?: Date;
  production_notes?: string;
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
  point_person_email?: string;
  order_date: Date;
  due_date?: Date;
  production_notes?: string;
  sign_image_path?: string;
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
