/**
 * StatusCard Component
 * Created: Dec 23, 2025
 *
 * Displays PM2 process status with colored indicators.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { PM2ProcessStatus } from '../../../services/api/serverManagementApi';

interface StatusCardProps {
  process: PM2ProcessStatus;
  onRestart?: () => void;
  isRestarting?: boolean;
  variant?: 'dev' | 'prod';
}

export const StatusCard: React.FC<StatusCardProps> = ({
  process,
  onRestart,
  isRestarting = false,
  variant = 'dev'
}) => {
  const statusColor = {
    online: 'bg-green-500',
    stopped: 'bg-red-500',
    errored: 'bg-red-500',
    unknown: 'bg-gray-500'
  }[process.status] || 'bg-gray-500';

  const statusTextColor = {
    online: 'text-green-600',
    stopped: 'text-red-600',
    errored: 'text-red-600',
    unknown: 'text-gray-600'
  }[process.status] || 'text-gray-600';

  const formatUptime = (startTime: number) => {
    if (!startTime) return 'N/A';
    const ms = Date.now() - startTime;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const formatMemory = (bytes: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  // Determine port based on process name
  const getPort = (name: string) => {
    if (name.includes('backend-dev')) return '3002';
    if (name.includes('backend')) return '3001';
    return null;
  };

  const port = getPort(process.name);

  return (
    <div className={`bg-white rounded-xl shadow-md p-4 border-2 ${variant === 'prod' ? 'border-purple-300' : 'border-emerald-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusColor} ${process.status === 'online' ? 'animate-pulse' : ''}`} />
          <h4 className="font-semibold text-gray-800 text-sm">{process.name}</h4>
        </div>
        {variant === 'prod' ? (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">PROD</span>
        ) : (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">DEV</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-500">Status:</span>
          <span className={`ml-1 font-medium ${statusTextColor}`}>
            {process.status}
          </span>
        </div>
        {port && (
          <div>
            <span className="text-gray-500">Port:</span>
            <span className="ml-1 font-medium text-gray-800">{port}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">Memory:</span>
          <span className="ml-1 font-medium text-gray-800">{formatMemory(process.memory)}</span>
        </div>
        <div>
          <span className="text-gray-500">CPU:</span>
          <span className="ml-1 font-medium text-gray-800">{process.cpu}%</span>
        </div>
        <div>
          <span className="text-gray-500">Uptime:</span>
          <span className="ml-1 font-medium text-gray-800">{formatUptime(process.uptime)}</span>
        </div>
        <div>
          <span className="text-gray-500">Restarts:</span>
          <span className="ml-1 font-medium text-gray-800">{process.restartCount}</span>
        </div>
      </div>

      {onRestart && (
        <button
          onClick={onRestart}
          disabled={isRestarting}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
            ${variant === 'prod'
              ? 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-purple-300'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-emerald-300'
            }`}
        >
          <RotateCcw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
          {isRestarting ? 'Restarting...' : 'Restart'}
        </button>
      )}
    </div>
  );
};

export default StatusCard;
