// Phase 4.b: Product Types Routes
// Created: 2025-12-18
/**
 * Product Types Routes (formerly "Materials")
 * - CRUD for product archetypes (product types catalog)
 * - CRUD for product type categories
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as ArchetypeController from '../controllers/supplyChain/archetypeController';
import * as CategoryController from '../controllers/supplyChain/categoryController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// CATEGORY ROUTES (must come before /:id)
// ============================================

router.get('/categories', requirePermission('supply_chain.read'), CategoryController.getCategories);
router.post('/categories', requirePermission('supply_chain.create'), CategoryController.createCategory);
router.put('/categories/reorder', requirePermission('supply_chain.update'), CategoryController.reorderCategories);
router.get('/categories/:id', requirePermission('supply_chain.read'), CategoryController.getCategoryById);
router.put('/categories/:id', requirePermission('supply_chain.update'), CategoryController.updateCategory);
router.delete('/categories/:id', requirePermission('supply_chain.delete'), CategoryController.deleteCategory);

// Subcategories for a category (by name)
router.get('/categories/:category/subcategories', requirePermission('supply_chain.read'), ArchetypeController.getSubcategories);

// ============================================
// PRODUCT TYPE ROUTES
// ============================================

// Statistics endpoint
router.get('/stats/summary', requirePermission('supply_chain.read'), ArchetypeController.getArchetypeStats);

// CRUD routes
router.get('/', requirePermission('supply_chain.read'), ArchetypeController.getArchetypes);
router.get('/:id', requirePermission('supply_chain.read'), ArchetypeController.getArchetypeById);
router.post('/', requirePermission('supply_chain.create'), ArchetypeController.createArchetype);
router.put('/:id', requirePermission('supply_chain.update'), ArchetypeController.updateArchetype);
router.delete('/:id', requirePermission('supply_chain.delete'), ArchetypeController.deleteArchetype);

export default router;
