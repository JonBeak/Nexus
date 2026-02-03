// Supply Chain: Inventory Routes
// Purpose: Define API endpoints for inventory management
// Created: 2026-02-02

import express, { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as controller from '../controllers/supplyChain/inventoryController';

const router: Router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// STOCK LEVEL ENDPOINTS
// ==========================================

// Get supplier product stock levels (detailed view)
router.get(
  '/stock',
  requirePermission('supply_chain.read'),
  controller.getStockLevels
);

// Get archetype stock levels (aggregated view)
router.get(
  '/stock/archetypes',
  requirePermission('supply_chain.read'),
  controller.getArchetypeStockLevels
);

// Get low stock alerts
router.get(
  '/stock/alerts',
  requirePermission('supply_chain.read'),
  controller.getLowStockAlerts
);

// Get stock summary by category
router.get(
  '/stock/summary',
  requirePermission('supply_chain.read'),
  controller.getStockSummaryByCategory
);

// ==========================================
// STOCK ADJUSTMENT ENDPOINTS
// ==========================================

// Generic stock adjustment with transaction type
router.post(
  '/:id/adjust',
  requirePermission('supply_chain.update'),
  controller.adjustStock
);

// Receive stock from supplier order
router.post(
  '/:id/receive',
  requirePermission('supply_chain.update'),
  controller.receiveStock
);

// Use/consume stock for production
router.post(
  '/:id/use',
  requirePermission('supply_chain.update'),
  controller.useStock
);

// Manual inventory adjustment (count correction)
router.post(
  '/:id/count',
  requirePermission('supply_chain.update'),
  controller.makeAdjustment
);

// Update stock settings (reorder point, location)
router.put(
  '/:id/settings',
  requirePermission('supply_chain.update'),
  controller.updateStockSettings
);

// ==========================================
// RESERVATION ENDPOINTS
// ==========================================

// Reserve stock for an order
router.post(
  '/:id/reserve',
  requirePermission('supply_chain.update'),
  controller.reserveStock
);

// Release reserved stock
router.post(
  '/:id/release',
  requirePermission('supply_chain.update'),
  controller.releaseReservation
);

// ==========================================
// TRANSACTION HISTORY ENDPOINTS
// ==========================================

// Get transaction history with filtering
router.get(
  '/transactions',
  requirePermission('supply_chain.read'),
  controller.getTransactions
);

// Get transactions for a specific supplier product
router.get(
  '/:id/transactions',
  requirePermission('supply_chain.read'),
  controller.getProductTransactions
);

// Get recent activity across all products
router.get(
  '/transactions/recent',
  requirePermission('supply_chain.read'),
  controller.getRecentActivity
);

// Get transaction summary (aggregated stats)
router.get(
  '/transactions/summary',
  requirePermission('supply_chain.read'),
  controller.getTransactionSummary
);

export default router;
