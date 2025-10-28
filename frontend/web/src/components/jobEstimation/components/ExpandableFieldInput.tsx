/**
 * ExpandableFieldInput - Smart expandable text input with overlay
 *
 * Features:
 * - Auto-opens when text >10 characters
 * - Manual expand icon for shorter text
 * - Real-time sync between base input and overlay
 * - Fixed height (200-400px) with scrolling for overflow
 * - Positioned below field or above to avoid extending page
 * - Keyboard handling: Tab/Enter commits, Escape reverts
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2 } from 'lucide-react';

// Constants
const OVERLAY_MIN_HEIGHT = 200;
const OVERLAY_MAX_HEIGHT = 400;
const HELPER_TEXT_HEIGHT = 44;
const OVERLAY_GAP = 4;

interface ExpandableFieldInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  placeholder?: string;
  isReadOnly?: boolean;
  className?: string;
  allowExpansion: boolean;
  title?: string; // Tooltip text (native title attribute)
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void; // For grid navigation
}

export const ExpandableFieldInput: React.FC<ExpandableFieldInputProps> = ({
  value,
  onChange,
  onCommit,
  placeholder = '',
  isReadOnly = false,
  className = '',
  allowExpansion,
  title,
  onKeyDown
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [savedValue, setSavedValue] = useState(value);
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0 });
  const [overlayHeight, setOverlayHeight] = useState(OVERLAY_MIN_HEIGHT);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-open logic: >10 characters
  const shouldAutoOpen = allowExpansion && value.length > 10;

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Calculate overlay position - based on page content, not viewport
  const calculatePosition = useCallback((heightOverride?: number) => {
    if (!inputRef.current) return;

    const rect = inputRef.current.getBoundingClientRect();

    // Get total document height (current page length)
    const documentHeight = document.documentElement.scrollHeight;

    // Calculate total overlay height: textarea + helper text box + gaps
    // Use heightOverride if provided, otherwise fall back to state or default
    const actualOverlayHeight = heightOverride ?? overlayHeight ?? OVERLAY_MIN_HEIGHT;
    const totalHeight = actualOverlayHeight + OVERLAY_GAP + HELPER_TEXT_HEIGHT;

    // Calculate absolute position in document (not viewport)
    const fieldAbsoluteBottom = rect.bottom + window.scrollY;
    const fieldAbsoluteTop = rect.top + window.scrollY;

    let top: number;
    let left = rect.left + window.scrollX;

    // Check if positioning below would extend beyond current page content
    // Add 20px buffer to avoid edge cases
    const wouldExtendPage = (fieldAbsoluteBottom + 4 + totalHeight + 20) > documentHeight;

    if (wouldExtendPage) {
      // Position above the field to avoid extending page
      top = fieldAbsoluteTop - totalHeight - 4;
    } else {
      // Position below the field (there's enough content below)
      top = fieldAbsoluteBottom + 4;
    }

    setOverlayPosition({ top, left });
  }, [overlayHeight]);

  // Calculate height based on content - with scrolling for overflow
  const calculateHeight = useCallback(() => {
    // Simple calculation based on lines
    const lineHeight = 24;
    const lines = localValue.split('\n').length;
    const estimatedContentHeight = lines * lineHeight + 40; // Add padding

    const newHeight = Math.min(Math.max(estimatedContentHeight, OVERLAY_MIN_HEIGHT), OVERLAY_MAX_HEIGHT);
    setOverlayHeight(newHeight);
    return newHeight; // Return the calculated height
  }, [localValue]);

  // Handle input focus - auto-open if text >10 chars
  const handleFocus = useCallback(() => {
    if (!allowExpansion) return;

    setSavedValue(localValue);

    if (shouldAutoOpen) {
      // Calculate height first and get the value
      const calculatedHeight = calculateHeight();

      // Use setTimeout to ensure DOM is ready, but pass calculated height directly
      setTimeout(() => {
        calculatePosition(calculatedHeight);
        setIsExpanded(true);

        // Focus overlay after it renders
        setTimeout(() => {
          overlayRef.current?.focus();
        }, 0);
      }, 0);
    }
  }, [allowExpansion, shouldAutoOpen, localValue, calculatePosition, calculateHeight]);

  // Handle manual expand icon click
  const handleExpandClick = useCallback(() => {
    if (!allowExpansion || isReadOnly) return;

    setSavedValue(localValue);

    // Calculate height first and get the value
    const calculatedHeight = calculateHeight();

    setTimeout(() => {
      calculatePosition(calculatedHeight);
      setIsExpanded(true);

      // Focus overlay after it renders
      setTimeout(() => {
        overlayRef.current?.focus();
        // Select all text for easy replacement
        overlayRef.current?.select();
      }, 0);
    }, 0);
  }, [allowExpansion, isReadOnly, localValue, calculatePosition, calculateHeight]);

  // Handle value change - real-time sync
  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  // Handle commit - close and save
  const handleCommit = useCallback(() => {
    setIsExpanded(false);
    onCommit(localValue);
    setSavedValue(localValue);
  }, [localValue, onCommit]);

  // Handle escape - revert and close
  const handleEscape = useCallback(() => {
    setLocalValue(savedValue);
    onChange(savedValue);
    setIsExpanded(false);
  }, [savedValue, onChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleEscape();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Enter commits and closes (Shift+Enter for new line)
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Tab') {
      // Tab commits and closes, then moves to next field
      e.preventDefault();
      handleCommit();

      // Find and focus the next/previous input field in the grid
      setTimeout(() => {
        if (!inputRef.current) return;

        // Get all focusable inputs in the table (the grid)
        const table = inputRef.current.closest('table');
        if (!table) return;

        const allInputs = Array.from(
          table.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ) as HTMLElement[];

        // Find current input's index
        const currentIndex = allInputs.indexOf(inputRef.current);

        if (currentIndex === -1) return;

        // Calculate next/previous index based on Shift key
        const nextIndex = e.shiftKey
          ? currentIndex - 1  // Shift+Tab goes backwards
          : currentIndex + 1; // Tab goes forward

        // Focus the next/previous input if it exists
        if (nextIndex >= 0 && nextIndex < allInputs.length) {
          allInputs[nextIndex].focus();
        }
      }, 0);
    }
  }, [handleEscape, handleCommit]);

  // Handle click outside overlay - commit and close
  // Note: Clicking the base input field will NOT close the overlay (intentional)
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleCommit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, handleCommit]);

  // Recalculate position on window resize only (not scroll, not height change)
  useEffect(() => {
    if (!isExpanded) return;

    const handleResize = () => {
      // Pass current overlayHeight to avoid using stale state
      calculatePosition(overlayHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isExpanded, calculatePosition, overlayHeight]);

  if (!allowExpansion) {
    // No expansion allowed - render plain input
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => onCommit(localValue)}
        onKeyDown={onKeyDown}
        className={className}
        placeholder={placeholder}
        readOnly={isReadOnly}
        title={title || placeholder}
      />
    );
  }

  // Render base input with expand functionality
  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => {
          // Only commit if overlay is not open
          if (!isExpanded) {
            onCommit(localValue);
          }
        }}
        onKeyDown={onKeyDown}
        className={className}
        placeholder={placeholder}
        readOnly={isReadOnly}
        title={title || placeholder}
      />

      {/* Manual expand icon - show when text ≤10 chars and not expanded */}
      {!shouldAutoOpen && !isExpanded && !isReadOnly && (
        <button
          type="button"
          onClick={handleExpandClick}
          tabIndex={-1}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Expand input"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      )}

      {/* Overlay textarea - rendered via portal */}
      {isExpanded && createPortal(
        <div
          style={{
            position: 'absolute',
            top: overlayPosition.top,
            left: overlayPosition.left,
            zIndex: 1000,
          }}
        >
          <textarea
            ref={overlayRef}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="px-3 py-2 text-sm border-2 border-blue-500 rounded shadow-lg bg-white focus:outline-none resize-none overflow-y-auto"
            style={{
              width: '500px',
              height: `${overlayHeight}px`
            }}
            placeholder={placeholder}
          />
          <div className="mt-1 text-xs text-gray-600 bg-white px-3 py-2 rounded border-2 border-blue-500 shadow-lg">
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to save, {' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> to save & next field, {' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to cancel, {' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Shift+Enter</kbd> for new line
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
