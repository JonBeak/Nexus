import axios from 'axios';
import { triggerSessionExpired } from '../contexts/SessionContext';
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
          // Refresh failed - show modal then redirect
          console.error('Token refresh failed:', refreshError);
          triggerSessionExpired();
          // Note: SessionExpiredModal will handle cleanup and redirect
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - show modal then redirect
        triggerSessionExpired();
        // Note: SessionExpiredModal will handle cleanup and redirect
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

  getUsers: async () => {
    const response = await api.get('/auth/users');
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

  getManufacturingPreferences: async (id: number) => {
    const response = await api.get(`/customers/${id}/manufacturing-preferences`);
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

  // Delete single time entry
  deleteEntry: async (id: number) => {
    const response = await api.delete(`/time-management/entries/${id}`);
    return response.data;
  },

  // Delete time entries (bulk)
  deleteEntries: async (ids: number[]) => {
    const response = await api.delete('/time-management/bulk-delete', {
      data: { entryIds: ids }
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
    entryIds: number[];
    updates: {
      clock_in?: string;
      clock_out?: string;
      break_minutes?: number;
    };
  }) => {
    const response = await api.put('/time-management/bulk-edit', data);
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

  // Notifications
  getNotifications: async () => {
    const response = await api.get('/time/notifications');
    return response.data;
  },

  markNotificationAsRead: async (notificationId: number) => {
    const response = await api.put(`/time/notifications/${notificationId}/read`);
    return response.data;
  },

  clearAllNotifications: async () => {
    const response = await api.put('/time/notifications/clear-all');
    return response.data;
  },

  // Edit/Delete Requests
  submitEditRequest: async (data: {
    entry_id: number;
    requested_clock_in: string;
    requested_clock_out: string;
    requested_break_minutes: number;
    reason: string;
  }) => {
    const response = await api.post('/time/edit-request', data);
    return response.data;
  },

  submitDeleteRequest: async (data: {
    entry_id: number;
    reason: string;
  }) => {
    const response = await api.post('/time/delete-request', data);
    return response.data;
  },

  getPendingRequests: async () => {
    const response = await api.get('/time/pending-requests');
    return response.data;
  },

  processRequest: async (data: {
    request_id: number;
    action: 'approve' | 'reject' | 'modify';
    reviewer_notes: string;
    modified_clock_in?: string;
    modified_clock_out?: string;
    modified_break_minutes?: number;
  }) => {
    const response = await api.post('/time/process-request', data);
    return response.data;
  },

  // Schedules & Holidays
  getSchedules: async (userId: number) => {
    const response = await api.get(`/time-management/schedules/${userId}`);
    return response.data;
  },

  updateSchedules: async (userId: number, schedules: any[]) => {
    const response = await api.put(`/time-management/schedules/${userId}`, { schedules });
    return response.data;
  },

  getHolidays: async () => {
    const response = await api.get('/time-management/holidays');
    return response.data;
  },

  createHoliday: async (data: { holiday_name: string; holiday_date: string }) => {
    const response = await api.post('/time-management/holidays', data);
    return response.data;
  },

  deleteHoliday: async (holidayId: number) => {
    const response = await api.delete(`/time-management/holidays/${holidayId}`);
    return response.data;
  },

  exportHolidays: async () => {
    const response = await api.get('/time-management/holidays/export', {
      responseType: 'text'
    });
    return response.data;
  },

  importHolidays: async (data: { csvData: string; overwriteAll?: boolean }) => {
    const response = await api.post('/time-management/holidays/import', data);
    return response.data;
  },

  // Calendar Data
  getCalendarData: async (params: {
    startDate: string;
    endDate: string;
    group?: string;
  }) => {
    const response = await api.get('/time-management/calendar-data', { params });
    return response.data;
  },

  updateCalendarEntry: async (data: {
    user_id: number;
    date: string;
    clock_in?: string;
    clock_out?: string;
    break_minutes?: number;
    entry_id?: number | null;
  }) => {
    const response = await api.post('/time-management/calendar-entry', data);
    return response.data;
  },

  // Analytics Overview (different from getAnalytics)
  getAnalyticsOverview: async (params: {
    startDate: string;
    endDate: string;
    group?: string;
  }) => {
    const response = await api.get('/time-management/analytics-overview', { params });
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

// =============================================
// ORDERS API
// =============================================

export const ordersApi = {
  /**
   * Get all orders with optional filters
   */
  async getOrders(filters?: {
    status?: string;
    customer_id?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const params: any = {};

    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.customer_id) {
      params.customer_id = filters.customer_id;
    }
    if (filters?.search) {
      params.search = filters.search;
    }
    if (filters?.limit) {
      params.limit = filters.limit;
    }
    if (filters?.offset) {
      params.offset = filters.offset;
    }

    const response = await api.get('/orders', { params });
    return response.data.data;
  },

  /**
   * Get single order by order number
   */
  async getOrderById(orderNumber: number): Promise<any> {
    const response = await api.get(`/orders/${orderNumber}`);
    return response.data.data;
  },

  /**
   * Update order status
   */
  async updateOrderStatus(orderNumber: number, status: string, notes?: string): Promise<void> {
    await api.put(`/orders/${orderNumber}/status`, { status, notes });
  },

  /**
   * Convert estimate to order
   */
  async convertEstimateToOrder(data: {
    estimateId: number;
    orderName: string;
    customerPo?: string;
    dueDate?: string;
    pointPersonEmail?: string;
    productionNotes?: string;
  }): Promise<{ order_id: number; order_number: number }> {
    const response = await api.post('/orders/convert-estimate', data);
    return response.data.data;
  },

  /**
   * Delete order
   */
  async deleteOrder(orderNumber: number): Promise<void> {
    await api.delete(`/orders/${orderNumber}`);
  },

  /**
   * Get order progress
   */
  async getOrderProgress(orderNumber: number): Promise<any> {
    const response = await api.get(`/orders/${orderNumber}/progress`);
    return response.data.data;
  },

  /**
   * Get order tasks
   */
  async getOrderTasks(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/tasks`);
    return response.data.data;
  },

  /**
   * Get tasks grouped by part
   */
  async getTasksByPart(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/tasks/by-part`);
    return response.data.data;
  },

  /**
   * Update task completion
   */
  async updateTaskCompletion(orderNumber: number, taskId: number, completed: boolean): Promise<void> {
    await api.put(`/orders/${orderNumber}/tasks/${taskId}`, { completed });
  },

  /**
   * Get status history (timeline events)
   */
  async getStatusHistory(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/status-history`);
    return response.data.data;
  },

  /**
   * Get tasks grouped by production role
   */
  async getTasksByRole(includeCompleted: boolean = false, hoursBack: number = 24): Promise<any> {
    const response = await api.get('/orders/tasks/by-role', {
      params: { includeCompleted, hoursBack }
    });
    return response.data.data;
  },

  /**
   * Batch update tasks (start/complete)
   */
  async batchUpdateTasks(updates: Array<{ task_id: number; started?: boolean; completed?: boolean }>): Promise<void> {
    await api.put('/orders/tasks/batch-update', { updates });
  }
};

// =============================================
// QUICKBOOKS INTEGRATION API
// =============================================

export const quickbooksApi = {
  // Check connection status
  async getStatus(): Promise<{
    connected: boolean;
    realmId?: string;
    environment?: string;
    tokenExpiresAt?: string;
    message: string;
  }> {
    const response = await api.get('/quickbooks/status');
    return response.data;
  },

  // Check if QB credentials are configured
  async getConfigStatus(): Promise<{
    configured: boolean;
    errors: string[];
    environment: string;
  }> {
    const response = await api.get('/quickbooks/config-status');
    return response.data;
  },

  // Initiate OAuth flow (opens QB authorization in new window)
  async startAuth(): Promise<void> {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Get token from localStorage to pass as query param (needed for window.open)
    const token = localStorage.getItem('access_token');
    const authUrl = token
      ? `${API_BASE_URL}/quickbooks/start-auth?token=${encodeURIComponent(token)}`
      : `${API_BASE_URL}/quickbooks/start-auth`;

    window.open(
      authUrl,
      'QuickBooks Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  },

  // Disconnect from QuickBooks
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/quickbooks/disconnect');
    return response.data;
  },

  // Create estimate in QuickBooks
  async createEstimate(estimateData: {
    estimateId: number;
    estimatePreviewData: any;
    debugMode?: boolean; // Optional: enables sent vs received comparison logging
  }): Promise<{
    success: boolean;
    qbEstimateId?: string;
    qbDocNumber?: string;
    qbEstimateUrl?: string;
    error?: string;
    missingItems?: string[];
    debug?: {
      linesSent: number;
      linesReturned: number;
      sentLines: any[];
      returnedLines: any[];
      fullEstimate: any;
    };
  }> {
    const response = await api.post('/quickbooks/create-estimate', estimateData);
    return response.data;
  }
};


// Export as both default and named export for compatibility
export { api as apiClient };
export default api;
