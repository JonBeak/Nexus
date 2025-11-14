import { api } from '../../apiClient';

/**
 * Time Calendar API
 * Handles calendar view operations and entry updates via calendar interface
 */
export const timeCalendarApi = {
  /**
   * Get calendar data
   */
  getCalendarData: async (params: {
    startDate: string;
    endDate: string;
    group?: string;
  }) => {
    const response = await api.get('/time-management/calendar-data', { params });
    return response.data;
  },

  /**
   * Update calendar entry
   */
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
};
