// File Clean up Finished: 2026-01-12
/**
 * Central barrel export for all API modules
 * This file provides a single import point for all API services
 */

// Re-export the shared API client
export { api, api as apiClient, API_BASE_URL } from '../apiClient';

// Default export for backward compatibility with `import api from '../../services/api'`
export { api as default } from '../apiClient';

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
export type {
  CustomerCreateData,
  ManufacturingPreferences,
  CustomerPaginationInfo
} from './customerApi';
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
  orderPreparationApi,
  qbInvoiceApi,
  cashPaymentApi
} from './orders';

export type {
  InvoiceDetails,
  InvoiceStalenessResult,
  InvoiceSyncStatus,
  ConflictResolution,
  InvoiceDifference,
  InvoiceSyncResult,
  PaymentInput,
  PaymentResult,
  EmailInput,
  ScheduledEmailInput,
  ScheduledEmail,
  EmailPreview,
  InvoiceSearchResult,
  CustomerInvoiceListItem,
  CustomerInvoiceListResult,
  InvoiceLineItem,
  InvoiceDetailsResult,
  InvoicePreviewLineItem
} from './orders/qbInvoiceApi';

export type {
  CashPayment,
  CashBalanceInfo,
  CashPaymentMethod,
  RecordPaymentInput,
  RecordPaymentResult
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
  EnvironmentInfo,
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

// Payments (Multi-Invoice Payment Operations)
export { paymentsApi } from './paymentsApi';
export type {
  OpenInvoice,
  InvoicePaymentAllocation,
  MultiPaymentInput,
  MultiPaymentResult,
  OpenInvoicesResponse,
  OpenCashOrder,
  CashOrderAllocation,
  MultiCashPaymentInput,
  MultiCashPaymentResult
} from './paymentsApi';

// Customer Accounting Emails
export { customerAccountingEmailsApi } from './customerAccountingEmailsApi';
export type {
  AccountingEmailType,
  CustomerAccountingEmail,
  CreateAccountingEmailData,
  UpdateAccountingEmailData
} from './customerAccountingEmailsApi';

// Feedback/Error Reporting System (Jan 2026)
export { feedbackApi } from './feedbackApi';
export type {
  FeedbackStatus,
  FeedbackPriority,
  FeedbackRequest,
  FeedbackResponse,
  CreateFeedbackData,
  FeedbackFilters,
  FeedbackListResponse,
  FeedbackDetailResponse
} from './feedbackApi';

// File Browser (Owner-only, Jan 2026)
export { fileBrowserApi } from './fileBrowserApi';
export type {
  FileItem,
  DirectoryListing,
  HealthStatus,
  UploadResult,
  UploadResponse
} from './fileBrowserApi';

// Material Requirements (Jan 2026)
export { materialRequirementsApi } from './materialRequirementsApi';

// Archetypes (Product Types) for Material Requirements dropdowns
export { archetypesApi } from './archetypesApi';
export type { ProductArchetype, VinylProductOption, SupplierProductOption } from '../../types/materialRequirements';
export type {
  MaterialRequirement,
  MaterialRequirementStatus,
  DeliveryMethod,
  ActionableMaterialRequirement,
  CreateMaterialRequirementRequest,
  UpdateMaterialRequirementRequest,
  MaterialRequirementSearchParams,
  ReceiveQuantityResponse,
  ActionableRequirementsResponse,
  StatusCountsResponse,
  OrderDropdownOption
} from '../../types/materialRequirements';

// Supplier Orders (Feb 2026)
export { supplierOrdersApi } from './supplierOrdersApi';
export type {
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderWithItems,
  SupplierOrderStatus,
  SupplierOrderStatusHistory,
  CreateSupplierOrderRequest,
  UpdateSupplierOrderRequest,
  GenerateOrderRequest,
  GenerateOrderResponse,
  ReceiveItemsRequest,
  ReceiveItemsResponse,
  SupplierOrderSearchParams,
  SupplierOrderStatusCounts,
  GroupedRequirement,
  SupplierRequirementGroup,
  GroupedBySupplierResponse
} from '../../types/supplierOrders';

// AI File Validation (Feb 2026)
export { aiFileValidationApi } from './aiFileValidationApi';
export type {
  AiFileInfo,
  AiFileValidationRecord,
  AiValidationRule,
  ValidateFilesResponse,
  ApproveFilesResponse,
  ValidationIssue,
  ValidationStats,
  ValidationStatus,
  IssueSeverity
} from '../../types/aiFileValidation';

// Pricing Management UI (Feb 2026)
export { pricingManagementApi } from './pricingManagementApi';
export type { PricingRow } from './pricingManagementApi';

// Inventory Management (Feb 2026)
export { default as inventoryApi } from './inventoryApi';
export type {
  SupplierProductStock,
  ArchetypeStockLevel,
  LowStockAlert,
  StockSummaryByCategory,
  InventoryTransaction,
  StockAdjustmentResult,
  TransactionSummary
} from './inventoryApi';
