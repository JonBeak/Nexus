/**
 * Feedback Button
 * Floating button that appears on all pages for submitting feedback
 * Shows menu with "Submit Feedback", "My Feedback", and "Feedback Manager" (owners) options
 * Position can be moved to any corner and is cached in localStorage
 *
 * Created: 2026-01-16
 * Updated: 2026-01-16 - Added menu with My Feedback option
 * Updated: 2026-01-22 - Added notification dot and Feedback Manager link for owners
 * Updated: 2026-01-22 - Added corner position controls with localStorage persistence
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Send, List, Settings, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeedbackSubmitModal } from './FeedbackSubmitModal';
import { useAuth } from '../../contexts/AuthContext';
import { feedbackApi } from '../../services/api';

type CornerPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

const POSITION_STORAGE_KEY = 'feedback-button-position';

const getPositionClasses = (position: CornerPosition): string => {
  switch (position) {
    case 'bottom-right': return 'bottom-4 right-4';
    case 'bottom-left': return 'bottom-4 left-4';
    case 'top-right': return 'top-4 right-4';
    case 'top-left': return 'top-4 left-4';
    default: return 'bottom-4 right-4';
  }
};

const getMenuPositionClasses = (position: CornerPosition): string => {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  // Menu appears opposite to button position
  const vertical = isTop ? 'top-full mt-2' : 'bottom-full mb-2';
  const horizontal = isLeft ? 'left-0' : 'right-0';

  return `${vertical} ${horizontal}`;
};

export const FeedbackButton: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [position, setPosition] = useState<CornerPosition>(() => {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    return (saved as CornerPosition) || 'bottom-right';
  });
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch pending feedback count for owners
  useEffect(() => {
    if (!isOwner) return;

    const fetchCount = async () => {
      try {
        const count = await feedbackApi.getOpenCount();
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to fetch feedback count:', error);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isOwner]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Don't render if not logged in
  if (!user) return null;

  const handleSubmitClick = () => {
    setIsMenuOpen(false);
    setIsSubmitModalOpen(true);
  };

  const handleMyFeedbackClick = () => {
    setIsMenuOpen(false);
    navigate('/my-feedback');
  };

  const handlePositionChange = (newPosition: CornerPosition) => {
    setPosition(newPosition);
    localStorage.setItem(POSITION_STORAGE_KEY, newPosition);
  };

  return (
    <>
      {/* Floating button container */}
      <div ref={menuRef} className={`fixed ${getPositionClasses(position)} z-40`}>
        {/* Menu popup */}
        {isMenuOpen && (
          <div className={`absolute ${getMenuPositionClasses(position)} bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[180px]`}>
            <button
              onClick={handleSubmitClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
            >
              <Send className="w-4 h-4" />
              <span className="font-medium">Submit Feedback</span>
            </button>
            <button
              onClick={handleMyFeedbackClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left border-t border-gray-100"
            >
              <List className="w-4 h-4" />
              <span className="font-medium">My Feedback</span>
            </button>
            {isOwner && (
              <button
                onClick={() => { setIsMenuOpen(false); navigate('/feedback'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left border-t border-gray-100"
              >
                <Settings className="w-4 h-4" />
                <span className="font-medium">Feedback Manager</span>
              </button>
            )}
            {/* Position controls */}
            <div className="border-t border-gray-100 px-3 py-2">
              <div className="text-xs text-gray-500 mb-1.5">Move to corner:</div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => handlePositionChange('top-left')}
                  className={`p-1.5 rounded transition-colors ${position === 'top-left' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Top Left"
                >
                  <ArrowUpLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePositionChange('top-right')}
                  className={`p-1.5 rounded transition-colors ${position === 'top-right' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Top Right"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePositionChange('bottom-left')}
                  className={`p-1.5 rounded transition-colors ${position === 'bottom-left' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Bottom Left"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePositionChange('bottom-right')}
                  className={`p-1.5 rounded transition-colors ${position === 'bottom-right' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Bottom Right"
                >
                  <ArrowDownRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`relative flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:shadow-xl group ${isMenuOpen ? 'bg-blue-700' : ''}`}
          title="Feedback"
        >
          <MessageSquarePlus className="w-5 h-5" />
          {isOwner && pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          )}
          <span className="hidden group-hover:inline text-sm font-medium pr-1">Feedback</span>
        </button>
      </div>

      {/* Submit Modal */}
      <FeedbackSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
      />
    </>
  );
};
