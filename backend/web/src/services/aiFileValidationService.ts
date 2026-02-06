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
  ValidationRuleConfig,
} from '../types/aiFileValidation';
import { aiFileValidationRepository } from '../repositories/aiFileValidationRepository';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { detectSpecTypes, buildValidationRules, buildCuttingFileRules } from './aiFileValidationRules';
import { getExpectedFilesComparison } from './aiFileValidationExpectedFiles';

// Path helpers
const LEGACY_ACTIVE_PATH = SMB_ROOT;
const LEGACY_FINISHED_PATH = path.join(SMB_ROOT, FINISHED_FOLDER);
const NEW_ACTIVE_PATH = path.join(SMB_ROOT, ORDERS_FOLDER);
const NEW_FINISHED_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER);
const NEW_CANCELLED_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, CANCELLED_FOLDER);
const NEW_HOLD_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, HOLD_FOLDER);

// Python script paths - resolve from project root
const PYTHON_SCRIPT_PATH = path.resolve(__dirname, '../../src/scripts/python/validate_ai_file.py');

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
   * Checks both primary and secondary paths, aggregates results
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

      const primaryPath = this.getFolderPath(
        order.folder_name,
        order.folder_location as 'active' | 'finished' | 'cancelled' | 'hold',
        order.is_migrated
      );
      const secondaryPath = !order.is_migrated ? path.join(SMB_ROOT, order.folder_name) : null;

      const aiFiles: AiFileInfo[] = [];
      const seenFilenames = new Set<string>();

      const processDirectory = (dirPath: string, fileLocation: 'primary' | 'secondary') => {
        if (!fs.existsSync(dirPath)) return;

        try {
          const files = fs.readdirSync(dirPath);

          for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (ext !== '.ai' && ext !== '.svg') continue;

            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);

            if (!stats.isFile()) continue;

            // Skip old PostScript-based AI files (AI 8.0 and earlier)
            // They can't be converted reliably — designers should export SVG instead
            // Modern AI files are PDF-based and start with %PDF
            if (ext === '.ai') {
              try {
                const fd = fs.openSync(filePath, 'r');
                const buf = Buffer.alloc(10);
                fs.readSync(fd, buf, 0, 10, 0);
                fs.closeSync(fd);
                if (!buf.toString('ascii').startsWith('%PDF')) continue;
              } catch {
                continue;
              }
            }

            const lowerFilename = file.toLowerCase();
            if (seenFilenames.has(lowerFilename)) continue;

            seenFilenames.add(lowerFilename);
            aiFiles.push({
              file_path: filePath,
              file_name: file,
              size_bytes: stats.size,
              modified_at: stats.mtime,
              location: fileLocation,
            });
          }
        } catch (error) {
          console.warn(`[AiFileValidationService] Error reading directory ${dirPath}:`, error);
        }
      };

      processDirectory(primaryPath, 'primary');

      if (secondaryPath && secondaryPath !== primaryPath) {
        processDirectory(secondaryPath, 'secondary');
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
   * Run Python validation script on a single file
   * @param rulesOverride - When provided, use these rules instead of building from specTypes
   */
  private async runPythonValidation(
    filePath: string,
    specTypes: Set<string> = new Set(),
    rulesOverride?: Record<string, ValidationRuleConfig>
  ): Promise<FileValidationResult> {
    return new Promise((resolve) => {
      const fileName = path.basename(filePath);
      const emptyStats = { total_paths: 0, closed_paths: 0, paths_with_stroke: 0, paths_with_fill: 0, total_holes: 0, total_area: 0, total_perimeter: 0 };

      if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
        resolve({ success: false, file_path: filePath, file_name: fileName, status: 'error', issues: [], stats: emptyStats, error: 'Validation script not found' });
        return;
      }

      const validationRules = rulesOverride || buildValidationRules(specTypes);

      console.log(`[AiFileValidation] Validating ${fileName} with ${rulesOverride ? 'custom rules' : `spec types: ${Array.from(specTypes).join(', ') || 'none'}`}`);

      const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH, filePath, '--rules-json', JSON.stringify(validationRules)]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

      pythonProcess.on('close', () => {
        if (stderr) {
          console.error(`[AiFileValidation] Python stderr:\n${stderr}`);
        }
        try {
          const result = JSON.parse(stdout);
          resolve(result as FileValidationResult);
        } catch {
          resolve({ success: false, file_path: filePath, file_name: fileName, status: 'error', issues: [], stats: emptyStats, error: stderr || stdout || 'Failed to parse validation output' });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({ success: false, file_path: filePath, file_name: fileName, status: 'error', issues: [], stats: emptyStats, error: error.message });
      });

      setTimeout(() => {
        pythonProcess.kill();
        resolve({ success: false, file_path: filePath, file_name: fileName, status: 'error', issues: [], stats: emptyStats, error: 'Validation timed out' });
      }, 60000);
    });
  }

  /**
   * Validate AI files for an order
   * - Working file*.ai: Full Python validation with spec-type-specific rules
   * - Other .ai files: Full analysis at 100% scale (cutting files)
   */
  async validateFiles(orderNumber: number): Promise<ServiceResult<ValidateFilesResponse>> {
    try {
      const listResult = await this.listAiFiles(orderNumber);
      if (!listResult.success || !listResult.data) {
        return { success: false, error: listResult.error || 'Failed to list files', code: listResult.code };
      }

      const files = listResult.data;
      if (files.length === 0) {
        return {
          success: true,
          data: {
            success: true, order_number: orderNumber, total_files: 0,
            passed: 0, failed: 0, warnings: 0, errors: 0,
            results: [], message: 'No AI files found in order folder',
          },
        };
      }

      // Load standard hole sizes from database
      const standardHoleSizes = await aiFileValidationRepository.getActiveHoleSizes();

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

      // Pre-build rules for working files and cutting files
      const workingFileRules = buildValidationRules(specTypes, standardHoleSizes);
      const cuttingFileRules = buildCuttingFileRules(standardHoleSizes);

      for (const file of files) {
        const fileNameLower = file.file_name.toLowerCase();
        const isWorkingFile = fileNameLower.startsWith('working file') || fileNameLower.startsWith('working_file');

        let result: FileValidationResult;

        if (isWorkingFile) {
          result = await this.runPythonValidation(file.file_path, specTypes, workingFileRules);
          result.file_type = 'working';
        } else {
          // Full analysis for cutting files at 100% scale
          result = await this.runPythonValidation(file.file_path, new Set(), cuttingFileRules);
          result.file_type = 'cutting';
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
          passed, failed, warnings, errors, results,
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
   * Get order ID from order number
   */
  async getOrderIdFromNumber(orderNumber: number): Promise<number | null> {
    const rows = await query(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumber]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].order_id : null;
  }

  /**
   * Get unique specs_display_name values from order parts
   */
  async getOrderSpecsDisplayNames(orderId: number): Promise<string[]> {
    const rows = await query(
      'SELECT DISTINCT specs_display_name FROM order_parts WHERE order_id = ? AND specs_display_name IS NOT NULL AND specs_display_name != ""',
      [orderId]
    ) as RowDataPacket[];

    return rows.map(r => r.specs_display_name).filter(Boolean);
  }

  /**
   * Get expected files comparison for an order (delegates to extracted module)
   */
  async getExpectedFilesComparison(orderNumber: number): Promise<ServiceResult<ExpectedFilesComparison>> {
    return getExpectedFilesComparison(orderNumber, {
      getOrderIdFromNumber: (n) => this.getOrderIdFromNumber(n),
      getOrderSpecsDisplayNames: (id) => this.getOrderSpecsDisplayNames(id),
      listAiFiles: (n) => this.listAiFiles(n),
    });
  }
}

export const aiFileValidationService = new AiFileValidationService();
