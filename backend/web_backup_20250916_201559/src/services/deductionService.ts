/**
 * Deduction Service
 * 
 * Business logic layer for payroll deduction management
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 * 
 * Responsibilities:
 * - Tax deduction calculations (CPP, EI, Federal Tax)
 * - Deduction override management and validation
 * - Batch deduction operations with merge logic
 * - Deduction data transformation for frontend consumption
 * 
 * Extracted from wages.ts during refactoring - all deduction logic preserved exactly
 */

import { PayrollRepository } from '../repositories/payrollRepository';
import {
  DeductionOverride,
  DeductionOverrideMap,
  DeductionUpdateRequest,
  BatchDeductionUpdate,
  DeductionManagementService as IDeductionManagementService
} from '../types/payrollTypes';

export class DeductionService implements IDeductionManagementService {
  
  constructor(private payrollRepository: PayrollRepository) {}
  
  // =============================================
  // DEDUCTION OVERRIDE LOADING
  // =============================================
  
  /**
   * Load deduction overrides and convert to frontend format
   * Preserves exact logic from original wages.ts (lines 22-39)
   */
  async loadDeductionOverrides(startDate: string, endDate: string): Promise<DeductionOverrideMap> {
    try {
      const overrides = await this.payrollRepository.getDeductionOverrides(startDate, endDate);
      
      // Convert to object format expected by frontend - exact logic preserved
      const overrideMap: DeductionOverrideMap = {};
      overrides.forEach(override => {
        overrideMap[override.user_id] = {
          cpp: parseFloat(override.cpp_deduction?.toString() || '0') || 0,
          ei: parseFloat(override.ei_deduction?.toString() || '0') || 0,
          tax: parseFloat(override.federal_tax?.toString() || '0') || 0
        };
      });
      
      return overrideMap;
    } catch (error) {
      console.error('Service error loading deduction overrides:', error);
      throw new Error('Failed to load deduction overrides');
    }
  }
  
  // =============================================
  // SINGLE DEDUCTION UPDATES
  // =============================================
  
  /**
   * Update a single deduction override
   * Preserves exact logic from original wages.ts (lines 414-442)
   */
  async updateDeduction(request: DeductionUpdateRequest): Promise<void> {
    try {
      await this.payrollRepository.upsertDeductionOverride(request);
    } catch (error) {
      console.error('Service error updating deduction:', error);
      throw new Error('Failed to update deduction override');
    }
  }
  
  // =============================================
  // BATCH DEDUCTION UPDATES
  // =============================================
  
  /**
   * Process batch deduction updates with field preservation
   * Preserves exact merge logic from original wages.ts (lines 460-491)
   */
  async batchUpdateDeductions(request: BatchDeductionUpdate): Promise<void> {
    try {
      if (!request.updates || !Array.isArray(request.updates)) {
        throw new Error('Invalid batch update data - updates array required');
      }
      
      await this.payrollRepository.batchUpsertDeductionOverrides(request.updates);
    } catch (error) {
      console.error('Service error processing batch deduction updates:', error);
      throw new Error('Failed to process batch deduction updates');
    }
  }
  
  // =============================================
  // DEDUCTION VALIDATION
  // =============================================
  
  /**
   * Validate deduction update request
   */
  validateDeductionUpdate(request: DeductionUpdateRequest): void {
    if (!request.user_id || !request.pay_period_start || !request.pay_period_end) {
      throw new Error('Missing required fields: user_id, pay_period_start, pay_period_end');
    }
    
    // Validate date format
    const startDate = new Date(request.pay_period_start);
    const endDate = new Date(request.pay_period_end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format for pay period');
    }
    
    if (startDate >= endDate) {
      throw new Error('Pay period start date must be before end date');
    }
    
    // Validate deduction amounts (if provided)
    const deductionFields = ['cpp_deduction', 'ei_deduction', 'federal_tax', 'provincial_tax'];
    
    deductionFields.forEach(field => {
      const value = request[field as keyof DeductionUpdateRequest];
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(value.toString());
        if (isNaN(numValue) || numValue < 0) {
          throw new Error(`Invalid ${field}: must be a non-negative number`);
        }
      }
    });
  }
  
  /**
   * Validate batch deduction update request
   */
  validateBatchDeductionUpdate(request: BatchDeductionUpdate): void {
    if (!request.updates || !Array.isArray(request.updates)) {
      throw new Error('Invalid batch update: updates array required');
    }
    
    if (request.updates.length === 0) {
      throw new Error('Batch update cannot be empty');
    }
    
    if (request.updates.length > 100) {
      throw new Error('Batch update too large: maximum 100 updates per batch');
    }
    
    // Validate each update
    request.updates.forEach((update, index) => {
      try {
        this.validateDeductionUpdate(update);
      } catch (error) {
        throw new Error(`Invalid update at index ${index}: ${(error as Error).message}`);
      }
    });
  }
  
  // =============================================
  // DEDUCTION CALCULATIONS
  // =============================================
  
  /**
   * Calculate default deductions based on gross pay and settings
   * This can be extended in the future for automatic tax calculations
   */
  async calculateDefaultDeductions(grossPay: number, vacationPay: number, province?: string): Promise<{
    cpp_deduction: number;
    ei_deduction: number;
    federal_tax: number;
    provincial_tax: number;
  }> {
    try {
      // For now, return zeros as the system uses manual overrides
      // This method provides a foundation for future automatic tax calculation
      return {
        cpp_deduction: 0,
        ei_deduction: 0,
        federal_tax: 0,
        provincial_tax: 0
      };
    } catch (error) {
      console.error('Service error calculating default deductions:', error);
      throw new Error('Failed to calculate default deductions');
    }
  }
  
  // =============================================
  // UTILITY METHODS
  // =============================================
  
  /**
   * Get deduction overrides for a specific user and pay period
   */
  async getUserDeductionOverrides(userId: number, startDate: string, endDate: string): Promise<DeductionOverride | null> {
    try {
      const overrides = await this.payrollRepository.getDeductionOverrideForUser(userId, startDate, endDate);
      return overrides.length > 0 ? overrides[0] : null;
    } catch (error) {
      console.error('Service error getting user deduction overrides:', error);
      throw new Error('Failed to get user deduction overrides');
    }
  }
  
  /**
   * Transform deduction override to frontend format
   */
  transformOverrideToFrontendFormat(override: DeductionOverride): {
    cpp: number;
    ei: number;
    tax: number;
  } {
    return {
      cpp: parseFloat(override.cpp_deduction?.toString() || '0') || 0,
      ei: parseFloat(override.ei_deduction?.toString() || '0') || 0,
      tax: parseFloat(override.federal_tax?.toString() || '0') || 0
    };
  }
  
  /**
   * Transform frontend deduction data to database format
   */
  transformFrontendToOverrideFormat(
    userId: number,
    startDate: string,
    endDate: string,
    deductions: { cpp?: number; ei?: number; tax?: number }
  ): DeductionUpdateRequest {
    return {
      user_id: userId,
      pay_period_start: startDate,
      pay_period_end: endDate,
      cpp_deduction: deductions.cpp,
      ei_deduction: deductions.ei,
      federal_tax: deductions.tax,
      provincial_tax: 0 // Not currently used
    };
  }
}