/**
 * Job Estimation Simple API
 * 
 * Ultra-simplified API client for the new parallel estimation system.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SimpleEstimateItem {
  id?: number;
  estimate_id: number;
  assembly_group_id?: number | null;
  parent_item_id?: number | null;
  item_order: number;
  item_index?: number | null;
  product_type_id?: number | null;
  item_name?: string | null;
  qty?: string | null;
  field_1?: string | null;
  field_2?: string | null; // VARCHAR(1020)
  field_3?: string | null;
  field_4?: string | null;
  field_5?: string | null;
  field_6?: string | null;
  field_7?: string | null;
  field_8?: string | null;
  field_9?: string | null;
  field_10?: string | null;
  field_11?: string | null;
  field_12?: string | null;
  unit_price_at_time?: number | null;
  description?: string | null;
}

export interface ProductType {
  id: number;
  name: string;
  category: string;
  input_template: any;
}

export const jobEstimationSimpleApi = {
  
  // Get all items for an estimate
  async getEstimateItems(estimateId: number): Promise<SimpleEstimateItem[]> {
    const response = await api.get(`/job-estimation-simple/estimates/${estimateId}/items`);
    return response.data.data;
  },
  
  // Save all items for an estimate
  async saveEstimateItems(estimateId: number, items: SimpleEstimateItem[]): Promise<void> {
    await api.post(`/job-estimation-simple/estimates/${estimateId}/items`, { items });
  },
  
  // Get single item by ID
  async getItemById(itemId: number): Promise<SimpleEstimateItem> {
    const response = await api.get(`/job-estimation-simple/items/${itemId}`);
    return response.data.data;
  },
  
  // Delete single item
  async deleteItem(itemId: number): Promise<void> {
    await api.delete(`/job-estimation-simple/items/${itemId}`);
  },
  
  // Get product types for dropdown population
  async getProductTypes(): Promise<ProductType[]> {
    const response = await api.get('/job-estimation-simple/product-types');
    return response.data.data;
  }
  
};