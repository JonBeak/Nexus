/**
 * Server Management Service
 * Created: Dec 23, 2025
 *
 * Core service for script execution, PM2 status parsing, and backup management.
 * Used by the Server Management GUI for owner-only operations.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

const execAsync = promisify(exec);

// Configuration
const SCRIPTS_DIR = '/home/jon/Nexus/infrastructure/scripts';
const BACKUPS_DIR = '/home/jon/Nexus/infrastructure/backups';
const BACKEND_BUILD_DIR = '/home/jon/Nexus/backend/web';
const FRONTEND_BUILD_DIR = '/home/jon/Nexus/frontend/web';

// Interfaces
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

export interface SystemStatus {
  processes: PM2ProcessStatus[];
  builds: {
    backendProduction: BuildTimestamp;
    backendDev: BuildTimestamp;
    frontendProduction: BuildTimestamp;
    frontendDev: BuildTimestamp;
  };
  serverTime: string;
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
  success: boolean;
  output: string;
  error?: string;
}

class ServerManagementService {
  /**
   * Get complete system status including PM2 processes and build timestamps
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const [processes, builds] = await Promise.all([
      this.getPM2Status(),
      this.getBuildTimestamps()
    ]);

    return {
      processes,
      builds,
      serverTime: new Date().toISOString()
    };
  }

  /**
   * Get PM2 process status via pm2 jlist
   */
  async getPM2Status(): Promise<PM2ProcessStatus[]> {
    try {
      const { stdout } = await execAsync('pm2 jlist', { timeout: 10000 });
      const processes = JSON.parse(stdout);

      return processes.map((p: any) => ({
        name: p.name,
        status: p.pm2_env?.status || 'unknown',
        memory: p.monit?.memory || 0,
        uptime: p.pm2_env?.pm_uptime || 0,
        restartCount: p.pm2_env?.restart_time || 0,
        cpu: p.monit?.cpu || 0,
        pid: p.pid || 0
      }));
    } catch (error) {
      console.error('Failed to get PM2 status:', error);
      return [];
    }
  }

  /**
   * Get build directory timestamps
   */
  async getBuildTimestamps(): Promise<SystemStatus['builds']> {
    const getTimestamp = async (dirPath: string): Promise<BuildTimestamp> => {
      try {
        if (!fs.existsSync(dirPath)) {
          return { directory: dirPath, lastModified: null, exists: false };
        }
        const stats = fs.statSync(dirPath);
        return {
          directory: dirPath,
          lastModified: stats.mtime.toISOString(),
          exists: true
        };
      } catch (error) {
        return { directory: dirPath, lastModified: null, exists: false };
      }
    };

    const [backendProduction, backendDev, frontendProduction, frontendDev] = await Promise.all([
      getTimestamp(path.join(BACKEND_BUILD_DIR, 'dist-production')),
      getTimestamp(path.join(BACKEND_BUILD_DIR, 'dist-dev')),
      getTimestamp(path.join(FRONTEND_BUILD_DIR, 'dist-production')),
      getTimestamp(path.join(FRONTEND_BUILD_DIR, 'dist-dev'))
    ]);

    return { backendProduction, backendDev, frontendProduction, frontendDev };
  }

  /**
   * Execute an infrastructure script
   */
  async executeScript(scriptName: string, timeout: number = 120000): Promise<ScriptResult> {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);

    // Validate script exists
    if (!fs.existsSync(scriptPath)) {
      return { success: false, output: '', error: `Script not found: ${scriptName}` };
    }

    try {
      const { stdout, stderr } = await execAsync(scriptPath, {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
        cwd: SCRIPTS_DIR
      });

      const output = stdout + (stderr ? `\n${stderr}` : '');
      return { success: true, output };
    } catch (error: any) {
      const output = error.stdout || '';
      const errorMsg = error.stderr || error.message;
      return { success: false, output, error: errorMsg };
    }
  }

  /**
   * Execute a PM2 command
   */
  async executePM2Command(command: string): Promise<ScriptResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });

      const output = stdout + (stderr ? `\n${stderr}` : '');
      return { success: true, output };
    } catch (error: any) {
      const output = error.stdout || '';
      const errorMsg = error.stderr || error.message;
      return { success: false, output, error: errorMsg };
    }
  }

  /**
   * Get all backup notes from database
   */
  async getBackupNotes(): Promise<Map<string, string>> {
    try {
      const rows = await query('SELECT filename, note FROM backup_notes') as RowDataPacket[];
      const notesMap = new Map<string, string>();
      for (const row of rows) {
        if (row.note) {
          notesMap.set(row.filename, row.note);
        }
      }
      return notesMap;
    } catch (error) {
      console.error('Failed to fetch backup notes:', error);
      return new Map();
    }
  }

  /**
   * List all backup files
   */
  async listBackups(): Promise<{ backend: BackupFile[]; frontend: BackupFile[] }> {
    // Get notes from database
    const notesMap = await this.getBackupNotes();

    const parseBackupFiles = (dirPath: string, type: 'backend' | 'frontend'): BackupFile[] => {
      try {
        if (!fs.existsSync(dirPath)) {
          return [];
        }

        const files = fs.readdirSync(dirPath)
          .filter(f => f.endsWith('.tar.gz'))
          .map(filename => {
            const filePath = path.join(dirPath, filename);
            const stats = fs.statSync(filePath);

            // Parse filename: dist-{buildType}-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz
            const match = filename.match(/dist-(production|dev)-(\d{8})-(\d{6})-commit-([a-f0-9]+)\.tar\.gz/);

            let buildType: 'production' | 'dev' = 'production';
            let commitHash: string | null = null;
            let dateStr = '';

            if (match) {
              buildType = match[1] as 'production' | 'dev';
              dateStr = `${match[2]}-${match[3]}`;
              commitHash = match[4];
            }

            // Format size
            const sizeBytes = stats.size;
            let size: string;
            if (sizeBytes < 1024) {
              size = `${sizeBytes} B`;
            } else if (sizeBytes < 1024 * 1024) {
              size = `${(sizeBytes / 1024).toFixed(1)} KB`;
            } else {
              size = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
            }

            return {
              filename,
              date: stats.mtime.toISOString(),
              size,
              sizeBytes,
              commitHash,
              type,
              buildType,
              note: notesMap.get(filename) || null
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

        return files;
      } catch (error) {
        console.error(`Failed to list backups in ${dirPath}:`, error);
        return [];
      }
    };

    const backendBackupsDir = path.join(BACKUPS_DIR, 'backend-builds');
    const frontendBackupsDir = path.join(BACKUPS_DIR, 'frontend-builds');

    return {
      backend: parseBackupFiles(backendBackupsDir, 'backend'),
      frontend: parseBackupFiles(frontendBackupsDir, 'frontend')
    };
  }

  /**
   * Validate backup filename for security (no path traversal, file exists)
   */
  validateBackupFilename(filename: string): { valid: boolean; error?: string; type?: 'backend' | 'frontend' } {
    // Check for path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return { valid: false, error: 'Invalid filename: path traversal not allowed' };
    }

    // Check filename format
    if (!filename.endsWith('.tar.gz')) {
      return { valid: false, error: 'Invalid filename: must be a .tar.gz file' };
    }

    // Check if file exists in either backup directory
    const backendPath = path.join(BACKUPS_DIR, 'backend-builds', filename);
    const frontendPath = path.join(BACKUPS_DIR, 'frontend-builds', filename);

    if (fs.existsSync(backendPath)) {
      return { valid: true, type: 'backend' };
    }

    if (fs.existsSync(frontendPath)) {
      return { valid: true, type: 'frontend' };
    }

    return { valid: false, error: 'Backup file not found' };
  }

  /**
   * Restore a backup file
   */
  async restoreBackup(filename: string): Promise<ScriptResult> {
    const validation = this.validateBackupFilename(filename);
    if (!validation.valid) {
      return { success: false, output: '', error: validation.error };
    }

    // Use echo "y" to auto-confirm the restore script
    const scriptPath = path.join(SCRIPTS_DIR, 'restore-backup.sh');

    try {
      const { stdout, stderr } = await execAsync(`echo "y" | ${scriptPath} ${filename}`, {
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        cwd: SCRIPTS_DIR
      });

      const output = stdout + (stderr ? `\n${stderr}` : '');
      return { success: true, output };
    } catch (error: any) {
      const output = error.stdout || '';
      const errorMsg = error.stderr || error.message;
      return { success: false, output, error: errorMsg };
    }
  }

  // Backend Operations
  async rebuildBackendDev(): Promise<ScriptResult> {
    return this.executeScript('backend-rebuild-dev.sh');
  }

  async rebuildBackendProd(): Promise<ScriptResult> {
    return this.executeScript('backend-rebuild-production.sh');
  }

  async restartBackendDev(): Promise<ScriptResult> {
    return this.executePM2Command('pm2 restart signhouse-backend-dev');
  }

  async restartBackendProd(): Promise<ScriptResult> {
    return this.executePM2Command('pm2 restart signhouse-backend');
  }

  // Frontend Operations
  async rebuildFrontendDev(): Promise<ScriptResult> {
    return this.executeScript('frontend-rebuild-dev.sh');
  }

  async rebuildFrontendProd(): Promise<ScriptResult> {
    return this.executeScript('frontend-rebuild-production.sh');
  }

  // Combined Operations
  async rebuildAllDev(): Promise<ScriptResult> {
    return this.executeScript('rebuild-dev.sh', 180000); // 3 minute timeout
  }

  async rebuildAllProd(): Promise<ScriptResult> {
    return this.executeScript('rebuild-production.sh', 180000); // 3 minute timeout
  }

  /**
   * Save a note for a backup file
   */
  async saveBackupNote(filename: string, note: string): Promise<ScriptResult> {
    // Validate filename exists
    const validation = this.validateBackupFilename(filename);
    if (!validation.valid) {
      return { success: false, output: '', error: validation.error };
    }

    try {
      // Upsert the note (insert or update)
      await query(
        `INSERT INTO backup_notes (filename, note) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE note = ?, updated_at = CURRENT_TIMESTAMP`,
        [filename, note, note]
      );
      return { success: true, output: note ? `Note saved for ${filename}` : `Note cleared for ${filename}` };
    } catch (error: any) {
      console.error('Failed to save backup note:', error);
      return { success: false, output: '', error: `Failed to save note: ${error.message}` };
    }
  }

  // Backup Operations
  async createBackup(): Promise<ScriptResult> {
    return this.executeScript('backup-builds.sh');
  }

  async backupDatabase(): Promise<ScriptResult> {
    return this.executeScript('backup-db-to-gdrive.sh', 180000); // 3 minute timeout
  }

  async cleanupBackups(): Promise<ScriptResult> {
    return this.executeScript('cleanup-backups.sh');
  }
}

export const serverManagementService = new ServerManagementService();
