// File Clean up Finished: 2025-11-15 (Payroll not fully implemented - deferred cleanup)
/**
 * Payroll System Type Definitions
 *
 * Extracted from wages.ts during Enhanced Three-Layer Architecture refactoring
 * Provides comprehensive TypeScript interfaces for the payroll domain
 *
 * Part of: Route → Controller → Service → Repository → Database architecture
 */

export interface PayrollSettings {
  setting_id: number;
  setting_name: string;
  setting_value: number;
  setting_type: 'percentage' | 'minutes' | 'hours' | 'multiplier';
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollSettingsMap {
  [settingName: string]: number;
}

export interface TimeEntry {
  entry_id: number;
  user_id: number;
  clock_in: string;
  clock_out?: string;
  break_minutes?: number;
  auto_break_minutes?: number;
  total_hours: number;
  status: 'active' | 'completed';
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  // Payroll-specific fields
  payroll_clock_in?: string;
  payroll_clock_out?: string;
  payroll_break_minutes?: number;
  payroll_total_hours?: number;
  payroll_adjusted: boolean;
  is_overtime: boolean;
  is_holiday: boolean;
  // Processing fields
  entry_date: string;
  actual_clock_in: string;
  actual_clock_out?: string;
  holiday_name?: string;
}

export interface WorkSchedule {
  schedule_id: number;
  user_id: number;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  is_work_day: boolean;
  expected_start_time?: string;
  expected_end_time?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PayrollUser {
  user_id: number;
  first_name: string;
  last_name: string;
  user_group?: string;
  hourly_wage: number;
  overtime_rate_multiplier: number;
  vacation_pay_percent: number;
  holiday_rate_multiplier: number;
  expected_start_time?: string;
  expected_end_time?: string;
}

export interface DeductionOverride {
  override_id: number;
  user_id: number;
  pay_period_start: string;
  pay_period_end: string;
  cpp_deduction?: number;
  ei_deduction?: number;
  federal_tax?: number;
  provincial_tax?: number;
  created_at: Date;
  updated_at: Date;
}

export interface DeductionOverrideMap {
  [userId: number]: {
    cpp?: number;
    ei?: number;
    tax?: number;
  };
}

export interface PayrollCalculationResult {
  regular_hours: number;
  overtime_hours: number;
  holiday_hours: number;
  regular_pay: number;
  overtime_pay: number;
  holiday_pay: number;
  gross_pay: number;
  vacation_pay: number;
  federal_tax: number;
  provincial_tax: number;
  ei_deduction: number;
  cpp_deduction: number;
  total_deductions: number;
  net_pay: number;
}

export interface UserWageData {
  user_id: number;
  first_name: string;
  last_name: string;
  user_group?: string;
  hourly_wage: number;
  entries: { [date: string]: TimeEntry };
  totals: PayrollCalculationResult;
}

export interface PayrollRecord {
  record_id: number;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  status: 'draft' | 'recorded' | 'paid';
  created_at: Date;
  created_by?: number;
  notes?: string;
  is_active: boolean;
}

export interface PayrollRecordEntry {
  entry_id: number;
  record_id: number;
  user_id: number;
  hourly_rate: number;
  regular_hours: number;
  overtime_hours: number;
  holiday_hours: number;
  gross_pay: number;
  vacation_pay: number;
  cpp_deduction: number;
  ei_deduction: number;
  federal_tax: number;
  provincial_tax: number;
  other_deductions: number;
  net_pay: number;
  notes?: string;
}

export interface PayrollRecordWithEntries extends PayrollRecord {
  entries: Array<PayrollRecordEntry & {
    first_name: string;
    last_name: string;
  }>;
}

export interface PayrollUpdateChange {
  entry_id: number;
  payroll_clock_in: string;
  payroll_clock_out: string;
  payroll_break_minutes: number;
}

export interface DeductionUpdateRequest {
  user_id: number;
  pay_period_start: string;
  pay_period_end: string;
  cpp_deduction?: number;
  ei_deduction?: number;
  federal_tax?: number;
  provincial_tax?: number;
}

export interface BatchDeductionUpdate {
  updates: DeductionUpdateRequest[];
}

export interface PaymentRecordRequest {
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  entries: Array<{
    user_id: number;
    hourly_rate: number;
    regular_hours: number;
    overtime_hours: number;
    holiday_hours: number;
    gross_pay: number;
    vacation_pay: number;
    cpp_deduction: number;
    ei_deduction: number;
    federal_tax: number;
    provincial_tax: number;
    net_pay: number;
  }>;
}

export interface BiWeeklyWageRequest {
  startDate: string;
  endDate: string;
  group?: string;
}

export interface PayrollSettingsUpdateRequest {
  settings: Array<{
    name: string;
    value: number;
  }>;
}

// Repository interfaces for data access layer
export interface PayrollDataAccess {
  // Settings
  getPayrollSettings(): Promise<PayrollSettings[]>;
  updatePayrollSetting(name: string, value: number): Promise<void>;
  
  // Time entries
  getTimeEntries(startDate: string, endDate: string): Promise<TimeEntry[]>;
  updateTimeEntry(entryId: number, updates: Partial<TimeEntry>): Promise<void>;
  
  // Users and schedules
  getPayrollUsers(groupFilter?: string): Promise<PayrollUser[]>;
  getUserSchedule(userId: number, dayOfWeek: string): Promise<WorkSchedule[]>;
  
  // Deduction overrides
  getDeductionOverrides(startDate: string, endDate: string): Promise<DeductionOverride[]>;
  upsertDeductionOverride(override: DeductionUpdateRequest): Promise<void>;
  batchUpsertDeductionOverrides(overrides: DeductionUpdateRequest[]): Promise<void>;
  
  // Payment records
  createPayrollRecord(record: PaymentRecordRequest, userId: number): Promise<number>;
  getPaymentHistory(includeInactive?: boolean): Promise<PayrollRecordWithEntries[]>;
  deactivatePaymentRecord(recordId: number): Promise<void>;
  reactivatePaymentRecord(recordId: number): Promise<void>;
}

// Service interfaces for business logic layer
export interface PayrollCalculationService {
  calculatePayrollAdjustments(entry: TimeEntry, settings: PayrollSettingsMap, schedule?: WorkSchedule): Promise<Partial<TimeEntry>>;
  calculateWageData(users: PayrollUser[], entries: TimeEntry[], settings: PayrollSettingsMap, overrides: DeductionOverrideMap): Promise<UserWageData[]>;
  processPayrollChanges(changes: PayrollUpdateChange[]): Promise<void>;
}

export interface DeductionManagementService {
  loadDeductionOverrides(startDate: string, endDate: string): Promise<DeductionOverrideMap>;
  updateDeduction(request: DeductionUpdateRequest): Promise<void>;
  batchUpdateDeductions(request: BatchDeductionUpdate): Promise<void>;
}

export interface PaymentRecordService {
  recordPayment(request: PaymentRecordRequest, userId: number): Promise<number>;
  getPaymentHistory(includeInactive?: boolean): Promise<PayrollRecordWithEntries[]>;
  deactivatePayment(recordId: number, userId: number): Promise<void>;
  reactivatePayment(recordId: number, userId: number): Promise<void>;
}