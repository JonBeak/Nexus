/**
 * BackupTable Component
 * Created: Dec 23, 2025
 *
 * Displays backup files with restore and notes functionality.
 */

import React, { useState } from 'react';
import { Archive, AlertTriangle, MessageSquare, Check, X } from 'lucide-react';
import type { BackupFile } from '../../../services/api/serverManagementApi';

interface BackupTableProps {
  title: string;
  backups: BackupFile[];
  onRestore: (filename: string) => void;
  onSaveNote: (filename: string, note: string) => Promise<void>;
  isRestoring: boolean;
}

export const BackupTable: React.FC<BackupTableProps> = ({
  title,
  backups,
  onRestore,
  onSaveNote,
  isRestoring
}) => {
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const handleRestore = () => {
    if (selectedBackup) {
      onRestore(selectedBackup);
      setConfirmRestore(false);
      setSelectedBackup('');
    }
  };

  const startEditNote = (backup: BackupFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFilename(backup.filename);
    setNoteText(backup.note || '');
  };

  const cancelEditNote = () => {
    setEditingFilename(null);
    setNoteText('');
  };

  const saveNote = async () => {
    if (!editingFilename) {
      cancelEditNote();
      return;
    }

    setIsSavingNote(true);
    try {
      await onSaveNote(editingFilename, noteText);
      cancelEditNote();
    } catch (error) {
      console.error('Save note failed:', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Shorten filename for display
  const shortenFilename = (filename: string) => {
    // Extract key parts: type, date, commit
    const match = filename.match(/dist-(production|dev)-(\d{8})-(\d{6})-commit-([a-f0-9]+)/);
    if (match) {
      const [, buildType, date, time, commit] = match;
      const formattedDate = `${date.slice(4, 6)}/${date.slice(6, 8)}`;
      const formattedTime = `${time.slice(0, 2)}:${time.slice(2, 4)}`;
      return `${buildType} ${formattedDate} ${formattedTime} (${commit.slice(0, 7)})`;
    }
    return filename;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Archive className="w-5 h-5 text-gray-600" />
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <span className="text-sm text-gray-500">({backups.length})</span>
      </div>

      {backups.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No backups found</p>
      ) : (
        <>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600 font-medium">Type</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Date</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Size</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Commit</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Note</th>
                  <th className="text-left py-2 text-gray-600 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {backups.slice(0, 10).map((backup) => (
                  <tr
                    key={backup.filename}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors
                      ${selectedBackup === backup.filename ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedBackup(backup.filename)}
                  >
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium
                        ${backup.buildType === 'production'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {backup.buildType}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{formatDate(backup.date)}</td>
                    <td className="py-2 text-gray-600">{backup.size}</td>
                    <td className="py-2 text-gray-600 font-mono text-xs">
                      {backup.commitHash ? backup.commitHash.slice(0, 7) : '-'}
                    </td>
                    <td className="py-2 text-gray-600 text-xs max-w-[150px] truncate" title={backup.note || ''}>
                      {backup.note || <span className="text-gray-400 italic">-</span>}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={(e) => startEditNote(backup, e)}
                        className={`p-1 hover:bg-gray-100 rounded transition-colors ${backup.note ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        title={backup.note ? "Edit note" : "Add note"}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Note Editor */}
          {editingFilename && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">
                {backups.find(b => b.filename === editingFilename)?.note ? 'Edit Note' : 'Add Note'}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter a note for this backup..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNote();
                    if (e.key === 'Escape') cancelEditNote();
                  }}
                />
                <button
                  onClick={saveNote}
                  disabled={isSavingNote}
                  className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  title="Save note"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEditNote}
                  disabled={isSavingNote}
                  className="p-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <select
              value={selectedBackup}
              onChange={(e) => {
                setSelectedBackup(e.target.value);
                setConfirmRestore(false);
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Select backup to restore...</option>
              {backups.map((backup) => (
                <option key={backup.filename} value={backup.filename}>
                  {shortenFilename(backup.filename)}
                </option>
              ))}
            </select>

            {confirmRestore ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {isRestoring ? 'Restoring...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmRestore(false)}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRestore(true)}
                disabled={!selectedBackup || isRestoring}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Restore
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BackupTable;
