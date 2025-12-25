// Shared types for job estimation system

import { ValidationResultsManager } from '../core/validation/ValidationResultsManager';
import { PricingCalculationContext } from '../core/types/GridTypes';
import { CustomerManufacturingPreferences } from '../core/validation/context/useCustomerPreferences';
import { User } from '../../../types';

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
  user: User;
  estimate: EstimateVersion;
  isCreatingNew: boolean;
  onEstimateChange: (estimate: EstimateVersion) => void;
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
  // Customer preferences callback - GridJobBuilder is single source of truth for preferences
  onPreferencesLoaded?: (preferences: CustomerManufacturingPreferences | null) => void;
  // Grid data change callback - for auto-save orchestration
  onGridDataChange?: (version: number) => void;
  // GridEngine ready callback - passes GridEngine instance to parent for auto-save
  onGridEngineReady?: (engine: import('../core/GridEngine').GridEngine | null) => void;
  // Cross-component hover state
  hoveredRowId?: string | null;
  onRowHover?: (rowId: string | null) => void;
  // Calculated estimate totals for persistence
  estimatePreviewData?: { total: number } | null;
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
  customer_job_number?: string;  // Customer reference number (PO, project code)
  customer_id: number;
  customer_name: string;
  job_status: 'draft' | 'sent' | 'approved';
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
  customer_job_number?: string;  // Customer reference number (PO, project code)
  job_number: string;
  version_number: number;
  version_label: string; // "v1", "v2", etc.
  customer_id: number;
  customer_name: string;
  is_draft: boolean;
  is_prepared: boolean;
  is_active: boolean; // Single source of truth for deactivation (false = deactivated, true = active)
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  parent_estimate_id?: number;
  parent_version?: number;
  notes?: string;

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

  // QuickBooks integration
  qb_estimate_id?: string;
  qb_doc_number?: string;  // QB estimate document number for display
  qb_estimate_url?: string;
  estimate_date?: string;  // QB estimate date (set when estimate is sent to QB)

  // Preparation table flag (Phase 4.e)
  uses_preparation_table?: boolean;  // True if using new preparation table workflow

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
  customer_job_number?: string;  // Optional customer reference number
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

export interface VersionManagerProps {
  jobId: number;
  currentEstimateId?: number;
  onVersionSelected: (estimateId: number) => void;
  onCreateNewVersion: (parentId?: number) => void;
  user: User;
}

export interface EditLockManagerProps {
  estimateId: number;
  onLockAcquired: (lockStatus: EditLockStatus) => void;
  onLockConflict: (lockStatus: EditLockStatus) => void;
  user: User;
}

export interface BreadcrumbNavigationProps {
  customerName?: string;
  jobName?: string;
  version?: string;
  status?: string;
  // IDs for building proper link URLs (right-clickable)
  customerId?: number;
  jobId?: number;
  onNavigateToHome?: () => void;
  onNavigateToEstimates?: () => void;
  onNavigateToCustomer?: () => void;
  onNavigateToJob?: () => void;

  // Action buttons props
  showCopySvg?: boolean;
  copySvgSuccess?: boolean;
  onCopySvg?: () => void;
  showConvertToOrder?: boolean;
  onConvertToOrder?: () => void;
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

// =============================================
// EMAIL COMPOSER TYPES
// =============================================

export interface EmailSummaryConfig {
  includeJobName: boolean;
  includeCustomerRef: boolean;
  includeQbEstimateNumber: boolean;
  includeSubtotal: boolean;
  includeTax: boolean;
  includeTotal: boolean;
  includeEstimateDate: boolean;
  includeValidUntilDate: boolean;
}

// Default config - all checked except Valid Until Date
export const DEFAULT_EMAIL_SUMMARY_CONFIG: EmailSummaryConfig = {
  includeJobName: true,
  includeCustomerRef: true,
  includeQbEstimateNumber: true,
  includeSubtotal: true,
  includeTax: true,
  includeTotal: true,
  includeEstimateDate: true,
  includeValidUntilDate: true   // Checked by default
};

// Default email text values
export const DEFAULT_EMAIL_SUBJECT = "{{jobNameWithRef}} - Estimate #{{qbEstimateNumber}} from Sign House Inc.";
export const DEFAULT_EMAIL_BEGINNING = "Hi {{customerName}},\n\nPlease find the attached estimate for your review.\n\nNOTE: This estimate is pending your approval. Please reply to confirm and we will verify all details before beginning production.";
export const DEFAULT_EMAIL_END = "If you have any questions, please don't hesitate to reach out.\n\nBest regards,\nThe Sign House Team";

export interface EstimateEmailData {
  jobName?: string;
  customerJobNumber?: string;
  qbEstimateNumber?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  estimateDate?: string;
}
