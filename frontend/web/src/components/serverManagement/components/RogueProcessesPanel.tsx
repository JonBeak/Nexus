/**
 * RogueProcessesPanel Component
 * Created: Jan 14, 2026
 *
 * Displays node/npm processes not managed by PM2 with kill option.
 */

import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import type { RogueProcess } from '../../../services/api/serverManagementApi';
import { useAlert } from '../../../contexts/AlertContext';

interface RogueProcessesPanelProps {
  processes: RogueProcess[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onKill?: (pid: number) => Promise<void>;
}

export const RogueProcessesPanel: React.FC<RogueProcessesPanelProps> = ({
  processes,
  isLoading = false,
  onRefresh,
  onKill
}) => {
  const { showConfirmation } = useAlert();
  const [killingPid, setKillingPid] = useState<number | null>(null);

  const handleKill = async (pid: number) => {
    if (!onKill) return;

    const confirmed = await showConfirmation({
      title: 'Kill Process',
      message: `Kill process ${pid}? This cannot be undone.`,
      variant: 'danger',
      confirmText: 'Kill Process'
    });
    if (!confirmed) return;

    setKillingPid(pid);
    try {
      await onKill(pid);
    } finally {
      setKillingPid(null);
    }
  };

  const hasRogueProcesses = processes.length > 0;

  return (
    <div className={`bg-white rounded-xl shadow-md p-4 border ${hasRogueProcesses ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {hasRogueProcesses ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          <h3 className="font-semibold text-gray-800">Rogue Processes</h3>
          {hasRogueProcesses && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {processes.length} found
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

      {!hasRogueProcesses ? (
        <div className="text-center py-4">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-700 text-sm font-medium">All clear!</p>
          <p className="text-gray-500 text-xs">No unmanaged node processes found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {processes.map((proc) => (
            <div
              key={proc.pid}
              className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-medium text-gray-800">PID: {proc.pid}</span>
                  {proc.port && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Port: {proc.port}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">({proc.user})</span>
                </div>
                <p className="text-xs text-gray-600 font-mono truncate" title={proc.command}>
                  {proc.command}
                </p>
              </div>
              {onKill && (
                <button
                  onClick={() => handleKill(proc.pid)}
                  disabled={killingPid === proc.pid}
                  className="ml-3 p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
                  title="Kill process"
                >
                  <Trash2 className={`w-4 h-4 ${killingPid === proc.pid ? 'animate-pulse' : ''}`} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RogueProcessesPanel;
