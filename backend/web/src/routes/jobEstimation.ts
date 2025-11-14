// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed 6 legacy CRUD endpoints (getEstimates, createEstimate, updateEstimate, deleteEstimate, bulkCreateEstimate, getEstimateById)
//   - Removed test route
//   - Removed inline debug logging middleware
//   - Organized routes into clear functional sections
//   - Added architecture documentation
//
// Architecture: This file implements the NEW versioning-based job estimation system
// Old endpoints removed - system now uses: Jobs → Estimates (versions) → Grid Data
// Frontend uses: jobVersioningApi.ts for all estimation operations

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as jobEstimationController from '../controllers/jobEstimationController';
// New architecture controllers (versioning system)
import * as jobController from '../controllers/jobController';
import * as estimateController from '../controllers/estimateController';
import * as estimateStatusController from '../controllers/estimateStatusController';

const router = Router();

// =============================================
// TEMPLATES & FIELD PROMPTS (Legacy support for dynamic form generation)
// =============================================

// Batch endpoint for all templates (must come before specific productTypeId route)
router.get('/templates/all', authenticateToken, jobEstimationController.getAllFieldPrompts);
router.get('/field-prompts/:productTypeId', authenticateToken, jobEstimationController.getFieldPrompts);

// Product Types and Templates
router.get('/product-types', authenticateToken, jobEstimationController.getProductTypes);
router.get('/product-types/:productTypeId/field-prompts', authenticateToken, jobEstimationController.getFieldPrompts);

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

// Edit Lock System - REMOVED Nov 14, 2025 (Phase 1 Cleanup)
// Legacy estimate-specific locks removed (never used - 0 locks in job_estimates columns)
// Now using generic lock system via /api/locks endpoints (resource_locks table - 331 active locks)
// Frontend: lockService.ts + useEditLock hook in GridJobBuilderRefactored.tsx
// Frontend: lockService.ts + useVersionLocking hook in VersionManager.tsx

// Phase 4: Grid Data Persistence - Using EstimateController (moved from editLockController Nov 14, 2025)
router.post('/estimates/:estimateId/grid-data', authenticateToken, estimateController.saveGridData);
router.get('/estimates/:estimateId/grid-data', authenticateToken, estimateController.loadGridData);

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