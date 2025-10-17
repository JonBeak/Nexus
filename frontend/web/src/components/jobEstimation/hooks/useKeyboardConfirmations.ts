/**
 * Hook for keyboard event handling in confirmation modals
 *
 * Handles Enter/Space to confirm, Escape to cancel for both
 * grid-level and row-level confirmation modals.
 */

import { useEffect } from 'react';

interface UseKeyboardConfirmationsParams {
  showClearConfirmation: boolean;
  clearModalType: 'reset' | 'clearAll' | 'clearEmpty' | null;
  showRowConfirmation: boolean;
  rowConfirmationType: 'clear' | 'delete' | null;
  handlers: {
    handleReset: () => void;
    handleClearAll: () => void;
    handleClearEmpty: () => void;
    executeClearRow: () => void;
    executeDeleteRow: () => void;
    setShowClearConfirmation: (show: boolean) => void;
    setClearModalType: (type: 'reset' | 'clearAll' | 'clearEmpty' | null) => void;
    setShowRowConfirmation: (show: boolean) => void;
    setRowConfirmationType: (type: 'clear' | 'delete' | null) => void;
    setPendingRowIndex: (index: number | null) => void;
  };
}

/**
 * Manages keyboard shortcuts for confirmation modals.
 * - Enter/Space: Confirm action
 * - Escape: Cancel action
 *
 * @param params - Keyboard confirmation configuration
 */
export const useKeyboardConfirmations = ({
  showClearConfirmation,
  clearModalType,
  showRowConfirmation,
  rowConfirmationType,
  handlers: {
    handleReset,
    handleClearAll,
    handleClearEmpty,
    executeClearRow,
    executeDeleteRow,
    setShowClearConfirmation,
    setClearModalType,
    setShowRowConfirmation,
    setRowConfirmationType,
    setPendingRowIndex
  }
}: UseKeyboardConfirmationsParams): void => {
  // Keyboard support for confirmation dialogs (Space/Enter to confirm, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle header-level clear confirmation modal
      if (showClearConfirmation && clearModalType) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (clearModalType === 'reset') {
            handleReset();
          } else if (clearModalType === 'clearAll') {
            handleClearAll();
          } else if (clearModalType === 'clearEmpty') {
            handleClearEmpty();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowClearConfirmation(false);
          setClearModalType(null);
        }
      }

      // Handle row-level clear/delete confirmation modal
      if (showRowConfirmation && rowConfirmationType) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (rowConfirmationType === 'clear') {
            executeClearRow();
          } else if (rowConfirmationType === 'delete') {
            executeDeleteRow();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowRowConfirmation(false);
          setRowConfirmationType(null);
          setPendingRowIndex(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showClearConfirmation,
    clearModalType,
    showRowConfirmation,
    rowConfirmationType,
    handleReset,
    handleClearAll,
    handleClearEmpty,
    executeClearRow,
    executeDeleteRow,
    setShowClearConfirmation,
    setClearModalType,
    setShowRowConfirmation,
    setRowConfirmationType,
    setPendingRowIndex
  ]);
};
