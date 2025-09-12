import { flushSync } from 'react-dom';
import { useRef } from 'react';
import { EstimateRow } from '../types';

/**
 * Batch State Manager - Phase 2B Optimization
 * 
 * Reduces function calls from 6-10 per field blur to 1-2 by batching
 * state updates and running side effects in parallel.
 */

export interface BatchedUpdate {
  // State updates (applied atomically)
  rows?: EstimateRow[];
  validationErrors?: Record<string, Record<string, string[]>>;
  hasUnsavedChanges?: boolean;
  fieldBlurStates?: Record<string, Record<string, boolean>>;
  lastSaved?: Date | null;
  
  // Side effect triggers (run in parallel after state updates)
  triggers?: Array<'validation' | 'autosave' | 'preview' | 'notification'>;
  
  // Metadata for side effects
  metadata?: {
    rowId?: string;
    fieldName?: string;
    estimateChange?: any;
    notificationMessage?: string;
    notificationType?: 'success' | 'error';
  };
}

export interface BatchStateConfig {
  // State setters
  setRows: (rows: EstimateRow[]) => void;
  setValidationErrors: (errors: Record<string, Record<string, string[]>>) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setFieldBlurStates: (states: Record<string, Record<string, boolean>>) => void;
  setLastSaved: (date: Date | null) => void;
  
  // Side effect handlers
  onValidationChange?: (hasErrors: boolean) => void;
  onEstimateChange?: (estimate: any) => void;
  debouncedAutoSave?: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  
  // Validation function
  runValidation?: (rowId?: string, fieldName?: string) => Promise<Record<string, Record<string, string[]>>>;
}

/**
 * Create a batch state manager for optimized grid updates
 */
export const createBatchStateManager = (config: BatchStateConfig) => {
  
  /**
   * Apply batched state updates atomically and trigger side effects in parallel
   * 
   * @param updates The batched updates to apply
   * @returns Promise that resolves when all operations complete
   */
  const batchUpdate = async (updates: BatchedUpdate): Promise<void> => {
    // Phase 1: Apply all state updates atomically using flushSync
    flushSync(() => {
      if (updates.rows !== undefined) {
        config.setRows(updates.rows);
      }
      if (updates.validationErrors !== undefined) {
        config.setValidationErrors(updates.validationErrors);
      }
      if (updates.hasUnsavedChanges !== undefined) {
        config.setHasUnsavedChanges(updates.hasUnsavedChanges);
      }
      if (updates.fieldBlurStates !== undefined) {
        config.setFieldBlurStates(updates.fieldBlurStates);
      }
      if (updates.lastSaved !== undefined) {
        config.setLastSaved(updates.lastSaved);
      }
    });
    
    // Phase 2: Run side effects in parallel (non-blocking)
    if (updates.triggers && updates.triggers.length > 0) {
      const sideEffectPromises = updates.triggers.map(async (trigger) => {
        try {
          switch (trigger) {
            case 'validation':
              if (config.runValidation) {
                const validationErrors = await config.runValidation(
                  updates.metadata?.rowId,
                  updates.metadata?.fieldName
                );
                // Apply validation results in next batch if errors found
                if (Object.keys(validationErrors).length > 0) {
                  flushSync(() => config.setValidationErrors(validationErrors));
                }
                // Notify parent of validation changes
                if (config.onValidationChange) {
                  config.onValidationChange(Object.keys(validationErrors).length > 0);
                }
              }
              break;
              
            case 'autosave':
              if (config.debouncedAutoSave) {
                config.debouncedAutoSave();
              }
              break;
              
            case 'preview':
              if (config.onEstimateChange && updates.metadata?.estimateChange) {
                config.onEstimateChange(updates.metadata.estimateChange);
              }
              break;
              
            case 'notification':
              if (config.showNotification && updates.metadata?.notificationMessage) {
                config.showNotification(
                  updates.metadata.notificationMessage,
                  updates.metadata.notificationType
                );
              }
              break;
          }
        } catch (error) {
          console.error(`Batch side effect error (${trigger}):`, error);
        }
      });
      
      // Run all side effects concurrently
      await Promise.allSettled(sideEffectPromises);
    }
  };
  
  /**
   * Optimized field commit that batches all related updates
   * 
   * @param rowId The row being modified
   * @param fieldName The field being modified  
   * @param newRows The updated rows array
   * @param estimateChange Optional estimate change for preview
   */
  const batchFieldCommit = async (
    rowId: string,
    fieldName: string,
    newRows: EstimateRow[],
    estimateChange?: any
  ): Promise<void> => {
    // Create batched update with all necessary changes
    const batchedUpdate: BatchedUpdate = {
      // State updates
      rows: newRows,
      hasUnsavedChanges: true,
      fieldBlurStates: {
        [rowId]: {
          [fieldName]: true
        }
      },
      
      // Side effects to run in parallel
      triggers: ['validation', 'autosave'],
      
      // Metadata for side effects
      metadata: {
        rowId,
        fieldName,
        estimateChange
      }
    };
    
    // Add preview trigger if estimate change provided
    if (estimateChange) {
      batchedUpdate.triggers!.push('preview');
    }
    
    await batchUpdate(batchedUpdate);
  };
  
  /**
   * Optimized row operation (insert/delete) that batches all updates
   */
  const batchRowOperation = async (
    newRows: EstimateRow[],
    operationType: 'insert' | 'delete',
    notificationMessage?: string
  ): Promise<void> => {
    const batchedUpdate: BatchedUpdate = {
      rows: newRows,
      hasUnsavedChanges: true,
      triggers: ['autosave'],
      metadata: {
        notificationMessage,
        notificationType: 'success' as const
      }
    };
    
    // Add notification trigger if message provided
    if (notificationMessage) {
      batchedUpdate.triggers!.push('notification');
    }
    
    await batchUpdate(batchedUpdate);
  };
  
  return {
    batchUpdate,
    batchFieldCommit,
    batchRowOperation
  };
};

/**
 * Hook for creating a memoized batch state manager
 * Prevents recreation on every render
 */

export const useBatchStateManager = (config: BatchStateConfig) => {
  // Use a ref to maintain stable reference
  const managerRef = useRef<ReturnType<typeof createBatchStateManager> | null>(null);
  
  if (!managerRef.current) {
    managerRef.current = createBatchStateManager(config);
  }
  
  return managerRef.current;
};