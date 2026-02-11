/**
 * OrphanHoleSvgPreview - Compact SVG thumbnail for a single orphan hole.
 *
 * Wire/mounting holes render as colored circles at center.
 * Unknown holes render the actual svg_path_data with orange fill.
 * Uses file_bbox for viewBox when available, falls back to center + diameter.
 */

import React, { useMemo } from 'react';
import { HoleDetail } from '../../../../types/aiFileValidation';

const HOLE_COLORS: Record<string, string> = {
  wire: '#3B82F6',     // Blue
  mounting: '#22C55E', // Green
  engraving: '#000000', // Black (rendered as stroke)
  unknown: '#F97316',  // Orange
};

interface OrphanHoleSvgPreviewProps {
  hole: HoleDetail;
  size?: number;
}

const OrphanHoleSvgPreview: React.FC<OrphanHoleSvgPreviewProps> = ({
  hole,
  size = 48,
}) => {
  const viewBox = useMemo(() => {
    if (hole.file_bbox && hole.file_bbox.width > 0 && hole.file_bbox.height > 0) {
      const pad = Math.max(hole.file_bbox.width, hole.file_bbox.height) * 0.25;
      return {
        x: hole.file_bbox.x - pad,
        y: hole.file_bbox.y - pad,
        width: hole.file_bbox.width + pad * 2,
        height: hole.file_bbox.height + pad * 2,
      };
    }
    // Fallback: compute from center + diameter
    const r = (hole.diameter_mm || 10) / 2;
    const pad = r * 1.5;
    return {
      x: hole.center.x - r - pad,
      y: hole.center.y - r - pad,
      width: (r + pad) * 2,
      height: (r + pad) * 2,
    };
  }, [hole]);

  const color = HOLE_COLORS[hole.hole_type] || HOLE_COLORS.unknown;
  const radius = (hole.diameter_mm || 10) / 2;
  const isCircleType = hole.hole_type === 'wire' || hole.hole_type === 'mounting';
  const isEngraving = hole.hole_type === 'engraving';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className="border border-gray-200 rounded bg-white flex-shrink-0"
    >
      {isCircleType ? (
        <circle
          cx={hole.center.x}
          cy={hole.center.y}
          r={radius}
          fill={color}
          opacity={0.8}
          stroke={color}
          strokeWidth={radius * 0.15}
        />
      ) : isEngraving && hole.svg_path_data ? (
        <g transform={hole.transform || undefined}>
          <path
            d={hole.svg_path_data}
            fill="none"
            stroke="#000000"
            strokeWidth={Math.max(viewBox.width, viewBox.height) * 0.01}
            strokeDasharray="2,2"
          />
        </g>
      ) : (
        <g transform={hole.transform || undefined}>
          {hole.svg_path_data ? (
            <path
              d={hole.svg_path_data}
              fill={color}
              opacity={0.7}
              stroke={color}
              strokeWidth={radius * 0.1}
            />
          ) : (
            <circle
              cx={hole.center.x}
              cy={hole.center.y}
              r={radius}
              fill={color}
              opacity={0.8}
            />
          )}
        </g>
      )}
    </svg>
  );
};

export default OrphanHoleSvgPreview;
