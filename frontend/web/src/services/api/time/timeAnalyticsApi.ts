import { api } from '../../apiClient';

/**
 * Time Analytics API
 * Provides summaries, analytics, and reporting for time tracking data
 */
export const timeAnalyticsApi = {
  /**
   * Get weekly summary (handles all period types)
   */
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

  /**
   * Get analytics data
   */
  getAnalytics: async (params: {
    startDate: string;
    endDate?: string;
    group?: string;
    search?: string;
  }) => {
    const response = await api.get('/time-management/analytics', { params });
    return response.data;
  },

  /**
   * Get missing entries
   */
  getMissingEntries: async (params: {
    startDate: string;
    endDate?: string;
    group?: string;
  }) => {
    const response = await api.get('/time-management/missing-entries', { params });
    return response.data;
  },

  /**
   * Get analytics overview
   */
  getAnalyticsOverview: async (params: {
    startDate: string;
    endDate: string;
    group?: string;
  }) => {
    const response = await api.get('/time-management/analytics-overview', { params });
    return response.data;
  },
};
