/**
 * AI File Validation Modal
 * Modal for validating AI production files before approval
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  FileType,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  RefreshCw,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';
import { aiFileValidationApi } from '../../../../services/api';
import {
  AiFileInfo,
  ValidateFilesResponse,
  ValidationRuleDisplay,
} from '../../../../types/aiFileValidation';
import ExpectedFilesTable from './ExpectedFilesTable';
import ValidationRulesPanel from './ValidationRulesPanel';
import FileCard from './validation/FileCard';
import CrossReferenceSummary from './validation/CrossReferenceSummary';
import { useModalBackdrop } from '../../../../hooks/useModalBackdrop';

interface AiFileValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onApproveComplete: () => void;
  onSkipValidation: () => void;
}

const AiFileValidationModal: React.FC<AiFileValidationModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onApproveComplete,
  onSkipValidation,
}) => {
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp } =
    useModalBackdrop({ isOpen, onClose });

  const [files, setFiles] = useState<AiFileInfo[]>([]);
  const [validationResult, setValidationResult] = useState<ValidateFilesResponse | null>(null);
  const [validationRules, setValidationRules] = useState<ValidationRuleDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load files when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, orderNumber]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    setValidationResult(null);
    try {
      const result = await aiFileValidationApi.listFiles(orderNumber);
      setFiles(result);

      // Auto-start validation if files exist
      if (result && result.length > 0) {
        setLoading(false);
        setValidating(true);
        try {
          const valResult = await aiFileValidationApi.validateFiles(orderNumber);
          setValidationResult(valResult);
        } catch (valErr) {
          console.error('Error validating files:', valErr);
          setError('Validation failed. Make sure Inkscape and Python dependencies are installed.');
        } finally {
          setValidating(false);
        }
        return;
      }
    } catch (err) {
      console.error('Error loading AI files:', err);
      setError('Failed to load AI files from order folder');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      const result = await aiFileValidationApi.validateFiles(orderNumber);
      setValidationResult(result);
    } catch (err) {
      console.error('Error validating files:', err);
      setError('Validation failed. Make sure Inkscape and Python dependencies are installed.');
    } finally {
      setValidating(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      await aiFileValidationApi.approveFiles(orderNumber);
      onApproveComplete();
    } catch (err) {
      console.error('Error approving files:', err);
      setError('Failed to approve files');
    } finally {
      setApproving(false);
    }
  };

  if (!isOpen) return null;

  const hasFiles = files && files.length > 0;
  const hasErrors = validationResult && (validationResult.failed > 0 || validationResult.errors > 0);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`${PAGE_STYLES.panel.background} rounded-lg shadow-2xl max-w-[1300px] w-full max-h-[85vh] flex flex-col`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${PAGE_STYLES.border} flex items-center justify-between`}>
          <div>
            <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text}`}>
              AI File Validation
            </h2>
            <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
              Order #{orderNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 ${PAGE_STYLES.interactive.hover} rounded-lg transition-colors`}
          >
            <X className={`w-5 h-5 ${PAGE_STYLES.panel.textMuted}`} />
          </button>
        </div>

        {/* Content — two-column layout */}
        <div className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-12 px-6">
              <Loader className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="ml-3 text-gray-600">Loading AI files...</span>
            </div>
          ) : error ? (
            <div className="px-6 py-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={loadFiles}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-6 flex-1 min-h-0 pl-6">
              {/* Left column — Expected Files + Validation Rules */}
              <div className="w-1/2 flex-shrink-0 overflow-y-auto pr-2 py-6">
                <ExpectedFilesTable
                  orderNumber={orderNumber}
                  onDataLoaded={(data) => setValidationRules(data.validation_rules || [])}
                />
                <ValidationRulesPanel rules={validationRules} />
              </div>

              {/* Right column — Validation Results + AI Files */}
              <div className="w-1/2 overflow-y-auto space-y-4 pr-6 py-6">
                {!hasFiles ? (
                  <div className="text-center py-8">
                    <FileType className="w-10 h-10 mx-auto text-gray-300" />
                    <p className="text-gray-600 mt-3">No AI files found in order folder</p>
                    <p className="text-sm text-gray-500 mt-1">
                      You can proceed without validation
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Status stickers */}
                    {validationResult && (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          validationResult.passed > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          {validationResult.passed} passed
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          validationResult.warnings > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {validationResult.warnings} warnings
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          (validationResult.failed + validationResult.errors) > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <XCircle className="w-3.5 h-3.5" />
                          {validationResult.failed + validationResult.errors} failed
                        </span>
                      </div>
                    )}

                    {/* Cross-Reference Summary — shows after validation completes */}
                    {validationResult && !validating && (
                      <CrossReferenceSummary results={validationResult.results} />
                    )}

                    {/* File List — Working File first */}
                    <div className="space-y-2">
                      <h3 className="font-medium text-gray-700">
                        Validation Results ({files.length})
                      </h3>
                      {[...files].sort((a, b) => {
                        const aIsWorking = a.file_name.toLowerCase().startsWith('working');
                        const bIsWorking = b.file_name.toLowerCase().startsWith('working');
                        if (aIsWorking && !bIsWorking) return -1;
                        if (!aIsWorking && bIsWorking) return 1;
                        return 0;
                      }).map((file) => {
                        const result = validationResult?.results.find(
                          (r) => r.file_path === file.file_path
                        );
                        return (
                          <FileCard
                            key={file.file_path}
                            file={file}
                            validationResult={result}
                            isValidating={validating}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${PAGE_STYLES.border} flex items-center justify-between`}>
          <button
            onClick={onSkipValidation}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            disabled={validating || approving}
          >
            Skip Validation
          </button>
          <div className="flex items-center gap-3">
            {validationResult && (
              <>
                <button
                  onClick={handleValidate}
                  disabled={validating}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-validate
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                    hasErrors
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {approving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Approving...
                    </>
                  ) : hasErrors ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      Approve Anyway
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Approve & Continue
                    </>
                  )}
                </button>
              </>
            )}
            {!hasFiles && (
              <button
                onClick={onApproveComplete}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiFileValidationModal;
