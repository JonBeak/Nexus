/**
 * ActivePortsPanel Component
 * Created: Jan 14, 2026
 *
 * Displays dedicated ports with status, system ports collapsed, and unexpected ports.
 */

import React, { useState } from 'react';
import { RefreshCw, Server, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { PortStatus } from '../../../services/api/serverManagementApi';

interface ActivePortsPanelProps {
  portStatus: PortStatus;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const ActivePortsPanel: React.FC<ActivePortsPanelProps> = ({
  portStatus,
  isLoading = false,
  onRefresh
}) => {
  const { dedicatedPorts, systemPorts = [], unexpectedPorts } = portStatus;
  const [systemPortsExpanded, setSystemPortsExpanded] = useState(false);

  const getStatusIcon = (status: 'running' | 'missing' | 'wrong-process') => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'missing':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'wrong-process':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: 'running' | 'missing' | 'wrong-process') => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Running
          </span>
        );
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Not Running
          </span>
        );
      case 'wrong-process':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Wrong Process
          </span>
        );
    }
  };

  const runningCount = dedicatedPorts.filter(p => p.status === 'running').length;
  const issueCount = dedicatedPorts.filter(p => p.status !== 'running').length;
  const systemRunningCount = systemPorts.filter(p => p.status === 'running').length;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Port Status</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            {runningCount}/{dedicatedPorts.length}
          </span>
          {issueCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {issueCount} issue{issueCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Dedicated Ports Section */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-600 mb-2">Dedicated Ports</h4>
        <div className="space-y-2">
          {dedicatedPorts.map((port) => (
            <div
              key={port.port}
              className={`flex items-center justify-between p-2 rounded-lg border ${
                port.status === 'running'
                  ? 'bg-green-50 border-green-200'
                  : port.status === 'missing'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(port.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-800">:{port.port}</span>
                    <span className="font-medium text-gray-700">{port.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{port.description}</span>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(port.status)}
                {port.actualPid ? (
                  <div className="text-xs text-gray-500 mt-1">
                    PID: {port.actualPid}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Ports Section (Collapsible) */}
      {systemPorts.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setSystemPortsExpanded(!systemPortsExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors w-full"
          >
            {systemPortsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span>System Ports</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {systemRunningCount}/{systemPorts.length}
            </span>
          </button>

          {systemPortsExpanded && (
            <div className="mt-2 space-y-1 pl-6">
              {systemPorts.map((port) => (
                <div
                  key={port.port}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-sm bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${port.status === 'running' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="font-mono text-gray-700">:{port.port}</span>
                    <span className="text-gray-600">{port.name}</span>
                    <span className="text-xs text-gray-400">- {port.description}</span>
                  </div>
                  <span className={`text-xs ${port.status === 'running' ? 'text-green-600' : 'text-gray-500'}`}>
                    {port.status === 'running' ? 'Running' : 'Stopped'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unexpected Ports Section */}
      {unexpectedPorts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
            Unexpected Ports
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {unexpectedPorts.length}
            </span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Port</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Process</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">PID</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {unexpectedPorts.map((port) => (
                  <tr key={`${port.port}-${port.pid}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-mono font-medium text-gray-800">{port.port}</td>
                    <td className="py-2 px-2 text-gray-700">{port.process || '(system)'}</td>
                    <td className="py-2 px-2 font-mono text-gray-600">{port.pid || '-'}</td>
                    <td className="py-2 px-2">
                      {port.isManagedByPM2 ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          PM2
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          Unmanaged
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivePortsPanel;
