// Cross-platform PM2 configuration
const path = require('path');

const isWindows = process.platform === 'win32';

// Determine Nexus root directory
const NEXUS_ROOT = isWindows
  ? (process.env.NEXUS_ROOT || 'C:/Users/13433/Nexus')
  : '/home/jon/Nexus';

// PM2 logs directory
const PM2_LOGS = isWindows
  ? path.join(process.env.USERPROFILE || 'C:/Users/13433', '.pm2', 'logs')
  : '/home/jon/.pm2/logs';

const backendDir = path.join(NEXUS_ROOT, 'backend', 'web');

module.exports = {
  apps: [
    {
      name: 'signhouse-backend',
      script: 'npm',
      args: 'run start:production',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: path.join(PM2_LOGS, 'signhouse-backend-error.log'),
      out_file: path.join(PM2_LOGS, 'signhouse-backend-out.log'),
      merge_logs: false,
      watch: false,
      ignore_watch: ['node_modules', 'dist'],
      max_memory_restart: '500M',
      restart_delay: 4000,
      kill_timeout: 5000
    },
    {
      name: 'signhouse-backend-dev',
      script: 'npm',
      args: 'run start:dev',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      error_file: path.join(PM2_LOGS, 'signhouse-backend-dev-error.log'),
      out_file: path.join(PM2_LOGS, 'signhouse-backend-dev-out.log'),
      merge_logs: false,
      watch: false,
      ignore_watch: ['node_modules', 'dist'],
      max_memory_restart: '500M',
      restart_delay: 4000,
      kill_timeout: 5000,
      autorestart: false
    }
  ]
};
