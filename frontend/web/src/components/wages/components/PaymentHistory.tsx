import React from 'react';
import { ChevronDown, ChevronUp, Trash2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { PaymentRecord } from '../types/WageTypes';
import { formatCurrency } from '../utils/WageCalculations';

interface PaymentHistoryProps {
  paymentHistory: PaymentRecord[];
  expandedMonths: Set<string>;
  showInactiveRecords: boolean;
  onToggleMonth: (monthKey: string) => void;
  onDeleteRecord: (recordId: number, payPeriod: string) => void;
  onReactivateRecord: (recordId: number, payPeriod: string) => void;
  onToggleShowInactive: (show: boolean) => void;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  paymentHistory,
  expandedMonths,
  showInactiveRecords,
  onToggleMonth,
  onDeleteRecord,
  onReactivateRecord,
  onToggleShowInactive
}) => {
  return (
    <div className="max-w-full mx-auto px-4 py-4">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Payment History</h2>
            <button
              onClick={() => onToggleShowInactive(!showInactiveRecords)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                showInactiveRecords 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
              title={showInactiveRecords ? "Hide deactivated records" : "Show deactivated records"}
            >
              {showInactiveRecords ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span>Hide Deactivated</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Show Deactivated</span>
                </>
              )}
            </button>
          </div>
          {paymentHistory.length === 0 ? (
            <p className="text-gray-500">No payment records found.</p>
          ) : (
            <div className="space-y-4">
              {/* Group payments by month/year */}
              {Object.entries(
                paymentHistory.reduce((acc, record) => {
                  const date = new Date(record.payment_date);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  if (!acc[monthKey]) acc[monthKey] = [];
                  acc[monthKey].push(record);
                  return acc;
                }, {} as { [key: string]: PaymentRecord[] })
              )
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([monthKey, records]) => {
                  const [year, month] = monthKey.split('-');
                  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  });
                  const isExpanded = expandedMonths.has(monthKey);

                  return (
                    <div key={monthKey} className="border rounded-lg">
                      <button
                        onClick={() => onToggleMonth(monthKey)}
                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
                      >
                        <span className="font-medium">{monthName}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{records.length} payment(s)</span>
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 space-y-4">
                          {records.map(record => {
                            const isInactive = !record.is_active || record.is_active === false || record.is_active === 0;
                            return (
                              <div 
                                key={record.record_id} 
                                className={`border rounded-lg p-4 ${isInactive ? 'bg-gray-100 border-gray-400 opacity-75' : 'bg-white'}`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <div className="text-sm text-gray-500">
                                      Pay Period: {record.pay_period_start} to {record.pay_period_end}
                                      {isInactive && <span className="ml-2 text-red-600 font-medium">(Deactivated)</span>}
                                    </div>
                                    <div className="text-sm font-medium">
                                      Payment Date: {record.payment_date}
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      record.status === 'paid' ? 'bg-green-100 text-green-800' :
                                      record.status === 'recorded' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {record.status.toUpperCase()}
                                    </span>
                                    {isInactive ? (
                                      <button
                                        onClick={() => onReactivateRecord(
                                          record.record_id, 
                                          `${record.pay_period_start} to ${record.pay_period_end}`
                                        )}
                                        className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
                                        title="Reactivate payment record"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => onDeleteRecord(
                                          record.record_id, 
                                          `${record.pay_period_start} to ${record.pay_period_end}`
                                        )}
                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                                        title="Deactivate payment record"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <table className="table-auto">
                                <colgroup>
                                  <col style={{width: '160px'}} />
                                  <col style={{width: '60px'}} />
                                  <col style={{width: '70px'}} />
                                  <col style={{width: '70px'}} />
                                  <col style={{width: '65px'}} />
                                  <col style={{width: '80px'}} />
                                  <col style={{width: '55px'}} />
                                  <col style={{width: '50px'}} />
                                  <col style={{width: '55px'}} />
                                  <col style={{width: '75px'}} />
                                  <col style={{width: '75px'}} />
                                </colgroup>
                                <thead className="bg-gray-50 border-b">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gross</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Vac Pay</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">Gross + Vac</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CPP</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">EI</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deduct Total</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">Net Pay</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {record.entries.map(entry => {
                                    const regularHours = parseFloat(entry.regular_hours) || 0;
                                    const overtimeHours = parseFloat(entry.overtime_hours) || 0;
                                    const holidayHours = parseFloat(entry.holiday_hours) || 0;
                                    const totalHours = regularHours + overtimeHours + holidayHours;
                                    
                                    const cppDeduction = parseFloat(entry.cpp_deduction) || 0;
                                    const eiDeduction = parseFloat(entry.ei_deduction) || 0;
                                    const federalTax = parseFloat(entry.federal_tax) || 0;
                                    const provincialTax = parseFloat(entry.provincial_tax) || 0;
                                    const totalTax = federalTax + provincialTax;
                                    const totalDeductions = cppDeduction + eiDeduction + totalTax;
                                    
                                    const grossPay = parseFloat(entry.gross_pay) || 0;
                                    const vacationPay = parseFloat(entry.vacation_pay) || 0;
                                    const grossPlusVac = grossPay + vacationPay;
                                    const netPay = parseFloat(entry.net_pay) || 0;
                                    const hourlyRate = parseFloat(entry.hourly_rate) || 0;
                                    
                                    return (
                                      <tr key={entry.user_id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 text-sm font-medium text-gray-900">
                                          {entry.first_name} {entry.last_name}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-gray-900">
                                          {formatCurrency(hourlyRate)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-gray-900">
                                          <div>{totalHours.toFixed(2)}</div>
                                          {(overtimeHours > 0 || holidayHours > 0) && (
                                            <div className="text-xs text-gray-500">
                                              {regularHours.toFixed(1)} reg
                                              {overtimeHours > 0 && `, ${overtimeHours.toFixed(1)} OT`}
                                              {holidayHours > 0 && `, ${holidayHours.toFixed(1)} hol`}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-gray-900">
                                          {formatCurrency(grossPay)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-gray-900">
                                          {formatCurrency(vacationPay)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm font-semibold text-gray-900 bg-blue-50">
                                          {formatCurrency(grossPlusVac)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-red-600">
                                          -{formatCurrency(cppDeduction)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-red-600">
                                          -{formatCurrency(eiDeduction)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm text-red-600">
                                          -{formatCurrency(totalTax)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm font-semibold text-red-600">
                                          -{formatCurrency(totalDeductions)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm font-bold text-green-700 bg-green-50">
                                          {formatCurrency(netPay)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-gray-100 border-t font-semibold">
                                  <tr>
                                    <td className="px-3 py-3 text-sm text-gray-900">TOTALS</td>
                                    <td className="px-2 py-3 text-right text-sm text-gray-900">-</td>
                                    <td className="px-2 py-3 text-right text-sm text-gray-900">
                                      {record.entries.reduce((sum, e) => {
                                        const regularHours = parseFloat(e.regular_hours) || 0;
                                        const overtimeHours = parseFloat(e.overtime_hours) || 0;
                                        const holidayHours = parseFloat(e.holiday_hours) || 0;
                                        return sum + regularHours + overtimeHours + holidayHours;
                                      }, 0).toFixed(2)}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-gray-900">
                                      {formatCurrency(record.entries.reduce((sum, e) => sum + (parseFloat(e.gross_pay) || 0), 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-gray-900">
                                      {formatCurrency(record.entries.reduce((sum, e) => sum + (parseFloat(e.vacation_pay) || 0), 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-gray-900 bg-blue-50">
                                      {formatCurrency(record.entries.reduce((sum, e) => {
                                        const grossPay = parseFloat(e.gross_pay) || 0;
                                        const vacationPay = parseFloat(e.vacation_pay) || 0;
                                        return sum + grossPay + vacationPay;
                                      }, 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-red-600">
                                      -{formatCurrency(record.entries.reduce((sum, e) => sum + (parseFloat(e.cpp_deduction) || 0), 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-red-600">
                                      -{formatCurrency(record.entries.reduce((sum, e) => sum + (parseFloat(e.ei_deduction) || 0), 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-red-600">
                                      -{formatCurrency(record.entries.reduce((sum, e) => {
                                        const federalTax = parseFloat(e.federal_tax) || 0;
                                        const provincialTax = parseFloat(e.provincial_tax) || 0;
                                        return sum + federalTax + provincialTax;
                                      }, 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-red-600">
                                      -{formatCurrency(record.entries.reduce((sum, e) => {
                                        const cppDeduction = parseFloat(e.cpp_deduction) || 0;
                                        const eiDeduction = parseFloat(e.ei_deduction) || 0;
                                        const federalTax = parseFloat(e.federal_tax) || 0;
                                        const provincialTax = parseFloat(e.provincial_tax) || 0;
                                        return sum + cppDeduction + eiDeduction + federalTax + provincialTax;
                                      }, 0))}
                                    </td>
                                    <td className="px-2 py-3 text-right text-sm text-green-700 bg-green-50">
                                      {formatCurrency(record.entries.reduce((sum, e) => sum + (parseFloat(e.net_pay) || 0), 0))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};