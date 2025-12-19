// Phase 4.c: Supplier Products Routes
// Purpose: Define API endpoints for supplier products and pricing
// Created: 2025-12-19

import express, { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as controller from '../controllers/supplyChain/supplierProductController';

const router: Router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Supplier Products CRUD
router.get(
  '/',
  requirePermission('supply_chain.read'),
  controller.getSupplierProducts
);

router.get(
  '/archetype/:archetypeId',
  requirePermission('supply_chain.read'),
  controller.getSupplierProductsByArchetype
);

router.get(
  '/:id',
  requirePermission('supply_chain.read'),
  controller.getSupplierProductById
);

router.post(
  '/',
  requirePermission('supply_chain.create'),
  controller.createSupplierProduct
);

router.put(
  '/:id',
  requirePermission('supply_chain.update'),
  controller.updateSupplierProduct
);

router.delete(
  '/:id',
  requirePermission('supply_chain.delete'),
  controller.deleteSupplierProduct
);

// Pricing Routes
router.post(
  '/:id/prices',
  requirePermission('supply_chain.update'),
  controller.addPrice
);

router.get(
  '/:id/prices/history',
  requirePermission('supply_chain.read'),
  controller.getPriceHistory
);

router.get(
  '/archetype/:archetypeId/price-range',
  requirePermission('supply_chain.read'),
  controller.getArchetypePriceRange
);

router.post(
  '/archetype/price-ranges/batch',
  requirePermission('supply_chain.read'),
  controller.getArchetypePriceRanges
);

export default router;
