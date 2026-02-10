// File Clean up Finished: Nov 21, 2025
// Changes:
//   - Nov 14, 2025: Removed 6 legacy CRUD endpoints, organized routes
//   - Nov 21, 2025: Updated imports for refactored estimate controllers
//
// Architecture: This file implements the NEW versioning-based job estimation system
// Old endpoints removed - system now uses: Jobs → Estimates (versions) → Grid Data
// Frontend uses: jobVersioningApi.ts for all estimation operations

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as jobEstimationController from '../controllers/jobEstimationController';
// New architecture controllers (versioning system)
import * as jobController from '../controllers/jobController';
import * as estimateVersionController from '../controllers/estimates/estimateVersionController';
import * as estimateWorkflowController from '../controllers/estimates/estimateWorkflowController';
import * as estimateItemsController from '../controllers/estimates/estimateItemsController';
import * as estimateGridDataController from '../controllers/estimates/estimateGridDataController';
import * as estimateStatusController from '../controllers/estimateStatusController';
import * as estimatePreparationController from '../controllers/estimates/estimatePreparationController';

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
// By-name lookup for URL-based navigation (must come before /jobs/:jobId)
router.get('/customers/:customerId/jobs/by-name/:name', authenticateToken, jobController.getJobByName);
router.post('/jobs/validate-name', authenticateToken, jobController.validateJobName);
router.post('/jobs', authenticateToken, jobController.createJob);
router.put('/jobs/:jobId', authenticateToken, jobController.updateJob);
router.get('/jobs/:jobId', authenticateToken, jobController.getJobById);

// Estimate Version Management - Using EstimateVersionController
router.get('/jobs/:jobId/estimates', authenticateToken, estimateVersionController.getEstimateVersionsByJob);
router.post('/jobs/:jobId/estimates', authenticateToken, estimateVersionController.createNewEstimateVersion);

// Estimate Lookup (must come before /estimates/:estimateId to avoid conflict)
router.get('/estimates/lookup', authenticateToken, estimateVersionController.lookupEstimate);

// Single Estimate Retrieval (must come before other /estimates/:estimateId routes)
router.get('/estimates/:estimateId', authenticateToken, estimateVersionController.getEstimateById);

// Draft/Final Workflow - Using EstimateWorkflowController
router.post('/estimates/:estimateId/save-draft', authenticateToken, estimateWorkflowController.saveDraft);
router.post('/estimates/:estimateId/finalize', authenticateToken, estimateWorkflowController.finalizeEstimate);
router.get('/estimates/:estimateId/can-edit', authenticateToken, estimateWorkflowController.checkEditPermission);

// Estimate Validity - Mark as invalid/valid (visual indication only)
router.post('/estimates/:estimateId/mark-invalid', authenticateToken, estimateWorkflowController.markEstimateInvalid);
router.post('/estimates/:estimateId/mark-valid', authenticateToken, estimateWorkflowController.markEstimateValid);

// Duplicate Estimate as New Version - Using EstimateVersionController
router.post('/estimates/:estimateId/duplicate', authenticateToken, estimateVersionController.duplicateEstimateAsNewVersion);

// Update Estimate Notes - Using EstimateItemsController
router.patch('/estimates/:estimateId/notes', authenticateToken, estimateItemsController.updateEstimateNotes);

// Clear Actions - Using EstimateItemsController
router.post('/estimates/:estimateId/reset', authenticateToken, estimateItemsController.resetEstimateItems);
router.post('/estimates/:estimateId/clear-all', authenticateToken, estimateItemsController.clearAllEstimateItems);
router.post('/estimates/:estimateId/clear-empty', authenticateToken, estimateItemsController.clearEmptyItems);
router.post('/estimates/:estimateId/add-section', authenticateToken, estimateItemsController.addTemplateSection);
router.post('/estimates/:estimateId/copy-rows', authenticateToken, estimateItemsController.copyRowsToEstimate);

// Edit Lock System - REMOVED Nov 14, 2025 (Phase 1 Cleanup)
// Legacy estimate-specific locks removed (never used - 0 locks in job_estimates columns)
// Now using generic lock system via /api/locks endpoints (resource_locks table - 331 active locks)
// Frontend: lockService.ts + useEditLock hook in GridJobBuilderRefactored.tsx
// Frontend: lockService.ts + useVersionLocking hook in VersionManager.tsx

