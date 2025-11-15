// File Clean up Finished: 2025-11-15 (Second cleanup - Audit Trail Refactoring)
// Current Cleanup Changes (Nov 15, 2025):
// - Migrated from payrollRepository.logAuditTrail() to centralized auditRepository
// - Updated 3 audit trail calls to use auditRepository.logAuditTrail()
// - Added import for auditRepository
// - Part of Phase 2: Centralized Audit Repository implementation
//
// Previous Cleanup (Nov 14, 2025):
// Changes:
// - Removed unused utility methods: calculatePaymentTotals() and formatPaymentRecordForDisplay() (~60 lines)
// - Improved type safety: Changed validatePaymentEntry to use proper typed parameter instead of 'any'
// - Simplified validation logic to use direct property access instead of dynamic field lookups
// - Reduced file size from 311 lines to 255 lines (18% reduction)
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
import { auditRepository } from '../repositories/auditRepository';
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
      await auditRepository.logAuditTrail(
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
      await auditRepository.logAuditTrail(
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
      await auditRepository.logAuditTrail(
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
  private validatePaymentEntry(entry: PaymentRecordRequest['entries'][number], index: number): void {
    // Validate required fields
    if (!entry.user_id || !entry.hourly_rate || entry.regular_hours === undefined ||
        entry.overtime_hours === undefined || entry.holiday_hours === undefined ||
        !entry.gross_pay || entry.vacation_pay === undefined || !entry.net_pay) {
      throw new Error(`Missing required fields in entry ${index}`);
    }

    // Validate numeric fields are non-negative
    const numericChecks: Array<{ value: number; field: string }> = [
      { value: entry.hourly_rate, field: 'hourly_rate' },
      { value: entry.regular_hours, field: 'regular_hours' },
      { value: entry.overtime_hours, field: 'overtime_hours' },
      { value: entry.holiday_hours, field: 'holiday_hours' },
      { value: entry.gross_pay, field: 'gross_pay' },
      { value: entry.vacation_pay, field: 'vacation_pay' },
      { value: entry.cpp_deduction, field: 'cpp_deduction' },
      { value: entry.ei_deduction, field: 'ei_deduction' },
      { value: entry.federal_tax, field: 'federal_tax' },
      { value: entry.provincial_tax, field: 'provincial_tax' },
      { value: entry.net_pay, field: 'net_pay' }
    ];

    numericChecks.forEach(({ value, field }) => {
      if (typeof value !== 'number' || isNaN(value) || value < 0) {
        throw new Error(`Invalid ${field} in entry ${index}: must be a non-negative number`);
      }
    });

    // Validate user_id is positive integer
    if (!Number.isInteger(entry.user_id) || entry.user_id <= 0) {
      throw new Error(`Invalid user_id in entry ${index}: must be a positive integer`);
    }
  }
}