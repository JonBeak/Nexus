/**
 * Alert System Types
 * Shared types for AlertModal and ConfirmationModal components
 */

import { ReactNode } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertData {
  type: AlertType;
  title: string;
  message: string;
  details?: string;
  buttonText?: string;
}

export type ConfirmVariant = 'danger' | 'warning' | 'default';

export interface ConfirmData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  details?: ReactNode;
}
