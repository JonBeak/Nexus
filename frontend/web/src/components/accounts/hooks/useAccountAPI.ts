import { useState, useCallback } from 'react';
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

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchUsers = useCallback(async (): Promise<AccountUser[]> => {
    try {
      const response = await fetch('http://192.168.2.14:3001/api/accounts/users', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Failed to fetch users');
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const fetchLoginLogs = useCallback(async (userId?: number): Promise<LoginLog[]> => {
    try {
      const url = userId 
        ? `http://192.168.2.14:3001/api/accounts/login-logs/user/${userId}`
        : `http://192.168.2.14:3001/api/accounts/login-logs`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Failed to fetch login logs');
    } catch (error) {
      console.error('Error fetching login logs:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const fetchVacationPeriods = useCallback(async (userId?: number): Promise<VacationPeriod[]> => {
    try {
      const url = userId 
        ? `http://192.168.2.14:3001/api/accounts/vacations/user/${userId}`
        : `http://192.168.2.14:3001/api/accounts/vacations`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Failed to fetch vacation periods');
    } catch (error) {
      console.error('Error fetching vacation periods:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const createUser = useCallback(async (userData: AccountUser): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await fetch('http://192.168.2.14:3001/api/accounts/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }
    } finally {
      setApiLoading(false);
    }
  }, [getAuthHeaders]);

  const updateUser = useCallback(async (userData: AccountUser): Promise<void> => {
    if (!userData.user_id) throw new Error('User ID is required for update');
    
    setApiLoading(true);
    try {
      const response = await fetch(`http://192.168.2.14:3001/api/accounts/users/${userData.user_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }
    } finally {
      setApiLoading(false);
    }
  }, [getAuthHeaders]);

  const changePassword = useCallback(async (userId: number, newPassword: string): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await fetch(`http://192.168.2.14:3001/api/accounts/users/${userId}/password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: newPassword })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }
    } finally {
      setApiLoading(false);
    }
  }, [getAuthHeaders]);

  const createVacation = useCallback(async (vacationData: VacationPeriod): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await fetch('http://192.168.2.14:3001/api/accounts/vacations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(vacationData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create vacation period');
      }
    } finally {
      setApiLoading(false);
    }
  }, [getAuthHeaders]);

  const deleteVacation = useCallback(async (vacationId: number): Promise<void> => {
    setApiLoading(true);
    try {
      const response = await fetch(`http://192.168.2.14:3001/api/accounts/vacations/${vacationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete vacation period');
      }
    } finally {
      setApiLoading(false);
    }
  }, [getAuthHeaders]);

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
