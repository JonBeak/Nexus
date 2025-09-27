// Shared types for job estimation system

import { ValidationResultsManager } from '../core/validation/ValidationResultsManager';
import { PricingCalculationContext } from '../core/types/GridTypes';

export interface FieldOption {
  value: string;
  label: string;
}

export interface DynamicField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  data_source?: string;
  value_field?: string;
  display_field?: string;
  filter?: Record<string, any>;
  validation?: {
    min?: number;
    max?: number;
    maxLength?: number;
  };
  options?: FieldOption[] | string[];
}

export interface EstimateRow {
  id: string;           // Frontend UUID  
  dbId?: number;        // ✅ NEW: Backend database ID (stable reference for assembly fields)
  productTypeId?: number;
  productTypeName?: string;
  assemblyId?: string;
  indent: number;
  data: Record<string, any>;
  // ✅ REMOVED: fieldConfig - eliminated redundant cache system
  isMainRow?: boolean; // True for the first row of a product
  parentProductId?: string; // Link continuation rows to parent
  
  // New fields for estimate preview system
  qty?: number; // Line quantity (separate from 12-column calculations)
  
  // Multiplier configuration
  multiplier_value?: number;
  multiplier_target_lines?: string; // "1-10" | "1,2,3,6" | "1-5 + 7,9" | "all_above"
  
  // Discount configuration  
  discount_percentage?: number;
  discount_flat_amount?: number;
  discount_target_lines?: string; // Same format as multiplier_target_lines
  
  // Assembly configuration
  assembly_start_line?: number; // Line ID where assembly begins (end = assembly line itself)
  
  // Text/spacing
  text_content?: string; // For text lines, notes, section headers

  // Calculation output
  calculation?: RowCalculationResult;
}

export interface GridJobBuilderProps {
  user: any;
  estimate: any;
  isCreatingNew: boolean;
  onEstimateChange: (estimate: any) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  customerId?: number | null;
  // NEW: Customer context for pricing calculations
  customerName?: string | null;
  cashCustomer?: boolean;
  taxRate?: number;
  // Versioning system props
  versioningMode?: boolean;
  estimateId?: number;
  isReadOnly?: boolean;
  // Validation callback
  onValidationChange?: (hasErrors: boolean, errorCount: number, context?: PricingCalculationContext) => void;
  // Navigation guard callback
  onRequestNavigation?: (navigationGuard: ((navigationFn?: () => void) => void) | null) => void;
}

export interface DragDropContextType {
  activeId: string | null;
  sensors: any;
  handleDragStart: (event: any) => void;
  handleDragEnd: (event: any) => void;
}

export interface RowOperations {
  handleProductTypeSelect: (rowIndex: number, productTypeId: number) => Promise<void>;
  handleFieldCommit: (rowIndex: number, fieldName: string, value: any) => void; // ✅ RENAMED: Only called on blur
  handleInsertRow: (afterIndex: number) => void;
  handleDeleteRow: (rowIndex: number) => void;
  handleProductTypeReselect: (rowIndex: number) => void;
  handleSubItemCommit: (rowIndex: number, value: string) => void; // ✅ RENAMED: Only called on blur
  handleConvertToAssembly: (rowIndex: number) => void;
}

export interface AssemblyOperations {
  handleAssemblyItemToggle: (assemblyIndex: number, itemId: string, isSelected: boolean) => void;
  getAvailableItems: (includeAssigned?: boolean) => Array<{id: string, number: number, name: string}>;
  isItemInAssembly: (itemId: string, assemblyIndex: number) => boolean;
  getAssemblyColor: (assemblyIndex: number) => string;
  getAssemblyIndex: () => number;
  // ✅ CONSOLIDATION: New methods moved from AssemblyReferenceUpdater
  findRowByLogicalNumber: (targetNumber: number) => number;
  countAssemblyFieldUsage: (targetNumber: string, excludeAssemblyId?: string, excludeFieldName?: string) => number;
  validateAssemblyFieldValue: (value: string, currentAssemblyId: string, currentFieldName?: string) => string[];
  getAssemblyDropdownOptions: () => Array<{value: string, label: string, disabled?: boolean}>;
}

