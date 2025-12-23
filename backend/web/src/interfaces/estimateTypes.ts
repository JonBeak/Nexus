// File Clean up Finished: 2025-11-15
// Changes:
//   - Removed dead interfaces: EditLockStatus, EditLockResult, GridRowData, EstimateGridRow
//   - Fixed EstimateFinalizationData status enum to match business requirements
//   - Updated documentation to remove reference to non-existent EditLockService
//   - Removed unused EstimateGridRow import from estimateVersioningService.ts

/**
 * Shared TypeScript interfaces and types for the Estimate Versioning System
 * Extracted from estimateVersioningService.ts during refactoring
 *
 * This file contains all interfaces used across the estimate versioning services:
 * - JobService
 * - EstimateService
 * - GridDataService
 */

export interface JobData {
  customer_id: number;
  job_name: string;
  customer_job_number?: string;  // Optional customer reference number (PO, project code)
}

export interface EstimateVersionData {
  job_id: number;
  parent_estimate_id?: number;
  notes?: string;
}

export interface EstimateFinalizationData {
  status: 'draft' | 'sent' | 'approved' | 'retracted' | 'deactivated';
}

/**
 * Additional interfaces for service communication
 */
export interface MultipleJobResult {
  newJobId: number;
  newEstimateId: number;
}

export interface OrderConversionResult {
  order_id: number;
}