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
  /** Scroll speed multiplier (default: 2) */
  speedMultiplier?: number;
  /** Disable the hook entirely (e.g. on touch devices or during dnd-kit drags) */
  disabled?: boolean;
}

export function useHorizontalDragScroll({
  containerRef,
  skipSelectors = [],
  speedMultiplier = 2,
  disabled = false
}: UseHorizontalDragScrollOptions) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  // Track if we actually moved — used to suppress click events after drag
  const didMoveRef = useRef(false);
  // Lerp-based smooth scrolling: target position and animation frame handle
  const targetScrollRef = useRef(0);
  const rafRef = useRef<number | null>(null);

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

    // Lerp loop: smoothly animate scrollLeft toward targetScrollRef each frame
    const LERP_FACTOR = 0.25;
    const animateScroll = () => {
      const current = container.scrollLeft;
      const target = targetScrollRef.current;
      const diff = target - current;
      // Snap when close enough to avoid sub-pixel jitter
      if (Math.abs(diff) < 0.5) {
        container.scrollLeft = target;
      } else {
        container.scrollLeft = current + diff * LERP_FACTOR;
      }
      if (isDraggingRef.current) {
        rafRef.current = requestAnimationFrame(animateScroll);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (shouldSkip(target)) return;

      // Only left click
      if (e.button !== 0) return;

      isDraggingRef.current = true;
      didMoveRef.current = false;
      startXRef.current = e.clientX;
      scrollStartRef.current = container.scrollLeft;
      targetScrollRef.current = container.scrollLeft;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      // Start the lerp animation loop
      rafRef.current = requestAnimationFrame(animateScroll);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = (startXRef.current - e.clientX) * speedMultiplier;
      // Update the target — the rAF loop will lerp scrollLeft toward it
      targetScrollRef.current = scrollStartRef.current + deltaX;
      // Mark as moved if we scrolled more than a few pixels (prevents click suppression on tiny drags)
      if (Math.abs(e.clientX - startXRef.current) > 3) {
        didMoveRef.current = true;
      }
    };

    const stopDrag = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      // Kill the animation loop immediately — scroll stops where it is
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      container.style.cursor = '';
      container.style.userSelect = '';
    };

    const handleMouseUp = () => stopDrag();
    const handleMouseLeave = () => stopDrag();

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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick, true);
    };
  }, [containerRef, skipSelectors, speedMultiplier, disabled, shouldSkip]);
}
