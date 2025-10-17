// =====================================================
// PRICING CALCULATION CONTROLLER - User-Isolated API
// =====================================================

import { Request, Response } from 'express';
import { EstimationSessionService } from '../services/estimationSessionService';
import { RateLookupService } from '../services/rateLookupService';
import { CalculationInput } from '../types/pricing';
import { AuthRequest } from '../types';

export class PricingCalculationController {
  private sessionService: EstimationSessionService;
  private rateLookupService: RateLookupService;
  
  constructor() {
    this.sessionService = new EstimationSessionService();
    this.rateLookupService = new RateLookupService();
  }
  
  // =====================================================
  // SESSION MANAGEMENT ENDPOINTS
  // =====================================================
  
  /**
   * Create new estimation session
   * POST /api/pricing/session
   */
  createSession = async (req: AuthRequest, res: Response) => {
    try {
      const { estimateId } = req.body;
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const session = await this.sessionService.createSession(userId, estimateId);
      
      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          draftData: session.draftData,
          lastModified: session.lastModified
        }
      });
      
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create estimation session' 
      });
    }
  };
  
  /**
   * Get session data
   * GET /api/pricing/session/:sessionId
   */
  getSession = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const session = this.sessionService.getSession(sessionId, userId);
      
      if (!session) {
        return res.status(404).json({ 
          success: false, 
          error: 'Session not found or expired' 
        });
      }
      
      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          draftData: session.draftData,
          lastModified: session.lastModified,
          estimateId: session.estimateId
        }
      });
      
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get session data' 
      });
    }
  };
  
  /**
   * Close session
   * DELETE /api/pricing/session/:sessionId
   */
  closeSession = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      this.sessionService.closeSession(sessionId, userId);
      
      res.json({
        success: true,
        message: 'Session closed successfully'
      });
      
    } catch (error) {
      console.error('Error closing session:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to close session' 
      });
    }
  };
  
  // =====================================================
  // REAL-TIME CALCULATION ENDPOINTS
  // =====================================================
  
  /**
   * Calculate item pricing in real-time
   * POST /api/pricing/calculate/:sessionId
   */
  calculateItem = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const calculationInput: CalculationInput = req.body;
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Validate input
      const validation = await this.sessionService.validateCalculationInput(
        sessionId, 
        userId, 
        calculationInput
      );
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid calculation input',
          details: validation.errors
        });
      }
      
      // Perform real-time calculation
      const result = await this.sessionService.calculateItemRealTime(
        sessionId, 
        userId, 
        calculationInput
      );
      
      res.json({
        success: true,
        data: result,
        warnings: validation.warnings
      });
      
    } catch (error) {
      console.error('Error calculating item:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to calculate item pricing' 
      });
    }
  };
  
  /**
   * Validate calculation input without calculating
   * POST /api/pricing/validate/:sessionId
   */
  validateInput = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const calculationInput: CalculationInput = req.body;
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const validation = await this.sessionService.validateCalculationInput(
        sessionId, 
        userId, 
        calculationInput
      );
      
      res.json({
        success: true,
        data: validation
      });
      
    } catch (error) {
      console.error('Error validating input:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to validate input' 
      });
    }
  };
  
  // =====================================================
  // SAVE OPERATIONS
  // =====================================================
  
  /**
   * Save draft to database with conflict detection
   * POST /api/pricing/save/:sessionId
   */
  saveDraft = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.user_id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const result = await this.sessionService.saveDraft(sessionId, userId);
      
      if (!result.success && result.conflict) {
        return res.status(409).json({
          success: false,
          error: 'Save conflict detected',
          conflict: result.conflict
        });
      }
      
      res.json({
        success: true,
        message: 'Draft saved successfully'
      });
      
    } catch (error) {
      console.error('Error saving draft:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save draft' 
      });
    }
  };
  
  // =====================================================
  // RATE LOOKUP ENDPOINTS
  // =====================================================

  /**
   * Get all pricing data for session caching
   * GET /api/pricing/all-pricing-data
   */
  getAllPricingData = async (req: Request, res: Response) => {
    try {
      const allPricingData = await this.rateLookupService.getAllPricingData();

      res.json({
        success: true,
        data: allPricingData
      });

    } catch (error) {
      console.error('Error getting all pricing data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pricing data'
      });
    }
  };

  /**
   * Get Push Thru assembly pricing
   * GET /api/pricing/push-thru-assembly
   */
  getPushThruAssemblyPricing = async (req: Request, res: Response) => {
    try {
      const assemblyPricing = await this.rateLookupService.getPushThruAssemblyPricing();

      res.json({
        success: true,
        data: assemblyPricing
      });

    } catch (error) {
      console.error('Error getting Push Thru assembly pricing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Push Thru assembly pricing'
      });
    }
  };

  /**
   * Get available rate types for category (for dropdowns)
   * GET /api/pricing/rates/:category
   */
  getRateTypes = async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      
      const rateTypes = await this.rateLookupService.getAvailableRateTypes(category);
      
      res.json({
        success: true,
        data: {
          category,
          rateTypes
        }
      });
      
    } catch (error) {
      console.error('Error getting rate types:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get rate types' 
      });
    }
  };
  
  /**
   * Get multiplier ranges
   * GET /api/pricing/multipliers
   */
  getMultipliers = async (req: Request, res: Response) => {
    try {
      const multipliers = await this.rateLookupService.getMultiplierRanges();
      
      res.json({
        success: true,
        data: multipliers
      });
      
    } catch (error) {
      console.error('Error getting multipliers:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get multiplier ranges' 
      });
    }
  };
  
  /**
   * Get discount ranges
   * GET /api/pricing/discounts
   */
  getDiscounts = async (req: Request, res: Response) => {
    try {
      const discounts = await this.rateLookupService.getDiscountRanges();
      
      res.json({
        success: true,
        data: discounts
      });
      
    } catch (error) {
      console.error('Error getting discounts:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get discount ranges' 
      });
    }
  };
  
  // =====================================================
  // ADMIN/DEBUG ENDPOINTS
  // =====================================================
  
  /**
   * Clear rate cache (admin only)
   * POST /api/pricing/admin/clear-cache
   */
  clearCache = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      
      if (!user || (user.role !== 'owner' && user.role !== 'manager')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const { category } = req.body;
      
      this.rateLookupService.clearCache(category);
      
      res.json({
        success: true,
        message: category ? `Cache cleared for ${category}` : 'All cache cleared'
      });
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to clear cache' 
      });
    }
  };
  
  /**
   * Get cache statistics (admin only)
   * GET /api/pricing/admin/cache-stats
   */
  getCacheStats = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      
      if (!user || (user.role !== 'owner' && user.role !== 'manager')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const stats = this.rateLookupService.getCacheStats();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get cache statistics' 
      });
    }
  };
}