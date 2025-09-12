/**
 * Shared TypeScript interfaces and types for the Estimate Versioning System
 * Extracted from estimateVersioningService.ts during refactoring
 * 
 * This file contains all interfaces used across the estimate versioning services:
 * - JobService
 * - EstimateService  
 * - GridDataService
 * - EditLockService
 */

export interface JobData {
  customer_id: number;
  job_name: string;
}

export interface EstimateVersionData {
  job_id: number;
  parent_estimate_id?: number;
  notes?: string;
}

export interface EstimateFinalizationData {
  status: 'sent' | 'approved' | 'ordered' | 'deactivated';
}

export interface EditLockStatus {
  can_edit: boolean;
  editing_user?: string;
  editing_user_id?: number;
  editing_started_at?: string;
  editing_expires_at?: string;
  locked_by_override?: boolean;
}

export interface EditLockResult {
  success: boolean;
  lockStatus: EditLockStatus;
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

/**
 * Grid data types for Phase 4 persistence
 */
export interface GridRowData {
  [key: string]: any;
}

export interface EstimateGridRow {
  id: string;
  type: string;
  productTypeId?: number;
  productTypeName?: string;
  assemblyId?: string;
  indent?: number;
  data: GridRowData;
  fieldConfig?: any[];
  isMainRow?: boolean;
  parentProductId?: string;
}