import React from 'react';
import { EstimateVersion } from '../types';

interface VersionStatusBadgesProps {
  version: EstimateVersion;
}

// Shared status badge styling - matches JobPanel.getJobStatusBadge
const statusStyles = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-800',
  sent: 'bg-blue-100 text-blue-800 border-blue-800',
  approved: 'bg-green-100 text-green-800 border-green-800',
  retracted: 'bg-red-100 text-red-800 border-red-800',
  deactivated: 'bg-gray-100 text-gray-600 border-gray-600',
  error: 'bg-red-100 text-red-800 border-red-800'
};

const badgeBase = 'px-2 py-1 rounded-full text-xs font-semibold border';

export const VersionStatusBadges: React.FC<VersionStatusBadgesProps> = ({ version }) => {
  // Single-status display with priority order (highest to lowest):
  // 1. Deactivated (terminal state)
  // 2. Retracted (withdrawn estimate)
  // 3. Approved (customer accepted)
  // 4. Sent (submitted to customer)
  // 5. Draft (work in progress)

  // Check deactivated first (highest priority)
  if (version.is_active === false || version.is_active === 0) {
    return (
      <span className={`${badgeBase} ${statusStyles.deactivated}`}>
        Deactivated
      </span>
    );
  }

  // Check retracted (critical state)
  if (version.is_retracted === true || version.is_retracted === 1) {
    return (
      <span className={`${badgeBase} ${statusStyles.retracted}`}>
        Retracted
      </span>
    );
  }

  // Check approved (most important positive state)
  if (version.is_approved === true || version.is_approved === 1) {
    return (
      <span className={`${badgeBase} ${statusStyles.approved}`}>
        Approved
      </span>
    );
  }

  // Check sent (in progress state)
  if (version.is_sent === true || version.is_sent === 1) {
    return (
      <span className={`${badgeBase} ${statusStyles.sent}`}>
        Sent
      </span>
    );
  }

  // Check draft (lowest priority, work in progress)
  if (version.is_draft === true || version.is_draft === 1) {
    return (
      <span className={`${badgeBase} ${statusStyles.draft}`}>
        Draft
      </span>
    );
  }

  // Check prepared-but-not-sent (show as Draft)
  if ((version.is_prepared === true || version.is_prepared === 1) &&
      !(version.is_sent === true || version.is_sent === 1)) {
    return (
      <span className={`${badgeBase} ${statusStyles.draft}`}>
        Draft
      </span>
    );
  }

  // If no status matches, show error (violates database constraint)
  return (
    <span className={`${badgeBase} ${statusStyles.error}`}>
      ERROR: No Status
    </span>
  );
};
