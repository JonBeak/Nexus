import { api } from '../../apiClient';

/**
 * Time Entries API - CRUD Operations
 * Manages time entry creation, updates, deletion, and querying
 */
export const timeEntriesApi = {
  /**
   * Get time entries with filters
   */
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

  /**
   * Create new time entry
   */
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

  /**
   * Update time entry
   */
  updateEntry: async (id: number, data: {
    clock_in?: string;
    clock_out?: string;
    break_minutes?: number;
  }) => {
    const response = await api.put(`/time-management/entries/${id}`, data);
    return response.data;
  },

  /**
   * Delete single time entry
   */
  deleteEntry: async (id: number) => {
    const response = await api.delete(`/time-management/entries/${id}`);
    return response.data;
  },

  /**
   * Delete time entries (bulk)
   */
  deleteEntries: async (ids: number[]) => {
    const response = await api.delete('/time-management/bulk-delete', {
      data: { entryIds: ids }
    });
    return response.data;
  },

  /**
   * Bulk edit entries
   */
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

  /**
   * Mark missing entry as excused
   */
  markExcused: async (data: {
    user_id: number;
    missing_date: string;
    reason?: string;
  }) => {
    const response = await api.post('/time-management/mark-excused', data);
    return response.data;
  },

  /**
   * Export time data
   */
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
};
