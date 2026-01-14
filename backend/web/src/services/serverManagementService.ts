/**
 * Server Management Service
 * Created: Dec 23, 2025
 *
 * Core service for script execution, PM2 status parsing, and backup management.
 * Used by the Server Management GUI for owner-only operations.
 *
 * Supports both Windows and Linux environments.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

const execAsync = promisify(exec);

// OS Detection
const IS_WINDOWS = process.platform === 'win32';

// Cross-platform Configuration
const NEXUS_ROOT = IS_WINDOWS
  ? (process.env.NEXUS_ROOT || 'C:/Users/13433/Nexus')
  : '/home/jon/Nexus';

const SCRIPTS_DIR = path.join(NEXUS_ROOT, 'infrastructure', 'scripts');
const WINDOWS_SCRIPTS_DIR = path.join(SCRIPTS_DIR, 'windows');
const BACKUPS_DIR = path.join(NEXUS_ROOT, 'infrastructure', 'backups');
const BACKEND_BUILD_DIR = path.join(NEXUS_ROOT, 'backend', 'web');
const FRONTEND_BUILD_DIR = path.join(NEXUS_ROOT, 'frontend', 'web');

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
  success: boolean;
  output: string;
  error?: string;
}

// New interfaces for Linux dev features
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

class ServerManagementService {
  /**
   * Get environment info (OS, paths, available features)
   */
  getEnvironmentInfo(): EnvironmentInfo {
    return {
      os: IS_WINDOWS ? 'windows' : 'linux',
      platform: process.platform,
      nexusRoot: NEXUS_ROOT,
      hasNginx: !IS_WINDOWS // Nginx only on Linux
    };
  }

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
      serverTime: new Date().toISOString(),
      environment: this.getEnvironmentInfo()
    };
  }

  /**
   * Get PM2 process status via pm2 jlist
   */
  async getPM2Status(): Promise<PM2ProcessStatus[]> {
    try {
      // Use npx on Windows to ensure PM2 is found
      const pm2Command = IS_WINDOWS ? 'npx pm2 jlist' : 'pm2 jlist';
      const { stdout } = await execAsync(pm2Command, { timeout: 15000 });
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
   * Execute an infrastructure script (cross-platform)
   * On Windows: looks for .ps1 in windows/ subdirectory
   * On Linux: uses .sh scripts directly
   */
  async executeScript(scriptName: string, timeout: number = 120000): Promise<ScriptResult> {
    let scriptPath: string;
    let command: string;
    let cwd: string;

    if (IS_WINDOWS) {
      // Convert .sh name to .ps1 and look in windows subdirectory
      const psScriptName = scriptName.replace('.sh', '.ps1');
      scriptPath = path.join(WINDOWS_SCRIPTS_DIR, psScriptName);
      cwd = WINDOWS_SCRIPTS_DIR;

      // Validate Windows script exists
      if (!fs.existsSync(scriptPath)) {
        return {
          success: false,
          output: '',
          error: `Windows script not found: ${psScriptName}. Only dev scripts are available on Windows.`
        };
      }

      // Execute PowerShell script with bypass policy
      command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
    } else {
      // Linux: use bash scripts directly
      scriptPath = path.join(SCRIPTS_DIR, scriptName);
      cwd = SCRIPTS_DIR;

      // Validate Linux script exists
      if (!fs.existsSync(scriptPath)) {
        return { success: false, output: '', error: `Script not found: ${scriptName}` };
      }

      command = scriptPath;
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
        cwd
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
   * Execute a PM2 command (cross-platform)
   */
  async executePM2Command(command: string): Promise<ScriptResult> {
    try {
      // On Windows, use npx to run PM2 commands
      const actualCommand = IS_WINDOWS
        ? command.replace(/^pm2/, 'npx pm2')
        : command;

      const { stdout, stderr } = await execAsync(actualCommand, {
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
  async listBackups(): Promise<{ backend: BackupFile[]; frontend: BackupFile[]; database: DatabaseBackup[] }> {
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

    const parseDatabaseBackups = (dirPath: string): DatabaseBackup[] => {
      try {
        if (!fs.existsSync(dirPath)) {
          return [];
        }

        const files = fs.readdirSync(dirPath)
          .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
          .map(filename => {
            const filePath = path.join(dirPath, filename);
            const stats = fs.statSync(filePath);

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
              sizeBytes
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

        return files;
      } catch (error) {
        console.error(`Failed to list database backups in ${dirPath}:`, error);
        return [];
      }
    };

    const backendBackupsDir = path.join(BACKUPS_DIR, 'backend-builds');
    const frontendBackupsDir = path.join(BACKUPS_DIR, 'frontend-builds');
    const databaseBackupsDir = path.join(BACKUPS_DIR, 'database');

    return {
      backend: parseBackupFiles(backendBackupsDir, 'backend'),
      frontend: parseBackupFiles(frontendBackupsDir, 'frontend'),
      database: parseDatabaseBackups(databaseBackupsDir)
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

  // ========== Linux Dev Features ==========

  /**
   * Detect access environment based on request origin
   */
  detectAccessEnvironment(origin: string | undefined): AccessEnvironment {
    if (!origin) return 'linux-dev';

    if (origin.includes('192.168.2.14') || origin.includes('192.168.5.28') || origin.includes('localhost')) {
      return 'linux-dev';
    }
    if (origin.includes('nexuswebapphome')) {
      return 'home';
    }
    return 'prod';
  }

  /**
   * Get all active listening ports with dedicated port status (Linux only)
   */
  async getActivePorts(): Promise<PortStatus> {
    if (IS_WINDOWS) return { dedicatedPorts: [], systemPorts: [], unexpectedPorts: [] };

    // Define expected dedicated ports
    // expectedProcesses supports multiple valid process names (e.g., PM2 cluster mode)
    // Note: nginx runs as root so process name won't show in ss output
    const DEDICATED_PORTS = [
      // Nexus App
      { port: 80, name: 'Frontend Prod', description: 'Nginx HTTP', expectedProcesses: ['nginx', ''] },
      { port: 443, name: 'Frontend Prod', description: 'Nginx HTTPS', expectedProcesses: ['nginx', ''] },
      { port: 3001, name: 'Backend Prod', description: 'Production API server', expectedProcesses: ['node'] },
      { port: 3002, name: 'Backend Dev', description: 'Development API server', expectedProcesses: ['node'] },
      { port: 5173, name: 'Frontend Dev', description: 'Vite dev server', expectedProcesses: ['node'] },
      { port: 3099, name: 'Watchdog', description: 'Remote restart service', expectedProcesses: ['node', 'PM2'] },
      // Databases
      { port: 3306, name: 'MySQL', description: 'Database server', expectedProcesses: ['mysqld', ''] },
      // Other Services
      { port: 4040, name: 'Ngrok: NexusLite', description: 'Ngrok tunnel dashboard', expectedProcesses: ['ngrok'] },
      { port: 8000, name: 'NexusLite', description: 'NexusLite Python backend', expectedProcesses: ['python'] },
      { port: 8080, name: 'Calendar HTML', description: 'Static calendar webpage', expectedProcesses: ['python3', 'python'] },
      // System Services
      { port: 139, name: 'SMB', description: 'File sharing (NetBIOS)', expectedProcesses: ['smbd', ''] },
      { port: 445, name: 'SMB', description: 'File sharing (Direct)', expectedProcesses: ['smbd', ''] },
      { port: 631, name: 'CUPS', description: 'Print server', expectedProcesses: ['cupsd', ''] },
    ];

    try {
      // Get PM2 managed PIDs first
      const pm2Processes = await this.getPM2Status();
      const pm2Pids = new Set(pm2Processes.map(p => p.pid));

      // Parse ss -tlnp output to get all listening ports
      const { stdout } = await execAsync('ss -tlnp', { timeout: 5000 });
      const lines = stdout.split('\n').slice(1); // Skip header

      const activePortMap = new Map<number, { process: string; pid: number }>();
      for (const line of lines) {
        if (!line.trim()) continue;

        // Parse: State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
        // First try to match with process info
        const matchWithProcess = line.match(/LISTEN\s+\d+\s+\d+\s+[\d.*:\[\]]+:(\d+)\s+.*users:\(\("([^"]+)",pid=(\d+)/);
        if (matchWithProcess) {
          const port = parseInt(matchWithProcess[1]);
          const process = matchWithProcess[2];
          const pid = parseInt(matchWithProcess[3]);
          activePortMap.set(port, { process, pid });
        } else {
          // Try to match root processes (no visible process info)
          const matchNoProcess = line.match(/LISTEN\s+\d+\s+\d+\s+[\d.*:\[\]]+:(\d+)\s+/);
          if (matchNoProcess && !line.includes('users:')) {
            const port = parseInt(matchNoProcess[1]);
            if (!activePortMap.has(port)) {
              activePortMap.set(port, { process: '', pid: 0 });
            }
          }
        }
      }

      // Build dedicated ports status
      const dedicatedPorts: DedicatedPort[] = DEDICATED_PORTS.map(dp => {
        const active = activePortMap.get(dp.port);
        if (!active) {
          return { ...dp, expectedProcess: dp.expectedProcesses[0], status: 'missing' as const };
        }
        // Check if process matches any expected process (supports PM2 cluster mode)
        // Empty string in expectedProcesses means root process (no visible name in ss output)
        const processMatches = dp.expectedProcesses.some(exp =>
          exp === '' ? !active.process : active.process.toLowerCase().startsWith(exp.toLowerCase())
        );
        if (!processMatches) {
          return {
            ...dp,
            expectedProcess: dp.expectedProcesses[0],
            status: 'wrong-process' as const,
            actualProcess: active.process,
            actualPid: active.pid
          };
        }
        return {
          ...dp,
          expectedProcess: dp.expectedProcesses[0],
          status: 'running' as const,
          actualProcess: active.process || '(root)',
          actualPid: active.pid
        };
      });

      // Known system ports (expected but shown collapsed)
      const SYSTEM_PORTS = [
        { port: 22, name: 'SSH', description: 'Remote access' },
        { port: 25, name: 'SMTP', description: 'Mail server' },
        { port: 53, name: 'DNS', description: 'Name resolution' },
        { port: 5432, name: 'PostgreSQL', description: 'Database server' },
        { port: 33060, name: 'MySQL X', description: 'MySQL extended protocol' },
      ];

      const systemPortNumbers = new Set(SYSTEM_PORTS.map(sp => sp.port));

      // Build system ports status
      const systemPorts: SystemPort[] = SYSTEM_PORTS.map(sp => ({
        ...sp,
        status: activePortMap.has(sp.port) ? 'running' as const : 'stopped' as const
      }));

      // Find unexpected ports (not in dedicated or system list)
      const dedicatedPortNumbers = new Set(DEDICATED_PORTS.map(dp => dp.port));
      const unexpectedPorts: ActivePort[] = [];
      for (const [port, { process, pid }] of activePortMap) {
        if (!dedicatedPortNumbers.has(port) && !systemPortNumbers.has(port)) {
          unexpectedPorts.push({
            port,
            protocol: 'tcp',
            process,
            pid,
            isManagedByPM2: pm2Pids.has(pid)
          });
        }
      }

      return {
        dedicatedPorts,
        systemPorts,
        unexpectedPorts: unexpectedPorts.sort((a, b) => a.port - b.port)
      };
    } catch (error) {
      console.error('Failed to get active ports:', error);
      return { dedicatedPorts: [], systemPorts: [], unexpectedPorts: [] };
    }
  }

  /**
   * Get rogue processes (node/npm not managed by PM2)
   */
  async getRogueProcesses(): Promise<RogueProcess[]> {
    if (IS_WINDOWS) return [];

    try {
      // Get PM2 managed PIDs
      const pm2Processes = await this.getPM2Status();
      const pm2Pids = new Set(pm2Processes.map(p => p.pid));

      // Get all descendant PIDs of PM2 processes recursively
      // PM2 spawns: PM2 -> sh -c -> node -> esbuild (can be 4+ levels deep)
      const pm2AllPids = new Set<number>();

      const getDescendants = async (pid: number, depth: number = 0): Promise<void> => {
        if (depth > 5) return; // Safety limit
        pm2AllPids.add(pid);
        try {
          const { stdout } = await execAsync(`pgrep -P ${pid}`, { timeout: 2000 });
          for (const line of stdout.split('\n')) {
            const childPid = parseInt(line.trim());
            if (!isNaN(childPid) && !pm2AllPids.has(childPid)) {
              await getDescendants(childPid, depth + 1);
            }
          }
        } catch {}
      };

      for (const pm2Pid of pm2Pids) {
        await getDescendants(pm2Pid);
      }

      // Get all node/npm processes
      const { stdout } = await execAsync('ps aux | grep -E "node|npm|vite|esbuild" | grep -v grep', { timeout: 5000 });
      const lines = stdout.split('\n').filter(l => l.trim());

      // Get port mappings
      const portMap = new Map<number, number>(); // pid -> port
      try {
        const { stdout: ssOut } = await execAsync('ss -tlnp', { timeout: 5000 });
        for (const line of ssOut.split('\n')) {
          const match = line.match(/:(\d+)\s+.*pid=(\d+)/);
          if (match) {
            portMap.set(parseInt(match[2]), parseInt(match[1]));
          }
        }
      } catch {}

      const rogueProcesses: RogueProcess[] = [];
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 11) continue;

        const user = parts[0];
        const pid = parseInt(parts[1]);
        const command = parts.slice(10).join(' ');

        // Skip if managed by PM2 (direct or descendant) or is PM2 itself
        if (pm2AllPids.has(pid) || command.includes('pm2') || command.includes('PM2')) continue;

        rogueProcesses.push({
          pid,
          port: portMap.get(pid) || null,
          command: command.substring(0, 100), // Truncate long commands
          user
        });
      }

      return rogueProcesses;
    } catch (error) {
      console.error('Failed to get rogue processes:', error);
      return [];
    }
  }

  /**
   * Kill a process by PID (with safety checks)
   */
  async killProcess(pid: number): Promise<ScriptResult> {
    if (IS_WINDOWS) {
      return { success: false, output: '', error: 'Kill process not available on Windows' };
    }

    // Safety: Don't kill PM2 managed processes this way
    const pm2Processes = await this.getPM2Status();
    const pm2Pids = new Set(pm2Processes.map(p => p.pid));

    if (pm2Pids.has(pid)) {
      return { success: false, output: '', error: 'Cannot kill PM2 managed process. Use restart instead.' };
    }

    // Safety: Only kill node/npm/vite processes
    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o comm=`, { timeout: 5000 });
      const processName = stdout.trim().toLowerCase();

      if (!['node', 'npm', 'vite', 'sh', 'bash'].includes(processName)) {
        return { success: false, output: '', error: `Cannot kill process type: ${processName}` };
      }

      await execAsync(`kill ${pid}`, { timeout: 5000 });
      return { success: true, output: `Killed process ${pid}` };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  /**
   * Get network interfaces status (Linux only)
   */
  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    if (IS_WINDOWS) return [];

    try {
      const { stdout } = await execAsync('ip addr show', { timeout: 5000 });
      const interfaces: NetworkInterface[] = [];

      // Parse ip addr output
      const blocks = stdout.split(/^\d+: /m).filter(b => b.trim());

      for (const block of blocks) {
        const nameMatch = block.match(/^(\w+):/);
        if (!nameMatch) continue;

        const name = nameMatch[1];
        // Skip loopback
        if (name === 'lo') continue;

        const ipMatch = block.match(/inet (\d+\.\d+\.\d+\.\d+)/);
        const ip = ipMatch ? ipMatch[1] : null;
        const status = block.includes('state UP') ? 'up' : 'down';

        // Determine type and network based on interface name
        let type: 'ethernet' | 'wifi' | 'other' = 'other';
        let network: 'main' | 'guest' | 'unknown' = 'unknown';
        let description = '';

        if (name.startsWith('enp') || name.startsWith('eth')) {
          type = 'ethernet';
          network = 'main';
          description = 'Main Network';
        } else if (name.startsWith('wlp') || name.startsWith('wlan')) {
          type = 'wifi';
          network = 'guest';
          description = 'Guest WiFi';
        } else if (name === 'tailscale0' || name.startsWith('tailscale')) {
          type = 'other';
          network = 'unknown';
          description = 'Tailscale VPN';
        } else if (name === 'docker0' || name.startsWith('docker') || name.startsWith('br-')) {
          type = 'other';
          network = 'unknown';
          description = 'Docker Bridge';
        } else if (name.startsWith('veth')) {
          type = 'other';
          network = 'unknown';
          description = 'Docker Container';
        }

        interfaces.push({ name, ip, status, type, network, description });
      }

      return interfaces;
    } catch (error) {
      console.error('Failed to get network interfaces:', error);
      return [];
    }
  }

  /**
   * Get PM2 process logs (last N lines)
   */
  async getProcessLogs(processName: string, lines: number = 100): Promise<ScriptResult> {
    // Validate process name to prevent injection
    const validProcesses = ['signhouse-backend', 'signhouse-backend-dev', 'signhouse-frontend-dev'];
    if (!validProcesses.includes(processName)) {
      return { success: false, output: '', error: 'Invalid process name' };
    }

    try {
      const { stdout } = await execAsync(`pm2 logs ${processName} --lines ${lines} --nostream`, {
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  /**
   * Restart frontend dev server (Vite via PM2)
   */
  async restartFrontendDev(): Promise<ScriptResult> {
    return this.executePM2Command('pm2 restart signhouse-frontend-dev');
  }
}

export const serverManagementService = new ServerManagementService();
