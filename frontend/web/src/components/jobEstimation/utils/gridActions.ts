import { jobEstimationApi } from '../../../services/jobEstimationApi';
import { jobVersioningApi } from '../../../services/jobVersioningApi';
import { createEmptyProductRow } from './rowUtils';
import { EstimateRow, EditLockStatus } from '../types';
import { GridState } from '../hooks/useSimpleGridState';

export interface GridActionsConfig {
  user: any;
  estimate: any;
  isCreatingNew: boolean;
  versioningMode: boolean;
  estimateId?: number;
  onEstimateChange?: (estimate: any) => void;
  onBackToEstimates?: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

// Match the existing GridActions interface exactly
export interface GridActions {
  // Data loading actions
  loadInitialData: () => Promise<void>;
  loadExistingEstimateData: (estimateId: number) => Promise<void>;
  reloadCurrentEstimate: () => Promise<void>;
  reloadAfterDrag: () => Promise<void>;
  
  // Auto-save actions
  performAutoSave: () => Promise<void>;
  performManualSave: () => Promise<void>;
  performDragSave: () => Promise<void>;
  debouncedAutoSave: () => void;
  markEstimateChanged: () => void;
  
  // Edit lock actions
  handleLockAcquired: (status: EditLockStatus) => void;
  handleLockConflict: (status: EditLockStatus) => void;
  handleOverrideLock: () => Promise<void>;
  handleViewReadOnly: () => void;
  
  // Estimate actions
  handleSaveDraft: () => Promise<void>;
  handleFinalize: (status: string) => void;
  handleStatusChange: (action: string) => Promise<void>;
  
  // Navigation actions
  handleRequestNavigation: (navigationFn?: (() => void) | null) => void;
  
