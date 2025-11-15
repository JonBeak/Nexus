import { api } from '../../apiClient';

/**
 * Time Schedules API
 * Manages work schedules and holiday calendar
 */
export const timeSchedulesApi = {
  /**
   * Get schedules for a user
   */
  getSchedules: async (userId: number) => {
    const response = await api.get(`/time-management/schedules/${userId}`);
    return response.data;
  },

  /**
   * Update schedules for a user
   */
  updateSchedules: async (userId: number, schedules: any[]) => {
    const response = await api.put(`/time-management/schedules/${userId}`, { schedules });
    return response.data;
  },

  /**
   * Get holidays
   */
  getHolidays: async () => {
    const response = await api.get('/time-management/holidays');
    return response.data;
  },

  /**
   * Create holiday
   */
  createHoliday: async (data: { holiday_name: string; holiday_date: string; overwrite?: boolean }) => {
    const response = await api.post('/time-management/holidays', data);
    return response.data;
  },

  /**
   * Delete holiday
   */
  deleteHoliday: async (holidayId: number) => {
    const response = await api.delete(`/time-management/holidays/${holidayId}`);
    return response.data;
  },

  /**
   * Export holidays
   */
  exportHolidays: async () => {
    const response = await api.get('/time-management/holidays/export', {
      responseType: 'text'
    });
    return response.data;
  },

  /**
   * Import holidays from CSV
   */
  importHolidays: async (data: { csvData: string; overwriteAll?: boolean }) => {
    const response = await api.post('/time-management/holidays/import', data);
    return response.data;
  },
};
