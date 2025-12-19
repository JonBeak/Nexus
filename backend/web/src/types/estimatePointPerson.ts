/**
 * Estimate Point Person Type Definitions
 * Phase 4c - Estimate Workflow Redesign
 */

import { EstimatePreviewData } from './orders';

// =============================================
// ESTIMATE POINT PERSON TYPES
// =============================================

export interface EstimatePointPerson {
  id: number;
  estimate_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
  created_at: Date;
}

export interface CreateEstimatePointPersonData {
  estimate_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
}

export interface EstimatePointPersonInput {
  contact_id?: number;           // If selecting from existing customer_contacts
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  saveToDatabase?: boolean;      // If true, save custom contact to customer_contacts table
}

// =============================================
// PREPARE/SEND REQUEST TYPES
// =============================================

export interface PrepareEstimateRequest {
  emailSubject?: string;
  emailBody?: string;
  pointPersons?: EstimatePointPersonInput[];
  estimatePreviewData?: EstimatePreviewData; // For auto-filling QB descriptions
}

export interface SendEstimateRequest {
  // Currently no additional params needed - uses saved point persons and email content
}

export interface PrepareEstimateResult {
  success: boolean;
  estimateId: number;
  deletedRowCount: number;
  remainingRowCount: number;
}

export interface SendEstimateResult {
  success: boolean;
  estimateId: number;
  qbEstimateId?: string;
  qbEstimateUrl?: string;
  emailSentTo?: string[];
  message?: string; // Optional message (e.g., "This estimate was previously sent")
}
