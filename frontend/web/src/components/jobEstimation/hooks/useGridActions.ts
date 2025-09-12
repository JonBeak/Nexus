import { useMemo } from 'react';
import { createGridActions, GridActions, GridActionsConfig } from '../utils/gridActions';
import { GridState } from './useSimpleGridState';

// Re-export the interface from the factory version for backward compatibility
export type { GridActions };

/**
 * React Hook wrapper for GridActions factory function
 * 
 * This provides React optimization (memoization) while maintaining the factory pattern
 * as the single source of truth for all business logic.
 * 
 * Benefits:
 * - Single source of truth (factory function)
 * - React performance optimization (useMemo)
 * - Clean parameter interface for React components
 * - Maintains backward compatibility for existing components
 */
export const useGridActions = (
  gridState: GridState,
  user: any,
  estimate: any,
  isCreatingNew: boolean,
  versioningMode: boolean,
  estimateId?: number,
  onEstimateChange?: (estimate: any) => void,
  onBackToEstimates?: () => void,
  showNotification?: (message: string, type?: 'success' | 'error') => void
): GridActions => {
  
  // Create config object for factory function
  const config: GridActionsConfig = useMemo(() => ({
    user,
    estimate,
    isCreatingNew,
    versioningMode,
    estimateId,
    onEstimateChange,
    onBackToEstimates,
    showNotification
  }), [
    user?.id,
    estimate?.id,
    isCreatingNew,
    versioningMode,
    estimateId,
    onEstimateChange,
    onBackToEstimates,
    showNotification
  ]);
  
  // Return memoized factory function call
  // This provides React optimization while maintaining factory pattern as source of truth
  return useMemo(() => {
    return createGridActions(gridState, config);
  }, [gridState, config]);
};