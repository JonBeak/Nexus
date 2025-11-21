// Created: Nov 21, 2025
// Refactored from estimateController.ts - Grid data persistence endpoints
/**
 * Estimate Grid Data Controller
 *
 * Handles Phase 4 grid data persistence:
 * - Save grid data for estimates
 * - Load grid data for estimates
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { EstimateVersioningService } from '../../services/estimateVersioningService';
import { validateEstimateRequest } from '../../utils/estimateValidation';

const versioningService = new EstimateVersioningService();

// =============================================
// GRID DATA PERSISTENCE (Phase 4)
// =============================================

/**
 * Save grid data for an estimate
 * @route POST /estimates/:estimateId/grid-data
 */
export const saveGridData = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const { gridRows, total } = req.body;

    if (!gridRows || !Array.isArray(gridRows)) {
      return res.status(400).json({
        success: false,
        message: 'Grid rows data is required'
      });
    }

    // Check if user can edit this estimate (finalized check)
    const canEdit = await versioningService.canEditEstimate(validated.estimateId);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot save grid data - estimate is already finalized'
      });
    }

    await versioningService.saveGridData(validated.estimateId, gridRows, validated.userId, total);

    res.json({
      success: true,
      message: 'Grid data saved successfully'
    });
  } catch (error) {
    console.error('Controller error saving grid data:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save grid data'
    });
  }
};

/**
 * Load grid data for an estimate
 * @route GET /estimates/:estimateId/grid-data
 */
export const loadGridData = async (req: AuthRequest, res: Response) => {
  try {
    const validated = validateEstimateRequest(req, res);
    if (!validated) return;

    const gridRows = await versioningService.loadGridData(validated.estimateId);

    res.json({
      success: true,
      data: gridRows
    });
  } catch (error) {
    console.error('Controller error loading grid data:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load grid data'
    });
  }
};
