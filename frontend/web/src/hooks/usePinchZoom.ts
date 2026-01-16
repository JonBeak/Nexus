import { useState, useRef, useCallback } from 'react';

/**
 * Hook for pinch-to-zoom and pan gestures on touch devices,
 * plus wheel zoom and click-drag pan on desktop.
 */

interface PinchZoomConfig {
  minScale?: number;      // Default: 1.0
  maxScale?: number;      // Default: 4.0
  doubleTapZoom?: number; // Default: 2.0 (scale on double-tap)
}

interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface TouchPoint {
  x: number;
  y: number;
}

export function usePinchZoom(config: PinchZoomConfig = {}) {
  const { minScale = 1.0, maxScale = 4.0, doubleTapZoom = 2.0 } = config;

  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Refs for tracking touch state
  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const initialTouchRef = useRef<TouchPoint | null>(null);
  const initialTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapRef = useRef<number>(0);
  const isPanningRef = useRef(false);

  // Mouse drag state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<TouchPoint | null>(null);

  // Calculate distance between two touch points
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get midpoint between two touches
  const getMidpoint = (touch1: Touch, touch2: Touch): TouchPoint => ({
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  });

  // Clamp scale within bounds
  const clampScale = (scale: number): number => {
    return Math.min(maxScale, Math.max(minScale, scale));
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture start
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialDistanceRef.current = getDistance(touch1, touch2);
      initialScaleRef.current = state.scale;
      isPanningRef.current = false;
    } else if (e.touches.length === 1) {
      // Check for double-tap
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double-tap detected
        e.preventDefault();
        setState(prev => {
          if (prev.scale > 1) {
            // Reset to 1x
            return { scale: 1, translateX: 0, translateY: 0 };
          } else {
            // Zoom to doubleTapZoom
            return { scale: doubleTapZoom, translateX: 0, translateY: 0 };
          }
        });
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      // Single touch - pan start (only if zoomed)
      if (state.scale > 1) {
        isPanningRef.current = true;
        initialTouchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        initialTranslateRef.current = {
          x: state.translateX,
          y: state.translateY,
        };
      }
    }
  }, [state.scale, doubleTapZoom]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistanceRef.current !== null) {
      // Pinch gesture
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = getDistance(touch1, touch2);
      const scaleRatio = currentDistance / initialDistanceRef.current;
      const newScale = clampScale(initialScaleRef.current * scaleRatio);

      setState(prev => ({
        ...prev,
        scale: newScale,
        // Reset translation if scale returns to 1
        translateX: newScale <= 1 ? 0 : prev.translateX,
        translateY: newScale <= 1 ? 0 : prev.translateY,
      }));
    } else if (e.touches.length === 1 && isPanningRef.current && initialTouchRef.current) {
      // Pan gesture (when zoomed)
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - initialTouchRef.current.x;
      const deltaY = touch.clientY - initialTouchRef.current.y;

      setState(prev => ({
        ...prev,
        translateX: initialTranslateRef.current.x + deltaX,
        translateY: initialTranslateRef.current.y + deltaY,
      }));
    }
  }, [maxScale, minScale]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialDistanceRef.current = null;
    }
    if (e.touches.length === 0) {
      isPanningRef.current = false;
      initialTouchRef.current = null;
    }
  }, []);

  // Mouse wheel zoom (desktop)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;

    setState(prev => {
      const newScale = clampScale(prev.scale + delta);
      return {
        scale: newScale,
        // Reset translation if scale returns to 1
        translateX: newScale <= 1 ? 0 : prev.translateX,
        translateY: newScale <= 1 ? 0 : prev.translateY,
      };
    });
  }, [maxScale, minScale]);

  // Double-click to toggle zoom (desktop)
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => {
      if (prev.scale > 1) {
        return { scale: 1, translateX: 0, translateY: 0 };
      } else {
        return { scale: doubleTapZoom, translateX: 0, translateY: 0 };
      }
    });
  }, [doubleTapZoom]);

  // Mouse drag for panning (desktop, when zoomed)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (state.scale > 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialTranslateRef.current = {
        x: state.translateX,
        y: state.translateY,
      };
      e.preventDefault();
    }
  }, [state.scale, state.translateX, state.translateY]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current && dragStartRef.current) {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setState(prev => ({
        ...prev,
        translateX: initialTranslateRef.current.x + deltaX,
        translateY: initialTranslateRef.current.y + deltaY,
      }));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  }, []);

  const onMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  // Zoom in/out by step
  const zoomIn = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: clampScale(prev.scale + 0.25),
    }));
  }, [maxScale, minScale]);

  const zoomOut = useCallback(() => {
    setState(prev => {
      const newScale = clampScale(prev.scale - 0.25);
      return {
        scale: newScale,
        translateX: newScale <= 1 ? 0 : prev.translateX,
        translateY: newScale <= 1 ? 0 : prev.translateY,
      };
    });
  }, [maxScale, minScale]);

  return {
    state,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onWheel,
      onDoubleClick,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
    },
    reset,
    zoomIn,
    zoomOut,
  };
}
