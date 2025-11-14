/**
 * Time API Barrel Export
 * Consolidates all time management API modules for backward compatibility
 *
 * This allows consumers to import all time APIs from a single location:
 * import { timeEntriesApi, timeClockApi, timeRequestsApi } from '@/services/api/time'
 */

export { timeEntriesApi } from './timeEntriesApi';
export { timeClockApi } from './timeClockApi';
export { timeRequestsApi } from './timeRequestsApi';
export { timeSchedulesApi } from './timeSchedulesApi';
export { timeAnalyticsApi } from './timeAnalyticsApi';
export { timeNotificationsApi } from './timeNotificationsApi';
export { timeCalendarApi } from './timeCalendarApi';

// Re-export all methods as a single consolidated timeApi object for backward compatibility
import { timeEntriesApi } from './timeEntriesApi';
import { timeClockApi } from './timeClockApi';
import { timeRequestsApi } from './timeRequestsApi';
import { timeSchedulesApi } from './timeSchedulesApi';
import { timeAnalyticsApi } from './timeAnalyticsApi';
import { timeNotificationsApi } from './timeNotificationsApi';
import { timeCalendarApi } from './timeCalendarApi';

/**
 * Consolidated timeApi object containing all time management methods
 * This maintains backward compatibility with code that imports { timeApi } from '@/services/api'
 */
export const timeApiConsolidated = {
  ...timeEntriesApi,
  ...timeClockApi,
  ...timeRequestsApi,
  ...timeSchedulesApi,
  ...timeAnalyticsApi,
  ...timeNotificationsApi,
  ...timeCalendarApi,
};
