import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

interface BackupInfo {
  name: string;
  schedule: string;
  lastBackup: string | null;
  lastBackupTime: Date | null;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  fileCount?: number;
  latestFile?: string;
  latestSize?: string;
}

interface BackupStatusResponse {
  success: boolean;
  data: {
    backups: BackupInfo[];
    serverTime: string;
  };
}

/**
 * Parse the backup log file to find the last successful backup
 */
function parseBackupLog(logPath: string): { lastTime: Date | null; lastMessage: string } {
  try {
    if (!fs.existsSync(logPath)) {
      return { lastTime: null, lastMessage: 'Log file not found' };
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Find the last "Backup complete!" line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('Backup complete!')) {
        // Parse timestamp from format: [2025-12-10 00:53:43]
        const match = lines[i].match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
        if (match) {
          return {
            lastTime: new Date(match[1].replace(' ', 'T')),
            lastMessage: 'Backup completed successfully'
          };
        }
      }
    }

    // Check for errors
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('ERROR')) {
        return { lastTime: null, lastMessage: lines[i] };
      }
    }

    return { lastTime: null, lastMessage: 'No completed backups found in log' };
  } catch (error) {
    return { lastTime: null, lastMessage: `Error reading log: ${error}` };
  }
}

/**
 * Get info about local backup files in a directory
 */
function getLocalBackupInfo(dirPath: string): { count: number; latest: string | null; size: string | null } {
  try {
    if (!fs.existsSync(dirPath)) {
      return { count: 0, latest: null, size: null };
    }

    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.sql.gz'))
      .map(f => ({
        name: f,
        stat: fs.statSync(path.join(dirPath, f))
      }))
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    if (files.length === 0) {
      return { count: 0, latest: null, size: null };
    }

    const latest = files[0];
    const sizeKB = Math.round(latest.stat.size / 1024);

    return {
      count: files.length,
      latest: latest.name,
      size: `${sizeKB}K`
    };
  } catch (error) {
    return { count: 0, latest: null, size: null };
  }
}

/**
 * Determine health status based on last backup time
 */
function getHealthStatus(lastTime: Date | null, maxAgeHours: number): 'healthy' | 'warning' | 'error' {
  if (!lastTime) return 'error';

  const now = new Date();
  const ageHours = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

  if (ageHours <= maxAgeHours) return 'healthy';
  if (ageHours <= maxAgeHours * 2) return 'warning';
  return 'error';
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

/**
 * GET /api/system/backup-status
 * Returns backup status information (owner only)
 */
export const getBackupStatus = async (req: Request, res: Response) => {
  try {
    const nexusDir = '/home/jon/Nexus';
    const backups: BackupInfo[] = [];

    // 1. Google Drive Database Backup
    const gdriveLogPath = path.join(nexusDir, 'infrastructure/logs/db-backup.log');
    const gdriveResult = parseBackupLog(gdriveLogPath);
    const localDbInfo = getLocalBackupInfo(path.join(nexusDir, 'infrastructure/backups/database'));

    backups.push({
      name: 'Google Drive',
      schedule: 'Daily at 2:00 AM',
      lastBackup: formatRelativeTime(gdriveResult.lastTime),
      lastBackupTime: gdriveResult.lastTime,
      status: getHealthStatus(gdriveResult.lastTime, 26), // Allow 26 hours for daily
      message: gdriveResult.lastMessage,
      fileCount: localDbInfo.count,
      latestFile: localDbInfo.latest || undefined,
      latestSize: localDbInfo.size || undefined
    });

    // 2. Local Database Backup (same as gdrive but shows local file info)
    backups.push({
      name: 'Local Database',
      schedule: 'Daily at 2:00 AM (7 kept)',
      lastBackup: formatRelativeTime(gdriveResult.lastTime),
      lastBackupTime: gdriveResult.lastTime,
      status: localDbInfo.count >= 5 ? 'healthy' : localDbInfo.count >= 3 ? 'warning' : 'error',
      message: `${localDbInfo.count} local backups stored`,
      fileCount: localDbInfo.count,
      latestFile: localDbInfo.latest || undefined,
      latestSize: localDbInfo.size || undefined
    });

    // 3. Check cron job status
    let cronStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    let cronMessage = 'Cron jobs configured';

    try {
      const { execSync } = require('child_process');
      const crontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
      const hasGdriveBackup = crontab.includes('backup-db-to-gdrive.sh');

      if (!hasGdriveBackup) {
        cronStatus = 'error';
        cronMessage = 'Google Drive backup cron not found';
      }
    } catch {
      cronStatus = 'warning';
      cronMessage = 'Could not verify cron jobs';
    }

    backups.push({
      name: 'Scheduled Jobs',
      schedule: 'System cron',
      lastBackup: null,
      lastBackupTime: null,
      status: cronStatus,
      message: cronMessage
    });

    const response: BackupStatusResponse = {
      success: true,
      data: {
        backups,
        serverTime: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting backup status:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get backup status'
    });
  }
};
