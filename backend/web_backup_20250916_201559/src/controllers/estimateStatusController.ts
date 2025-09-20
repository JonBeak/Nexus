import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { EstimateVersioningService } from '../services/estimateVersioningService';

const versioningService = new EstimateVersioningService();

// =============================================
// ENHANCED STATUS SYSTEM ENDPOINTS
// =============================================

export const sendEstimate = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as any).user;
    
    if (!estimateId) {
      return res.status(400).json({
        success: false,
        message: 'Valid estimate ID is required'
      });
    }
    
    if (!user?.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    await versioningService.sendEstimate(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Estimate sent successfully' 
    });
  } catch (error) {
    console.error('Controller error sending estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send estimate'
    });
  }
};

export const approveEstimate = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as any).user;
    
    if (!estimateId) {
      return res.status(400).json({
        success: false,
        message: 'Valid estimate ID is required'
      });
    }
    
    if (!user?.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    await versioningService.approveEstimate(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Estimate approved successfully' 
    });
  } catch (error) {
    console.error('Controller error approving estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to approve estimate'
    });
  }
};

export const markNotApproved = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as any).user;
    
    if (!estimateId) {
      return res.status(400).json({
        success: false,
        message: 'Valid estimate ID is required'
      });
    }
    
    if (!user?.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    await versioningService.markNotApproved(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Estimate marked not approved successfully' 
    });
  } catch (error) {
    console.error('Controller error marking estimate not approved:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to mark estimate not approved'
    });
  }
};

export const retractEstimate = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as any).user;
    
    if (!estimateId) {
      return res.status(400).json({
        success: false,
        message: 'Valid estimate ID is required'
      });
    }
    
    if (!user?.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    await versioningService.retractEstimate(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Estimate retracted successfully' 
    });
  } catch (error) {
    console.error('Controller error retracting estimate:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retract estimate'
    });
  }
};

export const convertToOrder = async (req: Request, res: Response) => {
  try {
    const estimateId = parseInt(req.params.estimateId);
    const user = (req as any).user;
    
    if (!estimateId) {
      return res.status(400).json({
        success: false,
        message: 'Valid estimate ID is required'
      });
    }
    
    if (!user?.user_id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    const result = await versioningService.convertToOrder(estimateId, user.user_id);
    
    res.json({ 
      success: true, 
      message: 'Estimate converted to order successfully',
      order_id: result.order_id
    });
  } catch (error) {
    console.error('Controller error converting estimate to order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to convert estimate to order'
    });
  }
};