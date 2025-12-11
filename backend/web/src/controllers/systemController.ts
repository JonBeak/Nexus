import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
  isComplete?: boolean;
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
 * Check if a gzipped backup file is complete by looking for "Dump completed" marker
 */
function checkBackupIntegrity(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    // Use zcat to read last 500 bytes of the gzipped file and check for completion marker
    // This is efficient as we don't need to decompress the entire file
    const result = execSync(
      `zcat "${filePath}" 2>/dev/null | tail -c 500 | grep -q "Dump completed"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch (error) {
    // grep returns exit code 1 if not found, which throws an error
    return false;
  }
}

/**
 * Get info about local backup files in a directory
 */
function getLocalBackupInfo(dirPath: string): { count: number; latest: string | null; size: string | null; isComplete: boolean } {
  try {
    if (!fs.existsSync(dirPath)) {
      return { count: 0, latest: null, size: null, isComplete: false };
    }

    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.sql.gz'))
      .map(f => ({
        name: f,
        stat: fs.statSync(path.join(dirPath, f))
      }))
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    if (files.length === 0) {
      return { count: 0, latest: null, size: null, isComplete: false };
    }

    const latest = files[0];
    const sizeKB = Math.round(latest.stat.size / 1024);
    const latestPath = path.join(dirPath, latest.name);
    const isComplete = checkBackupIntegrity(latestPath);

    return {
      count: files.length,
      latest: latest.name,
      size: `${sizeKB}K`,
      isComplete
    };
  } catch (error) {
    return { count: 0, latest: null, size: null, isComplete: false };
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

    // Determine status - truncated backup is an error regardless of timing
    let gdriveStatus = getHealthStatus(gdriveResult.lastTime, 26);
    let gdriveMessage = gdriveResult.lastMessage;

    if (localDbInfo.latest && !localDbInfo.isComplete) {
      gdriveStatus = 'error';
      gdriveMessage = 'Latest backup is TRUNCATED (missing "Dump completed" marker)';
    }

    backups.push({
      name: 'Google Drive',
      schedule: 'Daily at 2:00 AM',
      lastBackup: formatRelativeTime(gdriveResult.lastTime),
      lastBackupTime: gdriveResult.lastTime,
      status: gdriveStatus,
      message: gdriveMessage,
      fileCount: localDbInfo.count,
      latestFile: localDbInfo.latest || undefined,
      latestSize: localDbInfo.size || undefined,
      isComplete: localDbInfo.isComplete
    });

    // 2. Local Database Backup (same as gdrive but shows local file info)
    let localStatus: 'healthy' | 'warning' | 'error' =
      localDbInfo.count >= 5 ? 'healthy' : localDbInfo.count >= 3 ? 'warning' : 'error';
    let localMessage = `${localDbInfo.count} local backups stored`;

    if (localDbInfo.latest && !localDbInfo.isComplete) {
      localStatus = 'error';
      localMessage = 'Latest backup is TRUNCATED';
    }

    backups.push({
      name: 'Local Database',
      schedule: 'Daily at 2:00 AM (7 kept)',
      lastBackup: formatRelativeTime(gdriveResult.lastTime),
      lastBackupTime: gdriveResult.lastTime,
      status: localStatus,
      message: localMessage,
      fileCount: localDbInfo.count,
      latestFile: localDbInfo.latest || undefined,
      latestSize: localDbInfo.size || undefined,
      isComplete: localDbInfo.isComplete
    });

    // 3. Check cron job status
    let cronStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    let cronMessage = 'Cron jobs configured';

    try {
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
