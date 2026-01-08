/**
 * Settings Controller
 * HTTP request handling for settings management
 *
 * Created: 2025-12-15
 * Part of Phase 3: Settings & Templates UI
 */

import { Request, Response } from 'express';
import { settingsService } from '../services/settingsService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

// Extended request type with user
interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role: string;
  };
}

export class SettingsController {
  // ==========================================================================
  // Task Configuration
  // ==========================================================================

  async getAllTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await settingsService.getTaskConfiguration(includeInactive);
    handleServiceResult(res, result);
  }

  async updateTaskOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return sendErrorResponse(res, 'Invalid orders array', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateTaskOrder(orders, userId);
    handleServiceResult(res, result);
  }

  async updateTaskRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const taskId = parseIntParam(req.params.taskId, 'Task ID');
    if (taskId === null) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const { assigned_role } = req.body;
    if (!assigned_role) {
      return sendErrorResponse(res, 'assigned_role is required', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateTaskRole(taskId, assigned_role, userId);
    handleServiceResult(res, result);
  }

  async createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { task_name, assigned_role, description } = req.body;
    if (!task_name || !assigned_role) {
      return sendErrorResponse(res, 'task_name and assigned_role are required', 'VALIDATION_ERROR');
    }

    const result = await settingsService.createTask({ task_name, assigned_role, description }, userId);
    handleServiceResult(res, result, { successStatus: 201 });
  }

  async updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const taskId = parseIntParam(req.params.taskId, 'Task ID');
    if (taskId === null) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateTask(taskId, req.body, userId);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Production Roles
  // ==========================================================================

  async getAllRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await settingsService.getProductionRoles(includeInactive);
    handleServiceResult(res, result);
  }

  async updateRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const roleId = parseIntParam(req.params.roleId, 'Role ID');
    if (roleId === null) {
      return sendErrorResponse(res, 'Invalid role ID', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateProductionRole(roleId, req.body, userId);
    handleServiceResult(res, result);
  }

  async updateRoleOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return sendErrorResponse(res, 'Invalid orders array', 'VALIDATION_ERROR');
    }

    const result = await settingsService.reorderProductionRoles(orders, userId);
    handleServiceResult(res, result);
  }

  async createRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { role_key, display_name, color_hex, color_bg_class, color_text_class, description } = req.body;
    if (!role_key || !display_name) {
      return sendErrorResponse(res, 'role_key and display_name are required', 'VALIDATION_ERROR');
    }

    const result = await settingsService.createProductionRole(
      { role_key, display_name, color_hex, color_bg_class, color_text_class, description },
      userId
    );
    handleServiceResult(res, result, { successStatus: 201 });
  }

  // ==========================================================================
  // Specification Options
  // ==========================================================================

  async getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await settingsService.getSpecificationCategories();
    handleServiceResult(res, result);
  }

  async getOptionsByCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { category } = req.params;
    const includeInactive = req.query.includeInactive === 'true';
    const result = await settingsService.getOptionsForCategory(category, includeInactive);
    handleServiceResult(res, result);
  }

  async createOption(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { category } = req.params;
    const { option_value, display_order } = req.body;

    if (!option_value) {
      return sendErrorResponse(res, 'option_value is required', 'VALIDATION_ERROR');
    }

    const result = await settingsService.createOption(category, { option_value, display_order }, userId);
    handleServiceResult(res, result, { successStatus: 201 });
  }

  async updateOption(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const optionId = parseIntParam(req.params.optionId, 'Option ID');
    if (optionId === null) {
      return sendErrorResponse(res, 'Invalid option ID', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateOption(optionId, req.body, userId);
    handleServiceResult(res, result);
  }

  async reorderOptions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { category } = req.params;
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      return sendErrorResponse(res, 'Invalid orders array', 'VALIDATION_ERROR');
    }

    const result = await settingsService.reorderOptions(category, orders, userId);
    handleServiceResult(res, result);
  }

  async deactivateOption(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const optionId = parseIntParam(req.params.optionId, 'Option ID');
    if (optionId === null) {
      return sendErrorResponse(res, 'Invalid option ID', 'VALIDATION_ERROR');
    }

    const result = await settingsService.deactivateOption(optionId, userId);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Painting Matrix
  // ==========================================================================

  async getProductTypes(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await settingsService.getAvailableProductTypes();
    handleServiceResult(res, result);
  }

  async getMatrixByProductType(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { productTypeKey } = req.params;
    const result = await settingsService.getMatrixForProductType(productTypeKey);
    handleServiceResult(res, result);
  }

  async updateMatrixEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const matrixId = parseIntParam(req.params.matrixId, 'Matrix ID');
    if (matrixId === null) {
      return sendErrorResponse(res, 'Invalid matrix ID', 'VALIDATION_ERROR');
    }

    const { task_numbers } = req.body;
    // task_numbers can be null or an array
    if (task_numbers !== null && !Array.isArray(task_numbers)) {
      return sendErrorResponse(res, 'task_numbers must be an array or null', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateMatrixCell(matrixId, task_numbers, userId);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Email Templates
  // ==========================================================================

  async getAllTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await settingsService.getAllTemplates();
    handleServiceResult(res, result);
  }

  async getTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { templateKey } = req.params;
    const result = await settingsService.getTemplate(templateKey);
    handleServiceResult(res, result);
  }

  async updateTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const { templateKey } = req.params;
    const { subject, body } = req.body;

    if (!subject || !body) {
      return sendErrorResponse(res, 'subject and body are required', 'VALIDATION_ERROR');
    }

    const result = await settingsService.updateTemplate(templateKey, subject, body, userId);
    handleServiceResult(res, result);
  }

  async previewTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { templateKey } = req.params;
    const { subject, body } = req.body;

    if (!subject || !body) {
      return sendErrorResponse(res, 'subject and body are required', 'VALIDATION_ERROR');
    }

    const result = await settingsService.previewTemplate(templateKey, subject, body);
    handleServiceResult(res, result);
  }

  async resetTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Reset is not implemented yet - would require storing default templates
    return sendErrorResponse(res, 'Reset functionality not yet implemented', 'NOT_IMPLEMENTED');
  }

  // ==========================================================================
  // Settings Categories
  // ==========================================================================

  async getSettingsCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userRole = req.user?.role || 'manager';
    const result = await settingsService.getSettingsCategories(userRole);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Company Settings
  // ==========================================================================

  async getCompanySettings(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await settingsService.getCompanySettings();
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Audit Log
  // ==========================================================================

  async getAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { tableName, userId: filterUserId, limit, offset } = req.query;

    const filters = {
      tableName: tableName as string | undefined,
      userId: filterUserId ? parseInt(filterUserId as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    };

    const result = await settingsService.getAuditLog(filters);
    handleServiceResult(res, result);
  }
}

// Export singleton instance
export const settingsController = new SettingsController();
