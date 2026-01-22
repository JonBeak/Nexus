/**
 * File Browser Component
 * Owner-only file browser for SMB share
 * Created: Jan 2026
 * Updated: Jan 2026 - Security fixes (removed delete functionality)
 *
 * SECURITY: Delete functionality removed - files can only be deleted through direct SMB access
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, HardDrive } from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { fileBrowserApi } from '../../services/api';
import type { FileItem, DirectoryListing, UploadResult } from '../../services/api/fileBrowserApi';

// Sub-components
import { BreadcrumbNav } from './components/BreadcrumbNav';
import { FileList } from './components/FileList';
import { ActionBar } from './components/ActionBar';
import { UploadModal } from './components/UploadModal';
import { RenameModal } from './components/RenameModal';
import { NewFolderModal } from './components/NewFolderModal';

export default function FileBrowser() {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [smbHealthy, setSmbHealthy] = useState<boolean | null>(null);

  // Modal states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<FileItem | null>(null);
  const [renaming, setRenaming] = useState(false);

  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Load directory
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fileBrowserApi.browse(path);
      setListing(data);
      setCurrentPath(data.path);
    } catch (err) {
      console.error('Error loading directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check SMB health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await fileBrowserApi.checkHealth();
        setSmbHealthy(health.accessible);
        if (health.accessible) {
          loadDirectory('/');
        } else {
          setError(health.message);
          setLoading(false);
        }
      } catch (err) {
        console.error('Health check failed:', err);
        setSmbHealthy(false);
        setError('Failed to connect to file share');
        setLoading(false);
      }
    };

    checkHealth();
  }, [loadDirectory]);

  // Navigate to path
  const handleNavigate = useCallback((path: string) => {
    loadDirectory(path);
  }, [loadDirectory]);

  // Download file
  const handleDownload = useCallback(async (item: FileItem) => {
    try {
      await fileBrowserApi.downloadFile(item.path);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }, []);

  // Upload files
  const handleUpload = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    setFilesToUpload(fileArray);
    setUploadResults(null);
    setUploadModalOpen(true);
    setUploading(true);

    try {
      const result = await fileBrowserApi.uploadFiles(currentPath, fileArray);
      setUploadResults(result.results);
      // Refresh directory after upload
      loadDirectory(currentPath);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadResults(fileArray.map(f => ({
        filename: f.name,
        success: false,
        error: err instanceof Error ? err.message : 'Upload failed'
      })));
    } finally {
      setUploading(false);
    }
  }, [currentPath, loadDirectory]);

  // Open rename modal
  const handleRenameClick = useCallback((item: FileItem) => {
    setItemToRename(item);
    setRenameModalOpen(true);
  }, []);

  // Confirm rename
  const handleRenameConfirm = useCallback(async (newName: string) => {
    if (!itemToRename) return;

    setRenaming(true);
    try {
      await fileBrowserApi.renameItem(itemToRename.path, newName);
      setRenameModalOpen(false);
      setItemToRename(null);
      loadDirectory(currentPath);
    } catch (err) {
      console.error('Rename failed:', err);
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setRenaming(false);
    }
  }, [itemToRename, currentPath, loadDirectory]);

  // Create new folder
  const handleNewFolderConfirm = useCallback(async (name: string) => {
    setCreatingFolder(true);
    try {
      await fileBrowserApi.createFolder(currentPath, name);
      setNewFolderModalOpen(false);
      loadDirectory(currentPath);
    } catch (err) {
      console.error('Create folder failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  }, [currentPath, loadDirectory]);

  // Render error state
  if (smbHealthy === false) {
    return (
      <div className={PAGE_STYLES.fullPage}>
        <header className={`${PAGE_STYLES.panel.background} shadow-lg border-b-4 border-cyan-600`}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover}`}
                >
                  <ArrowLeft className={`w-5 h-5 ${PAGE_STYLES.panel.text}`} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>File Browser</h1>
                    <p className={PAGE_STYLES.panel.textMuted}>SMB Share Access</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className={`${PAGE_STYLES.composites.panelContainer} p-8 text-center`}>
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-2`}>
              File Share Unavailable
            </h2>
            <p className={`${PAGE_STYLES.panel.textMuted} mb-4`}>
              {error || 'Unable to connect to the file share. Please check the network connection.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header */}
      <header className={`${PAGE_STYLES.panel.background} shadow-lg border-b-4 border-cyan-600`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className={`p-2 ${PAGE_STYLES.header.background} rounded-lg ${PAGE_STYLES.interactive.hover}`}
              >
                <ArrowLeft className={`w-5 h-5 ${PAGE_STYLES.panel.text}`} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>File Browser</h1>
                  <p className={PAGE_STYLES.panel.textMuted}>SMB Share Access</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className={PAGE_STYLES.composites.panelContainer}>
          {/* Toolbar */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b ${PAGE_STYLES.panel.border}`}>
            <BreadcrumbNav
              currentPath={currentPath}
              onNavigate={handleNavigate}
            />
            <ActionBar
              onUpload={handleUpload}
              onNewFolder={() => setNewFolderModalOpen(true)}
              onRefresh={() => loadDirectory(currentPath)}
              disabled={loading}
            />
          </div>

          {/* Error banner */}
          {error && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/20">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-sm underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* File list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : listing ? (
            <FileList
              items={listing.items}
              onNavigate={handleNavigate}
              onDownload={handleDownload}
              onRename={handleRenameClick}
            />
          ) : null}
        </div>
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadResults(null);
          setFilesToUpload([]);
        }}
        uploading={uploading}
        results={uploadResults}
        filesToUpload={filesToUpload}
      />

      <RenameModal
        isOpen={renameModalOpen}
        item={itemToRename}
        onClose={() => {
          setRenameModalOpen(false);
          setItemToRename(null);
        }}
        onConfirm={handleRenameConfirm}
        loading={renaming}
      />

      <NewFolderModal
        isOpen={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        onConfirm={handleNewFolderConfirm}
        loading={creatingFolder}
      />
    </div>
  );
}
