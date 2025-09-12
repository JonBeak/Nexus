import { EstimateVersion } from '../types';

// Standard color scheme for all status options
export const STATUS_COLORS = {
  // Primary statuses
  'Draft': 'bg-yellow-100 text-yellow-800',
  'Sent': 'bg-blue-100 text-blue-800', 
  'Approved': 'bg-green-100 text-green-800',
  'Retracted': 'bg-red-100 text-red-800',
  'Ordered': 'bg-purple-100 text-purple-800',
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
 * Gets the display status text for an estimate based on all status flags
 * Handles complex overlapping statuses like Draft, Sent, Approved, Retracted, Ordered
 */
export const getEstimateStatusText = (estimate: EstimateVersion): string => {
  if (estimate.is_draft) return 'Draft';
  
  const statuses = [];
  if (estimate.is_sent) {
    statuses.push('Sent');
  }
  if (estimate.is_approved) statuses.push('Approved');
  if (estimate.is_retracted) statuses.push('Retracted');
  if (estimate.status === 'ordered') statuses.push('Ordered');
  
  return statuses.join(', ') || estimate.status || 'Unknown';
};

/**
 * Determines if an estimate is in draft state (editable)
 */
export const isEstimateDraft = (estimate: EstimateVersion): boolean => {
  return estimate.is_draft;
};

/**
 * Gets the primary status for simple displays (returns single status)
 */
export const getPrimaryEstimateStatus = (estimate: EstimateVersion): string => {
  if (estimate.is_draft) return 'Draft';
  if (estimate.status === 'ordered') return 'Ordered';
  if (estimate.is_approved) return 'Approved';
  if (estimate.is_retracted) return 'Retracted';
  if (estimate.is_sent) return 'Sent';
  return estimate.status || 'Unknown';
};

/**
 * Gets the Tailwind CSS classes for a given status
 */
export const getStatusColorClasses = (statusText: string): string => {
  // Check for exact matches first
  if (statusText in STATUS_COLORS) {
    return STATUS_COLORS[statusText as StatusColorKey];
  }
  
  // Handle sent with count variations ("Sent x2", "Sent x3", etc.)
  if (statusText.startsWith('Sent x')) {
    return STATUS_COLORS['Sent'];
  }
  
  // For compound statuses, try to match key parts
  if (statusText.includes('Sent') && statusText.includes('Approved') && statusText.includes('Ordered')) {
    return STATUS_COLORS['Sent, Approved, Ordered'];
  }
  if (statusText.includes('Sent') && statusText.includes('Approved')) {
    return STATUS_COLORS['Sent, Approved'];
  }
  if (statusText.includes('Approved') && statusText.includes('Ordered')) {
    return STATUS_COLORS['Approved, Ordered'];
  }
  if (statusText.includes('Sent') && statusText.includes('Retracted')) {
    return STATUS_COLORS['Sent, Retracted'];
  }
  
  // Single status fallbacks
  if (statusText.includes('Draft')) return STATUS_COLORS['Draft'];
  if (statusText.includes('Sent')) return STATUS_COLORS['Sent'];
  if (statusText.includes('Approved')) return STATUS_COLORS['Approved'];
  if (statusText.includes('Retracted')) return STATUS_COLORS['Retracted'];
  if (statusText.includes('Ordered')) return STATUS_COLORS['Ordered'];
  if (statusText.includes('Archived')) return STATUS_COLORS['Archived'];
  
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