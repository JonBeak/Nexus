import React, { useState } from 'react';
import { JobChip } from './JobChip';
import type { VinylItemOrderAssociation } from '../types';

interface JobChipsCellProps {
  orderAssociations?: VinylItemOrderAssociation[];
}

/**
 * JobChipsCell - Table cell renderer for displaying job associations
 *
 * Display logic:
 * - No jobs: Shows gray "No jobs" text
 * - 1-3 jobs: Shows all chips
 * - 4+ jobs: Shows first 3 chips + expandable "+N more" button
 *
 * Chips are sorted by sequence_order (as provided by backend)
 */
export const JobChipsCell: React.FC<JobChipsCellProps> = ({ orderAssociations }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle empty state
  if (!orderAssociations || orderAssociations.length === 0) {
    return (
      <span className="text-gray-400 text-xs italic">
        No jobs
      </span>
    );
  }

  const totalJobs = orderAssociations.length;
  const shouldShowExpand = totalJobs > 3;
  const visibleJobs = isExpanded || !shouldShowExpand
    ? orderAssociations
    : orderAssociations.slice(0, 3);

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibleJobs.map((order) => (
        <JobChip key={order.order_id} order={order} />
      ))}

      {shouldShowExpand && !isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          +{totalJobs - 3} more
        </button>
      )}

      {isExpanded && shouldShowExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          Show less
        </button>
      )}
    </div>
  );
};
