import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ErrorStateProps {
  error: string | null;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error }) => {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Order not found'}</p>
        <button
          onClick={() => navigate('/orders')}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Back to orders
        </button>
      </div>
    </div>
  );
};

export default ErrorState;