/**
 * AI File Validation Service
 * Validates AI files in order folders - no database, just filesystem + Python validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { orderFormRepository } from '../repositories/orderFormRepository';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER, CANCELLED_FOLDER, HOLD_FOLDER } from '../config/paths';
import {
  AiFileInfo,
  FileValidationResult,
  ValidateFilesResponse,
  ServiceResult,
  ExpectedFilesComparison,
  FileComparisonEntry,
  FileExpectationRule,
  ValidationRuleConfig,
} from '../types/aiFileValidation';
import { fileExpectationRulesRepository } from '../repositories/fileExpectationRulesRepository';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

// =============================================
// SPEC-TYPE SPECIFIC VALIDATION RULES
// =============================================

/**
 * Front Lit channel letter validation rules
 * File scale: 10% (multiply by 10 for real-world dimensions)
 */
const FRONT_LIT_STRUCTURE_RULES: ValidationRuleConfig = {
  file_scale: 0.1,                    // 10% scale
  wire_hole_diameter_mm: 2.75,        // 9.7mm real at 10% scale
  wire_hole_tolerance_mm: 0.5,        // ±0.5mm tolerance
  mounting_hole_diameter_mm: 1.08,    // 3.81mm real at 10% scale
  mounting_hole_tolerance_mm: 0.3,    // ±0.3mm tolerance
  trim_offset_min_mm: 1.5,             // per side, in real mm (minimum acceptable offset)
  trim_offset_max_mm: 2.5,            // per side, in real mm (maximum at straight edges)
  miter_factor: 4.0,                  // corners can extend up to miter_factor * max before bevel
  min_mounting_holes: 2,
  mounting_holes_per_inch_perimeter: 0.05,  // 1 per 20" real
  mounting_holes_per_sq_inch_area: 0.0123,  // 1 per 81 sq in real
  check_wire_holes: true,             // Front lit always has LEDs
  return_layer: 'return',             // Layer name for returns
  trim_layer: 'trimcap',              // Layer name for trim caps
};

/**
 * Determine which spec types are present in order parts
 */
function detectSpecTypes(specsDisplayNames: string[]): Set<string> {
  const specTypes = new Set<string>();

  for (const name of specsDisplayNames) {
    const lowerName = name.toLowerCase();

    // Front Lit detection
    if (lowerName.includes('front lit') || lowerName.includes('frontlit')) {
      specTypes.add('front_lit');
    }
    // Halo Lit detection (future)
    else if (lowerName.includes('halo') || lowerName.includes('back lit') || lowerName.includes('backlit')) {
      specTypes.add('halo_lit');
    }
    // Non-lit detection (future)
    else if (lowerName.includes('non lit') || lowerName.includes('non-lit') || lowerName.includes('nonlit')) {
      specTypes.add('non_lit');
    }
  }

  return specTypes;
}

// Path helpers
const LEGACY_ACTIVE_PATH = SMB_ROOT;
const LEGACY_FINISHED_PATH = path.join(SMB_ROOT, FINISHED_FOLDER);
const NEW_ACTIVE_PATH = path.join(SMB_ROOT, ORDERS_FOLDER);
const NEW_FINISHED_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER);
const NEW_CANCELLED_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, CANCELLED_FOLDER);
const NEW_HOLD_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, HOLD_FOLDER);

// Python script paths - resolve from project root
const PYTHON_SCRIPT_PATH = path.resolve(__dirname, '../../src/scripts/python/validate_ai_file.py');
const AI_VERSION_SCRIPT_PATH = path.resolve(__dirname, '../../src/scripts/python/extract_ai_version.py');

export class AiFileValidationService {
  /**
   * Get folder path based on location and migration status
   */
  private getFolderPath(
    folderName: string,
    location: 'active' | 'finished' | 'cancelled' | 'hold',
    isMigrated: boolean = false
  ): string {
    if (isMigrated) {
      if (location === 'active' || location === 'cancelled' || location === 'hold') {
        return path.join(LEGACY_ACTIVE_PATH, folderName);
      }
      return path.join(LEGACY_FINISHED_PATH, folderName);
    } else {
      switch (location) {
        case 'active':
          return path.join(NEW_ACTIVE_PATH, folderName);
        case 'finished':
          return path.join(NEW_FINISHED_PATH, folderName);
        case 'cancelled':
          return path.join(NEW_CANCELLED_PATH, folderName);
        case 'hold':
          return path.join(NEW_HOLD_PATH, folderName);
        default:
          return path.join(NEW_ACTIVE_PATH, folderName);
      }
    }
  }

