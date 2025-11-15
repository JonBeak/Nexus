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
}: UseGridDataLoaderParams): void => {
  // Load initial data - wait for templates to be loaded first
  useEffect(() => {
    const loadData = async () => {
      console.log('🚀 [useGridDataLoader] Starting loadData', {
        templatesLoaded,
        estimateId,
        hasGridEngine: !!gridEngine
      });

      if (!templatesLoaded) {
        console.log('⏸️ [useGridDataLoader] Waiting for templates to load');
        return; // Wait for templates to be loaded
      }

      if (!estimateId) {
        console.log('📝 [useGridDataLoader] No estimateId - creating empty row');
        // No estimate ID - initialize with empty row
        const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
        gridEngine.updateCoreData([emptyRow]);
        return;
      }

      try {
        console.log('📡 [useGridDataLoader] Loading grid data for estimateId:', estimateId);
        // Load from grid-data API
        const savedRows = await jobVersioningApi.loadGridData(estimateId);
        // API interceptor unwraps response - savedRows is array directly
        console.log('✅ [useGridDataLoader] Received savedRows:', {
          savedRows,
          type: typeof savedRows,
          isArray: Array.isArray(savedRows),
          length: savedRows?.length
        });

        if (savedRows && savedRows.length > 0) {
          console.log('📋 [useGridDataLoader] Processing', savedRows.length, 'saved rows');
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
          console.log('🔧 [useGridDataLoader] Setting core data with', coreRows.length, 'rows');

          // Set the grid data immediately (don't mark as dirty during initial load)
          gridEngine.updateCoreData(coreRows, { markAsDirty: false });
          console.log('✅ [useGridDataLoader] Core data set successfully');

          // Then trigger product type processing for each row to handle sub-item conversion (don't mark as dirty during initial load)
          console.log('🔄 [useGridDataLoader] Processing product types for each row');
          coreRows.forEach((row: any) => {
            if (row.productTypeId && row.productTypeName) {
              console.log('  → Processing row', row.id, 'with product type', row.productTypeId, row.productTypeName);
              gridEngine.updateRowProductType(row.id, row.productTypeId, row.productTypeName, { markAsDirty: false });
            }
          });
          console.log('✅ [useGridDataLoader] All rows processed');
        } else {
          console.log('📝 [useGridDataLoader] No saved rows - creating empty row');
          // No data found - initialize with empty row (don't mark as dirty during initial load)
          const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
          gridEngine.updateCoreData([emptyRow], { markAsDirty: false });
        }
      } catch (error) {
        console.error('❌ [useGridDataLoader] Failed to load estimate data:', error);
        // Don't create fallback data - show error to user instead
        // This prevents auto-save from potentially overwriting real data
        // Leave grid empty rather than risk overwriting data
      }
    };

    console.log('🎯 [useGridDataLoader] Calling loadData()');
    loadData();
  }, [estimateId, gridEngine, templatesLoaded]); // Include templatesLoaded to trigger reload when templates are ready
};
