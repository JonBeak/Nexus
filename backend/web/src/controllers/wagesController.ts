/**
 * Wages Controller
 * 
 * HTTP request/response handling layer for payroll operations
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 * 
 * Responsibilities:
 * - HTTP request validation and parameter extraction
 * - Response formatting and error handling
 * - RBAC permission enforcement (wages.manage permission)
 * - Request routing to appropriate services
 * 
 * Extracted from wages.ts during refactoring - all endpoints preserved exactly
 */

import { Request, Response } from 'express';
import { PayrollRepository } from '../repositories/payrollRepository';
import { PayrollCalculationService } from '../services/payrollCalculationService';
import { DeductionService } from '../services/deductionService';
import { PaymentRecordService } from '../services/paymentRecordService';
import { hasPermission } from '../middleware/rbac';
import {
  BiWeeklyWageRequest,
  PayrollUpdateChange,
  DeductionUpdateRequest,
  BatchDeductionUpdate,
  PaymentRecordRequest,
  PayrollSettingsUpdateRequest
} from '../types/payrollTypes';

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    role: string;
  };
}

export class WagesController {
  private payrollRepository: PayrollRepository;
  private payrollCalculationService: PayrollCalculationService;
  private deductionService: DeductionService;
  private paymentRecordService: PaymentRecordService;
  
  constructor() {
    this.payrollRepository = new PayrollRepository();
    this.payrollCalculationService = new PayrollCalculationService(this.payrollRepository);
    this.deductionService = new DeductionService(this.payrollRepository);
    this.paymentRecordService = new PaymentRecordService(this.payrollRepository);
  }
  
  // =============================================
  // PERMISSION VALIDATION
  // =============================================
  
  private async checkWagesPermission(userId: number, action?: string): Promise<boolean> {
    try {
      // Use RBAC system - check for wages management permission
      const permission = action ? `wages.${action}` : 'wages.manage';
      return await hasPermission(userId, permission);
    } catch (error) {
      console.error('Error checking wages permission:', error);
      return false;
    }
  }
  
