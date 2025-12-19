// Phase 4.a: Updated with contact routes
// Updated: 2025-12-18
/**
 * Supplier Routes
 * - CRUD for suppliers with extended fields
 * - CRUD for supplier contacts (nested under suppliers)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as SupplierController from '../controllers/supplyChain/supplierController';

const router = Router();

// All supplier routes require authentication
router.use(authenticateToken);

// ============================================
// SUPPLIER ROUTES
// ============================================

// Statistics endpoint (MUST come before /:id to avoid route matching bug)
router.get('/stats/summary', requirePermission('supply_chain.read'), SupplierController.getSupplierStats);

// CRUD routes
router.get('/', requirePermission('supply_chain.read'), SupplierController.getSuppliers);
router.get('/:id', requirePermission('supply_chain.read'), SupplierController.getSupplierById);
router.post('/', requirePermission('supply_chain.create'), SupplierController.createSupplier);
router.put('/:id', requirePermission('supply_chain.update'), SupplierController.updateSupplier);
router.delete('/:id', requirePermission('supply_chain.delete'), SupplierController.deleteSupplier);

// ============================================
// SUPPLIER CONTACT ROUTES
// ============================================

// Get all contacts for a supplier
router.get('/:supplierId/contacts', requirePermission('supply_chain.read'), SupplierController.getSupplierContacts);

// Create new contact for a supplier
router.post('/:supplierId/contacts', requirePermission('supply_chain.create'), SupplierController.createContact);

// Get single contact by ID
router.get('/:supplierId/contacts/:contactId', requirePermission('supply_chain.read'), SupplierController.getContactById);

// Update contact
router.put('/:supplierId/contacts/:contactId', requirePermission('supply_chain.update'), SupplierController.updateContact);

// Delete contact
router.delete('/:supplierId/contacts/:contactId', requirePermission('supply_chain.delete'), SupplierController.deleteContact);

// Set contact as primary
router.post('/:supplierId/contacts/:contactId/set-primary', requirePermission('supply_chain.update'), SupplierController.setPrimaryContact);

export default router;
