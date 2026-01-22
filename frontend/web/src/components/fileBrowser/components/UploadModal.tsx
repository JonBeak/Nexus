/**
 * Upload Modal Component
 * Shows upload progress and results
 */

import React from 'react';
import { X, CheckCircle, XCircle, Upload, Loader2 } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import type { UploadResult } from '../../../services/api/fileBrowserApi';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploading: boolean;
  results: UploadResult[] | null;
  filesToUpload: File[];
}

export function UploadModal({ isOpen, onClose, uploading, results, filesToUpload }: UploadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4`}>
        <div className={`flex items-center justify-between p-4 border-b ${PAGE_STYLES.panel.border}`}>
          <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
            {uploading ? 'Uploading Files...' : 'Upload Complete'}
          </h3>
          {!uploading && (
            <button
              onClick={onClose}
              className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text} rounded`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          {uploading && !results ? (
            // Uploading state
            <div className="space-y-2">
              {filesToUpload.map((file, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                  <span className={`${PAGE_STYLES.panel.text} truncate`}>{file.name}</span>
                </div>
              ))}
            </div>
          ) : results ? (
            // Results state
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className={`${PAGE_STYLES.panel.text} truncate`}>{result.filename}</span>
                  {!result.success && result.error && (
                    <span className="text-red-500 text-sm truncate">({result.error})</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {!uploading && (
          <div className={`p-4 border-t ${PAGE_STYLES.panel.border}`}>
            <button
              onClick={onClose}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
