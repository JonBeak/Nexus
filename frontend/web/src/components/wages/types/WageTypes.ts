export interface WageEntry {
  entry_id: number;
  user_id: number;
  entry_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  payroll_clock_in: string | null;
  payroll_clock_out: string | null;
  payroll_break_minutes: number | null;
  payroll_total_hours: number | null;
  payroll_adjusted: boolean;
  is_overtime: boolean;
  is_holiday: boolean;
}

export interface UserWageData {
  user_id: number;
  first_name: string;
  last_name: string;
  user_group: string | null;
  hourly_rate: number;
  entries: { [date: string]: WageEntry };
  totals: {
    regular_hours: number;
    overtime_hours: number;
    holiday_hours: number;
    gross_pay: number;
    vacation_pay: number;
    federal_tax: number;
    provincial_tax: number;
    ei_deduction: number;
    cpp_deduction: number;
    net_pay: number;
  };
}

export interface PaymentRecord {
  record_id: number;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  status: 'draft' | 'recorded' | 'paid';
  created_at: string;
  is_active: boolean;
  entries: PaymentRecordEntry[];
}

export interface PaymentRecordEntry {
  user_id: number;
  first_name: string;
  last_name: string;
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
}

export interface WageManagementProps {
  user: any;
}

export interface DeductionOverrides {
  [payPeriod: string]: {
    [userId: number]: {
      cpp?: number;
      ei?: number;
      tax?: number;
    };
  };
}

export interface EditingField {
  userId: number;
  field: string;
  value: string;
}