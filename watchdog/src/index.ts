/**
 * SignHouse Watchdog Service
 * Created: Jan 14, 2026
 * Enhanced: Jan 30, 2026 - Added server management features
 *
 * Lightweight service for remote restarts via Basic Auth.
 * No database dependency - just PM2 commands and filesystem operations.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import auth from 'basic-auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = Number(process.env.PORT) || 3099;

// Credentials from environment
const WATCHDOG_USER = process.env.WATCHDOG_USER || 'admin';
const WATCHDOG_PASS = process.env.WATCHDOG_PASS;

if (!WATCHDOG_PASS) {
  console.error('ERROR: WATCHDOG_PASS environment variable is required');
  process.exit(1);
}

// OS Detection
const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = !IS_WINDOWS;

// Path Configuration
const NEXUS_ROOT = IS_WINDOWS
  ? (process.env.NEXUS_ROOT || 'C:/Users/13433/Nexus')
  : '/home/jon/Nexus';
const SCRIPTS_DIR = path.join(NEXUS_ROOT, 'infrastructure', 'scripts');
const BACKUPS_DIR = path.join(NEXUS_ROOT, 'infrastructure', 'backups');
const BACKEND_BUILD_DIR = path.join(NEXUS_ROOT, 'backend', 'web');
const FRONTEND_BUILD_DIR = path.join(NEXUS_ROOT, 'frontend', 'web');

// Middleware
app.use(cors());
app.use(express.json());

// Basic Auth middleware (skip for /health)
const basicAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    return next();
  }

  const credentials = auth(req);

  if (!credentials || credentials.name !== WATCHDOG_USER || credentials.pass !== WATCHDOG_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Watchdog"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

app.use(basicAuth);

// ==================== Helper Functions ====================

interface ScriptResult {
  success: boolean;
  output: string;
  error?: string;
}

interface BuildTimestamp {
  directory: string;
  lastModified: string | null;
  exists: boolean;
}

interface BackupFile {
  filename: string;
  date: string;
  size: string;
  sizeBytes: number;
  commitHash: string | null;
  type: 'backend' | 'frontend';
  buildType: 'production' | 'dev';
}

interface DatabaseBackup {
  filename: string;
  date: string;
  size: string;
  sizeBytes: number;
}

interface ActivePort {
  port: number;
  protocol: string;
  process: string;
  pid: number;
  isManagedByPM2: boolean;
}

interface DedicatedPort {
  port: number;
  name: string;
  description: string;
  expectedProcess: string;
  status: 'running' | 'missing' | 'wrong-process';
  actualProcess?: string;
  actualPid?: number;
}

interface SystemPort {
  port: number;
  name: string;
  description: string;
  status: 'running' | 'stopped';
}

interface RogueProcess {
  pid: number;
  port: number | null;
  command: string;
  user: string;
}

interface NetworkInterface {
  name: string;
  ip: string | null;
  status: 'up' | 'down';
  type: 'ethernet' | 'wifi' | 'other';
  network: 'main' | 'guest' | 'unknown';
  description?: string;
}

interface PM2ProcessStatus {
  name: string;
  status: string;
  memory: number;
  cpu: number;
  uptime: number;
  restarts: number;
  pid: number;
}

// Helper to run PM2 commands
async function runPM2Command(command: string): Promise<ScriptResult> {
  try {
    const actualCommand = IS_WINDOWS ? command.replace(/^pm2/, 'npx pm2') : command;
    const { stdout, stderr } = await execAsync(actualCommand, { timeout: 30000 });
    return { success: true, output: stdout + (stderr ? `\n${stderr}` : '') };
  } catch (error: any) {
    return { success: false, output: error.stdout || '', error: error.message };
  }
}

// Helper to run build scripts (longer timeout)
async function runBuildScript(script: string, timeout: number = 120000): Promise<ScriptResult> {
  try {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    if (!fs.existsSync(scriptPath)) {
      return { success: false, output: '', error: `Script not found: ${script}` };
    }
    const { stdout, stderr } = await execAsync(scriptPath, { timeout, maxBuffer: 1024 * 1024 });
    return { success: true, output: stdout + (stderr ? `\n${stderr}` : '') };
  } catch (error: any) {
    return { success: false, output: error.stdout || '', error: error.message };
  }
}

// Get PM2 status
async function getPM2Status(): Promise<PM2ProcessStatus[]> {
  try {
    const pm2Command = IS_WINDOWS ? 'npx pm2 jlist' : 'pm2 jlist';
    const { stdout } = await execAsync(pm2Command, { timeout: 15000 });
    const processes = JSON.parse(stdout);

    return processes.map((p: any) => ({
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      memory: p.monit?.memory || 0,
      cpu: p.monit?.cpu || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0,
      pid: p.pid || 0
    }));
  } catch (error) {
    console.error('Failed to get PM2 status:', error);
    return [];
  }
}

// Get build timestamps
async function getBuildTimestamps(): Promise<{ [key: string]: BuildTimestamp }> {
  const getTimestamp = (dirPath: string): BuildTimestamp => {
    try {
      if (!fs.existsSync(dirPath)) {
        return { directory: dirPath, lastModified: null, exists: false };
      }
      const stats = fs.statSync(dirPath);
      return { directory: dirPath, lastModified: stats.mtime.toISOString(), exists: true };
    } catch {
      return { directory: dirPath, lastModified: null, exists: false };
    }
  };

  return {
    backendProduction: getTimestamp(path.join(BACKEND_BUILD_DIR, 'dist-production')),
    backendDev: getTimestamp(path.join(BACKEND_BUILD_DIR, 'dist-dev')),
    frontendProduction: getTimestamp(path.join(FRONTEND_BUILD_DIR, 'dist-production')),
    frontendDev: getTimestamp(path.join(FRONTEND_BUILD_DIR, 'dist-dev'))
  };
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// List backup files
function listBackups(): { backend: BackupFile[]; frontend: BackupFile[]; database: DatabaseBackup[] } {
  const parseBackupFiles = (dirPath: string, type: 'backend' | 'frontend'): BackupFile[] => {
    try {
      if (!fs.existsSync(dirPath)) return [];

      return fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.tar.gz'))
        .map(filename => {
          const filePath = path.join(dirPath, filename);
          const stats = fs.statSync(filePath);
          const match = filename.match(/dist-(production|dev)-(\d{8})-(\d{6})-commit-([a-f0-9]+)\.tar\.gz/);

          return {
            filename,
            date: stats.mtime.toISOString(),
            size: formatSize(stats.size),
            sizeBytes: stats.size,
            commitHash: match ? match[4] : null,
            type,
            buildType: (match ? match[1] : 'production') as 'production' | 'dev'
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  };

  const parseDatabaseBackups = (dirPath: string): DatabaseBackup[] => {
    try {
      if (!fs.existsSync(dirPath)) return [];

      return fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
        .map(filename => {
          const filePath = path.join(dirPath, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            date: stats.mtime.toISOString(),
            size: formatSize(stats.size),
            sizeBytes: stats.size
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  };

  return {
    backend: parseBackupFiles(path.join(BACKUPS_DIR, 'backend-builds'), 'backend'),
    frontend: parseBackupFiles(path.join(BACKUPS_DIR, 'frontend-builds'), 'frontend'),
    database: parseDatabaseBackups(path.join(BACKUPS_DIR, 'database'))
  };
}

// Validate backup filename
function validateBackupFilename(filename: string): { valid: boolean; error?: string; type?: 'backend' | 'frontend' } {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename: path traversal not allowed' };
  }
  if (!filename.endsWith('.tar.gz')) {
    return { valid: false, error: 'Invalid filename: must be a .tar.gz file' };
  }

  const backendPath = path.join(BACKUPS_DIR, 'backend-builds', filename);
  const frontendPath = path.join(BACKUPS_DIR, 'frontend-builds', filename);

  if (fs.existsSync(backendPath)) return { valid: true, type: 'backend' };
  if (fs.existsSync(frontendPath)) return { valid: true, type: 'frontend' };
  return { valid: false, error: 'Backup file not found' };
}

// Get active ports (Linux only)
async function getActivePorts(): Promise<{ dedicatedPorts: DedicatedPort[]; systemPorts: SystemPort[]; unexpectedPorts: ActivePort[] }> {
  if (!IS_LINUX) return { dedicatedPorts: [], systemPorts: [], unexpectedPorts: [] };

  const DEDICATED_PORTS = [
    { port: 80, name: 'Frontend Prod', description: 'Nginx HTTP', expectedProcesses: ['nginx', ''] },
    { port: 443, name: 'Frontend Prod', description: 'Nginx HTTPS', expectedProcesses: ['nginx', ''] },
    { port: 3001, name: 'Backend Prod', description: 'Production API server', expectedProcesses: ['node'] },
    { port: 3002, name: 'Backend Dev', description: 'Development API server', expectedProcesses: ['node'] },
    { port: 5173, name: 'Frontend Dev', description: 'Vite dev server', expectedProcesses: ['node'] },
    { port: 3099, name: 'Watchdog', description: 'Remote restart service', expectedProcesses: ['node', 'PM2'] },
    { port: 3306, name: 'MySQL', description: 'Database server', expectedProcesses: ['mysqld', ''] },
    { port: 4040, name: 'Ngrok: NexusLite', description: 'Ngrok tunnel dashboard', expectedProcesses: ['ngrok'] },
    { port: 8000, name: 'NexusLite', description: 'NexusLite Python backend', expectedProcesses: ['python'] },
    { port: 8080, name: 'Calendar HTML', description: 'Static calendar webpage', expectedProcesses: ['python3', 'python'] },
    { port: 139, name: 'SMB', description: 'File sharing (NetBIOS)', expectedProcesses: ['smbd', ''] },
    { port: 445, name: 'SMB', description: 'File sharing (Direct)', expectedProcesses: ['smbd', ''] },
    { port: 631, name: 'CUPS', description: 'Print server', expectedProcesses: ['cupsd', ''] },
  ];

  const SYSTEM_PORTS = [
    { port: 22, name: 'SSH', description: 'Remote access' },
    { port: 25, name: 'SMTP', description: 'Mail server' },
    { port: 53, name: 'DNS', description: 'Name resolution' },
    { port: 5432, name: 'PostgreSQL', description: 'Database server' },
    { port: 33060, name: 'MySQL X', description: 'MySQL extended protocol' },
  ];

  try {
    const pm2Processes = await getPM2Status();
    const pm2Pids = new Set(pm2Processes.map(p => p.pid));

    const { stdout } = await execAsync('ss -tlnp', { timeout: 5000 });
    const lines = stdout.split('\n').slice(1);

    const activePortMap = new Map<number, { process: string; pid: number }>();
    for (const line of lines) {
      if (!line.trim()) continue;

      const matchWithProcess = line.match(/LISTEN\s+\d+\s+\d+\s+[\d.*:\[\]]+:(\d+)\s+.*users:\(\("([^"]+)",pid=(\d+)/);
      if (matchWithProcess) {
        activePortMap.set(parseInt(matchWithProcess[1]), { process: matchWithProcess[2], pid: parseInt(matchWithProcess[3]) });
      } else {
        const matchNoProcess = line.match(/LISTEN\s+\d+\s+\d+\s+[\d.*:\[\]]+:(\d+)\s+/);
        if (matchNoProcess && !line.includes('users:')) {
          const port = parseInt(matchNoProcess[1]);
          if (!activePortMap.has(port)) {
            activePortMap.set(port, { process: '', pid: 0 });
          }
        }
      }
    }

    const dedicatedPorts: DedicatedPort[] = DEDICATED_PORTS.map(dp => {
      const active = activePortMap.get(dp.port);
      if (!active) {
        return { ...dp, expectedProcess: dp.expectedProcesses[0], status: 'missing' as const };
      }
      const processMatches = dp.expectedProcesses.some(exp =>
        exp === '' ? !active.process : active.process.toLowerCase().startsWith(exp.toLowerCase())
      );
      if (!processMatches) {
        return { ...dp, expectedProcess: dp.expectedProcesses[0], status: 'wrong-process' as const, actualProcess: active.process, actualPid: active.pid };
      }
      return { ...dp, expectedProcess: dp.expectedProcesses[0], status: 'running' as const, actualProcess: active.process || '(root)', actualPid: active.pid };
    });

    const systemPortNumbers = new Set(SYSTEM_PORTS.map(sp => sp.port));
    const systemPorts: SystemPort[] = SYSTEM_PORTS.map(sp => ({
      ...sp,
      status: activePortMap.has(sp.port) ? 'running' as const : 'stopped' as const
    }));

    const dedicatedPortNumbers = new Set(DEDICATED_PORTS.map(dp => dp.port));
    const unexpectedPorts: ActivePort[] = [];
    for (const [port, { process, pid }] of activePortMap) {
      if (!dedicatedPortNumbers.has(port) && !systemPortNumbers.has(port)) {
        unexpectedPorts.push({ port, protocol: 'tcp', process, pid, isManagedByPM2: pm2Pids.has(pid) });
      }
    }

    return { dedicatedPorts, systemPorts, unexpectedPorts: unexpectedPorts.sort((a, b) => a.port - b.port) };
  } catch (error) {
    console.error('Failed to get active ports:', error);
    return { dedicatedPorts: [], systemPorts: [], unexpectedPorts: [] };
  }
}

// Get rogue processes (Linux only)
async function getRogueProcesses(): Promise<RogueProcess[]> {
  if (!IS_LINUX) return [];

  try {
    const pm2Processes = await getPM2Status();
    const pm2Pids = new Set(pm2Processes.map(p => p.pid));

    // Get all descendant PIDs recursively
    const pm2AllPids = new Set<number>();
    const getDescendants = async (pid: number, depth: number = 0): Promise<void> => {
      if (depth > 5) return;
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

    const { stdout } = await execAsync('ps aux | grep -E "node|npm|vite|esbuild" | grep -v grep', { timeout: 5000 });
    const lines = stdout.split('\n').filter(l => l.trim());

    const portMap = new Map<number, number>();
    try {
      const { stdout: ssOut } = await execAsync('ss -tlnp', { timeout: 5000 });
      for (const line of ssOut.split('\n')) {
        const match = line.match(/:(\d+)\s+.*pid=(\d+)/);
        if (match) portMap.set(parseInt(match[2]), parseInt(match[1]));
      }
    } catch {}

    const rogueProcesses: RogueProcess[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 11) continue;

      const user = parts[0];
      const pid = parseInt(parts[1]);
      const command = parts.slice(10).join(' ');

      if (pm2AllPids.has(pid) || command.includes('pm2') || command.includes('PM2')) continue;

      rogueProcesses.push({ pid, port: portMap.get(pid) || null, command: command.substring(0, 100), user });
    }

    return rogueProcesses;
  } catch {
    return [];
  }
}

// Kill a process (Linux only, with safety checks)
async function killProcess(pid: number): Promise<ScriptResult> {
  if (!IS_LINUX) {
    return { success: false, output: '', error: 'Kill process not available on Windows' };
  }

  const pm2Processes = await getPM2Status();
  const pm2Pids = new Set(pm2Processes.map(p => p.pid));

  if (pm2Pids.has(pid)) {
    return { success: false, output: '', error: 'Cannot kill PM2 managed process. Use restart instead.' };
  }

  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o comm=`, { timeout: 5000 });
    const processName = stdout.trim().toLowerCase();

    if (!['node', 'npm', 'vite', 'sh', 'bash', 'esbuild'].includes(processName)) {
      return { success: false, output: '', error: `Cannot kill process type: ${processName}` };
    }

    await execAsync(`kill ${pid}`, { timeout: 5000 });
    return { success: true, output: `Killed process ${pid}` };
  } catch (error: any) {
    return { success: false, output: '', error: error.message };
  }
}

// Get network interfaces (Linux only)
async function getNetworkInterfaces(): Promise<NetworkInterface[]> {
  if (!IS_LINUX) return [];

  try {
    const { stdout } = await execAsync('ip addr show', { timeout: 5000 });
    const interfaces: NetworkInterface[] = [];
    const blocks = stdout.split(/^\d+: /m).filter(b => b.trim());

    for (const block of blocks) {
      const nameMatch = block.match(/^(\w+):/);
      if (!nameMatch) continue;

      const name = nameMatch[1];
      if (name === 'lo') continue;

      const ipMatch = block.match(/inet (\d+\.\d+\.\d+\.\d+)/);
      const ip = ipMatch ? ipMatch[1] : null;
      const status = block.includes('state UP') ? 'up' : 'down';

      let type: 'ethernet' | 'wifi' | 'other' = 'other';
      let network: 'main' | 'guest' | 'unknown' = 'unknown';
      let description = '';

      if (name.startsWith('enp') || name.startsWith('eth')) {
        type = 'ethernet'; network = 'main'; description = 'Main Network';
      } else if (name.startsWith('wlp') || name.startsWith('wlan')) {
        type = 'wifi'; network = 'guest'; description = 'Guest WiFi';
      } else if (name === 'tailscale0' || name.startsWith('tailscale')) {
        description = 'Tailscale VPN';
      } else if (name === 'docker0' || name.startsWith('docker') || name.startsWith('br-')) {
        description = 'Docker Bridge';
      } else if (name.startsWith('veth')) {
        description = 'Docker Container';
      }

      interfaces.push({ name, ip, status, type, network, description });
    }

    return interfaces;
  } catch {
    return [];
  }
}

// Get PM2 logs
async function getProcessLogs(processName: string, lines: number = 100): Promise<ScriptResult> {
  const validProcesses = ['signhouse-backend', 'signhouse-backend-dev', 'signhouse-frontend-dev', 'watchdog'];
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

// ==================== Routes ====================

/**
 * GET /
 * Landing page with enhanced UI
 */
