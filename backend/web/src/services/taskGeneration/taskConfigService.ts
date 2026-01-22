/**
 * Task Config Service
 *
 * Provides cached access to task configuration from the database.
 * Used by task generation code to get task order, role mappings, etc.
 *
 * Features:
 * - 5-minute cache to minimize database queries during task generation
 * - Automatic fallback to hardcoded values on database errors
 * - Async API for database access
 *
 * Created: 2026-01-22
 */

import { settingsRepository } from '../../repositories/settingsRepository';
import { ProductionRole } from '../../types/orders';
import { TASK_ORDER, TASK_ROLE_MAP } from './taskRules';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache state
let cachedTaskOrder: string[] | null = null;
let cachedTaskRoleMap: Record<string, ProductionRole> | null = null;
let cacheTimestamp: number = 0;

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  return cachedTaskOrder !== null &&
         cachedTaskRoleMap !== null &&
         (Date.now() - cacheTimestamp) < CACHE_TTL_MS;
}

/**
 * Refresh the cache from database
 */
async function refreshCache(): Promise<void> {
  try {
    const metadata = await settingsRepository.getTaskMetadata();

    if (metadata.taskOrder.length > 0) {
      cachedTaskOrder = metadata.taskOrder;
      cachedTaskRoleMap = metadata.taskRoleMap as Record<string, ProductionRole>;
      cacheTimestamp = Date.now();
      console.log(`[TaskConfigService] Cache refreshed with ${metadata.taskOrder.length} tasks`);
    } else {
      // Database returned empty - use fallback
      console.warn('[TaskConfigService] Database returned empty, using hardcoded fallback');
      cachedTaskOrder = TASK_ORDER;
      cachedTaskRoleMap = TASK_ROLE_MAP;
      cacheTimestamp = Date.now();
    }
  } catch (error) {
    console.error('[TaskConfigService] Error refreshing cache, using fallback:', error);
    cachedTaskOrder = TASK_ORDER;
    cachedTaskRoleMap = TASK_ROLE_MAP;
    cacheTimestamp = Date.now();
  }
}

/**
 * Ensure cache is loaded
 */
async function ensureCache(): Promise<void> {
  if (!isCacheValid()) {
    await refreshCache();
  }
}

/**
 * Force cache refresh (useful after settings updates)
 */
export async function invalidateCache(): Promise<void> {
  cachedTaskOrder = null;
  cachedTaskRoleMap = null;
  cacheTimestamp = 0;
  await refreshCache();
}

/**
 * Get task order array (async, cached)
 */
export async function getTaskOrderAsync(): Promise<string[]> {
  await ensureCache();
  return cachedTaskOrder || TASK_ORDER;
}

/**
 * Get task role map (async, cached)
 */
export async function getTaskRoleMapAsync(): Promise<Record<string, ProductionRole>> {
  await ensureCache();
  return cachedTaskRoleMap || TASK_ROLE_MAP;
}

/**
 * Get sort order for a task name (async, cached)
 * Returns the index in task order, or 999 if not found
 */
export async function getTaskSortOrderAsync(taskName: string): Promise<number> {
  const taskOrder = await getTaskOrderAsync();
  const index = taskOrder.indexOf(taskName);
  return index >= 0 ? index : 999;
}

/**
 * Get role for a task name (async, cached)
 * Returns 'manager' as default if not found
 */
export async function getRoleAsync(taskName: string): Promise<ProductionRole> {
  const roleMap = await getTaskRoleMapAsync();
  return roleMap[taskName] || 'manager';
}

// Export service object for convenience
export const taskConfigService = {
  invalidateCache,
  getTaskOrder: getTaskOrderAsync,
  getTaskRoleMap: getTaskRoleMapAsync,
  getTaskSortOrder: getTaskSortOrderAsync,
  getRole: getRoleAsync
};

export default taskConfigService;
