/**
 * AI File Validation — Expected Files Comparison
 * Compares files expected by rules against actual files in order folder
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  AiFileInfo,
  FileComparisonEntry,
  ExpectedFilesComparison,
  ServiceResult,
} from '../types/aiFileValidation';
import { fileExpectationRulesRepository } from '../repositories/fileExpectationRulesRepository';
import { detectSpecTypes, getValidationRuleDescriptions } from './aiFileValidationRules';
import { buildConditionTree, evaluateCondition, OrderConditionContext } from '../utils/conditionTree';

// Python script path for AI version extraction
const AI_VERSION_SCRIPT_PATH = path.resolve(__dirname, '../../src/scripts/python/extract_ai_version.py');

/**
 * Extract AI version from a single file using Python script
 */
async function extractAiVersion(filePath: string): Promise<string | undefined> {
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

interface ExpectedFilesDeps {
  getOrderIdFromNumber(orderNumber: number): Promise<number | null>;
  getOrderSpecsDisplayNames(orderId: number): Promise<string[]>;
  getOrderApplications?(orderId: number): Promise<string[]>;
  listAiFiles(orderNumber: number, options?: { includePostScript?: boolean }): Promise<ServiceResult<AiFileInfo[]>>;
}

/**
 * Get expected files comparison for an order
 * Compares files expected by rules against actual files in folder
 */
export async function getExpectedFilesComparison(
  orderNumber: number,
  deps: ExpectedFilesDeps
): Promise<ServiceResult<ExpectedFilesComparison>> {
  try {
    // 1. Get order ID
    const orderId = await deps.getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return { success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' };
    }

    // 2. Get specs_display_name values from order parts
    const specsDisplayNames = await deps.getOrderSpecsDisplayNames(orderId);
    console.log(`[ExpectedFiles] Order ${orderNumber} has specs_display_names:`, specsDisplayNames);

    // 2b. Detect spec types and build validation rule descriptions
    const specTypes = detectSpecTypes(specsDisplayNames);
    const validationRules = getValidationRuleDescriptions(specTypes);

    // 2c. Build condition context for tree evaluation
    const applications = deps.getOrderApplications
      ? await deps.getOrderApplications(orderId)
      : [];

    const conditionContext: OrderConditionContext = {
      specs_display_names: specsDisplayNames,
      applications,
      parts: specsDisplayNames.map(name => ({ specs_display_name: name, specifications: {} })),
    };

    // 3. Load all active rules with condition trees and evaluate
    const allRulesWithConditions = await fileExpectationRulesRepository.getActiveRulesWithConditions();
    const matchingRules = allRulesWithConditions.filter(rule => {
      const tree = buildConditionTree(rule.conditionRows);
      return evaluateCondition(tree, conditionContext);
    });
    console.log(`[ExpectedFiles] Found ${matchingRules.length} matching rules (from ${allRulesWithConditions.length} active)`);

    // 4. Build expected files map (filename -> rule info)
    const expectedFilesMap = new Map<string, {
      filename: string;
      is_required: boolean;
      matched_rules: string[];
    }>();

    for (const rule of matchingRules) {
      const existing = expectedFilesMap.get(rule.expected_filename.toLowerCase());
      if (existing) {
        existing.matched_rules.push(rule.rule_name);
        if (rule.is_required) {
          existing.is_required = true;
        }
      } else {
        expectedFilesMap.set(rule.expected_filename.toLowerCase(), {
          filename: rule.expected_filename,
          is_required: !!rule.is_required,
          matched_rules: [rule.rule_name],
        });
      }
    }

    // 5. Get actual AI files from order folder (include PostScript so they appear in comparison)
    const listResult = await deps.listAiFiles(orderNumber, { includePostScript: true });
    if (!listResult.success) {
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
            validation_rules: validationRules,
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

    for (const [lowerFilename, expected] of expectedFilesMap) {
      const actualFile = actualFilesMap.get(lowerFilename);
      processedFilenames.add(lowerFilename);

      if (actualFile) {
        const aiVersion = await extractAiVersion(actualFile.file_path);
        comparisonEntries.push({
          filename: actualFile.file_name,
          detected_ai_version: aiVersion,
          file_path: actualFile.file_path,
          status: 'present',
          is_required: expected.is_required,
          matched_rules: expected.matched_rules,
        });
      } else {
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
        const aiVersion = await extractAiVersion(actualFile.file_path);
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
        validation_rules: validationRules,
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
