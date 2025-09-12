import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PendingChange {
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

    // Only add if value actually changed from existing pending change
    const existing = pendingChanges.current.get(key);
    if (existing && existing.value === value) {
      return; // Skip if same value
    }

    pendingChanges.current.set(key, change);
    setFieldStatus(userId, field, 'saving');

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save timeout
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [debounceMs, setFieldStatus]);

  // Perform the actual save operation
  const performSave = useCallback(async () => {
    if (pendingChanges.current.size === 0) return;

    // Get all pending changes
    const changesToSave = Array.from(pendingChanges.current.values());
    
    // Group changes by pay period (this is the fix!)
    const changesByPeriod = changesToSave.reduce((acc, change) => {
      const periodKey = `${change.payPeriodStart}-${change.payPeriodEnd}`;
      if (!acc[periodKey]) acc[periodKey] = [];
      acc[periodKey].push(change);
      return acc;
    }, {} as { [periodKey: string]: PendingChange[] });

    try {
      // Save each pay period separately
      let allSucceeded = true;
      const savedChanges: PendingChange[] = [];

      for (const [periodKey, changes] of Object.entries(changesByPeriod)) {
        // Extract pay period dates from the first change (all changes in this group have the same period)
        const firstChange = changes[0];
        
        // Attempt to save this pay period's changes
        const success = await onSave(changes, firstChange.payPeriodStart, firstChange.payPeriodEnd);
        
        if (success) {
          savedChanges.push(...changes);
        } else {
          allSucceeded = false;
        }
      }

      // Mark successfully saved changes
      if (savedChanges.length > 0) {
        savedChanges.forEach(change => {
          const key = createKey(change.userId, change.field);
          setFieldStatus(change.userId, change.field, 'saved');
          pendingChanges.current.delete(key);
          retryCountRef.current.delete(key);
        });

        // Auto-clear "saved" status after 2 seconds
        setTimeout(() => {
          savedChanges.forEach(change => {
            setFieldStatus(change.userId, change.field, 'idle');
          });
        }, 2000);
      }

      // Handle failed changes if any
      if (!allSucceeded) {
        const failedChanges = changesToSave.filter(change => !savedChanges.includes(change));
        if (failedChanges.length > 0) {
          handleSaveFailure(failedChanges);
        }
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      handleSaveFailure(changesToSave);
    }
  }, [onSave, setFieldStatus, maxRetries]);

  // Handle save failures with retry logic
  const handleSaveFailure = useCallback((failedChanges: PendingChange[]) => {
    failedChanges.forEach(change => {
      const key = createKey(change.userId, change.field);
      const retryCount = (retryCountRef.current.get(key) || 0) + 1;
      
      if (retryCount <= maxRetries) {
        // Retry with exponential backoff
        retryCountRef.current.set(key, retryCount);
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
        
        setTimeout(() => {
          // Only retry if change is still pending
          if (pendingChanges.current.has(key)) {
            performSave();
          }
        }, backoffDelay);
      } else {
        // Max retries reached - mark as error
        setFieldStatus(change.userId, change.field, 'error');
        retryCountRef.current.delete(key);
        
        // Auto-clear error status after 5 seconds
        setTimeout(() => {
          setFieldStatus(change.userId, change.field, 'idle');
        }, 5000);
      }
    });
  }, [maxRetries, performSave, setFieldStatus]);

  // Manual retry for failed saves
  const retryFailedSave = useCallback((userId: number, field: string) => {
    const key = createKey(userId, field);
    if (pendingChanges.current.has(key)) {
      retryCountRef.current.delete(key);
      setFieldStatus(userId, field, 'saving');
      performSave();
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