import React from 'react';
import { Calendar, Users, ChevronLeft, ChevronRight, Settings, CheckCircle } from 'lucide-react';
import { getPayPeriodInfo } from '../utils/WageCalculations';
import { AccountUser } from '../../../types/user';

interface WageControlsProps {
  selectedGroup: string;
  biWeekStart: string;
  dates: string[];
  users: AccountUser[];
  roundingThreshold: number;
  showSettings: boolean;
  activeTab: 'current' | 'history';
  onGroupChange: (group: string) => void;
  onNavigateBiWeek: (direction: 'prev' | 'next') => void;
  onRoundingThresholdChange: (threshold: number) => void;
  onToggleSettings: () => void;
  onRecordPayment: () => void;
}

export const WageControls: React.FC<WageControlsProps> = ({
  selectedGroup,
  biWeekStart,
  dates,
  users,
  roundingThreshold,
  showSettings,
  activeTab,
  onGroupChange,
  onNavigateBiWeek,
  onRoundingThresholdChange,
  onToggleSettings,
  onRecordPayment
}) => {
  return (
    <div className="max-w-full mx-auto px-4 py-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Group Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users className="inline w-4 h-4 mr-1" />
                Filter
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => onGroupChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Users</option>
                <option value="Group A">Group A</option>
                <option value="Group B">Group B</option>
                <option disabled>──────────</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name} {user.user_group ? `(${user.user_group})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Bi-Week Navigation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline w-4 h-4 mr-1" />
                Group {getPayPeriodInfo(biWeekStart).group} Pay Period
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onNavigateBiWeek('prev')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-3 py-2 border border-gray-300 rounded-md min-w-[200px] text-center">
                  {biWeekStart} to {dates[13] || ''}
                </span>
                <button
                  onClick={() => onNavigateBiWeek('next')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Rounding Threshold */}
            {showSettings && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rounding Threshold (min)
                </label>
                <input
                  type="number"
                  value={roundingThreshold}
                  onChange={(e) => onRoundingThresholdChange(parseInt(e.target.value) || 12)}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}
          </div>
          
          {activeTab === 'current' && (
            <div className="flex items-center space-x-4">
              <button
                onClick={onToggleSettings}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Settings"
              >
                <Settings className="h-6 w-6" />
              </button>
              <button
                onClick={onRecordPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
              >
                <CheckCircle className="h-5 w-5" />
                <span>Record Payment</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
