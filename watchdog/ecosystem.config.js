module.exports = {
  apps: [{
    name: 'signhouse-watchdog',
    script: 'dist/index.js',
    cwd: '/home/jon/Nexus/watchdog',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    env: {
      NODE_ENV: 'production',
      PORT: 3099
    }
  }]
};
