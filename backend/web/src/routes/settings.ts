/**
 * Settings Routes
 * RESTful API endpoints for settings management
 *
 * Created: 2025-12-15
 * Part of Phase 3: Settings & Templates UI
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { settingsController } from '../controllers/settingsController';

const router = Router();

// All settings routes require authentication
router.use(authenticateToken);

// =============================================================================
// Task Configuration (Manager+)
// =============================================================================
router.get('/tasks', requireRole('manager', 'owner'), (req, res) => settingsController.getAllTasks(req, res));
router.put('/tasks/order', requireRole('manager', 'owner'), (req, res) => settingsController.updateTaskOrder(req, res));
router.put('/tasks/:taskId/role', requireRole('manager', 'owner'), (req, res) => settingsController.updateTaskRole(req, res));
router.post('/tasks', requireRole('manager', 'owner'), (req, res) => settingsController.createTask(req, res));
router.put('/tasks/:taskId', requireRole('manager', 'owner'), (req, res) => settingsController.updateTask(req, res));

// =============================================================================
// Production Roles (Manager+)
// =============================================================================
router.get('/roles', requireRole('manager', 'owner'), (req, res) => settingsController.getAllRoles(req, res));
router.put('/roles/order', requireRole('manager', 'owner'), (req, res) => settingsController.updateRoleOrder(req, res));
router.put('/roles/:roleId', requireRole('manager', 'owner'), (req, res) => settingsController.updateRole(req, res));
router.post('/roles', requireRole('manager', 'owner'), (req, res) => settingsController.createRole(req, res));

// =============================================================================
// Specification Options (Manager+)
// =============================================================================
router.get('/specifications/categories', requireRole('manager', 'owner'), (req, res) => settingsController.getCategories(req, res));
router.get('/specifications/:category', requireRole('manager', 'owner'), (req, res) => settingsController.getOptionsByCategory(req, res));
router.put('/specifications/:category/order', requireRole('manager', 'owner'), (req, res) => settingsController.reorderOptions(req, res));
router.post('/specifications/:category', requireRole('manager', 'owner'), (req, res) => settingsController.createOption(req, res));
router.put('/specifications/:category/:optionId', requireRole('manager', 'owner'), (req, res) => settingsController.updateOption(req, res));
router.delete('/specifications/:category/:optionId', requireRole('manager', 'owner'), (req, res) => settingsController.deactivateOption(req, res));

// =============================================================================
// Painting Matrix (Manager+)
// =============================================================================
router.get('/painting-matrix/product-types', requireRole('manager', 'owner'), (req, res) => settingsController.getProductTypes(req, res));
router.get('/painting-matrix/:productTypeKey', requireRole('manager', 'owner'), (req, res) => settingsController.getMatrixByProductType(req, res));
router.put('/painting-matrix/:matrixId', requireRole('manager', 'owner'), (req, res) => settingsController.updateMatrixEntry(req, res));

// =============================================================================
// Email Templates (Manager+)
// =============================================================================
router.get('/email-templates', requireRole('manager', 'owner'), (req, res) => settingsController.getAllTemplates(req, res));
router.get('/email-templates/:templateKey', requireRole('manager', 'owner'), (req, res) => settingsController.getTemplate(req, res));
router.put('/email-templates/:templateKey', requireRole('manager', 'owner'), (req, res) => settingsController.updateTemplate(req, res));
router.post('/email-templates/:templateKey/preview', requireRole('manager', 'owner'), (req, res) => settingsController.previewTemplate(req, res));
router.post('/email-templates/:templateKey/reset', requireRole('manager', 'owner'), (req, res) => settingsController.resetTemplate(req, res));

// =============================================================================
// Settings Categories
// =============================================================================
router.get('/categories', requireRole('manager', 'owner'), (req, res) => settingsController.getSettingsCategories(req, res));

// =============================================================================
// Audit Log (Manager+)
// =============================================================================
router.get('/audit-log', requireRole('manager', 'owner'), (req, res) => settingsController.getAuditLog(req, res));

export default router;
