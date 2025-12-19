// Phase 4.b: Material Categories Controller
// Created: 2025-12-18
import { Request, Response } from 'express';
import { CategoryService } from '../../services/supplyChain/categoryService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

const categoryService = new CategoryService();

/**
 * Get all categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const { active_only } = req.query;
  const result = await categoryService.getCategories(active_only !== 'false');
  handleServiceResult(res, result);
};

/**
 * Get single category by ID
 */
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Category ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid category ID', 'VALIDATION_ERROR');
  }

  const result = await categoryService.getCategoryById(id);
  handleServiceResult(res, result);
};

/**
 * Create new category
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const { name, description, icon, color, sort_order } = req.body;

  const result = await categoryService.createCategory({
    name,
    description,
    icon,
    color,
    sort_order
  });

  if (result.success) {
    res.json({
      success: true,
      message: 'Category created successfully',
      category_id: result.data
    });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Update category
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Category ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid category ID', 'VALIDATION_ERROR');
  }

  const result = await categoryService.updateCategory(id, req.body);

  if (result.success) {
    res.json({ success: true, message: 'Category updated successfully' });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Category ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid category ID', 'VALIDATION_ERROR');
  }

  const result = await categoryService.deleteCategory(id);
  handleServiceResult(res, result);
};

/**
 * Reorder categories
 */
export const reorderCategories = async (req: Request, res: Response): Promise<void> => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return sendErrorResponse(res, 'orderedIds array is required', 'VALIDATION_ERROR');
  }

  const result = await categoryService.reorderCategories(orderedIds);

  if (result.success) {
    res.json({ success: true, message: 'Categories reordered successfully' });
  } else {
    handleServiceResult(res, result);
  }
};
