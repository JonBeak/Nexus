import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as jobEstimationController from '../controllers/jobEstimationController';
// Refactored focused controllers
import * as jobController from '../controllers/jobController';
import * as estimateController from '../controllers/estimateController';
import * as editLockController from '../controllers/editLockController';
import * as estimateStatusController from '../controllers/estimateStatusController';

const router = Router();

// Job Estimates
router.get('/estimates', authenticateToken, jobEstimationController.getEstimates);
router.get('/estimates/:id', authenticateToken, jobEstimationController.getEstimateById);
router.post('/estimates', authenticateToken, jobEstimationController.createEstimate);
router.post('/estimates/bulk-create', authenticateToken, jobEstimationController.bulkCreateEstimate);
router.put('/estimates/:id', authenticateToken, jobEstimationController.updateEstimate);
router.delete('/estimates/:id', authenticateToken, jobEstimationController.deleteEstimate);

// Field prompts for product types - TEST ROUTE
router.get('/test-route', (req, res) => {
  res.json({ message: 'Test route works!' });
});


// Batch endpoint for all templates (must come before specific productTypeId route)
router.get('/templates/all', authenticateToken, jobEstimationController.getAllFieldPrompts);
router.get('/field-prompts/:productTypeId', authenticateToken, jobEstimationController.getFieldPrompts);

// Legacy routes removed - Phase 4/5 uses grid-data endpoints instead

// Product Types and Templates
router.get('/product-types', authenticateToken, jobEstimationController.getProductTypes);
router.get('/product-types/:productTypeId/field-prompts', authenticateToken, jobEstimationController.getFieldPrompts);
// Legacy calculation and export routes removed - Phase 4/5 uses new grid-based system

// =============================================
// NEW VERSIONING WORKFLOW ENDPOINTS
// =============================================

// Job Management - Using JobController
router.get('/jobs/all-with-activity', authenticateToken, jobController.getAllJobsWithRecentActivity);
router.get('/customers/:customerId/jobs', authenticateToken, jobController.getJobsByCustomer);
router.post('/jobs/validate-name', authenticateToken, jobController.validateJobName);
router.post('/jobs', authenticateToken, jobController.createJob);
router.put('/jobs/:jobId', authenticateToken, jobController.updateJob);
router.get('/jobs/:jobId', authenticateToken, jobController.getJobById);

// Estimate Version Management - Using EstimateController
router.get('/jobs/:jobId/estimates', authenticateToken, estimateController.getEstimateVersionsByJob);
router.post('/jobs/:jobId/estimates', authenticateToken, estimateController.createNewEstimateVersion);

// Draft/Final Workflow - Using EstimateController
router.post('/estimates/:estimateId/save-draft', authenticateToken, estimateController.saveDraft);
router.post('/estimates/:estimateId/finalize', authenticateToken, estimateController.finalizeEstimate);
router.get('/estimates/:estimateId/can-edit', authenticateToken, estimateController.checkEditPermission);

// Duplicate Estimate as New Version - Using EstimateController
router.post('/estimates/:estimateId/duplicate', authenticateToken, estimateController.duplicateEstimateAsNewVersion);

// Update Estimate Notes - Using EstimateController
router.patch('/estimates/:estimateId/notes', authenticateToken, estimateController.updateEstimateNotes);

// Clear Actions - Using EstimateController
router.post('/estimates/:estimateId/reset', authenticateToken, estimateController.resetEstimateItems);
router.post('/estimates/:estimateId/clear-all', authenticateToken, estimateController.clearAllEstimateItems);
router.post('/estimates/:estimateId/clear-empty', authenticateToken, estimateController.clearEmptyItems);
router.post('/estimates/:estimateId/add-section', authenticateToken, estimateController.addTemplateSection);

// Edit Lock System - Using EditLockController
router.post('/estimates/:estimateId/acquire-lock', authenticateToken, editLockController.acquireEditLock);
router.post('/estimates/:estimateId/release-lock', authenticateToken, editLockController.releaseEditLock);
router.get('/estimates/:estimateId/lock-status', authenticateToken, editLockController.checkEditLock);
router.post('/estimates/:estimateId/override-lock', authenticateToken, editLockController.overrideEditLock);
// Phase 4: Grid Data Persistence - Using EditLockController
router.post('/estimates/:estimateId/grid-data', authenticateToken, editLockController.saveGridData);
router.get('/estimates/:estimateId/grid-data', 
  (req, res, next) => { 
    console.log('🚨 ROUTE HIT: /estimates/:estimateId/grid-data', req.params.estimateId); 
    next(); 
  },
  authenticateToken, 
  editLockController.loadGridData
);

// Enhanced Status System - Using EstimateStatusController
router.post('/estimates/:estimateId/send', authenticateToken, estimateStatusController.sendEstimate);
router.post('/estimates/:estimateId/approve', authenticateToken, estimateStatusController.approveEstimate);
router.post('/estimates/:estimateId/not-approved', authenticateToken, estimateStatusController.markNotApproved);
router.post('/estimates/:estimateId/retract', authenticateToken, estimateStatusController.retractEstimate);
router.post('/estimates/:estimateId/convert-to-order', authenticateToken, estimateStatusController.convertToOrder);

// Multiple orders support - Using JobController
router.get('/jobs/:jobId/check-existing-orders', authenticateToken, jobController.checkExistingOrders);
router.post('/jobs/create-additional-for-order', authenticateToken, jobController.createAdditionalJobForOrder);
router.post('/jobs/:jobId/suggest-name-suffix', authenticateToken, jobController.suggestJobNameSuffix);

// Dynamic template endpoints - Using EstimateController
router.get('/product-types/:id/template', authenticateToken, estimateController.getProductTemplate);

export default router;