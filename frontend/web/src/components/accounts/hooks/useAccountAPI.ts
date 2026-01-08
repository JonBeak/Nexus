import { useState, useCallback } from 'react';
import api from '../../../services/api';
import type { AccountUser, ProductionRole } from '../../../types/user';

export interface LoginLog {
  log_id: number;
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  ip_address: string;
  login_time: string;
  user_agent: string;
}

export interface VacationPeriod {
  vacation_id?: number;
  user_id: number;
  start_date: string;
  end_date: string;
  description: string;
  created_at?: string;
}

export const useAccountAPI = () => {
  const [apiLoading, setApiLoading] = useState(false);

  const fetchUsers = useCallback(async (): Promise<AccountUser[]> => {
    try {
      // Request full fields including production_roles
      const response = await api.get('/accounts/users', {
        params: { fields: 'full', includeInactive: 'true' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }, []);

  const fetchLoginLogs = useCallback(async (userId?: number): Promise<LoginLog[]> => {
    try {
      const url = userId
        ? `/accounts/login-logs/user/${userId}`
        : `/accounts/login-logs`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching login logs:', error);
      throw error;
    }
  }, []);

  const fetchVacationPeriods = useCallback(async (userId?: number): Promise<VacationPeriod[]> => {
    try {
      const url = userId
        ? `/accounts/vacations/user/${userId}`
        : `/accounts/vacations`;

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching vacation periods:', error);
      throw error;
    }
  }, []);

  const createUser = useCallback(async (userData: AccountUser): Promise<void> => {
    setApiLoading(true);
    try {
      // Backend returns { success: true, message: string, data: { user_id } }
      // This format has 3 fields, so interceptor won't unwrap it
      await api.post('/accounts/users', userData);
      // Success - no error thrown
    } catch (error: any) {
      // Errors are handled by interceptor and thrown
      throw new Error(error.response?.data?.error || error.message || 'Failed to create user');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const updateUser = useCallback(async (userData: AccountUser): Promise<void> => {
    if (!userData.user_id) throw new Error('User ID is required for update');

    setApiLoading(true);
    try {
      // Backend uses handleServiceResult() which returns { success: true, data: T }
      // Interceptor unwraps this to just T directly
      await api.put(`/accounts/users/${userData.user_id}`, userData);
      // Success - no error thrown
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update user');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (userId: number, newPassword: string): Promise<void> => {
    setApiLoading(true);
    try {
      // Backend uses handleServiceResult() which returns { success: true, data: T }
      // Interceptor unwraps this to just T directly
      await api.put(`/accounts/users/${userId}/password`, { password: newPassword });
      // Success - no error thrown
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update password');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const createVacation = useCallback(async (vacationData: VacationPeriod): Promise<void> => {
    setApiLoading(true);
    try {
      // Backend returns { message: string, vacation_id: number }
      // This format doesn't have 'success' and 'data' fields, so interceptor won't unwrap it
      await api.post('/accounts/vacations', vacationData);
      // Success - no error thrown
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to create vacation period');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const deleteVacation = useCallback(async (vacationId: number): Promise<void> => {
    setApiLoading(true);
    try {
      // Backend returns { message: string }
      // This format doesn't have 'success' and 'data' fields, so interceptor won't unwrap it
      await api.delete(`/accounts/vacations/${vacationId}`);
      // Success - no error thrown
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to delete vacation period');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const fetchProductionRoles = useCallback(async (): Promise<ProductionRole[]> => {
    try {
      const response = await api.get('/settings/roles');
      return response.data;
    } catch (error) {
      console.error('Error fetching production roles:', error);
      throw error;
    }
  }, []);

  return {
    apiLoading,
    fetchUsers,
    fetchLoginLogs,
    fetchVacationPeriods,
    fetchProductionRoles,
    createUser,
    updateUser,
    changePassword,
    createVacation,
    deleteVacation
  };
};

export type { AccountUser as User };