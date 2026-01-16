/**
 * MobileScrollbar - Custom horizontal scrollbar for mobile Kanban view
 * Large touch target for easy scrolling without interfering with card drag
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface MobileScrollbarProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

export const MobileScrollbar: React.FC<MobileScrollbarProps> = ({ scrollContainerRef }) => {
  const [thumbWidth, setThumbWidth] = useState(20); // percentage
  const [thumbPosition, setThumbPosition] = useState(0); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  // Update thumb size and position based on scroll container
  const updateThumb = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { clientWidth, scrollWidth, scrollLeft } = container;
    if (scrollWidth <= clientWidth) {
      setThumbWidth(100);
      setThumbPosition(0);
      return;
    }

    const visibleRatio = clientWidth / scrollWidth;
    const scrollRatio = scrollLeft / (scrollWidth - clientWidth);

    setThumbWidth(Math.max(visibleRatio * 100, 15)); // Min 15% for usability
    setThumbPosition(scrollRatio * (100 - visibleRatio * 100));
  }, [scrollContainerRef]);

  // Listen to scroll events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateThumb();
    container.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);

    return () => {
      container.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
    };
  }, [scrollContainerRef, updateThumb]);

  // Handle touch start on thumb
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.touches[0].clientX,
      scrollLeft: container.scrollLeft
    };
  };

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const container = scrollContainerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    e.preventDefault(); // Prevent page scroll while dragging scrollbar

    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const trackWidth = track.clientWidth;
    const scrollWidth = container.scrollWidth - container.clientWidth;

    // Convert drag distance to scroll distance
    const scrollDelta = (deltaX / trackWidth) * scrollWidth;
    container.scrollLeft = dragStartRef.current.scrollLeft + scrollDelta;
  }, [isDragging, scrollContainerRef]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Add global touch listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  // Handle tap on track (jump to position)
  const handleTrackTap = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const trackRect = track.getBoundingClientRect();
    const tapX = e.touches[0].clientX - trackRect.left;
    const tapRatio = tapX / trackRect.width;

    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = tapRatio * maxScroll;
  };

  return (
    <div
      ref={trackRef}
      className="h-12 mx-4 mb-2 bg-gray-300 rounded-lg relative touch-none select-none"
      onTouchStart={handleTrackTap}
    >
      {/* Thumb */}
      <div
        className={`absolute top-1 bottom-1 rounded-md transition-colors ${
          isDragging ? 'bg-gray-600' : 'bg-gray-500'
        }`}
        style={{
          left: `${thumbPosition}%`,
          width: `${thumbWidth}%`,
        }}
        onTouchStart={handleTouchStart}
      >
        {/* Grip lines for visual affordance */}
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
          <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
          <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
        </div>
      </div>
    </div>
  );
};
