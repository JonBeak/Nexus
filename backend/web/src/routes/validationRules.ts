/**
 * Validation Rules Routes
 * API endpoints for managing file expectation rules and standard file names
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validationRulesController } from '../controllers/validationRulesController';
import { vectorValidationProfileController } from '../controllers/vectorValidationProfileController';

const router = Router();

// All routes require authentication + manager role
router.use(authenticateToken);
router.use(requireRole('manager', 'owner'));

// =============================================================================
// Expected File Rules
// =============================================================================
router.get('/file-expectation-rules', (req, res) => validationRulesController.getRules(req, res));
router.post('/file-expectation-rules', (req, res) => validationRulesController.createRule(req, res));
router.put('/file-expectation-rules/:id', (req, res) => validationRulesController.updateRule(req, res));
router.delete('/file-expectation-rules/:id', (req, res) => validationRulesController.deleteRule(req, res));

// =============================================================================
// Standard File Names Catalog
// =============================================================================
router.get('/standard-file-names', (req, res) => validationRulesController.getStandardFileNames(req, res));
router.post('/standard-file-names', (req, res) => validationRulesController.createStandardFileName(req, res));
router.put('/standard-file-names/:id', (req, res) => validationRulesController.updateStandardFileName(req, res));

// =============================================================================
// Condition Field Options (dropdowns for condition builder)
// =============================================================================
router.get('/condition-field-options', (req, res) => validationRulesController.getConditionFieldOptions(req, res));

// =============================================================================
// Vector Validation Profiles
// =============================================================================
router.get('/vector-profiles', (req, res) => vectorValidationProfileController.getAll(req, res));
router.get('/vector-profiles/:id', (req, res) => vectorValidationProfileController.getById(req, res));
router.put('/vector-profiles/:id', (req, res) => vectorValidationProfileController.update(req, res));

export default router;
