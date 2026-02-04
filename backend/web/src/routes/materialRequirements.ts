/**
 * Material Requirements Routes
 * API endpoints for material requirements tracking
 * Created: 2025-01-27
 */

import express, { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as controller from '../controllers/supplyChain/materialRequirementController';

const router: Router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Material Requirements CRUD
router.get(
  '/',
  requirePermission('supply_chain.read'),
  controller.getMaterialRequirements
);

router.get(
  '/actionable',
  requirePermission('supply_chain.read'),
  controller.getActionableRequirements
);

router.get(
  '/status-counts',
  requirePermission('supply_chain.read'),
  controller.getStatusCounts
);

router.get(
  '/recent-orders',
  requirePermission('supply_chain.read'),
  controller.getRecentOrders
);

router.get(
  '/grouped-by-supplier',
  requirePermission('supply_chain.read'),
  controller.getGroupedBySupplier
);

// ===========================================================================
// Inventory Hold Routes (MUST be before /:id to avoid route conflict)
// ===========================================================================

// Check stock availability
router.get(
  '/check-stock',
  requirePermission('supply_chain.read'),
  controller.checkStockAvailability
);

// Get available vinyl items with holds
router.get(
  '/available-vinyl',
  requirePermission('supply_chain.read'),
  controller.getAvailableVinylWithHolds
);

// Get supplier products with holds
router.get(
  '/available-products',
  requirePermission('supply_chain.read'),
  controller.getSupplierProductsWithHolds
);

router.get(
  '/order/:orderId',
  requirePermission('supply_chain.read'),
  controller.getRequirementsByOrderId
);

router.get(
  '/:id',
  requirePermission('supply_chain.read'),
  controller.getRequirementById
);

router.post(
  '/',
  requirePermission('supply_chain.create'),
  controller.createRequirement
);

router.put(
  '/:id',
  requirePermission('supply_chain.update'),
  controller.updateRequirement
);

router.delete(
  '/:id',
  requirePermission('supply_chain.delete'),
  controller.deleteRequirement
);

// Receipt Operations
router.put(
  '/:id/receive',
  requirePermission('supply_chain.update'),
  controller.receiveQuantity
);

router.post(
  '/bulk-receive',
  requirePermission('supply_chain.update'),
  controller.bulkReceive
);

// Shopping Cart Integration
router.post(
  '/add-to-cart',
  requirePermission('supply_chain.update'),
  controller.addToCart
);

// Get hold details for a requirement
router.get(
  '/:id/hold',
  requirePermission('supply_chain.read'),
  controller.getHoldForRequirement
);

// Get other holds on the same vinyl (for multi-hold receive flow)
router.get(
  '/:id/other-holds',
  requirePermission('supply_chain.read'),
  controller.getOtherHoldsOnVinyl
);

// Create vinyl hold
router.post(
  '/:id/vinyl-hold',
  requirePermission('supply_chain.update'),
  controller.createVinylHold
);

// Create general inventory hold
router.post(
  '/:id/general-hold',
  requirePermission('supply_chain.update'),
  controller.createGeneralInventoryHold
);

// Release hold
router.delete(
  '/:id/hold',
  requirePermission('supply_chain.update'),
  controller.releaseHold
);

// Receive requirement with hold (handles multi-hold scenario)
router.post(
  '/:id/receive-with-hold',
  requirePermission('supply_chain.update'),
  controller.receiveRequirementWithHold
);

export default router;
