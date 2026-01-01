/**
 * Loading and error state components for GridJobBuilder
 */

import React from 'react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface GridLoadingStatesProps {
  productTypesLoading: boolean;
  productTypesError: string | null;
  displayRowsLength: number;
}

/**
 * Renders appropriate loading/error states for the grid.
 * Returns null if grid should be displayed normally.
 */
export const GridLoadingStates: React.FC<GridLoadingStatesProps> = ({
  productTypesLoading,
  productTypesError,
  displayRowsLength
}) => {
  // Product types loading
  if (productTypesLoading) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 text-center border ${PAGE_STYLES.border}`}>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading product types...</p>
      </div>
    );
  }

  // Product types error
  if (productTypesError) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 text-center border ${PAGE_STYLES.border}`}>
        <div className="text-red-500 mb-4">
          <p className="font-semibold">Error loading product types</p>
          <p className="text-sm">{productTypesError}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  // Grid data loading
  if (!displayRowsLength) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 text-center border ${PAGE_STYLES.border}`}>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading grid...</p>
      </div>
    );
  }

  // No loading state needed
  return null;
};
