/**
 * FileCard Component
 * Per-file card for AI File Validation Modal
 */

import React, { useState } from 'react';
import {
  FileType,
  CheckCircle,
  Loader,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../../../constants/moduleColors';
import {
  AiFileInfo,
  ValidateFilesResponse,
  ValidationIssue,
  LetterAnalysisResponse,
} from '../../../../../types/aiFileValidation';
import { StatusIcon, StatusBadge, IssueGroup } from './IssueDisplay';
import LetterAnalysisPanel from '../LetterAnalysisPanel';

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
  const fileType = validationResult?.file_type;

  // Separate info messages (summary) from actual issues (errors/warnings)
  const issues = allIssues.filter(i => i.severity !== 'info');
  const infoMessages = allIssues.filter(i => i.severity === 'info');
  const hasIssues = issues.length > 0;
  const hasLetterAnalysis = letterAnalysis && Array.isArray(letterAnalysis.letters) && letterAnalysis.letters.length > 0;
  const hasSummary = infoMessages.length > 0;
  const hasContent = hasIssues || hasLetterAnalysis || hasSummary;

  return (
    <div className={`border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm ${PAGE_STYLES.panel.background}`}>
      <div
        className={`p-3 flex items-center justify-between cursor-pointer bg-gray-100 hover:bg-gray-150 transition-colors`}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <FileType className="w-5 h-5 text-gray-500" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-800">{file.file_name}</p>
              {fileType && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  fileType === 'working'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {fileType === 'working' ? 'Working' : 'Cutting'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {(file.size_bytes / 1024).toFixed(1)} KB
              {fileType === 'cutting' && stats?.detected_scale != null && (
                <span className="ml-2 text-purple-600">
                  • {Math.round(stats.detected_scale * 100)}% scale
                </span>
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

export default FileCard;
