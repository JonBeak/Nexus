import { Request, Response } from 'express';
import { CustomerService } from '../../services/customers/customerService';
import { AddressService } from '../../services/customers/addressService';
import { CustomerPermissions } from '../../utils/customers/permissions';

export class CustomerController {
  static async getCustomers(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check view permission using hybrid RBAC/legacy system
      const canView = await CustomerPermissions.canViewCustomersHybrid(user);
      if (!canView) {
        return res.status(403).json({ error: 'Insufficient permissions to view customers' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string || '';
      const includeInactive = req.query.include_inactive === 'true';

      const result = await CustomerService.getCustomers({
        page,
        limit,
        search,
        includeInactive
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  }

  static async getCustomerById(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check view details permission using hybrid RBAC/legacy system
      const canViewDetails = await CustomerPermissions.canViewCustomersHybrid(user);
      if (!canViewDetails) {
        return res.status(403).json({ error: 'Insufficient permissions to view customer details' });
      }

      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
      }

      const customer = await CustomerService.getCustomerById(customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json(customer);
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ error: 'Failed to fetch customer' });
    }
  }

  static async getManufacturingPreferences(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const canView = await CustomerPermissions.canViewCustomersHybrid(user);
      if (!canView) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions to view customer preferences' });
      }

      const customerId = parseInt(req.params.id);

      if (isNaN(customerId)) {
        return res.status(400).json({ success: false, error: 'Invalid customer ID' });
      }

      const preferences = await CustomerService.getManufacturingPreferences(customerId);

      if (!preferences) {
        return res.status(404).json({ success: false, error: 'Customer preferences not found' });
      }

      return res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('Error fetching customer manufacturing preferences:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch customer manufacturing preferences' });
    }
  }

  static async updateCustomer(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check edit permission using hybrid RBAC/legacy system
      const canEdit = await CustomerPermissions.canEditCustomersHybrid(user);
      if (!canEdit) {
        return res.status(403).json({ error: 'Insufficient permissions to edit customers' });
      }

      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
      }

      await CustomerService.updateCustomer(customerId, req.body, user?.username || 'system');

      res.json({ message: 'Customer updated successfully' });
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }

  static async createCustomer(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check create permission using hybrid RBAC/legacy system
      const canCreate = await CustomerPermissions.canEditCustomersHybrid(user);
      if (!canCreate) {
        return res.status(403).json({ error: 'Insufficient permissions to create customers' });
      }

      const { addresses = [] } = req.body;

      const newCustomer = await CustomerService.createCustomer(req.body);

      if (Array.isArray(addresses) && addresses.length > 0) {
        const createdBy = user?.username || 'system';
        const normalizedAddresses = addresses
          .filter((address: any) => address?.province_state_short && address.province_state_short.trim())
          .map((address: any) => {
            const getTrimmedString = (value: unknown): string | null => {
              if (typeof value !== 'string') return null;
              const trimmed = value.trim();
              return trimmed.length > 0 ? trimmed : null;
            };

            const toNumberOrNull = (value: unknown): number | null => {
              if (value === null || value === undefined) return null;
              const parsed = Number(value);
              return Number.isFinite(parsed) ? parsed : null;
            };

            return {
              is_primary: Boolean(address?.is_primary),
              is_billing: Boolean(address?.is_billing),
              is_shipping: address?.is_shipping === undefined ? true : Boolean(address.is_shipping),
              is_jobsite: Boolean(address?.is_jobsite),
              is_mailing: Boolean(address?.is_mailing),
              address_line1: getTrimmedString(address?.address_line1),
              address_line2: getTrimmedString(address?.address_line2),
              city: getTrimmedString(address?.city),
              province_state_long: getTrimmedString(address?.province_state_long),
              province_state_short: address.province_state_short.trim(),
              postal_zip: getTrimmedString(address?.postal_zip),
              country: getTrimmedString(address?.country) || 'Canada',
              tax_override_percent: toNumberOrNull(address?.tax_override_percent),
              tax_type: getTrimmedString(address?.tax_type),
              tax_id: toNumberOrNull(address?.tax_id),
              tax_override_reason: getTrimmedString(address?.tax_override_reason),
              use_province_tax: address?.use_province_tax === undefined ? true : Boolean(address.use_province_tax),
              comments: getTrimmedString(address?.comments)
            };
          });

        const hasPrimaryAddress = normalizedAddresses.some(address => address.is_primary);

        if (!hasPrimaryAddress && normalizedAddresses.length > 0) {
          normalizedAddresses[0].is_primary = true;
        }

        for (const address of normalizedAddresses) {
          await AddressService.addAddress(newCustomer.customer_id, address, createdBy);
        }
      }

      const customerWithAddresses = await CustomerService.getCustomerById(newCustomer.customer_id);
      
      res.status(201).json(customerWithAddresses);
    } catch (error) {
      console.error('Error creating customer:', error);
      if (error instanceof Error && error.message === 'Company name is required') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create customer' });
    }
  }

  static async deactivateCustomer(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check deactivate permission using hybrid RBAC/legacy system
      const canDeactivate = await CustomerPermissions.canDeactivateCustomersHybrid(user);
      if (!canDeactivate) {
        return res.status(403).json({ error: 'Only managers and owners can deactivate customers' });
      }

      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
      }

      await CustomerService.deactivateCustomer(customerId);

      res.json({ message: 'Customer deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating customer:', error);
      if (error instanceof Error && error.message === 'Customer not found or already deactivated') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to deactivate customer' });
    }
  }

  static async reactivateCustomer(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check reactivate permission using hybrid RBAC/legacy system
      const canReactivate = await CustomerPermissions.canReactivateCustomersHybrid(user);
      if (!canReactivate) {
        return res.status(403).json({ error: 'Only managers and owners can reactivate customers' });
      }

      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
      }

      await CustomerService.reactivateCustomer(customerId);

      res.json({ message: 'Customer reactivated successfully' });
    } catch (error) {
      console.error('Error reactivating customer:', error);
      if (error instanceof Error && error.message === 'Customer not found or already active') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to reactivate customer' });
    }
  }
}
