/**
 * Letter SVG Preview Component
 *
 * Renders a letter with its holes and a measurement grid overlay.
 *
 * Grid Logic (based on letter size):
 * - < 12": Black inch grid only
 * - 12-24": Black inch grid + red foot lines
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
}

const HOLE_COLORS: Record<string, string> = {
  wire: '#3B82F6',     // Blue
  mounting: '#22C55E', // Green
  unknown: '#F97316',  // Orange
};

const LetterSvgPreview: React.FC<LetterSvgPreviewProps> = ({
  letter,
  maxWidth = 300,
  maxHeight = 200,
  showGrid = true,
  showRuler = true,
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
      // Small: inch grid only (black)
      return { showInches: true, showFeet: false, inchColor: '#00000033', footColor: '' };
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
    if (!showGrid) return { vertical: [], horizontal: [] };

    const scale = letter.detected_scale || 1.0;
    const pointsPerInch = 72 * scale;
    const { x, y, width, height } = letter.file_bbox;

    const vertical: { pos: number; isFoot: boolean }[] = [];
    const horizontal: { pos: number; isFoot: boolean }[] = [];

    // Generate vertical lines
    const startX = Math.ceil(x / pointsPerInch) * pointsPerInch;
    for (let px = startX; px < x + width; px += pointsPerInch) {
      const inchIndex = Math.round(px / pointsPerInch);
      const isFoot = inchIndex % 12 === 0;
      if (gridSettings.showInches || (gridSettings.showFeet && isFoot)) {
        vertical.push({ pos: px, isFoot });
      }
    }

    // Generate horizontal lines
    const startY = Math.ceil(y / pointsPerInch) * pointsPerInch;
    for (let py = startY; py < y + height; py += pointsPerInch) {
      const inchIndex = Math.round(py / pointsPerInch);
      const isFoot = inchIndex % 12 === 0;
      if (gridSettings.showInches || (gridSettings.showFeet && isFoot)) {
        horizontal.push({ pos: py, isFoot });
      }
    }

    return { vertical, horizontal };
  }, [letter.file_bbox, letter.detected_scale, showGrid, gridSettings]);

  // Render hole circle
  const renderHole = (hole: HoleDetail, index: number) => {
    const color = HOLE_COLORS[hole.hole_type] || HOLE_COLORS.unknown;
    const scale = letter.detected_scale || 1.0;
    const radius = (hole.diameter_mm * 72 * scale) / 2;

    return (
      <circle
        key={`hole-${index}`}
        cx={hole.center.x}
        cy={hole.center.y}
        r={radius}
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={1}
      />
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
                strokeWidth={line.isFoot ? 1.5 : 0.5}
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
                strokeWidth={line.isFoot ? 1.5 : 0.5}
              />
            ))}
          </g>
        )}

        {/* Main letter path */}
        <path
          d={letter.svg_path_data}
          fill="none"
          stroke="#374151"
          strokeWidth={1.5}
        />

        {/* Counter paths (inner letter shapes) */}
        {letter.counter_paths?.map((pathData, i) => (
          <path
            key={`counter-${i}`}
            d={pathData}
            fill="none"
            stroke="#6B7280"
            strokeWidth={1}
            strokeDasharray="4,2"
          />
        ))}

        {/* Holes */}
        {letter.holes?.map((hole, i) => renderHole(hole, i))}
      </svg>

      {/* Ruler labels */}
      {showRuler && (
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{realWidth.toFixed(1)}"</span>
          <span className="text-gray-400">
            {letter.detected_scale === 0.1 ? '10% scale' : '100% scale'}
          </span>
          <span>{realHeight.toFixed(1)}"</span>
        </div>
      )}
    </div>
  );
};

export default LetterSvgPreview;
