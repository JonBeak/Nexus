module.exports = {
  apps: [
    {
      name: 'signhouse-backend',
      script: 'npm',
      args: 'run start:production',
      cwd: '/home/jon/Nexus/backend/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/home/jon/.pm2/logs/signhouse-backend-error.log',
      out_file: '/home/jon/.pm2/logs/signhouse-backend-out.log',
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
      cwd: '/home/jon/Nexus/backend/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      error_file: '/home/jon/.pm2/logs/signhouse-backend-dev-error.log',
      out_file: '/home/jon/.pm2/logs/signhouse-backend-dev-out.log',
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
