import { jobVersioningApi } from '../../../services/api';
import { GridState } from '../hooks/useSimpleGridState';

export interface AutoSaveConfig {
  debounceMs: number;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  isDragCalculatingRef?: React.MutableRefObject<boolean>;  // PHASE 3: Drag state awareness
}

export const createAutoSaveUtils = (
  gridState: GridState,
  config: AutoSaveConfig
) => {
  
  // Perform the actual auto-save - uses refs for current values (from original working version)
  const performAutoSave = async (): Promise<void> => {
    const currentEstimateId = gridState.estimateIdRef.current;
    const currentHasUnsavedChanges = gridState.hasUnsavedChangesRef.current;
    const currentRows = gridState.rowsRef.current;
    
    if (!currentEstimateId || !currentHasUnsavedChanges || gridState.isUnloadingRef.current) {
      return;
    }
    
    try {
      gridState.setSaving(true);
      
      // ✅ VALIDATION IS INFORMATIONAL: Save proceeds regardless of validation errors
      // Validation blocks calculations, not saves - database accepts string values
      
      // Phase 4: Filter out rows without productTypeId - unified system
      const validRows = currentRows.filter(row => {
        // All rows need productTypeId in unified system
        return row.productTypeId && row.productTypeId > 0;
      });
      
      
      await jobVersioningApi.saveGridData(currentEstimateId, validRows);
      // Save API call successful
      
      gridState.setHasUnsavedChanges(false);
      gridState.setLastSaved(new Date());
      gridState.setCurrentEstimate({ ...gridState.currentEstimateRef.current, hasUnsavedChanges: false });
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      config.showNotification?.('Auto-save failed - your changes may not be saved!', 'error');
    } finally {
      gridState.setSaving(false);
    }
  };

  // Manual save function that bypasses debouncing (from original working version)
  const performManualSave = async (estimateId?: number): Promise<void> => {
    if (!estimateId || !gridState.hasUnsavedChanges) return;
    
    try {
      gridState.setSaving(true);
      await jobVersioningApi.saveDraft(estimateId);
      gridState.setHasUnsavedChanges(false);
      gridState.setLastSaved(new Date());
      gridState.setCurrentEstimate({ ...gridState.currentEstimate, hasUnsavedChanges: false });
    } catch (error) {
      console.error('❌ Manual save failed:', error);
      throw error; // Re-throw for manual saves so user sees the error
    } finally {
      gridState.setSaving(false);
    }
  };

  // PHASE 3 OPTIMIZATION: Debounced auto-save with drag state awareness
  const debouncedAutoSave = (): void => {
    // Skip auto-save entirely during drag operations
    if (config.isDragCalculatingRef?.current) {
      return;
    }
    
    // Clear existing timeout
    if (gridState.autoSaveTimeoutRef.current) {
      clearTimeout(gridState.autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    gridState.autoSaveTimeoutRef.current = setTimeout(() => {
      // Skip if drag started after timeout was set
      if (config.isDragCalculatingRef?.current) {
        return;
      }
      
      // Use refs to access current values, avoiding stale closures
      // Autosave conditions check
      
      if (gridState.versioningModeRef.current && 
          gridState.estimateIdRef.current && 
          gridState.hasUnsavedChangesRef.current && 
          gridState.currentEstimateRef.current?.is_draft) {
        // Performing autosave...
        performAutoSave();
      } else {
      }
    }, config.debounceMs);
  };

  // PHASE 3 OPTIMIZATION: Mark estimate changed with drag state awareness
  const markEstimateChanged = (
    onEstimateChange?: (estimate: any) => void
  ): void => {
    if (gridState.currentEstimate && !gridState.effectiveReadOnly) {
      const updatedEstimate = { ...gridState.currentEstimate, hasUnsavedChanges: true };
      gridState.setCurrentEstimate(updatedEstimate);
      gridState.setHasUnsavedChanges(true);
      onEstimateChange?.(updatedEstimate);
      
      // Trigger debounced auto-save (will be skipped if drag is active)
      debouncedAutoSave();
    }
  };

  return {
    performAutoSave,
    performManualSave,
    debouncedAutoSave,
    markEstimateChanged
  };
};