  /**
   * List AI files in order folder (filesystem only, no database)
   */
  async listAiFiles(orderNumber: number): Promise<ServiceResult<AiFileInfo[]>> {
    try {
      const order = await orderFormRepository.getOrderFolderDetails(orderNumber);
      if (!order) {
        return { success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' };
      }

      if (!order.folder_name || order.folder_location === 'none') {
        return { success: false, error: 'Order does not have a folder', code: 'NO_FOLDER' };
      }

      const folderPath = this.getFolderPath(
        order.folder_name,
        order.folder_location as 'active' | 'finished' | 'cancelled' | 'hold',
        order.is_migrated
      );

      if (!fs.existsSync(folderPath)) {
        return { success: false, error: 'Order folder does not exist', code: 'FOLDER_NOT_FOUND' };
      }

      const files = fs.readdirSync(folderPath);
      const aiFiles: AiFileInfo[] = [];

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext !== '.ai') continue;

        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);

        if (!stats.isFile()) continue;

        aiFiles.push({
          file_path: filePath,
          file_name: file,
          size_bytes: stats.size,
          modified_at: stats.mtime,
        });
      }

      aiFiles.sort((a, b) => a.file_name.localeCompare(b.file_name));

      return { success: true, data: aiFiles };
    } catch (error) {
      console.error('[AiFileValidationService] Error listing AI files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list AI files',
        code: 'LIST_ERROR',
      };
    }
  }

  /**
   * Build validation rules based on detected spec types
   */
  private buildValidationRules(specTypes: Set<string>): Record<string, ValidationRuleConfig> {
    const rules: Record<string, ValidationRuleConfig> = {
      // Base rules always applied
      no_duplicate_overlapping: {
        tolerance: 0.01
      },
      stroke_requirements: {
        allow_fill: false  // Only check for no fill; color and width not enforced
      },
    };

    // Add spec-type specific rules
    if (specTypes.has('front_lit')) {
      rules.front_lit_structure = { ...FRONT_LIT_STRUCTURE_RULES };
    }

    // Future: Add halo_lit, non_lit rules here

    return rules;
  }

  /**
   * Run Python validation script on a single file
   */
  private async runPythonValidation(
    filePath: string,
    specTypes: Set<string> = new Set()
  ): Promise<FileValidationResult> {
    return new Promise((resolve) => {
      const fileName = path.basename(filePath);

      if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
        resolve({
          success: false,
          file_path: filePath,
          file_name: fileName,
          status: 'error',
          issues: [],
          stats: { total_paths: 0, closed_paths: 0, paths_with_stroke: 0, paths_with_fill: 0, total_holes: 0, total_area: 0, total_perimeter: 0 },
          error: 'Validation script not found',
        });
        return;
      }

      // Build validation rules based on spec types
      const validationRules = this.buildValidationRules(specTypes);

      console.log(`[AiFileValidation] Validating ${fileName} with spec types: ${Array.from(specTypes).join(', ') || 'none'}`);

      const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH, filePath, '--rules-json', JSON.stringify(validationRules)]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

      pythonProcess.on('close', (code) => {
        // Log Python stderr for debugging (debug prints go there)
        if (stderr) {
          console.error(`[AiFileValidation] Python stderr:\n${stderr}`);
        }
        try {
          const result = JSON.parse(stdout);
          resolve(result as FileValidationResult);
        } catch {
          resolve({
            success: false,
            file_path: filePath,
            file_name: fileName,
            status: 'error',
            issues: [],
            stats: { total_paths: 0, closed_paths: 0, paths_with_stroke: 0, paths_with_fill: 0, total_holes: 0, total_area: 0, total_perimeter: 0 },
            error: stderr || stdout || 'Failed to parse validation output',
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          file_path: filePath,
          file_name: fileName,
          status: 'error',
          issues: [],
          stats: { total_paths: 0, closed_paths: 0, paths_with_stroke: 0, paths_with_fill: 0, total_holes: 0, total_area: 0, total_perimeter: 0 },
          error: error.message,
        });
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          file_path: filePath,
          file_name: fileName,
          status: 'error',
          issues: [],
          stats: { total_paths: 0, closed_paths: 0, paths_with_stroke: 0, paths_with_fill: 0, total_holes: 0, total_area: 0, total_perimeter: 0 },
          error: 'Validation timed out',
        });
      }, 60000);
    });
  }

  /**
   * Validate AI files for an order
   * - Working file*.ai: Full Python validation with spec-type-specific rules
   * - Other .ai files: Just verify they exist
   */
  async validateFiles(orderNumber: number): Promise<ServiceResult<ValidateFilesResponse>> {
    try {
      // List all AI files
      const listResult = await this.listAiFiles(orderNumber);
      if (!listResult.success || !listResult.data) {
        return { success: false, error: listResult.error || 'Failed to list files', code: listResult.code };
      }

      const files = listResult.data;
      if (files.length === 0) {
        return {
          success: true,
          data: {
            success: true,
            order_number: orderNumber,
            total_files: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: 0,
            results: [],
            message: 'No AI files found in order folder',
          },
        };
      }

      // Detect spec types from order parts for spec-specific validation
      const orderId = await this.getOrderIdFromNumber(orderNumber);
      let specTypes = new Set<string>();

      if (orderId) {
        const specsDisplayNames = await this.getOrderSpecsDisplayNames(orderId);
        specTypes = detectSpecTypes(specsDisplayNames);
        console.log(`[AiFileValidation] Order ${orderNumber} spec types detected: ${Array.from(specTypes).join(', ') || 'none'}`);
      }

      const results: FileValidationResult[] = [];
      let passed = 0, failed = 0, warnings = 0, errors = 0;

      for (const file of files) {
        const fileNameLower = file.file_name.toLowerCase();
        const isWorkingFile = fileNameLower.startsWith('working file') || fileNameLower.startsWith('working_file');

        let result: FileValidationResult;

        if (isWorkingFile) {
          // Full validation for working files with spec-type-specific rules
          result = await this.runPythonValidation(file.file_path, specTypes);
        } else {
          // Just verify existence for other files (cutting files, etc.)
          result = {
            success: true,
            file_path: file.file_path,
            file_name: file.file_name,
            status: 'passed',
            issues: [],
            stats: { total_paths: 0, closed_paths: 0, paths_with_stroke: 0, paths_with_fill: 0, total_holes: 0, total_area: 0, total_perimeter: 0 },
            skipped_validation: true,
            skip_reason: 'Cutting file - existence verified',
          };
        }

        results.push(result);

        switch (result.status) {
          case 'passed': passed++; break;
          case 'failed': failed++; break;
          case 'warning': warnings++; break;
          case 'error': errors++; break;
        }
      }

      return {
        success: true,
        data: {
          success: failed === 0 && errors === 0,
          order_number: orderNumber,
          total_files: results.length,
          passed,
          failed,
          warnings,
          errors,
          results,
        },
      };
    } catch (error) {
      console.error('[AiFileValidationService] Error validating files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        code: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Extract AI version from a single file using Python script
   */
  private async extractAiVersion(filePath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (!fs.existsSync(AI_VERSION_SCRIPT_PATH)) {
        console.warn('[AiFileValidationService] AI version extraction script not found');
        resolve(undefined);
        return;
      }

      const pythonProcess = spawn('python3', [AI_VERSION_SCRIPT_PATH, filePath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

      pythonProcess.on('close', () => {
        try {
          const result = JSON.parse(stdout);
          if (result.success && result.display_name) {
            resolve(result.display_name);
          } else {
            resolve(undefined);
          }
        } catch {
          console.warn('[AiFileValidationService] Failed to parse AI version output:', stderr || stdout);
          resolve(undefined);
        }
      });

      pythonProcess.on('error', () => {
        resolve(undefined);
      });

      // Timeout after 5 seconds (version extraction should be fast)
      setTimeout(() => {
        pythonProcess.kill();
        resolve(undefined);
      }, 5000);
    });
  }

  /**
   * Get order ID from order number
   */
  private async getOrderIdFromNumber(orderNumber: number): Promise<number | null> {
    const rows = await query(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumber]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].order_id : null;
  }

  /**
   * Get unique specs_display_name values from order parts
   */
  private async getOrderSpecsDisplayNames(orderId: number): Promise<string[]> {
    const rows = await query(
      'SELECT DISTINCT specs_display_name FROM order_parts WHERE order_id = ? AND specs_display_name IS NOT NULL AND specs_display_name != ""',
      [orderId]
    ) as RowDataPacket[];

    return rows.map(r => r.specs_display_name).filter(Boolean);
  }

  /**
   * Get expected files comparison for an order
   * Compares files expected by rules against actual files in folder
   */
  async getExpectedFilesComparison(orderNumber: number): Promise<ServiceResult<ExpectedFilesComparison>> {
    try {
      // 1. Get order ID
      const orderId = await this.getOrderIdFromNumber(orderNumber);
      if (!orderId) {
        return { success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' };
      }

      // 2. Get specs_display_name values from order parts
      const specsDisplayNames = await this.getOrderSpecsDisplayNames(orderId);
      console.log(`[ExpectedFiles] Order ${orderNumber} has specs_display_names:`, specsDisplayNames);

      // 3. Get rules matching these specs_display_names
      const matchingRules = specsDisplayNames.length > 0
        ? await fileExpectationRulesRepository.getRulesByConditionValues('specs_display_name', specsDisplayNames)
        : [];
      console.log(`[ExpectedFiles] Found ${matchingRules.length} matching rules`);

      // 4. Build expected files map (filename -> rule info)
      // Dedupe by filename - if multiple rules expect same file, combine them
      const expectedFilesMap = new Map<string, {
        filename: string;
        is_required: boolean;
        matched_rules: string[];
      }>();

      for (const rule of matchingRules) {
        const existing = expectedFilesMap.get(rule.expected_filename.toLowerCase());
        if (existing) {
          // Add rule to existing entry
          existing.matched_rules.push(rule.rule_name);
          // If any rule requires it, mark as required
          if (rule.is_required) {
            existing.is_required = true;
          }
        } else {
          expectedFilesMap.set(rule.expected_filename.toLowerCase(), {
            filename: rule.expected_filename,
            is_required: rule.is_required,
            matched_rules: [rule.rule_name],
          });
        }
      }

      // 5. Get actual AI files from order folder
      const listResult = await this.listAiFiles(orderNumber);
      if (!listResult.success) {
        // If no folder, return comparison with folder_exists: false
        if (listResult.code === 'NO_FOLDER' || listResult.code === 'FOLDER_NOT_FOUND') {
          return {
            success: true,
            data: {
              order_number: orderNumber,
              folder_exists: false,
              summary: {
                total_expected: expectedFilesMap.size,
                present: 0,
                missing_required: Array.from(expectedFilesMap.values()).filter(e => e.is_required).length,
                missing_optional: Array.from(expectedFilesMap.values()).filter(e => !e.is_required).length,
                unexpected: 0,
              },
              files: Array.from(expectedFilesMap.values()).map(e => ({
                filename: e.filename,
                status: 'missing' as const,
                is_required: e.is_required,
                matched_rules: e.matched_rules,
              })),
            },
          };
        }
        return { success: false, error: listResult.error, code: listResult.code };
      }

      const actualFiles = listResult.data || [];
      const actualFilesMap = new Map<string, AiFileInfo>();
      for (const file of actualFiles) {
        actualFilesMap.set(file.file_name.toLowerCase(), file);
      }

      // 6. Build comparison entries
      const comparisonEntries: FileComparisonEntry[] = [];
      const processedFilenames = new Set<string>();

      // Process expected files
      for (const [lowerFilename, expected] of expectedFilesMap) {
        const actualFile = actualFilesMap.get(lowerFilename);
        processedFilenames.add(lowerFilename);

        if (actualFile) {
          // File exists - extract AI version
          const aiVersion = await this.extractAiVersion(actualFile.file_path);
          comparisonEntries.push({
            filename: actualFile.file_name, // Use actual filename (preserves case)
            detected_ai_version: aiVersion,
            file_path: actualFile.file_path,
            status: 'present',
            is_required: expected.is_required,
            matched_rules: expected.matched_rules,
          });
        } else {
          // File missing
          comparisonEntries.push({
            filename: expected.filename,
            status: 'missing',
            is_required: expected.is_required,
            matched_rules: expected.matched_rules,
          });
        }
      }

      // Process unexpected files (actual files not in expected list)
      for (const [lowerFilename, actualFile] of actualFilesMap) {
        if (!processedFilenames.has(lowerFilename)) {
          const aiVersion = await this.extractAiVersion(actualFile.file_path);
          comparisonEntries.push({
            filename: actualFile.file_name,
            detected_ai_version: aiVersion,
            file_path: actualFile.file_path,
            status: 'unexpected',
            is_required: false,
            matched_rules: [],
          });
        }
      }

      // Sort: present first, then missing, then unexpected; alphabetically within each group
      comparisonEntries.sort((a, b) => {
        const statusOrder = { present: 0, missing: 1, unexpected: 2 };
        const orderDiff = statusOrder[a.status] - statusOrder[b.status];
        if (orderDiff !== 0) return orderDiff;
        return a.filename.localeCompare(b.filename);
      });

      // 7. Calculate summary
      const summary = {
        total_expected: expectedFilesMap.size,
        present: comparisonEntries.filter(e => e.status === 'present').length,
        missing_required: comparisonEntries.filter(e => e.status === 'missing' && e.is_required).length,
        missing_optional: comparisonEntries.filter(e => e.status === 'missing' && !e.is_required).length,
        unexpected: comparisonEntries.filter(e => e.status === 'unexpected').length,
      };

      return {
        success: true,
        data: {
          order_number: orderNumber,
          folder_exists: true,
          summary,
          files: comparisonEntries,
        },
      };
    } catch (error) {
      console.error('[AiFileValidationService] Error getting expected files comparison:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare expected files',
        code: 'COMPARISON_ERROR',
      };
    }
  }
}

export const aiFileValidationService = new AiFileValidationService();
