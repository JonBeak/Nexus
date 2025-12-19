// Phase 4.b: Product Archetypes Controller
// Created: 2025-12-18
import { Request, Response } from 'express';
import { ArchetypeService } from '../../services/supplyChain/archetypeService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

const archetypeService = new ArchetypeService();

/**
 * Get all archetypes with optional filtering
 */
export const getArchetypes = async (req: Request, res: Response): Promise<void> => {
  const { search, category, subcategory, active_only } = req.query;

  const result = await archetypeService.getArchetypes({
    search: search as string | undefined,
    category: category as string | undefined,
    subcategory: subcategory as string | undefined,
    active_only: active_only === 'false' ? false : true
  });

  handleServiceResult(res, result);
};

/**
 * Get single archetype by ID
 */
export const getArchetypeById = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Archetype ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid archetype ID', 'VALIDATION_ERROR');
  }

  const result = await archetypeService.getArchetypeById(id);
  handleServiceResult(res, result);
};

/**
 * Create new archetype
 */
export const createArchetype = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const {
    name, category, subcategory, unit_of_measure, specifications,
    description, reorder_point
  } = req.body;

  const result = await archetypeService.createArchetype(
    {
      name,
      category,
      subcategory,
      unit_of_measure,
      specifications,
      description,
      reorder_point
    },
    user?.user_id
  );

  if (result.success) {
    res.json({
      success: true,
      message: 'Archetype created successfully',
      archetype_id: result.data
    });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Update archetype
 */
export const updateArchetype = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Archetype ID');

  if (id === null) {
    return sendErrorResponse(res, 'Invalid archetype ID', 'VALIDATION_ERROR');
  }

  const result = await archetypeService.updateArchetype(id, req.body, user?.user_id);

  if (result.success) {
    res.json({ success: true, message: 'Archetype updated successfully' });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Delete archetype (soft delete)
 */
export const deleteArchetype = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Archetype ID');

  if (id === null) {
    return sendErrorResponse(res, 'Invalid archetype ID', 'VALIDATION_ERROR');
  }

  const result = await archetypeService.deleteArchetype(id, user?.user_id);
  handleServiceResult(res, result);
};

/**
 * Get archetype statistics
 */
export const getArchetypeStats = async (_req: Request, res: Response): Promise<void> => {
  const result = await archetypeService.getStatistics();
  handleServiceResult(res, result);
};

/**
 * Get categories with counts
 */
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  const result = await archetypeService.getCategories();
  handleServiceResult(res, result);
};

/**
 * Get subcategories for a category
 */
export const getSubcategories = async (req: Request, res: Response): Promise<void> => {
  const { category } = req.params;

  if (!category) {
    return sendErrorResponse(res, 'Category is required', 'VALIDATION_ERROR');
  }

  const result = await archetypeService.getSubcategories(category);
  handleServiceResult(res, result);
};
