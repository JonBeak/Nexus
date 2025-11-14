// File Clean up Finished: Nov 14, 2025
// Changes (Phase 1):
//   - Removed dead session management routes (POST/GET/DELETE /session)
//   - Removed dead calculation routes (POST /calculate, POST /validate)
//   - Removed dead save operation route (POST /save)
//
// Changes (Phase 2 - Nov 14, 2025):
//   - Removed GET /rates/:category - unused endpoint
//   - Removed GET /multipliers - unused quantity-based pricing feature
//   - Removed GET /discounts - unused volume-based discounts feature
//
// Active Routes:
//   - GET /all-pricing-data - Used by frontend PricingDataResource
//   - GET /push-thru-assembly - Used by frontend PricingDataResource
//   - POST /admin/clear-cache - Admin endpoint for debugging
//   - GET /admin/cache-stats - Admin endpoint for monitoring
//
// =====================================================
// RATE LOOKUP ROUTES - Pricing Data Access
// =====================================================

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { PricingCalculationController } from '../controllers/pricingCalculationController';

const router = Router();
const controller = new PricingCalculationController();

// =====================================================
// RATE LOOKUP ROUTES
// =====================================================

// Get all pricing data for session caching
router.get('/all-pricing-data', authenticateToken, controller.getAllPricingData);

// Get Push Thru assembly pricing
router.get('/push-thru-assembly', authenticateToken, controller.getPushThruAssemblyPricing);

// =====================================================
// ADMIN ROUTES
// =====================================================

// Clear rate cache (admin only)
router.post('/admin/clear-cache', authenticateToken, controller.clearCache);

// Get cache statistics (admin only)
router.get('/admin/cache-stats', authenticateToken, controller.getCacheStats);

export default router;
