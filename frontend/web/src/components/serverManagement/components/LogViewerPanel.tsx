/**
 * LogViewerPanel Component
 * Created: Jan 14, 2026
 *
 * Real-time log viewer for PM2 processes with auto-refresh.
 */

import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, FileText, Play, Pause, ChevronDown } from 'lucide-react';

interface LogViewerPanelProps {
  onFetchLogs: (processName: string, lines?: number) => Promise<string>;
}

const PROCESS_OPTIONS = [
  { value: 'signhouse-backend', label: 'Backend (Prod)', variant: 'prod' },
  { value: 'signhouse-backend-dev', label: 'Backend (Dev)', variant: 'dev' },
  { value: 'signhouse-frontend-dev', label: 'Frontend (Dev)', variant: 'dev' }
];

export const LogViewerPanel: React.FC<LogViewerPanelProps> = ({ onFetchLogs }) => {
  const [selectedProcess, setSelectedProcess] = useState(PROCESS_OPTIONS[0].value);
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLPreElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const logContent = await onFetchLogs(selectedProcess, 100);
      setLogs(logContent);

      // Auto-scroll to bottom
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProcess]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedProcess]);

  const selectedOption = PROCESS_OPTIONS.find(p => p.value === selectedProcess);

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-800">Log Viewer</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Process selector */}
          <div className="relative">
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-sm font-medium cursor-pointer
                ${selectedOption?.variant === 'prod'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
            >
              {PROCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${autoRefresh
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>

          {/* Manual refresh */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      ) : (
        <pre
          ref={logContainerRef}
          className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap"
        >
          {logs || 'No logs available'}
        </pre>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Showing last 100 lines</span>
        {autoRefresh && <span className="text-green-600">Refreshing every 5s</span>}
      </div>
    </div>
  );
};

export default LogViewerPanel;
