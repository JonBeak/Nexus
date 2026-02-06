/**
 * File List Component
 * Displays files and folders in a table format
 * Updated: Jan 2026 - Security fixes (removed delete button)
 *
 * SECURITY: Delete functionality removed - files can only be deleted through direct SMB access
 */

import React from 'react';
import {
  Folder,
  File,
  FileImage,
  FileText,
  FileCode,
  FileArchive,
  Film,
  Music,
  Download,
  Pencil
} from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { formatDateTimeWithYear } from '../../../utils/dateUtils';
import type { FileItem } from '../../../services/api/fileBrowserApi';

interface FileListProps {
  items: FileItem[];
  onNavigate: (path: string) => void;
  onDownload: (item: FileItem) => void;
  onRename: (item: FileItem) => void;
}

// Get icon based on file type/extension
function getFileIcon(item: FileItem) {
  if (item.type === 'folder') {
    return <Folder className="w-5 h-5 text-yellow-500" />;
  }

  const ext = item.extension?.toLowerCase();

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext || '')) {
    return <FileImage className="w-5 h-5 text-green-500" />;
  }

  // Documents
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'].includes(ext || '')) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }

  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'c', 'cpp', 'h'].includes(ext || '')) {
    return <FileCode className="w-5 h-5 text-purple-500" />;
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
    return <FileArchive className="w-5 h-5 text-orange-500" />;
  }

  // Video
  if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'].includes(ext || '')) {
    return <Film className="w-5 h-5 text-red-500" />;
  }

  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext || '')) {
    return <Music className="w-5 h-5 text-pink-500" />;
  }

  return <File className="w-5 h-5 text-gray-500" />;
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function FileList({ items, onNavigate, onDownload, onRename }: FileListProps) {
  if (items.length === 0) {
    return (
      <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
        <Folder className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">This folder is empty</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className={PAGE_STYLES.composites.tableHeader}>
          <tr>
            <th className={`text-left px-4 py-3 font-medium ${PAGE_STYLES.header.text}`}>Name</th>
            <th className={`text-right px-4 py-3 font-medium ${PAGE_STYLES.header.text} hidden sm:table-cell`}>Size</th>
            <th className={`text-right px-4 py-3 font-medium ${PAGE_STYLES.header.text} hidden md:table-cell`}>Modified</th>
            <th className={`text-right px-4 py-3 font-medium ${PAGE_STYLES.header.text} w-24`}>Actions</th>
          </tr>
        </thead>
        <tbody className={PAGE_STYLES.composites.tableBody}>
          {items.map((item) => (
            <tr
              key={item.path}
              className={`${PAGE_STYLES.interactive.hover} transition-colors`}
            >
              <td className="px-4 py-3">
                <button
                  onClick={() => item.type === 'folder' ? onNavigate(item.path) : onDownload(item)}
                  className={`flex items-center gap-3 ${PAGE_STYLES.panel.text} hover:text-cyan-500 transition-colors w-full text-left`}
                >
                  {getFileIcon(item)}
                  <span className="truncate max-w-[300px] md:max-w-[500px]">{item.name}</span>
                </button>
              </td>
              <td className={`text-right px-4 py-3 ${PAGE_STYLES.panel.textMuted} hidden sm:table-cell`}>
                {formatSize(item.size)}
              </td>
              <td className={`text-right px-4 py-3 ${PAGE_STYLES.panel.textMuted} text-sm hidden md:table-cell`}>
                {formatDateTimeWithYear(item.modifiedDate)}
              </td>
              <td className="text-right px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {item.type === 'file' && (
                    <button
                      onClick={() => onDownload(item)}
                      className="p-2 text-cyan-500 hover:bg-cyan-500/10 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onRename(item)}
                    className="p-2 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                    title="Rename"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
