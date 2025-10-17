/**
 * Hook for navigation protection when there are unsaved changes
 *
 * Handles both internal navigation (via onRequestNavigation callback) and
 * browser navigation (via beforeunload event).
 */

import { useEffect } from 'react';

interface UseNavigationGuardParams {
  onRequestNavigation?: (guard: ((navigationFn?: () => void) => void) | null) => void;
  hasUnsavedChanges: boolean;
  isReadOnly: boolean;
}

/**
 * Prevents navigation when there are unsaved changes.
 * Prompts user to confirm before losing unsaved work.
 *
 * @param params - Navigation guard configuration
 */
export const useNavigationGuard = ({
  onRequestNavigation,
  hasUnsavedChanges,
  isReadOnly
}: UseNavigationGuardParams): void => {
  // Navigation guard - simplified
  useEffect(() => {
    if (onRequestNavigation) {
      const navigationGuard = (navigationFn?: () => void) => {
        // Only proceed if we have a valid function
        if (typeof navigationFn === 'function') {
          if (hasUnsavedChanges) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
            if (confirmed) {
              navigationFn();
            }
          } else {
            navigationFn();
          }
        }
      };

      onRequestNavigation(navigationGuard);

      return () => {
        onRequestNavigation(null);
      };
    }
  }, [onRequestNavigation, hasUnsavedChanges]);

  // Beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isReadOnly) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isReadOnly]);
};
