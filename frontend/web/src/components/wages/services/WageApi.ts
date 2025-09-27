import { UserWageData, PaymentRecord, DeductionOverrides } from '../types/WageTypes';

export const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('access_token');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  return fetch(url, {
    ...options,
    headers
  });
};

export const fetchUsers = async () => {
  try {
    const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/auth/users');
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

export const fetchWageData = async (biWeekStart: string, selectedGroup: string): Promise<UserWageData[]> => {
  try {
    const endDate = new Date(biWeekStart + 'T12:00:00');
    endDate.setDate(endDate.getDate() + 13);
    
    const params = new URLSearchParams({
      startDate: biWeekStart,
      endDate: endDate.toISOString().split('T')[0],
      group: selectedGroup
    });
    
    const res = await makeAuthenticatedRequest(
      `http://192.168.2.14:3001/api/wages/bi-weekly?${params}`
    );
    
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    return [];
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
    const res = await makeAuthenticatedRequest(
      'http://192.168.2.14:3001/api/wages/update-payroll',
      {
        method: 'PUT',
        body: JSON.stringify({ changes })
      }
    );
    
    if (res.ok) {
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
    const token = localStorage.getItem('access_token');
    const response = await fetch('http://192.168.2.14:3001/api/wages/update-deductions', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        pay_period_start: biWeekStart,
        pay_period_end: endDate,
        [field === 'tax' ? 'federal_tax' : `${field}_deduction`]: value
      })
    });
    
    return response.ok;
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
    const token = localStorage.getItem('access_token');
    const updates = changes.map(change => ({
      user_id: change.userId,
      pay_period_start: biWeekStart,
      pay_period_end: endDate,
      [change.field === 'tax' ? 'federal_tax' : `${change.field}_deduction`]: change.value
    }));

    const response = await fetch('http://192.168.2.14:3001/api/wages/update-deductions-batch', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ updates })
    });
    
    return response.ok;
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
    const token = localStorage.getItem('access_token');
    
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

    const response = await fetch('http://192.168.2.14:3001/api/wages/record-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(recordData)
    });

    if (response.ok) {
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
    const token = localStorage.getItem('access_token');
    const params = new URLSearchParams();
    if (includeInactive) {
      params.set('includeInactive', 'true');
    }
    
    const url = `http://192.168.2.14:3001/api/wages/payment-history${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return [];
  }
};

export const loadDeductionOverrides = async (biWeekStart: string, endDate: string) => {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(
      `http://192.168.2.14:3001/api/wages/deduction-overrides?startDate=${biWeekStart}&endDate=${endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.ok) {
      const overrides = await response.json();
      return overrides;
    }
    return {};
  } catch (error) {
    console.error('Error loading deduction overrides:', error);
    return {};
  }
};

export const deletePaymentRecord = async (recordId: number): Promise<boolean> => {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`http://192.168.2.14:3001/api/wages/payment-record/${recordId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deactivating payment record:', error);
    return false;
  }
};

export const reactivatePaymentRecord = async (recordId: number): Promise<boolean> => {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`http://192.168.2.14:3001/api/wages/payment-record/${recordId}/reactivate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error reactivating payment record:', error);
    return false;
  }
};
