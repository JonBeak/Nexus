/**
 * OrphanHolesPanel - Displays orphan holes grouped by layer with SVG previews.
 *
 * Replaces the flat OrphanHolesWarning. Groups holes by layer_name,
 * each layer is a collapsible red-tinted section with hole details
 * and SVG thumbnail previews.
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { HoleDetail } from '../../../../types/aiFileValidation';
import OrphanHoleSvgPreview from './OrphanHoleSvgPreview';

const HOLE_TYPE_ORDER: Record<string, number> = { wire: 0, mounting: 1 };

interface OrphanHolesPanelProps {
  holes: HoleDetail[];
}

const OrphanLayerGroup: React.FC<{
  layerName: string;
  holes: HoleDetail[];
}> = ({ layerName, holes }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-red-200 rounded-lg overflow-hidden">
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer bg-red-50 hover:bg-red-100/80"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-red-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-red-400" />
          )}
          <span className="font-medium text-sm text-red-800">{layerName}</span>
          <span className="text-xs text-red-500">
            ({holes.length} hole{holes.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>
      {expanded && (
        <div className="bg-white border-t border-red-200">
          <div className="divide-y divide-red-100">
            {holes.map((hole, i) => (
              <div
                key={`${hole.path_id}-${i}`}
                className="flex items-center gap-3 px-3 py-2"
              >
                <OrphanHoleSvgPreview hole={hole} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 truncate">
                    {hole.path_id}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-sm font-medium ${
                      hole.hole_type === 'wire' ? 'text-blue-600' :
                      hole.hole_type === 'mounting' ? 'text-green-600' :
                      'text-orange-600'
                    }`}>
                      {hole.matched_name || hole.hole_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(hole.diameter_real_mm ?? hole.diameter_mm).toFixed(2)}mm
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OrphanHolesPanel: React.FC<OrphanHolesPanelProps> = ({ holes }) => {
  const [expanded, setExpanded] = useState(true);

  const layerGroups = useMemo(() => {
    const groups: Record<string, HoleDetail[]> = {};
    for (const hole of holes) {
      const layer = hole.layer_name || 'Unknown Layer';
      if (!groups[layer]) groups[layer] = [];
      groups[layer].push(hole);
    }
    for (const layerHoles of Object.values(groups)) {
      layerHoles.sort((a, b) => (HOLE_TYPE_ORDER[a.hole_type] ?? 2) - (HOLE_TYPE_ORDER[b.hole_type] ?? 2));
    }
    return Object.entries(groups);
  }, [holes]);

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
        <div className="px-4 py-3 border-t border-red-200 bg-white space-y-3">
          <p className="text-sm text-red-600">
            These holes are not inside any detected letter. They may be misplaced or indicate a letter detection issue.
          </p>
          <div className="space-y-2">
            {layerGroups.map(([layerName, layerHoles]) => (
              <OrphanLayerGroup
                key={layerName}
                layerName={layerName}
                holes={layerHoles}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrphanHolesPanel;
