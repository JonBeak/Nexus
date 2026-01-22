/**
 * File Browser Controller
 * Created: Jan 2026
 * Updated: Jan 2026 - Security fixes (audit logging, removed delete)
 *
 * HTTP handlers for file browser operations.
 * All endpoints are owner-only, protected by middleware in routes.
 *
 * SECURITY: Delete endpoint removed - all operations are now audited
 */

import { Request, Response } from 'express';
import { fileBrowserService } from '../services/fileBrowserService';
import { auditRepository } from '../repositories/auditRepository';
import type { AuthRequest } from '../types';
import type {
  RenameRequest,
  CreateFolderRequest
} from '../types/fileBrowser';

/**
 * GET /api/file-browser/health
 * Check if SMB share is accessible
 */
export const checkHealth = async (req: Request, res: Response) => {
  try {
    const health = await fileBrowserService.checkHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    console.error('Error checking SMB health:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Health check failed'
    });
  }
};

/**
 * GET /api/file-browser/browse
 * List directory contents
 * Query params: path (optional, defaults to /)
 */
export const listDirectory = async (req: Request, res: Response) => {
  try {
    const relativePath = (req.query.path as string) || '/';
    const listing = await fileBrowserService.listDirectory(relativePath);
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Error listing directory:', error);

    // Return 403 for path traversal attempts
    if (error instanceof Error && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Return 404 for not found
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list directory'
    });
  }
};

/**
 * GET /api/file-browser/download
 * Download a file
 * Query params: path (required)
 */
export const downloadFile = async (req: Request, res: Response) => {
  try {
    const relativePath = req.query.path as string;

    if (!relativePath) {
      return res.status(400).json({
        success: false,
        message: 'Path is required'
      });
    }

    const absolutePath = await fileBrowserService.getDownloadPath(relativePath);
    const authReq = req as AuthRequest;

    // Audit log the download
    if (authReq.user) {
      await auditRepository.createAuditEntry({
        user_id: authReq.user.user_id,
        action: 'file_download',
        entity_type: 'file_browser',
        entity_id: relativePath,
        details: JSON.stringify({
          path: relativePath,
          filename: relativePath.split('/').pop()
        })
      });
    }

    // Use res.download for proper file streaming with correct headers
    res.download(absolutePath, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        // Only send error if headers haven't been sent
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download file'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error preparing download:', error);

    if (error instanceof Error && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to download file'
    });
  }
};

/**
 * POST /api/file-browser/upload
 * Upload files to a directory
 * Body: FormData with 'files' field
 * Query params: path (required - target directory)
 */
export const uploadFile = async (req: Request, res: Response) => {
  try {
    const relativePath = req.query.path as string;

    if (!relativePath) {
      return res.status(400).json({
        success: false,
        message: 'Path is required'
      });
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const result = await fileBrowserService.uploadFiles(relativePath, files);
    const authReq = req as AuthRequest;

    // Audit log the upload
    if (authReq.user && result.successCount > 0) {
      const successfulFiles = result.results
        .filter(r => r.success)
        .map(r => r.filename);

      await auditRepository.createAuditEntry({
        user_id: authReq.user.user_id,
        action: 'file_upload',
        entity_type: 'file_browser',
        entity_id: relativePath,
        details: JSON.stringify({
          path: relativePath,
          files: successfulFiles,
          count: result.successCount,
          failed: result.failureCount
        })
      });
    }

    res.json({
      success: result.failureCount === 0,
      data: result,
      message: result.failureCount > 0
        ? `${result.successCount} uploaded, ${result.failureCount} failed`
        : `${result.successCount} file(s) uploaded successfully`
    });
  } catch (error) {
    console.error('Error uploading files:', error);

    if (error instanceof Error && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error instanceof Error && error.message.includes('not allowed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload files'
    });
  }
};

/**
 * POST /api/file-browser/rename
 * Rename a file or folder
 * Body: { path: string, newName: string }
 */
export const renameItem = async (req: Request, res: Response) => {
  try {
    const { path: itemPath, newName } = req.body as RenameRequest;

    if (!itemPath || !newName) {
      return res.status(400).json({
        success: false,
        message: 'Path and newName are required'
      });
    }

    const result = await fileBrowserService.renameItem(itemPath, newName);
    const authReq = req as AuthRequest;

    // Audit log the rename
    if (authReq.user) {
      await auditRepository.createAuditEntry({
        user_id: authReq.user.user_id,
        action: 'file_rename',
        entity_type: 'file_browser',
        entity_id: itemPath,
        details: JSON.stringify({
          oldPath: result.oldPath,
          newPath: result.newPath,
          newName: newName
        })
      });
    }

    res.json({
      success: true,
      message: 'Item renamed successfully'
    });
  } catch (error) {
    console.error('Error renaming item:', error);

    if (error instanceof Error && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error instanceof Error && error.message.includes('not allowed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to rename item'
    });
  }
};

/**
 * POST /api/file-browser/create-folder
 * Create a new folder
 * Body: { path: string, name: string }
 */
export const createFolder = async (req: Request, res: Response) => {
  try {
    const { path: parentPath, name } = req.body as CreateFolderRequest;

    if (!parentPath || !name) {
      return res.status(400).json({
        success: false,
        message: 'Path and name are required'
      });
    }

    const newFolderPath = await fileBrowserService.createFolder(parentPath, name);
    const authReq = req as AuthRequest;

    // Audit log the folder creation
    if (authReq.user) {
      await auditRepository.createAuditEntry({
        user_id: authReq.user.user_id,
        action: 'folder_create',
        entity_type: 'file_browser',
        entity_id: newFolderPath,
        details: JSON.stringify({
          parentPath: parentPath,
          folderName: name,
          newPath: newFolderPath
        })
      });
    }

    res.json({
      success: true,
      message: 'Folder created successfully'
    });
  } catch (error) {
    console.error('Error creating folder:', error);

    if (error instanceof Error && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create folder'
    });
  }
};

// NOTE: deleteItem controller intentionally removed for security
// Delete operations are disabled through this application
