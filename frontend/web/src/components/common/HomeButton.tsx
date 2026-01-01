import React from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HomeButtonProps {
  className?: string;
}

/**
 * Reusable Home navigation button.
 * Navigates to the dashboard when clicked.
 */
export const HomeButton: React.FC<HomeButtonProps> = ({ className = '' }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/dashboard')}
      className={`p-2 text-gray-900 hover:text-black hover:bg-gray-300 rounded-lg transition-colors ${className}`}
      title="Go to Dashboard"
    >
      <Home className="w-7 h-7" />
    </button>
  );
};
