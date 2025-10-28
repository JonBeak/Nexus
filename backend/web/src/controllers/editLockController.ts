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
    const user = (req as AuthRequest).user;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user || !user.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
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
    const user = (req as AuthRequest).user;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user || !user.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
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
    const user = (req as AuthRequest).user;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user || !user.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
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
  console.log('🚨 BACKEND: saveGridData endpoint HIT!');
  try {
    const user = (req as AuthRequest).user;
    const { estimateId } = req.params;
    const { gridRows, total } = req.body;

    console.log('🔍 DEBUG - saveGridData called for estimate:', estimateId);
    console.log('🔍 DEBUG - gridRows received:', gridRows?.length || 0, 'rows');
    console.log('🔍 DEBUG - total received:', total);

    const estimateIdNum = parseInt(estimateId);
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!gridRows || !Array.isArray(gridRows)) {
      console.log('❌ DEBUG - Invalid gridRows data:', { gridRows, isArray: Array.isArray(gridRows) });
      return res.status(400).json({
        success: false,
        message: 'Grid rows data is required'
      });
    }

    // Check if user can edit this estimate
    const canEdit = await versioningService.canEditEstimate(estimateIdNum);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot save grid data - estimate is already finalized'
      });
    }

    await versioningService.saveGridData(estimateIdNum, gridRows, user?.user_id || (user as any)?.userId, total);

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
    console.log('🎯 Controller: Loading grid data for estimate ID:', estimateId);
    
    const estimateIdNum = parseInt(estimateId);
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    console.log('🎯 Controller: Calling versioningService.loadGridData');
    const gridRows = await versioningService.loadGridData(estimateIdNum);
    console.log('🎯 Controller: Got grid rows:', gridRows?.length || 0, 'rows');

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