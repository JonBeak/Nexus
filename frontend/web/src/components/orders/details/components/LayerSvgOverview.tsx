/**
 * Layer SVG Overview Component
 *
 * Renders ALL letters in a layer in their real file positions so you can
 * see the complete word/layout at a glance.  Clicking a letter scrolls
 * down to that letter's individual LetterCard.
 *
 * Reuses the same grid/hole rendering logic as LetterSvgPreview but
 * computes a union bounding box across every letter in the layer.
 */

import React, { useMemo } from 'react';
import { LetterDetail, HoleDetail } from '../../../../types/aiFileValidation';

interface LayerSvgOverviewProps {
  letters: LetterDetail[];
  maxHeight?: number;
  onLetterClick?: (letterId: string) => void;
}

const HOLE_COLORS: Record<string, string> = {
  wire: '#3B82F6',
  mounting: '#22C55E',
  unknown: '#F97316',
};

const LayerSvgOverview: React.FC<LayerSvgOverviewProps> = ({
  letters,
  maxHeight = 200,
  onLetterClick,
}) => {
  // Union bounding box across all letters
  const viewBox = useMemo(() => {
    if (letters.length === 0) return { x: 0, y: 0, width: 100, height: 100 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of letters) {
      const b = l.file_bbox;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    const pad = 10;
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [letters]);

  // Real-world dimensions of the union bbox (for grid)
  const realDims = useMemo(() => {
    const scale = letters[0]?.detected_scale || 1.0;
    const ppi = 72 * scale;
    return {
      width: viewBox.width / ppi,
      height: viewBox.height / ppi,
    };
  }, [letters, viewBox]);

  // Grid lines
  const gridLines = useMemo(() => {
    const ref = letters[0];
    if (!ref) return { vertical: [], horizontal: [] };

    const realW = ref.real_size_inches?.width || 0;
    const realH = ref.real_size_inches?.height || 0;
    const bw = ref.file_bbox.width;
    const bh = ref.file_bbox.height;
    const ppiX = realW > 0 ? bw / realW : 72 * (ref.detected_scale || 1.0);
    const ppiY = realH > 0 ? bh / realH : 72 * (ref.detected_scale || 1.0);

    const maxDim = Math.max(realDims.width, realDims.height);
    const showInches = maxDim <= 24;
    const inchColor = maxDim < 12 ? '#00000033' : '#00000020';
    const footColor = maxDim <= 24 ? '#EF444466' : '#EF444444';

    const vertical: { pos: number; isFoot: boolean }[] = [];
    const horizontal: { pos: number; isFoot: boolean }[] = [];

    const startX = Math.floor(viewBox.x / ppiX) * ppiX;
    for (let px = startX; px <= viewBox.x + viewBox.width; px += ppiX) {
      const idx = Math.round(px / ppiX);
      const isFoot = idx % 12 === 0;
      if (showInches || isFoot) vertical.push({ pos: px, isFoot });
    }

    const startY = Math.floor(viewBox.y / ppiY) * ppiY;
    for (let py = startY; py <= viewBox.y + viewBox.height; py += ppiY) {
      const idx = Math.round(py / ppiY);
      const isFoot = idx % 12 === 0;
      if (showInches || isFoot) horizontal.push({ pos: py, isFoot });
    }

    return { vertical, horizontal, inchColor, footColor };
  }, [letters, viewBox, realDims]);

  // Hole visual radius — 1% of smaller viewBox dimension (smaller than single-letter preview)
  const holeRadius = useMemo(
    () => Math.min(viewBox.width, viewBox.height) * 0.01,
    [viewBox],
  );

  const renderHole = (hole: HoleDetail, index: number) => {
    if (hole.hole_type === 'unknown' && hole.svg_path_data) {
      return (
        <g key={`hole-${index}`} transform={hole.transform || undefined}>
          <path d={hole.svg_path_data} fill={hole.fill || HOLE_COLORS.unknown} stroke="none" />
        </g>
      );
    }
    const color = HOLE_COLORS[hole.hole_type] || HOLE_COLORS.unknown;
    return (
      <g key={`hole-${index}`} transform={hole.transform || undefined}>
        <circle cx={hole.center.x} cy={hole.center.y} r={holeRadius} fill={color} stroke="none" />
      </g>
    );
  };

  if (letters.length === 0) return null;

  return (
    <div className="mb-3">
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="border border-indigo-200 rounded bg-white w-full"
        style={{ maxHeight: maxHeight }}
      >
        {/* Grid */}
        <g className="grid-lines">
          {gridLines.vertical.map((line, i) => (
            <line
              key={`v-${i}`}
              x1={line.pos} y1={viewBox.y} x2={line.pos} y2={viewBox.y + viewBox.height}
              stroke={line.isFoot ? gridLines.footColor : gridLines.inchColor}
              strokeWidth={line.isFoot ? 1.5 : 0.5}
            />
          ))}
          {gridLines.horizontal.map((line, i) => (
            <line
              key={`h-${i}`}
              x1={viewBox.x} y1={line.pos} x2={viewBox.x + viewBox.width} y2={line.pos}
              stroke={line.isFoot ? gridLines.footColor : gridLines.inchColor}
              strokeWidth={line.isFoot ? 1.5 : 0.5}
            />
          ))}
        </g>

        {/* Letters */}
        {letters.map((letter, idx) => (
          <g
            key={letter.letter_id}
            className="letter-group"
            style={{ cursor: 'pointer' }}
            onClick={() => onLetterClick?.(letter.letter_id)}
          >
            <title>Letter {idx + 1} ({letter.letter_id})</title>

            {/* Main letter path */}
            <g transform={letter.transform || undefined}>
              <path d={letter.svg_path_data} fill="#D1D5DB" stroke="#374151" strokeWidth={1.5} />
            </g>

            {/* Counter paths */}
            {letter.counter_paths?.map((counter, i) => {
              const pathData = typeof counter === 'string' ? counter : counter.d;
              const transform = typeof counter === 'string' ? letter.transform : (counter.transform || letter.transform);
              return (
                <g key={`counter-${i}`} transform={transform || undefined}>
                  <path d={pathData} fill="white" stroke="none" />
                </g>
              );
            })}

            {/* Holes */}
            {letter.holes?.map((hole, i) => renderHole(hole, i))}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default LayerSvgOverview;
