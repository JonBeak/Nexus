/**
 * Vinyl Visual Selector
 * 2D visual representation of vinyl inventory pieces for intuitive size-based selection
 * Created: 2026-02-04
 */

import React, { useState, useMemo, useRef } from 'react';
import { VinylItemWithHolds } from '../../../types/materialRequirements';

interface VinylVisualSelectorProps {
  vinylItems: VinylItemWithHolds[];
  selectedItemId: number | null;
  onSelect: (item: VinylItemWithHolds | null) => void;
}

// Viewport dimensions in inches
const VIEWPORT_WIDTH = 120; // 10 ft horizontal (length)
const VIEWPORT_HEIGHT = 60; // 5 ft vertical (width)

// Reference sheet dimensions (4x8 ft)
const REFERENCE_WIDTH = 96; // 8 ft = 96 inches
const REFERENCE_HEIGHT = 48; // 4 ft = 48 inches

export const VinylVisualSelector: React.FC<VinylVisualSelectorProps> = ({
  vinylItems,
  selectedItemId,
  onSelect,
}) => {
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const svgRef = useRef<SVGSVGElement>(null);

  // Sort items by length (descending) so smaller items render on top
  const sortedItems = useMemo(() => {
    return [...vinylItems].sort((a, b) => b.length_yards - a.length_yards);
  }, [vinylItems]);

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; isYard: boolean }[] = [];

    // Vertical lines (every foot along x-axis / length)
    for (let x = 12; x <= VIEWPORT_WIDTH; x += 12) {
      lines.push({
        x1: x,
        y1: 0,
        x2: x,
        y2: VIEWPORT_HEIGHT,
        isYard: x % 36 === 0,
      });
    }

    // Horizontal lines (every foot along y-axis / width)
    for (let y = 12; y <= VIEWPORT_HEIGHT; y += 12) {
      lines.push({
        x1: 0,
        y1: y,
        x2: VIEWPORT_WIDTH,
        y2: y,
        isYard: y % 36 === 0,
      });
    }

    return lines;
  }, []);

  // Handle mouse move for tooltip positioning
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, item: VinylItemWithHolds) => {
    const svg = e.currentTarget.closest('svg');
    if (svg) {
      const rect = svg.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + 10,
        y: e.clientY - rect.top - 10,
      });
    }
    setHoveredItemId(item.id);
  };

  const hoveredItem = vinylItems.find(i => i.id === hoveredItemId);

  // Handle mouse move over SVG to show cursor position in inches
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to viewBox coordinates (120x60 inches)
    const xInches = (x / rect.width) * VIEWPORT_WIDTH;
    // Y is flipped (scaleY(-1)), so bottom is 0
    const yInches = VIEWPORT_HEIGHT - (y / rect.height) * VIEWPORT_HEIGHT;

    setCursorPos({ x: Math.round(xInches), y: Math.round(yInches), visible: true });
  };

  const handleSvgMouseLeave = () => {
    setCursorPos(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="relative ml-8 mt-6">
      {/* Axis labels - positioned at actual proportional locations */}
      {/* Horizontal axis (length): 10ft = 120 inches */}
      <div className="absolute -top-5 left-0 right-0 text-[10px] text-gray-400">
        <span className="absolute" style={{ left: '0%' }}>0</span>
        <span className="absolute -translate-x-1/2" style={{ left: '30%' }}>1yd</span>
        <span className="absolute -translate-x-1/2" style={{ left: '60%' }}>2yd</span>
        <span className="absolute -translate-x-1/2" style={{ left: '80%' }}>8ft</span>
        <span className="absolute -translate-x-1/2" style={{ left: '90%' }}>3yd</span>
        <span className="absolute -translate-x-full" style={{ left: '100%' }}>10ft</span>
      </div>
      {/* Vertical axis (width): 5ft = 60 inches */}
      <div className="absolute top-0 -left-10 bottom-0 text-[10px] text-gray-400 text-right w-8">
        <span className="absolute right-0" style={{ top: '-1%' }}>5ft</span>
        <span className="absolute right-0" style={{ top: '18%' }}>4ft</span>
        <span className="absolute right-0" style={{ top: '36%' }}>3ft</span>
        <span className="absolute right-0" style={{ top: '55%' }}>2ft</span>
        <span className="absolute right-0" style={{ top: '73%' }}>1ft</span>
        <span className="absolute right-0" style={{ top: '92%' }}>0</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
        className="w-full border border-gray-300 rounded bg-gray-50"
        style={{ transform: 'scaleY(-1)', aspectRatio: '2 / 1' }} // Flip to make bottom-left origin, enforce 2:1 aspect ratio
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={handleSvgMouseLeave}
      >
        {/* Background */}
        <rect x="0" y="0" width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} fill="#f9fafb" />

        {/* Reference sheet (4x8 ft) - rendered first so it's behind everything */}
        <rect
          x="0"
          y="0"
          width={REFERENCE_WIDTH}
          height={REFERENCE_HEIGHT}
          fill="rgba(59, 130, 246, 0.12)"
          stroke="rgba(59, 130, 246, 0.5)"
          strokeWidth="0.4"
        />

        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.isYard ? '#9ca3af' : '#d1d5db'}
            strokeWidth={line.isYard ? 0.5 : 0.25}
            strokeDasharray={line.isYard ? '2 1' : '1 1'}
          />
        ))}

        {/* Vinyl pieces - sorted so smaller ones render on top */}
        {sortedItems.map((item) => {
          // Convert dimensions: width = vertical (height in SVG), length_yards = horizontal (width in SVG)
          const rectWidth = Math.min(item.length_yards * 36, VIEWPORT_WIDTH); // yards to inches
          const rectHeight = Math.min(item.width, VIEWPORT_HEIGHT); // already in inches

          const isSelected = selectedItemId === item.id;
          const isHovered = hoveredItemId === item.id;

          return (
            <g key={item.id}>
              <rect
                x="0"
                y="0"
                width={rectWidth}
                height={rectHeight}
                fill={
                  isSelected
                    ? 'rgba(147, 51, 234, 0.35)'
                    : isHovered
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(107, 114, 128, 0.2)'
                }
                stroke={
                  isSelected
                    ? 'rgba(147, 51, 234, 1)'
                    : isHovered
                    ? 'rgba(59, 130, 246, 1)'
                    : 'rgba(55, 65, 81, 0.9)'
                }
                strokeWidth={isSelected ? 0.75 : isHovered ? 0.5 : 0.35}
                className="cursor-pointer transition-all duration-150"
                onClick={() => onSelect(isSelected ? null : item)}
                onMouseMove={(e) => handleMouseMove(e, item)}
                onMouseLeave={() => setHoveredItemId(null)}
              />
              </g>
          );
        })}

        {/* Border */}
        <rect
          x="0"
          y="0"
          width={VIEWPORT_WIDTH}
          height={VIEWPORT_HEIGHT}
          fill="none"
          stroke="#d1d5db"
          strokeWidth="0.5"
        />
      </svg>

      {/* Tooltip */}
      {hoveredItem && (
        <div
          className="absolute z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">#{hoveredItem.id}</div>
          <div>
            {hoveredItem.width}" × {hoveredItem.length_yards} yds ({Math.round(hoveredItem.length_yards * 36)}")
          </div>
          <div className="text-gray-300">
            {hoveredItem.brand} {hoveredItem.series}
            {hoveredItem.colour_number && ` - ${hoveredItem.colour_number}`}
          </div>
          {hoveredItem.holds.length > 0 && (
            <div className="text-orange-300">
              {hoveredItem.holds.length} hold{hoveredItem.holds.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Cursor position indicator */}
      {cursorPos.visible && (
        <div className="absolute top-1 right-1 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded opacity-80">
          {cursorPos.x}" × {cursorPos.y}"
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border border-blue-400 bg-blue-100" />
          <span>4×8 ft reference</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-200/50 border border-gray-400" />
          <span>Vinyl piece</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-200 border-2 border-purple-500" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
};

export default VinylVisualSelector;
