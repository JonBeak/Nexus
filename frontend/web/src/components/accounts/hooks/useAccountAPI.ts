import { useState, useCallback } from 'react';
import api from '../../../services/api';
import type { AccountUser } from '../../../types/user';

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
      const response = await api.get('/accounts/users');
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
      const response = await api.post('/accounts/users', userData);

      // api.post already handles errors via interceptor
      // Just check if we need to throw a specific error
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      // Re-throw with the original error message if available
      throw new Error(error.response?.data?.error || error.message || 'Failed to create user');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const updateUser = useCallback(async (userData: AccountUser): Promise<void> => {
    if (!userData.user_id) throw new Error('User ID is required for update');

    setApiLoading(true);
    try {
      const response = await api.put(`/accounts/users/${userData.user_id}`, userData);

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update user');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (userId: number, newPassword: string): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await api.put(`/accounts/users/${userId}/password`, { password: newPassword });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update password');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const createVacation = useCallback(async (vacationData: VacationPeriod): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await api.post('/accounts/vacations', vacationData);

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to create vacation period');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const deleteVacation = useCallback(async (vacationId: number): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await api.delete(`/accounts/vacations/${vacationId}`);

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to delete vacation period');
    } finally {
      setApiLoading(false);
    }
  }, []);

  return {
    apiLoading,
    fetchUsers,
    fetchLoginLogs,
    fetchVacationPeriods,
    createUser,
    updateUser,
    changePassword,
    createVacation,
    deleteVacation
  };
};

export type { AccountUser as User };