/**
 * AlertContext - Centralized alert and confirmation management
 *
 * Provides methods to show alerts and confirmations without using browser
 * alert() and confirm() calls.
 *
 * Usage:
 *   const { showError, showSuccess, showConfirmation } = useAlert();
 *
 *   // Simple alerts
 *   showError('Failed to save changes');
 *   showSuccess('Changes saved successfully');
 *
 *   // Confirmations
 *   const confirmed = await showConfirmation({
 *     title: 'Confirm Delete',
 *     message: 'Are you sure?',
 *     variant: 'danger'
 *   });
 *   if (confirmed) { ... }
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { AlertModal } from '../components/common/alerts/AlertModal';
import { ConfirmationModal } from '../components/common/alerts/ConfirmationModal';
import type { AlertData, ConfirmData, AlertType } from '../components/common/alerts/types';

interface AlertContextType {
  // Generic alert
  showAlert: (data: AlertData) => void;

  // Convenience methods
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;

  // Confirmation dialog (returns Promise<boolean>)
  showConfirmation: (data: ConfirmData) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  // Alert state
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  // Confirmation state
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Resolve function for confirmation promises
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  // Generic alert display
  const showAlert = useCallback((data: AlertData) => {
    setAlertData(data);
    setAlertOpen(true);
  }, []);

  // Close alert
  const closeAlert = useCallback(() => {
    setAlertOpen(false);
    // Delay clearing data to allow fade animation
    setTimeout(() => setAlertData(null), 150);
  }, []);

  // Convenience methods
  const showTypedAlert = useCallback((type: AlertType, message: string, title?: string) => {
    const defaultTitles: Record<AlertType, string> = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Information'
    };
    showAlert({
      type,
      title: title || defaultTitles[type],
      message
    });
  }, [showAlert]);

  const showSuccess = useCallback((message: string, title?: string) => {
    showTypedAlert('success', message, title);
  }, [showTypedAlert]);

  const showError = useCallback((message: string, title?: string) => {
    showTypedAlert('error', message, title);
  }, [showTypedAlert]);

  const showWarning = useCallback((message: string, title?: string) => {
    showTypedAlert('warning', message, title);
  }, [showTypedAlert]);

  const showInfo = useCallback((message: string, title?: string) => {
    showTypedAlert('info', message, title);
  }, [showTypedAlert]);

  // Confirmation dialog
  const showConfirmation = useCallback((data: ConfirmData): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmData(data);
      setConfirmOpen(true);
      setConfirmLoading(false);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(true);
      confirmResolveRef.current = null;
    }
    setTimeout(() => setConfirmData(null), 150);
  }, []);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(false);
      confirmResolveRef.current = null;
    }
    setTimeout(() => setConfirmData(null), 150);
  }, []);

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirmation
      }}
    >
      {children}
      <AlertModal
        isOpen={alertOpen}
        onClose={closeAlert}
        data={alertData}
      />
      <ConfirmationModal
        isOpen={confirmOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        data={confirmData}
        isLoading={confirmLoading}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export default AlertContext;
