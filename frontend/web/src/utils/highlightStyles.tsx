/**
 * Styling utilities and components for highlighting modified fields
 * Phase 1.5.c.3
 *
 * Visual feedback for fields that have been modified after finalization.
 */

import React from 'react';

/**
 * Background class for empty/unfilled input fields
 * Used in dual table to highlight rows with no data
 */
export const EMPTY_FIELD_BG_CLASS = 'bg-gray-500';

/**
 * Get className for a field that may be modified
 *
 * @param isModified - Whether the field has been modified
 * @param baseClass - Base CSS classes to apply
 * @returns Combined className string
 */
export function getModifiedFieldClass(
  isModified: boolean,
  baseClass: string = 'px-2 py-1 border rounded'
): string {
  if (isModified) {
    return `${baseClass} bg-yellow-50 border-yellow-500 border-l-4`;
  }
  return `${baseClass} bg-white border-gray-200`;
}

/**
 * Badge/indicator for modified status
 */
export const ModifiedBadge: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
      Modified
    </span>
  );
};

/**
 * Inline indicator dot for modified fields
 */
export const ModifiedDot: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <span
      className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"
      title="This field has been modified after finalization"
    />
  );
};

/**
 * Icon indicator for modified fields
 */
export const ModifiedIcon: React.FC<{ show: boolean; position?: 'left' | 'right' }> = ({
  show,
  position = 'right'
}) => {
  if (!show) return null;

  const positionClass = position === 'left' ? 'mr-2' : 'ml-2';

  return (
    <span className={`${positionClass} text-yellow-600`} title="Modified after finalization">
      ⚠
    </span>
  );
};

/**
 * Tooltip text for modified field
 */
export function getModifiedTooltip(snapshotValue: any, currentValue: any): string {
  const oldValue = snapshotValue ?? '(empty)';
  const newValue = currentValue ?? '(empty)';
  return `Original: ${oldValue}\nCurrent: ${newValue}`;
}

/**
 * Banner warning component for modified order
 */
export const ModifiedOrderBanner: React.FC<{
  show: boolean;
  modificationCount: number;
  onViewChanges?: () => void;
}> = ({ show, modificationCount, onViewChanges }) => {
  if (!show || modificationCount === 0) return null;

  return (
    <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-yellow-700 font-medium">
            ⚠ This order has been modified after finalization
          </span>
          <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded">
            {modificationCount} {modificationCount === 1 ? 'change' : 'changes'}
          </span>
        </div>
        {onViewChanges && (
          <button
            onClick={onViewChanges}
            className="px-3 py-1 text-sm text-yellow-700 hover:text-yellow-900 font-medium underline"
          >
            View Changes
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Highlight wrapper component for modified fields
 */
export const ModifiedFieldWrapper: React.FC<{
  isModified: boolean;
  children: React.ReactNode;
  tooltipText?: string;
}> = ({ isModified, children, tooltipText }) => {
  if (!isModified) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      title={tooltipText || 'This field has been modified after finalization'}
    >
      {children}
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-white" />
    </div>
  );
};

/**
 * Comparison view component (side-by-side)
 */
export const ComparisonView: React.FC<{
  label: string;
  originalValue: any;
  currentValue: any;
}> = ({ label, originalValue, currentValue }) => {
  const original = originalValue ?? '(empty)';
  const current = currentValue ?? '(empty)';
  const isModified = original !== current;

  if (!isModified) {
    return null;
  }

  return (
    <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
      <div className="font-medium text-gray-700 mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-gray-500 mb-1">Original</div>
          <div className="text-gray-600 line-through">{String(original)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-gray-900 font-medium">{String(current)}</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Version badge component
 */
export const VersionBadge: React.FC<{
  versionNumber: number;
  isLatest?: boolean;
}> = ({ versionNumber, isLatest = false }) => {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${
        isLatest
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      Version {versionNumber}
      {isLatest && ' (Latest)'}
    </span>
  );
};

/**
 * Get className for valid input fields (green outline and light green background for filled fields)
 * Used in invoice fields to highlight fields with valid data
 *
 * @param hasValue - Whether the field has a valid value
 * @param baseClass - Base CSS classes to apply
 * @returns Combined className string with green outline and background if valid
 */
export function getValidInputClass(
  hasValue: boolean,
  baseClass: string = ''
): string {
  if (hasValue) {
    return `${baseClass} border-green-500 ring-1 ring-green-500 bg-green-50`;
  }
  return baseClass;
}

/**
 * Get className for valid specification template dropdown (black outline and darker gray background for filled fields)
 * Used in specs template dropdown to highlight when a template is selected
 *
 * @param hasValue - Whether the field has a valid value
 * @param baseClass - Base CSS classes to apply
 * @returns Combined className string with black outline and darker gray background if valid
 */
export function getValidSpecTemplateClass(
  hasValue: boolean,
  baseClass: string = ''
): string {
  if (hasValue) {
    return `${baseClass} border-gray-800 ring-1 ring-gray-800 bg-gray-200`;
  }
  return baseClass;
}

/**
 * Get className for valid specification fields (darker black outline, no background)
 * Used in spec 1-3 fields to highlight when they have valid data
 *
 * @param hasValue - Whether the field has a valid value
 * @param baseClass - Base CSS classes to apply
 * @returns Combined className string with dark outline if valid
 */
export function getValidSpecFieldClass(
  hasValue: boolean,
  baseClass: string = ''
): string {
  if (hasValue) {
    return `${baseClass} border-gray-800`;
  }
  return baseClass;
}
