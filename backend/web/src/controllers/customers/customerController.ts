// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, sendErrorResponse, sendSuccessResponse
// - Replaced 5 instances of parseInt() with parseIntParam() for customer ID validation
// - Replaced 2 instances of parseInt() with parseIntParam() for page/limit (lines 37-38)
// - Replaced 18 instances of manual res.status().json() with helper functions:
//   * 7 permission errors (403) → sendErrorResponse() with PERMISSION_DENIED
//   * 5 validation errors (400) → sendErrorResponse() with VALIDATION_ERROR
//   * 4 not found errors (404) → sendErrorResponse() with NOT_FOUND
//   * 4 internal errors (500) → sendErrorResponse() with INTERNAL_ERROR
//   * 1 success response → sendSuccessResponse()
// - Zero breaking changes - all API responses maintain structure
// - Build verified - no new TypeScript errors introduced

// File Clean up Finished: 2025-11-15
// Cleanup Summary:
// - ✅ Extracted inline helper functions (getTrimmedString, toNumberOrUndefined) to utils/validation.ts
// - ✅ Eliminated function redefinition on every array iteration (performance improvement)
// - ✅ Made sanitization utilities reusable across entire codebase
// - ✅ Reduced file from 255 → 248 lines (7 lines saved, 252 lines under limit)
// - ✅ No database access violations - proper 3-layer architecture maintained
// - ✅ All HTTP concerns properly handled in controller layer
// - ✅ Build verified - no TypeScript errors
//
// File Clean up Finished: 2025-11-20
// Migration to requirePermission() middleware pattern - COMPLETED
// - ✅ Removed all CustomerPermissions.canXXXHybrid() calls (7 instances, ~50 lines)
// - ✅ Removed CustomerPermissions import and class usage
// - ✅ Updated all method signatures from Request to AuthRequest for type safety
// - ✅ Changed (req as any).user to req.user (TypeScript-safe)
// - ✅ Added route-level permission middleware in customers.ts (13 routes updated)
// - ✅ Deleted utils/customers/permissions.ts file (84 lines removed)
// - ✅ Result: 248 lines → ~190 lines (23% reduction in this file, 134 lines total reduction)
// - ✅ Controllers now focus purely on HTTP/business logic
// - ✅ Consistent with AddressController pattern (migrated Nov 15)

import { Response } from 'express';
import { CustomerService } from '../../services/customers/customerService';
import { AddressService } from '../../services/customers/addressService';
import { customerRepository } from '../../repositories/customerRepository';
import { getTrimmedString, toNumberOrUndefined } from '../../utils/validation';
import { parseIntParam, sendErrorResponse, sendSuccessResponse } from '../../utils/controllerHelpers';
import { AuthRequest } from '../../types';

export class CustomerController {
  /**
   * Get customer by company name (case-insensitive)
   * Used for URL-based navigation in job estimation
   * @route GET /customers/by-name/:name
   */
  static async getCustomerByName(req: AuthRequest, res: Response) {
    try {
      const companyName = decodeURIComponent(req.params.name);

      if (!companyName || !companyName.trim()) {
        return sendErrorResponse(res, 'Company name is required', 'VALIDATION_ERROR');
      }

      const customer = await customerRepository.getCustomerByName(companyName);

      if (!customer) {
        return sendErrorResponse(res, 'Customer not found', 'NOT_FOUND');
      }

      res.json({ success: true, data: customer });
    } catch (error) {
      console.error('Error fetching customer by name:', error);
      return sendErrorResponse(res, 'Failed to fetch customer', 'INTERNAL_ERROR');
    }
  }

