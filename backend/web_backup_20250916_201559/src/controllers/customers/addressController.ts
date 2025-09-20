import { Request, Response } from 'express';
import { AddressService } from '../../services/customers/addressService';
import { CustomerPermissions } from '../../utils/customers/permissions';

export class AddressController {
  static async getAddresses(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check view permission using hybrid RBAC/legacy system
      const canView = await CustomerPermissions.canViewAddressesHybrid(user);
      if (!canView) {
        return res.status(403).json({ error: 'Insufficient permissions to view addresses' });
      }

      const customerId = parseInt(req.params.id);
      const includeInactive = req.query.include_inactive === 'true';
      
      if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
      }

      const addresses = await AddressService.getCustomerAddresses(customerId, includeInactive);

      res.json({ addresses });
    } catch (error) {
      console.error('Error fetching addresses:', error);
      res.status(500).json({ error: 'Failed to fetch addresses' });
    }
  }

  static async addAddress(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      // Check add permission using hybrid RBAC/legacy system
      const canAdd = await CustomerPermissions.canEditAddressesHybrid(user);
      if (!canAdd) {
        return res.status(403).json({ error: 'Insufficient permissions to add addresses' });
      }

      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
      }

      await AddressService.addAddress(customerId, req.body, user?.username || 'system');

      res.status(201).json({ message: 'Address added successfully' });
    } catch (error) {
      console.error('Error adding address:', error);
      if (error instanceof Error && error.message === 'Province/state is required for tax purposes') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add address' });
    }
  }

  static async updateAddress(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check update permission using hybrid RBAC/legacy system
      const canUpdate = await CustomerPermissions.canEditAddressesHybrid(user);
      if (!canUpdate) {
        return res.status(403).json({ error: 'Insufficient permissions to update addresses' });
      }

      const customerId = parseInt(req.params.id);
      const addressId = parseInt(req.params.addressId);
      
      if (isNaN(customerId) || isNaN(addressId)) {
        return res.status(400).json({ error: 'Invalid customer or address ID' });
      }

      await AddressService.updateAddress(customerId, addressId, req.body, user?.username || 'system');

      res.json({ message: 'Address updated successfully' });
    } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({ error: 'Failed to update address' });
    }
  }

  static async deleteAddress(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check deletion permission using hybrid RBAC/legacy system
      const canDelete = await CustomerPermissions.canDeleteAddressesHybrid(user);
      if (!canDelete) {
        return res.status(403).json({ error: 'Only managers and owners can delete addresses' });
      }

      const customerId = parseInt(req.params.id);
      const addressId = parseInt(req.params.addressId);
      
      if (isNaN(customerId) || isNaN(addressId)) {
        return res.status(400).json({ error: 'Invalid customer or address ID' });
      }

      await AddressService.deleteAddress(customerId, addressId, user?.username || 'system');

      res.json({ message: 'Address deleted successfully' });
    } catch (error) {
      console.error('Error deleting address:', error);
      res.status(500).json({ error: 'Failed to delete address' });
    }
  }

  static async makePrimaryAddress(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check make-primary permission using hybrid RBAC/legacy system
      const canMakePrimary = await CustomerPermissions.canEditAddressesHybrid(user);
      if (!canMakePrimary) {
        return res.status(403).json({ error: 'Insufficient permissions to update addresses' });
      }

      const customerId = parseInt(req.params.id);
      const addressId = parseInt(req.params.addressId);
      
      if (isNaN(customerId) || isNaN(addressId)) {
        return res.status(400).json({ error: 'Invalid customer or address ID' });
      }

      await AddressService.makePrimaryAddress(customerId, addressId);

      res.json({ message: 'Address set as primary successfully' });
    } catch (error) {
      console.error('Error setting primary address:', error);
      res.status(500).json({ error: 'Failed to set primary address' });
    }
  }

  static async reactivateAddress(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      // Check reactivate permission using hybrid RBAC/legacy system
      const canReactivate = await CustomerPermissions.canEditAddressesHybrid(user);
      if (!canReactivate) {
        return res.status(403).json({ error: 'Insufficient permissions to reactivate address' });
      }

      const customerId = parseInt(req.params.id);
      const addressId = parseInt(req.params.addressId);
      
      if (isNaN(customerId) || isNaN(addressId)) {
        return res.status(400).json({ error: 'Invalid customer or address ID' });
      }

      await AddressService.reactivateAddress(customerId, addressId, user?.username || 'system');

      res.json({ message: 'Address reactivated successfully' });
    } catch (error) {
      console.error('Error reactivating address:', error);
      res.status(500).json({ error: 'Failed to reactivate address' });
    }
  }
}