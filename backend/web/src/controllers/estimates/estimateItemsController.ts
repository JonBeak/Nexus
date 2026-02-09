// Created: Nov 21, 2025
// Refactored from estimateController.ts - Estimate item management endpoints
/**
 * Estimate Items Controller
 *
 * Handles estimate item management operations:
 * - Reset estimate items (clear and recreate template)
 * - Clear all estimate items
 * - Clear empty items
 * - Add template section
 * - Update estimate notes
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { EstimateVersioningService } from '../../services/estimateVersioningService';
import { validateEstimateRequest } from '../../utils/estimateValidation';

const versioningService = new EstimateVersioningService();

// =============================================
// ESTIMATE ITEM MANAGEMENT ENDPOINTS
// =============================================

/**
 * Clear all items and reset to default template
 * @route POST /estimates/:estimateId/reset
 */
export const resetEstimateItems = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    await versioningService.resetEstimateItems(validated.estimateId, validated.userId);

    res.json({
      success: true,
      message: 'All estimate items cleared and default template created'
    });
  } catch (error) {
    console.error('Controller error clearing estimate items:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear estimate items'
    });
  }
};

/**
 * Clear all estimate items (no template recreation)
 * @route POST /estimates/:estimateId/clear-all
 */
export const clearAllEstimateItems = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    await versioningService.clearAllEstimateItems(validated.estimateId, validated.userId);

    res.json({
      success: true,
      message: 'All estimate items deleted'
    });
  } catch (error) {
    console.error('Controller error clearing all estimate items:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear all estimate items'
    });
  }
};

/**
 * Clear empty items from estimate
 * @route POST /estimates/:estimateId/clear-empty
 */
export const clearEmptyItems = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    await versioningService.clearEmptyItems(validated.estimateId, validated.userId);

    res.json({
      success: true,
      message: 'Empty items removed'
    });
  } catch (error) {
    console.error('Controller error clearing empty items:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear empty items'
    });
  }
};

/**
 * Add a new template section to estimate
 * @route POST /estimates/:estimateId/add-section
 */
export const addTemplateSection = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    await versioningService.addTemplateSection(validated.estimateId, validated.userId);

    res.json({
      success: true,
      message: 'Template section added successfully'
    });
  } catch (error) {
    console.error('Controller error adding template section:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add template section'
    });
  }
};

// =============================================
// UPDATE ESTIMATE NOTES
// =============================================

/**
 * Update estimate notes
 * @route PATCH /estimates/:estimateId/notes
 */
export const updateEstimateNotes = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { notes } = req.body;

    await versioningService.updateEstimateNotes(validated.estimateId, notes || null, validated.userId);

    res.json({
      success: true,
      message: 'Notes updated successfully'
    });
  } catch (error) {
    console.error('Controller error updating notes:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update notes'
    });
  }
};

/**
 * Update estimate high_standards override
 * @route PATCH /estimates/:estimateId/high-standards
 */
export const updateEstimateHighStandards = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { high_standards } = req.body;

    // Validate: must be true, false, or null
    if (high_standards !== null && typeof high_standards !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'high_standards must be true, false, or null'
      });
    }

    await versioningService.updateEstimateHighStandards(validated.estimateId, high_standards, validated.userId);

    res.json({
      success: true,
      message: 'High standards updated successfully'
    });
  } catch (error) {
    console.error('Controller error updating high standards:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update high standards'
    });
  }
};

/**
 * Copy rows from another estimate and append to this estimate
 * @route POST /estimates/:estimateId/copy-rows
 */
export const copyRowsToEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { sourceEstimateId, rowIds } = req.body;

    // Validate required fields
    if (!sourceEstimateId || !Number.isInteger(sourceEstimateId)) {
      return res.status(400).json({
        success: false,
        message: 'sourceEstimateId is required and must be an integer'
      });
    }

    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'rowIds must be a non-empty array of integers'
      });
    }

    // Validate all rowIds are integers
    if (!rowIds.every((id: any) => Number.isInteger(id))) {
      return res.status(400).json({
        success: false,
        message: 'All rowIds must be integers'
      });
    }

    const result = await versioningService.copyRowsToEstimate(
      validated.estimateId,
      sourceEstimateId,
      rowIds,
      validated.userId
    );

    res.json({
      success: true,
      data: result,
      message: `${result.copiedCount} row(s) copied successfully`
    });
  } catch (error) {
    console.error('Controller error copying rows:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to copy rows'
    });
  }
};
