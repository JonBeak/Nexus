/**
 * SignHouse Watchdog Service
 * Created: Jan 14, 2026
 *
 * Lightweight service for remote restarts via Basic Auth.
 * No database dependency - just PM2 commands.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import auth from 'basic-auth';
import { exec } from 'child_process';
import { promisify } from 'util';
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

// Middleware
app.use(cors());
app.use(express.json());

// Basic Auth middleware (skip for /health)
const basicAuth = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for health check
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

// Helper to run PM2 commands
async function runPM2Command(command: string): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    return { success: true, output: stdout + (stderr ? `\n${stderr}` : '') };
  } catch (error: any) {
    return { success: false, output: error.stdout || '', error: error.message };
  }
}

// Helper to run build scripts (longer timeout)
const SCRIPTS_DIR = '/home/jon/Nexus/infrastructure/scripts';
async function runBuildScript(script: string): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(`${SCRIPTS_DIR}/${script}`, { timeout: 120000 });
    return { success: true, output: stdout + (stderr ? `\n${stderr}` : '') };
  } catch (error: any) {
    return { success: false, output: error.stdout || '', error: error.message };
  }
}

// ==================== Routes ====================

/**
 * GET /
 * Landing page with UI
 */
app.get('/', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
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
    .container { max-width: 600px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 8px; font-size: 1.8rem; }
    .subtitle { text-align: center; color: #888; margin-bottom: 24px; }
    .status-grid { display: grid; gap: 12px; margin-bottom: 24px; }
    .status-card {
      background: #16213e; border-radius: 8px; padding: 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .status-name { font-weight: 600; }
    .status-badge {
      padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;
    }
    .status-online { background: #064e3b; color: #34d399; }
    .status-offline { background: #7f1d1d; color: #f87171; }
    .status-unknown { background: #374151; color: #9ca3af; }
    .actions { display: grid; gap: 12px; }
    .action-group { background: #16213e; border-radius: 8px; padding: 16px; }
    .action-group h3 { margin-bottom: 12px; font-size: 1rem; color: #888; }
    .btn-grid-labels {
      display: grid; grid-template-columns: 70px 1fr 1fr; gap: 8px; margin-bottom: 8px;
    }
    .col-label {
      text-align: center; font-weight: 600; font-size: 0.85rem; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .btn-grid { display: grid; grid-template-columns: 70px 1fr 1fr; gap: 8px; }
    .row-label {
      display: flex; align-items: center; font-weight: 500; font-size: 0.9rem; color: #9ca3af;
    }
    button {
      padding: 12px 16px; border: none; border-radius: 6px; font-size: 0.95rem;
      font-weight: 500; cursor: pointer; transition: all 0.2s;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-prod { background: #7c3aed; color: white; }
    .btn-prod:hover:not(:disabled) { background: #6d28d9; }
    .btn-dev { background: #059669; color: white; }
    .btn-dev:hover:not(:disabled) { background: #047857; }
    .btn-danger { background: #dc2626; color: white; }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .btn-full { width: 100%; margin-top: 12px; }
    .btn-disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
    .output {
      margin-top: 24px; background: #0f0f1a; border-radius: 8px; padding: 16px;
      font-family: monospace; font-size: 0.85rem; max-height: 200px; overflow-y: auto;
      display: none;
    }
    .output.show { display: block; }
    .output-header { color: #888; margin-bottom: 8px; }
    .output-content { color: #4ade80; white-space: pre-wrap; }
    .output-error { color: #f87171; }
    .refresh-btn {
      background: #374151; color: #9ca3af; width: 100%; margin-bottom: 16px;
    }
    .refresh-btn:hover { background: #4b5563; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Watchdog</h1>
    <p class="subtitle">SignHouse Remote Management</p>

    <button class="btn refresh-btn" onclick="loadStatus()">Refresh Status</button>

    <div class="status-grid" id="statusGrid">
      <div class="status-card">
        <span class="status-name">Loading...</span>
        <span class="status-badge status-unknown">...</span>
      </div>
    </div>

    <div class="actions">
      <div class="action-group">
        <h3>Restart Services</h3>
        <div class="btn-grid-labels">
          <div></div>
          <div class="col-label">Dev</div>
          <div class="col-label">Prod</div>
        </div>
        <div class="btn-grid">
          <span class="row-label">Backend</span>
          <button class="btn btn-dev" onclick="restart('backend-dev')">Restart</button>
          <button class="btn btn-prod" onclick="restart('backend-prod')">Restart</button>
          <span class="row-label">Frontend</span>
          <button class="btn btn-dev" onclick="restart('frontend-dev')">Restart</button>
          <button class="btn btn-prod btn-disabled" disabled title="Served by Nginx">N/A</button>
        </div>
        <button class="btn btn-danger btn-full" onclick="restart('all')">Restart All Services</button>
      </div>

      <div class="action-group">
        <h3>Rebuild & Deploy</h3>
        <div class="btn-grid-labels">
          <div></div>
          <div class="col-label">Dev</div>
          <div class="col-label">Prod</div>
        </div>
        <div class="btn-grid">
          <span class="row-label">Backend</span>
          <button class="btn btn-dev" onclick="rebuild('backend-dev')">Rebuild</button>
          <button class="btn btn-prod" onclick="rebuild('backend-prod')">Rebuild</button>
          <span class="row-label">Frontend</span>
          <button class="btn btn-dev" onclick="rebuild('frontend-dev')">Rebuild</button>
          <button class="btn btn-prod" onclick="rebuild('frontend-prod')">Rebuild</button>
        </div>
      </div>
    </div>

    <div class="output" id="output">
      <div class="output-header" id="outputHeader"></div>
      <div class="output-content" id="outputContent"></div>
    </div>
  </div>

  <script>
    // Get base path (works both at / and /watchdog/)
    const basePath = window.location.pathname.replace(/\\/$/, '') || '';

    async function loadStatus() {
      try {
        const res = await fetch(basePath + '/status');
        const data = await res.json();

        const grid = document.getElementById('statusGrid');
        grid.innerHTML = data.processes.map(p => \`
          <div class="status-card">
            <span class="status-name">\${p.name}</span>
            <span class="status-badge status-\${p.status === 'online' ? 'online' : 'offline'}">
              \${p.status}
            </span>
          </div>
        \`).join('');
      } catch (err) {
        console.error('Failed to load status:', err);
      }
    }

    async function restart(service) {
      const btns = document.querySelectorAll('button');
      btns.forEach(b => b.disabled = true);

      const output = document.getElementById('output');
      const header = document.getElementById('outputHeader');
      const content = document.getElementById('outputContent');

      output.classList.add('show');
      header.textContent = 'Restarting ' + service + '...';
      content.textContent = '';
      content.className = 'output-content';

      try {
        const res = await fetch(basePath + '/restart/' + service, { method: 'POST' });
        const data = await res.json();

        header.textContent = 'Result: ' + service;
        content.textContent = data.output || data.error || 'Done';
        if (!data.success) content.classList.add('output-error');

        setTimeout(loadStatus, 1000);
      } catch (err) {
        header.textContent = 'Error';
        content.textContent = err.message;
        content.classList.add('output-error');
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    }

    async function rebuild(target) {
      const btns = document.querySelectorAll('button');
      btns.forEach(b => b.disabled = true);

      const output = document.getElementById('output');
      const header = document.getElementById('outputHeader');
      const content = document.getElementById('outputContent');

      output.classList.add('show');
      header.textContent = 'Rebuilding ' + target + '... (this may take a minute)';
      content.textContent = '';
      content.className = 'output-content';

      try {
        const res = await fetch(basePath + '/rebuild/' + target, { method: 'POST' });
        const data = await res.json();

        header.textContent = 'Rebuild Result: ' + target;
        content.textContent = data.output || data.error || 'Done';
        if (!data.success) content.classList.add('output-error');

        setTimeout(loadStatus, 1000);
      } catch (err) {
        header.textContent = 'Error';
        content.textContent = err.message;
        content.classList.add('output-error');
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    }

    loadStatus();
  </script>
</body>
</html>
  `);
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
    const { stdout } = await execAsync('pm2 jlist', { timeout: 15000 });
    const processes = JSON.parse(stdout);

    const status = processes.map((p: any) => ({
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      memory: p.monit?.memory || 0,
      cpu: p.monit?.cpu || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0
    }));

    res.json({ success: true, processes: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /restart/backend-prod
 * Restart production backend
 */
app.post('/restart/backend-prod', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting backend-prod');
  const result = await runPM2Command('pm2 restart signhouse-backend');
  res.json(result);
});

/**
 * POST /restart/backend-dev
 * Restart dev backend
 */
app.post('/restart/backend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting backend-dev');
  const result = await runPM2Command('pm2 restart signhouse-backend-dev');
  res.json(result);
});

/**
 * POST /restart/frontend-dev
 * Restart frontend dev (Vite)
 */
app.post('/restart/frontend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting frontend-dev');
  const result = await runPM2Command('pm2 restart signhouse-frontend-dev');
  res.json(result);
});

/**
 * POST /restart/all
 * Restart all PM2 processes
 */
app.post('/restart/all', async (req: Request, res: Response) => {
  console.log('Watchdog: Restarting all processes');
  const result = await runPM2Command('pm2 restart all');
  res.json(result);
});

// ==================== Rebuild Endpoints ====================

/**
 * POST /rebuild/backend-prod
 * Rebuild production backend
 */
app.post('/rebuild/backend-prod', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding backend-prod');
  const result = await runBuildScript('backend-rebuild-production.sh');
  res.json(result);
});

/**
 * POST /rebuild/backend-dev
 * Rebuild dev backend
 */
app.post('/rebuild/backend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding backend-dev');
  const result = await runBuildScript('backend-rebuild-dev.sh');
  res.json(result);
});

/**
 * POST /rebuild/frontend-prod
 * Rebuild production frontend
 */
app.post('/rebuild/frontend-prod', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding frontend-prod');
  const result = await runBuildScript('frontend-rebuild-production.sh');
  res.json(result);
});

/**
 * POST /rebuild/frontend-dev
 * Rebuild dev frontend
 */
app.post('/rebuild/frontend-dev', async (req: Request, res: Response) => {
  console.log('Watchdog: Rebuilding frontend-dev');
  const result = await runBuildScript('frontend-rebuild-dev.sh');
  res.json(result);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐕 Watchdog service running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Status (auth required): http://localhost:${PORT}/status`);
});
