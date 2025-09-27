import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface PendingChange {
  userId: number;
  field: 'cpp' | 'ei' | 'tax';
  value: number;
  timestamp: number;
  payPeriodStart: string;
  payPeriodEnd: string;
}

interface SaveStatusMap {
  [key: string]: SaveStatus; // key format: "userId-field"
}

interface UseAutoSaveProps {
  onSave: (changes: PendingChange[], payPeriodStart: string, payPeriodEnd: string) => Promise<boolean>;
  debounceMs?: number;
  maxRetries?: number;
}

export const useAutoSave = ({ 
  onSave, 
  debounceMs = 800, 
  maxRetries = 3 
}: UseAutoSaveProps) => {
  const [saveStatuses, setSaveStatuses] = useState<SaveStatusMap>({});
  const pendingChanges = useRef<Map<string, PendingChange>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Helper to create unique key for user-field combination
  const createKey = (userId: number, field: string) => `${userId}-${field}`;

  // Set save status for a specific field
  const setFieldStatus = useCallback((userId: number, field: string, status: SaveStatus) => {
    const key = createKey(userId, field);
    setSaveStatuses(prev => ({ ...prev, [key]: status }));
  }, []);

  // Get save status for a specific field
  const getFieldStatus = useCallback((userId: number, field: string): SaveStatus => {
    const key = createKey(userId, field);
    return saveStatuses[key] || 'idle';
  }, [saveStatuses]);

  const processFailedChanges = useCallback((failedChanges: PendingChange[], retry: () => Promise<void>) => {
    failedChanges.forEach(change => {
      const key = createKey(change.userId, change.field);
      const retryCount = (retryCountRef.current.get(key) || 0) + 1;

      if (retryCount <= maxRetries) {
        retryCountRef.current.set(key, retryCount);
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);

        setTimeout(() => {
          if (pendingChanges.current.has(key)) {
            void retry();
          }
        }, backoffDelay);
      } else {
        setFieldStatus(change.userId, change.field, 'error');
        retryCountRef.current.delete(key);

        setTimeout(() => {
          setFieldStatus(change.userId, change.field, 'idle');
        }, 5000);
      }
    });
  }, [maxRetries, setFieldStatus]);

  // Perform the actual save operation
  const performSave = useCallback(async () => {
    if (pendingChanges.current.size === 0) return;

    const changesToSave = Array.from(pendingChanges.current.values());

    const changesByPeriod = changesToSave.reduce((acc, change) => {
      const periodKey = `${change.payPeriodStart}-${change.payPeriodEnd}`;
      if (!acc[periodKey]) acc[periodKey] = [];
      acc[periodKey].push(change);
      return acc;
    }, {} as { [periodKey: string]: PendingChange[] });

    try {
      let allSucceeded = true;
      const savedChanges: PendingChange[] = [];

      for (const changes of Object.values(changesByPeriod)) {
        const firstChange = changes[0];
        const success = await onSave(changes, firstChange.payPeriodStart, firstChange.payPeriodEnd);

        if (success) {
          savedChanges.push(...changes);
        } else {
          allSucceeded = false;
        }
      }

      if (savedChanges.length > 0) {
        savedChanges.forEach(change => {
          const key = createKey(change.userId, change.field);
          setFieldStatus(change.userId, change.field, 'saved');
          pendingChanges.current.delete(key);
          retryCountRef.current.delete(key);
        });

        setTimeout(() => {
          savedChanges.forEach(change => {
            setFieldStatus(change.userId, change.field, 'idle');
          });
        }, 2000);
      }

      if (!allSucceeded) {
        const failedChanges = changesToSave.filter(change => !savedChanges.includes(change));
        if (failedChanges.length > 0) {
          processFailedChanges(failedChanges, performSave);
        }
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      processFailedChanges(changesToSave, performSave);
    }
  }, [onSave, processFailedChanges, setFieldStatus]);

  // Add a pending change
  const addPendingChange = useCallback((userId: number, field: 'cpp' | 'ei' | 'tax', value: number, payPeriodStart: string, payPeriodEnd: string) => {
    const key = createKey(userId, field);
    const change: PendingChange = {
      userId,
      field,
      value,
      timestamp: Date.now(),
      payPeriodStart,
      payPeriodEnd
    };

    const existing = pendingChanges.current.get(key);
    if (existing && existing.value === value) {
      return;
    }

    pendingChanges.current.set(key, change);
    setFieldStatus(userId, field, 'saving');

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void performSave();
    }, debounceMs);
  }, [debounceMs, performSave, setFieldStatus]);

  // Manual retry for failed saves
  const retryFailedSave = useCallback((userId: number, field: string) => {
    const key = createKey(userId, field);
    if (pendingChanges.current.has(key)) {
      retryCountRef.current.delete(key);
      setFieldStatus(userId, field, 'saving');
      void performSave();
    }
  }, [performSave, setFieldStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    addPendingChange,
    getFieldStatus,
    retryFailedSave,
    hasPendingChanges: pendingChanges.current.size > 0
  };
};