  // Table actions
  handleClearTable: () => void;
  handleShowClearAll: () => void;
  handleShowClearEmpty: () => void;
  handleClearAllRows: () => Promise<void>;
  handleClearEmpty: () => Promise<void>;
  confirmClearTable: () => Promise<void>;
  confirmClearAll: () => Promise<void>;
  confirmClearEmpty: () => Promise<void>;
  cancelClearTable: () => void;
  handleRowsReorder: (newRows: EstimateRow[]) => void;
}

export const createGridActions = (
  gridState: GridState,
  config: GridActionsConfig
): GridActions => {

  // Data loading actions (from original working version)
  const loadInitialData = async (): Promise<void> => {
    try {
      gridState.setLoading(true);
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('❌ GridJobBuilder: No authentication token found');
        config.showNotification?.('Please log in to access job estimation', 'error');
        return;
      }

      const [customersRes, productTypesRes] = await Promise.all([
        jobEstimationApi.getCustomers(),
        jobEstimationApi.getProductTypes(),
      ]);

      const processedCustomers = Array.isArray(customersRes?.customers) ? customersRes.customers : [];
      const allProductTypes = Array.isArray(productTypesRes?.data?.data) ? productTypesRes.data.data : [];
      
      // Use all product types from database - no filtering needed
      const processedProductTypes = allProductTypes;

      gridState.setCustomers(processedCustomers);
      gridState.setProductTypes(processedProductTypes);

      // Database-first template creation handles this automatically

      // Initialize estimate if creating new
      if (config.isCreatingNew && !gridState.currentEstimate) {
        const tempId = `temp-estimate-${Date.now()}`;
        const newEstimate = {
          id: tempId,
          job_code: '',
          customer_id: null,
          estimate_name: '',
          status: 'draft',
          subtotal: 0,
          tax_amount: 0,
          total_amount: 0,
          isTemporary: true,
          hasUnsavedChanges: false
        };
        gridState.setCurrentEstimate(newEstimate);
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      config.showNotification?.('Failed to load initial data', 'error');
    } finally {
      gridState.setLoading(false);
    }
  };

  // Load existing estimate data and convert to grid rows (from original working version)
  const loadExistingEstimateData = async (estimateId: number, forceReload: boolean = false): Promise<void> => {
    try {
      // Skip loading if we already have unsaved changes - don't reset user input
      // UNLESS forceReload is true (for clear operations that should always reload)
      if (gridState.hasUnsavedChanges && !forceReload) {
        return;
      }
      
      // Load grid data from database (includes template rows created by backend)
      const gridResponse = await jobVersioningApi.loadGridData(estimateId);
      
      if (gridResponse.success && gridResponse.data && gridResponse.data.length > 0) {
        
        
        // ✅ HOTFIX: Extract dbId from id field if missing
        const processedData = gridResponse.data.map((row: any) => {
          if (!row.dbId && row.id && row.id.startsWith('item-')) {
            const extractedDbId = parseInt(row.id.replace('item-', ''));
            return { ...row, dbId: extractedDbId };
          }
          return row;
        });
        
        gridState.setRows(processedData);
        
        // Clear unsaved changes flag when force reloading (data is now fresh from backend)
        if (forceReload) {
          gridState.setHasUnsavedChanges(false);
          gridState.setValidationErrors({});
        }
      } else {
      }
    } catch (error) {
      console.error('Error loading estimate data:', error);
      config.showNotification?.('Failed to load estimate data', 'error');
    }
  };




  // Versioning system handlers (from original working version)
  const handleLockAcquired = (status: EditLockStatus): void => {
    gridState.setLockStatus(status);
    gridState.setShowLockConflict(false);
    gridState.setEffectiveReadOnly(false);
  };

  const handleLockConflict = (status: EditLockStatus): void => {
    gridState.setLockStatus(status);
    gridState.setShowLockConflict(true);
  };

  const handleOverrideLock = async (): Promise<void> => {
    try {
      if (config.estimateId && config.user) {
        const response = await jobVersioningApi.overrideEditLock(config.estimateId, config.user.user_id);
        if (response.success) {
          gridState.setShowLockConflict(false);
          gridState.setEffectiveReadOnly(false);
          config.showNotification?.('Edit lock override successful', 'success');
        }
      }
    } catch (error) {
      console.error('Failed to override lock:', error);
      config.showNotification?.('Failed to override edit lock', 'error');
    }
  };

  const handleViewReadOnly = (): void => {
    gridState.setShowLockConflict(false);
    gridState.setEffectiveReadOnly(true);
  };

  // Navigation guard function (from original working version)
  const handleRequestNavigation = (navigationFn?: (() => void) | null): void => {
    if (typeof navigationFn !== 'function') {
      return;
    }
    
    if (gridState.hasUnsavedChanges && !gridState.effectiveReadOnly) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave? Your changes will be lost.')) {
        gridState.setHasUnsavedChanges(false);
        navigationFn();
      }
    } else {
      navigationFn();
    }
  };

  // Table actions
  const handleClearTable = (): void => {
    gridState.setClearModalType('reset');
    gridState.setShowClearConfirmation(true);
  };

  const handleShowClearAll = (): void => {
    gridState.setClearModalType('clearAll');
    gridState.setShowClearConfirmation(true);
  };

  const handleShowClearEmpty = (): void => {
    gridState.setClearModalType('clearEmpty');
    gridState.setShowClearConfirmation(true);
  };

  const confirmClearTable = async (): Promise<void> => {
    gridState.setShowClearConfirmation(false);
    gridState.setClearModalType(null);
    
    // If in versioning mode with an estimate ID, call backend to clear and recreate template
    if (config.versioningMode && config.estimateId) {
      try {
        gridState.setLoading(true);
        
        // Call backend to reset all items and recreate template
        await jobVersioningApi.resetEstimateItems(config.estimateId);
        
        // Force reload data from database (bypass unsaved changes guard)
        await loadExistingEstimateData(config.estimateId, true);
        
        config.showNotification?.('Grid reset to default template', 'success');
        
      } catch (error) {
        console.error('Error resetting estimate items:', error);
        config.showNotification?.('Failed to reset grid. Please try again.', 'error');
      } finally {
        gridState.setLoading(false);
      }
    } else {
      // Non-versioning mode: This shouldn't happen in production
      config.showNotification?.('Reset requires estimate to be saved first', 'error');
    }
  };

  const confirmClearAll = async (): Promise<void> => {
    gridState.setShowClearConfirmation(false);
    gridState.setClearModalType(null);
    
    if (config.versioningMode && config.estimateId) {
      try {
        gridState.setLoading(true);
        
        // Call backend to clear all items
        await jobVersioningApi.clearAllEstimateItems(config.estimateId);
        
        // Force reload data from database (bypass unsaved changes guard)
        await loadExistingEstimateData(config.estimateId, true);
        
        config.showNotification?.('All items deleted', 'success');
        
      } catch (error) {
        console.error('Error clearing all estimate items:', error);
        config.showNotification?.('Failed to clear all items. Please try again.', 'error');
      } finally {
        gridState.setLoading(false);
      }
    } else {
      config.showNotification?.('Clear All requires estimate to be saved first', 'error');
    }
  };

  const confirmClearEmpty = async (): Promise<void> => {
    gridState.setShowClearConfirmation(false);
    gridState.setClearModalType(null);
    
    if (config.versioningMode && config.estimateId) {
      try {
        gridState.setLoading(true);
        
        // Call backend to clear empty items
        await jobVersioningApi.clearEmptyItems(config.estimateId);
        
        // Force reload data from database (bypass unsaved changes guard)
        await loadExistingEstimateData(config.estimateId, true);
        
        config.showNotification?.('Empty rows removed', 'success');
        
      } catch (error) {
        console.error('Error clearing empty items:', error);
        config.showNotification?.('Failed to clear empty rows. Please try again.', 'error');
      } finally {
        gridState.setLoading(false);
      }
    } else {
      config.showNotification?.('Clear Empty requires estimate to be saved first', 'error');
    }
  };

  const cancelClearTable = (): void => {
    gridState.setShowClearConfirmation(false);
    gridState.setClearModalType(null);
  };

  const handleClearAllRows = async (): Promise<void> => {
    if (config.versioningMode && config.estimateId) {
      try {
        gridState.setLoading(true);
        
        // Call backend to clear all items
        await jobVersioningApi.clearAllEstimateItems(config.estimateId);
        
        // Force reload data from database (bypass unsaved changes guard)
        await loadExistingEstimateData(config.estimateId, true);
        
        config.showNotification?.('All items deleted', 'success');
        
      } catch (error) {
        console.error('Error clearing all estimate items:', error);
        config.showNotification?.('Failed to clear all items. Please try again.', 'error');
      } finally {
        gridState.setLoading(false);
      }
    } else {
      config.showNotification?.('Clear All requires estimate to be saved first', 'error');
    }
  };

  const handleClearEmpty = async (): Promise<void> => {
    if (config.versioningMode && config.estimateId) {
      try {
        gridState.setLoading(true);
        
        // Call backend to clear empty items
        await jobVersioningApi.clearEmptyItems(config.estimateId);
        
        // Force reload data from database (bypass unsaved changes guard)
        await loadExistingEstimateData(config.estimateId, true);
        
        config.showNotification?.('Empty rows removed', 'success');
        
      } catch (error) {
        console.error('Error clearing empty items:', error);
        config.showNotification?.('Failed to clear empty rows. Please try again.', 'error');
      } finally {
        gridState.setLoading(false);
      }
    } else {
      config.showNotification?.('Clear Empty requires estimate to be saved first', 'error');
    }
  };

  const handleRowsReorder = (newRows: EstimateRow[]): void => {
    // Apply parent assignment validation to ensure sub-items have correct parents
    const { updateParentAssignments } = require('./parentAssignmentUtils');
    const validatedRows = updateParentAssignments(newRows);
    
    gridState.setRows(validatedRows);
    gridState.setHasUnsavedChanges(true);
  };

  // Auto-save actions - complete implementations merged from enhanced hook version
  const performAutoSave = async (): Promise<void> => {
    const currentEstimateId = gridState.estimateIdRef.current;
    const currentHasUnsavedChanges = gridState.hasUnsavedChangesRef.current;
    const currentRows = gridState.rowsRef.current;
    
    if (!currentEstimateId || !currentHasUnsavedChanges || gridState.isUnloadingRef.current) {
      return;
    }
    
    try {
      gridState.setSaving(true);
      
      // Phase 4: Filter out rows without productTypeId - unified system
      const validRows = currentRows.filter(row => {
        // All rows need productTypeId in unified system
        return row.productTypeId && row.productTypeId > 0;
      });
      
      
      await jobVersioningApi.saveGridData(currentEstimateId, validRows);
      
      gridState.setHasUnsavedChanges(false);
      gridState.setLastSaved(new Date());
      gridState.setCurrentEstimate(prev => ({ ...prev, hasUnsavedChanges: false }));
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      // Show notification for debugging - user needs to know saves are failing
      config.showNotification?.('Auto-save failed - your changes may not be saved!', 'error');
    } finally {
      gridState.setSaving(false);
    }
  };

  const performManualSave = async (): Promise<void> => {
    if (!config.estimateId || !gridState.hasUnsavedChanges) return;
    
    try {
      gridState.setSaving(true);
      await jobVersioningApi.saveDraft(config.estimateId);
      gridState.setHasUnsavedChanges(false);
      gridState.setLastSaved(new Date());
      gridState.setCurrentEstimate(prev => ({ ...prev, hasUnsavedChanges: false }));
    } catch (error) {
      console.error('❌ Manual save failed:', error);
      throw error; // Re-throw for manual saves so user sees the error
    } finally {
      gridState.setSaving(false);
    }
  };

  const debouncedAutoSave = (): void => {
    // Clear existing timeout
    if (gridState.autoSaveTimeoutRef.current) {
      clearTimeout(gridState.autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save (500ms delay)
    gridState.autoSaveTimeoutRef.current = setTimeout(() => {
      // Use refs to access current values, avoiding stale closures
      if (gridState.versioningModeRef.current && 
          gridState.estimateIdRef.current && 
          gridState.hasUnsavedChangesRef.current && 
          gridState.currentEstimateRef.current?.is_draft) {
        performAutoSave();
      }
    }, 500);
  };

  const markEstimateChanged = (): void => {
    if (gridState.currentEstimate && !gridState.effectiveReadOnly) {
      const updatedEstimate = { ...gridState.currentEstimate, hasUnsavedChanges: true };
      gridState.setCurrentEstimate(updatedEstimate);
      gridState.setHasUnsavedChanges(true);
      config.onEstimateChange?.(updatedEstimate);
      
      // Trigger debounced auto-save
      debouncedAutoSave();
    }
  };

  // Estimate actions - complete implementations merged from hook version
  const handleSaveDraft = async (): Promise<void> => {
    try {
      await performManualSave();
      config.showNotification?.('Draft saved successfully');
    } catch (error) {
      config.showNotification?.('Failed to save draft', 'error');
    }
  };

  const handleFinalize = (status: string): void => {
    config.showNotification?.(`Estimate finalized as ${status}`);
    config.onBackToEstimates?.();
  };

  const handleStatusChange = async (action: string): Promise<void> => {
    config.showNotification?.(`Status updated: ${action}`);
    
    // Refresh the estimate data to reflect status changes
    if (config.versioningMode && config.estimateId) {
      try {
        // Use job_id from either currentEstimate or original estimate
        const jobId = gridState.currentEstimate?.job_id || config.estimate?.job_id;
        
        if (!jobId) {
          console.error('No job_id available for refreshing estimate data');
          return;
        }
        
        // Get fresh estimate data after status change
        const response = await jobVersioningApi.getEstimateVersions(jobId);
        const updatedEstimate = response.data.find((est: any) => est.id === config.estimateId);
        
        if (updatedEstimate) {
          gridState.setCurrentEstimate(updatedEstimate);
          
          // Also notify parent component about the change (updates breadcrumb)
          if (config.onEstimateChange) {
            config.onEstimateChange(updatedEstimate);
          }
        }
      } catch (error) {
        console.error('Error refreshing estimate data:', error);
      }
    }
  };

  // Wrapper function for reloading current estimate without parameters
  const reloadCurrentEstimate = async (): Promise<void> => {
    if (config.estimateId) {
      await loadExistingEstimateData(config.estimateId);
    } else {
    }
  };

  // Special reload function for drag operations that bypasses hasUnsavedChanges check
  const reloadAfterDrag = async (): Promise<void> => {
    if (!config.estimateId) {
      return;
    }

    try {
      
      // Force reload regardless of hasUnsavedChanges state
      const gridResponse = await jobVersioningApi.loadGridData(config.estimateId);
      
      if (gridResponse.success && gridResponse.data && gridResponse.data.length > 0) {
        gridState.setRows(gridResponse.data);
      } else {
      }
    } catch (error) {
      console.error('❌ DRAG RELOAD: Failed:', error);
      throw error;
    }
  };

  // Special save function for drag operations that properly manages hasUnsavedChanges
  const performDragSave = async (): Promise<void> => {
    if (!config.estimateId) {
      return;
    }

    try {
      // Use the regular auto-save logic but ensure state is properly managed
      gridState.setSaving(true);
      
      const currentRows = gridState.rowsRef.current;
      const validRows = currentRows.filter(row => {
        // Unified system - all rows need productTypeId
        return row.productTypeId && row.productTypeId > 0;
      });

      await jobVersioningApi.saveGridData(config.estimateId, validRows);
      
      // Clear the unsaved changes flag immediately after save
      gridState.setHasUnsavedChanges(false);
      gridState.setLastSaved(new Date());
      
    } catch (error) {
      console.error('❌ DRAG SAVE: Failed:', error);
      throw error;
    } finally {
      gridState.setSaving(false);
    }
  };

  return {
    // Data loading
    loadInitialData,
    loadExistingEstimateData,
    reloadCurrentEstimate,
    reloadAfterDrag,
    
    // Auto-save actions
    performAutoSave,
    performManualSave,
    performDragSave,
    debouncedAutoSave,
    markEstimateChanged,
    
    // Lock system
    handleLockAcquired,
    handleLockConflict,
    handleOverrideLock,
    handleViewReadOnly,
    
    // Estimate actions
    handleSaveDraft,
    handleFinalize,
    handleStatusChange,
    
    // Navigation
    handleRequestNavigation,
    
    // Table actions
    handleClearTable,
    handleShowClearAll,
    handleShowClearEmpty,
    handleClearAllRows,
    handleClearEmpty,
    confirmClearTable,
    confirmClearAll,
    confirmClearEmpty,
    cancelClearTable,
    handleRowsReorder
  };
};