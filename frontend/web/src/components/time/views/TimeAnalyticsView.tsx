import React from 'react';
import { Users, Clock, Calendar } from 'lucide-react';
import type { AnalyticsData } from '../../../types/time';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

interface TimeAnalyticsViewProps {
  analyticsData: AnalyticsData | null;
  loading: boolean;
}

export const TimeAnalyticsView: React.FC<TimeAnalyticsViewProps> = ({
  analyticsData,
  loading
}) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${TIME_COLORS.border}`}></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
          <div className="flex items-center">
            <div className={`p-2 ${TIME_COLORS.light} rounded-lg`}>
              <Users className={`w-6 h-6 ${TIME_COLORS.textDark}`} />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Total Employees</p>
              <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
                {analyticsData?.totalEmployees || 0}
              </p>
            </div>
          </div>
        </div>

        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Total Hours</p>
              <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
                {analyticsData?.totalHours.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>

        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
          <div className="flex items-center">
            <div className={`p-2 ${TIME_COLORS.light} rounded-lg`}>
              <Clock className={`w-6 h-6 ${TIME_COLORS.textDark}`} />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Overtime Hours</p>
              <p className={`text-2xl font-semibold ${TIME_COLORS.textDark}`}>
                🔵 {analyticsData?.overtimeHours.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>

        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Avg Hours/Employee</p>
              <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
                {analyticsData?.averageHoursPerEmployee.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text} mb-4`}>Attendance Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>On-Time Percentage</span>
              <div className="flex items-center space-x-2">
                <div className={`w-32 ${PAGE_STYLES.header.background} rounded-full h-2`}>
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${analyticsData?.onTimePercentage || 0}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                  {analyticsData?.onTimePercentage.toFixed(1) || '0'}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>Attendance Rate</span>
              <div className="flex items-center space-x-2">
                <div className={`w-32 ${PAGE_STYLES.header.background} rounded-full h-2`}>
                  <div
                    className={`${TIME_COLORS.base} h-2 rounded-full`}
                    style={{ width: `${analyticsData?.attendanceRate || 0}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                  {analyticsData?.attendanceRate.toFixed(1) || '0'}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>Edit Requests</span>
              <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                ⚫ {analyticsData?.editRequestsCount || 0}
              </span>
            </div>
          </div>
        </div>

        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text} mb-4`}>Top Performers</h3>
          <div className="space-y-3">
            {analyticsData?.topPerformers.slice(0, 5).map((performer, index) => (
              <div key={performer.user_id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                    {performer.first_name} {performer.last_name}
                  </span>
                </div>
                <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {Number(performer.total_hours).toFixed(1)}h
                </span>
              </div>
            ))}
            {(!analyticsData?.topPerformers || analyticsData.topPerformers.length === 0) && (
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted} text-center py-4`}>No data available</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Additional Analytics */}
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6`}>
        <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text} mb-4`}>Time Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {analyticsData ? (analyticsData.totalHours - analyticsData.overtimeHours).toFixed(1) : '0.0'}
            </div>
            <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>Regular Hours</div>
            <div className="text-xs text-green-600">🟢 Normal Time</div>
          </div>

          <div className="text-center">
            <div className={`text-3xl font-bold ${TIME_COLORS.textDark}`}>
              {analyticsData?.overtimeHours.toFixed(1) || '0.0'}
            </div>
            <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>Overtime Hours</div>
            <div className={`text-xs ${TIME_COLORS.textDark}`}>🔵 Extra Time</div>
          </div>

          <div className="text-center">
            <div className={`text-3xl font-bold ${PAGE_STYLES.panel.textSecondary}`}>
              {analyticsData?.editRequestsCount || 0}
            </div>
            <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>Edited Entries</div>
            <div className={`text-xs ${PAGE_STYLES.panel.textSecondary}`}>⚫ Modified</div>
          </div>
        </div>
      </div>
    </div>
  );
};