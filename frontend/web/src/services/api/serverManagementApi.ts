// File Clean up Finished: 2026-01-12
/**
 * Server Management API
 * Created: Dec 23, 2025
 *
 * Typed API client for server management operations.
 */

import { api } from '../apiClient';

// Types
export interface PM2ProcessStatus {
  name: string;
  status: 'online' | 'stopped' | 'errored' | 'unknown';
  memory: number;
  uptime: number;
  restartCount: number;
  cpu: number;
  pid: number;
}

export interface BuildTimestamp {
  directory: string;
  lastModified: string | null;
  exists: boolean;
}

export interface EnvironmentInfo {
  os: 'windows' | 'linux';
  platform: string;
  nexusRoot: string;
  hasNginx: boolean;
}

export interface SystemStatus {
  processes: PM2ProcessStatus[];
  builds: {
    backendProduction: BuildTimestamp;
    backendDev: BuildTimestamp;
    frontendProduction: BuildTimestamp;
    frontendDev: BuildTimestamp;
  };
  serverTime: string;
  environment: EnvironmentInfo;
}

export interface BackupFile {
  filename: string;
  date: string;
  size: string;
  sizeBytes: number;
  commitHash: string | null;
  type: 'backend' | 'frontend';
  buildType: 'production' | 'dev';
  note: string | null;
}

export interface DatabaseBackup {
  filename: string;
  date: string;
  size: string;
  sizeBytes: number;
}

export interface ScriptResult {
  output: string;
}

// Linux dev feature types
export interface ActivePort {
  port: number;
  protocol: string;
  process: string;
  pid: number;
  isManagedByPM2: boolean;
}

export interface DedicatedPort {
  port: number;
  name: string;
  description: string;
  expectedProcess: string;
  status: 'running' | 'missing' | 'wrong-process';
  actualProcess?: string;
  actualPid?: number;
}

export interface SystemPort {
  port: number;
  name: string;
  description: string;
  status: 'running' | 'stopped';
}

export interface PortStatus {
  dedicatedPorts: DedicatedPort[];
  systemPorts: SystemPort[];
  unexpectedPorts: ActivePort[];
}

export interface RogueProcess {
  pid: number;
  port: number | null;
  command: string;
  user: string;
}

export interface NetworkInterface {
  name: string;
  ip: string | null;
  status: 'up' | 'down';
  type: 'ethernet' | 'wifi' | 'other';
  network: 'main' | 'guest' | 'unknown';
  description?: string;
}

export type AccessEnvironment = 'linux-dev' | 'prod' | 'home';

export const serverManagementApi = {
  // Status
  async getStatus(): Promise<SystemStatus> {
    const response = await api.get('/server-management/status');
    return response.data;
  },

  // Backend operations
  async rebuildBackendDev(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backend/rebuild-dev');
    return response.data;
  },

  async rebuildBackendProd(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backend/rebuild-prod');
    return response.data;
  },

  async restartBackendDev(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backend/restart-dev');
    return response.data;
  },

  async restartBackendProd(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backend/restart-prod');
    return response.data;
  },

  // Frontend operations
  async rebuildFrontendDev(): Promise<ScriptResult> {
    const response = await api.post('/server-management/frontend/rebuild-dev');
    return response.data;
  },

  async rebuildFrontendProd(): Promise<ScriptResult> {
    const response = await api.post('/server-management/frontend/rebuild-prod');
    return response.data;
  },

  // Combined operations
  async rebuildAllDev(): Promise<ScriptResult> {
    const response = await api.post('/server-management/rebuild-all-dev');
    return response.data;
  },

  async rebuildAllProd(): Promise<ScriptResult> {
    const response = await api.post('/server-management/rebuild-all-prod');
    return response.data;
  },

  // Backup operations
  async listBackups(): Promise<{ backend: BackupFile[]; frontend: BackupFile[]; database: DatabaseBackup[] }> {
    const response = await api.get('/server-management/backups');
    return response.data;
  },

  async createBackup(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backups/create');
    return response.data;
  },

  async backupDatabase(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backups/database');
    return response.data;
  },

  async restoreBackup(filename: string): Promise<ScriptResult> {
    const response = await api.post('/server-management/backups/restore', { filename });
    return response.data;
  },

  async saveBackupNote(filename: string, note: string): Promise<ScriptResult> {
    const response = await api.post('/server-management/backups/note', { filename, note });
    return response.data;
  },

  async cleanupBackups(): Promise<ScriptResult> {
    const response = await api.post('/server-management/backups/cleanup');
    return response.data;
  },

  // Frontend restart
  async restartFrontendDev(): Promise<ScriptResult> {
    const response = await api.post('/server-management/frontend/restart-dev');
    return response.data;
  },

  // Linux dev features
  async getAccessEnvironment(): Promise<{ environment: AccessEnvironment; origin: string }> {
    const response = await api.get('/server-management/environment');
    return response.data;
  },

  async getActivePorts(): Promise<PortStatus> {
    const response = await api.get('/server-management/ports');
    return response.data;
  },

  async getRogueProcesses(): Promise<RogueProcess[]> {
    const response = await api.get('/server-management/rogue-processes');
    return response.data;
  },

  async killProcess(pid: number): Promise<ScriptResult> {
    const response = await api.post('/server-management/kill-process', { pid });
    return response.data;
  },

  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    const response = await api.get('/server-management/network');
    return response.data;
  },

  async getProcessLogs(processName: string, lines: number = 100): Promise<ScriptResult> {
    const response = await api.get(`/server-management/logs/${processName}`, { params: { lines } });
    return response.data;
  }
};
