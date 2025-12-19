/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Removed /api/customers/:customerId/contacts/primary route
 *
 * File Clean up Finished: 2025-11-15
 * Changes:
 * - Migrated address routes to requirePermission() middleware pattern
 * - Added permission checks for all 6 address operations
 * - Routes now consistent with modern pattern (see customer contacts routes)
 * - Permissions: .read, .update, .delete (no .create - uses .update for add operations)
 *
 * File Clean up Finished: 2025-11-20
 * Changes:
 * - COMPLETED customer route middleware migration (started Nov 15)
 * - Added requirePermission() middleware to all 7 customer CRUD routes
 * - Added requirePermission('customers.read') to all 6 lookup data routes
 * - All 13+ customer routes now consistently protected at route level
 * - Enabled deletion of CustomerPermissions file (84 lines removed)
 * - Permissions: customers.read, customers.update, customers.deactivate
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { CustomerController } from '../controllers/customers/customerController';
import { AddressController } from '../controllers/customers/addressController';
import { LookupController } from '../controllers/customers/lookupController';
import * as customerContactController from '../controllers/customerContactController';
import * as customerAccountingEmailController from '../controllers/customerAccountingEmailController';

const router = Router();

// All customer routes require authentication
router.use(authenticateToken);

// Lookup Data Routes (must come before parameterized routes)
router.get('/led-types',
  requirePermission('customers.read'),
  LookupController.getLedTypes
);
router.get('/power-supply-types',
  requirePermission('customers.read'),
  LookupController.getPowerSupplyTypes
);
router.get('/tax-info/:province',
  requirePermission('customers.read'),
  LookupController.getTaxInfoByProvince
);
router.get('/provinces-tax',
  requirePermission('customers.read'),
  LookupController.getAllProvincesTaxInfo
);
router.get('/provinces-states',
  requirePermission('customers.read'),
  LookupController.getProvincesStates
);
router.get('/tax-rules',
  requirePermission('customers.read'),
  LookupController.getAllTaxRules
);

// Customer Routes
router.get('/',
  requirePermission('customers.read'),
  CustomerController.getCustomers
);
// By-name lookup for URL-based navigation (must come before /:id)
router.get('/by-name/:name',
  requirePermission('customers.read'),
  CustomerController.getCustomerByName
);
router.get('/:id',
  requirePermission('customers.read'),
  CustomerController.getCustomerById
);
router.get('/:id/manufacturing-preferences',
  requirePermission('customers.read'),
  CustomerController.getManufacturingPreferences
);
router.put('/:id',
  requirePermission('customers.update'),
  CustomerController.updateCustomer
);
router.post('/',
  requirePermission('customers.update'),
  CustomerController.createCustomer
);
router.post('/:id/deactivate',
  requirePermission('customers.deactivate'),
  CustomerController.deactivateCustomer
);
router.post('/:id/reactivate',
  requirePermission('customers.update'),
  CustomerController.reactivateCustomer
);

// Address Routes
router.get('/:id/addresses',
  requirePermission('customer_addresses.read'),
  AddressController.getAddresses
);
router.post('/:id/addresses',
  requirePermission('customer_addresses.update'),
  AddressController.addAddress
);
router.put('/:id/addresses/:addressId',
  requirePermission('customer_addresses.update'),
  AddressController.updateAddress
);
router.delete('/:id/addresses/:addressId',
  requirePermission('customer_addresses.delete'),
  AddressController.deleteAddress
);
router.post('/:id/addresses/:addressId/make-primary',
  requirePermission('customer_addresses.update'),
  AddressController.makePrimaryAddress
);
router.post('/:id/addresses/:addressId/reactivate',
  requirePermission('customer_addresses.update'),
  AddressController.reactivateAddress
);

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

// Customer Accounting Emails Routes
// Get all accounting emails for customer
router.get(
  '/:customerId/accounting-emails',
  requirePermission('customers.read'),
  customerAccountingEmailController.getAccountingEmails
);

// Get single accounting email by ID
router.get(
  '/:customerId/accounting-emails/:emailId',
  requirePermission('customers.read'),
  customerAccountingEmailController.getAccountingEmail
);

// Create new accounting email
router.post(
  '/:customerId/accounting-emails',
  requirePermission('customers.update'),
  customerAccountingEmailController.createAccountingEmail
);

// Update accounting email
router.put(
  '/:customerId/accounting-emails/:emailId',
  requirePermission('customers.update'),
  customerAccountingEmailController.updateAccountingEmail
);

// Delete accounting email (soft delete)
router.delete(
  '/:customerId/accounting-emails/:emailId',
  requirePermission('customers.update'),
  customerAccountingEmailController.deleteAccountingEmail
);

export default router;
