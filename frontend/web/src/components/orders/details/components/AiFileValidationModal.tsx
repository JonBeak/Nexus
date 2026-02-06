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
  ValidationRuleDisplay,
  LetterAnalysisResponse,
  ExpectedFilesComparison,
} from '../../../../types/aiFileValidation';
import ExpectedFilesTable from './ExpectedFilesTable';
import ValidationRulesPanel from './ValidationRulesPanel';
import LetterAnalysisPanel from './LetterAnalysisPanel';
import LetterSvgPreview from './LetterSvgPreview';

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

const IssueItem: React.FC<{ issue: ValidationIssue; letterAnalysis?: LetterAnalysisResponse }> = ({ issue, letterAnalysis }) => {
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
          <p className="text-sm text-gray-600">{issue.message}</p>
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
      {expanded && issue.details && (() => {
        const matchedLetter = issue.path_id && letterAnalysis?.letters
          ? letterAnalysis.letters.find(l => l.letter_id === issue.path_id)
          : undefined;
        const detailEntries = Object.entries(issue.details).filter(([key]) => key !== 'path_id');

        return (
          <div className="mt-2 p-2 bg-white rounded flex gap-4">
            {matchedLetter && (
              <div className="flex-shrink-0">
                <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} />
              </div>
            )}
            {detailEntries.length > 0 && (
              <div className="flex-1 min-w-0">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {detailEntries.map(([key, value]) => (
                    <React.Fragment key={key}>
                      <dt className="font-medium text-gray-500 whitespace-nowrap">{key.replace(/_/g, ' ')}</dt>
                      <dd className="text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

const IssueGroup: React.FC<{ rule: string; issues: ValidationIssue[]; letterAnalysis?: LetterAnalysisResponse }> = ({ rule, issues, letterAnalysis }) => {
  const [expanded, setExpanded] = useState(false);

  const severity = issues[0].severity;
  const severityColors: Record<string, string> = {
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };

  // Extract layer name from first issue's details, fall back to rule name
  const layerName = issues[0]?.details?.layer as string | undefined;
  const displayLabel = layerName || rule;

  // Single issue — render inline without grouping
  if (issues.length === 1) {
    return <IssueItem issue={issues[0]} letterAnalysis={letterAnalysis} />;
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${severityColors[severity] || 'border-gray-200'}`}>
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {severity === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
          {severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
          <span className="text-sm font-medium text-gray-700">{displayLabel}</span>
          <span className="text-xs text-gray-400">{rule}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
            severity === 'error' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
          }`}>
            {issues.length} {severity === 'error' ? 'errors' : 'warnings'}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {issues.map((issue, idx) => (
            <IssueItem key={idx} issue={issue} letterAnalysis={letterAnalysis} />
          ))}
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
  const allIssues = validationResult?.issues || file.validation?.issues || [];
  const stats = validationResult?.stats;
  const letterAnalysis = stats?.letter_analysis as LetterAnalysisResponse | undefined;

  // Separate info messages (summary) from actual issues (errors/warnings)
  const issues = allIssues.filter(i => i.severity !== 'info');
  const infoMessages = allIssues.filter(i => i.severity === 'info');
  const hasIssues = issues.length > 0;
  const hasLetterAnalysis = letterAnalysis && Array.isArray(letterAnalysis.letters) && letterAnalysis.letters.length > 0;
  const hasSummary = infoMessages.length > 0;
  const hasContent = hasIssues || hasLetterAnalysis || hasSummary;
  const isSkipped = validationResult?.skipped_validation;
  const skipReason = validationResult?.skip_reason;

  return (
    <div className={`border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm ${PAGE_STYLES.panel.background}`}>
      <div
        className={`p-3 flex items-center justify-between cursor-pointer bg-gray-100 hover:bg-gray-150 transition-colors`}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <FileType className="w-5 h-5 text-gray-500" />
          <div>
            <p className="font-medium text-gray-800">{file.file_name}</p>
            <p className="text-xs text-gray-500">
              {(file.size_bytes / 1024).toFixed(1)} KB
              {isSkipped && skipReason && (
                <span className="ml-2 text-blue-600">• {skipReason}</span>
              )}
              {hasLetterAnalysis && (
                <span className="ml-2 text-indigo-600">
                  • {letterAnalysis.stats?.total_letters || letterAnalysis.letters.length} letters
                </span>
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
          {hasContent && (
            expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )
          )}
        </div>
      </div>
      {expanded && hasContent && (
        <div className="border-t-2 border-gray-400 px-3 py-3 bg-gray-50 space-y-3">
          {/* Summary (info messages) */}
          {hasSummary && (
            <div className="flex flex-wrap gap-2">
              {infoMessages.map((info, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700"
                >
                  <CheckCircle className="w-3 h-3" />
                  {info.message
                    .replace(/^Found /, '')
                    .replace(/(\d+) (\w+)\(s\)/, (_, n, word) => `${n} ${n === '1' ? word : word + 's'}`)}
                </span>
              ))}
            </div>
          )}
          {/* Issues (errors/warnings only) — grouped by rule, errors first */}
          {hasIssues && (() => {
            const grouped = issues.reduce<Record<string, ValidationIssue[]>>((acc, issue) => {
              if (!acc[issue.rule]) acc[issue.rule] = [];
              acc[issue.rule].push(issue);
              return acc;
            }, {});

            // Sort: error groups first, then warning groups
            const sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => {
              const aIsError = a[0].severity === 'error' ? 0 : 1;
              const bIsError = b[0].severity === 'error' ? 0 : 1;
              return aIsError - bIsError;
            });

            return (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">
                  Issues ({issues.length})
                </h4>
                {sortedEntries.map(([rule, groupIssues]) => (
                  <IssueGroup key={rule} rule={rule} issues={groupIssues} letterAnalysis={letterAnalysis} />
                ))}
              </div>
            );
          })()}
          {/* Letter Analysis */}
          {hasLetterAnalysis && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">
                Letter Analysis
              </h4>
              <LetterAnalysisPanel analysis={letterAnalysis} />
            </div>
          )}
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

                    {/* File List */}
                    <div className="space-y-2">
                      <h3 className="font-medium text-gray-700">
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
