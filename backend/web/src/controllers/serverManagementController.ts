/**
 * Server Management Controller
 * Created: Dec 23, 2025
 *
 * HTTP handlers for server management operations.
 * All endpoints are owner-only, protected by middleware in routes.
 */

import { Request, Response } from 'express';
import { serverManagementService } from '../services/serverManagementService';

/**
 * GET /api/server-management/status
 * Get PM2 status and build timestamps
 */
export const getStatus = async (req: Request, res: Response) => {
  try {
    const status = await serverManagementService.getSystemStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error getting server status:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
};

/**
 * POST /api/server-management/backend/rebuild-dev
 * Rebuild backend dev build (detached - returns log file path for polling)
 */
export const rebuildBackendDev = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Rebuilding backend dev (detached)...');
    const result = await serverManagementService.rebuildBackendDev();
    res.json({
      success: result.success,
      data: { logFile: result.logFile, message: result.message },
      detached: true
    });
  } catch (error) {
    console.error('Error rebuilding backend dev:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Script execution failed'
    });
  }
};

/**
 * POST /api/server-management/backend/rebuild-prod
 * Rebuild backend production build (detached - returns log file path for polling)
 */
export const rebuildBackendProd = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Rebuilding backend production (detached)...');
    const result = await serverManagementService.rebuildBackendProd();
    res.json({
      success: result.success,
      data: { logFile: result.logFile, message: result.message },
      detached: true
    });
  } catch (error) {
    console.error('Error rebuilding backend prod:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Script execution failed'
    });
  }
};

/**
 * POST /api/server-management/backend/restart-dev
 * Restart backend dev PM2 process
 */
export const restartBackendDev = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Restarting backend dev...');
    const result = await serverManagementService.restartBackendDev();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error restarting backend dev:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'PM2 command failed'
    });
  }
};

/**
 * POST /api/server-management/backend/restart-prod
 * Restart backend production PM2 process
 */
export const restartBackendProd = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Restarting backend production...');
    const result = await serverManagementService.restartBackendProd();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error restarting backend prod:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'PM2 command failed'
    });
  }
};

/**
 * POST /api/server-management/frontend/rebuild-dev
 * Rebuild frontend dev build
 */
export const rebuildFrontendDev = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Rebuilding frontend dev...');
    const result = await serverManagementService.rebuildFrontendDev();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error rebuilding frontend dev:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Script execution failed'
    });
  }
};

/**
 * POST /api/server-management/frontend/rebuild-prod
 * Rebuild frontend production build
 */
export const rebuildFrontendProd = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Rebuilding frontend production...');
    const result = await serverManagementService.rebuildFrontendProd();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error rebuilding frontend prod:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Script execution failed'
    });
  }
};

/**
 * POST /api/server-management/rebuild-all-dev
 * Rebuild both backend and frontend dev builds (detached)
 */
export const rebuildAllDev = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Rebuilding all dev (detached)...');
    const result = await serverManagementService.rebuildAllDev();
    res.json({
      success: result.success,
      data: { logFile: result.logFile, message: result.message },
      detached: true
    });
  } catch (error) {
    console.error('Error rebuilding all dev:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Script execution failed'
    });
  }
};

/**
 * POST /api/server-management/rebuild-all-prod
 * Rebuild both backend and frontend production builds (detached)
 */
export const rebuildAllProd = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Rebuilding all production (detached)...');
    const result = await serverManagementService.rebuildAllProd();
    res.json({
      success: result.success,
      data: { logFile: result.logFile, message: result.message },
      detached: true
    });
  } catch (error) {
    console.error('Error rebuilding all prod:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Script execution failed'
    });
  }
};

/**
 * GET /api/server-management/backups
 * List all backup files
 */
export const listBackups = async (req: Request, res: Response) => {
  try {
    const backups = await serverManagementService.listBackups();
    res.json({ success: true, data: backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list backups'
    });
  }
};

/**
 * POST /api/server-management/backups/create
 * Create a new build backup
 */
export const createBackup = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Creating backup...');
    const result = await serverManagementService.createBackup();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Backup failed'
    });
  }
};

/**
 * POST /api/server-management/backups/database
 * Backup database to Google Drive
 */
export const backupDatabase = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Backing up database...');
    const result = await serverManagementService.backupDatabase();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error backing up database:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Database backup failed'
    });
  }
};

/**
 * POST /api/server-management/backups/restore
 * Restore a backup file
 */
