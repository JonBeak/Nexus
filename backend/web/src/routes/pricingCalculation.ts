// =====================================================
// PRICING CALCULATION ROUTES - User-Isolated API
// =====================================================

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { PricingCalculationController } from '../controllers/pricingCalculationController';

const router = Router();
const controller = new PricingCalculationController();

// =====================================================
// SESSION MANAGEMENT ROUTES
// =====================================================

// Create new estimation session
router.post('/session', authenticateToken, controller.createSession);

// Get session data
router.get('/session/:sessionId', authenticateToken, controller.getSession);

// Close session
router.delete('/session/:sessionId', authenticateToken, controller.closeSession);

// =====================================================
// REAL-TIME CALCULATION ROUTES
// =====================================================

// Calculate item pricing in real-time (no save)
router.post('/calculate/:sessionId', authenticateToken, controller.calculateItem);

// Validate calculation input without calculating
router.post('/validate/:sessionId', authenticateToken, controller.validateInput);

// =====================================================
// SAVE OPERATIONS
// =====================================================

// Save draft to database with conflict detection
router.post('/save/:sessionId', authenticateToken, controller.saveDraft);

// =====================================================
// RATE LOOKUP ROUTES
// =====================================================

// Get available rate types for category (for dropdowns)
router.get('/rates/:category', authenticateToken, controller.getRateTypes);

// Get multiplier ranges
router.get('/multipliers', authenticateToken, controller.getMultipliers);

// Get discount ranges
router.get('/discounts', authenticateToken, controller.getDiscounts);

// =====================================================
// ADMIN ROUTES
// =====================================================

// Clear rate cache (admin only)
router.post('/admin/clear-cache', authenticateToken, controller.clearCache);

// Get cache statistics (admin only)
router.get('/admin/cache-stats', authenticateToken, controller.getCacheStats);

export default router;