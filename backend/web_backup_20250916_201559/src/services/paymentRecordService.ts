/**
 * Payment Record Service
 * 
 * Business logic layer for payment record management
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 * 
 * Responsibilities:
 * - Payment recording workflows with transaction management
 * - Payment history retrieval and filtering
 * - Soft delete/reactivation with audit trails
 * - Payment record validation and business rules
 * 
 * Extracted from wages.ts during refactoring - all payment logic preserved exactly
 */

import { PayrollRepository } from '../repositories/payrollRepository';
import {
  PaymentRecordRequest,
  PayrollRecordWithEntries,
  PaymentRecordService as IPaymentRecordService
} from '../types/payrollTypes';

export class PaymentRecordService implements IPaymentRecordService {
  
  constructor(private payrollRepository: PayrollRepository) {}
  
  // =============================================
  // PAYMENT RECORDING
  // =============================================
  
  /**
   * Record a payment with full transaction safety
   * Preserves exact logic from original wages.ts (lines 502-551)
   */
  async recordPayment(request: PaymentRecordRequest, userId: number): Promise<number> {
    try {
      // Validate payment request
      this.validatePaymentRequest(request);
      
      // Create payroll record and entries in transaction
      const recordId = await this.payrollRepository.createPayrollRecord(request, userId);
      
      // Log audit trail
      await this.payrollRepository.logAuditTrail(
        userId,
        'create',
        'payroll_record',
        recordId,
        JSON.stringify({
          action: 'record_payment',
          pay_period_start: request.pay_period_start,
          pay_period_end: request.pay_period_end,
          payment_date: request.payment_date,
          employee_count: request.entries.length
        })
      );
      
      return recordId;
    } catch (error) {
      console.error('Service error recording payment:', error);
      throw new Error('Failed to record payment');
    }
  }
  
  // =============================================
  // PAYMENT HISTORY
  // =============================================
  
  /**
   * Get payment history with optional inactive records
   * Preserves exact logic from original wages.ts (lines 554-600)
   */
  async getPaymentHistory(includeInactive: boolean = false): Promise<PayrollRecordWithEntries[]> {
    try {
      const records = await this.payrollRepository.getPaymentHistory(includeInactive);
      return records;
    } catch (error) {
      console.error('Service error fetching payment history:', error);
      throw new Error('Failed to fetch payment history');
    }
  }
  
  /**
   * Get specific payment record by ID
   */
  async getPaymentRecord(recordId: number, includeInactive: boolean = false): Promise<any> {
    try {
      const record = await this.payrollRepository.getPaymentRecord(recordId, !includeInactive);
      
      if (!record) {
        throw new Error('Payment record not found');
      }
      
      return record;
    } catch (error) {
      console.error('Service error fetching payment record:', error);
      throw new Error('Failed to fetch payment record');
    }
  }
  
  // =============================================
  // PAYMENT RECORD MANAGEMENT
  // =============================================
  
  /**
   * Deactivate payment record (soft delete) with audit trail
   * Preserves exact logic from original wages.ts (lines 604-653)
   */
  async deactivatePayment(recordId: number, userId: number): Promise<void> {
    try {
      // Verify record exists and is active
      const record = await this.payrollRepository.getPaymentRecord(recordId, true);
      
      if (!record) {
        throw new Error('Active payment record not found');
      }
      
      // Soft delete the payment record
      await this.payrollRepository.deactivatePaymentRecord(recordId);
      
      // Log audit trail - preserving exact format from original
      await this.payrollRepository.logAuditTrail(
        userId,
        'deactivate',
        'payroll_record',
        recordId,
        JSON.stringify({
          action: 'deactivate_payment_record',
          pay_period_start: record.pay_period_start,
          pay_period_end: record.pay_period_end,
          payment_date: record.payment_date
        })
      );
    } catch (error) {
      console.error('Service error deactivating payment:', error);
      throw new Error('Failed to deactivate payment record');
    }
  }
  
  /**
   * Reactivate payment record with audit trail
   * Preserves exact logic from original wages.ts (lines 656-705)
   */
  async reactivatePayment(recordId: number, userId: number): Promise<void> {
    try {
      // Verify record exists and is inactive
      const record = await this.payrollRepository.getPaymentRecord(recordId, false);
      
      if (!record) {
        throw new Error('Inactive payment record not found');
      }
      
      // Reactivate the payment record
      await this.payrollRepository.reactivatePaymentRecord(recordId);
      
      // Log audit trail - preserving exact format from original
      await this.payrollRepository.logAuditTrail(
        userId,
        'reactivate',
        'payroll_record',
        recordId,
        JSON.stringify({
          action: 'reactivate_payment_record',
          pay_period_start: record.pay_period_start,
          pay_period_end: record.pay_period_end,
          payment_date: record.payment_date
        })
      );
    } catch (error) {
      console.error('Service error reactivating payment:', error);
      throw new Error('Failed to reactivate payment record');
    }
  }
  
