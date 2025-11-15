// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: sendErrorResponse
// - Replaced 0 instances of parseInt() (none present)
// - Replaced 7 instances of manual res.status().json() with sendErrorResponse()
// - Service layer uses appropriate error handling

// File Clean up Finished: 2025-11-15
// Cleanup Summary:
// - ✅ Migrated all 6 methods from Request to AuthRequest for type consistency
// - ✅ Proper 3-layer architecture maintained (Controller → Service → Repository)
// - ✅ LookupService already uses query() helper (cleaned Nov 14, 2025)
// - ✅ No direct database access - all delegated to service layer
// - ✅ Proper error handling in all methods
// - ✅ File size: 73 lines (well under 300-line controller limit)
// - ✅ No permission checks needed - lookup data is public (auth required but no RBAC)

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { LookupService } from '../../services/customers/lookupService';
import { sendErrorResponse } from '../../utils/controllerHelpers';

export class LookupController {
  static async getLedTypes(req: AuthRequest, res: Response) {
    try {
      const ledTypes = await LookupService.getLedTypes();
      res.json(ledTypes);
    } catch (error) {
      console.error('Error fetching LED types:', error);
      sendErrorResponse(res, 'Failed to fetch LED types', 'INTERNAL_ERROR');
    }
  }

  static async getPowerSupplyTypes(req: AuthRequest, res: Response) {
    try {
      const powerSupplyTypes = await LookupService.getPowerSupplyTypes();
      res.json(powerSupplyTypes);
    } catch (error) {
      console.error('Error fetching Power Supply types:', error);
      sendErrorResponse(res, 'Failed to fetch Power Supply types', 'INTERNAL_ERROR');
    }
  }

  static async getTaxInfoByProvince(req: AuthRequest, res: Response) {
    try {
      const province = req.params.province;
      const taxInfo = await LookupService.getTaxInfoByProvince(province);
      
      if (!taxInfo) {
        return sendErrorResponse(res, 'Tax information not found for province', 'NOT_FOUND');
      }
      
      res.json(taxInfo);
    } catch (error) {
      console.error('Error fetching tax info:', error);
      sendErrorResponse(res, 'Failed to fetch tax information', 'INTERNAL_ERROR');
    }
  }

  static async getAllProvincesTaxInfo(req: AuthRequest, res: Response) {
    try {
      const provincesData = await LookupService.getAllProvincesTaxInfo();
      res.json(provincesData);
    } catch (error) {
      console.error('Error fetching provinces tax data:', error);
      sendErrorResponse(res, 'Failed to fetch provinces tax data', 'INTERNAL_ERROR');
    }
  }

  static async getProvincesStates(req: AuthRequest, res: Response) {
    try {
      const provincesStates = await LookupService.getProvincesStates();
      res.json(provincesStates);
    } catch (error) {
      console.error('Error fetching provinces/states:', error);
      sendErrorResponse(res, 'Failed to fetch provinces/states', 'INTERNAL_ERROR');
    }
  }

  static async getAllTaxRules(req: AuthRequest, res: Response) {
    try {
      const taxRules = await LookupService.getAllTaxRules();
      res.json(taxRules);
    } catch (error) {
      console.error('Error fetching tax rules:', error);
      sendErrorResponse(res, 'Failed to fetch tax rules', 'INTERNAL_ERROR');
    }
  }
}