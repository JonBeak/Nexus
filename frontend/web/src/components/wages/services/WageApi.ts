import api from '../../../services/api';
import { UserWageData, PaymentRecord, DeductionOverrides } from '../types/WageTypes';

export const fetchUsers = async () => {
  try {
    const res = await api.get('/auth/users');
    return res.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

export const fetchWageData = async (biWeekStart: string, selectedGroup: string): Promise<UserWageData[]> => {
  try {
    const endDate = new Date(biWeekStart + 'T12:00:00');
    endDate.setDate(endDate.getDate() + 13);

    const params = {
      startDate: biWeekStart,
      endDate: endDate.toISOString().split('T')[0],
      group: selectedGroup
    };

    const res = await api.get('/wages/bi-weekly', { params });
    return res.data;
  } catch (error) {
    console.error('Error fetching wage data:', error);
    return [];
  }
};

interface PayrollChangeDto {
  entry_id: number;
  payroll_clock_in: string | null;
  payroll_clock_out: string | null;
  payroll_break_minutes: number | null;
}

export const savePayrollChanges = async (wageData: UserWageData[]) => {
  const changes: PayrollChangeDto[] = [];

  wageData.forEach(userData => {
    Object.values(userData.entries).forEach(entry => {
      if (entry.payroll_adjusted) {
        changes.push({
          entry_id: entry.entry_id,
          payroll_clock_in: entry.payroll_clock_in,
          payroll_clock_out: entry.payroll_clock_out,
          payroll_break_minutes: entry.payroll_break_minutes
        });
      }
    });
  });

  if (changes.length === 0) {
    alert('No changes to save');
    return false;
  }

  try {
    const res = await api.put('/wages/update-payroll', { changes });

    if (res.data) {
      alert('Changes saved successfully');
      return true;
    } else {
      alert('Failed to save changes');
      return false;
    }
  } catch (error) {
    console.error('Error saving changes:', error);
    alert('Error saving changes');
    return false;
  }
};

export const updateDeductions = async (
  userId: number,
  biWeekStart: string,
  endDate: string,
  field: 'cpp' | 'ei' | 'tax',
  value: number
): Promise<boolean> => {
  try {
    const response = await api.put('/wages/update-deductions', {
      user_id: userId,
      pay_period_start: biWeekStart,
      pay_period_end: endDate,
      [field === 'tax' ? 'federal_tax' : `${field}_deduction`]: value
    });

    return !!response.data;
  } catch (error) {
    console.error('Error saving deduction:', error);
    return false;
  }
};

// Batch update deductions for auto-save
export const updateDeductionsBatch = async (
  changes: Array<{
    userId: number;
    field: 'cpp' | 'ei' | 'tax';
    value: number;
  }>,
  biWeekStart: string,
  endDate: string
): Promise<boolean> => {
  try {
    const updates = changes.map(change => ({
      user_id: change.userId,
      pay_period_start: biWeekStart,
      pay_period_end: endDate,
      [change.field === 'tax' ? 'federal_tax' : `${change.field}_deduction`]: change.value
    }));

    const response = await api.put('/wages/update-deductions-batch', { updates });
    return !!response.data;
  } catch (error) {
    console.error('Error saving deduction batch:', error);
    return false;
  }
};

export const recordPayment = async (
  biWeekStart: string,
  endDate: string,
  paymentDate: string,
  wageData: UserWageData[],
  deductionOverrides: DeductionOverrides
) => {
  try {
    // Prepare payment record data
    const recordData = {
      pay_period_start: biWeekStart,
      pay_period_end: endDate,
      payment_date: paymentDate,
      entries: wageData.map(user => {
        const payPeriodKey = `${biWeekStart}-${endDate}`;
        const currentOverrides = deductionOverrides[payPeriodKey]?.[user.user_id];
        return {
          user_id: user.user_id,
          hourly_rate: user.hourly_rate,
          regular_hours: user.totals.regular_hours,
          overtime_hours: user.totals.overtime_hours,
          holiday_hours: user.totals.holiday_hours,
          gross_pay: user.totals.gross_pay,
          vacation_pay: user.totals.vacation_pay,
          cpp_deduction: currentOverrides?.cpp ?? 0,
          ei_deduction: currentOverrides?.ei ?? 0,
          federal_tax: currentOverrides?.tax ?? 0,
          provincial_tax: 0,
          net_pay: (user.totals.gross_pay + user.totals.vacation_pay) -
                   ((currentOverrides?.cpp ?? 0) + (currentOverrides?.ei ?? 0) + (currentOverrides?.tax ?? 0))
        };
      })
    };

    const response = await api.post('/wages/record-payment', recordData);

    if (response.data) {
      alert('Payment recorded successfully!');
      return true;
    } else {
      alert('Failed to record payment');
      return false;
    }
  } catch (error) {
    console.error('Error recording payment:', error);
    alert('Error recording payment');
    return false;
  }
};

export const fetchPaymentHistory = async (includeInactive = false): Promise<PaymentRecord[]> => {
  try {
    const params = includeInactive ? { includeInactive: true } : {};
    const response = await api.get('/wages/payment-history', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return [];
  }
};

export const loadDeductionOverrides = async (biWeekStart: string, endDate: string) => {
  try {
    const response = await api.get('/wages/deduction-overrides', {
      params: { startDate: biWeekStart, endDate }
    });
    return response.data;
  } catch (error) {
    console.error('Error loading deduction overrides:', error);
    return {};
  }
};

export const deletePaymentRecord = async (recordId: number): Promise<boolean> => {
  try {
    const response = await api.delete(`/wages/payment-record/${recordId}`);
    return !!response.data;
  } catch (error) {
    console.error('Error deactivating payment record:', error);
    return false;
  }
};

export const reactivatePaymentRecord = async (recordId: number): Promise<boolean> => {
  try {
    const response = await api.post(`/wages/payment-record/${recordId}/reactivate`);
    return !!response.data;
  } catch (error) {
    console.error('Error reactivating payment record:', error);
    return false;
  }
};