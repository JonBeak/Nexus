/**
 * AI File Validation Modal
 * Modal for validating AI production files before approval
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileType,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';
import { aiFileValidationApi } from '../../../../services/api';
import {
  AiFileInfo,
  ValidateFilesResponse,
  ValidationIssue,
  ValidationStatus,
} from '../../../../types/aiFileValidation';
import ExpectedFilesTable from './ExpectedFilesTable';

interface AiFileValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onApproveComplete: () => void;
  onSkipValidation: () => void;
}

const StatusIcon: React.FC<{ status: ValidationStatus }> = ({ status }) => {
  switch (status) {
    case 'passed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-600" />;
    case 'pending':
    default:
      return <Info className="w-5 h-5 text-gray-400" />;
  }
};

const StatusBadge: React.FC<{ status: ValidationStatus }> = ({ status }) => {
  const colors: Record<ValidationStatus, string> = {
    passed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const IssueItem: React.FC<{ issue: ValidationIssue }> = ({ issue }) => {
  const [expanded, setExpanded] = useState(false);
  const severityColors: Record<string, string> = {
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className={`border rounded p-2 ${severityColors[issue.severity] || 'border-gray-200'}`}>
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => issue.details && setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {issue.severity === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
            {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
            {issue.severity === 'info' && <Info className="w-4 h-4 text-blue-500" />}
            <span className="text-sm font-medium text-gray-700">{issue.rule}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{issue.message}</p>
        </div>
        {issue.details && (
          <button className="p-1">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
      </div>
      {expanded && issue.details && (
        <div className="mt-2 p-2 bg-white rounded text-xs font-mono text-gray-600 overflow-x-auto">
          <pre>{JSON.stringify(issue.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

const FileCard: React.FC<{
  file: AiFileInfo;
  validationResult?: ValidateFilesResponse['results'][0];
  isValidating: boolean;
}> = ({ file, validationResult, isValidating }) => {
  const [expanded, setExpanded] = useState(false);

  const status = validationResult?.status || file.validation?.validation_status || 'pending';
  const issues = validationResult?.issues || file.validation?.issues || [];
  const hasIssues = issues.length > 0;
  const isSkipped = validationResult?.skipped_validation;
  const skipReason = validationResult?.skip_reason;

  return (
    <div className={`border rounded-lg overflow-hidden ${PAGE_STYLES.panel.background}`}>
      <div
        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50`}
        onClick={() => hasIssues && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <FileType className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium text-gray-800">{file.file_name}</p>
            <p className="text-xs text-gray-500">
              {(file.size_bytes / 1024).toFixed(1)} KB
              {isSkipped && skipReason && (
                <span className="ml-2 text-blue-600">• {skipReason}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isValidating ? (
            <Loader className="w-5 h-5 animate-spin text-indigo-500" />
          ) : isSkipped ? (
            <>
              <CheckCircle className="w-5 h-5 text-blue-500" />
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Exists
              </span>
            </>
          ) : (
            <>
              <StatusIcon status={status} />
              <StatusBadge status={status} />
            </>
          )}
          {hasIssues && (
            <span className="text-xs text-gray-500 ml-2">
              {issues.length} issue{issues.length !== 1 ? 's' : ''}
            </span>
          )}
          {hasIssues && (
            expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )
          )}
        </div>
      </div>
      {expanded && hasIssues && (
        <div className="border-t px-3 py-2 bg-gray-50 space-y-2">
          {issues.map((issue, idx) => (
            <IssueItem key={idx} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
};

const AiFileValidationModal: React.FC<AiFileValidationModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onApproveComplete,
  onSkipValidation,
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  const [files, setFiles] = useState<AiFileInfo[]>([]);
  const [validationResult, setValidationResult] = useState<ValidateFilesResponse | null>(null);
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
    try {
      const result = await aiFileValidationApi.listFiles(orderNumber);
      setFiles(result);
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

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current
      ? !modalContentRef.current.contains(e.target as Node)
      : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (
      mouseDownOutsideRef.current &&
      modalContentRef.current &&
      !modalContentRef.current.contains(e.target as Node)
    ) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

  if (!isOpen) return null;

  const hasFiles = files && files.length > 0;
  const hasErrors = validationResult && (validationResult.failed > 0 || validationResult.errors > 0);
  const hasWarnings = validationResult && validationResult.warnings > 0;
  const allPassed = validationResult && !hasErrors;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`${PAGE_STYLES.panel.background} rounded-lg shadow-2xl max-w-[700px] w-full max-h-[85vh] flex flex-col`}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="ml-3 text-gray-600">Loading AI files...</span>
            </div>
          ) : error ? (
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
          ) : !hasFiles ? (
            <div className="space-y-6">
              {/* Expected Files Comparison (Rule-Based) - show even when no files */}
              <ExpectedFilesTable orderNumber={orderNumber} />

              <div className="text-center py-8">
                <FileType className="w-10 h-10 mx-auto text-gray-300" />
                <p className="text-gray-600 mt-3">No AI files found in order folder</p>
                <p className="text-sm text-gray-500 mt-1">
                  You can proceed without validation
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Expected Files Comparison (Rule-Based) */}
              <ExpectedFilesTable orderNumber={orderNumber} />

              {/* Validation Summary */}
              {validationResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    hasErrors
                      ? 'bg-red-50 border-red-200'
                      : hasWarnings
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {hasErrors ? (
                      <XCircle className="w-6 h-6 text-red-500" />
                    ) : hasWarnings ? (
                      <AlertTriangle className="w-6 h-6 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                    <div>
                      <p
                        className={`font-medium ${
                          hasErrors ? 'text-red-800' : hasWarnings ? 'text-yellow-800' : 'text-green-800'
                        }`}
                      >
                        {hasErrors
                          ? 'Validation Failed'
                          : hasWarnings
                          ? 'Passed with Warnings'
                          : 'All Files Passed'}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {validationResult.passed} passed, {validationResult.warnings} warnings,{' '}
                        {validationResult.failed + validationResult.errors} failed
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* File List */}
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700 mb-2">
                  AI Files ({files.length})
                </h3>
                {files.map((file) => {
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
            {hasFiles && !validationResult && (
              <button
                onClick={handleValidate}
                disabled={validating || loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {validating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Validate All
                  </>
                )}
              </button>
            )}
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
