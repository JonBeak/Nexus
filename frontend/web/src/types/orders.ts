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
  point_person_email?: string;
  order_date: string;
  due_date?: string;
  production_notes?: string;
  sign_image_path?: string;
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

export interface OrderFilters {
  status?: OrderStatus | 'all';
  customer_id?: number;
  search?: string;
}

export interface OrderListResponse {
  success: boolean;
  data: Order[];
  total?: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  initiated: 'Initiated',
  pending_confirmation: 'Pending Confirmation',
  pending_production_files_creation: 'Pending Files Creation',
  pending_production_files_approval: 'Pending Files Approval',
  production_queue: 'Production Queue',
  in_production: 'In Production',
  on_hold: 'On Hold',
  overdue: 'Overdue',
  qc_packing: 'QC & Packing',
  shipping: 'Shipping',
  pick_up: 'Ready for Pickup',
  awaiting_payment: 'Awaiting Payment',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  initiated: 'bg-gray-100 text-gray-800',
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
