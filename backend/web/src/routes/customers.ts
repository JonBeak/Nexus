/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Removed /api/customers/:customerId/contacts/primary route
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { CustomerController } from '../controllers/customers/customerController';
import { AddressController } from '../controllers/customers/addressController';
import { LookupController } from '../controllers/customers/lookupController';
import * as customerContactController from '../controllers/customerContactController';

const router = Router();

// All customer routes require authentication
router.use(authenticateToken);

// Lookup Data Routes (must come before parameterized routes)
router.get('/led-types', LookupController.getLedTypes);
router.get('/power-supply-types', LookupController.getPowerSupplyTypes);
router.get('/tax-info/:province', LookupController.getTaxInfoByProvince);
router.get('/provinces-tax', LookupController.getAllProvincesTaxInfo);
router.get('/provinces-states', LookupController.getProvincesStates);
router.get('/tax-rules', LookupController.getAllTaxRules);

// Customer Routes
router.get('/', CustomerController.getCustomers);
router.get('/:id', CustomerController.getCustomerById);
router.get('/:id/manufacturing-preferences', CustomerController.getManufacturingPreferences);
router.put('/:id', CustomerController.updateCustomer);
router.post('/', CustomerController.createCustomer);
router.post('/:id/deactivate', CustomerController.deactivateCustomer);
router.post('/:id/reactivate', CustomerController.reactivateCustomer);

// Address Routes
router.get('/:id/addresses', AddressController.getAddresses);
router.post('/:id/addresses', AddressController.addAddress);
router.put('/:id/addresses/:addressId', AddressController.updateAddress);
router.delete('/:id/addresses/:addressId', AddressController.deleteAddress);
router.post('/:id/addresses/:addressId/make-primary', AddressController.makePrimaryAddress);
router.post('/:id/addresses/:addressId/reactivate', AddressController.reactivateAddress);

// Customer Contacts Routes (Phase 1.5.a.5)
// Get unique contact emails for dropdown (orders.create permission required)
router.get(
  '/:customerId/contacts/emails',
  requirePermission('orders.create'),
  customerContactController.getCustomerContactEmails
);

// Get all contacts for customer
router.get(
  '/:customerId/contacts',
  requirePermission('customers.read'),
  customerContactController.getCustomerContacts
);

// Get single contact by ID
router.get(
  '/:customerId/contacts/:contactId',
  requirePermission('customers.read'),
  customerContactController.getCustomerContact
);

// Create new contact
router.post(
  '/:customerId/contacts',
  requirePermission('customers.update'),
  customerContactController.createCustomerContact
);

// Update contact
router.put(
  '/:customerId/contacts/:contactId',
  requirePermission('customers.update'),
  customerContactController.updateCustomerContact
);

// Delete contact (soft delete)
router.delete(
  '/:customerId/contacts/:contactId',
  requirePermission('customers.update'),
  customerContactController.deleteCustomerContact
);

export default router;
