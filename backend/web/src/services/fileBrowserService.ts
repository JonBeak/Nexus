/**
 * File Browser Service
 * Created: Jan 2026
 * Updated: Jan 2026 - Security fixes (TOCTOU, symlink protection, file validation)
 *
 * Handles file operations for the owner-only file browser.
 * Provides secure access to the SMB share at /mnt/channelletter.
 *
 * SECURITY:
 * - All paths are sanitized and resolved to prevent directory traversal
 * - Symlinks are resolved to prevent escape attacks
 * - File extensions are validated to block executables
 * - TOCTOU race conditions addressed with atomic operations
 * - Delete functionality intentionally disabled
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { SMB_ROOT } from '../config/paths';
import type {
  FileItem,
  DirectoryListingResponse,
  HealthCheckResponse,
  UploadResult,
  UploadResponse
} from '../types/fileBrowser';

// Allowed file extensions for upload
const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv',
  // Design files (sign manufacturing)
  '.ai', '.eps', '.psd', '.cdr', '.dxf', '.dwg',
  // Archives
  '.zip', '.rar', '.7z'
]);

// Blocked extensions (executables) - checked even if somehow bypassing allowed list
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.com', '.scr', '.vbs', '.js', '.jar',
  '.ws', '.wsf', '.wsc', '.wsh', '.psc1', '.msc', '.cpl', '.reg', '.inf', '.scf', '.lnk'
]);

class FileBrowserService {
  private readonly SMB_ROOT = SMB_ROOT;
  private resolvedRoot: string | null = null;

  /**
   * Get resolved root path (cached after first call)
   */
  private async getResolvedRoot(): Promise<string> {
    if (this.resolvedRoot === null) {
      try {
        this.resolvedRoot = await fs.realpath(this.SMB_ROOT);
      } catch {
        // If SMB root doesn't exist, fall back to the configured path
        this.resolvedRoot = this.SMB_ROOT;
      }
    }
    return this.resolvedRoot;
  }

  /**
   * CRITICAL SECURITY: Sanitize and validate path
   * Prevents directory traversal attacks and symlink escape
   *
   * @param relativePath - User-provided path relative to SMB root
   * @returns Absolute path guaranteed to be within SMB_ROOT (resolved through symlinks)
   * @throws Error if path would escape SMB_ROOT
   */
  private async sanitizePath(relativePath: string): Promise<string> {
    // Handle empty or root path
    if (!relativePath || relativePath === '/' || relativePath === '.') {
      return await this.getResolvedRoot();
    }

    // Normalize the path (resolves . and ..)
    const normalized = path.normalize(relativePath)
      .replace(/^(\.\.[\/\\])+/, '')  // Remove leading ../
      .replace(/^[\/\\]+/, '');        // Remove leading slashes

    // Resolve to absolute path
    const resolvedRoot = await this.getResolvedRoot();
    const fullPath = path.resolve(resolvedRoot, normalized);

    // Resolve symlinks in the target path to prevent escape attacks
    let resolvedPath: string;
    try {
      resolvedPath = await fs.realpath(fullPath);
    } catch {
      // Path doesn't exist yet (for creates) - check parent instead
      const parentPath = path.dirname(fullPath);
      try {
        const resolvedParent = await fs.realpath(parentPath);
        if (!resolvedParent.startsWith(resolvedRoot + path.sep) && resolvedParent !== resolvedRoot) {
          console.error(`[FileBrowserService] Security: Parent symlink escape blocked: ${relativePath}`);
          throw new Error('Access denied: Path outside allowed directory');
        }
        // Parent is valid, return the original full path (file/folder will be created here)
        resolvedPath = fullPath;
      } catch (parentError) {
        // Parent also doesn't exist - this is fine for nested creates, just check the original path
        if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
          console.error(`[FileBrowserService] Security: Path traversal attempt blocked: ${relativePath}`);
          throw new Error('Access denied: Path outside allowed directory');
        }
        resolvedPath = fullPath;
      }
    }

    // CRITICAL: Verify the resolved path is within SMB_ROOT
    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
      console.error(`[FileBrowserService] Security: Symlink escape attempt blocked: ${relativePath}`);
      throw new Error('Access denied: Path outside allowed directory');
    }

    return resolvedPath;
  }

  /**
   * Validate file extension against allowed/blocked lists
   * @param filename - The filename to validate
   * @throws Error if extension is blocked or not allowed
   */
  private validateFileExtension(filename: string): void {
    const ext = path.extname(filename).toLowerCase();

    // Check blocked list first (safety net)
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new Error(`File type not allowed: ${ext} files are blocked for security reasons`);
    }

    // Check allowed list
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`File type not allowed: ${ext} files are not permitted. Allowed types: images, documents, design files, and archives`);
    }
  }

  /**
   * Sanitize filename for filesystem safety
   * Removes characters that could cause issues on Windows/Linux
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\/\\:*?"<>|]/g, '_')  // Replace invalid chars
      .replace(/^\.+/, '')              // Remove leading dots
      .trim();
  }

  /**
   * Get relative path from absolute path
   */
  private async getRelativePath(absolutePath: string): Promise<string> {
    const resolvedRoot = await this.getResolvedRoot();
    if (absolutePath === resolvedRoot) {
      return '/';
    }
    return '/' + path.relative(resolvedRoot, absolutePath).replace(/\\/g, '/');
  }

  /**
   * Check if SMB share is accessible with timeout
   * Uses async operations with Promise.race for timeout handling
   */
  async checkHealth(timeoutMs: number = 7000): Promise<HealthCheckResponse> {
    const timeoutPromise = new Promise<HealthCheckResponse>((resolve) => {
      setTimeout(() => {
        console.warn('[FileBrowserService] SMB health check timeout');
        resolve({
          accessible: false,
          message: 'SMB share is not responding (timeout)',
          path: this.SMB_ROOT
        });
      }, timeoutMs);
    });

    const checkPromise = (async (): Promise<HealthCheckResponse> => {
      try {
        const stats = await fs.stat(this.SMB_ROOT);
        if (!stats.isDirectory()) {
          return {
            accessible: false,
            message: 'SMB share path is not a directory',
            path: this.SMB_ROOT
          };
        }

        // Try to read directory to verify it's accessible
        await fs.readdir(this.SMB_ROOT);
        return {
          accessible: true,
          message: 'SMB share is accessible',
          path: this.SMB_ROOT
        };
      } catch (error: any) {
        console.error('[FileBrowserService] SMB health check error:', error);

        if (error.code === 'ENOENT') {
          return {
            accessible: false,
            message: 'SMB share path does not exist',
            path: this.SMB_ROOT
          };
        }

        return {
          accessible: false,
          message: error.message || 'Unknown error',
          path: this.SMB_ROOT
        };
      }
    })();

    return Promise.race([checkPromise, timeoutPromise]);
  }

  /**
   * List directory contents
   * Returns folders first (sorted), then files (sorted by name)
   */
  async listDirectory(relativePath: string = '/'): Promise<DirectoryListingResponse> {
    const absolutePath = await this.sanitizePath(relativePath);

    // Try to read directory atomically - no separate exists check (TOCTOU fix)
    let entries: fsSync.Dirent[];
    try {
      entries = await fs.readdir(absolutePath, { withFileTypes: true });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Directory not found');
      }
      if (error.code === 'ENOTDIR') {
        throw new Error('Path is not a directory');
      }
      throw error;
    }

    const items: FileItem[] = [];

    for (const entry of entries) {
      // Skip hidden files (starting with .)
      if (entry.name.startsWith('.')) {
        continue;
      }

      const itemPath = path.join(absolutePath, entry.name);

      try {
        const itemStats = await fs.stat(itemPath);
        const isDirectory = itemStats.isDirectory();
        const extension = isDirectory ? undefined : path.extname(entry.name).toLowerCase().slice(1);

        items.push({
          name: entry.name,
          path: await this.getRelativePath(itemPath),
          type: isDirectory ? 'folder' : 'file',
          size: isDirectory ? 0 : itemStats.size,
          modifiedDate: itemStats.mtime.toISOString(),
          extension
        });
      } catch (error) {
        // Skip items we can't access (permission issues, etc.)
        console.warn(`[FileBrowserService] Cannot access: ${entry.name}`);
        continue;
      }
    }

    // Sort: folders first, then files, alphabetically within each group
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    // Calculate parent path
    const currentRelativePath = await this.getRelativePath(absolutePath);
    const parentPath = currentRelativePath === '/'
      ? null
      : path.dirname(currentRelativePath).replace(/\\/g, '/') || '/';

    return {
      path: currentRelativePath,
      items,
      parentPath
    };
  }

  /**
   * Get file path for download
   * Returns the absolute path after validation
   */
  async getDownloadPath(relativePath: string): Promise<string> {
    const absolutePath = await this.sanitizePath(relativePath);

    // Try to stat atomically - no separate exists check (TOCTOU fix)
    let stats: fsSync.Stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw error;
    }

    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    return absolutePath;
  }

  /**
   * Upload files to a directory
   * Files are streamed from temp directory to destination
   */
  async uploadFiles(
    relativePath: string,
    files: Express.Multer.File[]
  ): Promise<UploadResponse> {
    const targetDir = await this.sanitizePath(relativePath);

    // Verify target is a directory atomically (TOCTOU fix)
    try {
      const stats = await fs.stat(targetDir);
      if (!stats.isDirectory()) {
        throw new Error('Target path is not a directory');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Target directory not found');
      }
      throw error;
    }

    const results: UploadResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const file of files) {
      const sanitizedName = this.sanitizeFilename(file.originalname);

      try {
        // Validate file extension
        this.validateFileExtension(sanitizedName);

        const targetPath = path.join(targetDir, sanitizedName);

        // Move file from temp to destination using streams (handles cross-device moves)
        if (file.path) {
          // Disk storage - move or copy file
          await this.moveFile(file.path, targetPath);
        } else if (file.buffer) {
          // Memory storage fallback (shouldn't happen with disk storage)
          await fs.writeFile(targetPath, file.buffer);
        } else {
          throw new Error('No file data available');
        }

        results.push({
          filename: sanitizedName,
          success: true
        });
        successCount++;
        console.log(`[FileBrowserService] Uploaded: ${sanitizedName}`);
      } catch (error) {
        results.push({
          filename: sanitizedName,
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed'
        });
        failureCount++;
        console.error(`[FileBrowserService] Upload failed: ${sanitizedName}`, error);

        // Clean up temp file if it exists
        if (file.path) {
          try {
            await fs.unlink(file.path);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }

    return { results, successCount, failureCount };
  }

  /**
   * Move file from source to destination
   * Handles cross-device moves using streams
   */
  private async moveFile(source: string, dest: string): Promise<void> {
    try {
      // Try rename first (fast, atomic, same filesystem)
      await fs.rename(source, dest);
    } catch (error: any) {
      if (error.code === 'EXDEV') {
        // Cross-device - use stream copy
        await this.streamCopy(source, dest);
        await fs.unlink(source);
      } else {
        throw error;
      }
    }
  }

  /**
   * Copy file using streams (for cross-device operations)
   */
  private streamCopy(source: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fsSync.createReadStream(source);
      const writeStream = fsSync.createWriteStream(dest);

      readStream.on('error', (err) => {
        writeStream.destroy();
        reject(err);
      });

      writeStream.on('error', (err) => {
        readStream.destroy();
        reject(err);
      });

      writeStream.on('finish', resolve);
      readStream.pipe(writeStream);
    });
  }

  /**
   * Rename a file or folder
   */
  async renameItem(relativePath: string, newName: string): Promise<{ oldPath: string; newPath: string }> {
    const absolutePath = await this.sanitizePath(relativePath);
    const sanitizedNewName = this.sanitizeFilename(newName);

    if (!sanitizedNewName) {
      throw new Error('Invalid new name');
    }

    // Validate extension if it's a file (not folder)
    if (path.extname(sanitizedNewName)) {
      this.validateFileExtension(sanitizedNewName);
    }

    // Get parent directory and construct new path
    const parentDir = path.dirname(absolutePath);
    const newPath = path.join(parentDir, sanitizedNewName);

    // Perform rename atomically - let the error tell us if it fails (TOCTOU fix)
    try {
      await fs.rename(absolutePath, newPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Item not found');
      }
      if (error.code === 'EEXIST' || error.code === 'ENOTEMPTY') {
        throw new Error('An item with this name already exists');
      }
      throw error;
    }

    console.log(`[FileBrowserService] Renamed: ${path.basename(absolutePath)} -> ${sanitizedNewName}`);
    return { oldPath: relativePath, newPath: await this.getRelativePath(newPath) };
  }

  /**
   * Create a new folder
   */
  async createFolder(parentPath: string, folderName: string): Promise<string> {
    const parentDir = await this.sanitizePath(parentPath);
    const sanitizedName = this.sanitizeFilename(folderName);

    if (!sanitizedName) {
      throw new Error('Invalid folder name');
    }

    const newFolderPath = path.join(parentDir, sanitizedName);

    // Create folder atomically - let the error tell us if it fails (TOCTOU fix)
    try {
      await fs.mkdir(newFolderPath);
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        throw new Error('A folder with this name already exists');
      }
      if (error.code === 'ENOENT') {
        throw new Error('Parent directory not found');
      }
      if (error.code === 'ENOTDIR') {
        throw new Error('Parent path is not a directory');
      }
      throw error;
    }

    console.log(`[FileBrowserService] Created folder: ${sanitizedName}`);
    return await this.getRelativePath(newFolderPath);
  }

  // NOTE: deleteItem() method intentionally removed for security
  // Delete operations are disabled through this application
}

export const fileBrowserService = new FileBrowserService();
