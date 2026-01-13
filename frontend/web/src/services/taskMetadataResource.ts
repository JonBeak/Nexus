// File Clean up Finished: 2026-01-12

/**
 * Task Metadata Resource - Session Caching for Task Configuration
 *
 * Single source of truth for:
 * - TASK_ORDER: Canonical ordering of tasks in the Tasks Table
 * - TASK_ROLE_MAP: Task name -> ProductionRole mapping for color coding
 * - AUTO_HIDE_COLUMNS: Columns to hide when no data exists
 *
 * Follows PricingDataResource pattern:
 * - 30-minute cache TTL
 * - In-flight request deduplication
 * - Helper methods for common lookups
 */

import api from './api';
import type { ProductionRole } from '../components/orders/tasksTable/roleColors';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface TaskMetadata {
  taskOrder: string[];
  taskRoleMap: Record<string, ProductionRole>;
  autoHideColumns: string[];
}

// =====================================================
// TASK METADATA RESOURCE CLASS
// =====================================================

export class TaskMetadataResource {
  private static cachedData: TaskMetadata | null = null;
  private static cacheTimestamp: number | null = null;
  private static inFlightRequest: Promise<TaskMetadata> | null = null;
  private static readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  // Cached derived sets (built once from cached data)
  private static autoHideColumnsSetCache: Set<string> | null = null;

  /**
   * Get all task metadata - cached for session
   */
  static async getTaskMetadata(): Promise<TaskMetadata> {
    // Check if we have valid cached data
    if (this.isCacheValid()) {
      return this.cachedData!;
    }

    // Check if there's already a request in flight
    if (this.inFlightRequest) {
      return this.inFlightRequest;
    }

    // Create new request
    this.inFlightRequest = (async () => {
      try {
        const response = await api.get('/orders/metadata/tasks');
        // API interceptor unwraps { success: true, data: metadata } -> metadata directly
        this.cachedData = response.data;
        this.cacheTimestamp = Date.now();
        return this.cachedData!;
      } catch (error) {
        console.error('Error fetching task metadata:', error);
        throw new Error('Failed to fetch task metadata');
      } finally {
        this.inFlightRequest = null;
      }
    })();

    return this.inFlightRequest;
  }

  /**
   * Get task order array
   */
  static async getTaskOrder(): Promise<string[]> {
    const metadata = await this.getTaskMetadata();
    return metadata.taskOrder;
  }

  /**
   * Get task role map
   */
  static async getTaskRoleMap(): Promise<Record<string, ProductionRole>> {
    const metadata = await this.getTaskMetadata();
    return metadata.taskRoleMap;
  }

  /**
   * Get auto-hide columns as an array
   */
  static async getAutoHideColumns(): Promise<string[]> {
    const metadata = await this.getTaskMetadata();
    return metadata.autoHideColumns;
  }

  /**
   * Get auto-hide columns as a Set (cached derivation)
   */
  static async getAutoHideColumnsSet(): Promise<Set<string>> {
    if (this.autoHideColumnsSetCache && this.isCacheValid()) {
      return this.autoHideColumnsSetCache;
    }

    const metadata = await this.getTaskMetadata();
    this.autoHideColumnsSetCache = new Set(metadata.autoHideColumns);
    return this.autoHideColumnsSetCache;
  }

  /**
   * Get role for a task key (handles composite keys like "taskName|notes")
   */
  static async getTaskRole(taskKey: string): Promise<ProductionRole> {
    const taskRoleMap = await this.getTaskRoleMap();
    const taskName = taskKey.split('|')[0];
    return taskRoleMap[taskName] || 'manager';
  }

  /**
   * Get sort order for a task name
   * Returns the index in TASK_ORDER, or 999 if not found
   */
  static async getTaskSortOrder(taskName: string): Promise<number> {
    const taskOrder = await this.getTaskOrder();
    const index = taskOrder.indexOf(taskName);
    return index >= 0 ? index : 999;
  }

  /**
   * Check if a column should be auto-hidden
   */
  static async shouldAutoHide(columnName: string): Promise<boolean> {
    const autoHideSet = await this.getAutoHideColumnsSet();
    return autoHideSet.has(columnName);
  }

  /**
   * Clear cached data (force refresh)
   */
  static clearCache(): void {
    this.cachedData = null;
    this.cacheTimestamp = null;
    this.autoHideColumnsSetCache = null;
  }

  /**
   * Check if cached data is still valid
   */
  private static isCacheValid(): boolean {
    if (!this.cachedData || !this.cacheTimestamp) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;
    return cacheAge < this.CACHE_DURATION_MS;
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): {
    isCached: boolean;
    ageMinutes?: number;
  } {
    if (!this.cachedData || !this.cacheTimestamp) {
      return { isCached: false };
    }

    return {
      isCached: true,
      ageMinutes: Math.floor((Date.now() - this.cacheTimestamp) / 60000)
    };
  }
}
