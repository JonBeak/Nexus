import { Request, Response } from 'express';
import { CustomerService } from '../../services/customers/customerService';
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

      const newCustomer = await CustomerService.createCustomer(req.body);
      
      res.status(201).json(newCustomer);
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