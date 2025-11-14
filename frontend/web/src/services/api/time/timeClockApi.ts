import { api } from '../../apiClient';

/**
 * Time Clock API
 * Handles clock in/out operations and real-time tracking status
 */
export const timeClockApi = {
  /**
   * Get time tracking status
   */
  getStatus: async () => {
    const response = await api.get('/time/status');
    return response.data;
  },

  /**
   * Clock in
   */
  clockIn: async () => {
    const response = await api.post('/time/clock-in');
    return response.data;
  },

  /**
   * Clock out
   */
  clockOut: async () => {
    const response = await api.post('/time/clock-out');
    return response.data;
  },

  /**
   * Get weekly summary (alternative endpoint)
   */
  getWeeklySummaryAlt: async (weekOffset: number = 0) => {
    const response = await api.get(`/time/weekly-summary?weekOffset=${weekOffset}`);
    return response.data;
  },
};
