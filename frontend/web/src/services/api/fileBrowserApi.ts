/**
 * File Browser API Module
 * Created: Jan 2026
 * Updated: Jan 2026 - Security fixes (removed delete, deprecated getDownloadUrl)
 *
 * API calls for the owner-only file browser feature.
 * Provides access to SMB share for file management.
 *
 * SECURITY: Delete functionality removed - files can only be deleted through direct SMB access
 */

import { api, API_BASE_URL } from '../apiClient';

// ============================================================================
// Types
// ============================================================================

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size: number;
  modifiedDate: string;
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  items: FileItem[];
  parentPath: string | null;
}

export interface HealthStatus {
  accessible: boolean;
  message: string;
  path: string;
}

export interface UploadResult {
  filename: string;
  success: boolean;
  error?: string;
}

export interface UploadResponse {
  results: UploadResult[];
  successCount: number;
  failureCount: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if SMB share is accessible
 */
async function checkHealth(): Promise<HealthStatus> {
  const response = await api.get('/file-browser/health');
  return response.data;
}

/**
 * List directory contents
 * @param path - Relative path from SMB root (default: /)
 */
async function browse(path: string = '/'): Promise<DirectoryListing> {
  const response = await api.get('/file-browser/browse', {
    params: { path }
  });
  return response.data;
}

/**
 * Get download URL for a file
 * @param path - Relative path to file
 * @returns Full URL for downloading the file
 *
 * @deprecated This method exposes the token in URL which is insecure.
 * Use downloadFile() instead which uses proper Authorization header.
 */
function getDownloadUrl(path: string): string {
  console.warn('[fileBrowserApi] getDownloadUrl is deprecated - token in URL is insecure. Use downloadFile() instead.');
  // Encode the path to handle special characters
  const encodedPath = encodeURIComponent(path);
  // Get the token from localStorage for auth
  const token = localStorage.getItem('access_token');
  return `${API_BASE_URL}/file-browser/download?path=${encodedPath}&token=${token}`;
}

/**
 * Download a file
 * Opens the file in a new tab/download dialog
 */
async function downloadFile(path: string): Promise<void> {
  // Use fetch with blob response to handle the download
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/file-browser/download?path=${encodeURIComponent(path)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Download failed');
  }

  // Create blob and download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Extract filename from path
  a.download = path.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Upload files to a directory
 * @param path - Target directory path
 * @param files - Files to upload
 */
async function uploadFiles(path: string, files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await api.post('/file-browser/upload', formData, {
    params: { path },
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

/**
 * Rename a file or folder
 * @param path - Path to item to rename
 * @param newName - New name (not full path)
 */
async function renameItem(path: string, newName: string): Promise<void> {
  await api.post('/file-browser/rename', { path, newName });
}

/**
 * Create a new folder
 * @param parentPath - Parent directory path
 * @param name - Name of new folder
 */
async function createFolder(parentPath: string, name: string): Promise<void> {
  await api.post('/file-browser/create-folder', { path: parentPath, name });
}

// NOTE: deleteItem function removed for security
// Delete operations are disabled through this application

// ============================================================================
// Export
// ============================================================================

export const fileBrowserApi = {
  checkHealth,
  browse,
  getDownloadUrl, // Deprecated but kept for backward compatibility
  downloadFile,
  uploadFiles,
  renameItem,
  createFolder
};
