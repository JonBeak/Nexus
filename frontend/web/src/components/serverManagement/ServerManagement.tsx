/**
 * ServerManagement Page
 * Created: Dec 23, 2025
 *
 * Main page for server management - owner only.
 * Provides GUI for managing builds, restarts, and backups.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  RefreshCw,
  HardDrive,
  Database,
  Trash2,
  Package,
  Check,
  X
} from 'lucide-react';
import { HomeButton } from '../common/HomeButton';
import { StatusCard } from './components/StatusCard';
import { BackupTable } from './components/BackupTable';
import { ActivePortsPanel } from './components/ActivePortsPanel';
import { RogueProcessesPanel } from './components/RogueProcessesPanel';
import { NetworkInterfacesPanel } from './components/NetworkInterfacesPanel';
import { LogViewerPanel } from './components/LogViewerPanel';
import {
  serverManagementApi,
  SystemStatus,
  BackupFile,
  DatabaseBackup,
  ScriptResult,
  EnvironmentInfo,
  PortStatus,
  RogueProcess,
  NetworkInterface,
  AccessEnvironment
} from '../../services/api/serverManagementApi';
import { Monitor } from 'lucide-react';

type ButtonState = 'idle' | 'running' | 'success' | 'error';

export const ServerManagement: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [backups, setBackups] = useState<{ backend: BackupFile[]; frontend: BackupFile[]; database: DatabaseBackup[] }>({
    backend: [],
    frontend: [],
    database: []
  });
  const [loading, setLoading] = useState(true);
  const [buttonStates, setButtonStates] = useState<Record<string, ButtonState>>({});
  const [lastOutput, setLastOutput] = useState<{ command: string; output: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Linux dev features state
  const [accessEnv, setAccessEnv] = useState<AccessEnvironment>('prod');
  const [portStatus, setPortStatus] = useState<PortStatus>({ dedicatedPorts: [], unexpectedPorts: [] });
  const [rogueProcesses, setRogueProcesses] = useState<RogueProcess[]>([]);
  const [networkInterfaces, setNetworkInterfaces] = useState<NetworkInterface[]>([]);
  const [linuxDataLoading, setLinuxDataLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await serverManagementApi.getStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await serverManagementApi.listBackups();
      setBackups(data);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  }, []);

  // Linux dev features fetch functions
  const fetchAccessEnvironment = useCallback(async () => {
    try {
      const data = await serverManagementApi.getAccessEnvironment();
      setAccessEnv(data.environment);
      return data.environment;
    } catch (error) {
      console.error('Failed to detect environment:', error);
      return 'prod' as AccessEnvironment;
    }
  }, []);

  const fetchLinuxData = useCallback(async () => {
    setLinuxDataLoading(true);
    try {
      const [ports, processes, network] = await Promise.all([
        serverManagementApi.getActivePorts(),
        serverManagementApi.getRogueProcesses(),
        serverManagementApi.getNetworkInterfaces()
      ]);
      setPortStatus(ports);
      setRogueProcesses(processes);
      setNetworkInterfaces(network);
    } catch (error) {
      console.error('Failed to fetch Linux data:', error);
    } finally {
      setLinuxDataLoading(false);
    }
  }, []);

  const handleKillProcess = async (pid: number) => {
    try {
      const result = await serverManagementApi.killProcess(pid);
      setLastOutput({ command: `kill ${pid}`, output: result.output });
      await fetchLinuxData(); // Refresh rogue processes
    } catch (error: any) {
      setLastOutput({ command: `kill ${pid}`, output: `Error: ${error.message}` });
    }
  };

  const handleFetchLogs = async (processName: string, lines?: number): Promise<string> => {
    const result = await serverManagementApi.getProcessLogs(processName, lines);
    return result.output;
  };

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const env = await fetchAccessEnvironment();
      await Promise.all([fetchStatus(), fetchBackups()]);
      // Fetch Linux data if in linux-dev environment
      if (env === 'linux-dev') {
        await fetchLinuxData();
      }
      setLoading(false);
    };
    loadAll();
  }, [fetchStatus, fetchBackups, fetchAccessEnvironment, fetchLinuxData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, autoRefresh]);

  const executeOperation = async (
    key: string,
    action: () => Promise<ScriptResult>,
    commandName: string
  ) => {
    setButtonStates(prev => ({ ...prev, [key]: 'running' }));
    setAutoRefresh(false); // Pause auto-refresh during operation
    // Clear previous output and show running state
    setLastOutput({ command: commandName, output: 'Running...' });

    try {
      const result = await action();
      setButtonStates(prev => ({ ...prev, [key]: result.output ? 'success' : 'error' }));
      setLastOutput({ command: commandName, output: result.output || 'No output' });

      // Refresh status after operation
      await fetchStatus();
      if (key.includes('backup')) {
        await fetchBackups();
      }

      // Reset button state after 3 seconds
      setTimeout(() => {
        setButtonStates(prev => ({ ...prev, [key]: 'idle' }));
      }, 3000);
    } catch (error: any) {
      setButtonStates(prev => ({ ...prev, [key]: 'error' }));
      setLastOutput({
        command: commandName,
        output: `Error: ${error.message || 'Operation failed'}`
      });
      setTimeout(() => {
        setButtonStates(prev => ({ ...prev, [key]: 'idle' }));
      }, 3000);
    } finally {
      setAutoRefresh(true);
    }
  };

  const getButtonClass = (variant: 'dev' | 'prod' | 'backup' | 'neutral', state: ButtonState) => {
    const base = 'px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2';

    if (state === 'running') return `${base} bg-gray-400 text-white cursor-wait`;
    if (state === 'success') return `${base} bg-green-500 text-white`;
    if (state === 'error') return `${base} bg-red-500 text-white`;

    if (variant === 'prod') {
      return `${base} bg-purple-600 hover:bg-purple-700 text-white`;
    }
    if (variant === 'dev') {
      return `${base} bg-emerald-500 hover:bg-emerald-600 text-white`;
    }
    if (variant === 'backup') {
      return `${base} bg-blue-500 hover:bg-blue-600 text-white`;
    }
    if (variant === 'neutral') {
      return `${base} bg-gray-600 hover:bg-gray-700 text-white`;
    }
    return `${base} bg-blue-500 hover:bg-blue-600 text-white`;
  };

  const getButtonIcon = (state: ButtonState) => {
    if (state === 'running') return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (state === 'success') return <Check className="w-4 h-4" />;
    if (state === 'error') return <X className="w-4 h-4" />;
    return null;
  };

  const handleRestore = async (filename: string) => {
    await executeOperation(
      'restore',
      () => serverManagementApi.restoreBackup(filename),
      `restore-backup.sh ${filename}`
    );
  };

  const handleSaveNote = async (filename: string, note: string) => {
    try {
      const result = await serverManagementApi.saveBackupNote(filename, note);
      if (result.output) {
        setLastOutput({ command: `save-note ${filename}`, output: result.output });
      }
      // Refresh backups list to show updated note
      await fetchBackups();
    } catch (error: any) {
      setLastOutput({ command: `save-note ${filename}`, output: `Error: ${error.message}` });
      throw error;
    }
  };

  // Format build timestamp
  const formatBuildTime = (timestamp: string | null) => {
    if (!timestamp) return 'Not found';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate time since build
  const getTimeSinceBuilt = (timestamp: string | null) => {
    if (!timestamp) return '';
    const buildDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - buildDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    const minutes = diffMinutes % 60;

    if (days > 0) {
      return `(${days}d, ${hours}h)`;
    }
    return `(${hours}h, ${minutes}m)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading server status...</p>
        </div>
      </div>
    );
  }

  // Filter to only show signhouse backend processes
  const backendProcesses = (status?.processes.filter(p =>
    p.name.includes('signhouse-backend')
  ) || []).reverse();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-slate-600">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <HomeButton />
              <div className="w-12 h-12 bg-slate-600 rounded-xl flex items-center justify-center shadow-lg">
                <Server className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Server Management</h1>
                <p className="text-gray-600">Manage builds, restarts, and backups</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* OS Badge */}
              {status?.environment && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  status.environment.os === 'windows'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-orange-100 text-orange-700 border border-orange-200'
                }`}>
                  <Monitor className="w-4 h-4" />
                  {status.environment.os === 'windows' ? 'Windows' : 'Linux'}
                </div>
              )}
              <span className={`text-sm ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`}>
                {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: PAUSED'}
              </span>
              <button
                onClick={() => {
                  fetchStatus();
                  fetchBackups();
                }}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh status"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Dashboard */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            System Status
          </h2>

          <div className="flex gap-4">
            {/* PM2 Processes - stacked on left */}
            <div className="flex flex-col gap-4 w-72 flex-shrink-0">
              {backendProcesses.map((process) => (
                <StatusCard
                  key={process.name}
                  process={process}
                  variant={process.name === 'signhouse-backend' ? 'prod' : 'dev'}
                  onRestart={() => {
                    const key = process.name === 'signhouse-backend' ? 'restart-backend-prod' : 'restart-backend-dev';
                    const api = process.name === 'signhouse-backend'
                      ? serverManagementApi.restartBackendProd
                      : serverManagementApi.restartBackendDev;
                    executeOperation(key, api, `pm2 restart ${process.name}`);
                  }}
                  isRestarting={
                    buttonStates[process.name === 'signhouse-backend' ? 'restart-backend-prod' : 'restart-backend-dev'] === 'running'
                  }
                />
              ))}
            </div>

            {/* Console Output - fills remaining space on right */}
            <div className="flex-1 bg-gray-900 rounded-xl p-4 min-h-[200px] flex flex-col">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Console Output</h3>
              {lastOutput ? (
                <>
                  <div className="text-gray-400 text-sm mb-2 font-mono">$ {lastOutput.command}</div>
                  <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap flex-1 overflow-y-auto max-h-[300px]">
                    {lastOutput.output}
                  </pre>
                </>
              ) : (
                <div className="text-gray-500 text-sm italic flex-1 flex items-center justify-center">
                  No recent output
                </div>
              )}
            </div>
          </div>

        </section>

        {/* Build Operations Matrix */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Build Operations
          </h2>

          <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 overflow-x-auto">
            {/* Matrix Header */}
            <div className="grid grid-cols-5 gap-3 mb-4 text-lg font-semibold">
              <div></div>
              <div className="text-center text-emerald-600">Dev - Last Built</div>
              <div className="text-center text-emerald-600">Dev - Rebuild</div>
              <div className="text-center text-purple-600">Prod - Last Built</div>
              <div className="text-center text-purple-600">Prod - Rebuild</div>
            </div>

            {/* Backend Row */}
            <div className="grid grid-cols-5 gap-3 mb-2 items-center text-sm">
              <div className="font-medium text-gray-700">Backend</div>
              <div className="text-center text-gray-700 bg-emerald-50 p-2 rounded">
                <div>{formatBuildTime(status?.builds.backendDev.lastModified || null)}</div>
                <div className="text-xs text-gray-500">{getTimeSinceBuilt(status?.builds.backendDev.lastModified || null)}</div>
              </div>
              <button
                onClick={() => executeOperation(
                  'rebuild-backend-dev',
                  serverManagementApi.rebuildBackendDev,
                  'backend-rebuild-dev.sh'
                )}
                disabled={buttonStates['rebuild-backend-dev'] === 'running'}
                className={getButtonClass('dev', buttonStates['rebuild-backend-dev'] || 'idle') + ' w-full justify-center text-sm py-1'}
              >
                {getButtonIcon(buttonStates['rebuild-backend-dev'] || 'idle')}
                {buttonStates['rebuild-backend-dev'] === 'running' ? 'Building...' : 'Rebuild'}
              </button>
              <div className="text-center text-gray-700 bg-purple-50 p-2 rounded">
                <div>{formatBuildTime(status?.builds.backendProduction.lastModified || null)}</div>
                <div className="text-xs text-gray-500">{getTimeSinceBuilt(status?.builds.backendProduction.lastModified || null)}</div>
              </div>
              <button
                onClick={() => executeOperation(
                  'rebuild-backend-prod',
                  serverManagementApi.rebuildBackendProd,
                  'backend-rebuild-production.sh'
                )}
                disabled={buttonStates['rebuild-backend-prod'] === 'running'}
                className={getButtonClass('prod', buttonStates['rebuild-backend-prod'] || 'idle') + ' w-full justify-center text-sm py-1'}
              >
                {getButtonIcon(buttonStates['rebuild-backend-prod'] || 'idle')}
                {buttonStates['rebuild-backend-prod'] === 'running' ? 'Building...' : 'Rebuild'}
              </button>
            </div>

            {/* Frontend Row */}
            <div className="grid grid-cols-5 gap-3 mb-2 items-center text-sm">
              <div className="font-medium text-gray-700">Frontend</div>
              <div className="text-center text-gray-700 bg-emerald-50 p-2 rounded">
                <div>{formatBuildTime(status?.builds.frontendDev.lastModified || null)}</div>
                <div className="text-xs text-gray-500">{getTimeSinceBuilt(status?.builds.frontendDev.lastModified || null)}</div>
              </div>
              <button
                onClick={() => executeOperation(
                  'rebuild-frontend-dev',
                  serverManagementApi.rebuildFrontendDev,
                  'frontend-rebuild-dev.sh'
                )}
                disabled={buttonStates['rebuild-frontend-dev'] === 'running'}
                className={getButtonClass('dev', buttonStates['rebuild-frontend-dev'] || 'idle') + ' w-full justify-center text-sm py-1'}
              >
                {getButtonIcon(buttonStates['rebuild-frontend-dev'] || 'idle')}
                {buttonStates['rebuild-frontend-dev'] === 'running' ? 'Building...' : 'Rebuild'}
              </button>
              <div className="text-center text-gray-700 bg-purple-50 p-2 rounded">
                <div>{formatBuildTime(status?.builds.frontendProduction.lastModified || null)}</div>
                <div className="text-xs text-gray-500">{getTimeSinceBuilt(status?.builds.frontendProduction.lastModified || null)}</div>
              </div>
              <button
                onClick={() => executeOperation(
                  'rebuild-frontend-prod',
                  serverManagementApi.rebuildFrontendProd,
                  'frontend-rebuild-production.sh'
                )}
                disabled={buttonStates['rebuild-frontend-prod'] === 'running'}
                className={getButtonClass('prod', buttonStates['rebuild-frontend-prod'] || 'idle') + ' w-full justify-center text-sm py-1'}
              >
                {getButtonIcon(buttonStates['rebuild-frontend-prod'] || 'idle')}
                {buttonStates['rebuild-frontend-prod'] === 'running' ? 'Building...' : 'Rebuild'}
              </button>
            </div>

            {/* Full Stack Row */}
            <div className="grid grid-cols-5 gap-3 items-center text-sm pt-2 border-t border-gray-200">
              <div className="font-medium text-gray-700">Full Stack</div>
              <div className="text-center text-gray-500 text-xs">—</div>
              <button
                onClick={() => executeOperation(
                  'rebuild-all-dev',
                  serverManagementApi.rebuildAllDev,
                  'rebuild-dev.sh'
                )}
                disabled={buttonStates['rebuild-all-dev'] === 'running'}
                className={getButtonClass('dev', buttonStates['rebuild-all-dev'] || 'idle') + ' w-full justify-center text-sm py-1'}
              >
                {getButtonIcon(buttonStates['rebuild-all-dev'] || 'idle')}
                {buttonStates['rebuild-all-dev'] === 'running' ? 'Building...' : 'Rebuild All'}
              </button>
              <div className="text-center text-gray-500 text-xs">—</div>
              <button
                onClick={() => executeOperation(
                  'rebuild-all-prod',
                  serverManagementApi.rebuildAllProd,
                  'rebuild-production.sh'
                )}
                disabled={buttonStates['rebuild-all-prod'] === 'running'}
                className={getButtonClass('prod', buttonStates['rebuild-all-prod'] || 'idle') + ' w-full justify-center text-sm py-1'}
              >
                {getButtonIcon(buttonStates['rebuild-all-prod'] || 'idle')}
                {buttonStates['rebuild-all-prod'] === 'running' ? 'Building...' : 'Rebuild All'}
              </button>
            </div>
          </div>
        </section>

        {/* Backup Operations */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Backup Operations
          </h2>

          {/* Windows notice */}
          {status?.environment?.os === 'windows' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <Monitor className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-800 font-medium">Windows Environment</p>
                <p className="text-blue-600 text-sm">
                  Backup operations are only available on the Linux production server.
                  Use the dev rebuild button above to rebuild the backend.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => executeOperation(
                'backup-create',
                serverManagementApi.createBackup,
                'backup-builds.sh'
              )}
              disabled={buttonStates['backup-create'] === 'running' || status?.environment?.os === 'windows'}
              className={getButtonClass('backup', buttonStates['backup-create'] || 'idle')}
            >
              {getButtonIcon(buttonStates['backup-create'] || 'idle')}
              <HardDrive className="w-4 h-4" />
              {buttonStates['backup-create'] === 'running' ? 'Creating...' : 'Create Build Backup'}
            </button>
            <button
              onClick={() => executeOperation(
                'backup-database',
                serverManagementApi.backupDatabase,
                'backup-db-to-gdrive.sh'
              )}
              disabled={buttonStates['backup-database'] === 'running' || status?.environment?.os === 'windows'}
              className={getButtonClass('backup', buttonStates['backup-database'] || 'idle')}
            >
              {getButtonIcon(buttonStates['backup-database'] || 'idle')}
              <Database className="w-4 h-4" />
              {buttonStates['backup-database'] === 'running' ? 'Backing up...' : 'Backup Database'}
            </button>
            <button
              onClick={() => executeOperation(
                'backup-cleanup',
                serverManagementApi.cleanupBackups,
                'cleanup-backups.sh'
              )}
              disabled={buttonStates['backup-cleanup'] === 'running' || status?.environment?.os === 'windows'}
              className={getButtonClass('neutral', buttonStates['backup-cleanup'] || 'idle')}
            >
              {getButtonIcon(buttonStates['backup-cleanup'] || 'idle')}
              <Trash2 className="w-4 h-4" />
              {buttonStates['backup-cleanup'] === 'running' ? 'Cleaning...' : 'Cleanup Old Backups'}
            </button>
          </div>

          {/* Only show backup tables on Linux */}
          {status?.environment?.os !== 'windows' && (
            <>
              {/* Database Backups */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Database Backups
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {backups.database.length}
                  </span>
                </h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Filename</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Date</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.database.slice(0, 7).map((backup) => (
                        <tr key={backup.filename} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-4 font-mono text-gray-700 text-xs">{backup.filename}</td>
                          <td className="py-2 px-4 text-gray-600">
                            {new Date(backup.date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="py-2 px-4 text-gray-600">{backup.size}</td>
                        </tr>
                      ))}
                      {backups.database.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-gray-500">No database backups found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Build Backups */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BackupTable
                  title="Backend Backups"
                  backups={backups.backend}
                  onRestore={handleRestore}
                  onSaveNote={handleSaveNote}
                  isRestoring={buttonStates['restore'] === 'running'}
                />
                <BackupTable
                  title="Frontend Backups"
                  backups={backups.frontend}
                  onRestore={handleRestore}
                  onSaveNote={handleSaveNote}
                  isRestoring={buttonStates['restore'] === 'running'}
                />
              </div>
            </>
          )}
        </section>

        {/* Linux Dev Features - Only shown in linux-dev environment */}
        {accessEnv === 'linux-dev' && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Linux Dev Tools
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">
                Dev Environment
              </span>
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ActivePortsPanel
                portStatus={portStatus}
                isLoading={linuxDataLoading}
                onRefresh={fetchLinuxData}
              />
              <RogueProcessesPanel
                processes={rogueProcesses}
                isLoading={linuxDataLoading}
                onRefresh={fetchLinuxData}
                onKill={handleKillProcess}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NetworkInterfacesPanel
                interfaces={networkInterfaces}
                isLoading={linuxDataLoading}
                onRefresh={fetchLinuxData}
              />
              <LogViewerPanel onFetchLogs={handleFetchLogs} />
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default ServerManagement;
