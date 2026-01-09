import React from 'react';
import { X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const BaseModal: React.FC<BaseModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'md' 
}) => {
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={`relative ${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full ${widthClasses[maxWidth]} transform transition-all`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>{title}</h3>
            <button
              onClick={onClose}
              className={`${PAGE_STYLES.panel.textMuted} hover:text-gray-700 transition-colors`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};