import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook to enable grab-to-scroll on a scrollable container.
 * Dragging on the background scrolls the container horizontally.
 * Dragging on elements matching `ignoreSelector` is ignored (e.g., draggable cards).
 *
 * @param containerRef - Ref to the scrollable container element
 * @param ignoreSelector - CSS selector for elements that should NOT trigger scroll (e.g., '[data-kanban-card]')
 * @param enabled - Whether the hook is active (disable on touch devices)
 */
export function useDragToScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  ignoreSelector: string,
  enabled: boolean = true
) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Ignore if the mousedown target is inside an element matching the selector
    // (e.g., a kanban card — those should drag-and-drop, not scroll)
    const target = e.target as HTMLElement;
    if (target.closest(ignoreSelector)) return;

    // Only respond to left mouse button
    if (e.button !== 0) return;

    isDraggingRef.current = true;
    startXRef.current = e.pageX - container.offsetLeft;
    scrollLeftRef.current = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  }, [containerRef, ignoreSelector, enabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = x - startXRef.current;
    container.scrollLeft = scrollLeftRef.current - walk;
  }, [containerRef]);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const container = containerRef.current;
    if (container) {
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  }, [containerRef]);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    // Attach move/up to document so dragging outside the container still works
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, handleMouseDown, handleMouseMove, handleMouseUp, containerRef]);
}