export interface AssemblyItemsCache {
  allItems: Array<{id: string, number: number, name: string}>;
  unassignedItems: Array<{id: string, number: number, name: string}>;
}

export interface FieldRendererProps {
  row: EstimateRow;
  rowIndex: number;
  field: any;
  fieldIndex: number;
  onFieldCommit: (rowIndex: number, fieldName: string, value: any) => void; // ✅ RENAMED: Only called on blur
  onSubItemCommit?: (rowIndex: number, value: string) => void; // ✅ RENAMED: Only called on blur
  assemblyOperations?: AssemblyOperations;
  assemblyItemsCache?: AssemblyItemsCache;
  validationErrors?: string[];
  allRows?: EstimateRow[]; // ✅ NEW: Required for database ID assembly reference conversion
  hasFieldBeenBlurred?: (rowId: string, fieldName: string) => boolean; // ✅ NEW: For validation styling
}

// Versioning System Types
export interface JobSummary {
  job_id: number;
  job_number: string;
  job_name: string;
  customer_id: number;
  customer_name: string;
  job_status: 'quote' | 'active' | 'production' | 'completed' | 'cancelled';
  estimate_count: number;
  draft_count: number;
  finalized_count: number;
  latest_version: number;
  last_activity: string;
}

export interface EstimateVersion {
  id: number;
  job_code: string;
  job_id: number;
  job_name: string;
  job_number: string;
  version_number: number;
  version_label: string; // "v1", "v2", etc.
  customer_id: number;
  customer_name: string;
  status: 'draft' | 'sent' | 'approved' | 'ordered' | 'deactivated';
  is_draft: boolean;
  display_status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  parent_estimate_id?: number;
  parent_version?: number;
  
  // Edit lock system
  editing_user_id?: number;
  editing_started_at?: string;
  editing_expires_at?: string;
  editing_locked_by_override?: boolean;
  
  // Enhanced status flags
  is_sent: boolean;
  is_approved: boolean;
  is_retracted: boolean;
  // sent_count, last_sent_at, approved_at, retracted_at now available via history API
  
  // Audit fields
  finalized_at?: string;
  finalized_by?: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface JobData {
  customer_id: number;
  job_name: string;
}

export interface EstimateVersionData {
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

export interface JobValidationResponse {
  valid: boolean;
  message?: string;
  suggestion?: string;
}

// Component Props for Versioning System
export interface JobSelectorProps {
  customerId?: number;
  onCustomerSelected: (customerId: number) => void;
  onJobSelected: (jobId: number) => void;
  onCreateNewJob: (jobName: string) => void;
  user: any;
}

export interface VersionManagerProps {
  jobId: number;
  currentEstimateId?: number;
  onVersionSelected: (estimateId: number) => void;
  onCreateNewVersion: (parentId?: number) => void;
  user: any;
}

export interface EstimateActionsProps {
  estimateId: number;
  estimate: EstimateVersion;
  onSaveDraft: () => void;
  onFinalize: (status: EstimateFinalizationData['status']) => void;
  onStatusChange: (action: string) => void;
  onNavigateToEstimate?: (jobId: number, estimateId: number) => void;
  user: any;
}

export interface EditLockManagerProps {
  estimateId: number;
  onLockAcquired: (lockStatus: EditLockStatus) => void;
  onLockConflict: (lockStatus: EditLockStatus) => void;
  user: any;
}

export interface BreadcrumbNavigationProps {
  customerName?: string;
  jobName?: string;
  version?: string;
  status?: string;
  onNavigateToCustomerSelection?: () => void;
  onNavigateToJobSelection?: () => void;
  onNavigateToVersionSelection?: () => void;
}

export type WorkflowStep = 'customer-selection' | 'job-selection' | 'version-selection' | 'estimate-builder';

export interface WorkflowState {
  step: WorkflowStep;
  selectedCustomerId?: number;
  selectedJobId?: number;
  selectedEstimateId?: number;
  breadcrumbData?: {
    customerName?: string;
    jobName?: string;
    version?: string;
    status?: string;
  };
}
import type { RowCalculationResult } from '../core/types/LayerTypes';
