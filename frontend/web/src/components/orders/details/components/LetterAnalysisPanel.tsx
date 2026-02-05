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
import { LetterAnalysisResponse, LetterDetail, HoleDetail } from '../../../../types/aiFileValidation';
import LetterSvgPreview from './LetterSvgPreview';

interface LetterAnalysisPanelProps {
  analysis: LetterAnalysisResponse;
}

const HoleLegend: React.FC = () => (
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
  const wireCount = letter.holes?.filter(h => h.hole_type === 'wire').length || 0;
  const mountingCount = letter.holes?.filter(h => h.hole_type === 'mounting').length || 0;
  const unknownCount = letter.holes?.filter(h => h.hole_type === 'unknown').length || 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      {wireCount > 0 && (
        <span className="flex items-center gap-1 text-blue-600">
          <Circle className="w-3 h-3 fill-blue-500 text-blue-500" />
          {wireCount} wire
        </span>
      )}
      {mountingCount > 0 && (
        <span className="flex items-center gap-1 text-green-600">
          <Circle className="w-3 h-3 fill-green-500 text-green-500" />
          {mountingCount} mounting
        </span>
      )}
      {unknownCount > 0 && (
        <span className="flex items-center gap-1 text-orange-600">
          <Circle className="w-3 h-3 fill-orange-500 text-orange-500" />
          {unknownCount} unknown
        </span>
      )}
      {wireCount === 0 && mountingCount === 0 && unknownCount === 0 && (
        <span className="text-gray-400">No holes</span>
      )}
    </div>
  );
};

const LetterCard: React.FC<{
  letter: LetterDetail;
  index: number;
}> = ({ letter, index }) => {
  const [expanded, setExpanded] = useState(true);

  const wireCount = letter.holes?.filter(h => h.hole_type === 'wire').length || 0;

  const hasWarning = wireCount === 0 || wireCount > 1;

  return (
    <div className={`border rounded-lg overflow-hidden ${hasWarning ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200'}`}>
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${
          hasWarning ? 'bg-yellow-50/50' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">
                Letter {index + 1}
              </span>
              <span className="text-xs text-gray-400">
                ({letter.letter_id})
              </span>
              {hasWarning && (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {letter.real_size_inches?.width.toFixed(1)}" x {letter.real_size_inches?.height.toFixed(1)}"
            </div>
          </div>
        </div>
        <HoleStats letter={letter} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 border-t bg-white">
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
                    {letter.real_size_inches?.width.toFixed(1)}" x {letter.real_size_inches?.height.toFixed(1)}"
                  </dd>
                  <dt className="text-gray-500">Area:</dt>
                  <dd className="text-gray-800">{letter.real_area_sq_inches?.toFixed(1)} sq in</dd>
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
                      letter.holes.reduce<Record<string, { type: string; size: number; count: number }>>((acc, hole) => {
                        const size = hole.diameter_real_mm ?? hole.diameter_mm;
                        const key = `${hole.hole_type}_${size.toFixed(2)}`;
                        if (!acc[key]) {
                          acc[key] = { type: hole.hole_type, size, count: 0 };
                        }
                        acc[key].count++;
                        return acc;
                      }, {})
                    ).map(([key, { type, size, count }]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs py-1 px-2 bg-gray-50 rounded"
                      >
                        <span className={`capitalize ${
                          type === 'wire' ? 'text-blue-600' :
                          type === 'mounting' ? 'text-green-600' :
                          'text-orange-600'
                        }`}>
                          {type} x{count}
                        </span>
                        <span className="text-gray-500">
                          {size.toFixed(2)}mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {wireCount === 0 && (
                <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                  <span className="text-red-700">No wire hole found</span>
                </div>
              )}
              {wireCount > 1 && (
                <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <span className="text-yellow-700">{wireCount} wire holes (expected 1)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LayerGroup: React.FC<{
  layerName: string;
  letters: LetterDetail[];
}> = ({ layerName, letters }) => {
  const [expanded, setExpanded] = useState(false);

  const totalWire = letters.reduce((sum, l) => sum + (l.holes?.filter(h => h.hole_type === 'wire').length || 0), 0);
  const totalMounting = letters.reduce((sum, l) => sum + (l.holes?.filter(h => h.hole_type === 'mounting').length || 0), 0);
  const hasWarning = letters.some(l => {
    const wc = l.holes?.filter(h => h.hole_type === 'wire').length || 0;
    return wc === 0 || wc > 1;
  });

  return (
    <div className={`border rounded-lg overflow-hidden ${hasWarning ? 'border-yellow-300' : 'border-gray-200'}`}>
      <div
        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
          hasWarning ? 'bg-yellow-50' : 'bg-gray-50'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-medium text-gray-800">{layerName}</span>
          {hasWarning && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{letters.length} path{letters.length !== 1 ? 's' : ''}</span>
          <span>{totalWire} wire</span>
          <span>{totalMounting} mounting</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-2 bg-white">
          {letters.map((letter, index) => (
            <LetterCard key={letter.letter_id} letter={letter} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

const OrphanHolesWarning: React.FC<{ holes: HoleDetail[] }> = ({ holes }) => {
  const [expanded, setExpanded] = useState(true);

  if (!holes || holes.length === 0) return null;

  return (
    <div className="border border-red-300 rounded-lg overflow-hidden bg-red-50">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">
            {holes.length} Orphan Hole{holes.length !== 1 ? 's' : ''} (Outside Letters)
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-red-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-red-500" />
        )}
      </div>
      {expanded && (
        <div className="px-4 py-3 border-t border-red-200 bg-white">
          <p className="text-sm text-red-600 mb-3">
            These holes are not inside any detected letter. They may be misplaced or indicate a letter detection issue.
          </p>
          <div className="space-y-1">
            {holes.map((hole, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-2 px-3 bg-red-50 rounded"
              >
                <span className="text-gray-700">{hole.path_id}</span>
                <span className="text-gray-500">
                  {hole.hole_type} ({(hole.diameter_real_mm ?? hole.diameter_mm).toFixed(2)}mm)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LetterAnalysisPanel: React.FC<LetterAnalysisPanelProps> = ({ analysis }) => {
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
      <OrphanHolesWarning holes={analysis?.orphan_holes || []} />

      {/* Layer groups */}
      {layerEntries.length > 0 ? (
        <div className="space-y-2">
          {layerEntries.map(([layerName, layerLetters]) => (
            <LayerGroup key={layerName} layerName={layerName} letters={layerLetters} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <p>No letters detected in this file.</p>
          <p className="text-sm mt-1">
            Letters are identified as closed paths that are not contained within other paths.
          </p>
        </div>
      )}
    </div>
  );
};

export default LetterAnalysisPanel;
