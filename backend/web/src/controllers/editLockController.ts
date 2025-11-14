// File Clean up Finished: Nov 13, 2025
// Changes made:
// 1. Fixed inconsistent user ID access pattern (user?.user_id || (user as any)?.userId → user.user_id)
// 2. Removed 8 debug console.log statements for production cleanliness
// 3. Removed redundant authentication checks (middleware already validates user)
// 4. Added edit lock validation to saveGridData for security (prevents data races)
// 5. Ensured consistent AuthRequest type usage with non-null assertion (user!)
import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { EstimateVersioningService } from '../services/estimateVersioningService';

const versioningService = new EstimateVersioningService();

// =============================================
// EDIT LOCK SYSTEM ENDPOINTS
// =============================================

export const acquireEditLock = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as AuthRequest).user!;

    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    const result = await versioningService.acquireEditLock(estimateId, user.user_id);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Edit lock acquired',
        ...result.lockStatus 
      });
    } else {
      res.status(409).json({ 
        success: false, 
        message: 'Estimate is locked by another user',
        ...result.lockStatus 
      });
    }
  } catch (error) {
    console.error('Controller error acquiring edit lock:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to acquire edit lock'
    });
  }
};

export const releaseEditLock = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as AuthRequest).user!;

    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    await versioningService.releaseEditLock(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Edit lock released' 
    });
  } catch (error) {
    console.error('Controller error releasing edit lock:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to release edit lock'
    });
  }
};

export const checkEditLock = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    const lockStatus = await versioningService.checkEditLock(estimateId);
    
    res.json({
      success: true,
      ...lockStatus
    });
  } catch (error) {
    console.error('Controller error checking edit lock:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check edit lock'
    });
  }
};

export const overrideEditLock = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as AuthRequest).user!;

    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    // Check if user has override permission (Manager+ only)
    if (user.role !== 'manager' && user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to override edit lock'
      });
    }

    await versioningService.overrideEditLock(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Edit lock overridden successfully' 
    });
  } catch (error) {
    console.error('Controller error overriding edit lock:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to override edit lock'
    });
  }
};

// =============================================
// PHASE 4: GRID DATA PERSISTENCE ENDPOINTS
// =============================================

export const saveGridData = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const { estimateId } = req.params;
    const { gridRows, total } = req.body;

    const estimateIdNum = parseInt(estimateId);
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!gridRows || !Array.isArray(gridRows)) {
      return res.status(400).json({
        success: false,
        message: 'Grid rows data is required'
      });
    }

    // Check if user can edit this estimate (finalized check)
    const canEdit = await versioningService.canEditEstimate(estimateIdNum);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot save grid data - estimate is already finalized'
      });
    }

    // Verify user holds the edit lock
    const lockStatus = await versioningService.checkEditLock(estimateIdNum);
    if (!lockStatus.can_edit && lockStatus.editing_user_id !== user.user_id) {
      return res.status(409).json({
        success: false,
        message: `Cannot save grid data - estimate is locked by ${lockStatus.editing_user}`,
        ...lockStatus
      });
    }

    await versioningService.saveGridData(estimateIdNum, gridRows, user.user_id, total);

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

export const loadGridData = async (req: Request, res: Response) => {
  try {
    const { estimateId } = req.params;

    const estimateIdNum = parseInt(estimateId);
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    const gridRows = await versioningService.loadGridData(estimateIdNum);

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