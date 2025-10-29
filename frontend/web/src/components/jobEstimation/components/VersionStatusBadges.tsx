import React from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { EstimateVersion } from '../types';

interface VersionStatusBadgesProps {
  version: EstimateVersion;
}

export const VersionStatusBadges: React.FC<VersionStatusBadgesProps> = ({ version }) => {
  const badges = [];

  // Check deactivated first (single source of truth via is_active)
  // Handle both boolean false and number 0 (from database)
  if (version.is_active === false || version.is_active === 0) {
    badges.push(
      <span key="deactivated" className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
        Deactivated
      </span>
    );
    return <>{badges}</>; // Deactivated estimates show only this badge
  }

  // Draft status
  if (version.is_draft === true || version.is_draft === 1) {
    badges.push(
      <span key="draft" className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
        Draft
      </span>
    );
    return <>{badges}</>; // Draft estimates show only this badge
  }

  // For finalized estimates, show all applicable status flags
  // Sent badge is larger (text-sm) for visibility
  if (version.is_sent === true || version.is_sent === 1) {
    badges.push(
      <span key="sent" className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium flex items-center">
        <Send className="w-4 h-4 mr-1" />
        Sent
      </span>
    );
  }

  if (version.is_approved === true || version.is_approved === 1) {
    badges.push(
      <span key="approved" className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium flex items-center">
        <CheckCircle className="w-4 h-4 mr-1" />
        Approved
      </span>
    );
  }

  if (version.is_retracted === true || version.is_retracted === 1) {
    badges.push(
      <span key="retracted" className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
        Retracted
      </span>
    );
  }

  // Note: "ordered" status removed - no longer exists in new boolean flag system
  // Future: May need new is_ordered flag if order tracking is required

  // If no badges were added, this violates database constraint - show error
  if (badges.length === 0) {
    badges.push(
      <span key="error" className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
        ERROR: No Status
      </span>
    );
  }

  return <>{badges}</>;
};
