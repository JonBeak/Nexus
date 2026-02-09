/**
 * Feedback Submit Modal
 * Modal for submitting feedback, bug reports, or feature requests
 *
 * Created: 2026-01-16
 */

import React, { useState, useRef } from 'react';
import { X, Upload, Image, Trash2, Send, Loader2, CheckCircle } from 'lucide-react';
import { feedbackApi } from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FeedbackSubmitModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<{
    data: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setScreenshot({
        data: base64,
        filename: file.name,
        mimeType: file.type
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await feedbackApi.create({
        title: title.trim(),
        description: description.trim(),
        screenshot_data: screenshot?.data,
        screenshot_filename: screenshot?.filename,
        screenshot_mime_type: screenshot?.mimeType,
        page_url: window.location.href
      });

      setSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit feedback';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setScreenshot(null);
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className={`relative ${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full max-w-lg`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
              Send Feedback
            </h3>
            <button
              onClick={handleClose}
              className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text} transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h4 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Thank you!</h4>
                <p className={PAGE_STYLES.panel.textMuted}>Your feedback has been submitted and sent to Claude.</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-1`}>
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief summary of your feedback"
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    maxLength={255}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-1`}>
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your feedback, bug report, or feature request in detail..."
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y`}
                  />
                </div>

                {/* Screenshot upload */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.text} mb-1`}>
                    Screenshot (optional)
                  </label>
                  {screenshot ? (
                    <div className={`flex items-center gap-3 p-3 ${PAGE_STYLES.input.background} rounded-lg border ${PAGE_STYLES.input.border}`}>
                      <Image className={`w-5 h-5 ${PAGE_STYLES.panel.textMuted}`} />
                      <span className={`text-sm ${PAGE_STYLES.panel.textSecondary} flex-1 truncate`}>
                        {screenshot.filename}
                      </span>
                      <button
                        onClick={() => setScreenshot(null)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`w-full p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50'
                          : `${PAGE_STYLES.panel.border} hover:border-blue-400 hover:bg-blue-50`
                      }`}
                    >
                      <div className={`flex flex-col items-center ${isDragging ? 'text-blue-500' : PAGE_STYLES.panel.textMuted}`}>
                        <Upload className="w-6 h-6 mb-2" />
                        <span className="text-sm">
                          {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
                        </span>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!success && (
            <div className={`flex justify-end gap-3 p-4 border-t ${PAGE_STYLES.panel.border}`}>
              <button
                onClick={handleClose}
                className={`px-4 py-2 ${PAGE_STYLES.panel.text} hover:bg-gray-100 rounded-lg transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !description.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Feedback
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
