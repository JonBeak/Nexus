/**
 * FileStructurePanel Component
 *
 * Always-visible Layers > Paths breakdown for validated AI files.
 * Shows layer structure with path/letter counts regardless of spec type.
 *
 * - Layers with detected letters render rich LayerGroup (SVG previews, holes, measurements)
 * - Layers without letters render BasicLayerGroup (path count, open/closed breakdown)
 * - Orphan holes always shown as errors
 * - Path accounting summary at bottom
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
} from 'lucide-react';
import {
  ValidationStats,
  LetterAnalysisResponse,
  UnprocessedPath,
  PathAccounting,
} from '../../../../../types/aiFileValidation';
import { HoleLegend, LayerGroup } from '../LetterAnalysisPanel';
import OrphanHolesPanel from '../OrphanHolesPanel';

interface FileStructurePanelProps {
  stats: ValidationStats;
  letterAnalysis?: LetterAnalysisResponse;
}

/** Compact layer row for layers with no detected letters */
const BasicLayerGroup: React.FC<{
  layerName: string;
  pathCount: number;
  unprocessedPaths: UnprocessedPath[];
}> = ({ layerName, pathCount, unprocessedPaths }) => {
  const [expanded, setExpanded] = useState(false);

  const layerPaths = unprocessedPaths.filter(p => p.layer === layerName);
  const closedCount = layerPaths.filter(p => p.is_closed).length;
  const openCount = layerPaths.filter(p => !p.is_closed).length;

  return (
    <div className="border rounded-lg overflow-hidden border-gray-300">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer bg-gray-100 hover:bg-gray-150 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-semibold text-gray-700">{layerName}</span>
        </div>
        <div className="text-sm text-gray-500">
          {pathCount} path{pathCount !== 1 ? 's' : ''}
          {layerPaths.length > 0 && (
            <span className="ml-2 text-gray-400">
              ({closedCount} closed, {openCount} open)
            </span>
          )}
        </div>
      </div>
      {expanded && layerPaths.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-300 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="text-left py-1 font-medium">Path ID</th>
                <th className="text-left py-1 font-medium">Status</th>
                <th className="text-left py-1 font-medium">Reason</th>
                <th className="text-right py-1 font-medium">Area</th>
              </tr>
            </thead>
            <tbody>
              {layerPaths.map(p => (
                <tr key={p.path_id} className="border-b border-gray-100">
                  <td className="py-1 text-gray-600 font-mono">{p.path_id}</td>
                  <td className="py-1">
                    <span className={p.is_closed ? 'text-green-600' : 'text-orange-600'}>
                      {p.is_closed ? 'closed' : 'open'}
                    </span>
                  </td>
                  <td className="py-1 text-gray-500">{formatReason(p.reason)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {p.area > 0 ? p.area.toFixed(1) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function formatReason(reason: string): string {
  switch (reason) {
    case 'open_path': return 'Open path';
    case 'defs_path': return 'SVG definitions';
    case 'off_layer': return 'Different layer';
    case 'unclassified': return 'Unclassified';
    default: return reason;
  }
}

/** Compact path accounting summary bar */
const PathAccountingSummary: React.FC<{ accounting: PathAccounting }> = ({ accounting }) => {
  const items: Array<{ label: string; value: number; color: string }> = [
    { label: 'Letters', value: accounting.letters, color: 'text-indigo-600' },
    { label: 'Holes in letters', value: accounting.holes_in_letters, color: 'text-blue-600' },
    { label: 'Orphan holes', value: accounting.orphan_holes, color: accounting.orphan_holes > 0 ? 'text-red-600' : 'text-gray-400' },
    { label: 'Open paths', value: accounting.open_paths, color: 'text-gray-500' },
    { label: 'Defs', value: accounting.defs_paths, color: 'text-gray-400' },
    { label: 'Off-layer', value: accounting.off_layer, color: 'text-gray-400' },
    { label: 'Unclassified', value: accounting.unclassified, color: accounting.unclassified > 0 ? 'text-orange-600' : 'text-gray-400' },
  ].filter(i => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs border-t border-gray-200 pt-2 mt-2">
      <span className="text-gray-500 font-medium mr-1">Path breakdown:</span>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <span className="text-gray-300">|</span>}
          <span className={item.color}>
            {item.value} {item.label.toLowerCase()}
          </span>
        </React.Fragment>
      ))}
      <span className="text-gray-300">|</span>
      <span className="text-gray-500 font-medium">{accounting.total} total</span>
    </div>
  );
};

const FileStructurePanel: React.FC<FileStructurePanelProps> = ({ stats, letterAnalysis }) => {
  const layers = stats.layers || [];
  const pathsPerLayer = stats.paths_per_layer || {};
  const letters = letterAnalysis?.letters || [];
  const orphanHoles = letterAnalysis?.orphan_holes || [];
  const unprocessedPaths = (letterAnalysis?.unprocessed_paths || []) as UnprocessedPath[];
  const pathAccounting = letterAnalysis?.stats?.path_accounting;
  const detectedScale = letterAnalysis?.detected_scale ?? stats.detected_scale;
  const hasHoles = stats.total_holes > 0 || letters.some(l => l.holes?.length > 0);

  // Group letters by layer
  const lettersByLayer = useMemo(() => {
    const groups: Record<string, typeof letters> = {};
    for (const letter of letters) {
      const layer = letter.layer_name || 'Unknown';
      if (!groups[layer]) groups[layer] = [];
      groups[layer].push(letter);
    }
    return groups;
  }, [letters]);

  // Layers with letters vs layers without
  const layersWithLetters = new Set(Object.keys(lettersByLayer));

  return (
    <div className="space-y-3">
      {/* Scale info + hole legend */}
      <div className="flex items-center gap-2 text-sm">
        <Layers className="w-4 h-4 text-indigo-500" />
        <span className="text-gray-600">
          {layers.length} layer{layers.length !== 1 ? 's' : ''},{' '}
          {stats.total_paths} path{stats.total_paths !== 1 ? 's' : ''}
        </span>
        {detectedScale != null && (
          <>
            <span className="text-gray-300">|</span>
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600">
              Scale: {detectedScale === 0.1 ? '10%' : `${Math.round(detectedScale * 100)}%`}
            </span>
          </>
        )}
        {hasHoles && (
          <>
            <span className="text-gray-300">|</span>
            <HoleLegend />
          </>
        )}
      </div>

      {/* Orphan holes warning (always an error) */}
      {orphanHoles.length > 0 && (
        <OrphanHolesPanel holes={orphanHoles} />
      )}

      {/* Layer breakdown */}
      <div className="space-y-2">
        {layers.map(layerName => {
          if (layersWithLetters.has(layerName)) {
            return (
              <LayerGroup
                key={layerName}
                layerName={layerName}
                letters={lettersByLayer[layerName]}
              />
            );
          }
          return (
            <BasicLayerGroup
              key={layerName}
              layerName={layerName}
              pathCount={pathsPerLayer[layerName] || 0}
              unprocessedPaths={unprocessedPaths}
            />
          );
        })}
      </div>

      {/* Path accounting summary */}
      {pathAccounting && <PathAccountingSummary accounting={pathAccounting} />}
    </div>
  );
};

export default FileStructurePanel;
