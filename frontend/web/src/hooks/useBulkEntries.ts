import { useState, useEffect } from 'react';
import { authApi, jobsApi } from '../services/api';

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
  supplier_id?: string;
  purchase_date?: string;
  storage_date?: string;
  usage_date?: string;
  notes?: string;
  job_ids: number[];  // Job associations using direct IDs
  source_vinyl_id?: string;
  specific_vinyl_id?: number;  // ID of specific vinyl piece selected
  // Submission state tracking
  submissionState?: 'idle' | 'submitting' | 'success' | 'error';
  submissionError?: string;
}

export const useBulkEntries = () => {
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get storage key for current user
  const getStorageKey = () => {
    return currentUserId ? `bulkEntries_${currentUserId}` : 'bulkEntries_guest';
  };

  // Save bulk entries to localStorage
  const saveBulkEntries = (entries: BulkEntry[]) => {
    setIsSaving(true);
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(entries));
      setTimeout(() => setIsSaving(false), 500); // Show saved indicator briefly
    } catch (error) {
      console.error('Failed to save bulk entries to localStorage:', error);
      setIsSaving(false);
    }
  };

  // Load bulk entries from localStorage
  const loadBulkEntries = (): BulkEntry[] => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const entries = JSON.parse(stored);
        // Validate entries have required structure
        if (Array.isArray(entries) && entries.length > 0) {
          return entries.map(entry => ({
            ...entry,
            // Ensure all required string fields exist
            id: entry.id || Date.now().toString(),
            type: entry.type || '',
            brand: entry.brand || '',
            series: entry.series || '',
            colour_number: entry.colour_number || '',
            colour_name: entry.colour_name || '',
            width: entry.width || '',
            length_yards: entry.length_yards || '',
            location: entry.location || '',
            supplier_id: entry.supplier_id || '',
            purchase_date: entry.purchase_date || new Date().toISOString().split('T')[0],
            storage_date: entry.storage_date || new Date().toISOString().split('T')[0],
            notes: entry.notes || '',
            job_ids: Array.isArray(entry.job_ids) ? entry.job_ids : [0]
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load bulk entries from localStorage:', error);
    }
    
    // Return 10 default entries if nothing loaded
    return Array.from({ length: 10 }, (_, index) => ({
      id: (Date.now() + index).toString(),
      type: '' as any,
      brand: '',
      series: '',
      colour_number: '',
      colour_name: '',
      width: '',
      length_yards: '',
      location: '',
      supplier_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      storage_date: new Date().toISOString().split('T')[0],
      notes: '',
      job_ids: [0] // 0 represents empty/unselected
    }));
  };

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
                type: entry.type || '',
                brand: entry.brand || '',
                series: entry.series || '',
                colour_number: entry.colour_number || '',
                colour_name: entry.colour_name || '',
                width: entry.width || '',
                length_yards: entry.length_yards || '',
                location: entry.location || '',
                supplier_id: entry.supplier_id || '',
                purchase_date: entry.purchase_date || new Date().toISOString().split('T')[0],
                storage_date: entry.storage_date || new Date().toISOString().split('T')[0],
                notes: entry.notes || '',
                job_ids: entry.job_ids || [0],
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
        
        // If no saved entries, create 10 default entries
        const createDefaultEntries = (count = 10) => {
          return Array.from({ length: count }, (_, index) => ({
            id: (Date.now() + index).toString(),
            type: '' as any,
            brand: '',
            series: '',
            colour_number: '',
            colour_name: '',
            width: '',
            length_yards: '',
            location: '',
            supplier_id: '',
            purchase_date: new Date().toISOString().split('T')[0],
            storage_date: new Date().toISOString().split('T')[0],
            notes: '',
            job_ids: [0] // 0 represents empty/unselected
          }));
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

  // Load available jobs
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const jobs = await jobsApi.getRecentJobs(50);
        setAvailableJobs(jobs);
      } catch (error) {
        console.error('Failed to load jobs:', error);
        setAvailableJobs([]);
      }
    };

    loadJobs();
  }, []);

  // Auto-save entries when they change (only after initialization)
  useEffect(() => {
    if (isInitialized && currentUserId !== null && bulkEntries.length > 0) {
      saveBulkEntries(bulkEntries);
    }
  }, [bulkEntries, currentUserId, isInitialized]);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const addNewBulkEntry = () => {
    const newEntry: BulkEntry = {
      id: generateId(),
      type: '' as any, // Force user to select type
      brand: '',
      series: '',
      colour_number: '',
      colour_name: '',
      width: '',
      length_yards: '',
      location: '',
      supplier_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      storage_date: new Date().toISOString().split('T')[0],
      usage_date: new Date().toISOString().split('T')[0],
      notes: '',
      job_ids: [0] // 0 represents empty/unselected
    };
    setBulkEntries(prev => [...prev, newEntry]);
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
    const createDefaultEntries = (count = 10) => {
      return Array.from({ length: count }, (_, index) => ({
        id: generateId() + index,
        type: '' as any,
        brand: '',
        series: '',
        colour_number: '',
        colour_name: '',
        width: '',
        length_yards: '',
        location: '',
        supplier_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        storage_date: new Date().toISOString().split('T')[0],
        notes: '',
        job_ids: [0] // 0 represents empty/unselected
      }));
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
    while (newJobIds.length <= jobIndex) newJobIds.push(0);
    
    if (value.trim()) {
      // Convert to number for job_ids array (value is job_id from select)
      const jobId = parseInt(value);
      if (!isNaN(jobId)) {
        newJobIds[jobIndex] = jobId;
      }
    } else {
      // Clear the field
      newJobIds[jobIndex] = 0;
    }
    
    // Add empty job field if this is the last field and it's not empty
    if (jobIndex === newJobIds.length - 1 && value.trim()) {
      newJobIds.push(0);
    }
    
    updateBulkEntry(entryId, { job_ids: newJobIds });
  };

  const removeJobField = (entryId: string, jobIndex: number) => {
    const entry = bulkEntries.find(e => e.id === entryId);
    if (!entry) return;

    const newJobIds = entry.job_ids.filter((_, index) => index !== jobIndex);
    
    // Ensure at least one empty field remains
    const finalJobIds = newJobIds.length > 0 ? newJobIds : [0];
    
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
    availableJobs,
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