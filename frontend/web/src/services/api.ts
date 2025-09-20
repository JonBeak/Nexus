import axios from 'axios';
export { jobVersioningApi } from './jobVersioningApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors and refresh tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefreshToken);
          
          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          console.error('Token refresh failed:', refreshError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const customerApi = {
  getCustomers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    include_inactive?: boolean;
  } = {}) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  createCustomer: async (customerData: any) => {
    const response = await api.post('/customers', customerData);
    return response.data;
  },

  getCustomer: async (id: number) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  updateCustomer: async (id: number, data: any) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  // Address management
  addAddress: async (customerId: number, addressData: any) => {
    const response = await api.post(`/customers/${customerId}/addresses`, addressData);
    return response.data;
  },

  updateAddress: async (customerId: number, addressId: number, addressData: any) => {
    const response = await api.put(`/customers/${customerId}/addresses/${addressId}`, addressData);
    return response.data;
  },

  deleteAddress: async (customerId: number, addressId: number) => {
    const response = await api.delete(`/customers/${customerId}/addresses/${addressId}`);
    return response.data;
  },

  // Get all addresses (including inactive)
  getAddresses: async (customerId: number, includeInactive: boolean = false) => {
    const params = includeInactive ? { include_inactive: 'true' } : {};
    const response = await api.get(`/customers/${customerId}/addresses`, { params });
    return response.data;
  },

  // Reactivate address
  reactivateAddress: async (customerId: number, addressId: number) => {
    const response = await api.post(`/customers/${customerId}/addresses/${addressId}/reactivate`);
    return response.data;
  },

  // Deactivate customer
  deactivateCustomer: async (customerId: number) => {
    const response = await api.post(`/customers/${customerId}/deactivate`);
    return response.data;
  },

  // Reactivate customer
  reactivateCustomer: async (customerId: number) => {
    const response = await api.post(`/customers/${customerId}/reactivate`);
    return response.data;
  },


  // Make an address primary
  makePrimaryAddress: async (customerId: number, addressId: number | string) => {
    const response = await api.post(`/customers/${customerId}/addresses/${addressId}/make-primary`);
    return response.data;
  },
  // Get LED types
  getLedTypes: async () => {
    const response = await api.get('/customers/led-types');
    return response.data;
  },

  // Get Power Supply types
  getPowerSupplyTypes: async () => {
    const response = await api.get('/customers/power-supply-types');
    return response.data;
  },
};

export const vinylApi = {
  // Get all vinyl inventory items
  getVinylItems: async (params: {
    disposition?: string;
    type?: string;
    search?: string;
  } = {}) => {
    const response = await api.get('/vinyl', { params });
    return response.data;
  },

  // Get single vinyl item
  getVinylItem: async (id: number) => {
    const response = await api.get(`/vinyl/${id}`);
    return response.data;
  },

  // Create new vinyl item
  createVinylItem: async (vinylData: any) => {
    const response = await api.post('/vinyl', vinylData);
    return response.data;
  },

  // Update vinyl item
  updateVinylItem: async (id: number, updates: any) => {
    const response = await api.put(`/vinyl/${id}`, updates);
    return response.data;
  },

  // Mark vinyl as used
  markVinylAsUsed: async (id: number, data: { usage_note?: string; job_ids?: number[] }) => {
    const response = await api.put(`/vinyl/${id}/use`, data);
    return response.data;
  },

  // Delete vinyl item
  deleteVinylItem: async (id: number) => {
    const response = await api.delete(`/vinyl/${id}`);
    return response.data;
  },

  // Get recent vinyl items for copying
  getRecentVinylForCopying: async () => {
    const response = await api.get('/vinyl/recent/for-copying');
    return response.data;
  },

  // Get vinyl statistics
  getVinylStats: async () => {
    const response = await api.get('/vinyl/stats/summary');
    return response.data;
  },

  // Get suppliers available for a product combination
  getSuppliersForProduct: async (params: {
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
    type?: string;
  } = {}) => {
    const response = await api.get('/vinyl/suppliers/for-product', { params });
    return response.data;
  },
  // Update job links for a vinyl item (unified endpoint)
  updateJobLinks: async (id: number, job_ids: number[]) => {
    const response = await api.put(`/vinyl/${id}/job-links`, { job_ids });
    return response.data;
  },
  // Get job links for a vinyl item (unified endpoint)
  getJobLinks: async (id: number) => {
    const response = await api.get(`/vinyl/${id}/job-links`);
    return response.data;
  },

};

export const vinylProductsApi = {
  // Get all vinyl products
  getVinylProducts: async (params: {
    search?: string;
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
    type?: string;
    supplier?: string;
    active_only?: boolean;
  } = {}) => {
    const response = await api.get('/vinyl-products', { params });
    return response.data;
  },

  // Get single vinyl product
  getVinylProduct: async (id: number) => {
    const response = await api.get(`/vinyl-products/${id}`);
    return response.data;
  },

  // Create new vinyl product
  createVinylProduct: async (productData: any) => {
    const response = await api.post('/vinyl-products', productData);
    return response.data;
  },

  // Update vinyl product
  updateVinylProduct: async (id: number, updates: any) => {
    const response = await api.put(`/vinyl-products/${id}`, updates);
    return response.data;
  },

  // Delete vinyl product
  deleteVinylProduct: async (id: number) => {
    const response = await api.delete(`/vinyl-products/${id}`);
    return response.data;
  },

  // Get product statistics
  getVinylProductStats: async () => {
    const response = await api.get('/vinyl-products/stats/summary');
    return response.data;
  },

  // Get autofill suggestions
  getAutofillSuggestions: async (params: {
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
    type?: string;
  } = {}) => {
    const response = await api.get('/vinyl-products/autofill/suggestions', { params });
    return response.data;
  },

};

