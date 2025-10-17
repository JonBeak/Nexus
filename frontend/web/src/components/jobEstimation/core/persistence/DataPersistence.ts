// Data persistence operations and backend integration
// Extracted from GridEngine.ts for better maintainability

import { GridRowCore } from '../types/CoreTypes';
import { CoreDataOperations } from '../layers/CoreDataLayer';

export interface PersistenceConfig {
  autoSave?: {
    enabled: boolean;
    debounceMs: number;
    onSave: (rows: GridRowCore[]) => Promise<void>;
  };
  coreOps: CoreDataOperations;
}

export class DataPersistence {
  private autoSaveTimer?: NodeJS.Timeout;
  private pendingAutoSave = false;

  constructor(private config: PersistenceConfig) {}

  /**
   * Triggers auto-save with debouncing
   * @param coreData - Current core data to save
   * @param onSaveStart - Callback when save starts
   * @param onSaveComplete - Callback when save completes
   * @param onSaveError - Callback when save fails
   */
  triggerAutoSave(
    coreData: GridRowCore[],
    onSaveStart: () => void,
    onSaveComplete: () => void,
    onSaveError: (error: any) => void
  ): void {
    if (!this.config.autoSave?.enabled) return;

    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Set new debounced timer
    this.autoSaveTimer = setTimeout(async () => {
      if (this.pendingAutoSave) return; // Prevent concurrent saves

      this.pendingAutoSave = true;
      onSaveStart();

      try {
        await this.config.autoSave!.onSave([...coreData]);
        onSaveComplete();
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
        onSaveError(error);
      } finally {
        this.pendingAutoSave = false;
      }
    }, this.config.autoSave.debounceMs || 500);
  }

  /**
   * Reloads grid data from backend API and updates GridEngine state
   * @param estimateId - Estimate ID to load data for
   * @param jobVersioningApi - API client for loading data
   * @param fieldPromptsMap - Field prompts for existing compatibility
   * @returns Core rows from backend
   */
  async reloadFromBackend(estimateId: number, jobVersioningApi: any): Promise<GridRowCore[]> {
    try {
      const response = await jobVersioningApi.loadGridData(estimateId);
      const savedRows = response.data || [];

      if (savedRows.length > 0) {
        const coreRows = savedRows.map((row: any, index: number) => {
          // Derive rowType from backend data
          let rowType: 'main' | 'continuation' | 'subItem';
          if (row.productTypeCategory === 'sub_item') {
            rowType = 'subItem';
          } else if (row.parentProductId) {
            rowType = 'continuation';
          } else {
            rowType = 'main';
          }

          return {
            id: row.id || `row-${index + 1}`,
            rowType,
            productTypeId: row.productTypeId,
            productTypeName: row.productTypeName,
            data: row.data || {},
            parentProductId: row.parentProductId || undefined,
            dbId: row.dbId,
            itemIndex: row.itemIndex,
            assemblyId: row.assemblyId,
            fieldConfig: row.fieldConfig || [],
            isMainRow: row.isMainRow,
            indent: row.indent || 0
          };
        });

        return coreRows;
      } else {
        const emptyRow = this.config.coreOps.createEmptyRow('main', []);
        return [emptyRow];
      }
    } catch (error) {
      console.error('Failed to reload data from backend:', error);
      throw error; // Let caller handle the error
    }
  }

  /**
   * Cleanup method for auto-save timer
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }

  /**
   * Checks if auto-save is currently in progress
   */
  isAutoSaving(): boolean {
    return this.pendingAutoSave;
  }

  /**
   * Manually cancels pending auto-save
   */
  cancelPendingAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }
}
