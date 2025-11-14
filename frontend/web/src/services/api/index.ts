/**
 * Central barrel export for all API modules
 * This file provides a single import point for all API services
 */

// Re-export the shared API client
export { api, api as apiClient, API_BASE_URL } from '../apiClient';

// Re-export jobVersioningApi (already extracted)
export { jobVersioningApi } from '../jobVersioningApi';

// Phase 2 - Tier 1 Modules (Simple, Low-Risk Extractions)
export { authApi } from './authApi';
export { ledsApi } from './ledsApi';
export { powerSuppliesApi } from './powerSuppliesApi';
export { materialsApi } from './materialsApi';
export { jobsApi } from './jobsApi';

// Phase 3 - Tier 2 Modules (Medium Complexity)
export { printApi } from './printApi';
export { quickbooksApi } from './quickbooksApi';
export { customerApi } from './customerApi';
export { customerContactsApi } from './customerContactsApi';
export { vinylApi } from './vinylApi';
export { vinylProductsApi } from './vinylProductsApi';
export { suppliersApi } from './suppliersApi';
export { accountsApi } from './accountsApi';
export { provincesApi } from './provincesApi';

// Phase 4 - Tier 3 Modules (Complex, split into sub-modules)
// Export consolidated APIs for backward compatibility
export { ordersApiConsolidated as ordersApi } from './orders';
export { timeApiConsolidated as timeApi } from './time';

// Also export individual sub-modules for granular imports
export {
  ordersApi as ordersApiCore,
  orderStatusApi,
  orderTasksApi,
  orderPartsApi,
  orderFormsApi,
  orderBusinessLogicApi
} from './orders';

export {
  timeEntriesApi,
  timeClockApi,
  timeRequestsApi,
  timeSchedulesApi,
  timeAnalyticsApi,
  timeNotificationsApi,
  timeCalendarApi
} from './time';
