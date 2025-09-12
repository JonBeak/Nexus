import api, { customerApi } from './api';

// Types
export interface JobEstimate {
  id: number;
  job_code: string;
  customer_id?: number;
  estimate_name: string;
  status: 'draft' | 'sent' | 'approved' | 'ordered' | 'deactivated';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  groups: JobEstimateGroup[];
  created_at: string;
  updated_at: string;
}

export interface JobEstimateGroup {
  id: number;
  estimate_id: number;
  group_name: string;
  group_order: number;
  assembly_cost: number;
  assembly_description?: string;
  items: JobEstimateItem[];
}

export interface JobEstimateItem {
  id: number;
  group_id: number;
  product_type_id: number;
  product_type_name?: string;
  item_name: string;
  item_order: number;
  input_data: any;
  complexity_score?: number;
  base_quantity: number;
  unit_price: number;
  extended_price: number;
  labor_minutes?: number;
  customer_description?: string;
  internal_notes?: string;
  addons: JobItemAddon[];
}

export interface JobItemAddon {
  id: number;
  item_id: number;
  addon_type_id: number;
  addon_type_name?: string;
  addon_order: number;
  input_data: any;
  quantity: number;
  unit_price: number;
  extended_price: number;
  customer_description?: string;
  internal_notes?: string;
}

export interface ProductType {
  id: number;
  name: string;
  category: string;
  default_unit: string;
  input_template: any;
  pricing_rules: any;
  complexity_rules?: any;
  material_rules?: any;
  is_active: boolean;
}

export interface AddonType {
  id: number;
  name: string;
  category: string;
  applicable_to: string[];
  input_template: any;
  pricing_rules: any;
  material_rules?: any;
  is_active: boolean;
}

// Job Estimates API
export const getEstimates = (params?: {
  search?: string;
  status?: string;
  customer_id?: number;
  limit?: number;
}) => api.get<JobEstimate[]>('/job-estimation/estimates', { params });

export const getEstimateById = (id: number) =>
  api.get<JobEstimate>(`/job-estimation/estimates/${id}`);

export const createEstimate = (data: {
  customer_id?: number;
  estimate_name: string;
}) => api.post<JobEstimate>('/job-estimation/estimates', data);

export const updateEstimate = (id: number, data: {
  customer_id?: number;
  estimate_name?: string;
  status?: string;
  notes?: string;
}) => api.put<void>(`/job-estimation/estimates/${id}`, data);

export const deleteEstimate = (id: number) =>
  api.delete<void>(`/job-estimation/estimates/${id}`);

// Groups API
export const createGroup = (estimateId: number, data: {
  group_name: string;
  assembly_cost?: number;
  assembly_description?: string;
}) => api.post<JobEstimateGroup>(`/job-estimation/estimates/${estimateId}/groups`, data);

export const updateGroup = (estimateId: number, groupId: number, data: {
  group_name?: string;
  assembly_cost?: number;
  assembly_description?: string;
}) => api.put<void>(`/job-estimation/estimates/${estimateId}/groups/${groupId}`, data);

export const deleteGroup = (estimateId: number, groupId: number) =>
  api.delete<void>(`/job-estimation/estimates/${estimateId}/groups/${groupId}`);

// Items API
export const createItem = (estimateId: number, groupId: number, data: {
  product_type_id: number;
  item_name: string;
  input_data: any;
}) => api.post<JobEstimateItem>(`/job-estimation/estimates/${estimateId}/groups/${groupId}/items`, data);

export const updateItem = (estimateId: number, itemId: number, data: {
  item_name?: string;
  input_data?: any;
  customer_description?: string;
  internal_notes?: string;
}) => api.put<void>(`/job-estimation/estimates/${estimateId}/items/${itemId}`, data);

export const deleteItem = (estimateId: number, itemId: number) =>
  api.delete<void>(`/job-estimation/estimates/${estimateId}/items/${itemId}`);

// Add-ons API
export const createAddon = (estimateId: number, itemId: number, data: {
  addon_type_id: number;
  input_data: any;
}) => api.post<JobItemAddon>(`/job-estimation/estimates/${estimateId}/items/${itemId}/addons`, data);

export const updateAddon = (estimateId: number, addonId: number, data: {
  input_data?: any;
  customer_description?: string;
}) => api.put<void>(`/job-estimation/estimates/${estimateId}/addons/${addonId}`, data);

export const deleteAddon = (estimateId: number, addonId: number) =>
  api.delete<void>(`/job-estimation/estimates/${estimateId}/addons/${addonId}`);

// Product Types and Templates API
export const getProductTypes = (category?: string) =>
  api.get<ProductType[]>('/job-estimation/product-types', { params: { category } });

export const getAddonTypes = () =>
  api.get<AddonType[]>('/job-estimation/addon-types');

export const getAddonTypesForProduct = (productTypeId: number) =>
  api.get<AddonType[]>(`/job-estimation/addon-types/${productTypeId}`);

// Calculations API
export const calculateEstimate = (estimateId: number) =>
  api.post<JobEstimate>(`/job-estimation/estimates/${estimateId}/calculate`);

export const generateMaterialRequirements = (estimateId: number) =>
  api.post<any>(`/job-estimation/estimates/${estimateId}/materials`);

// Export/Import API
export const exportEstimateTable = (estimateId: number, format: 'customer' | 'internal' = 'customer') =>
  api.get<{
    table_text: string;
    job_code: string;
  }>(`/job-estimation/estimates/${estimateId}/export-table`, { params: { format } });

export const importFromJobCode = (jobCode: string) =>
  api.post<JobEstimate>('/job-estimation/estimates/import-code', { job_code: jobCode });

// Bulk creation API for in-memory estimates
export const bulkCreateEstimate = (data: {
  estimate: {
    customer_id?: number;
    estimate_name: string;
  };
  groups: Array<{
    temp_id: string;
    group_name: string;
    assembly_cost: number;
    assembly_description?: string;
    items: Array<{
      temp_id: string;
      product_type_id: number;
      item_name: string;
      input_data: any;
      customer_description?: string;
      internal_notes?: string;
      addons: Array<{
        temp_id: string;
        addon_type_id: number;
        input_data: any;
      }>;
    }>;
  }>;
}) => api.post<{
  estimate_id: number;
  job_code: string;
  group_mappings: Array<{ temp_id: string; actual_id: number }>;
  item_mappings: Array<{ temp_id: string; actual_id: number }>;
  addon_mappings: Array<{ temp_id: string; actual_id: number }>;
}>('/job-estimation/estimates/bulk-create', data);

// Helper function to get customers (reuse existing API)
export const getCustomers = () => customerApi.getCustomers();

// Export all functions as a single object for easier importing
export const jobEstimationApi = {
  // Estimates
  getEstimates,
  getEstimateById,
  createEstimate,
  updateEstimate,
  deleteEstimate,
  
  // Groups
  createGroup,
  updateGroup,
  deleteGroup,
  
  // Items
  createItem,
  updateItem,
  deleteItem,
  
  // Add-ons
  createAddon,
  updateAddon,
  deleteAddon,
  
  // Templates
  getProductTypes,
  getAddonTypes,
  getAddonTypesForProduct,
  
  // Calculations
  calculateEstimate,
  generateMaterialRequirements,
  
  // Export/Import
  exportEstimateTable,
  importFromJobCode,
  
  // Bulk operations
  bulkCreateEstimate,
  
  // Helpers
  getCustomers
};