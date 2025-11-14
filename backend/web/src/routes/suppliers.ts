// File Clean up Finished: Nov 14, 2025
/**
 * Changes:
 * - Refactored to 3-layer architecture (Route → Controller → Service → Repository)
 * - Fixed route ordering bug: /stats/summary now before /:id
 * - Replaced hardcoded role checks with requirePermission() middleware
 * - Reduced from 210 lines to ~35 lines (83% reduction)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as SupplierController from '../controllers/supplyChain/supplierController';

const router = Router();

// All supplier routes require authentication
router.use(authenticateToken);

// Statistics endpoint (MUST come before /:id to avoid route matching bug)
router.get('/stats/summary', requirePermission('supply_chain.read'), SupplierController.getSupplierStats);

// CRUD routes
router.get('/', requirePermission('supply_chain.read'), SupplierController.getSuppliers);
router.get('/:id', requirePermission('supply_chain.read'), SupplierController.getSupplierById);
router.post('/', requirePermission('supply_chain.create'), SupplierController.createSupplier);
router.put('/:id', requirePermission('supply_chain.update'), SupplierController.updateSupplier);
router.delete('/:id', requirePermission('supply_chain.delete'), SupplierController.deleteSupplier);

export default router;
