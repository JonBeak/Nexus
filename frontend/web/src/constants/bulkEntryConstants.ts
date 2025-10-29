/**
 * Constants for bulk entry feature
 */

// Timing constants (in milliseconds)
export const TIMING = {
  AUTO_ADD_DELAY: 50,           // Delay before auto-adding new entry
  SAVE_INDICATOR_DURATION: 500, // Duration to show the save indicator
  FOCUS_DELAY: 10,              // Delay to ensure elements are rendered before focusing
} as const;

// Default values
export const DEFAULTS = {
  ENTRY_COUNT: 10,              // Default number of entries to create
  RECENT_JOBS_LIMIT: 50,        // Number of recent jobs to fetch
  EMPTY_JOB_ID: 0,              // Default/empty job ID value
} as const;

// Field configuration
export const FIELD_CONFIG = {
  FIELD_ORDER: [
    'type',
    'brand',
    'series',
    'colour_number',
    'colour_name',
    'width',
    'length_yards',
    'location',
    'notes',
    'job_ids'
  ] as const,

  TYPE_PREFIXES: [
    'Storage: ',
    'Usage: ',
    'Waste: ',
    'Return: ',
    'Damage: '
  ] as const,
} as const;

// Entry type configuration
export const ENTRY_TYPES = {
  STORE: 'store',
  USE: 'use',
  WASTE: 'waste',
  RETURNED: 'returned',
  DAMAGED: 'damaged',
} as const;

// Style classes for entry types
export const ENTRY_TYPE_STYLES = {
  store: 'bg-green-50 border-l-4 border-green-300',
  use: 'bg-red-50 border-l-4 border-red-300',
  waste: 'bg-orange-50 border-l-4 border-orange-300',
  returned: 'bg-blue-50 border-l-4 border-blue-300',
  damaged: 'bg-purple-50 border-l-4 border-purple-300',
} as const;

// Submission state styles
export const SUBMISSION_STATE_STYLES = {
  submitting: 'bg-blue-50 border-l-4 border-blue-400',
  success: 'bg-green-100 border-l-4 border-green-500',
  error: 'bg-red-100 border-l-4 border-red-500',
  validation_error: 'bg-red-50 border-l-4 border-red-400',
} as const;