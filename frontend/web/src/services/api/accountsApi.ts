import { api } from '../apiClient';

/**
 * Accounts API
 * Manages user accounts, passwords, and vacation tracking
 */
export const accountsApi = {
  /**
   * Get all users
   */
  getUsers: async () => {
    const response = await api.get('/accounts/users');
    return response.data;
  },

  /**
   * Create new user
   */
  createUser: async (userData: any) => {
    const response = await api.post('/accounts/users', userData);
    return response.data;
  },

  /**
   * Update user
   */
  updateUser: async (userData: any) => {
    const response = await api.put(`/accounts/users/${userData.user_id}`, userData);
    return response.data;
  },

  /**
   * Update user password
   */
  updatePassword: async (userId: number, passwordData: any) => {
    const response = await api.put(`/accounts/users/${userId}/password`, passwordData);
    return response.data;
  },

  /**
   * Get vacations
   */
  getVacations: async () => {
    const response = await api.get('/accounts/vacations');
    return response.data;
  },

  /**
   * Delete vacation
   */
  deleteVacation: async (vacationId: number) => {
    const response = await api.delete(`/accounts/vacations/${vacationId}`);
    return response.data;
  },
};
