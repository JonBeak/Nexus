/**
 * Letter Analysis Panel Component
 *
 * Displays letter-hole association analysis results grouped by layer.
 * Each layer is an expandable section showing its letters with holes,
 * SVG previews, and measurements.
 *
 * Panel structure:
 * - Scale info + hole legend
 * - Orphan holes warning (if any)
 * - Layer groups (each expandable)
 *   - Letter cards (each expandable)
 *     - SVG preview with grid
 *     - Details (size, area, hole counts)
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Circle,
  Info,
} from 'lucide-react';
import { LetterAnalysisResponse, LetterDetail } from '../../../../types/aiFileValidation';
import LetterSvgPreview from './LetterSvgPreview';
import LayerSvgOverview from './LayerSvgOverview';
import OrphanHolesPanel from './OrphanHolesPanel';

interface LetterAnalysisPanelProps {
  analysis: LetterAnalysisResponse;
}

export const HoleLegend: React.FC = () => (
  <div className="flex items-center gap-4 text-xs text-gray-500">
    <span className="flex items-center gap-1">
      <Circle className="w-3 h-3 fill-blue-500 text-blue-500" />
      Wire
    </span>
    <span className="flex items-center gap-1">
      <Circle className="w-3 h-3 fill-green-500 text-green-500" />
      Mounting
    </span>
    <span className="flex items-center gap-1">
      <Circle className="w-3 h-3 fill-orange-500 text-orange-500" />
      Unknown
    </span>
  </div>
);

const HoleStats: React.FC<{ letter: LetterDetail }> = ({ letter }) => {
  // Group holes by type, using matched_name for display when available
  const groups = (letter.holes || []).reduce<Record<string, { count: number; color: string; dotColor: string }>>((acc, h) => {
    const label = h.matched_name || h.hole_type;
    const color = h.hole_type === 'wire' ? 'text-blue-600' : h.hole_type === 'mounting' ? 'text-green-600' : 'text-orange-600';
    const dotColor = h.hole_type === 'wire' ? 'fill-blue-500 text-blue-500' : h.hole_type === 'mounting' ? 'fill-green-500 text-green-500' : 'fill-orange-500 text-orange-500';
    if (!acc[label]) acc[label] = { count: 0, color, dotColor };
    acc[label].count++;
    return acc;
  }, {});

  const entries = Object.entries(groups);

  return (
    <div className="flex items-center gap-3 text-sm">
      {entries.map(([label, { count, color, dotColor }]) => (
        <span key={label} className={`flex items-center gap-1 ${color}`}>
          <Circle className={`w-3 h-3 ${dotColor}`} />
          {count} {label}
        </span>
      ))}
      {entries.length === 0 && (
        <span className="text-gray-400">No holes</span>
      )}
    </div>
  );
};

const LetterCard: React.FC<{
  letter: LetterDetail;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}> = ({ letter, index, expanded, onToggle }) => {

  const issues = letter.issues || [];
  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = !hasError && issues.some(i => i.severity === 'warning');
  const borderClass = hasError ? 'border-red-300'
                    : hasWarning ? 'border-yellow-300'
                    : 'border-purple-300';

  return (
    <div id={`letter-${letter.letter_id}`} className={`border rounded-lg overflow-hidden ${borderClass}`}>
      {/* Header */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
          hasError ? 'bg-red-100/60 hover:bg-red-100' : hasWarning ? 'bg-yellow-100/60 hover:bg-yellow-100' : 'bg-purple-100 hover:bg-purple-100/60'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-purple-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-purple-400" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-purple-900">
                Letter {index + 1}
              </span>
              <span className="text-xs text-purple-400">
                ({letter.letter_id})
              </span>
              {(hasError || hasWarning) && (
                <AlertTriangle className={`w-4 h-4 ${hasError ? 'text-red-500' : 'text-yellow-500'}`} />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {letter.real_size_inches?.width.toFixed(1)}" W x {letter.real_size_inches?.height.toFixed(1)}" H
            </div>
          </div>
        </div>
        <HoleStats letter={letter} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 border-t border-purple-300 bg-white">
          <div className="flex gap-6">
            {/* SVG Preview */}
            <div className="flex-shrink-0">
              <LetterSvgPreview
                letter={letter}
                maxWidth={220}
                maxHeight={180}
                showGrid={true}
                showRuler={true}
              />
            </div>

            {/* Details */}
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-gray-500">Size:</dt>
                  <dd className="text-gray-800">
                    {letter.real_size_inches?.width.toFixed(1)}" W x {letter.real_size_inches?.height.toFixed(1)}" H
                  </dd>
                  <dt className="text-gray-500">Perimeter:</dt>
                  <dd className="text-gray-800">{letter.real_perimeter_inches?.toFixed(1)}"</dd>
                  <dt className="text-gray-500">Area:</dt>
                  <dd className="text-gray-800">{letter.real_area_sq_inches?.toFixed(1)} in<sup>2</sup></dd>
                  <dt className="text-gray-500">Scale:</dt>
                  <dd className="text-gray-800">
                    {letter.detected_scale === 0.1 ? '10%' : '100%'}
                  </dd>
                </dl>
              </div>

              {/* Holes list */}
              {letter.holes && letter.holes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Holes ({letter.holes.length})</h4>
                  <div className="space-y-1">
                    {Object.entries(
                      letter.holes.reduce<Record<string, { type: string; name: string; size: number; count: number }>>((acc, hole) => {
                        const size = hole.diameter_real_mm ?? hole.diameter_mm;
                        const key = `${hole.hole_type}_${size.toFixed(2)}`;
                        if (!acc[key]) {
                          acc[key] = { type: hole.hole_type, name: hole.matched_name || '', size, count: 0 };
                        }
                        acc[key].count++;
                        return acc;
                      }, {})
                    ).map(([key, { type, name, size, count }]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs py-1 px-2 bg-gray-50 rounded"
                      >
                        <span className={`${
                          type === 'wire' ? 'text-blue-600' :
                          type === 'mounting' ? 'text-green-600' :
                          'text-orange-600'
                        }`}>
                          {name || type} x{count}
                        </span>
                        <span className="text-gray-500">
                          {size.toFixed(2)}mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Backend-driven issues */}
              {issues.filter(i => i.severity !== 'info').map((issue, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded text-sm ${
                  issue.severity === 'error' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    issue.severity === 'error' ? 'text-red-500' : 'text-yellow-500'
                  }`} />
                  <span className={issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}>
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const LayerGroup: React.FC<{
  layerName: string;
  letters: LetterDetail[];
}> = ({ layerName, letters }) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedLetterIds, setExpandedLetterIds] = useState<Set<string>>(new Set());

  const totalWire = letters.reduce((sum, l) => sum + (l.holes?.filter(h => h.hole_type === 'wire').length || 0), 0);
  const totalMounting = letters.reduce((sum, l) => sum + (l.holes?.filter(h => h.hole_type === 'mounting').length || 0), 0);
  const totalPerimeter = letters.reduce((sum, l) => sum + (l.real_perimeter_inches || 0), 0);
  const totalArea = letters.reduce((sum, l) => sum + (l.real_area_sq_inches || 0), 0);
  const hasError = letters.some(l => l.issues?.some(i => i.severity === 'error'));
  const hasWarning = !hasError && letters.some(l => l.issues?.some(i => i.severity === 'warning'));
  const hasIssue = hasError || hasWarning;

  return (
    <div className={`border rounded-lg overflow-hidden ${hasError ? 'border-red-300' : hasWarning ? 'border-yellow-300' : 'border-indigo-200'}`}>
      <div
        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
          hasError ? 'bg-red-50' : hasWarning ? 'bg-yellow-50' : 'bg-indigo-100'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-indigo-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-indigo-400" />
          )}
          <span className="font-semibold text-indigo-900">{layerName}</span>
          {hasIssue && <AlertTriangle className={`w-4 h-4 ${hasError ? 'text-red-500' : 'text-yellow-500'}`} />}
        </div>
        <div className="text-sm text-indigo-600 text-right space-y-1">
          <div className="flex items-center gap-4 justify-end">
            <span>{letters.length} path{letters.length !== 1 ? 's' : ''}</span>
            <span>{totalWire} wire</span>
            <span>{totalMounting} mounting</span>
          </div>
          <div className="flex items-center gap-4 justify-end text-indigo-400">
            <span>{totalPerimeter.toFixed(1)}" perim</span>
            <span>{totalArea.toFixed(1)} in<sup>2</sup> area</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-2 bg-indigo-100/50 border-t border-indigo-200">
          <LayerSvgOverview
            letters={letters}
            onLetterClick={(letterId) => {
              setExpandedLetterIds(prev => new Set(prev).add(letterId));
              setTimeout(() => {
                document.getElementById(`letter-${letterId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }}
          />
          {letters.map((letter, index) => (
            <LetterCard
              key={letter.letter_id}
              letter={letter}
              index={index}
              expanded={expandedLetterIds.has(letter.letter_id)}
              onToggle={() => setExpandedLetterIds(prev => {
                const next = new Set(prev);
                if (next.has(letter.letter_id)) next.delete(letter.letter_id);
                else next.add(letter.letter_id);
                return next;
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const LetterAnalysisPanel: React.FC<LetterAnalysisPanelProps> = ({ analysis }) => {
  // Debug: log unclassified paths to diagnose missing letters
  const rawAnalysis = analysis as any;
  if (rawAnalysis?.unprocessed_paths?.length) {
    console.table(rawAnalysis.unprocessed_paths);
  }
  console.log('[LetterAnalysis] Stats:', rawAnalysis?.stats);

  const letters = analysis?.letters || [];

  // Group letters by layer name
  const layerGroups = useMemo(() => {
    const groups: Record<string, LetterDetail[]> = {};
    for (const letter of letters) {
      const layer = letter.layer_name || 'Unknown';
      if (!groups[layer]) groups[layer] = [];
      groups[layer].push(letter);
    }
    return groups;
  }, [letters]);

  const layerEntries = Object.entries(layerGroups);

  return (
    <div className="space-y-3">
      {/* Scale info + legend */}
      <div className="flex items-center gap-2 text-sm">
        <Info className="w-4 h-4 text-blue-500" />
        <span className="text-gray-600">
          Detected scale: {analysis?.detected_scale === 0.1 ? '10%' : '100%'}
        </span>
        <HoleLegend />
      </div>

      {/* Orphan holes warning */}
      <OrphanHolesPanel holes={analysis?.orphan_holes || []} />

      {/* Layer groups */}
      {layerEntries.length > 0 && (
        <div className="space-y-2">
          {layerEntries.map(([layerName, layerLetters]) => (
            <LayerGroup key={layerName} layerName={layerName} letters={layerLetters} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LetterAnalysisPanel;
