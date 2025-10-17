/**
 * Hook for auto-save functionality with debouncing
 *
 * Monitors unsaved changes and triggers auto-save after a debounce period.
 * Manages its own timeout ref and cleanup.
 */

import { useEffect, useRef } from 'react';
import { GridEngine } from '../core/GridEngine';

interface UseAutoSaveParams {
  hasUnsavedChanges: boolean;
  versioningMode: boolean;
  estimateId: number | undefined;
  isReadOnly: boolean;
  gridEngine: GridEngine;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

/**
 * Handles auto-save logic with 500ms debouncing.
 * Monitors hasUnsavedChanges and triggers save when conditions are met.
 *
 * @param params - Auto-save configuration parameters
 */
export const useAutoSave = ({
  hasUnsavedChanges,
  versioningMode,
  estimateId,
  isReadOnly,
  gridEngine,
  showNotification
}: UseAutoSaveParams): void => {
  // Auto-save trigger - missing piece from original working version
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Trigger auto-save when hasUnsavedChanges becomes true
    if (hasUnsavedChanges && versioningMode && estimateId && !isReadOnly) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set debounced auto-save (500ms delay)
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const coreData = gridEngine.getCoreData();
          await gridEngine.getConfig().autoSave?.onSave(coreData);
          gridEngine.markAsSaved();
        } catch (error) {
          console.error('Auto-save failed:', error);
          showNotification?.('Auto-save failed - your changes may not be saved!', 'error');
        }
      }, 500);
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, versioningMode, estimateId, isReadOnly, gridEngine, showNotification]);
};
