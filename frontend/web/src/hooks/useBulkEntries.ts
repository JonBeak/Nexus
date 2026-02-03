import { useState, useEffect, useCallback } from 'react';
import { authApi, ordersApi } from '../services/api';
import { OrderSuggestion } from '../components/common/OrderDropdown';
import { TIMING, DEFAULTS } from '../constants/bulkEntryConstants';
import { getTodayString } from '../utils/dateUtils';

export interface BulkEntry {
  id: string;
  type: 'store' | 'use' | 'waste' | 'returned' | 'damaged' | '';
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  width: string;
  length_yards: string;
  location?: string;
  transaction_date?: string;  // Single date field instead of three redundant ones
  notes?: string;
  job_ids: number[];  // Job associations using direct IDs
  specific_vinyl_id?: number;  // ID of specific vinyl piece selected
  // Submission state tracking
  submissionState?: 'idle' | 'submitting' | 'success' | 'error';
  submissionError?: string;
}

export const useBulkEntries = () => {
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [availableOrders, setAvailableOrders] = useState<OrderSuggestion[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get storage key for current user
  const getStorageKey = useCallback(() => {
    return currentUserId ? `bulkEntries_${currentUserId}` : 'bulkEntries_guest';
  }, [currentUserId]);

  // Helper to create a default entry shell
  // First 5 rows default to 'store', last 5 default to 'use'
  function createDefaultEntry(index = 0, idOverride?: string): BulkEntry {
    const defaultType = index < 5 ? 'store' : 'use';
    return {
      id: idOverride ?? (Date.now() + index).toString(),
      type: defaultType,
      brand: '',
      series: '',
      colour_number: '',
      colour_name: '',
      width: '',
      length_yards: '',
      location: '',
      transaction_date: getTodayString(),
      notes: '',
      job_ids: [DEFAULTS.EMPTY_JOB_ID]
    };
  }

  // Save bulk entries to localStorage
  const saveBulkEntries = useCallback((entries: BulkEntry[]) => {
    setIsSaving(true);
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(entries));
      setTimeout(() => setIsSaving(false), TIMING.SAVE_INDICATOR_DURATION); // Show saved indicator briefly
    } catch (error) {
      console.error('Failed to save bulk entries to localStorage:', error);
      setIsSaving(false);
    }
  }, [getStorageKey]);

  // Initialize user and load data
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const user = await authApi.getCurrentUser();
        let userId = null;
        if (user && user.id) {
          userId = user.id.toString();
        }
        setCurrentUserId(userId);
        
        // Load saved entries immediately after determining user
        const storageKey = userId ? `bulkEntries_${userId}` : 'bulkEntries_guest';
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const entries = JSON.parse(stored);
            if (Array.isArray(entries) && entries.length > 0) {
              // Validate entries have required structure
              const validatedEntries = entries.map(entry => ({
                id: entry.id || Date.now().toString(),
                type: entry.type || 'use',
                brand: entry.brand || '',
                series: entry.series || '',
                colour_number: entry.colour_number || '',
                colour_name: entry.colour_name || '',
                width: entry.width || '',
                length_yards: entry.length_yards || '',
                location: entry.location || '',
                transaction_date: entry.transaction_date || entry.purchase_date || entry.storage_date || entry.usage_date || getTodayString(),
                notes: entry.notes || '',
                job_ids: entry.job_ids || [DEFAULTS.EMPTY_JOB_ID],
                specific_vinyl_id: entry.specific_vinyl_id,
                submissionState: entry.submissionState || 'idle',
                submissionError: entry.submissionError
              }));
              setBulkEntries(validatedEntries);
              setIsInitialized(true);
              return;
            }
          }
        } catch (error) {
          console.error('Failed to load bulk entries from localStorage:', error);
        }
        
        // If no saved entries, create default entries
        const createDefaultEntries = (count = DEFAULTS.ENTRY_COUNT) => {
          return Array.from({ length: count }, (_, index) => createDefaultEntry(index));
        };
        setBulkEntries(createDefaultEntries());
        setIsInitialized(true);
        
      } catch (error) {
        console.error('Failed to get current user:', error);
        setCurrentUserId(null);
        setIsInitialized(true);
      }
    };

    initializeUser();
  }, []);

  // Load available orders
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const orders = await ordersApi.getOrders({ limit: DEFAULTS.RECENT_JOBS_LIMIT }) as OrderSuggestion[];
        setAvailableOrders(orders || []);
      } catch (error) {
        console.error('Failed to load orders:', error);
        setAvailableOrders([]);
      }
    };

    loadOrders();
  }, []);

  // Auto-save entries when they change (only after initialization)
  useEffect(() => {
    if (isInitialized && currentUserId !== null && bulkEntries.length > 0) {
      saveBulkEntries(bulkEntries);
    }
  }, [bulkEntries, currentUserId, isInitialized, saveBulkEntries]);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const addNewBulkEntry = () => {
    setBulkEntries(prev => [...prev, createDefaultEntry(0, generateId())]);
  };

  const updateBulkEntry = (id: string, updates: Partial<BulkEntry>) => {
    setBulkEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, ...updates } : entry
    ));
  };

  const removeBulkEntry = (id: string) => {
    if (bulkEntries.length > 1) {
      setBulkEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  const clearAllBulkEntries = () => {
    const createDefaultEntries = (count = DEFAULTS.ENTRY_COUNT) => {
      return Array.from({ length: count }, (_, index) => createDefaultEntry(index, generateId()));
    };
    setBulkEntries(createDefaultEntries());
    
    // Clear from localStorage
    try {
      localStorage.removeItem(getStorageKey());
    } catch (error) {
      console.error('Failed to clear bulk entries from localStorage:', error);
    }
  };

  const handleJobChange = (entryId: string, jobIndex: number, value: string) => {
    const entry = bulkEntries.find(e => e.id === entryId);
    if (!entry) return;

    const newJobIds = [...entry.job_ids];
    
    // Ensure array is long enough
    while (newJobIds.length <= jobIndex) newJobIds.push(DEFAULTS.EMPTY_JOB_ID);

    if (value.trim()) {
      // Convert to number for job_ids array (value is job_id from select)
      const jobId = parseInt(value);
      if (!isNaN(jobId)) {
        newJobIds[jobIndex] = jobId;
      }
    } else {
      // Clear the field
      newJobIds[jobIndex] = DEFAULTS.EMPTY_JOB_ID;
    }

    // Add empty job field if this is the last field and it's not empty
    if (jobIndex === newJobIds.length - 1 && value.trim()) {
      newJobIds.push(DEFAULTS.EMPTY_JOB_ID);
    }
    
    updateBulkEntry(entryId, { job_ids: newJobIds });
  };

  const removeJobField = (entryId: string, jobIndex: number) => {
    const entry = bulkEntries.find(e => e.id === entryId);
    if (!entry) return;

    const newJobIds = entry.job_ids.filter((_, index) => index !== jobIndex);
    
    // Ensure at least one empty field remains
    const finalJobIds = newJobIds.length > 0 ? newJobIds : [DEFAULTS.EMPTY_JOB_ID];
    
    updateBulkEntry(entryId, { job_ids: finalJobIds });
  };

  // Remove multiple entries by their IDs
  const removeBulkEntriesByIds = (idsToRemove: string[]) => {
    const remainingEntries = bulkEntries.filter(entry => 
      !idsToRemove.includes(entry.id)
    );
    
    if (remainingEntries.length === 0) {
      // If no entries remain, reset to single empty entry
      clearAllBulkEntries();
    } else {
      setBulkEntries(remainingEntries);
    }
  };

  // Update submission state for specific entries
  const updateSubmissionState = (entryId: string, state: 'idle' | 'submitting' | 'success' | 'error', error?: string) => {
    setBulkEntries(prev => prev.map(entry => 
      entry.id === entryId 
        ? { ...entry, submissionState: state, submissionError: error }
        : entry
    ));
  };

  // Update submission states for multiple entries
  const updateMultipleSubmissionStates = (updates: Array<{id: string, state: 'idle' | 'submitting' | 'success' | 'error', error?: string}>) => {
    setBulkEntries(prev => prev.map(entry => {
      const update = updates.find(u => u.id === entry.id);
      return update 
        ? { ...entry, submissionState: update.state, submissionError: update.error }
        : entry;
    }));
  };

  // Clear all entries marked as successful
  const clearSuccessfulEntries = () => {
    const remainingEntries = bulkEntries.filter(entry => 
      entry.submissionState !== 'success'
    );
    
    if (remainingEntries.length === 0) {
      clearAllBulkEntries();
    } else {
      setBulkEntries(remainingEntries);
    }
  };

  return {
    bulkEntries,
    setBulkEntries,
    availableOrders,
    currentUserId,
    isSaving,
    addNewBulkEntry,
    updateBulkEntry,
    removeBulkEntry,
    clearAllBulkEntries,
    removeBulkEntriesByIds,
    updateSubmissionState,
    updateMultipleSubmissionStates,
    clearSuccessfulEntries,
    handleJobChange,
    removeJobField,
    generateId
  };
};
