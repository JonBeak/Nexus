/**
 * File Browser Types
 * Created: Jan 2026
 *
 * TypeScript interfaces for the file browser feature.
 * Owner-only file browser for SMB share access.
 */

/**
 * Represents a file or folder in the file browser
 */
export interface FileItem {
  name: string;
  path: string;  // Relative path from SMB root
  type: 'file' | 'folder';
  size: number;  // Size in bytes (0 for folders)
  modifiedDate: string;  // ISO date string
  extension?: string;  // File extension (lowercase, without dot)
}

/**
 * Response for directory listing
 */
export interface DirectoryListingResponse {
  path: string;  // Current path (relative)
  items: FileItem[];
  parentPath: string | null;  // null if at root
}

/**
 * Request body for rename operation
 */
export interface RenameRequest {
  path: string;  // Path to item to rename
  newName: string;  // New name (not full path)
}

// NOTE: DeleteRequest interface removed - delete functionality disabled for security

/**
 * Request body for create folder operation
 */
export interface CreateFolderRequest {
  path: string;  // Parent path where folder will be created
  name: string;  // Name of new folder
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  accessible: boolean;
  message: string;
  path: string;
}

/**
 * Upload response for a single file
 */
export interface UploadResult {
  filename: string;
  success: boolean;
  error?: string;
}

/**
 * Response for upload operation
 */
export interface UploadResponse {
  results: UploadResult[];
  successCount: number;
  failureCount: number;
}
