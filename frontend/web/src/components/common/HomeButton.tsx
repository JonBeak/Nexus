import React from 'react';
import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HomeButtonProps {
  className?: string;
}

/**
 * Reusable Home navigation button.
 * Navigates to the dashboard when clicked.
 * Supports right-click context menu and middle-click to open in new tab.
 */
export const HomeButton: React.FC<HomeButtonProps> = ({ className = '' }) => {
  return (
    <Link
      to="/dashboard"
      className={`p-2 text-gray-900 hover:text-black hover:bg-gray-300 rounded-lg transition-colors inline-flex items-center justify-center ${className}`}
      title="Go to Dashboard"
    >
      <Home className="w-7 h-7" />
    </Link>
  );
};
