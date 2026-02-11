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
        // For hole_centering, path_id is the hole ID — look up by details.letter_id instead
        const letterLookupId = issue.rule === 'hole_centering' && issue.details?.letter_id
          ? issue.details.letter_id as string
          : issue.path_id;
        const matchedLetter = letterLookupId && letterAnalysis?.letters
          ? letterAnalysis.letters.find(l => l.letter_id === letterLookupId)
          : undefined;

        // Specialized rendering for mounting hole requirements
        if (issue.rule === 'front_lit_mounting_holes' || issue.rule === 'acrylic_face_mounting_holes') {
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

        // Specialized rendering for hole centering issues
        if (issue.rule === 'hole_centering') {
          const d = issue.details;
          return (
            <div className="mt-2 p-2 bg-white rounded flex gap-4">
              {matchedLetter && (
                <div className="flex-shrink-0">
                  <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} highlightHoleIds={issue.path_id ? [issue.path_id] : undefined} />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {d.hole_matched_name && (
                    <>
                      <dt className="font-medium text-gray-500">Hole type</dt>
                      <dd className="text-gray-700">{d.hole_matched_name}</dd>
                    </>
                  )}
                  {d.d_min_inches != null && (
                    <>
                      <dt className="font-medium text-gray-500">Nearest edge</dt>
                      <dd className="text-gray-700">{Number(d.d_min_inches).toFixed(2)}&quot;</dd>
                    </>
                  )}
                  {d.d_opposite_inches != null && (
                    <>
                      <dt className="font-medium text-gray-500">Opposite edge</dt>
                      <dd className="text-gray-700">{Number(d.d_opposite_inches).toFixed(2)}&quot;</dd>
                    </>
                  )}
                  {d.centering_ratio != null && (
                    <>
                      <dt className="font-medium text-gray-500">Centering ratio</dt>
                      <dd className="text-gray-700">{(Number(d.centering_ratio) * 100).toFixed(0)}%</dd>
                    </>
                  )}
                  {d.min_edge_distance_inches != null && (
                    <>
                      <dt className="font-medium text-gray-500">Min edge distance</dt>
                      <dd className="text-gray-700">{Number(d.min_edge_distance_inches).toFixed(2)}&quot;</dd>
                    </>
                  )}
                </dl>
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

// --- Letter grouping helpers ---

/** Returns details.letter_id if the issue has one (e.g. hole_centering, unknown_hole_size) */
const getLetterIdForIssue = (issue: ValidationIssue): string | undefined => {
  return issue.details?.letter_id as string | undefined;
};

/** Split issues into letter-based groups and ungrouped remainder */
const groupIssuesByLetter = (issues: ValidationIssue[]): {
  letterGroups: Record<string, ValidationIssue[]>;
  ungrouped: ValidationIssue[];
} => {
  const letterGroups: Record<string, ValidationIssue[]> = {};
  const ungrouped: ValidationIssue[] = [];
  for (const issue of issues) {
    const letterId = getLetterIdForIssue(issue);
    if (letterId) {
      if (!letterGroups[letterId]) letterGroups[letterId] = [];
      letterGroups[letterId].push(issue);
    } else {
      ungrouped.push(issue);
    }
  }
  return { letterGroups, ungrouped };
};

/** Compact row for a single hole inside a LetterSubGroup */
const HoleRow: React.FC<{ issue: ValidationIssue }> = ({ issue }) => {
  const d = issue.details || {};
  const severityColors: Record<string, string> = {
    error: 'text-red-700',
    warning: 'text-yellow-700',
    info: 'text-blue-700',
  };
  return (
    <div className="flex items-center gap-3 text-xs py-1">
      <span className={`font-medium ${severityColors[issue.severity] || 'text-gray-700'}`}>
        {issue.path_id || 'hole'}
      </span>
      {d.hole_matched_name && <span className="text-gray-600">{d.hole_matched_name}</span>}
      {d.d_min_inches != null && <span className="text-gray-500">edge {Number(d.d_min_inches).toFixed(2)}&quot;</span>}
      {d.centering_ratio != null && <span className="text-gray-500">{(Number(d.centering_ratio) * 100).toFixed(0)}% centered</span>}
      {d.diameter_real_mm != null && <span className="text-gray-500">{Number(d.diameter_real_mm).toFixed(2)}mm</span>}
    </div>
  );
};

export const LetterSubGroup: React.FC<{
  letterId: string;
  issues: ValidationIssue[];
  severity: string;
  letterAnalysis?: LetterAnalysisResponse;
}> = ({ letterId, issues, severity, letterAnalysis }) => {
  const [expanded, setExpanded] = useState(false);
  const matchedLetter = letterAnalysis?.letters?.find(l => l.letter_id === letterId);
  const highlightHoleIds = issues.map(i => i.path_id).filter(Boolean) as string[];

  const severityColors: Record<string, string> = {
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${severityColors[severity] || 'border-gray-200'}`}>
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{letterId}</span>
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
        <div className="px-3 pb-3">
          <div className="flex gap-4">
            {matchedLetter && (
              <div className="flex-shrink-0">
                <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} highlightHoleIds={highlightHoleIds} />
              </div>
            )}
            <div className="flex-1 min-w-0 divide-y divide-gray-100">
              {issues.map((issue, idx) => (
                <HoleRow key={idx} issue={issue} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Renders issues with letter grouping when applicable, otherwise flat IssueItems */
const renderIssuesWithLetterGrouping = (
  issues: ValidationIssue[],
  severity: string,
  letterAnalysis?: LetterAnalysisResponse,
) => {
  const { letterGroups, ungrouped } = groupIssuesByLetter(issues);
  const hasLetterGroups = Object.keys(letterGroups).length > 0;

  if (!hasLetterGroups) {
    return issues.map((issue, idx) => (
      <IssueItem key={idx} issue={issue} letterAnalysis={letterAnalysis} />
    ));
  }

  return (
    <>
      {Object.entries(letterGroups).sort(([a], [b]) => a.localeCompare(b)).map(([letterId, letterIssues]) => (
        <LetterSubGroup key={letterId} letterId={letterId} issues={letterIssues} severity={severity} letterAnalysis={letterAnalysis} />
      ))}
      {ungrouped.map((issue, idx) => (
        <IssueItem key={`ungrouped-${idx}`} issue={issue} letterAnalysis={letterAnalysis} />
      ))}
    </>
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
          {renderIssuesWithLetterGrouping(issues, severity, letterAnalysis)}
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
  acrylic_face_mounting_holes: 'Mounting Hole Requirements',
  acrylic_face_count: 'Face/Return Count Mismatch',
  acrylic_face_offset: 'Face Offset',
  acrylic_face_missing: 'Face Layer Missing',
  acrylic_face_spacing: 'Face Spacing',
  acrylic_face_engraving_missing: 'Missing Engraving Path',
  hole_centering: 'Hole Centering',
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
            renderIssuesWithLetterGrouping(issues, severity, letterAnalysis)
          )}
        </div>
      )}
    </div>
  );
};
