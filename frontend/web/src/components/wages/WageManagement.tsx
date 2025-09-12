import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ArrowLeft, FileText } from 'lucide-react';
import { WageManagementProps, UserWageData, PaymentRecord, DeductionOverrides, EditingField } from './types/WageTypes';
import { 
  generateDateRange, 
  getCurrentPayPeriod, 
  navigateBiWeek, 
  adjustPayPeriodForGroup,
  calculatePaymentDate
} from './utils/WageCalculations';
import {
  fetchUsers,
  fetchWageData as apiFetchWageData,
  savePayrollChanges,
  updateDeductions,
  updateDeductionsBatch,
  recordPayment as apiRecordPayment,
  fetchPaymentHistory as apiFetchPaymentHistory,
  loadDeductionOverrides as apiLoadDeductionOverrides,
  deletePaymentRecord as apiDeletePaymentRecord,
  reactivatePaymentRecord as apiReactivatePaymentRecord
} from './services/WageApi';
import { useAutoSave } from './hooks/useAutoSave';
import { PaySummaryTable } from './components/PaySummaryTable';
import { DailyTimeGrid } from './components/DailyTimeGrid';
import { PaymentHistory } from './components/PaymentHistory';
import { WageControls } from './components/WageControls';

export const WageManagement: React.FC<WageManagementProps> = ({ user }) => {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [biWeekStart, setBiWeekStart] = useState<string>(() => getCurrentPayPeriod());
  const [wageData, setWageData] = useState<UserWageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [originalWageData, setOriginalWageData] = useState<UserWageData[]>([]);
  const [roundingThreshold, setRoundingThreshold] = useState(12);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [showInactiveRecords, setShowInactiveRecords] = useState(false);
  const [deductionOverrides, setDeductionOverrides] = useState<DeductionOverrides>({});
  const [editingField, setEditingField] = useState<EditingField | null>(null);

  const dates = biWeekStart ? generateDateRange(biWeekStart) : [];

  // Memoized onSave function to prevent auto-save hook recreation
  const handleAutoSave = useCallback(async (changes: any[], payPeriodStart: string, payPeriodEnd: string) => {
    return await updateDeductionsBatch(changes, payPeriodStart, payPeriodEnd);
  }, [updateDeductionsBatch]);

  // Initialize auto-save hook
  const {
    addPendingChange,
    getFieldStatus,
    retryFailedSave
  } = useAutoSave({
    onSave: handleAutoSave,
    debounceMs: 1500, // Increased from 800ms to reduce frequency
    maxRetries: 3
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (biWeekStart) {
      loadWageData();
    }
  }, [biWeekStart, selectedGroup]);

  // Auto-adjust pay period when group selection changes
  useEffect(() => {
    if (biWeekStart && (selectedGroup === 'Group A' || selectedGroup === 'Group B')) {
      const adjustedDate = adjustPayPeriodForGroup(biWeekStart, selectedGroup);
      if (adjustedDate !== biWeekStart) {
        setBiWeekStart(adjustedDate);
      }
    }
  }, [selectedGroup]);

  const loadUsers = async () => {
    const userData = await fetchUsers();
    setUsers(userData);
  };

  const loadWageData = async () => {
    setLoading(true);
    try {
      const data = await apiFetchWageData(biWeekStart, selectedGroup);
      setWageData(data);
      setOriginalWageData(JSON.parse(JSON.stringify(data))); // Deep copy for restore functionality
      setEditedCells(new Set()); // Clear any pending changes when loading fresh data
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateBiWeek = (direction: 'prev' | 'next') => {
    const newDate = navigateBiWeek(biWeekStart, selectedGroup, direction);
    setBiWeekStart(newDate);
  };

  const handleCellEdit = (userId: number, date: string, field: 'in' | 'out' | 'break', value: string) => {
    const cellKey = `${userId}-${date}-${field}`;
    setEditedCells(prev => new Set(prev).add(cellKey));
    
    // Update local state immediately for responsive UI
    setWageData(prev => prev.map(userData => {
      if (userData.user_id === userId) {
        const entry = userData.entries[date] || {} as any;
        
        if (field === 'in') {
          entry.payroll_clock_in = value;
        } else if (field === 'out') {
          entry.payroll_clock_out = value;
        } else if (field === 'break') {
          entry.payroll_break_minutes = parseInt(value) || 0;
        }
        
        entry.payroll_adjusted = true;
        
        // Recalculate hours
        if (entry.payroll_clock_in && entry.payroll_clock_out) {
          const start = new Date(`2000-01-01T${entry.payroll_clock_in}`);
          const end = new Date(`2000-01-01T${entry.payroll_clock_out}`);
          const diffMs = end.getTime() - start.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          const breakHours = (entry.payroll_break_minutes || 0) / 60;
          entry.payroll_total_hours = Math.max(0, diffHours - breakHours);
        }
        
        return {
          ...userData,
          entries: {
            ...userData.entries,
            [date]: entry
          }
        };
      }
      return userData;
    }));
  };

  const saveChanges = async () => {
    const success = await savePayrollChanges(wageData);
    if (success) {
      setEditedCells(new Set());
      loadWageData(); // Refresh with recalculated totals
    }
  };

  const clearChanges = () => {
    if (editedCells.size === 0) return;
    
    // Ensure we have original data to restore
    if (originalWageData.length === 0) {
      console.warn('No original data to restore, reloading from server');
      loadWageData();
      return;
    }
    
    setWageData(JSON.parse(JSON.stringify(originalWageData))); // Restore original data
    setEditedCells(new Set()); // Clear all pending changes
  };

  // Handle deduction override changes with auto-save
  const handleDeductionChange = (userId: number, field: 'cpp' | 'ei' | 'tax', value: string) => {
    // Update the editing state with current value
    setEditingField({ userId, field, value });
    
    // Skip if biWeekStart isn't ready (shouldn't happen now with sync init)
    if (!biWeekStart) {
      return;
    }
    
    // Also update the deductions state immediately for real-time updates
    const payPeriodKey = `${biWeekStart}-${dates[dates.length - 1]}`;
    const numValue = value === '' ? 0 : (parseFloat(value) || 0);
    
    setDeductionOverrides(prev => ({
      ...prev,
      [payPeriodKey]: {
        ...prev[payPeriodKey],
        [userId]: {
          ...prev[payPeriodKey]?.[userId],
          [field]: numValue
        }
      }
    }));
    
    // Only add to auto-save queue if value is actually different
    const currentValue = getCurrentPayPeriodOverrides()[userId]?.[field] ?? 0;
    if (numValue !== currentValue) {
      const endDate = dates[dates.length - 1];
      addPendingChange(userId, field, numValue, biWeekStart, endDate);
    }
  };

  // Handle when field loses focus or enter is pressed
  const handleDeductionCommit = (userId: number, field: 'cpp' | 'ei' | 'tax') => {
    // Just clear editing state - auto-save will handle persistence
    if (editingField && editingField.userId === userId && editingField.field === field) {
      setEditingField(null);
    }
  };

  const handleDeductionFocus = (userId: number, field: 'cpp' | 'ei' | 'tax') => {
    const currentValue = getCurrentPayPeriodOverrides()[userId]?.[field] ?? 0;
    setEditingField({ userId, field, value: currentValue.toString() });
  };

  // Direct selection using setSelectionRange - instant for clicks, delayed for focus
  const selectAllTextClick = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = event.target as HTMLInputElement;
    input.setSelectionRange(0, input.value.length);
  };

  const selectAllTextFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.target as HTMLInputElement;
    // 1ms delay to let React finish value updates before selecting
    setTimeout(() => {
      input.setSelectionRange(0, input.value.length);
    }, 1);
  };

  const handleInputMouseUp = (event: React.MouseEvent<HTMLInputElement>) => {
    event.preventDefault();
  };

  const handleDeductionKeyDown = (e: React.KeyboardEvent, userId: number, field: 'cpp' | 'ei' | 'tax') => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      handleDeductionCommit(userId, field);
    }
  };

  const getInputValue = (userId: number, field: 'cpp' | 'ei' | 'tax') => {
    // If we're currently editing this field, show the editing value
    if (editingField && editingField.userId === userId && editingField.field === field) {
      return editingField.value;
    }
    // Otherwise show the stored value
    return (getCurrentPayPeriodOverrides()[userId]?.[field] ?? 0).toFixed(2);
  };

  // Record payment
  const handleRecordPayment = async () => {
    if (!wageData.length || !dates.length) return;

    const paymentDate = calculatePaymentDate(dates[dates.length - 1]);
    
    if (!confirm(`Record payment for period ${biWeekStart} to ${dates[dates.length - 1]}?\nPayment date: ${paymentDate}`)) {
      return;
    }

    const success = await apiRecordPayment(
      biWeekStart, 
      dates[dates.length - 1], 
      paymentDate, 
      wageData, 
      deductionOverrides
    );
    
    if (success) {
      // Clear only the current pay period overrides
      const payPeriodKey = `${biWeekStart}-${dates[dates.length - 1]}`;
      setDeductionOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[payPeriodKey];
        return newOverrides;
      });
      loadPaymentHistory();
    }
  };

  // Fetch payment history
  const loadPaymentHistory = async () => {
    const data = await apiFetchPaymentHistory(showInactiveRecords);
    setPaymentHistory(data);
  };

  // Toggle month expansion in history view
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // Delete payment record
  const handleDeletePaymentRecord = async (recordId: number, payPeriod: string) => {
    const confirmed = confirm(
      `Are you sure you want to deactivate this payment record?\n\nPay Period: ${payPeriod}\n\nThis record will be hidden from the main view but can be restored later.`
    );
    
    if (!confirmed) return;

    const success = await apiDeletePaymentRecord(recordId);
    
    if (success) {
      alert('Payment record deactivated successfully');
      loadPaymentHistory(); // Refresh the list
    } else {
      alert('Failed to deactivate payment record');
    }
  };

  // Reactivate payment record
  const handleReactivatePaymentRecord = async (recordId: number, payPeriod: string) => {
    const confirmed = confirm(
      `Are you sure you want to reactivate this payment record?\n\nPay Period: ${payPeriod}`
    );
    
    if (!confirmed) return;

    const success = await apiReactivatePaymentRecord(recordId);
    
    if (success) {
      alert('Payment record reactivated successfully');
      loadPaymentHistory(); // Refresh the list
    } else {
      alert('Failed to reactivate payment record');
    }
  };

  // Load saved deductions when dates change
  const loadDeductionOverridesData = async () => {
    if (!biWeekStart || !dates.length) return;
    
    const overrides = await apiLoadDeductionOverrides(biWeekStart, dates[dates.length - 1]);
    const payPeriodKey = `${biWeekStart}-${dates[dates.length - 1]}`;
    
    setDeductionOverrides(prev => ({
      ...prev,
      [payPeriodKey]: overrides
    }));
  };

  // Load deductions when dates change
  useEffect(() => {
    if (biWeekStart && dates.length > 0) {
      loadDeductionOverridesData();
    }
  }, [biWeekStart, dates.length]);

  // Load payment history when switching tabs or show inactive toggle changes
  useEffect(() => {
    if (activeTab === 'history') {
      loadPaymentHistory();
    }
  }, [activeTab, showInactiveRecords]);
  
  // Helper function to get current pay period overrides
  const getCurrentPayPeriodOverrides = () => {
    if (!dates.length) return {};
    const payPeriodKey = `${biWeekStart}-${dates[dates.length - 1]}`;
    return deductionOverrides[payPeriodKey] || {};
  };

  // Show loading state if biWeekStart is not initialized
  if (!biWeekStart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading wage data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                title="Return to Dashboard"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <DollarSign className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Wage Management</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-full mx-auto px-4 pt-4">
        <div className="bg-white rounded-lg shadow">
          <nav className="flex border-b">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'current'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Current Pay Period
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium flex items-center space-x-2 ${
                activeTab === 'history'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Payment History</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'current' ? (
        <>
          <WageControls
            selectedGroup={selectedGroup}
            biWeekStart={biWeekStart}
            dates={dates}
            users={users}
            roundingThreshold={roundingThreshold}
            showSettings={showSettings}
            activeTab={activeTab}
            onGroupChange={setSelectedGroup}
            onNavigateBiWeek={handleNavigateBiWeek}
            onRoundingThresholdChange={setRoundingThreshold}
            onToggleSettings={() => setShowSettings(!showSettings)}
            onRecordPayment={handleRecordPayment}
          />
          
          <PaySummaryTable
            loading={loading}
            wageData={wageData}
            dates={dates}
            deductionOverrides={deductionOverrides}
            editingField={editingField}
            onDeductionChange={handleDeductionChange}
            onDeductionCommit={handleDeductionCommit}
            onDeductionFocus={handleDeductionFocus}
            onDeductionKeyDown={handleDeductionKeyDown}
            getInputValue={getInputValue}
            getCurrentPayPeriodOverrides={getCurrentPayPeriodOverrides}
            selectAllTextClick={selectAllTextClick}
            selectAllTextFocus={selectAllTextFocus}
            handleInputMouseUp={handleInputMouseUp}
            getSaveStatus={getFieldStatus}
            onRetryFailedSave={retryFailedSave}
            biWeekStart={biWeekStart}
          />
          
          <DailyTimeGrid
            loading={loading}
            wageData={wageData}
            dates={dates}
            editedCells={editedCells}
            onCellEdit={handleCellEdit}
            onSaveChanges={saveChanges}
            onClearChanges={clearChanges}
          />
        </>
      ) : (
        <PaymentHistory
          paymentHistory={paymentHistory}
          expandedMonths={expandedMonths}
          showInactiveRecords={showInactiveRecords}
          onToggleMonth={toggleMonth}
          onDeleteRecord={handleDeletePaymentRecord}
          onReactivateRecord={handleReactivatePaymentRecord}
          onToggleShowInactive={setShowInactiveRecords}
        />
      )}
    </div>
  );
};