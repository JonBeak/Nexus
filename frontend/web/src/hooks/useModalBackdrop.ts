/**
 * useModalBackdrop Hook
 * Provides shared modal behavior for:
 * - ESC key handling with stopImmediatePropagation
 * - Click-outside detection using mouseDown/mouseUp pattern
 * - Body scroll lock on mobile
 */

import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from './useMediaQuery';
import { useBodyScrollLock } from './useBodyScrollLock';

// Stable empty array to avoid recreating callbacks on every render
const EMPTY_REFS: React.RefObject<HTMLElement>[] = [];

interface UseModalBackdropOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Prevents closing when true (e.g., child modal is open) */
  preventClose?: boolean;
  /** Additional refs to check for inside click (e.g., preview panels) */
  additionalRefs?: React.RefObject<HTMLElement>[];
}

interface UseModalBackdropReturn {
  /** Ref to attach to the modal content element */
  modalContentRef: React.RefObject<HTMLDivElement>;
  /** Handler for backdrop mousedown event */
  handleBackdropMouseDown: (e: React.MouseEvent) => void;
  /** Handler for backdrop mouseup event */
  handleBackdropMouseUp: (e: React.MouseEvent) => void;
  /** Whether the device is mobile */
  isMobile: boolean;
}

export function useModalBackdrop({
  isOpen,
  onClose,
  preventClose = false,
  additionalRefs,
}: UseModalBackdropOptions): UseModalBackdropReturn {
  // Use stable empty array if no additionalRefs provided
  const stableAdditionalRefs = additionalRefs ?? EMPTY_REFS;
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Mobile detection and scroll lock
  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);

  // Handle ESC key - stop propagation to prevent parent modals from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (preventClose) return;
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, preventClose]);

  // Check if target is inside any tracked element
  // Returns null if primary ref isn't attached (safe default - don't close)
  const isInsideModal = useCallback((target: Node): boolean | null => {
    // Return null if primary ref isn't attached (safe - don't close)
    if (!modalContentRef.current) {
      return null;
    }
    // Check main modal content
    if (modalContentRef.current.contains(target)) {
      return true;
    }
    // Check additional refs (e.g., preview panels)
    for (const ref of stableAdditionalRefs) {
      if (ref.current?.contains(target)) {
        return true;
      }
    }
    return false;
  }, [stableAdditionalRefs]);

  // Handle backdrop click - only close if both mousedown and mouseup are outside modal content
  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    // Ignore portal events (React bubbles synthetic events through component tree, not DOM tree)
    if (!(e.currentTarget as HTMLElement).contains(e.target as Node)) return;

    const inside = isInsideModal(e.target as Node);
    // If ref not attached (null), default to false (safe - don't trigger close)
    mouseDownOutsideRef.current = inside === null ? false : !inside;
  }, [isInsideModal]);

  const handleBackdropMouseUp = useCallback((e: React.MouseEvent) => {
    // Ignore portal events (React bubbles synthetic events through component tree, not DOM tree)
    if (!(e.currentTarget as HTMLElement).contains(e.target as Node)) return;

    if (preventClose) {
      mouseDownOutsideRef.current = false;
      return;
    }
    const inside = isInsideModal(e.target as Node);
    // Only close if both: mousedown was outside AND mouseup is outside AND ref is attached
    if (mouseDownOutsideRef.current && inside === false) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  }, [preventClose, isInsideModal, onClose]);

  return {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp,
    isMobile,
  };
}

export default useModalBackdrop;
