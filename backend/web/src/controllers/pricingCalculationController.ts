// File Clean up Finished: Nov 14, 2025
// Changes (Phase 1):
//   - Removed dead session management system (createSession, getSession, closeSession)
//   - Removed dead calculation endpoints (calculateItem, validateInput, saveDraft)
//   - Removed EstimationSessionService import (service was deleted)
//   - Removed CalculationInput import (no longer used)
//
// Changes (Phase 2 - Nov 14, 2025):
//   - Removed getRateTypes() endpoint - unused feature
//   - Removed getMultipliers() endpoint - unused quantity-based pricing feature
//   - Removed getDiscounts() endpoint - unused volume-based discounts feature
// Result: 205 lines → 139 lines (66 lines removed, 32% reduction)
//
// Active Endpoints:
//   - getAllPricingData() - Used by frontend PricingDataResource
//   - getPushThruAssemblyPricing() - Used by frontend PricingDataResource
//   - clearCache() - Admin endpoint for debugging
//   - getCacheStats() - Admin endpoint for monitoring
//
// =====================================================
// RATE LOOKUP CONTROLLER - Pricing Data Access
// =====================================================

import { Request, Response } from 'express';
import { RateLookupService } from '../services/rateLookupService';
import { AuthRequest } from '../types';

export class PricingCalculationController {
  private rateLookupService: RateLookupService;

  constructor() {
    this.rateLookupService = new RateLookupService();
  }

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
