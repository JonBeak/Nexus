import { api } from '../../apiClient';

/**
 * Order Business Logic API
 * Handles business calculations and date computations
 */
export const orderBusinessLogicApi = {
  /**
   * Calculate due date based on business days
   */
  async calculateDueDate(startDate: string, turnaroundDays: number): Promise<{ dueDate: string; businessDaysCalculated: number }> {
    const response = await api.post('/orders/calculate-due-date', {
      startDate,
      turnaroundDays
    });
    return response.data;
  },

  /**
   * Calculate business days between two dates
   */
  async calculateBusinessDays(startDate: string, endDate: string): Promise<{ businessDays: number }> {
    const response = await api.post('/orders/calculate-business-days', {
      startDate,
      endDate
    });
    return response.data;
  },
};
