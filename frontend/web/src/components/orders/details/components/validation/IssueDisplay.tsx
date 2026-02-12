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
import {
  MountingHolesRenderer,
  HoleCenteringRenderer,
  SharpCornersRenderer,
  DefaultIssueRenderer,
} from './IssueRenderers';

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

/** Resolves the matched letter and dispatches to the appropriate renderer */
const IssueDetailContent: React.FC<{ issue: ValidationIssue; letterAnalysis?: LetterAnalysisResponse }> = ({ issue, letterAnalysis }) => {
  const letterLookupId = issue.rule === 'hole_centering' && issue.details?.letter_id
    ? issue.details.letter_id as string
    : issue.path_id;
  const matchedLetter = letterLookupId && letterAnalysis?.letters
    ? letterAnalysis.letters.find(l => l.letter_id === letterLookupId)
    : undefined;

  if (issue.rule === 'front_lit_mounting_holes' || issue.rule === 'acrylic_face_mounting_holes') {
    return <MountingHolesRenderer issue={issue} matchedLetter={matchedLetter} />;
  }
  if (issue.rule === 'hole_centering') {
    return <HoleCenteringRenderer issue={issue} matchedLetter={matchedLetter} />;
  }
  if (issue.rule === 'push_thru_sharp_corners') {
    return <SharpCornersRenderer issue={issue} matchedLetter={matchedLetter} />;
  }
  return <DefaultIssueRenderer issue={issue} matchedLetter={matchedLetter} />;
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
      {expanded && issue.details && <IssueDetailContent issue={issue} letterAnalysis={letterAnalysis} />}
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
  push_thru_sharp_corners: 'Sharp Corners',
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
