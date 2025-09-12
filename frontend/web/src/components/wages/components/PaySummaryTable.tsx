import React from 'react';
import { Check, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { UserWageData, DeductionOverrides, EditingField } from '../types/WageTypes';
import { formatCurrency, calculatePaymentDate } from '../utils/WageCalculations';
import { SaveStatus } from '../hooks/useAutoSave';

interface PaySummaryTableProps {
  loading: boolean;
  wageData: UserWageData[];
  dates: string[];
  deductionOverrides: DeductionOverrides;
  editingField: EditingField | null;
  onDeductionChange: (userId: number, field: 'cpp' | 'ei' | 'tax', value: string) => void;
  onDeductionCommit: (userId: number, field: 'cpp' | 'ei' | 'tax') => void;
  onDeductionFocus: (userId: number, field: 'cpp' | 'ei' | 'tax') => void;
  onDeductionKeyDown: (e: React.KeyboardEvent, userId: number, field: 'cpp' | 'ei' | 'tax') => void;
  getInputValue: (userId: number, field: 'cpp' | 'ei' | 'tax') => string;
  getCurrentPayPeriodOverrides: () => any;
  selectAllTextClick: (event: React.MouseEvent<HTMLInputElement>) => void;
  selectAllTextFocus: (event: React.FocusEvent<HTMLInputElement>) => void;
  handleInputMouseUp: (event: React.MouseEvent<HTMLInputElement>) => void;
  getSaveStatus: (userId: number, field: 'cpp' | 'ei' | 'tax') => SaveStatus;
  onRetryFailedSave: (userId: number, field: 'cpp' | 'ei' | 'tax') => void;
  biWeekStart: string;
}

// Save status indicator component
const SaveStatusIndicator: React.FC<{ 
  status: SaveStatus; 
  onRetry?: () => void;
}> = ({ status, onRetry }) => {
  switch (status) {
    case 'saving':
      return (
        <div className="flex items-center text-blue-600" title="Saving...">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      );
    case 'saved':
      return (
        <div className="flex items-center text-green-600" title="Saved">
          <Check className="h-3 w-3" />
        </div>
      );
    case 'error':
      return (
        <button
          onClick={onRetry}
          className="flex items-center text-red-600 hover:text-red-800"
          title="Save failed - click to retry"
        >
          <AlertCircle className="h-3 w-3" />
        </button>
      );
    default:
      return null;
  }
};

export const PaySummaryTable: React.FC<PaySummaryTableProps> = ({
  loading,
  wageData,
  dates,
  onDeductionChange,
  onDeductionCommit,
  onDeductionFocus,
  onDeductionKeyDown,
  getInputValue,
  getCurrentPayPeriodOverrides,
  selectAllTextClick,
  selectAllTextFocus,
  handleInputMouseUp,
  getSaveStatus,
  onRetryFailedSave,
  biWeekStart
}) => {
  return (
    <div className="max-w-full mx-auto px-4 pb-4">
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Pay Period Summary</h2>
            {dates.length > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Payment Date: </span>
                <span className="text-blue-600 font-semibold">
                  {calculatePaymentDate(dates[dates.length - 1])}
                </span>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">
            <span>Calculate deductions here: </span>
            <a 
              href="https://apps.cra-arc.gc.ca/ebci/rhpd/beta/entry" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              CRA Payroll Deductions Calculator
            </a>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-gray-500">Loading wage data...</p>
          </div>
        ) : (
          <table className="min-w-full table-fixed">
            <colgroup>
              <col className="w-48" />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-4" />
              <col className="w-24" />
              <col className="w-4" />
              <col className="w-24" />
              <col className="w-4" />
              <col className="w-24" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vac Pay
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Gross + Vac
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPP
                </th>
                <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EI
                </th>
                <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax
                </th>
                <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deduct Total
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                  Net Pay
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {wageData.map(userData => {
                const totalHours = Number(userData.totals.regular_hours || 0) + 
                                  Number(userData.totals.overtime_hours || 0) + 
                                  Number(userData.totals.holiday_hours || 0);
                const totalTax = userData.totals.federal_tax + userData.totals.provincial_tax;
                const totalDeductions = userData.totals.cpp_deduction + 
                                       userData.totals.ei_deduction + 
                                       totalTax;
                const grossPlusVac = userData.totals.gross_pay + userData.totals.vacation_pay;
                
                return (
                  <tr key={userData.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {userData.first_name} {userData.last_name}
                      {userData.user_group && (
                        <span className="ml-2 text-xs text-gray-500">({userData.user_group})</span>
                      )}
                    </td>
                    <td className="px-2 py-4 text-right text-sm text-gray-900 truncate">
                      {formatCurrency(userData.hourly_rate)}
                    </td>
                    <td className="px-2 py-4 text-right text-sm text-gray-900">
                      <div>{totalHours.toFixed(2)}</div>
                      {(Number(userData.totals.overtime_hours || 0) > 0 || Number(userData.totals.holiday_hours || 0) > 0) && (
                        <div className="text-xs text-gray-500 truncate">
                          {Number(userData.totals.regular_hours || 0).toFixed(1)} reg
                          {Number(userData.totals.overtime_hours || 0) > 0 && `, ${Number(userData.totals.overtime_hours || 0).toFixed(1)} OT`}
                          {Number(userData.totals.holiday_hours || 0) > 0 && `, ${Number(userData.totals.holiday_hours || 0).toFixed(1)} hol`}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-4 text-right text-sm text-gray-900 truncate">
                      {formatCurrency(userData.totals.gross_pay)}
                    </td>
                    <td className="px-2 py-4 text-right text-sm text-gray-900 truncate">
                      {formatCurrency(userData.totals.vacation_pay)}
                    </td>
                    <td className="px-2 py-4 text-right text-sm font-semibold text-gray-900 bg-blue-50 truncate">
                      {formatCurrency(grossPlusVac)}
                    </td>
                    <td className="px-0.5 py-4 text-right text-sm text-red-600">
                      <div className="flex items-center justify-end">
                        <span>-$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getInputValue(userData.user_id, 'cpp')}
                          onChange={(e) => onDeductionChange(userData.user_id, 'cpp', e.target.value)}
                          onFocus={(e) => {
                            onDeductionFocus(userData.user_id, 'cpp');
                            selectAllTextFocus(e);
                          }}
                          onClick={selectAllTextClick}
                          onMouseUp={handleInputMouseUp}
                          onBlur={() => onDeductionCommit(userData.user_id, 'cpp')}
                          onKeyDown={(e) => onDeductionKeyDown(e, userData.user_id, 'cpp')}
                          className="w-16 px-1 py-0.5 text-right border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-0 py-4 text-center">
                      <SaveStatusIndicator 
                        status={getSaveStatus(userData.user_id, 'cpp')} 
                        onRetry={() => onRetryFailedSave(userData.user_id, 'cpp')}
                      />
                    </td>
                    <td className="px-0.5 py-4 text-right text-sm text-red-600">
                      <div className="flex items-center justify-end">
                        <span>-$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getInputValue(userData.user_id, 'ei')}
                          onChange={(e) => onDeductionChange(userData.user_id, 'ei', e.target.value)}
                          onFocus={(e) => {
                            onDeductionFocus(userData.user_id, 'ei');
                            selectAllTextFocus(e);
                          }}
                          onClick={selectAllTextClick}
                          onMouseUp={handleInputMouseUp}
                          onBlur={() => onDeductionCommit(userData.user_id, 'ei')}
                          onKeyDown={(e) => onDeductionKeyDown(e, userData.user_id, 'ei')}
                          className="w-16 px-1 py-0.5 text-right border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-0 py-4 text-center">
                      <SaveStatusIndicator 
                        status={getSaveStatus(userData.user_id, 'ei')} 
                        onRetry={() => onRetryFailedSave(userData.user_id, 'ei')}
                      />
                    </td>
                    <td className="px-0.5 py-4 text-right text-sm text-red-600">
                      <div className="flex items-center justify-end">
                        <span>-$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getInputValue(userData.user_id, 'tax')}
                          onChange={(e) => onDeductionChange(userData.user_id, 'tax', e.target.value)}
                          onFocus={(e) => {
                            onDeductionFocus(userData.user_id, 'tax');
                            selectAllTextFocus(e);
                          }}
                          onClick={selectAllTextClick}
                          onMouseUp={handleInputMouseUp}
                          onBlur={() => onDeductionCommit(userData.user_id, 'tax')}
                          onKeyDown={(e) => onDeductionKeyDown(e, userData.user_id, 'tax')}
                          className="w-16 px-1 py-0.5 text-right border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-0 py-4 text-center">
                      <SaveStatusIndicator 
                        status={getSaveStatus(userData.user_id, 'tax')} 
                        onRetry={() => onRetryFailedSave(userData.user_id, 'tax')}
                      />
                    </td>
                    <td className="px-2 py-4 text-right text-sm font-semibold text-red-600 truncate">
                      -{formatCurrency(
                        (getCurrentPayPeriodOverrides()[userData.user_id]?.cpp ?? 0) +
                        (getCurrentPayPeriodOverrides()[userData.user_id]?.ei ?? 0) +
                        (getCurrentPayPeriodOverrides()[userData.user_id]?.tax ?? 0)
                      )}
                    </td>
                    <td className="px-2 py-4 text-right text-sm font-bold text-green-700 bg-green-50 truncate">
                      {formatCurrency(
                        grossPlusVac - (
                          (getCurrentPayPeriodOverrides()[userData.user_id]?.cpp ?? 0) +
                          (getCurrentPayPeriodOverrides()[userData.user_id]?.ei ?? 0) +
                          (getCurrentPayPeriodOverrides()[userData.user_id]?.tax ?? 0)
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Total Row */}
              {wageData.length > 0 && (
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    TOTALS
                  </td>
                  <td className="px-2 py-4 text-right text-sm text-gray-900">
                    -
                  </td>
                  <td className="px-2 py-4 text-right text-sm text-gray-900">
                    {wageData.reduce((sum, u) => sum + 
                      Number(u.totals.regular_hours || 0) + 
                      Number(u.totals.overtime_hours || 0) + 
                      Number(u.totals.holiday_hours || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-4 text-right text-sm text-gray-900 truncate">
                    {formatCurrency(wageData.reduce((sum, u) => sum + u.totals.gross_pay, 0))}
                  </td>
                  <td className="px-2 py-4 text-right text-sm text-gray-900 truncate">
                    {formatCurrency(wageData.reduce((sum, u) => sum + u.totals.vacation_pay, 0))}
                  </td>
                  <td className="px-2 py-4 text-right text-sm text-gray-900 bg-blue-50 truncate">
                    {formatCurrency(wageData.reduce((sum, u) => sum + u.totals.gross_pay + u.totals.vacation_pay, 0))}
                  </td>
                  <td className="px-0.5 py-4 text-right text-sm text-red-600 truncate">
                    -{formatCurrency(wageData.reduce((sum, u) => sum + (getCurrentPayPeriodOverrides()[u.user_id]?.cpp ?? 0), 0))}
                  </td>
                  <td className="px-0 py-4"></td>
                  <td className="px-0.5 py-4 text-right text-sm text-red-600 truncate">
                    -{formatCurrency(wageData.reduce((sum, u) => sum + (getCurrentPayPeriodOverrides()[u.user_id]?.ei ?? 0), 0))}
                  </td>
                  <td className="px-0 py-4"></td>
                  <td className="px-0.5 py-4 text-right text-sm text-red-600 truncate">
                    -{formatCurrency(wageData.reduce((sum, u) => sum + (getCurrentPayPeriodOverrides()[u.user_id]?.tax ?? 0), 0))}
                  </td>
                  <td className="px-0 py-4"></td>
                  <td className="px-2 py-4 text-right text-sm text-red-600 truncate">
                    -{formatCurrency(wageData.reduce((sum, u) => sum + 
                      (getCurrentPayPeriodOverrides()[u.user_id]?.cpp ?? 0) + 
                      (getCurrentPayPeriodOverrides()[u.user_id]?.ei ?? 0) + 
                      (getCurrentPayPeriodOverrides()[u.user_id]?.tax ?? 0), 0))}
                  </td>
                  <td className="px-2 py-4 text-right text-sm text-green-700 bg-green-50 truncate">
                    {formatCurrency(wageData.reduce((sum, u) => {
                      const grossPlusVac = u.totals.gross_pay + u.totals.vacation_pay;
                      const totalDeductions = 
                        (getCurrentPayPeriodOverrides()[u.user_id]?.cpp ?? 0) +
                        (getCurrentPayPeriodOverrides()[u.user_id]?.ei ?? 0) +
                        (getCurrentPayPeriodOverrides()[u.user_id]?.tax ?? 0);
                      return sum + (grossPlusVac - totalDeductions);
                    }, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};