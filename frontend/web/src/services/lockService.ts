import api from './api';

export interface LockStatus {
  resource_type: string;
  resource_id: string;
  can_edit: boolean;
  editing_user: string | null;
  editing_user_id: number | null;
  editing_started_at: string | null;
  editing_expires_at: string | null;
  locked_by_override: boolean;
}

export interface LockResponse {
  success: boolean;
  lock_status?: LockStatus;
  message?: string;
}

class LockService {
  /**
   * Attempt to acquire a lock on a resource
   */
  async acquireLock(resourceType: string, resourceId: string): Promise<LockResponse> {
    try {
      const response = await api.post('/locks/acquire', {
        resource_type: resourceType,
        resource_id: resourceId
      });
      return response.data;
    } catch (error: any) {
      console.error('Error acquiring lock:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to acquire lock'
      };
    }
  }

  /**
   * Release a lock on a resource
   */
  async releaseLock(resourceType: string, resourceId: string): Promise<void> {
    try {
      await api.post('/locks/release', {
        resource_type: resourceType,
        resource_id: resourceId
      });
    } catch (error: any) {
      console.error('Error releasing lock:', error);
      // Don't throw - releasing lock should be silent
    }
  }

  /**
   * Check the current lock status of a resource
   */
  async checkLock(resourceType: string, resourceId: string): Promise<LockStatus | null> {
    try {
      const response = await api.get(`/locks/check/${resourceType}/${resourceId}`);
      // API interceptor unwraps { success: true, data: T } -> T directly
      return response.data;
    } catch (error: any) {
      console.error('Error checking lock status:', error);
      return null;
    }
  }

  /**
   * Override an existing lock (requires manager+ permissions)
   */
  async overrideLock(resourceType: string, resourceId: string): Promise<LockResponse> {
    try {
      const response = await api.post('/locks/override', {
        resource_type: resourceType,
        resource_id: resourceId
      });
      return response.data;
    } catch (error: any) {
      console.error('Error overriding lock:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to override lock'
      };
    }
  }

  /**
   * Get all locks for a specific resource type (admin function)
   */
  async getResourceLocks(resourceType: string): Promise<LockStatus[]> {
    try {
      const response = await api.get(`/locks/resource/${resourceType}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting resource locks:', error);
      return [];
    }
  }

  /**
   * Get all active locks (admin function)
   */
  async getAllActiveLocks(): Promise<LockStatus[]> {
    try {
      const response = await api.get('/locks/active');
      return response.data;
    } catch (error: any) {
      console.error('Error getting active locks:', error);
      return [];
    }
  }

  /**
   * Clean up expired locks (admin function)
   */
  async cleanupExpiredLocks(): Promise<{ cleaned: number }> {
    try {
      const response = await api.post('/locks/cleanup');
      return response.data;
    } catch (error: any) {
      console.error('Error cleaning up expired locks:', error);
      return { cleaned: 0 };
    }
  }
}

// Export singleton instance
export const lockService = new LockService();

// Export class for testing
export { LockService };