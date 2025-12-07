// File Clean up Finished: 2025-11-25
/**
 * API Services - Backward Compatibility Layer
 *
 * This file serves as the main entry point for all API services.
 * It re-exports all API modules from the modular structure in `./api/`.
 *
 * @deprecated Direct imports from specific modules are preferred for new code:
 * - import { ordersApi } from '@/services/api/orders'
 * - import { customerApi } from '@/services/api/customerApi'
 *
 * However, this file maintains 100% backward compatibility with existing code:
 * - import { ordersApi, customerApi } from '@/services/api'
 *
 * Refactored: November 2024
 * Original: 1,377 lines → New: 28 lines (98% reduction)
 */

// Re-export ALL API modules from the modular structure
// Note: Explicit path './api/index' to avoid circular reference with './api.ts'
export {
  // Client
  api,
  apiClient,
  API_BASE_URL,
  // Job Versioning
  jobVersioningApi,
  // Tier 1
  authApi,
  ledsApi,
  powerSuppliesApi,
  jobsApi,
  // Tier 2
  printApi,
  quickbooksApi,
  customerApi,
  customerContactsApi,
  vinylApi,
  vinylProductsApi,
  suppliersApi,
  accountsApi,
  provincesApi,
  // Tier 3 - Consolidated
  ordersApi,
  timeApi,
  // Tier 3 - Sub-modules
  ordersApiCore,
  orderStatusApi,
  orderTasksApi,
  orderPartsApi,
  orderFormsApi,
  orderBusinessLogicApi,
  timeEntriesApi,
  timeClockApi,
  timeRequestsApi,
  timeSchedulesApi,
  timeAnalyticsApi,
  timeNotificationsApi,
  timeCalendarApi
} from './api/index';

// Export as default for module compatibility
import { api } from './apiClient';
export default api;
