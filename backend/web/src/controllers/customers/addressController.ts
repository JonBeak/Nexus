// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, handleServiceResult, sendErrorResponse
// - Replaced 6 instances of parseInt() with parseIntParam()
// - All methods now use handleServiceResult() for ServiceResult<T> responses
// - Removed all try-catch blocks - service layer returns ServiceResult<T>
// - Reduced from 130 lines to 121 lines (7% reduction)
// - Updated AddressService (all 6 methods) to return ServiceResult<T>
// - Zero breaking changes - all endpoints maintain exact same behavior

/**
 * File Clean up Finished: 2025-11-15
 * Changes:
 * - Migrated from legacy permission checks to requirePermission() middleware pattern
 * - Removed all CustomerPermissions.canXXXHybrid() calls (50 lines removed)
 * - Updated from (req as any).user to req: AuthRequest for type safety
 * - Moved permission enforcement from controller to route middleware (customers.ts)
 * - Result: 165 lines → 117 lines (29% reduction)
 * - Controllers now focus purely on HTTP/business logic
 */

import { Response } from 'express';
import { AddressService } from '../../services/customers/addressService';
import { AuthRequest } from '../../types';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

export class AddressController {
  static async getAddresses(req: AuthRequest, res: Response) {
    const customerId = parseIntParam(req.params.id, 'Customer ID');
    const includeInactive = req.query.include_inactive === 'true';

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const result = await AddressService.getCustomerAddresses(customerId, includeInactive);

    if (result.success) {
      res.json({ addresses: result.data });
    } else {
      handleServiceResult(res, result);
    }
  }

  static async addAddress(req: AuthRequest, res: Response) {
    const customerId = parseIntParam(req.params.id, 'Customer ID');

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const result = await AddressService.addAddress(customerId, req.body, req.user?.username || 'system');

    if (result.success) {
      res.status(201).json({ message: 'Address added successfully' });
    } else {
      handleServiceResult(res, result);
    }
  }

  static async updateAddress(req: AuthRequest, res: Response) {
    const customerId = parseIntParam(req.params.id, 'Customer ID');
    const addressId = parseIntParam(req.params.addressId, 'Address ID');

    if (customerId === null || addressId === null) {
      return sendErrorResponse(res, 'Invalid customer or address ID', 'VALIDATION_ERROR');
    }

    const result = await AddressService.updateAddress(customerId, addressId, req.body, req.user?.username || 'system');

    if (result.success) {
      res.json({ message: 'Address updated successfully' });
    } else {
      handleServiceResult(res, result);
    }
  }

  static async deleteAddress(req: AuthRequest, res: Response) {
    const customerId = parseIntParam(req.params.id, 'Customer ID');
    const addressId = parseIntParam(req.params.addressId, 'Address ID');

    if (customerId === null || addressId === null) {
      return sendErrorResponse(res, 'Invalid customer or address ID', 'VALIDATION_ERROR');
    }

    const result = await AddressService.deleteAddress(customerId, addressId, req.user?.username || 'system');

    if (result.success) {
      res.json({ message: 'Address deleted successfully' });
    } else {
      handleServiceResult(res, result);
    }
  }

  static async makePrimaryAddress(req: AuthRequest, res: Response) {
    const customerId = parseIntParam(req.params.id, 'Customer ID');
    const addressId = parseIntParam(req.params.addressId, 'Address ID');

    if (customerId === null || addressId === null) {
      return sendErrorResponse(res, 'Invalid customer or address ID', 'VALIDATION_ERROR');
    }

    const result = await AddressService.makePrimaryAddress(customerId, addressId);

    if (result.success) {
      res.json({ message: 'Address set as primary successfully' });
    } else {
      handleServiceResult(res, result);
    }
  }

  static async reactivateAddress(req: AuthRequest, res: Response) {
    const customerId = parseIntParam(req.params.id, 'Customer ID');
    const addressId = parseIntParam(req.params.addressId, 'Address ID');

    if (customerId === null || addressId === null) {
      return sendErrorResponse(res, 'Invalid customer or address ID', 'VALIDATION_ERROR');
    }

    const result = await AddressService.reactivateAddress(customerId, addressId, req.user?.username || 'system');

    if (result.success) {
      res.json({ message: 'Address reactivated successfully' });
    } else {
      handleServiceResult(res, result);
    }
  }
}