export const restoreBackup = async (req: Request, res: Response) => {
  try {
    const { filename } = req.body;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Backup filename is required'
      });
    }

    console.log(`Server Management: Restoring backup ${filename}...`);
    const result = await serverManagementService.restoreBackup(filename);
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Restore failed'
    });
  }
};

/**
 * POST /api/server-management/backups/note
 * Save a note for a backup file
 */
export const saveBackupNote = async (req: Request, res: Response) => {
  try {
    const { filename, note } = req.body;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Filename is required'
      });
    }

    if (typeof note !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Note must be a string'
      });
    }

    console.log(`Server Management: Saving note for backup ${filename}...`);
    const result = await serverManagementService.saveBackupNote(filename, note);
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error saving backup note:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save note'
    });
  }
};

/**
 * POST /api/server-management/backups/cleanup
 * Clean up old backups
 */
export const cleanupBackups = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Cleaning up backups...');
    const result = await serverManagementService.cleanupBackups();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error cleaning up backups:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Cleanup failed'
    });
  }
};

// ========== Linux Dev Features ==========

/**
 * GET /api/server-management/ports
 * Get all active listening ports
 */
export const getActivePorts = async (req: Request, res: Response) => {
  try {
    const ports = await serverManagementService.getActivePorts();
    res.json({ success: true, data: ports });
  } catch (error) {
    console.error('Error getting active ports:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get ports'
    });
  }
};

/**
 * GET /api/server-management/rogue-processes
 * Get node/npm processes not managed by PM2
 */
export const getRogueProcesses = async (req: Request, res: Response) => {
  try {
    const processes = await serverManagementService.getRogueProcesses();
    res.json({ success: true, data: processes });
  } catch (error) {
    console.error('Error getting rogue processes:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get rogue processes'
    });
  }
};

/**
 * POST /api/server-management/kill-process
 * Kill a process by PID
 */
export const killProcess = async (req: Request, res: Response) => {
  try {
    const { pid } = req.body;

    if (!pid || typeof pid !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'PID is required and must be a number'
      });
    }

    console.log(`Server Management: Killing process ${pid}...`);
    const result = await serverManagementService.killProcess(pid);
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error killing process:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to kill process'
    });
  }
};

/**
 * GET /api/server-management/network
 * Get network interfaces status
 */
export const getNetworkInterfaces = async (req: Request, res: Response) => {
  try {
    const interfaces = await serverManagementService.getNetworkInterfaces();
    res.json({ success: true, data: interfaces });
  } catch (error) {
    console.error('Error getting network interfaces:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get network interfaces'
    });
  }
};

/**
 * GET /api/server-management/logs/:processName
 * Get PM2 process logs
 */
export const getProcessLogs = async (req: Request, res: Response) => {
  try {
    const { processName } = req.params;
    const lines = parseInt(req.query.lines as string) || 100;

    if (!processName) {
      return res.status(400).json({
        success: false,
        message: 'Process name is required'
      });
    }

    const result = await serverManagementService.getProcessLogs(processName, lines);
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error getting process logs:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get logs'
    });
  }
};

/**
 * POST /api/server-management/frontend/restart-dev
 * Restart frontend dev PM2 process (Vite)
 */
export const restartFrontendDev = async (req: Request, res: Response) => {
  try {
    console.log('Server Management: Restarting frontend dev...');
    const result = await serverManagementService.restartFrontendDev();
    res.json({ success: result.success, data: { output: result.output }, error: result.error });
  } catch (error) {
    console.error('Error restarting frontend dev:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'PM2 command failed'
    });
  }
};

/**
 * GET /api/server-management/environment
 * Get access environment based on request origin
 */
export const getAccessEnvironment = async (req: Request, res: Response) => {
  try {
    const origin = req.get('origin') || req.get('referer');
    const environment = serverManagementService.detectAccessEnvironment(origin);
    res.json({ success: true, data: { environment, origin } });
  } catch (error) {
    console.error('Error detecting environment:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to detect environment'
    });
  }
};

/**
 * GET /api/server-management/build-log
 * Read build log file for polling detached operations
 */
export const getBuildLog = async (req: Request, res: Response) => {
  try {
    const logFile = req.query.file as string;

    if (!logFile) {
      return res.status(400).json({
        success: false,
        message: 'Log file parameter is required'
      });
    }

    const result = serverManagementService.readBuildLog(logFile);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error reading build log:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to read build log'
    });
  }
};
