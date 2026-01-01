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

// Style classes for entry types (row backgrounds removed - colors now on inputs)
export const ENTRY_TYPE_STYLES = {
  store: '',
  use: '',
  waste: '',
  returned: '',
  damaged: '',
} as const;

// Input background colors for entry types (applied to Vinyl Product, Width, Length fields)
// Includes black border for valid/enabled inputs
export const ENTRY_TYPE_INPUT_STYLES = {
  store: 'bg-green-100 border-gray-800',
  use: 'bg-blue-100 border-gray-800',
  waste: 'bg-orange-100 border-gray-800',
  returned: 'bg-yellow-100 border-gray-800',
  damaged: 'bg-purple-100 border-gray-800',
} as const;

// Disabled input background color (darker gray)
export const DISABLED_INPUT_STYLE = 'bg-gray-200' as const;

// Submission state styles (no borders)
export const SUBMISSION_STATE_STYLES = {
  submitting: 'bg-blue-50',
  success: 'bg-green-100',
  error: 'bg-red-100',
  validation_error: 'bg-red-50',
} as const;