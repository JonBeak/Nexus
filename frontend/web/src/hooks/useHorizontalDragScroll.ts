import { useRef, useEffect, useCallback, RefObject } from 'react';

interface HorizontalDragScrollOptions {
  /** Ref to the scrollable container element */
  containerRef: RefObject<HTMLDivElement>;
  /** When true, drag scrolling is disabled (e.g., during dnd-kit drag or on touch devices) */
  disabled?: boolean;
}

/**
 * Hook to enable mouse drag-to-scroll on a horizontally scrollable container.
 * Click and drag the background to scroll sideways - like grabbing the page.
 *
 * Designed to coexist with dnd-kit: only activates on mousedown targets that
 * are NOT inside a draggable card (elements with [data-kanban-card]).
 */
export function useHorizontalDragScroll({ containerRef, disabled = false }: HorizontalDragScrollOptions) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (disabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Don't hijack clicks on interactive elements or kanban cards
    const target = e.target as HTMLElement;
    if (target.closest('[data-kanban-card], button, a, input, select, textarea, [role="button"]')) {
      return;
    }

    isDragging.current = true;
    startX.current = e.pageX - container.offsetLeft;
    scrollLeft.current = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  }, [disabled, containerRef]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Multiplier for scroll speed
    container.scrollLeft = scrollLeft.current - walk;
  }, [containerRef]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const container = containerRef.current;
    if (container) {
      container.style.cursor = '';
      container.style.userSelect = '';
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    container.addEventListener('mousedown', handleMouseDown);
    // Listen on window so dragging outside the container still ends properly
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, handleMouseDown, handleMouseMove, handleMouseUp, disabled]);
}
