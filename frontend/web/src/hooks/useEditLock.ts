import { useState, useEffect, useRef, useCallback } from 'react';
import { lockService, LockStatus, LockResponse } from '../services/lockService';

// Throttle utility for mouse tracking
function throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return ((...args: any[]) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func.apply(null, args);
      lastExecTime = currentTime;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        func.apply(null, args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
}

export interface UseEditLockOptions {
  resourceType: string;
  resourceId: string;
  userId: number;
  username: string;
  userRole: string;
  heartbeatInterval?: number; // milliseconds, default 5 min
  checkInterval?: number; // milliseconds, default 30 sec
  onLockAcquired?: (status: LockStatus) => void;
  onLockLost?: (status: LockStatus) => void;
  autoAcquire?: boolean; // default true
}

export const useEditLock = (options: UseEditLockOptions) => {
  const {
    resourceType,
    resourceId,
    userId,
    username,
    userRole,
    heartbeatInterval = 5 * 60 * 1000, // 5 minutes
    checkInterval = 30 * 1000, // 30 seconds
    onLockAcquired,
    onLockLost,
    autoAcquire = true
  } = options;

  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [hasLock, setHasLock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const lockAcquiredRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const isAcquiringRef = useRef(false);

  const acquireLock = useCallback(async (skipAcquiringCheck = false): Promise<boolean> => {
    if (!skipAcquiringCheck && isAcquiringRef.current) {
      return false; // Prevent multiple simultaneous acquisition attempts
    }

    try {
      if (!skipAcquiringCheck) {
        isAcquiringRef.current = true;
      }
      setError(null);
      const response = await lockService.acquireLock(resourceType, resourceId);

      if (response.success) {
        const status: LockStatus = {
          resource_type: resourceType,
          resource_id: resourceId,
          can_edit: true,
          editing_user: username,
          editing_user_id: userId,
          editing_started_at: new Date().toISOString(),
          editing_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
          locked_by_override: false
        };

        setLockStatus(status);
        setHasLock(true);
        lockAcquiredRef.current = true;
        onLockAcquired?.(status);
        return true;
      } else {
        // Lock conflict
        if (response.lock_status) {
          setLockStatus(response.lock_status);
          setHasLock(false);
          if (lockAcquiredRef.current) {
            onLockLost?.(response.lock_status);
            lockAcquiredRef.current = false;
          }
        }
        return false;
      }
    } catch (error) {
      console.error('Error acquiring lock:', error);
      setError('Failed to acquire lock');
      return false;
    } finally {
      if (!skipAcquiringCheck) {
        isAcquiringRef.current = false;
      }
    }
  }, [resourceType, resourceId, userId, username, onLockAcquired, onLockLost]);

  const releaseLock = useCallback(async (): Promise<void> => {
    try {
      if (hasLock) {
        await lockService.releaseLock(resourceType, resourceId);
        setHasLock(false);
        setLockStatus(null);
        lockAcquiredRef.current = false;
      }
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }, [hasLock, resourceType, resourceId]);

  const overrideLock = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const response = await lockService.overrideLock(resourceType, resourceId);
      
      if (response.success) {
        const status: LockStatus = {
          resource_type: resourceType,
          resource_id: resourceId,
          can_edit: true,
          editing_user: username,
          editing_user_id: userId,
          editing_started_at: new Date().toISOString(),
          editing_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          locked_by_override: true
        };
        
        setLockStatus(status);
        setHasLock(true);
        lockAcquiredRef.current = true;
        onLockAcquired?.(status);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error overriding lock:', error);
      setError('Failed to override lock');
      return false;
    }
  }, [resourceType, resourceId, userId, username, onLockAcquired]);

  const checkStatus = useCallback(async (): Promise<LockStatus | null> => {
    try {
      const status = await lockService.checkLock(resourceType, resourceId);
      if (status) {
        setLockStatus(status);
        const userHasLock = status.can_edit && status.editing_user_id === userId;
        setHasLock(userHasLock);
        
        // Check if we lost the lock
        if (!userHasLock && lockAcquiredRef.current) {
          onLockLost?.(status);
          lockAcquiredRef.current = false;
        }
      }
      return status;
    } catch (error) {
      console.error('Error checking lock status:', error);
      return null;
    }
  }, [resourceType, resourceId, userId, onLockLost]);

  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(async () => {
      if (isActiveRef.current && hasLock) {
        // Check if user was active recently (within 5 minutes)
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        const ACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes

        if (timeSinceActivity < ACTIVITY_THRESHOLD) {
          // User is active - refresh the lock
          await acquireLock(true); // Skip acquiring check for refresh
        }
      }
    }, heartbeatInterval);
  }, [hasLock, acquireLock, heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startStatusCheck = useCallback(() => {
    checkIntervalRef.current = setInterval(async () => {
      if (isActiveRef.current) {
        await checkStatus();
      }
    }, checkInterval);
  }, [checkStatus, checkInterval]);

  const stopStatusCheck = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

  // Mouse activity tracking (throttled to prevent performance issues)
  const handleMouseMove = useCallback(
    throttle(() => {
      lastActivityRef.current = Date.now();

      // Auto-reacquire lock if:
      // 1. User doesn't have lock
      // 2. Resource is available (can_edit is true) OR no current lock status
      // 3. Not currently attempting to acquire
      // 4. Auto-acquire is enabled
      const canAttemptReacquire = !lockStatus || lockStatus.can_edit ||
        (lockStatus.editing_user_id === userId); // Allow reacquire if our own expired lock

      if (autoAcquire && !hasLock && canAttemptReacquire && !isAcquiringRef.current) {
        acquireLock();
      }
    }, 1000), // Throttle to once per second
    [autoAcquire, hasLock, lockStatus, acquireLock]
  );

  // Initialize lock system
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      
      // Check current lock status
      await checkStatus();
      
      // Auto-acquire lock if enabled
      if (autoAcquire) {
        await acquireLock();
      }
      
      // Start background processes
      startHeartbeat();
      startStatusCheck();
      
      setIsLoading(false);
    };

    initialize();

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isActiveRef.current = true;
        checkStatus();
      } else {
        isActiveRef.current = false;
      }
    };

    // Handle page unload
    const handleBeforeUnload = () => {
      releaseLock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Mouse activity tracking is now managed by separate useEffect based on hasLock state

    return () => {
      // Cleanup
      releaseLock();
      stopHeartbeat();
      stopStatusCheck();

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Mouse tracking cleanup is handled by separate useEffect
    };
  }, [resourceType, resourceId]); // Only re-initialize if resource changes

  // Manage mouse tracking based on lock status
  useEffect(() => {
    const removeMouseTracking = () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };

    const addMouseTracking = () => {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
    };

    if (hasLock) {
      // User has lock - remove mouse tracking to improve performance
      removeMouseTracking();
    } else {
      // User doesn't have lock - add mouse tracking for potential reacquisition
      addMouseTracking();
    }

    return removeMouseTracking;
  }, [hasLock, handleMouseMove]);

  const canOverride = userRole === 'manager' || userRole === 'owner';

  return {
    lockStatus,
    hasLock,
    isLoading,
    error,
    canOverride,
    acquireLock,
    releaseLock,
    overrideLock,
    checkStatus
  };
};