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
export { jobsApi } from './jobsApi';

// Phase 3 - Tier 2 Modules (Medium Complexity)
export { printApi } from './printApi';
export { quickbooksApi } from './quickbooksApi';
export { customerApi } from './customerApi';
export { customerContactsApi } from './customerContactsApi';
export { vinylApi } from './vinylApi';
export { vinylProductsApi } from './vinylProductsApi';
export { suppliersApi } from './suppliersApi';
export { supplierProductsApi } from './supplierProductsApi';
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
  orderBusinessLogicApi,
  orderPreparationApi
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

// Phase 3 - Settings & Templates UI
export { settingsApi } from './settings';
export type {
  SpecificationCategory,
  SpecificationOption,
  SettingsCategory,
  TaskDefinition,
  ProductionRole
} from './settings';

// Invoices Listing Page
export { invoicesApi } from './invoicesApi';
export type {
  InvoiceListingOrder,
  InvoiceFilters,
  InvoiceListingResponse,
  InvoiceAnalytics,
  BalanceSyncResult,
  BatchBalanceSyncResult
} from './invoicesApi';

// Dashboard Panels (Customizable Orders Dashboard)
export { dashboardPanelsApi } from './dashboardPanelsApi';

// Server Management GUI (Owner-only)
export { serverManagementApi } from './serverManagementApi';
export type {
  PM2ProcessStatus,
  BuildTimestamp,
  SystemStatus,
  BackupFile,
  ScriptResult
} from './serverManagementApi';

// Staff Task Sessions (Jan 2026)
export { staffTasksApi } from './staff';
export type {
  StaffTask,
  TaskSession,
  ActiveTaskResponse,
  StartSessionResponse,
  StopSessionResponse,
  CompleteTaskResponse,
  TaskSessionHistory,
  StaffTaskFilters,
  SessionUpdate
} from './staff';
