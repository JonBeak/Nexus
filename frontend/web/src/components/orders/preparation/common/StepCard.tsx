/**
 * Step Card Component
 *
 * Reusable card wrapper for preparation steps.
 * Provides consistent layout with header, body, and footer sections.
 */

import React, { ReactNode } from 'react';

interface StepCardProps {
  title: string;
  description: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const StepCard: React.FC<StepCardProps> = ({
  title,
  description,
  header,
  children,
  footer,
  className = ''
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header Section */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-600">{description}</p>
          </div>
          {header && (
            <div className="ml-4 flex-shrink-0">
              {header}
            </div>
          )}
        </div>
      </div>

      {/* Body Section */}
      <div className="px-4 py-3">
        {children}
      </div>

      {/* Footer Section (optional) */}
      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          {footer}
        </div>
      )}
    </div>
  );
};
