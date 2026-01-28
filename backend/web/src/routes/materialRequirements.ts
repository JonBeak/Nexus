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

export default router;
