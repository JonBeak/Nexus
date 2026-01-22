/**
 * Feedback Button
 * Floating button that appears on all pages for submitting feedback
 * Shows menu with "Submit Feedback", "My Feedback", and "Feedback Manager" (owners) options
 *
 * Created: 2026-01-16
 * Updated: 2026-01-16 - Added menu with My Feedback option
 * Updated: 2026-01-22 - Added notification dot and Feedback Manager link for owners
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Send, List, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeedbackSubmitModal } from './FeedbackSubmitModal';
import { useAuth } from '../../contexts/AuthContext';
import { feedbackApi } from '../../services/api';

export const FeedbackButton: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
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

  return (
    <>
      {/* Floating button container */}
      <div ref={menuRef} className="fixed bottom-4 right-4 z-40">
        {/* Menu popup */}
        {isMenuOpen && (
          <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[160px]">
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
