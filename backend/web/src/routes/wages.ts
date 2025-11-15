// File Clean up Finished: 2025-11-15 (Payroll not fully implemented - deferred cleanup)
/**
 * Wages Routes - Enhanced Three-Layer Architecture
 *
 * Route definitions for payroll/wages endpoints
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - HTTP routing and middleware chain definitions
 * - Authentication and permission middleware setup
 * - Route parameter validation
 * - Controller method delegation
 *
 * Refactored from original wages.ts - all endpoints preserved exactly
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { WagesController } from '../controllers/wagesController';

const router = Router();
const wagesController = new WagesController();

// =============================================
// MIDDLEWARE SETUP
// =============================================

// All routes require authentication
router.use(authenticateToken);

// =============================================
// DEDUCTION OVERRIDES
// =============================================

/**
 * Get deduction overrides for a pay period
 * GET /api/wages/deduction-overrides?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/deduction-overrides', wagesController.getDeductionOverrides);

/**
 * Update single deduction override
 * PUT /api/wages/update-deductions
 */
router.put('/update-deductions', wagesController.updateDeductions);

/**
 * Batch update deduction overrides
 * PUT /api/wages/update-deductions-batch
 */
router.put('/update-deductions-batch', wagesController.updateDeductionsBatch);

// =============================================
// BI-WEEKLY WAGE DATA
// =============================================

/**
 * Get bi-weekly wage data with full calculations
 * GET /api/wages/bi-weekly?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&group=...
 */
router.get('/bi-weekly', wagesController.getBiWeeklyWageData);

/**
 * Update payroll entries
 * PUT /api/wages/update-payroll
 */
router.put('/update-payroll', wagesController.updatePayroll);

// =============================================
// PAYROLL SETTINGS
// =============================================

/**
 * Get payroll settings
 * GET /api/wages/settings
 */
router.get('/settings', wagesController.getPayrollSettings);

/**
 * Update payroll settings
 * PUT /api/wages/settings
 */
router.put('/settings', wagesController.updatePayrollSettings);

// =============================================
// PAYMENT RECORDS
// =============================================

/**
 * Record payment
 * POST /api/wages/record-payment
 */
router.post('/record-payment', wagesController.recordPayment);

/**
 * Get payment history
 * GET /api/wages/payment-history?includeInactive=true|false
 */
router.get('/payment-history', wagesController.getPaymentHistory);

/**
 * Deactivate payment record (soft delete)
 * DELETE /api/wages/payment-record/:recordId
 */
router.delete('/payment-record/:recordId', wagesController.deactivatePaymentRecord);

/**
 * Reactivate payment record
 * POST /api/wages/payment-record/:recordId/reactivate
 */
router.post('/payment-record/:recordId/reactivate', wagesController.reactivatePaymentRecord);

export default router;