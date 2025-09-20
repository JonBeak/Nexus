import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { EstimateVersioningService, EstimateVersionData, EstimateFinalizationData } from '../services/estimateVersioningService';
import { dynamicTemplateService } from '../services/dynamicTemplateService';
import { pool } from '../config/database';

const versioningService = new EstimateVersioningService();

// =============================================
// ESTIMATE VERSION ENDPOINTS
// =============================================

export const getEstimateVersionsByJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const jobIdNum = parseInt(jobId);
    
    if (isNaN(jobIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    const versions = await versioningService.getEstimateVersionsByJob(jobIdNum);
    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Controller error fetching estimate versions:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch estimate versions'
    });
  }
};

export const createNewEstimateVersion = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { jobId } = req.params;
    const { parent_estimate_id, notes } = req.body;
    
    const jobIdNum = parseInt(jobId);
    if (isNaN(jobIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    // Validate job exists and user has access
    const hasAccess = await versioningService.validateJobAccess(jobIdNum);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Validate parent estimate if provided
    if (parent_estimate_id) {
      const parentId = parseInt(parent_estimate_id);
      if (!isNaN(parentId)) {
        const parentExists = await versioningService.validateEstimateAccess(parentId);
        if (!parentExists) {
          return res.status(400).json({
            success: false,
            message: 'Parent estimate not found'
          });
        }
        
        const isValidParent = await versioningService.validateParentChain(parentId);
        if (!isValidParent) {
          return res.status(400).json({
            success: false,
            message: 'Cannot use this estimate as parent: circular reference detected'
          });
        }
      }
    }
    
    const versionData: EstimateVersionData = {
      job_id: jobIdNum,
      parent_estimate_id: parent_estimate_id ? parseInt(parent_estimate_id) : undefined,
      notes
    };
    
    console.log('Creating estimate version with data:', versionData, 'for user:', user?.user_id || (user as any)?.userId);
    const estimateId = await versioningService.createNewEstimateVersion(versionData, user?.user_id || (user as any)?.userId);
    console.log('Estimate created with ID:', estimateId);
    
    res.json({
      success: true,
      data: { estimate_id: estimateId }
    });
  } catch (error) {
    console.error('Controller error creating estimate version:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create estimate version'
    });
  }
};

// =============================================
// DRAFT/FINAL WORKFLOW ENDPOINTS  
// =============================================

export const saveDraft = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { estimateId } = req.params;
    
    const estimateIdNum = parseInt(estimateId);
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
    // Check if user can edit this estimate
    const canEdit = await versioningService.canEditEstimate(estimateIdNum);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit - estimate is already finalized'
      });
    }
    
    await versioningService.saveDraft(estimateIdNum, user?.user_id || (user as any)?.userId);
    
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

export const finalizeEstimate = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { estimateId } = req.params;
    const { status } = req.body;
    
    const estimateIdNum = parseInt(estimateId);
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
    // Validate status
    const validStatuses = ['sent', 'approved', 'ordered', 'deactivated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: sent, approved, ordered, deactivated'
      });
    }
    
    // Check if user can edit this estimate
    const canEdit = await versioningService.canEditEstimate(estimateIdNum);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Cannot finalize - estimate is already finalized'
      });
    }
    
    const finalizationData: EstimateFinalizationData = { status };
    await versioningService.finalizEstimate(estimateIdNum, finalizationData, user?.user_id || (user as any)?.userId);
    
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

export const checkEditPermission = async (req: Request, res: Response) => {
  try {
    const { estimateId } = req.params;
    const estimateIdNum = parseInt(estimateId);
    
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
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

// =============================================
// DUPLICATE ESTIMATE (CREATE NEW VERSION FROM EXISTING)
// =============================================

export const duplicateEstimateAsNewVersion = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { estimateId } = req.params;
    const { target_job_id, notes } = req.body;
    
    const estimateIdNum = parseInt(estimateId);
    const targetJobIdNum = target_job_id ? parseInt(target_job_id) : undefined;
    
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }
    
    // Validate source estimate exists
    const sourceExists = await versioningService.validateEstimateAccess(estimateIdNum);
    if (!sourceExists) {
      return res.status(404).json({
        success: false,
        message: 'Source estimate not found'
      });
    }
    
    // Validate source estimate's parent chain doesn't have cycles
    const isValidSource = await versioningService.validateParentChain(estimateIdNum);
    if (!isValidSource) {
      return res.status(400).json({
        success: false,
        message: 'Cannot duplicate from this estimate: circular reference detected in parent chain'
      });
    }
    
    // If no target job specified, get job from source estimate
    let jobId = targetJobIdNum;
    if (!jobId) {
      // Import pool directly for this query
      const { pool } = require('../config/database');
      const [rows] = await pool.execute(
        'SELECT job_id FROM job_estimates WHERE id = ?',
        [estimateIdNum]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Source estimate not found'
        });
      }
      
      jobId = rows[0].job_id as number;
    }
    
    const versionData: EstimateVersionData = {
      job_id: jobId,
      parent_estimate_id: estimateIdNum,
      notes
    };
    
    const newEstimateId = await versioningService.createNewEstimateVersion(versionData, user?.user_id || (user as any)?.userId);
    
    res.json({
      success: true,
      data: { 
        estimate_id: newEstimateId,
        job_id: jobId 
      },
      message: 'New version created successfully'
    });
  } catch (error) {
    console.error('Controller error duplicating estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to duplicate estimate'
    });
  }
};

// =============================================
// DYNAMIC TEMPLATE ENDPOINTS
// =============================================

export const getProductTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productTypeId = parseInt(id);
    
    if (isNaN(productTypeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product type ID'
      });
    }
    
    const template = await dynamicTemplateService.getProductTemplate(productTypeId);
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Controller error getting product template:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get product template'
    });
  }
};

// =============================================
// CLEAR ALL ENDPOINT
// =============================================

export const resetEstimateItems = async (req: AuthRequest, res: Response) => {
  try {
    const { estimateId } = req.params;
    const estimateIdNum = parseInt(estimateId);
    const user = req.user;
    
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user?.user_id && !(user as any)?.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = user?.user_id || (user as any)?.userId;
    
    await versioningService.resetEstimateItems(estimateIdNum, userId);
    
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

export const clearAllEstimateItems = async (req: AuthRequest, res: Response) => {
  try {
    const { estimateId } = req.params;
    const estimateIdNum = parseInt(estimateId);
    const user = req.user;
    
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user?.user_id && !(user as any)?.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = user?.user_id || (user as any)?.userId;
    
    await versioningService.clearAllEstimateItems(estimateIdNum, userId);
    
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

export const clearEmptyItems = async (req: AuthRequest, res: Response) => {
  try {
    const { estimateId } = req.params;
    const estimateIdNum = parseInt(estimateId);
    const user = req.user;
    
    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user?.user_id && !(user as any)?.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = user?.user_id || (user as any)?.userId;
    
    await versioningService.clearEmptyItems(estimateIdNum, userId);
    
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

export const addTemplateSection = async (req: AuthRequest, res: Response) => {
  try {
    const { estimateId } = req.params;
    const estimateIdNum = parseInt(estimateId);
    const user = req.user;

    if (isNaN(estimateIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimate ID'
      });
    }

    if (!user?.user_id && !(user as any)?.userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = user?.user_id || (user as any)?.userId;
    await versioningService.addTemplateSection(estimateIdNum, userId);

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