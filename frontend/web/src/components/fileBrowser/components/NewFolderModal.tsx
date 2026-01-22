/**
 * New Folder Modal Component
 * Dialog for creating new folders
 */

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  loading?: boolean;
}

export function NewFolderModal({ isOpen, onClose, onConfirm, loading }: NewFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      // Focus input after render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onConfirm(folderName.trim());
    }
  };

  const isEmpty = !folderName.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4`}>
        <div className={`flex items-center justify-between p-4 border-b ${PAGE_STYLES.panel.border}`}>
          <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
            Create New Folder
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text} rounded disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>
              Folder Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 rounded-lg border ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.border} focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50`}
              placeholder="Enter folder name"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`flex-1 py-2 ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} rounded-lg transition-colors disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isEmpty}
              className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
