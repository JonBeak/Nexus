import React, { useState, useRef, useCallback } from 'react';

interface ClockSliderProps {
  isClocked: boolean;
  onConfirm: () => void;
  disabled?: boolean;
}

const COMPLETION_THRESHOLD = 0.95; // 95% completion required

function ClockSlider({ isClocked, onConfirm, disabled = false }: ClockSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const startPositionRef = useRef(0);
  const maxWidthRef = useRef(0);

  const resetSlider = useCallback(() => {
    setDragProgress(0);
    setIsDragging(false);
    setIsCompleted(false);
  }, []);

  const handleStart = useCallback((clientX: number) => {
    if (disabled || isCompleted) return;

    setIsDragging(true);
    startPositionRef.current = clientX;

    if (sliderRef.current && thumbRef.current) {
      const sliderRect = sliderRef.current.getBoundingClientRect();
      const thumbWidth = thumbRef.current.getBoundingClientRect().width;
      maxWidthRef.current = sliderRect.width - thumbWidth;
    }
  }, [disabled, isCompleted]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || disabled || isCompleted) return;

    const deltaX = clientX - startPositionRef.current;
    const progress = Math.max(0, Math.min(1, deltaX / maxWidthRef.current));
    setDragProgress(progress);
  }, [isDragging, disabled, isCompleted]);

  const handleEnd = useCallback(() => {
    if (!isDragging || disabled) return;

    if (dragProgress >= COMPLETION_THRESHOLD) {
      setIsCompleted(true);
      setDragProgress(1);
      setTimeout(() => {
        onConfirm();
        setTimeout(resetSlider, 300); // Reset after animation
      }, 150);
    } else {
      // Spring back animation
      setDragProgress(0);
      setIsDragging(false);
    }
  }, [isDragging, dragProgress, disabled, onConfirm, resetSlider]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Keyboard support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      if (confirm(isClocked ? 'Clock out now?' : 'Clock in now?')) {
        onConfirm();
      }
    }
  };

  // Add/remove global event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const baseColors = isClocked
    ? {
        track: 'bg-gradient-to-r from-red-400 to-red-600',
        activeTrack: 'bg-gradient-to-r from-red-500 to-red-700',
        thumb: 'bg-red-700',
        text: 'text-red-100',
        completedTrack: 'bg-red-700'
      }
    : {
        track: 'bg-gradient-to-r from-green-400 to-green-600',
        activeTrack: 'bg-gradient-to-r from-green-500 to-green-700',
        thumb: 'bg-green-700',
        text: 'text-green-100',
        completedTrack: 'bg-green-700'
      };

  const thumbPosition = dragProgress * maxWidthRef.current;

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        ref={sliderRef}
        className={`
          relative h-16 rounded-full overflow-hidden cursor-grab select-none
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isDragging ? 'cursor-grabbing' : ''}
          ${isCompleted ? baseColors.completedTrack : baseColors.track}
          transition-all duration-300 shadow-lg
        `}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={isClocked ? 'Swipe to clock out' : 'Swipe to clock in'}
        aria-disabled={disabled}
      >

        {/* Text */}
        <div className={`
          absolute inset-0 flex items-center justify-center font-bold text-lg
          ${baseColors.text}
          ${isCompleted ? 'opacity-0' : 'opacity-100'}
          transition-opacity duration-150
        `}>
          {dragProgress >= COMPLETION_THRESHOLD
            ? 'Release to confirm'
            : isClocked ? 'Swipe to Clock Out →' : 'Swipe to Clock In →'
          }
        </div>

        {/* Success text */}
        {isCompleted && (
          <div className={`
            absolute inset-0 flex items-center justify-center font-bold text-lg text-white
            opacity-100 transition-opacity duration-150
          `}>
            {isClocked ? 'Clocking Out...' : 'Clocking In...'}
          </div>
        )}

        {/* Draggable thumb */}
        <div
          ref={thumbRef}
          className={`
            absolute top-1 left-1 h-14 w-14 rounded-full shadow-lg
            flex items-center justify-center transition-all duration-150
            ${baseColors.thumb} opacity-65 border-2 border-white
            ${isDragging ? 'scale-110' : 'scale-100'}
            ${isCompleted ? 'scale-100' : ''}
          `}
          style={{
            transform: `translateX(${thumbPosition}px) ${isDragging ? 'scale(1.1)' : 'scale(1)'}`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          {/* Thumb icon */}
          <div className="text-white text-xl">
            {isCompleted ? '✓' : '→'}
          </div>
        </div>

      </div>
    </div>
  );
}

export default ClockSlider;