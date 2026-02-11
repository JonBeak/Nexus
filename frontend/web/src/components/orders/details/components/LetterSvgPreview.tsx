/**
 * Letter SVG Preview Component
 *
 * Renders a letter with its holes and a measurement grid overlay.
 *
 * Grid Logic (based on letter size):
 * - < 24": Black inch grid + red foot lines
 * - > 24": Red foot grid only
 *
 * Hole Colors:
 * - Wire hole: Blue (#3B82F6)
 * - Mounting hole: Green (#22C55E)
 * - Unknown hole: Orange (#F97316)
 */

import React, { useMemo } from 'react';
import { LetterDetail, HoleDetail } from '../../../../types/aiFileValidation';

interface LetterSvgPreviewProps {
  letter: LetterDetail;
  maxWidth?: number;
  maxHeight?: number;
  showGrid?: boolean;
  showRuler?: boolean;
  highlightHoleIds?: string[];
}

const HOLE_COLORS: Record<string, string> = {
  wire: '#3B82F6',     // Blue
  mounting: '#22C55E', // Green
  engraving: '#A855F7', // Purple (not used - engraving renders as black stroke)
  unknown: '#F97316',  // Orange
};

const LetterSvgPreview: React.FC<LetterSvgPreviewProps> = ({
  letter,
  maxWidth = 300,
  maxHeight = 200,
  showGrid = true,
  showRuler = true,
  highlightHoleIds,
}) => {
  // Calculate viewBox and scale
  const viewBox = useMemo(() => {
    const padding = 10;
    const { x, y, width, height } = letter.file_bbox;
    return {
      x: x - padding,
      y: y - padding,
      width: width + padding * 2,
      height: height + padding * 2,
    };
  }, [letter.file_bbox]);

  // Calculate aspect ratio and actual display size
  const displaySize = useMemo(() => {
    const aspectRatio = viewBox.width / viewBox.height;
    let width = maxWidth;
    let height = maxWidth / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }

    return { width, height };
  }, [viewBox, maxWidth, maxHeight]);

  // Real-world dimensions
  const realWidth = letter.real_size_inches?.width || 0;
  const realHeight = letter.real_size_inches?.height || 0;
  const maxDimension = Math.max(realWidth, realHeight);

  // Grid settings based on size
  const gridSettings = useMemo(() => {
    if (maxDimension < 12) {
      // Small: inch grid + red foot lines
      return { showInches: true, showFeet: true, inchColor: '#00000033', footColor: '#EF444466' };
    } else if (maxDimension <= 24) {
      // Medium: inch grid + foot lines (black + red)
      return { showInches: true, showFeet: true, inchColor: '#00000020', footColor: '#EF444466' };
    } else {
      // Large: foot grid only (red)
      return { showInches: false, showFeet: true, inchColor: '', footColor: '#EF444444' };
    }
  }, [maxDimension]);

  // Calculate grid lines
  const gridLines = useMemo(() => {
    if (!showGrid) return { vertical: [], horizontal: [], strokeScale: 1 };

    const { x, y, width, height } = letter.file_bbox;

    // Derive actual points-per-inch from the transformed bbox and real-world size.
    // file_bbox is in transformed coordinate space, but 72*scale is for raw coordinates.
    // If the SVG transform includes scaling, we need the effective ratio instead.
    const ppiX = realWidth > 0 ? width / realWidth : 72 * (letter.detected_scale || 1.0);
    const ppiY = realHeight > 0 ? height / realHeight : 72 * (letter.detected_scale || 1.0);

    // Scale stroke widths proportionally to PPI so gridlines look the same
    // thickness regardless of 10% vs 100% scale. Reference PPI = 7.2 (10% scale).
    const strokeScale = Math.max(ppiX, ppiY) / 7.2;

    const vertical: { pos: number; isFoot: boolean }[] = [];
    const horizontal: { pos: number; isFoot: boolean }[] = [];

    // Extend range beyond bbox to cover viewBox padding area
    const pad = 10;

    // Generate vertical lines (use ppiX for horizontal spacing)
    const startX = Math.floor((x - pad) / ppiX) * ppiX;
    for (let px = startX; px <= x + width + pad; px += ppiX) {
      const inchIndex = Math.round(px / ppiX);
      const isFoot = inchIndex % 12 === 0;
      if (gridSettings.showInches || (gridSettings.showFeet && isFoot)) {
        vertical.push({ pos: px, isFoot });
      }
    }

    // Generate horizontal lines (use ppiY for vertical spacing)
    const startY = Math.floor((y - pad) / ppiY) * ppiY;
    for (let py = startY; py <= y + height + pad; py += ppiY) {
      const inchIndex = Math.round(py / ppiY);
      const isFoot = inchIndex % 12 === 0;
      if (gridSettings.showInches || (gridSettings.showFeet && isFoot)) {
        horizontal.push({ pos: py, isFoot });
      }
    }

    return { vertical, horizontal, strokeScale };
  }, [letter.file_bbox, realWidth, realHeight, letter.detected_scale, showGrid, gridSettings]);

  // Fixed visual radius for holes (~2% of viewBox smaller dimension)
  // Makes holes clearly visible regardless of their actual size
  const holeRadius = useMemo(() => {
    return Math.min(viewBox.width, viewBox.height) * 0.02;
  }, [viewBox]);

  // Render hole — known types get colored circles, unknown rendered as-is
  const renderHole = (hole: HoleDetail, index: number) => {
    // Engraving holes: render as black dotted stroke
    if (hole.hole_type === 'engraving' && hole.svg_path_data) {
      const strokeWidth = Math.max(viewBox.width, viewBox.height) * 0.002;
      return (
        <g key={`hole-${index}`} transform={hole.transform || undefined}>
          <path
            d={hole.svg_path_data}
            fill="none"
            stroke="#000000"
            strokeWidth={strokeWidth}
            strokeDasharray="2,2"
          />
        </g>
      );
    }

    // Unknown holes: render actual SVG path with orange fill
    if (hole.hole_type === 'unknown' && hole.svg_path_data) {
      return (
        <g key={`hole-${index}`} transform={hole.transform || undefined}>
          <path
            d={hole.svg_path_data}
            fill={hole.fill || HOLE_COLORS.unknown}
            stroke="none"
          />
        </g>
      );
    }

    // Wire/mounting holes: colored indicator circles
    const color = HOLE_COLORS[hole.hole_type] || HOLE_COLORS.unknown;
    const isHighlighted = highlightHoleIds && hole.path_id && highlightHoleIds.includes(hole.path_id);
    return (
      <g key={`hole-${index}`} transform={hole.transform || undefined}>
        {isHighlighted && (
          <circle
            cx={hole.center.x}
            cy={hole.center.y}
            r={holeRadius * 2.5}
            fill="none"
            stroke="#EF4444"
            strokeWidth={holeRadius * 0.4}
          />
        )}
        <circle
          cx={hole.center.x}
          cy={hole.center.y}
          r={holeRadius}
          fill={color}
          stroke="none"
        />
      </g>
    );
  };

  return (
    <div className="relative">
      <svg
        width={displaySize.width}
        height={displaySize.height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="border border-gray-200 rounded bg-white"
      >
        {/* Grid lines */}
        {showGrid && (
          <g className="grid-lines">
            {/* Vertical lines */}
            {gridLines.vertical.map((line, i) => (
              <line
                key={`v-${i}`}
                x1={line.pos}
                y1={viewBox.y}
                x2={line.pos}
                y2={viewBox.y + viewBox.height}
                stroke={line.isFoot ? gridSettings.footColor : gridSettings.inchColor}
                strokeWidth={(line.isFoot ? 1.5 : 0.5) * gridLines.strokeScale}
              />
            ))}
            {/* Horizontal lines */}
            {gridLines.horizontal.map((line, i) => (
              <line
                key={`h-${i}`}
                x1={viewBox.x}
                y1={line.pos}
                x2={viewBox.x + viewBox.width}
                y2={line.pos}
                stroke={line.isFoot ? gridSettings.footColor : gridSettings.inchColor}
                strokeWidth={(line.isFoot ? 1.5 : 0.5) * gridLines.strokeScale}
              />
            ))}
          </g>
        )}

        {/* Main letter path with its transform */}
        <g transform={letter.transform || undefined}>
          <path
            d={letter.svg_path_data}
            fill="#D1D5DB"
            stroke="#374151"
            strokeWidth={1.5 * gridLines.strokeScale}
          />
        </g>

        {/* Counter paths (white fill to cut out inner letter shapes) */}
        {letter.counter_paths?.map((counter, i) => {
          const pathData = typeof counter === 'string' ? counter : counter.d;
          const transform = typeof counter === 'string' ? letter.transform : (counter.transform || letter.transform);
          return (
            <g key={`counter-${i}`} transform={transform || undefined}>
              <path
                d={pathData}
                fill="white"
                stroke="none"
              />
            </g>
          );
        })}

        {/* Holes rendered separately with their own transforms */}
        {letter.holes?.map((hole, i) => renderHole(hole, i))}
      </svg>

      {/* Ruler labels */}
      {showRuler && (
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{realWidth.toFixed(1)}" W</span>
          <span className="text-gray-400">
            {letter.detected_scale === 0.1 ? '10% scale' : '100% scale'}
          </span>
          <span>{realHeight.toFixed(1)}" H</span>
        </div>
      )}
    </div>
  );
};

export default LetterSvgPreview;
