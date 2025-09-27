import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { CustomerController } from '../controllers/customers/customerController';
import { AddressController } from '../controllers/customers/addressController';
import { LookupController } from '../controllers/customers/lookupController';

const router = Router();

// All customer routes require authentication
router.use(authenticateToken);

// Lookup Data Routes (must come before parameterized routes)
router.get('/led-types', LookupController.getLedTypes);
router.get('/power-supply-types', LookupController.getPowerSupplyTypes);
router.get('/tax-info/:province', LookupController.getTaxInfoByProvince);
router.get('/provinces-tax', LookupController.getAllProvincesTaxInfo);
router.get('/provinces-states', LookupController.getProvincesStates);

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

export default router;
