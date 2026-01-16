import { useRef, useCallback } from 'react';

export interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number; // default 50px
  maxSwipeTime?: number; // default 300ms
}

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Hook to detect horizontal swipe gestures
 * @param config - Configuration for swipe detection
 * @returns Touch event handlers to attach to a component
 */
export function useTouchSwipe(config: SwipeConfig): SwipeHandlers {
  const {
    onSwipeLeft,
    onSwipeRight,
    minSwipeDistance = 50,
    maxSwipeTime = 300
  } = config;

  const touchStartRef = useRef<{ x: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = {
        x: touch.clientX,
        time: Date.now()
      };
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Only register as swipe if quick enough and far enough
    if (deltaTime <= maxSwipeTime && Math.abs(deltaX) >= minSwipeDistance) {
      if (deltaX > 0) {
        // Swiped right
        onSwipeRight?.();
      } else {
        // Swiped left
        onSwipeLeft?.();
      }
    }

    touchStartRef.current = null;
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance, maxSwipeTime]);

  return { onTouchStart, onTouchEnd };
}