  static async getCustomers(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const page = parseIntParam(req.query.page as string, 'page') || 1;
      const limit = parseIntParam(req.query.limit as string, 'limit') || 25;
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
      return sendErrorResponse(res, 'Failed to fetch customers', 'INTERNAL_ERROR');
    }
  }

  static async getCustomerById(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const customerId = parseIntParam(req.params.id, 'customer ID');
      if (customerId === null) {
        return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
      }

      const customer = await CustomerService.getCustomerById(customerId);

      if (!customer) {
        return sendErrorResponse(res, 'Customer not found', 'NOT_FOUND');
      }

      res.json(customer);
    } catch (error) {
      console.error('Error fetching customer:', error);
      return sendErrorResponse(res, 'Failed to fetch customer', 'INTERNAL_ERROR');
    }
  }

  static async getManufacturingPreferences(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const customerId = parseIntParam(req.params.id, 'customer ID');
      if (customerId === null) {
        return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
      }

      const preferences = await CustomerService.getManufacturingPreferences(customerId);

      if (!preferences) {
        return sendErrorResponse(res, 'Customer preferences not found', 'NOT_FOUND');
      }

      return sendSuccessResponse(res, preferences);
    } catch (error) {
      console.error('Error fetching customer manufacturing preferences:', error);
      return sendErrorResponse(res, 'Failed to fetch customer manufacturing preferences', 'INTERNAL_ERROR');
    }
  }

  static async updateCustomer(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const customerId = parseIntParam(req.params.id, 'customer ID');
      if (customerId === null) {
        return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
      }

      await CustomerService.updateCustomer(customerId, req.body, req.user?.username || 'system');

      res.json({ message: 'Customer updated successfully' });
    } catch (error) {
      console.error('Error updating customer:', error);
      return sendErrorResponse(res, 'Failed to update customer', 'INTERNAL_ERROR');
    }
  }

  static async createCustomer(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const { addresses = [], createInQB = false } = req.body;

      // Find primary address for QB BillAddr and tax info
      const primaryAddress = addresses.find((addr: any) => addr?.is_primary) || addresses[0];
      const primaryAddressForQB = primaryAddress ? {
        address_line1: getTrimmedString(primaryAddress?.address_line1),
        address_line2: getTrimmedString(primaryAddress?.address_line2),
        city: getTrimmedString(primaryAddress?.city),
        province_state_short: primaryAddress?.province_state_short?.trim(),
        postal_zip: getTrimmedString(primaryAddress?.postal_zip),
        country: getTrimmedString(primaryAddress?.country) || 'Canada',
        tax_type: getTrimmedString(primaryAddress?.tax_type) // For QB DefaultTaxCodeRef
      } : undefined;

      // Create customer with optional QB sync
      const { customer: newCustomer, qbResult } = await CustomerService.createCustomer(
        req.body,
        { createInQB, primaryAddress: primaryAddressForQB }
      );

      if (!newCustomer) {
        return sendErrorResponse(res, 'Failed to create customer', 'INTERNAL_ERROR');
      }

      if (Array.isArray(addresses) && addresses.length > 0) {
        console.log(`[CustomerController] Processing ${addresses.length} address(es) for customer ${newCustomer.customer_id}`);
        console.log('[CustomerController] Address data received:', JSON.stringify(addresses, null, 2));

        const createdBy = req.user?.username || 'system';
        const normalizedAddresses = addresses
          .filter((address: any) => address?.province_state_short && address.province_state_short.trim())
          .map((address: any) => ({
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
            tax_override_percent: toNumberOrUndefined(address?.tax_override_percent),
            tax_type: getTrimmedString(address?.tax_type),
            tax_id: toNumberOrUndefined(address?.tax_id),
            tax_override_reason: getTrimmedString(address?.tax_override_reason),
            use_province_tax: address?.use_province_tax === undefined ? true : Boolean(address.use_province_tax),
            comments: getTrimmedString(address?.comments)
          }));

        console.log(`[CustomerController] After filtering: ${normalizedAddresses.length} valid address(es)`);
        if (normalizedAddresses.length > 0) {
          console.log('[CustomerController] Normalized addresses:', JSON.stringify(normalizedAddresses, null, 2));
        }

        const hasPrimaryAddress = normalizedAddresses.some(address => address.is_primary);

        if (!hasPrimaryAddress && normalizedAddresses.length > 0) {
          normalizedAddresses[0].is_primary = true;
        }

        const addressErrors: string[] = [];
        for (const address of normalizedAddresses) {
          const result = await AddressService.addAddress(newCustomer.customer_id, address, createdBy);
          if (!result.success) {
            console.error(`[CustomerController] Failed to create address for customer ${newCustomer.customer_id}:`, result.error);
            addressErrors.push(result.error || 'Unknown address error');
          }
        }

        if (addressErrors.length > 0) {
          console.warn(`[CustomerController] Customer ${newCustomer.customer_id} created but ${addressErrors.length} address(es) failed`);
        }
      }

      const customerWithAddresses = await CustomerService.getCustomerById(newCustomer.customer_id);

      // Check if addresses were created (should have at least one if provided)
      const addressWarnings: string[] = [];
      if (addresses.length > 0 && (!customerWithAddresses?.addresses || customerWithAddresses.addresses.length === 0)) {
        addressWarnings.push('Address was provided but not saved. Please add the address manually.');
      }

      // Include QB result in response so frontend knows sync status
      res.status(201).json({
        ...customerWithAddresses,
        qbResult: qbResult ? {
          success: qbResult.success,
          qbCustomerId: qbResult.qbCustomerId,
          existingCustomer: qbResult.existingCustomer,
          error: qbResult.error
        } : undefined,
        addressWarnings: addressWarnings.length > 0 ? addressWarnings : undefined
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      if (error instanceof Error) {
        if (error.message === 'Company name is required') {
          return sendErrorResponse(res, error.message, 'VALIDATION_ERROR');
        }
        if ((error as any).code === 'DUPLICATE_ENTRY') {
          return sendErrorResponse(res, error.message, 'DUPLICATE_ENTRY');
        }
      }
      return sendErrorResponse(res, 'Failed to create customer', 'INTERNAL_ERROR');
    }
  }

  static async deactivateCustomer(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const customerId = parseIntParam(req.params.id, 'customer ID');
      if (customerId === null) {
        return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
      }

      await CustomerService.deactivateCustomer(customerId);

      res.json({ message: 'Customer deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating customer:', error);
      if (error instanceof Error && error.message === 'Customer not found or already deactivated') {
        return sendErrorResponse(res, error.message, 'NOT_FOUND');
      }
      return sendErrorResponse(res, 'Failed to deactivate customer', 'INTERNAL_ERROR');
    }
  }

  static async reactivateCustomer(req: AuthRequest, res: Response) {
    try {
      // Permissions enforced at route level via requirePermission() middleware
      const customerId = parseIntParam(req.params.id, 'customer ID');
      if (customerId === null) {
        return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
      }

      await CustomerService.reactivateCustomer(customerId);

      res.json({ message: 'Customer reactivated successfully' });
    } catch (error) {
      console.error('Error reactivating customer:', error);
      if (error instanceof Error && error.message === 'Customer not found or already active') {
        return sendErrorResponse(res, error.message, 'NOT_FOUND');
      }
      return sendErrorResponse(res, 'Failed to reactivate customer', 'INTERNAL_ERROR');
    }
  }
}
