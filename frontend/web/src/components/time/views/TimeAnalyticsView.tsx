import React from 'react';
import { Users, Clock, Calendar } from 'lucide-react';
import type { AnalyticsData } from '../../../types/time';

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
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analyticsData?.totalEmployees || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Hours</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analyticsData?.totalHours.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Overtime Hours</p>
              <p className="text-2xl font-semibold text-blue-600">
                🔵 {analyticsData?.overtimeHours.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Hours/Employee</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analyticsData?.averageHoursPerEmployee.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Attendance Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">On-Time Percentage</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${analyticsData?.onTimePercentage || 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {analyticsData?.onTimePercentage.toFixed(1) || '0'}%
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Attendance Rate</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${analyticsData?.attendanceRate || 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {analyticsData?.attendanceRate.toFixed(1) || '0'}%
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Edit Requests</span>
              <span className="text-sm font-medium text-gray-900">
                ⚫ {analyticsData?.editRequestsCount || 0}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performers</h3>
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
                  <span className="text-sm font-medium text-gray-900">
                    {performer.first_name} {performer.last_name}
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {Number(performer.total_hours).toFixed(1)}h
                </span>
              </div>
            ))}
            {(!analyticsData?.topPerformers || analyticsData.topPerformers.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Additional Analytics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Time Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {analyticsData ? (analyticsData.totalHours - analyticsData.overtimeHours).toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-gray-600">Regular Hours</div>
            <div className="text-xs text-green-600">🟢 Normal Time</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {analyticsData?.overtimeHours.toFixed(1) || '0.0'}
            </div>
            <div className="text-sm text-gray-600">Overtime Hours</div>
            <div className="text-xs text-blue-600">🔵 Extra Time</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">
              {analyticsData?.editRequestsCount || 0}
            </div>
            <div className="text-sm text-gray-600">Edited Entries</div>
            <div className="text-xs text-gray-600">⚫ Modified</div>
          </div>
        </div>
      </div>
    </div>
  );
};