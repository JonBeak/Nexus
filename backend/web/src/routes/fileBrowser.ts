/**
 * File Browser Routes
 * Created: Jan 2026
 * Updated: Jan 2026 - Security fixes (disk storage, removed delete)
 *
 * Routes for the File Browser - owner only.
 * Provides endpoints for browsing, downloading, uploading, and managing files.
 *
 * SECURITY: Delete endpoint removed for security - files can only be deleted through direct SMB access
 */

import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as controller from '../controllers/fileBrowserController';

const router = Router();

// All routes require owner role
const ownerOnly = [authenticateToken, requireRole('owner')];

// Configure multer for file uploads - use disk storage to avoid memory issues
// Files are written to system temp directory, then moved to SMB share
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    // Generate unique filename to prevent collisions
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `upload-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,  // 500MB max file size
    files: 20  // Max 20 files per upload
  }
});

// Health check - verify SMB share is accessible
router.get('/health', ...ownerOnly, controller.checkHealth);

// Browse directory
router.get('/browse', ...ownerOnly, controller.listDirectory);

// Download file
router.get('/download', ...ownerOnly, controller.downloadFile);

// Upload files
router.post('/upload', ...ownerOnly, upload.array('files', 20), controller.uploadFile);

// Rename file or folder
router.post('/rename', ...ownerOnly, controller.renameItem);

// Create new folder
router.post('/create-folder', ...ownerOnly, controller.createFolder);

// NOTE: Delete endpoint intentionally removed for security
// router.post('/delete', ...ownerOnly, controller.deleteItem);

export default router;
