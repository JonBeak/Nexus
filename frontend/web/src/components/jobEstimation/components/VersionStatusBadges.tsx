import React from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { EstimateVersion } from '../types';

interface VersionStatusBadgesProps {
  version: EstimateVersion;
}

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
      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
        Deactivated
      </span>
    );
  }

  // Check retracted (critical state)
  if (version.is_retracted === true || version.is_retracted === 1) {
    return (
      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">
        Retracted
      </span>
    );
  }

  // Check approved (most important positive state)
  if (version.is_approved === true || version.is_approved === 1) {
    return (
      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium inline-flex items-center">
        <CheckCircle className="w-4 h-4 mr-1" />
        Approved
      </span>
    );
  }

  // Check sent (in progress state)
  if (version.is_sent === true || version.is_sent === 1) {
    return (
      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium inline-flex items-center">
        <Send className="w-4 h-4 mr-1" />
        Sent
      </span>
    );
  }

  // Check draft (lowest priority, work in progress)
  if (version.is_draft === true || version.is_draft === 1) {
    return (
      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
        Draft
      </span>
    );
  }

  // If no status matches, show error (violates database constraint)
  return (
    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
      ERROR: No Status
    </span>
  );
};
