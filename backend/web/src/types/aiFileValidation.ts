/**
 * AI File Validation Types
 * Types for the AI file vector validation system
 */

// Validation issue severity levels
export type IssueSeverity = 'error' | 'warning' | 'info';

// Validation status states
export type ValidationStatus = 'pending' | 'passed' | 'failed' | 'warning' | 'error';

// Rule types for validation
export type RuleType = 'stroke' | 'overlap' | 'holes' | 'area' | 'closure' | 'custom';

/**
 * A single validation issue found in a file
 */
export interface ValidationIssue {
  rule: string;
  severity: IssueSeverity;
  message: string;
  path_id?: string;
  details?: Record<string, any>;
}

/**
 * Statistics collected during validation
 */
export interface ValidationStats {
  total_paths: number;
  closed_paths: number;
  paths_with_stroke: number;
  paths_with_fill: number;
  total_holes: number;
  total_area: number;
  total_perimeter: number;
}

/**
 * Result from validating a single AI file
 */
export interface FileValidationResult {
  success: boolean;
  file_path: string;
  file_name: string;
  status: ValidationStatus;
  issues: ValidationIssue[];
  stats: ValidationStats;
  error?: string;
  skipped_validation?: boolean;  // True if file was not validated (e.g., cutting files)
  skip_reason?: string;          // Reason validation was skipped
}

/**
 * Database record for ai_file_validations table
 */
export interface AiFileValidationRecord {
  validation_id: number;
  order_id: number;
  order_number: number;
  file_path: string;
  file_name: string;
  validation_status: ValidationStatus;
  validated_at: Date | null;
  validated_by: number | null;
  approved_at: Date | null;
  approved_by: number | null;
  issues: ValidationIssue[] | null;
  stats: ValidationStats | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Configuration for a validation rule
 */
export interface ValidationRuleConfig {
  // Overlap rule config
  tolerance?: number;
  check_same_path?: boolean;
  check_position?: boolean;

  // Stroke rule config
  required_color?: string;
  required_width?: number;
  allow_fill?: boolean;

  // Holes rule config
  min_holes?: number;
  holes_per_sq_inch?: number;
  min_perimeter_for_holes?: number;
  applies_to_backing?: boolean;

  // Closure rule config
  exclude_text_paths?: boolean;

  // Front Lit structure validation config
  file_scale?: number;                    // File scale (e.g., 0.1 for 10%)
  wire_hole_diameter_mm?: number;         // Expected wire hole diameter in file units
  wire_hole_tolerance_mm?: number;        // Tolerance for wire hole diameter
  mounting_hole_diameter_mm?: number;     // Expected mounting hole diameter in file units
  mounting_hole_tolerance_mm?: number;    // Tolerance for mounting hole diameter
  trim_offset_min_mm?: number;            // Minimum trim offset per side (straight edges)
  trim_offset_max_mm?: number;            // Maximum trim offset per side (straight edges)
  miter_factor?: number;                  // Miter limit: max corner extension before bevel (default 4.0)
  min_mounting_holes?: number;            // Minimum mounting holes per letter
  mounting_holes_per_inch_perimeter?: number;  // Holes per inch of perimeter (real scale)
  mounting_holes_per_sq_inch_area?: number;    // Holes per sq inch of area (real scale)
  check_wire_holes?: boolean;             // Whether to check for wire holes (LEDs)
  return_layer?: string;                  // Layer name for returns
  trim_layer?: string;                    // Layer name for trim caps

  // Generic
  [key: string]: any;
}

/**
 * Database record for ai_validation_rules table
 */
export interface AiValidationRule {
  rule_id: number;
  rule_name: string;
  rule_type: RuleType;
  rule_config: ValidationRuleConfig;
  severity: IssueSeverity;
  is_active: boolean;
  applies_to: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * AI file info (before validation)
 */
export interface AiFileInfo {
  file_path: string;
  file_name: string;
  size_bytes: number;
  modified_at: Date;
  validation?: AiFileValidationRecord;
}

/**
 * Request to validate files for an order
 */
export interface ValidateFilesRequest {
  order_number: number;
  file_paths?: string[]; // Optional: specific files to validate, otherwise validate all
}

/**
 * Response from validation endpoint
 */
export interface ValidateFilesResponse {
  success: boolean;
  order_number: number;
  total_files: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
  results: FileValidationResult[];
  message?: string;
}

/**
 * Request to approve files (even with issues)
 */
export interface ApproveFilesRequest {
  order_number: number;
  validation_ids?: number[]; // Specific validations to approve
  approve_all?: boolean;
  notes?: string;
}

/**
 * Response from approval endpoint
 */
export interface ApproveFilesResponse {
  success: boolean;
  order_number: number;
  approved_count: number;
  message?: string;
}

/**
 * Service result wrapper (consistent with other services)
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// =============================================
// EXPECTED FILES RULE SYSTEM
// =============================================

// Rule condition types
export type RuleConditionType = 'specs_display_name' | 'product_type_id' | 'has_template';

// Rule definition from database
export interface FileExpectationRule {
  rule_id: number;
  rule_name: string;
  condition_type: RuleConditionType;
  condition_value: string;
  expected_filename: string;
  is_required: boolean;
  description?: string;
  is_active: boolean;
  created_at?: Date;
}

// Comparison status for a file
export type FileComparisonStatus = 'present' | 'missing' | 'unexpected';

// Single file comparison entry
export interface FileComparisonEntry {
  filename: string;
  detected_ai_version?: string;  // Report only, no enforcement
  file_path?: string;
  status: FileComparisonStatus;
  is_required: boolean;
  matched_rules: string[];  // Which rules generated this expectation
}

// Full comparison result
export interface ExpectedFilesComparison {
  order_number: number;
  folder_exists: boolean;
  summary: {
    total_expected: number;
    present: number;
    missing_required: number;
    missing_optional: number;
    unexpected: number;
  };
  files: FileComparisonEntry[];
}
