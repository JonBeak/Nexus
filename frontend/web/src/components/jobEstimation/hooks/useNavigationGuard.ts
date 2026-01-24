/**
 * Hook for navigation protection when there are unsaved changes
 *
 * Handles both internal navigation (via onRequestNavigation callback) and
 * browser navigation (via beforeunload event).
 */

import { useEffect, useRef } from 'react';
import { useAlert } from '../../../contexts/AlertContext';

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
  const { showConfirmation } = useAlert();
  // Use ref to capture showConfirmation without causing effect re-runs
  const showConfirmationRef = useRef(showConfirmation);
  showConfirmationRef.current = showConfirmation;

  // Navigation guard - simplified
  useEffect(() => {
    if (onRequestNavigation) {
      const navigationGuard = async (navigationFn?: () => void) => {
        // Only proceed if we have a valid function
        if (typeof navigationFn === 'function') {
          if (hasUnsavedChanges) {
            const confirmed = await showConfirmationRef.current({
              title: 'Unsaved Changes',
              message: 'You have unsaved changes. Are you sure you want to leave?',
              variant: 'warning',
              confirmText: 'Leave',
              cancelText: 'Stay'
            });
            if (confirmed) {
              navigationFn();
            }
          } else {
            navigationFn();
          }
        }
      };

      // Wrap in arrow function - passing a function directly to setState
      // causes React to call it as a state updater instead of setting it as the value
      onRequestNavigation(() => navigationGuard);

      return () => {
        onRequestNavigation(() => null);
      };
    }
  }, [onRequestNavigation, hasUnsavedChanges]);

  // Beforeunload protection - must use browser native dialog
  // (Custom alerts cannot be shown during beforeunload event)
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