export const suppliersApi = {
  // Get all suppliers
  getSuppliers: async (params: {
    search?: string;
    active_only?: boolean;
  } = {}) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  // Get single supplier
  getSupplier: async (id: number) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  // Create new supplier
  createSupplier: async (supplierData: any) => {
    const response = await api.post('/suppliers', supplierData);
    return response.data;
  },

  // Update supplier
  updateSupplier: async (id: number, updates: any) => {
    const response = await api.put(`/suppliers/${id}`, updates);
    return response.data;
  },

  // Delete supplier
  deleteSupplier: async (id: number) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  // Get supplier statistics
  getSupplierStats: async () => {
    const response = await api.get('/suppliers/stats/summary');
    return response.data;
  },
};

export const jobsApi = {
  // Get all jobs
  getJobs: async (params: {
    search?: string;
    status?: string;
    customer_id?: number;
    limit?: number;
  } = {}) => {
    const response = await api.get('/jobs', { params });
    return response.data;
  },

  // Get recent jobs
  getRecentJobs: async (limit: number = 20) => {
    const response = await api.get('/jobs', { 
      params: { 
        limit,
        // Order by most recent by default
      } 
    });
    return response.data;
  },
};

// Time Management API
export const timeApi = {
  // Get time entries with filters
  getEntries: async (params: {
    startDate: string;
    endDate?: string;
    status?: string;
    group?: string;
    search?: string;
  }) => {
    const response = await api.get('/time-management/entries', { params });
    return response.data;
  },

  // Get weekly summary (handles all period types)
  getWeeklySummary: async (params: {
    startDate: string;
    endDate?: string;
    group?: string;
    search?: string;
    period?: string;
  }) => {
    const response = await api.get('/time-management/weekly-summary', { params });
    return response.data;
  },

  // Get analytics data
  getAnalytics: async (params: {
    startDate: string;
    endDate?: string;
    group?: string;
    search?: string;
  }) => {
    const response = await api.get('/time-management/analytics', { params });
    return response.data;
  },

  // Get missing entries
  getMissingEntries: async (params: {
    startDate: string;
    endDate?: string;
    group?: string;
  }) => {
    const response = await api.get('/time-management/missing-entries', { params });
    return response.data;
  },

  // Create new time entry
  createEntry: async (data: {
    user_id: number;
    clock_in: string;
    clock_out: string;
    break_minutes: number;
    date: string;
  }) => {
    const response = await api.post('/time-management/entries', data);
    return response.data;
  },

  // Update time entry
  updateEntry: async (id: number, data: {
    clock_in?: string;
    clock_out?: string;
    break_minutes?: number;
  }) => {
    const response = await api.put(`/time-management/entries/${id}`, data);
    return response.data;
  },

  // Delete time entries (bulk)
  deleteEntries: async (ids: number[]) => {
    const response = await api.delete('/time-management/entries', { 
      data: { ids } 
    });
    return response.data;
  },

  // Mark missing entry as excused
  markExcused: async (data: {
    user_id: number;
    missing_date: string;
    reason?: string;
  }) => {
    const response = await api.post('/time-management/mark-excused', data);
    return response.data;
  },

  // Export time data
  exportData: async (params: {
    startDate: string;
    endDate?: string;
    status?: string;
    group?: string;
    search?: string;
    format: 'csv' | 'pdf';
    viewMode?: string;
  }) => {
    const response = await api.get('/time-management/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // Bulk edit entries
  bulkEdit: async (data: {
    entry_ids: number[];
    clock_in?: string;
    clock_out?: string;
    break_minutes?: number;
  }) => {
    const response = await api.put('/time-management/entries/bulk', data);
    return response.data;
  },

  // Time tracking status
  getStatus: async () => {
    const response = await api.get('/time/status');
    return response.data;
  },

  // Clock in/out
  clockIn: async () => {
    const response = await api.post('/time/clock-in');
    return response.data;
  },

  clockOut: async () => {
    const response = await api.post('/time/clock-out');
    return response.data;
  },

  // Weekly summary (alternative endpoint)
  getWeeklySummaryAlt: async (weekOffset: number = 0) => {
    const response = await api.get(`/time/weekly-summary?weekOffset=${weekOffset}`);
    return response.data;
  },
};

// Accounts Management API
export const accountsApi = {
  // Get all users
  getUsers: async () => {
    const response = await api.get('/accounts/users');
    return response.data;
  },

  // Create new user
  createUser: async (userData: any) => {
    const response = await api.post('/accounts/users', userData);
    return response.data;
  },

  // Update user
  updateUser: async (userData: any) => {
    const response = await api.put(`/accounts/users/${userData.user_id}`, userData);
    return response.data;
  },

  // Update user password
  updatePassword: async (userId: number, passwordData: any) => {
    const response = await api.put(`/accounts/users/${userId}/password`, passwordData);
    return response.data;
  },

  // Get vacations
  getVacations: async () => {
    const response = await api.get('/accounts/vacations');
    return response.data;
  },

  // Delete vacation
  deleteVacation: async (vacationId: number) => {
    const response = await api.delete(`/accounts/vacations/${vacationId}`);
    return response.data;
  },
};

// Provinces/States API
export const provincesApi = {
  // Get provinces/states
  getProvinces: async () => {
    const response = await api.get('/customers/provinces-states');
    return response.data;
  },

  // Get tax info for province
  getTaxInfo: async (provinceCode: string) => {
    const response = await api.get(`/customers/tax-info/${provinceCode}`);
    return response.data;
  },
};


export default api;
