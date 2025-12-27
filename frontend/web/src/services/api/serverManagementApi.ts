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

export interface ScriptResult {
  output: string;
}

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
  async listBackups(): Promise<{ backend: BackupFile[]; frontend: BackupFile[] }> {
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
  }
};