  // =============================================
  // VALIDATION
  // =============================================
  
  /**
   * Validate payment record request
   */
  private validatePaymentRequest(request: PaymentRecordRequest): void {
    if (!request.pay_period_start || !request.pay_period_end || !request.payment_date) {
      throw new Error('Missing required fields: pay_period_start, pay_period_end, payment_date');
    }
    
    // Validate date formats
    const startDate = new Date(request.pay_period_start);
    const endDate = new Date(request.pay_period_end);
    const paymentDate = new Date(request.payment_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(paymentDate.getTime())) {
      throw new Error('Invalid date format in payment request');
    }
    
    if (startDate >= endDate) {
      throw new Error('Pay period start date must be before end date');
    }
    
    if (!request.entries || !Array.isArray(request.entries)) {
      throw new Error('Payment entries array required');
    }
    
    if (request.entries.length === 0) {
      throw new Error('Payment must include at least one employee entry');
    }
    
    // Validate each entry
    request.entries.forEach((entry, index) => {
      this.validatePaymentEntry(entry, index);
    });
  }
  
  /**
   * Validate individual payment entry
   */
  private validatePaymentEntry(entry: any, index: number): void {
    const requiredFields = [
      'user_id', 'hourly_rate', 'regular_hours', 'overtime_hours', 
      'holiday_hours', 'gross_pay', 'vacation_pay', 'net_pay'
    ];
    
    requiredFields.forEach(field => {
      if (entry[field] === undefined || entry[field] === null) {
        throw new Error(`Missing required field '${field}' in entry ${index}`);
      }
    });
    
    // Validate numeric fields
    const numericFields = [
      'hourly_rate', 'regular_hours', 'overtime_hours', 'holiday_hours',
      'gross_pay', 'vacation_pay', 'cpp_deduction', 'ei_deduction',
      'federal_tax', 'provincial_tax', 'net_pay'
    ];
    
    numericFields.forEach(field => {
      const value = entry[field];
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(value.toString());
        if (isNaN(numValue) || numValue < 0) {
          throw new Error(`Invalid ${field} in entry ${index}: must be a non-negative number`);
        }
      }
    });
    
    // Validate user_id is positive integer
    const userId = parseInt(entry.user_id);
    if (isNaN(userId) || userId <= 0) {
      throw new Error(`Invalid user_id in entry ${index}: must be a positive integer`);
    }
  }
  
  // =============================================
  // UTILITY METHODS
  // =============================================
  
  /**
   * Calculate payment totals for validation
   */
  calculatePaymentTotals(request: PaymentRecordRequest): {
    totalEmployees: number;
    totalGrossPay: number;
    totalVacationPay: number;
    totalDeductions: number;
    totalNetPay: number;
  } {
    const totals = request.entries.reduce((acc, entry) => {
      return {
        totalEmployees: acc.totalEmployees + 1,
        totalGrossPay: acc.totalGrossPay + (entry.gross_pay || 0),
        totalVacationPay: acc.totalVacationPay + (entry.vacation_pay || 0),
        totalDeductions: acc.totalDeductions + 
          (entry.cpp_deduction || 0) + 
          (entry.ei_deduction || 0) + 
          (entry.federal_tax || 0) + 
          (entry.provincial_tax || 0),
        totalNetPay: acc.totalNetPay + (entry.net_pay || 0)
      };
    }, {
      totalEmployees: 0,
      totalGrossPay: 0,
      totalVacationPay: 0,
      totalDeductions: 0,
      totalNetPay: 0
    });
    
    return totals;
  }
  
  /**
   * Format payment record for display
   */
  formatPaymentRecordForDisplay(record: PayrollRecordWithEntries): any {
    const totals = this.calculatePaymentTotals({
      pay_period_start: record.pay_period_start,
      pay_period_end: record.pay_period_end,
      payment_date: record.payment_date,
      entries: record.entries
    });
    
    return {
      ...record,
      display_totals: totals,
      formatted_dates: {
        pay_period: `${record.pay_period_start} to ${record.pay_period_end}`,
        payment_date: record.payment_date,
        created_at: record.created_at
      }
    };
  }
}