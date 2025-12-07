/**
 * Shared Input Styling Constants and Utilities
 *
 * Centralized styling for all dual table input components.
 * Change border-radius, focus colors, sizing, etc. in ONE place.
 *
 * Usage:
 * import { INPUT_STYLES } from '@/utils/inputStyles';
 * const baseClass = INPUT_STYLES.textInput({ align: 'right', applyGrayBackground: true });
 */

import { EMPTY_FIELD_BG_CLASS } from './highlightStyles';

/**
 * Core Style Constants
 * Edit these to change styling across ALL inputs
 */
export const BORDER_RADIUS = 'rounded-none'; // Change to 'rounded-none', 'rounded-sm', 'rounded-md', etc.
export const FOCUS_OUTLINE = 'focus:outline-none';
export const FOCUS_RING = 'focus:ring-1 focus:ring-inset';
export const FOCUS_RING_COLOR = 'focus:ring-indigo-500';
export const FOCUS_BORDER_COLOR = 'focus:border-indigo-500';

/**
 * Shared property groups
 */
const FOCUS_STYLES = `${FOCUS_OUTLINE} ${FOCUS_RING} ${FOCUS_RING_COLOR} ${FOCUS_BORDER_COLOR}`;
const BORDER_STYLES = `border border-black ${BORDER_RADIUS}`;

/**
 * Text color utilities
 */
export const TEXT_COLORS = {
  empty: 'text-gray-400',
  filled: 'text-gray-900',
  muted: 'text-gray-600',
};

/**
 * Input Styles Builder
 * Provides consistent styling for all input types
 */
export const INPUT_STYLES = {
  /**
   * Standard text input
   * Used in: EditableInput (quantity, unit_price)
   */
  textInput: (options?: {
    align?: 'left' | 'right';
    applyGrayBackground?: boolean;
  }) => {
    const { align = 'left', applyGrayBackground = false } = options || {};

    return [
      'w-full',
      'px-1.5 py-0.5',
      'text-sm',
      BORDER_STYLES,
      FOCUS_STYLES,
      align === 'right' ? 'text-right' : '',
      applyGrayBackground ? EMPTY_FIELD_BG_CLASS : '',
    ].filter(Boolean).join(' ');
  },

  /**
   * Textarea input
   * Used in: EditableTextarea (invoice_description, qb_description)
   */
  textarea: (options?: {
    variant?: 'invoice' | 'qb';
    applyGrayBackground?: boolean;
  }) => {
    const { variant = 'qb', applyGrayBackground = false } = options || {};

    const baseStyles = [
      'w-full',
      'px-1.5 py-1',
      'text-sm',
      BORDER_STYLES,
      FOCUS_STYLES,
      'resize-none overflow-hidden',
    ];

    // Invoice description has special styling
    if (variant === 'invoice') {
      return [
        ...baseStyles,
        'text-gray-600',
        'border-gray-300',
        applyGrayBackground ? EMPTY_FIELD_BG_CLASS : 'bg-gray-50',
      ].filter(Boolean).join(' ');
    }

    // QB description uses standard styling
    return [
      ...baseStyles,
      applyGrayBackground ? EMPTY_FIELD_BG_CLASS : '',
    ].filter(Boolean).join(' ');
  },

  /**
   * Spec field input (small, compact)
   * Used in: SpecFieldInput (dropdown, combobox, boolean, textbox)
   */
  specField: (options?: {
    hasValue?: boolean;
    isEmpty?: boolean;
    removeRightBorder?: boolean;
  }) => {
    const { hasValue = false, isEmpty = false, removeRightBorder = false } = options || {};

    return [
      'w-full h-[26px]',
      'px-1.5',
      'text-xs',
      BORDER_STYLES,
      removeRightBorder ? 'border-r-0' : '',
      FOCUS_STYLES,
      hasValue ? TEXT_COLORS.filled : TEXT_COLORS.empty,
      isEmpty ? EMPTY_FIELD_BG_CLASS : '',
    ].filter(Boolean).join(' ');
  },

  /**
   * Item name dropdown (with parent highlighting)
   * Used in: ItemNameDropdown
   */
  itemNameDropdown: (options?: {
    hasValue?: boolean;
    isParentOrRegular?: boolean;
    applyGrayBackground?: boolean;
  }) => {
    const {
      hasValue = false,
      isParentOrRegular = false,
      applyGrayBackground = false,
    } = options || {};

    const baseStyles = [
      'w-full',
      'px-1.5 py-0.5',
      'text-sm',
      BORDER_RADIUS,
      FOCUS_OUTLINE,
      FOCUS_RING,
      hasValue ? TEXT_COLORS.filled : TEXT_COLORS.empty,
    ];

    // Parent items get blue highlighting
    if (isParentOrRegular && hasValue) {
      return [
        ...baseStyles,
        'border-2 border-blue-600',
        'bg-blue-100',
        'focus:ring-blue-600',
      ].filter(Boolean).join(' ');
    }

    // Standard styling
    return [
      ...baseStyles,
      'border border-gray-300',
      FOCUS_RING_COLOR,
      applyGrayBackground ? EMPTY_FIELD_BG_CLASS : '',
    ].filter(Boolean).join(' ');
  },

  /**
   * Spec template dropdown
   * Used in: SpecTemplateDropdown
   */
  specTemplateDropdown: (options?: {
    hasValue?: boolean;
    isEmpty?: boolean;
  }) => {
    const { hasValue = false, isEmpty = false } = options || {};

    return [
      'w-full h-[26px]',
      'px-1.5',
      'text-xs',
      BORDER_STYLES,
      FOCUS_STYLES,
      hasValue ? `${TEXT_COLORS.filled} font-bold` : TEXT_COLORS.empty,
      isEmpty ? EMPTY_FIELD_BG_CLASS : '',
    ].filter(Boolean).join(' ');
  },

  /**
   * QB Item dropdown
   * Used in: PartRow (renderQBItemDropdown)
   */
  qbItemDropdown: (options?: {
    hasValue?: boolean;
    isQBDataEmpty?: boolean;
  }) => {
    const { hasValue = false, isQBDataEmpty = false } = options || {};

    return [
      'w-full',
      'px-1.5 py-0.5',
      'text-sm',
      BORDER_STYLES,
      FOCUS_STYLES,
      hasValue ? TEXT_COLORS.filled : TEXT_COLORS.empty,
      isQBDataEmpty ? EMPTY_FIELD_BG_CLASS : '',
    ].filter(Boolean).join(' ');
  },

  /**
   * Part scope input (parent items only)
   * Used in: PartRow (part scope field)
   */
  partScopeInput: () => {
    return [
      'text-xs',
      'px-1 py-0.5',
      'border-2 border-blue-500',
      BORDER_RADIUS,
      'focus:outline-none',
      'focus:ring-2 focus:ring-blue-600',
      'focus:border-blue-600',
      'mt-1',
    ].filter(Boolean).join(' ');
  },
};

/**
 * Type exports for convenience
 */
export type TextAlign = 'left' | 'right';
export type TextareaVariant = 'invoice' | 'qb';
