// Created: Nov 21, 2025
// Refactored from estimateController.ts - Draft/Final workflow endpoints
/**
 * Estimate Workflow Controller
 *
 * Handles draft/final workflow operations:
 * - Save estimate as draft
 * - Finalize estimate with status
 * - Check edit permissions
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { EstimateVersioningService, EstimateFinalizationData } from '../../services/estimateVersioningService';
import { validateEstimateId, validateEstimateRequest } from '../../utils/estimateValidation';

const versioningService = new EstimateVersioningService();

// =============================================
// DRAFT/FINAL WORKFLOW ENDPOINTS
// =============================================

/**
 * Save estimate as draft
 * @route POST /estimates/:estimateId/save-draft
 */
export const saveDraft = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    // Check if user can edit this estimate
    const canEdit = await versioningService.canEditEstimate(validated.estimateId);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit - estimate is already finalized'
      });
    }

    await versioningService.saveDraft(validated.estimateId, validated.userId);

    res.json({
      success: true,
      message: 'Draft saved successfully'
    });
  } catch (error) {
    console.error('Controller error saving draft:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save draft'
    });
  }
};

/**
 * Finalize estimate with a status (sent, approved, ordered, deactivated)
 * @route POST /estimates/:estimateId/finalize
 */
export const finalizeEstimate = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { status } = req.body;

    // Validate status
    const validStatuses = ['sent', 'approved', 'ordered', 'deactivated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: sent, approved, ordered, deactivated'
      });
    }

    // Check if user can edit this estimate
    const canEdit = await versioningService.canEditEstimate(validated.estimateId);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot finalize - estimate is already finalized'
      });
    }

    const finalizationData: EstimateFinalizationData = { status };
    await versioningService.finalizEstimate(validated.estimateId, finalizationData, validated.userId);

    res.json({
      success: true,
      message: `Estimate finalized as ${status}`
    });
  } catch (error) {
    console.error('Controller error finalizing estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to finalize estimate'
    });
  }
};

/**
 * Check if estimate can be edited (is draft)
 * @route GET /estimates/:estimateId/can-edit
 */
export const checkEditPermission = async (req: AuthRequest, res: Response) => {
  try {
    const { estimateId } = req.params;

    const validation = validateEstimateId(estimateId, res);
    if (!validation.isValid) return;
    const estimateIdNum = validation.value!;

    const canEdit = await versioningService.canEditEstimate(estimateIdNum);

    res.json({
      success: true,
      data: { can_edit: canEdit }
    });
  } catch (error) {
    console.error('Controller error checking edit permission:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check edit permission'
    });
  }
};
