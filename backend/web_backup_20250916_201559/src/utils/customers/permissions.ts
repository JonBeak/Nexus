import { Request, Response } from 'express';
import { User } from '../../types';
import { hybridPermissionCheck } from '../../middleware/rbac';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class CustomerPermissions {
  /**
   * Check if user can view customer data
   * Only managers and designers can view customer data, production staff cannot
   */
  static canViewCustomers(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Check if user can view customer details
   * Same as viewing customers - only managers and designers
   */
  static canViewCustomerDetails(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Check if user can edit customers
   * Only managers and designers can edit customers
   */
  static canEditCustomers(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Check if user can create customers
   * Only managers and designers can create customers
   */
  static canCreateCustomers(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Check if user can deactivate/reactivate customers
   * Only managers and owners can deactivate/reactivate customers
   */
  static canDeactivateCustomers(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view addresses
   * Only managers and designers can view addresses
   */
  static canViewAddresses(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Check if user can add/edit addresses
   * Only managers and designers can add/edit addresses
   */
  static canEditAddresses(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Check if user can delete addresses
   * Only managers and owners can delete addresses
   */
  static canDeleteAddresses(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can reactivate addresses
   * Only managers and designers can reactivate addresses
   */
  static canReactivateAddresses(user: User): boolean {
    return user.role === 'manager' || user.role === 'designer';
  }

  /**
   * Middleware to check if user can view customers
   */
  static requireViewCustomers(req: AuthenticatedRequest, res: Response, next: any) {
    const user = req.user;
    if (!user || !CustomerPermissions.canViewCustomers(user)) {
      return res.status(403).json({ error: 'Insufficient permissions to view customers' });
    }
    next();
  }

  /**
   * Middleware to check if user can edit customers
   */
  static requireEditCustomers(req: AuthenticatedRequest, res: Response, next: any) {
    const user = req.user;
    if (!user || !CustomerPermissions.canEditCustomers(user)) {
      return res.status(403).json({ error: 'Insufficient permissions to edit customers' });
    }
    next();
  }

  /**
   * Middleware to check if user can deactivate customers
   */
  static requireDeactivateCustomers(req: AuthenticatedRequest, res: Response, next: any) {
    const user = req.user;
    if (!user || !CustomerPermissions.canDeactivateCustomers(user)) {
      return res.status(403).json({ error: 'Only managers and owners can deactivate customers' });
    }
    next();
  }

  /**
   * Middleware to check if user can view addresses
   */
  static requireViewAddresses(req: AuthenticatedRequest, res: Response, next: any) {
    const user = req.user;
    if (!user || !CustomerPermissions.canViewAddresses(user)) {
      return res.status(403).json({ error: 'Insufficient permissions to view addresses' });
    }
    next();
  }

  /**
   * Middleware to check if user can edit addresses
   */
  static requireEditAddresses(req: AuthenticatedRequest, res: Response, next: any) {
    const user = req.user;
    if (!user || !CustomerPermissions.canEditAddresses(user)) {
      return res.status(403).json({ error: 'Insufficient permissions to edit addresses' });
    }
    next();
  }

  /**
   * Middleware to check if user can delete addresses
   */
  static requireDeleteAddresses(req: AuthenticatedRequest, res: Response, next: any) {
    const user = req.user;
    if (!user || !CustomerPermissions.canDeleteAddresses(user)) {
      return res.status(403).json({ error: 'Only managers and owners can delete addresses' });
    }
    next();
  }

  /**
   * Get user role display name
   */
  static getRoleDisplayName(role: string): string {
    switch (role) {
      case 'manager': return 'Manager';
      case 'designer': return 'Designer';
      case 'production_staff': return 'Production Staff';
      case 'owner': return 'Owner';
      default: return 'Unknown';
    }
  }

  // =====================================================
  // HYBRID PERMISSION FUNCTIONS (Phase 2)
  // =====================================================

  /**
   * Hybrid permission check for address deletion
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canDeleteAddressesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customer_addresses.delete',
      ['manager', 'owner']
    );
  }

  /**
   * Hybrid permission check for customer deactivation
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canDeactivateCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.deactivate',
      ['manager', 'owner']
    );
  }

  /**
   * Hybrid permission check for customer reactivation
   * Uses RBAC if enabled, falls back to legacy role check  
   */
  static async canReactivateCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.activate',
      ['manager', 'owner']
    );
  }

  /**
   * Hybrid permission check for viewing customers
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canViewCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.read',
      ['manager', 'designer', 'owner']
    );
  }

  /**
   * Hybrid permission check for editing customers
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canEditCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.update',
      ['manager', 'designer', 'owner']
    );
  }

  /**
   * Hybrid permission check for viewing addresses
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canViewAddressesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customer_addresses.read',
      ['manager', 'designer', 'owner']
    );
  }

  /**
   * Hybrid permission check for editing addresses
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canEditAddressesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customer_addresses.update',
      ['manager', 'designer', 'owner']
    );
  }
}