  private async requireWagesPermission(req: AuthRequest, res: Response, action?: string): Promise<boolean> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return false;
    }
    
    const hasAccess = await this.checkWagesPermission(req.user.user_id, action);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Insufficient permissions for wages management' });
      return false;
    }
    
    return true;
  }
  
  // =============================================
  // DEDUCTION OVERRIDES
  // =============================================
  
  /**
   * Get deduction overrides for a pay period
   * Preserves exact endpoint from original wages.ts (lines 8-44)
   */
  getDeductionOverrides = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'view')) return;
      
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'startDate and endDate are required' 
        });
      }
      
      const overrideMap = await this.deductionService.loadDeductionOverrides(
        startDate as string,
        endDate as string
      );
      
      res.json(overrideMap);
    } catch (error) {
      console.error('Controller error fetching deduction overrides:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deduction overrides'
      });
    }
  };
  
  // =============================================
  // BI-WEEKLY WAGE DATA
  // =============================================
  
  /**
   * Get bi-weekly wage data with full calculations
   * Preserves exact endpoint from original wages.ts (lines 47-296)
   */
  getBiWeeklyWageData = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'view')) return;
      
      const { startDate, endDate, group } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }
      
      // Load deduction overrides first
      const overrides = await this.deductionService.loadDeductionOverrides(
        startDate as string,
        endDate as string
      );
      
      // Get wage data with overrides
      const userWageData = await this.payrollCalculationService.getBiWeeklyWageDataWithOverrides(
        startDate as string,
        endDate as string,
        overrides,
        group as string
      );
      
      res.json(userWageData);
    } catch (error) {
      console.error('Controller error fetching wage data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch wage data'
      });
    }
  };
  
  // =============================================
  // PAYROLL UPDATES
  // =============================================
  
  /**
   * Update payroll entries
   * Preserves exact endpoint from original wages.ts (lines 299-362)
   */
  updatePayroll = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'update')) return;
      
      const { changes } = req.body;
      
      if (!changes || !Array.isArray(changes)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid changes data'
        });
      }
      
      await this.payrollCalculationService.processPayrollChanges(changes as PayrollUpdateChange[]);
      
      // Log audit trail for each change
      if (req.user) {
        for (const change of changes) {
          await this.payrollRepository.logAuditTrail(
            req.user.user_id,
            'update',
            'payroll_entry',
            change.entry_id,
            `Adjusted payroll times: ${change.payroll_clock_in} - ${change.payroll_clock_out}, break: ${change.payroll_break_minutes}min`
          );
        }
      }
      
      res.json({ 
        success: true,
        message: 'Payroll entries updated successfully' 
      });
    } catch (error) {
      console.error('Controller error updating payroll entries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update payroll entries'
      });
    }
  };
  
  // =============================================
  // PAYROLL SETTINGS
  // =============================================
  
  /**
   * Get payroll settings
   * Preserves exact endpoint from original wages.ts (lines 365-382)
   */
  getPayrollSettings = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'view')) return;
      
      const settings = await this.payrollRepository.getAllPayrollSettings();
      
      res.json(settings);
    } catch (error) {
      console.error('Controller error fetching payroll settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payroll settings'
      });
    }
  };
  
  /**
   * Update payroll settings
   * Preserves exact endpoint from original wages.ts (lines 385-411)
   */
  updatePayrollSettings = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'admin')) return;
      
      const { settings } = req.body;
      
      if (!settings || !Array.isArray(settings)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid settings data'
        });
      }
      
      await this.payrollCalculationService.updatePayrollSettings(settings);
      
      res.json({ 
        success: true,
        message: 'Settings updated successfully' 
      });
    } catch (error) {
      console.error('Controller error updating payroll settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update payroll settings'
      });
    }
  };
  
  // =============================================
  // DEDUCTION UPDATES
  // =============================================
  
  /**
   * Update single deduction override
   * Preserves exact endpoint from original wages.ts (lines 414-443)
   */
  updateDeductions = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'update')) return;
      
      const request = req.body as DeductionUpdateRequest;
      
      await this.deductionService.updateDeduction(request);
      
      res.json({ 
        success: true,
        message: 'Deduction override saved successfully' 
      });
    } catch (error) {
      console.error('Controller error updating deductions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update deductions'
      });
    }
  };
  
  /**
   * Batch update deduction overrides
   * Preserves exact endpoint from original wages.ts (lines 446-499)
   */
  updateDeductionsBatch = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'update')) return;
      
      const request = req.body as BatchDeductionUpdate;
      
      await this.deductionService.batchUpdateDeductions(request);
      
      res.json({ 
        success: true,
        message: 'Batch deduction overrides saved successfully' 
      });
    } catch (error) {
      console.error('Controller error updating batch deductions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update batch deductions'
      });
    }
  };
  
  // =============================================
  // PAYMENT RECORDS
  // =============================================
  
  /**
   * Record payment
   * Preserves exact endpoint from original wages.ts (lines 502-551)
   */
  recordPayment = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'record')) return;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      const request = req.body as PaymentRecordRequest;
      
      const recordId = await this.paymentRecordService.recordPayment(request, req.user.user_id);
      
      res.json({ 
        success: true,
        message: 'Payment recorded successfully', 
        record_id: recordId 
      });
    } catch (error) {
      console.error('Controller error recording payment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record payment'
      });
    }
  };
  
  /**
   * Get payment history
   * Preserves exact endpoint from original wages.ts (lines 554-601)
   */
  getPaymentHistory = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'view')) return;
      
      const { includeInactive } = req.query;
      const includeInactiveFlag = includeInactive === 'true';
      
      const records = await this.paymentRecordService.getPaymentHistory(includeInactiveFlag);
      
      res.json(records);
    } catch (error) {
      console.error('Controller error fetching payment history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment history'
      });
    }
  };
  
  /**
   * Deactivate payment record (soft delete)
   * Preserves exact endpoint from original wages.ts (lines 604-653)
   */
  deactivatePaymentRecord = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'delete')) return;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      const recordId = parseInt(req.params.recordId);
      
      if (isNaN(recordId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid record ID'
        });
      }
      
      await this.paymentRecordService.deactivatePayment(recordId, req.user.user_id);
      
      res.json({ 
        success: true,
        message: 'Payment record deactivated successfully' 
      });
    } catch (error) {
      console.error('Controller error deactivating payment record:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to deactivate payment record'
      });
    }
  };
  
  /**
   * Reactivate payment record
   * Preserves exact endpoint from original wages.ts (lines 656-705)
   */
  reactivatePaymentRecord = async (req: AuthRequest, res: Response) => {
    try {
      if (!await this.requireWagesPermission(req, res, 'update')) return;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      const recordId = parseInt(req.params.recordId);
      
      if (isNaN(recordId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid record ID'
        });
      }
      
      await this.paymentRecordService.reactivatePayment(recordId, req.user.user_id);
      
      res.json({ 
        success: true,
        message: 'Payment record reactivated successfully' 
      });
    } catch (error) {
      console.error('Controller error reactivating payment record:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to reactivate payment record'
      });
    }
  };
}