import { EstimateVersion } from '../types';

// Standard color scheme for all status options
export const STATUS_COLORS = {
  // Primary statuses
  'Draft': 'bg-yellow-100 text-yellow-800',
  'Sent': 'bg-blue-100 text-blue-800',
  'Approved': 'bg-green-100 text-green-800',
  'Retracted': 'bg-red-100 text-red-800',
  'Ordered': 'bg-purple-100 text-purple-800',
  'Deactivated': 'bg-gray-100 text-gray-600',
  'Archived': 'bg-gray-100 text-gray-800',

  // Compound statuses (when multiple flags are true)
  'Sent, Approved': 'bg-emerald-100 text-emerald-800',
  'Sent, Retracted': 'bg-orange-100 text-orange-800',
  'Approved, Ordered': 'bg-indigo-100 text-indigo-800',
  'Sent, Approved, Ordered': 'bg-violet-100 text-violet-800',

  // Fallback
  'Unknown': 'bg-gray-100 text-gray-500'
} as const;

export type StatusColorKey = keyof typeof STATUS_COLORS;

/**
 * Capitalizes the first letter of each word in a status string
 */
const capitalizeStatus = (status: string): string => {
  return status
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Gets the display status text for an estimate based on all status flags
 * Uses is_active as single source of truth for deactivation
 * Returns properly capitalized status text
 */
export const getEstimateStatusText = (estimate: EstimateVersion): string => {
  // Check if deactivated first (single source of truth)
  // Handle both boolean false and number 0 from database
  if (estimate.is_active === false || estimate.is_active === 0) return 'Deactivated';

  // Check if draft (handle both boolean and number)
  if (estimate.is_draft === true || estimate.is_draft === 1) return 'Draft';

  // Check if prepared but not yet sent (show as Draft)
  if ((estimate.is_prepared === true || estimate.is_prepared === 1) &&
      !(estimate.is_sent === true || estimate.is_sent === 1)) {
    return 'Draft';
  }

  // Build status from boolean flags (handle both boolean and number)
  const statuses = [];
  if (estimate.is_sent === true || estimate.is_sent === 1) statuses.push('Sent');
  if (estimate.is_approved === true || estimate.is_approved === 1) statuses.push('Approved');
  if (estimate.is_retracted === true || estimate.is_retracted === 1) statuses.push('Retracted');

  const result = statuses.join(', ') || 'Unknown';

  // Ensure the result is properly capitalized
  return capitalizeStatus(result);
};

/**
 * Determines if an estimate is in draft state (editable)
 */
export const isEstimateDraft = (estimate: EstimateVersion): boolean => {
  return estimate.is_draft === true || estimate.is_draft === 1;
};

/**
 * Gets the primary status for simple displays (returns single status)
 */
export const getPrimaryEstimateStatus = (estimate: EstimateVersion): string => {
  if (estimate.is_active === false || estimate.is_active === 0) return 'Deactivated';
  if (estimate.is_draft === true || estimate.is_draft === 1) return 'Draft';
  // Check if prepared but not yet sent (show as Draft)
  if ((estimate.is_prepared === true || estimate.is_prepared === 1) &&
      !(estimate.is_sent === true || estimate.is_sent === 1)) {
    return 'Draft';
  }
  if (estimate.is_approved === true || estimate.is_approved === 1) return 'Approved';
  if (estimate.is_retracted === true || estimate.is_retracted === 1) return 'Retracted';
  if (estimate.is_sent === true || estimate.is_sent === 1) return 'Sent';
  return 'Unknown';
};

/**
 * Gets the Tailwind CSS classes for a given status
 * Case-insensitive matching to handle database variations
 */
export const getStatusColorClasses = (statusText: string): string => {
  // Check for exact matches first
  if (statusText in STATUS_COLORS) {
    return STATUS_COLORS[statusText as StatusColorKey];
  }

  // Convert to lowercase for case-insensitive matching
  const statusLower = statusText.toLowerCase();

  // Handle sent with count variations ("Sent x2", "Sent x3", etc.)
  if (statusLower.startsWith('sent x')) {
    return STATUS_COLORS['Sent'];
  }

  // For compound statuses, try to match key parts (case-insensitive)
  if (statusLower.includes('sent') && statusLower.includes('approved') && statusLower.includes('ordered')) {
    return STATUS_COLORS['Sent, Approved, Ordered'];
  }
  if (statusLower.includes('sent') && statusLower.includes('approved')) {
    return STATUS_COLORS['Sent, Approved'];
  }
  if (statusLower.includes('approved') && statusLower.includes('ordered')) {
    return STATUS_COLORS['Approved, Ordered'];
  }
  if (statusLower.includes('sent') && statusLower.includes('retracted')) {
    return STATUS_COLORS['Sent, Retracted'];
  }

  // Single status fallbacks (case-insensitive)
  if (statusLower.includes('draft')) return STATUS_COLORS['Draft'];
  if (statusLower.includes('sent')) return STATUS_COLORS['Sent'];
  if (statusLower.includes('approved')) return STATUS_COLORS['Approved'];
  if (statusLower.includes('retracted')) return STATUS_COLORS['Retracted'];
  if (statusLower.includes('ordered')) return STATUS_COLORS['Ordered'];
  if (statusLower.includes('archived')) return STATUS_COLORS['Archived'];

  return STATUS_COLORS['Unknown'];
};

/**
 * Creates a status badge component with consistent styling
 */
export const createStatusBadge = (statusText: string, key?: string, additionalClasses?: string) => {
  const colorClasses = getStatusColorClasses(statusText);
  const classes = `px-2 py-1 rounded text-xs font-medium ${colorClasses} ${additionalClasses || ''}`;
  
  return {
    text: statusText,
    classes: classes.trim(),
    key: key || statusText.toLowerCase().replace(/[^a-z0-9]/g, '-')
  };
};