app.get('/', (req: Request, res: Response) => {
  res.send(generateHTML());
});

/**
 * GET /health
 * Health check - no auth required
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'signhouse-watchdog',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /status
 * Get PM2 process status
 */
app.get('/status', async (req: Request, res: Response) => {
  try {
    const processes = await getPM2Status();
    res.json({ success: true, processes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /build-timestamps
 * Get build directory timestamps
 */
app.get('/build-timestamps', async (req: Request, res: Response) => {
  try {
    const timestamps = await getBuildTimestamps();
    res.json({ success: true, timestamps });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /backups
 * List all backup files
 */
app.get('/backups', (req: Request, res: Response) => {
  try {
    const backups = listBackups();
    res.json({ success: true, ...backups });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /backup/create
 * Create build backups
 */
app.post('/backup/create', async (req: Request, res: Response) => {
  console.log('Watchdog: Creating build backup');
  const result = await runBuildScript('backup-builds.sh');
  res.json(result);
});

/**
 * POST /backup/database
 * Create database backup
 */
app.post('/backup/database', async (req: Request, res: Response) => {
  console.log('Watchdog: Creating database backup');
  const result = await runBuildScript('backup-db-to-gdrive.sh', 180000);
  res.json(result);
});

/**
 * POST /backup/cleanup
 * Cleanup old backups
 */
app.post('/backup/cleanup', async (req: Request, res: Response) => {
  console.log('Watchdog: Cleaning up backups');
  const result = await runBuildScript('cleanup-backups.sh');
  res.json(result);
});

/**
 * POST /backup/restore/:filename
 * Restore a backup
 */
app.post('/backup/restore/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  console.log(`Watchdog: Restoring backup ${filename}`);

  const validation = validateBackupFilename(filename);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  try {
    const scriptPath = path.join(SCRIPTS_DIR, 'restore-backup.sh');
    const { stdout, stderr } = await execAsync(`echo "y" | ${scriptPath} ${filename}`, {
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      cwd: SCRIPTS_DIR
    });
    res.json({ success: true, output: stdout + (stderr ? `\n${stderr}` : '') });
  } catch (error: any) {
    res.json({ success: false, output: error.stdout || '', error: error.message });
  }
});

/**
 * GET /ports
 * Get active ports (Linux only)
 */
app.get('/ports', async (req: Request, res: Response) => {
  try {
    const ports = await getActivePorts();
    res.json({ success: true, ...ports, isLinux: IS_LINUX });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /rogue-processes
 * Get rogue processes (Linux only)
 */
app.get('/rogue-processes', async (req: Request, res: Response) => {
  try {
    const processes = await getRogueProcesses();
    res.json({ success: true, processes, isLinux: IS_LINUX });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /kill/:pid
 * Kill a process (Linux only)
 */
app.post('/kill/:pid', async (req: Request, res: Response) => {
  const pid = parseInt(req.params.pid);
  if (isNaN(pid)) {
    return res.status(400).json({ success: false, error: 'Invalid PID' });
  }

  console.log(`Watchdog: Killing process ${pid}`);
  const result = await killProcess(pid);
  res.json(result);
});

/**
 * GET /network
 * Get network interfaces (Linux only)
 */
app.get('/network', async (req: Request, res: Response) => {
  try {
    const interfaces = await getNetworkInterfaces();
    res.json({ success: true, interfaces, isLinux: IS_LINUX });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /logs/:process
 * Get PM2 logs
 */
app.get('/logs/:process', async (req: Request, res: Response) => {
  const { process: processName } = req.params;
  const lines = parseInt(req.query.lines as string) || 100;

  const result = await getProcessLogs(processName, lines);
  res.json(result);
});

// Restart endpoints
app.post('/restart/backend-prod', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting backend-prod');
  const result = await runPM2Command('pm2 restart signhouse-backend');
  res.json(result);
});

app.post('/restart/backend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting backend-dev');
  const result = await runPM2Command('pm2 restart signhouse-backend-dev');
  res.json(result);
});

app.post('/restart/frontend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting frontend-dev');
  const result = await runPM2Command('pm2 restart signhouse-frontend-dev');
  res.json(result);
});

app.post('/restart/all', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting all processes');
  const result = await runPM2Command('pm2 restart all');
  res.json(result);
});

// Rebuild endpoints
app.post('/rebuild/backend-prod', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding backend-prod');
  const result = await runBuildScript('backend-rebuild-production.sh');
  res.json(result);
});

app.post('/rebuild/backend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding backend-dev');
  const result = await runBuildScript('backend-rebuild-dev.sh');
  res.json(result);
});

app.post('/rebuild/frontend-prod', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding frontend-prod');
  const result = await runBuildScript('frontend-rebuild-production.sh');
  res.json(result);
});

app.post('/rebuild/frontend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding frontend-dev');
  const result = await runBuildScript('frontend-rebuild-dev.sh');
  res.json(result);
});

// ==================== HTML Template ====================

function generateHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Watchdog - SignHouse</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e; color: #eee; min-height: 100vh; padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 8px; font-size: 1.8rem; }
    .subtitle { text-align: center; color: #888; margin-bottom: 16px; }

    /* Header controls */
    .header-controls {
      display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
    }

    /* Tabs */
    .tabs {
      display: flex; gap: 4px; margin-bottom: 20px; background: #16213e;
      padding: 4px; border-radius: 8px; overflow-x: auto;
    }
    .tab {
      padding: 10px 20px; border: none; background: transparent; color: #9ca3af;
      font-size: 0.95rem; font-weight: 500; cursor: pointer; border-radius: 6px;
      transition: all 0.2s; white-space: nowrap;
    }
    .tab:hover { background: #1f2937; color: #e5e7eb; }
    .tab.active { background: #374151; color: white; }

    /* Tab content */
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Status grid */
    .status-grid { display: grid; gap: 12px; margin-bottom: 24px; }
    .status-card {
      background: #16213e; border-radius: 8px; padding: 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .status-info { display: flex; flex-direction: column; gap: 4px; }
    .status-name { font-weight: 600; }
    .status-meta { font-size: 0.8rem; color: #6b7280; }
    .status-badge {
      padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;
    }
    .status-online { background: #064e3b; color: #34d399; }
    .status-offline { background: #7f1d1d; color: #f87171; }
    .status-unknown { background: #374151; color: #9ca3af; }

    /* Action groups */
    .action-group { background: #16213e; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .action-group h3 { margin-bottom: 12px; font-size: 1rem; color: #9ca3af; }

    /* Build matrix */
    .build-matrix {
      display: grid; grid-template-columns: 100px repeat(2, 1fr) repeat(2, 1fr);
      gap: 8px; align-items: center;
    }
    .matrix-header {
      text-align: center; font-weight: 600; font-size: 0.85rem; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 0;
    }
    .matrix-header.dev { color: #34d399; }
    .matrix-header.prod { color: #a78bfa; }
    .row-label {
      font-weight: 500; font-size: 0.9rem; color: #9ca3af;
    }
    .timestamp {
      font-size: 0.75rem; color: #6b7280; text-align: center; padding: 4px;
    }
    .timestamp.missing { color: #f87171; }

    /* Button grid for restart */
    .btn-grid-labels {
      display: grid; grid-template-columns: 100px 1fr 1fr; gap: 8px; margin-bottom: 8px;
    }
    .col-label {
      text-align: center; font-weight: 600; font-size: 0.85rem; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .btn-grid { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 8px; }

    /* Buttons */
    button {
      padding: 10px 16px; border: none; border-radius: 6px; font-size: 0.9rem;
      font-weight: 500; cursor: pointer; transition: all 0.2s;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-prod { background: #7c3aed; color: white; }
    .btn-prod:hover:not(:disabled) { background: #6d28d9; }
    .btn-dev { background: #059669; color: white; }
    .btn-dev:hover:not(:disabled) { background: #047857; }
    .btn-danger { background: #dc2626; color: white; }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .btn-secondary { background: #374151; color: #e5e7eb; }
    .btn-secondary:hover:not(:disabled) { background: #4b5563; }
    .btn-blue { background: #2563eb; color: white; }
    .btn-blue:hover:not(:disabled) { background: #1d4ed8; }
    .btn-full { width: 100%; margin-top: 12px; }
    .btn-disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }

    /* Backup tables */
    .backup-section { margin-top: 16px; }
    .backup-section h4 { color: #9ca3af; margin-bottom: 8px; font-size: 0.9rem; }
    .backup-table {
      width: 100%; border-collapse: collapse; font-size: 0.85rem;
    }
    .backup-table th {
      text-align: left; padding: 8px; background: #1f2937; color: #9ca3af;
      font-weight: 500; border-bottom: 1px solid #374151;
    }
    .backup-table td {
      padding: 8px; border-bottom: 1px solid #1f2937;
    }
    .backup-table tr:hover { background: #1f2937; }
    .backup-prod { border-left: 3px solid #7c3aed; }
    .backup-dev { border-left: 3px solid #059669; }
    .commit-hash { font-family: monospace; color: #60a5fa; }

    /* Ports panel */
    .port-grid { display: grid; gap: 8px; }
    .port-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #1f2937; border-radius: 6px;
    }
    .port-info { display: flex; align-items: center; gap: 12px; }
    .port-number {
      font-family: monospace; font-weight: 600; min-width: 50px;
      color: #60a5fa;
    }
    .port-name { font-weight: 500; }
    .port-desc { color: #6b7280; font-size: 0.85rem; }
    .port-status {
      padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500;
    }
    .port-running { background: #064e3b; color: #34d399; }
    .port-missing { background: #7f1d1d; color: #f87171; }
    .port-wrong { background: #78350f; color: #fbbf24; }

    /* Process list */
    .process-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #1f2937; border-radius: 6px; margin-bottom: 8px;
    }
    .process-info { flex: 1; }
    .process-command {
      font-family: monospace; font-size: 0.8rem; color: #9ca3af;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      max-width: 500px;
    }
    .process-meta { font-size: 0.75rem; color: #6b7280; margin-top: 4px; }

    /* Network interfaces */
    .interface-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #1f2937; border-radius: 6px; margin-bottom: 8px;
    }
    .interface-name { font-weight: 600; font-family: monospace; }
    .interface-ip { color: #60a5fa; font-family: monospace; }
    .interface-desc { color: #6b7280; font-size: 0.85rem; }
    .interface-up { color: #34d399; }
    .interface-down { color: #f87171; }

    /* Log viewer */
    .log-controls { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .log-viewer {
      background: #0f0f1a; border-radius: 8px; padding: 16px;
      font-family: monospace; font-size: 0.8rem; max-height: 400px;
      overflow-y: auto; white-space: pre-wrap; color: #9ca3af;
    }

    /* Output panel */
    .output {
      margin-top: 24px; background: #0f0f1a; border-radius: 8px; padding: 16px;
      font-family: monospace; font-size: 0.85rem; max-height: 300px; overflow-y: auto;
      display: none;
    }
    .output.show { display: block; }
    .output-header { color: #888; margin-bottom: 8px; }
    .output-content { color: #4ade80; white-space: pre-wrap; }
    .output-error { color: #f87171; }

    /* Collapsible sections */
    .collapsible-header {
      display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; padding: 12px 0;
    }
    .collapsible-header h3 { margin: 0; }
    .collapsible-content { display: none; padding-top: 12px; }
    .collapsible-content.show { display: block; }
    .collapse-icon { color: #6b7280; font-size: 1.2rem; }

    /* Loading spinner */
    .spinner {
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid #374151; border-top-color: #60a5fa;
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Empty state */
    .empty-state {
      text-align: center; padding: 24px; color: #6b7280;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .build-matrix { grid-template-columns: 80px repeat(4, 1fr); font-size: 0.8rem; }
      .btn-grid { grid-template-columns: 80px 1fr 1fr; }
      .btn-grid-labels { grid-template-columns: 80px 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Watchdog</h1>
    <p class="subtitle">SignHouse Server Management</p>

    <div class="header-controls">
      <button class="btn btn-secondary" onclick="refreshAll()">
        <span id="refreshIcon">↻</span> Refresh All
      </button>
      <span id="lastUpdated" style="color: #6b7280; font-size: 0.85rem; align-self: center;"></span>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="status">Status</button>
      <button class="tab" data-tab="builds">Builds</button>
      <button class="tab" data-tab="backups">Backups</button>
      <button class="tab" data-tab="linux" id="linuxTab">Linux Tools</button>
      <button class="tab" data-tab="logs">Logs</button>
    </div>

    <!-- Status Tab -->
    <div class="tab-content active" id="tab-status">
      <div class="status-grid" id="statusGrid">
        <div class="status-card">
          <span class="status-name">Loading...</span>
          <span class="status-badge status-unknown">...</span>
        </div>
      </div>

      <div class="action-group">
        <h3>Quick Restart</h3>
        <div class="btn-grid-labels">
          <div></div>
          <div class="col-label" style="color: #34d399;">Dev</div>
          <div class="col-label" style="color: #a78bfa;">Prod</div>
        </div>
        <div class="btn-grid">
          <span class="row-label">Backend</span>
          <button class="btn btn-dev" onclick="restart('backend-dev')">Restart</button>
          <button class="btn btn-prod" onclick="restart('backend-prod')">Restart</button>
          <span class="row-label">Frontend</span>
          <button class="btn btn-dev" onclick="restart('frontend-dev')">Restart</button>
          <button class="btn btn-disabled btn-prod" disabled title="Served by Nginx">N/A</button>
        </div>
        <button class="btn btn-danger btn-full" onclick="restart('all')">Restart All Services</button>
      </div>
    </div>

    <!-- Builds Tab -->
    <div class="tab-content" id="tab-builds">
      <div class="action-group">
        <h3>Build Operations</h3>
        <div class="build-matrix">
          <div></div>
          <div class="matrix-header dev">Dev Rebuild</div>
          <div class="matrix-header prod">Prod Rebuild</div>
          <div class="matrix-header dev">Dev Built</div>
          <div class="matrix-header prod">Prod Built</div>

          <span class="row-label">Backend</span>
          <button class="btn btn-dev" onclick="rebuild('backend-dev')">Rebuild</button>
          <button class="btn btn-prod" onclick="rebuild('backend-prod')">Rebuild</button>
          <div class="timestamp" id="ts-backendDev">-</div>
          <div class="timestamp" id="ts-backendProduction">-</div>

          <span class="row-label">Frontend</span>
          <button class="btn btn-dev" onclick="rebuild('frontend-dev')">Rebuild</button>
          <button class="btn btn-prod" onclick="rebuild('frontend-prod')">Rebuild</button>
          <div class="timestamp" id="ts-frontendDev">-</div>
          <div class="timestamp" id="ts-frontendProduction">-</div>
        </div>
      </div>
    </div>

    <!-- Backups Tab -->
    <div class="tab-content" id="tab-backups">
      <div class="action-group">
        <h3>Backup Operations</h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-blue" onclick="createBackup()">Create Build Backup</button>
          <button class="btn btn-blue" onclick="backupDatabase()">Backup Database</button>
          <button class="btn btn-secondary" onclick="cleanupBackups()">Cleanup Old Backups</button>
        </div>

        <div class="backup-section" id="backendBackups">
          <h4>Backend Backups</h4>
          <div class="empty-state">Loading...</div>
        </div>

        <div class="backup-section" id="frontendBackups">
          <h4>Frontend Backups</h4>
          <div class="empty-state">Loading...</div>
        </div>

        <div class="backup-section" id="databaseBackups">
          <h4>Database Backups</h4>
          <div class="empty-state">Loading...</div>
        </div>
      </div>
    </div>

    <!-- Linux Tools Tab -->
    <div class="tab-content" id="tab-linux">
      <div class="action-group">
        <div class="collapsible-header" onclick="toggleSection('ports')">
          <h3>Active Ports</h3>
          <span class="collapse-icon" id="ports-icon">▼</span>
        </div>
        <div class="collapsible-content show" id="ports-content">
          <div class="port-grid" id="portsGrid">
            <div class="empty-state">Loading...</div>
          </div>
        </div>
      </div>

      <div class="action-group">
        <div class="collapsible-header" onclick="toggleSection('rogue')">
          <h3>Rogue Processes</h3>
          <span class="collapse-icon" id="rogue-icon">▼</span>
        </div>
        <div class="collapsible-content show" id="rogue-content">
          <div id="rogueProcesses">
            <div class="empty-state">Loading...</div>
          </div>
        </div>
      </div>

      <div class="action-group">
        <div class="collapsible-header" onclick="toggleSection('network')">
          <h3>Network Interfaces</h3>
          <span class="collapse-icon" id="network-icon">▼</span>
        </div>
        <div class="collapsible-content show" id="network-content">
          <div id="networkInterfaces">
            <div class="empty-state">Loading...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Logs Tab -->
    <div class="tab-content" id="tab-logs">
      <div class="action-group">
        <h3>Log Viewer</h3>
        <div class="log-controls">
          <button class="btn btn-secondary" onclick="loadLogs('signhouse-backend')">Backend Prod</button>
          <button class="btn btn-secondary" onclick="loadLogs('signhouse-backend-dev')">Backend Dev</button>
          <button class="btn btn-secondary" onclick="loadLogs('signhouse-frontend-dev')">Frontend Dev</button>
          <button class="btn btn-secondary" onclick="loadLogs('watchdog')">Watchdog</button>
        </div>
        <div class="log-viewer" id="logViewer">Select a process to view logs...</div>
      </div>
    </div>

    <!-- Output Panel -->
    <div class="output" id="output">
      <div class="output-header" id="outputHeader"></div>
      <div class="output-content" id="outputContent"></div>
    </div>
  </div>

  <script>
    const basePath = window.location.pathname.replace(/\\/$/, '') || '';
    let isLinux = true;

    // Tab handling
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Toggle collapsible sections
    function toggleSection(name) {
      const content = document.getElementById(name + '-content');
      const icon = document.getElementById(name + '-icon');
      content.classList.toggle('show');
      icon.textContent = content.classList.contains('show') ? '▼' : '▶';
    }

    // Format bytes
    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Format date
    function formatDate(isoDate) {
      if (!isoDate) return '-';
      const d = new Date(isoDate);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    // Format uptime
    function formatUptime(ms) {
      if (!ms) return '-';
      const now = Date.now();
      const diff = now - ms;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h';
      return hours + 'h ' + mins + 'm';
    }

    // Show output panel
    function showOutput(header, content, isError = false) {
      const output = document.getElementById('output');
      const outputHeader = document.getElementById('outputHeader');
      const outputContent = document.getElementById('outputContent');

      output.classList.add('show');
      outputHeader.textContent = header;
      outputContent.textContent = content;
      outputContent.className = 'output-content' + (isError ? ' output-error' : '');
    }

    // Load PM2 status
    async function loadStatus() {
      try {
        const res = await fetch(basePath + '/status');
        const data = await res.json();

        const grid = document.getElementById('statusGrid');
        if (!data.processes || data.processes.length === 0) {
          grid.innerHTML = '<div class="empty-state">No processes found</div>';
          return;
        }

        grid.innerHTML = data.processes.map(p => \`
          <div class="status-card">
            <div class="status-info">
              <span class="status-name">\${p.name}</span>
              <span class="status-meta">
                Uptime: \${formatUptime(p.uptime)} |
                Memory: \${formatBytes(p.memory)} |
                Restarts: \${p.restarts}
              </span>
            </div>
            <span class="status-badge status-\${p.status === 'online' ? 'online' : 'offline'}">
              \${p.status}
            </span>
          </div>
        \`).join('');
      } catch (err) {
        console.error('Failed to load status:', err);
      }
    }

    // Load build timestamps
    async function loadBuildTimestamps() {
      try {
        const res = await fetch(basePath + '/build-timestamps');
        const data = await res.json();

        if (data.success && data.timestamps) {
          for (const [key, ts] of Object.entries(data.timestamps)) {
            const el = document.getElementById('ts-' + key);
            if (el) {
              if (ts.exists && ts.lastModified) {
                el.textContent = formatDate(ts.lastModified);
                el.classList.remove('missing');
              } else {
                el.textContent = 'Missing';
                el.classList.add('missing');
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load build timestamps:', err);
      }
    }

    // Load backups
    async function loadBackups() {
      try {
        const res = await fetch(basePath + '/backups');
        const data = await res.json();

        // Render backend backups
        renderBackupTable('backendBackups', data.backend, 'backend');
        renderBackupTable('frontendBackups', data.frontend, 'frontend');
        renderDatabaseBackups('databaseBackups', data.database);
      } catch (err) {
        console.error('Failed to load backups:', err);
      }
    }

    function renderBackupTable(containerId, backups, type) {
      const container = document.getElementById(containerId);
      if (!backups || backups.length === 0) {
        container.innerHTML = '<h4>' + (type === 'backend' ? 'Backend' : 'Frontend') + ' Backups</h4><div class="empty-state">No backups found</div>';
        return;
      }

      container.innerHTML = \`
        <h4>\${type === 'backend' ? 'Backend' : 'Frontend'} Backups (\${backups.length})</h4>
        <table class="backup-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Date</th>
              <th>Size</th>
              <th>Commit</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            \${backups.slice(0, 10).map(b => \`
              <tr class="backup-\${b.buildType}">
                <td>\${b.buildType}</td>
                <td>\${formatDate(b.date)}</td>
                <td>\${b.size}</td>
                <td class="commit-hash">\${b.commitHash ? b.commitHash.substring(0, 7) : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="restoreBackup('\${b.filename}')">Restore</button>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
        \${backups.length > 10 ? '<div style="color: #6b7280; font-size: 0.8rem; margin-top: 8px;">Showing 10 of ' + backups.length + ' backups</div>' : ''}
      \`;
    }

    function renderDatabaseBackups(containerId, backups) {
      const container = document.getElementById(containerId);
      if (!backups || backups.length === 0) {
        container.innerHTML = '<h4>Database Backups</h4><div class="empty-state">No database backups found</div>';
        return;
      }

      container.innerHTML = \`
        <h4>Database Backups (\${backups.length})</h4>
        <table class="backup-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Date</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            \${backups.slice(0, 5).map(b => \`
              <tr>
                <td>\${b.filename}</td>
                <td>\${formatDate(b.date)}</td>
                <td>\${b.size}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;
    }

    // Load ports
    async function loadPorts() {
      try {
        const res = await fetch(basePath + '/ports');
        const data = await res.json();

        isLinux = data.isLinux;
        if (!isLinux) {
          document.getElementById('linuxTab').style.display = 'none';
          return;
        }

        const grid = document.getElementById('portsGrid');
        let html = '';

        // Dedicated ports
        if (data.dedicatedPorts && data.dedicatedPorts.length > 0) {
          html += data.dedicatedPorts.map(p => \`
            <div class="port-item">
              <div class="port-info">
                <span class="port-number">:\${p.port}</span>
                <div>
                  <div class="port-name">\${p.name}</div>
                  <div class="port-desc">\${p.description}</div>
                </div>
              </div>
              <span class="port-status port-\${p.status === 'running' ? 'running' : p.status === 'missing' ? 'missing' : 'wrong'}">
                \${p.status === 'running' ? 'Running' : p.status === 'missing' ? 'Missing' : 'Wrong Process'}
              </span>
            </div>
          \`).join('');
        }

        // Unexpected ports
        if (data.unexpectedPorts && data.unexpectedPorts.length > 0) {
          html += '<div style="margin-top: 16px; color: #fbbf24; font-weight: 500;">Unexpected Ports</div>';
          html += data.unexpectedPorts.map(p => \`
            <div class="port-item" style="border-left: 3px solid #f59e0b;">
              <div class="port-info">
                <span class="port-number">:\${p.port}</span>
                <div>
                  <div class="port-name">\${p.process || 'Unknown'}</div>
                  <div class="port-desc">PID: \${p.pid}</div>
                </div>
              </div>
            </div>
          \`).join('');
        }

        grid.innerHTML = html || '<div class="empty-state">No port data available</div>';
      } catch (err) {
        console.error('Failed to load ports:', err);
      }
    }

    // Load rogue processes
    async function loadRogueProcesses() {
      try {
        const res = await fetch(basePath + '/rogue-processes');
        const data = await res.json();

        const container = document.getElementById('rogueProcesses');
        if (!data.processes || data.processes.length === 0) {
          container.innerHTML = '<div class="empty-state">No rogue processes detected ✓</div>';
          return;
        }

        container.innerHTML = data.processes.map(p => \`
          <div class="process-item">
            <div class="process-info">
              <div class="process-command">\${p.command}</div>
              <div class="process-meta">PID: \${p.pid} | User: \${p.user}\${p.port ? ' | Port: ' + p.port : ''}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="killRogueProcess(\${p.pid})">Kill</button>
          </div>
        \`).join('');
      } catch (err) {
        console.error('Failed to load rogue processes:', err);
      }
    }

    // Load network interfaces
    async function loadNetworkInterfaces() {
      try {
        const res = await fetch(basePath + '/network');
        const data = await res.json();

        const container = document.getElementById('networkInterfaces');
        if (!data.interfaces || data.interfaces.length === 0) {
          container.innerHTML = '<div class="empty-state">No network interfaces found</div>';
          return;
        }

        container.innerHTML = data.interfaces.map(i => \`
          <div class="interface-item">
            <div>
              <span class="interface-name">\${i.name}</span>
              \${i.description ? '<span class="interface-desc"> - ' + i.description + '</span>' : ''}
            </div>
            <div>
              <span class="interface-ip">\${i.ip || 'No IP'}</span>
              <span class="interface-\${i.status}" style="margin-left: 8px;">\${i.status.toUpperCase()}</span>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        console.error('Failed to load network interfaces:', err);
      }
    }

    // Load logs
    async function loadLogs(processName) {
      const viewer = document.getElementById('logViewer');
      viewer.textContent = 'Loading logs for ' + processName + '...';

      try {
        const res = await fetch(basePath + '/logs/' + processName + '?lines=100');
        const data = await res.json();

        if (data.success) {
          viewer.textContent = data.output || 'No logs available';
        } else {
          viewer.textContent = 'Error: ' + (data.error || 'Failed to load logs');
        }
      } catch (err) {
        viewer.textContent = 'Error: ' + err.message;
      }
    }

    // Restart service
    async function restart(service) {
      disableButtons();
      showOutput('Restarting ' + service + '...', '');

      try {
        const res = await fetch(basePath + '/restart/' + service, { method: 'POST' });
        const data = await res.json();

        showOutput('Result: ' + service, data.output || data.error || 'Done', !data.success);
        setTimeout(loadStatus, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    // Rebuild
    async function rebuild(target) {
      disableButtons();
      showOutput('Rebuilding ' + target + '... (this may take a minute)', '');

      try {
        const res = await fetch(basePath + '/rebuild/' + target, { method: 'POST' });
        const data = await res.json();

        showOutput('Rebuild Result: ' + target, data.output || data.error || 'Done', !data.success);
        setTimeout(() => {
          loadStatus();
          loadBuildTimestamps();
        }, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    // Backup operations
    async function createBackup() {
      disableButtons();
      showOutput('Creating build backup...', '');

      try {
        const res = await fetch(basePath + '/backup/create', { method: 'POST' });
        const data = await res.json();

        showOutput('Backup Result', data.output || data.error || 'Done', !data.success);
        setTimeout(loadBackups, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    async function backupDatabase() {
      disableButtons();
      showOutput('Creating database backup... (this may take a few minutes)', '');

      try {
        const res = await fetch(basePath + '/backup/database', { method: 'POST' });
        const data = await res.json();

        showOutput('Database Backup Result', data.output || data.error || 'Done', !data.success);
        setTimeout(loadBackups, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    async function cleanupBackups() {
      disableButtons();
      showOutput('Cleaning up old backups...', '');

      try {
        const res = await fetch(basePath + '/backup/cleanup', { method: 'POST' });
        const data = await res.json();

        showOutput('Cleanup Result', data.output || data.error || 'Done', !data.success);
        setTimeout(loadBackups, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    async function restoreBackup(filename) {
      if (!confirm('Are you sure you want to restore backup: ' + filename + '?')) return;

      disableButtons();
      showOutput('Restoring backup: ' + filename + '...', '');

      try {
        const res = await fetch(basePath + '/backup/restore/' + filename, { method: 'POST' });
        const data = await res.json();

        showOutput('Restore Result', data.output || data.error || 'Done', !data.success);
        setTimeout(() => {
          loadStatus();
          loadBuildTimestamps();
        }, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    // Kill rogue process
    async function killRogueProcess(pid) {
      if (!confirm('Are you sure you want to kill process ' + pid + '?')) return;

      disableButtons();
      showOutput('Killing process ' + pid + '...', '');

      try {
        const res = await fetch(basePath + '/kill/' + pid, { method: 'POST' });
        const data = await res.json();

        showOutput('Kill Result', data.output || data.error || 'Done', !data.success);
        setTimeout(loadRogueProcesses, 1000);
      } catch (err) {
        showOutput('Error', err.message, true);
      } finally {
        enableButtons();
      }
    }

    // Button state management
    function disableButtons() {
      document.querySelectorAll('button').forEach(b => b.disabled = true);
    }

    function enableButtons() {
      document.querySelectorAll('button').forEach(b => {
        if (!b.classList.contains('btn-disabled')) b.disabled = false;
      });
    }

    // Refresh all
    async function refreshAll() {
      document.getElementById('refreshIcon').innerHTML = '<span class="spinner"></span>';

      await Promise.all([
        loadStatus(),
        loadBuildTimestamps(),
        loadBackups(),
        loadPorts(),
        loadRogueProcesses(),
        loadNetworkInterfaces()
      ]);

      document.getElementById('refreshIcon').textContent = '↻';
      document.getElementById('lastUpdated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }

    // Initial load
    refreshAll();
  </script>
</body>
</html>`;
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐕 Watchdog service running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   UI (auth required): http://localhost:${PORT}/`);
  console.log(`   Environment: ${IS_LINUX ? 'Linux' : 'Windows'}`);
});
