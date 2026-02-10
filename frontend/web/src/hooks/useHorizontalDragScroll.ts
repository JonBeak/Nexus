/**
 * useHorizontalDragScroll Hook
 * Enables click-and-drag horizontal scrolling on a container element.
 * Skips interactive elements and configurable selectors so drag-scroll
 * coexists with buttons, links, checkboxes, and drag-and-drop cards.
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseHorizontalDragScrollOptions {
  /** Ref to the scrollable container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** CSS selectors for elements that should NOT trigger drag-scroll */
  skipSelectors?: string[];
  /** Scroll speed multiplier (default: 1.5) */
  speedMultiplier?: number;
  /** Disable the hook entirely (e.g. on touch devices or during dnd-kit drags) */
  disabled?: boolean;
}

export function useHorizontalDragScroll({
  containerRef,
  skipSelectors = [],
  speedMultiplier = 1.5,
  disabled = false
}: UseHorizontalDragScrollOptions) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  // Track if we actually moved — used to suppress click events after drag
  const didMoveRef = useRef(false);

  // Built-in interactive selectors that should never trigger drag-scroll
  const INTERACTIVE_SELECTORS = [
    'a', 'button', 'input', 'select', 'textarea', 'label',
    '[role="button"]', '[contenteditable]'
  ];

  const shouldSkip = useCallback((target: HTMLElement): boolean => {
    const allSelectors = [...INTERACTIVE_SELECTORS, ...skipSelectors];
    for (const selector of allSelectors) {
      if (target.closest(selector)) return true;
    }
    return false;
  }, [skipSelectors]);

  useEffect(() => {
    if (disabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (shouldSkip(target)) return;

      // Only left click
      if (e.button !== 0) return;

      isDraggingRef.current = true;
      didMoveRef.current = false;
      startXRef.current = e.clientX;
      scrollStartRef.current = container.scrollLeft;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = (startXRef.current - e.clientX) * speedMultiplier;
      container.scrollLeft = scrollStartRef.current + deltaX;
      // Mark as moved if we scrolled more than a few pixels (prevents click suppression on tiny drags)
      if (Math.abs(e.clientX - startXRef.current) > 3) {
        didMoveRef.current = true;
      }
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      container.style.cursor = '';
      container.style.userSelect = '';
    };

    const handleMouseLeave = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      container.style.cursor = '';
      container.style.userSelect = '';
    };

    // Suppress click events that fire after a drag (prevents accidental navigation)
    const handleClick = (e: MouseEvent) => {
      if (didMoveRef.current) {
        e.stopPropagation();
        e.preventDefault();
        didMoveRef.current = false;
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick, true); // capture phase

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick, true);
    };
  }, [containerRef, skipSelectors, speedMultiplier, disabled, shouldSkip]);
}
