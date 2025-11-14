import { api } from '../apiClient';

/**
 * Jobs API
 * Manages job/estimate operations
 */
export const jobsApi = {
  /**
   * Get all jobs with optional filtering
   */
  getJobs: async (params: {
    search?: string;
    status?: string;
    customer_id?: number;
    limit?: number;
  } = {}) => {
    const response = await api.get('/jobs', { params });
    return response.data;
  },

  /**
   * Get recent jobs
   */
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
