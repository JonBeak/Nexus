/**
 * AI File Validation Types (Frontend)
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
  layers?: string[];
  paths_per_layer?: Record<string, number>;
  letter_analysis?: LetterAnalysisResponse;
  detected_scale?: number;
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
  file_type?: 'working' | 'cutting';  // Working File (10% scale) or Cutting File (100% scale)
  skipped_validation?: boolean;  // True if file was not validated (e.g., cutting files)
  skip_reason?: string;          // Reason validation was skipped
}

/**
 * Validation record from database
 */
export interface AiFileValidationRecord {
  validation_id: number;
  order_id: number;
  order_number: number;
  file_path: string;
  file_name: string;
  validation_status: ValidationStatus;
  validated_at: string | null;
  validated_by: number | null;
  approved_at: string | null;
  approved_by: number | null;
  issues: ValidationIssue[] | null;
  stats: ValidationStats | null;
  created_at: string;
  updated_at: string;
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

  // Generic
  [key: string]: any;
}

/**
 * Validation rule from database
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
  created_at: string;
  updated_at: string;
}

/**
 * AI file info (before validation)
 */
export interface AiFileInfo {
  file_path: string;
  file_name: string;
  size_bytes: number;
  modified_at: string;
  location: 'primary' | 'secondary';
  validation?: AiFileValidationRecord;
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
 * Response from approval endpoint
 */
export interface ApproveFilesResponse {
  approved_count: number;
}

// =============================================
// LETTER-HOLE ANALYSIS TYPES
// =============================================

/**
 * Information about a hole within a letter
 */
export interface HoleDetail {
  path_id: string;
  hole_type: 'wire' | 'mounting' | 'unknown';
  diameter_mm: number;       // File units (points) - used for SVG rendering
  diameter_real_mm?: number; // Actual diameter in millimeters
  center: { x: number; y: number };
  svg_path_data: string;
  transform?: string;  // SVG transform for this hole (may differ from letter's transform)
  fill?: string;       // Original SVG fill color
  stroke?: string;     // Original SVG stroke color
  matched_name?: string;     // Label from standard_hole_sizes (e.g. "LED Wire Hole")
  matched_size_id?: number;  // ID from standard_hole_sizes table
  layer_name?: string;       // Source layer name (for orphan hole grouping)
  file_bbox?: { x: number; y: number; width: number; height: number };  // Raw bbox for SVG viewBox
}

/**
 * Information about a single letter with its holes
 */
export interface LetterDetail {
  letter_id: string;
  layer_name: string;

  // File coordinates (as-is from SVG, matches path coordinates)
  file_bbox: { x: number; y: number; width: number; height: number };

  // SVG transform to apply to paths (if any)
  transform?: string;

  // Real-world dimensions (adjusted for scale)
  real_size_inches: { width: number; height: number };
  real_area_sq_inches: number;
  real_perimeter_inches: number;

  // Scale info
  detected_scale: number;  // 0.1 or 1.0

  // SVG path data
  svg_path_data: string;
  counter_paths: Array<{ d: string; transform?: string }>;
  holes: HoleDetail[];

  // Counts
  wire_hole_count: number;
  mounting_hole_count: number;
  unknown_hole_count: number;

  // Backend-generated validation issues for this letter
  issues?: ValidationIssue[];
}

/**
 * Complete letter analysis response from the backend
 */
export interface LetterAnalysisResponse {
  letters: LetterDetail[];
  orphan_holes: HoleDetail[];
  detected_scale: number;
  issues?: ValidationIssue[];
  stats: {
    total_letters: number;
    total_wire_holes: number;
    total_mounting_holes: number;
    total_unknown_holes: number;
    orphan_count: number;
    layers_analyzed?: string[];
    total_paths?: number;
    letters_found?: number;
    circles_found?: number;
  };
}

// =============================================
// EXPECTED FILES RULE SYSTEM
// =============================================

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

// Human-readable validation rule for display in the UI
export interface ValidationRuleDisplay {
  rule_key: string;       // e.g. "no_duplicate_overlapping"
  name: string;           // e.g. "No Duplicate Paths"
  description: string;    // e.g. "Detects duplicate or overlapping paths on same layer"
  category: string;       // "Global" or "Front Lit Channel Letters"
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
  validation_rules?: ValidationRuleDisplay[];
}