// Phase 4: Grid Data Persistence - Using EstimateGridDataController
router.post('/estimates/:estimateId/grid-data', authenticateToken, estimateGridDataController.saveGridData);
router.get('/estimates/:estimateId/grid-data', authenticateToken, estimateGridDataController.loadGridData);

// Enhanced Status System - Using EstimateStatusController
router.post('/estimates/:estimateId/send', authenticateToken, estimateStatusController.sendEstimate);
router.post('/estimates/:estimateId/approve', authenticateToken, estimateStatusController.approveEstimate);
router.post('/estimates/:estimateId/not-approved', authenticateToken, estimateStatusController.markNotApproved);
router.post('/estimates/:estimateId/retract', authenticateToken, estimateStatusController.retractEstimate);

// =============================================
// ESTIMATE WORKFLOW - Phase 4c (Prepare to Send / Send to Customer)
// =============================================

// Email template for estimates
router.get('/estimates/template/send-email', authenticateToken, estimateVersionController.getEstimateSendTemplate);

// Prepare estimate for sending (locks estimate, cleans rows)
router.post('/estimates/:estimateId/prepare', authenticateToken, estimateVersionController.prepareEstimate);

// Send estimate to customer (creates QB estimate, sends email)
router.post('/estimates/:estimateId/send-to-customer', authenticateToken, estimateVersionController.sendEstimate);

// Point persons management
router.get('/estimates/:estimateId/point-persons', authenticateToken, estimateVersionController.getEstimatePointPersons);
router.put('/estimates/:estimateId/point-persons', authenticateToken, estimateVersionController.updateEstimatePointPersons);

// Email content management
router.get('/estimates/:estimateId/email-content', authenticateToken, estimateVersionController.getEstimateEmailContent);
router.put('/estimates/:estimateId/email-content', authenticateToken, estimateVersionController.updateEstimateEmailContent);

// Email preview for modal display (POST to accept email content in body)
router.post('/estimates/:estimateId/email-preview', authenticateToken, estimateVersionController.getEstimateEmailPreview);

// QB Line Descriptions (Phase 4.c - QB Description Column)
router.get('/estimates/:estimateId/line-descriptions', authenticateToken, estimateVersionController.getLineDescriptions);
router.put('/estimates/:estimateId/line-descriptions', authenticateToken, estimateVersionController.updateLineDescriptions);

// =============================================
// PREPARATION TABLE - Editable QB Estimate Rows (Phase 4.e)
// =============================================
router.get('/estimates/:estimateId/preparation-items', authenticateToken, estimatePreparationController.getPreparationItems);
router.get('/estimates/:estimateId/preparation-items/totals', authenticateToken, estimatePreparationController.getPreparationTotals);
router.put('/estimates/:estimateId/preparation-items/:itemId', authenticateToken, estimatePreparationController.updatePreparationItem);
router.post('/estimates/:estimateId/preparation-items', authenticateToken, estimatePreparationController.addPreparationItem);
router.delete('/estimates/:estimateId/preparation-items/:itemId', authenticateToken, estimatePreparationController.deletePreparationItem);
router.post('/estimates/:estimateId/preparation-items/reorder', authenticateToken, estimatePreparationController.reorderPreparationItems);
router.post('/estimates/:estimateId/preparation-items/:itemId/toggle-type', authenticateToken, estimatePreparationController.togglePreparationItemType);

// Import QB Descriptions from other estimates
router.get('/estimates/:estimateId/import-sources', authenticateToken, estimatePreparationController.getImportSources);
router.post('/estimates/:estimateId/preparation-items/import', authenticateToken, estimatePreparationController.importPreparationItems);

// QB Estimate PDF (Phase 4.c - PDF Preview in Send Modal)
router.get('/estimates/:estimateId/qb-pdf', authenticateToken, estimateVersionController.getEstimatePdf);

// Multiple orders support - Using JobController
router.get('/jobs/:jobId/check-existing-orders', authenticateToken, jobController.checkExistingOrders);
router.post('/jobs/create-additional-for-order', authenticateToken, jobController.createAdditionalJobForOrder);
router.post('/jobs/:jobId/suggest-name-suffix', authenticateToken, jobController.suggestJobNameSuffix);

// Dynamic template endpoints - Using JobEstimationController
router.get('/product-types/:id/template', authenticateToken, jobEstimationController.getProductTemplate);

export default router;