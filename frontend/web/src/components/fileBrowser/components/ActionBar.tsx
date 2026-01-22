/**
 * Action Bar Component
 * Upload and folder creation actions
 */

import React, { useRef } from 'react';
import { Upload, FolderPlus, RefreshCw } from 'lucide-react';

interface ActionBarProps {
  onUpload: (files: FileList) => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function ActionBar({ onUpload, onNewFolder, onRefresh, disabled }: ActionBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      // Reset input to allow uploading the same file again
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Upload</span>
      </button>

      {/* New folder button */}
      <button
        onClick={onNewFolder}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FolderPlus className="w-4 h-4" />
        <span className="hidden sm:inline">New Folder</span>
      </button>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh"
      >
        <RefreshCw className={`w-4 h-4 ${disabled ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
