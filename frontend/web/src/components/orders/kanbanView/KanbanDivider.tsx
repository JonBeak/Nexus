/**
 * KanbanDivider - Divider with label between column groups
 * Desktop: Horizontal line at top with label, vertical line down
 * Mobile: Vertical line with rotated label
 */

import React from 'react';

interface Props {
  label: string;
  isMobile?: boolean;
}

export const KanbanDivider: React.FC<Props> = ({ label, isMobile }) => {
  // Mobile: vertical line with rotated label
  if (isMobile) {
    return (
      <div className="flex-shrink-0 h-full flex items-center justify-center px-3">
        <div className="relative h-full w-1 bg-gray-400">
          <span
            className="absolute top-10 left-1/2 text-sm font-bold text-gray-700 whitespace-nowrap bg-[var(--theme-page-bg)] px-1 py-2"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg) translateX(50%)'
            }}
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  // Desktop: corner bracket with label at top, vertical line running full height
  return (
    <div className="flex-shrink-0 h-full relative pl-2 pr-1">
      {/* Vertical line - full height from top */}
      <div className="absolute left-2 top-0 bottom-0 w-1 bg-gray-400" />
      {/* Horizontal line at top, extending right */}
      <div className="absolute left-2 top-0 w-8 h-1 bg-gray-400" />
      {/* Label at end of horizontal line */}
      <span className="absolute left-11 -top-2.5 text-base font-bold text-gray-700 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
};
