/**
 * Issue Display Components
 * StatusIcon, StatusBadge, IssueItem, LayerSubGroup, IssueGroup
 * for AI File Validation Modal
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  ValidationIssue,
  ValidationStatus,
  LetterAnalysisResponse,
} from '../../../../../types/aiFileValidation';
import LetterSvgPreview from '../LetterSvgPreview';

export const StatusIcon: React.FC<{ status: ValidationStatus }> = ({ status }) => {
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

export const StatusBadge: React.FC<{ status: ValidationStatus }> = ({ status }) => {
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

export const IssueItem: React.FC<{ issue: ValidationIssue; letterAnalysis?: LetterAnalysisResponse }> = ({ issue, letterAnalysis }) => {
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

        // Specialized rendering for mounting hole requirements
        if (issue.rule === 'front_lit_mounting_holes') {
          const d = issue.details;
          return (
            <div className="mt-2 p-2 bg-white rounded flex gap-4">
              {matchedLetter && (
                <div className="flex-shrink-0">
                  <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="font-medium text-gray-500">Required</dt>
                  <dd className="text-gray-700">{d.required_holes} mounting holes</dd>
                  <dt className="font-medium text-gray-500">Detected</dt>
                  <dd className="text-gray-700">{d.actual_holes} mounting holes</dd>
                  {d.mounting_std_name && (
                    <>
                      <dt className="font-medium text-gray-500">Expected size</dt>
                      <dd className="text-gray-700">{d.mounting_std_name} ({d.mounting_std_diameter_mm}mm)</dd>
                    </>
                  )}
                  <dt className="font-medium text-gray-500">Letter size</dt>
                  <dd className="text-gray-700">{d.real_perimeter_inches}&quot; perimeter, {d.real_area_sq_inches} sq in</dd>
                </dl>
                {d.unknown_hole_count > 0 && (
                  <div className="border border-orange-200 bg-orange-50 rounded p-2">
                    <p className="text-xs font-medium text-orange-700 mb-1">
                      {d.unknown_hole_count} unknown hole{d.unknown_hole_count !== 1 ? 's' : ''} detected
                    </p>
                    {d.unknown_holes && (
                      <ul className="text-xs text-orange-600 space-y-0.5">
                        {(d.unknown_holes as Array<{ path_id: string; diameter_real_mm: number }>).map(
                          (h: { path_id: string; diameter_real_mm: number }) => (
                            <li key={h.path_id}>{h.path_id}: {h.diameter_real_mm}mm diameter</li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Default rendering for all other rules
        const detailEntries = Object.entries(issue.details).filter(([key]) => key !== 'path_id' && key !== 'layer');

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

export const LayerSubGroup: React.FC<{
  layer: string;
  issues: ValidationIssue[];
  severity: string;
  letterAnalysis?: LetterAnalysisResponse;
}> = ({ layer, issues, severity, letterAnalysis }) => {
  const [expanded, setExpanded] = useState(false);
  const severityColors: Record<string, string> = {
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };

  if (issues.length === 1) {
    return (
      <div className={`border rounded-lg overflow-hidden ${severityColors[severity] || 'border-gray-200'}`}>
        <div className="px-3 py-2">
          <span className="text-sm font-medium text-gray-700">{layer}</span>
        </div>
        <div className="px-3 pb-3">
          <IssueItem issue={issues[0]} letterAnalysis={letterAnalysis} />
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${severityColors[severity] || 'border-gray-200'}`}>
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{layer}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${severityBadgeColor(severity)}`}>
            {issues.length}
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

// Friendly labels for rule identifiers
const RULE_LABELS: Record<string, string> = {
  unknown_hole_size: 'Unusual Hole Sizes',
  front_lit_mounting_holes: 'Mounting Hole Requirements',
  front_lit_trim_count: 'Trim/Return Count Mismatch',
  front_lit_trim_offset: 'Trim Offset',
  letter_no_wire_hole: 'Missing Wire Holes',
  letter_multiple_wire_holes: 'Multiple Wire Holes',
  unexpected_mounting_type: 'Unexpected Mounting Type',
};

const severityLabel = (severity: string, count: number): string => {
  if (severity === 'error') return count === 1 ? 'error' : 'errors';
  if (severity === 'info') return count === 1 ? 'notice' : 'notices';
  return count === 1 ? 'warning' : 'warnings';
};

const severityBadgeColor = (severity: string): string => {
  if (severity === 'error') return 'bg-red-200 text-red-800';
  if (severity === 'info') return 'bg-blue-200 text-blue-800';
  return 'bg-yellow-200 text-yellow-800';
};

export const IssueGroup: React.FC<{
  rule: string;
  issues: ValidationIssue[];
  letterAnalysis?: LetterAnalysisResponse;
}> = ({ rule, issues, letterAnalysis }) => {
  const [expanded, setExpanded] = useState(false);

  const severity = issues[0].severity;
  const severityColors: Record<string, string> = {
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };

  if (issues.length === 1) {
    return <IssueItem issue={issues[0]} letterAnalysis={letterAnalysis} />;
  }

  const hasLayers = issues.some(i => i.details?.layer);
  const layerGroups = hasLayers
    ? issues.reduce<Record<string, ValidationIssue[]>>((acc, issue) => {
        const layer = (issue.details?.layer as string) || 'Unknown';
        if (!acc[layer]) acc[layer] = [];
        acc[layer].push(issue);
        return acc;
      }, {})
    : null;

  const displayLabel = RULE_LABELS[rule] || rule;

  return (
    <div className={`border rounded-lg overflow-hidden ${severityColors[severity] || 'border-gray-200'}`}>
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {severity === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
          {severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
          {severity === 'info' && <Info className="w-4 h-4 text-blue-500" />}
          <span className="text-sm font-medium text-gray-700">{displayLabel}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${severityBadgeColor(severity)}`}>
            {issues.length} {severityLabel(severity, issues.length)}
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
          {layerGroups ? (
            Object.entries(layerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([layer, layerIssues]) => (
              <LayerSubGroup key={layer} layer={layer} issues={layerIssues} severity={severity} letterAnalysis={letterAnalysis} />
            ))
          ) : (
            issues.map((issue, idx) => (
              <IssueItem key={idx} issue={issue} letterAnalysis={letterAnalysis} />
            ))
          )}
        </div>
      )}
    </div>
  );
};
