import { api } from '../apiClient';

/**
 * Authentication API methods
 * Handles user authentication and user management operations
 */
export const authApi = {
  /**
   * Get current authenticated user details
   */
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Get all users in the system
   */
  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
};
