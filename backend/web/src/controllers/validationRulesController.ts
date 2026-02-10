/**
 * Validation Rules Controller
 * HTTP request handling for file expectation rules and standard file names
 */

import { Request, Response } from 'express';
import { validationRulesService } from '../services/validationRulesService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

interface AuthenticatedRequest extends Request {
  user?: { user_id: number; role: string };
}

class ValidationRulesController {
  // =============================================================================
  // EXPECTED FILE RULES
  // =============================================================================

  async getRules(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await validationRulesService.getAllRules();
    handleServiceResult(res, result);
  }

  async createRule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { rule_name, expected_filename, file_name_id, is_required, description, conditionTree } = req.body;

    if (!rule_name || !expected_filename) {
      return sendErrorResponse(res, 'rule_name and expected_filename are required', 'VALIDATION_ERROR');
    }

    const result = await validationRulesService.createRule({
      rule_name,
      expected_filename,
      file_name_id: file_name_id ?? null,
      is_required: is_required ?? true,
      description,
      conditionTree: conditionTree ?? null,
    });
    handleServiceResult(res, result, { successStatus: 201 });
  }

  async updateRule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const ruleId = parseIntParam(req.params.id, 'Rule ID');
    if (ruleId === null) {
      return sendErrorResponse(res, 'Invalid rule ID', 'VALIDATION_ERROR');
    }

    const result = await validationRulesService.updateRule(ruleId, req.body);
    handleServiceResult(res, result);
  }

  async deleteRule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const ruleId = parseIntParam(req.params.id, 'Rule ID');
    if (ruleId === null) {
      return sendErrorResponse(res, 'Invalid rule ID', 'VALIDATION_ERROR');
    }

    const result = await validationRulesService.deleteRule(ruleId);
    handleServiceResult(res, result);
  }

  // =============================================================================
  // STANDARD FILE NAMES
  // =============================================================================

  async getStandardFileNames(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await validationRulesService.getStandardFileNames();
    handleServiceResult(res, result);
  }

  async createStandardFileName(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { name, description, category } = req.body;

    if (!name) {
      return sendErrorResponse(res, 'name is required', 'VALIDATION_ERROR');
    }

    const result = await validationRulesService.createStandardFileName({ name, description, category });
    handleServiceResult(res, result, { successStatus: 201 });
  }

  async updateStandardFileName(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = parseIntParam(req.params.id, 'File Name ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid file name ID', 'VALIDATION_ERROR');
    }

    const result = await validationRulesService.updateStandardFileName(id, req.body);
    handleServiceResult(res, result);
  }

  // =============================================================================
  // CONDITION FIELD OPTIONS
  // =============================================================================

  async getConditionFieldOptions(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await validationRulesService.getConditionFieldOptions();
    handleServiceResult(res, result);
  }
}

export const validationRulesController = new ValidationRulesController();
