/**
 * Hook for loading initial grid data from the backend
 *
 * CRITICAL: Must wait for templatesLoaded before loading data to ensure
 * proper validation and field configuration.
 */

import { useEffect } from 'react';
import { GridEngine } from '../core/GridEngine';
import { jobVersioningApi } from '../../../services/jobVersioningApi';

interface UseGridDataLoaderParams {
  templatesLoaded: boolean;
  estimateId: number | undefined;
  gridEngine: GridEngine;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

/**
 * Loads initial grid data when templates are ready.
 * Handles both new estimates (empty grid) and existing estimates (load from backend).
 *
 * IMPORTANT: Does NOT mark data as dirty during initial load to prevent auto-save triggers.
 *
 * @param params - Data loader configuration
 */
export const useGridDataLoader = ({
  templatesLoaded,
  estimateId,
  gridEngine,
  showNotification
}: UseGridDataLoaderParams): void => {
  // Load initial data - wait for templates to be loaded first
  useEffect(() => {
    const loadData = async () => {
      if (!templatesLoaded) {
        return; // Wait for templates to be loaded
      }

      if (!estimateId) {
        // No estimate ID - initialize with empty row
        const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
        gridEngine.updateCoreData([emptyRow]);
        return;
      }

      try {
        // Load from grid-data API
        const response = await jobVersioningApi.loadGridData(estimateId);
        const savedRows = response.data || [];

        if (savedRows.length > 0) {
          // Backend already provides data in correct GridRowCore format
          const coreRows = savedRows.map((row: any, index: number) => ({
            id: row.id || `row-${index + 1}`, // Use backend ID if available
            rowType: row.rowType || 'main', // Restore saved row type
            productTypeId: row.productTypeId,
            productTypeName: row.productTypeName,
            data: row.data || {}, // Use the data object as-is from backend
            parentProductId: row.parentProductId || undefined,
            // Include other backend metadata fields
            dbId: row.dbId,
            itemIndex: row.itemIndex,
            assemblyId: row.assemblyId,
            fieldConfig: row.fieldConfig || [],
            isMainRow: row.isMainRow,
            indent: row.indent || 0
          }));

          // Templates are already loaded and cached - no need for individual loading

          // Set the grid data immediately (don't mark as dirty during initial load)
          gridEngine.updateCoreData(coreRows, { markAsDirty: false });

          // Then trigger product type processing for each row to handle sub-item conversion (don't mark as dirty during initial load)
          coreRows.forEach((row: any) => {
            if (row.productTypeId && row.productTypeName) {
              gridEngine.updateRowProductType(row.id, row.productTypeId, row.productTypeName, { markAsDirty: false });
            }
          });
        } else {
          // No data found - initialize with empty row (don't mark as dirty during initial load)
          const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
          gridEngine.updateCoreData([emptyRow], { markAsDirty: false });
        }
      } catch (error) {
        console.error('Failed to load estimate data:', error);
        // Don't create fallback data - show error to user instead
        // This prevents auto-save from potentially overwriting real data
        if (showNotification) {
          showNotification('Failed to load estimate data. Please refresh the page.', 'error');
        }
        // Leave grid empty rather than risk overwriting data
      }
    };

    loadData();
  }, [estimateId, gridEngine, templatesLoaded]); // Include templatesLoaded to trigger reload when templates are ready
};
