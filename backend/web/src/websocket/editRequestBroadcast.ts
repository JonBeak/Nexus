/**
 * Edit Request Broadcast Helper
 *
 * Emits real-time edit request events for both Task Sessions and Time Tracking.
 * Managers receive notifications when staff submit requests.
 * Staff receive notifications when their requests are processed.
 */

import { getSocketServer } from './socketServer';

// =====================================================
// SESSION EDIT REQUEST PAYLOADS
// =====================================================

export interface SessionEditRequestSubmittedPayload {
  type: 'session-edit-request:submitted';
  requestId: number;
  sessionId: number;
  requestType: 'edit' | 'delete';
  userId: number;
  staffName: string;
  taskName: string;
  orderNumber: string;
  timestamp: number;
}

export interface SessionEditRequestProcessedPayload {
  type: 'session-edit-request:processed';
  requestId: number;
  sessionId: number;
  action: 'approved' | 'rejected' | 'modified';
  requestType: 'edit' | 'delete';
  userId: number;  // The staff who submitted the request
  reviewerId: number;
  reviewerName: string;
  timestamp: number;
}

export interface SessionEditRequestCountPayload {
  type: 'session-edit-request:count';
  count: number;
  timestamp: number;
}

// =====================================================
// TIME EDIT REQUEST PAYLOADS
// =====================================================

export interface TimeEditRequestSubmittedPayload {
  type: 'time-edit-request:submitted';
  requestId: number;
  timeEntryId: number;
  requestType: 'edit' | 'delete';
  userId: number;
  staffName: string;
  entryDate: string;
  timestamp: number;
}

export interface TimeEditRequestProcessedPayload {
  type: 'time-edit-request:processed';
  requestId: number;
  timeEntryId: number;
  action: 'approved' | 'rejected' | 'modified';
  requestType: 'edit' | 'delete';
  userId: number;  // The staff who submitted the request
  reviewerId: number;
  reviewerName: string;
  timestamp: number;
}

export interface TimeEditRequestCountPayload {
  type: 'time-edit-request:count';
  count: number;
  timestamp: number;
}

// =====================================================
// SESSION EDIT REQUEST BROADCASTS
// =====================================================

/**
 * Broadcast when a staff member submits a session edit request
 * Managers in the edit-requests room will receive this
 */
export const broadcastSessionEditRequestSubmitted = (
  requestId: number,
  sessionId: number,
  requestType: 'edit' | 'delete',
  userId: number,
  staffName: string,
  taskName: string,
  orderNumber: string
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast session edit request - server not initialized');
    return;
  }

  const payload: SessionEditRequestSubmittedPayload = {
    type: 'session-edit-request:submitted',
    requestId,
    sessionId,
    requestType,
    userId,
    staffName,
    taskName,
    orderNumber,
    timestamp: Date.now()
  };

  io.to('edit-requests').emit('session-edit-request:submitted', payload);
  console.log(`🔌 WebSocket: Broadcasted session ${requestType} request from ${staffName}`);
};

/**
 * Broadcast when a manager processes a session edit request
 * The staff member who submitted the request will receive this
 */
export const broadcastSessionEditRequestProcessed = (
  requestId: number,
  sessionId: number,
  action: 'approved' | 'rejected' | 'modified',
  requestType: 'edit' | 'delete',
  userId: number,
  reviewerId: number,
  reviewerName: string
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast session request processed - server not initialized');
    return;
  }

  const payload: SessionEditRequestProcessedPayload = {
    type: 'session-edit-request:processed',
    requestId,
    sessionId,
    action,
    requestType,
    userId,
    reviewerId,
    reviewerName,
    timestamp: Date.now()
  };

  // Broadcast to edit-requests room (managers will see count update)
  io.to('edit-requests').emit('session-edit-request:processed', payload);

  // Also emit to the specific user's room so they get notified
  io.to(`user:${userId}`).emit('session-edit-request:processed', payload);

  console.log(`🔌 WebSocket: Broadcasted session request ${action} by ${reviewerName} for user ${userId}`);
};

/**
 * Broadcast updated pending count for session edit requests
 */
export const broadcastSessionEditRequestCount = (count: number): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast count - server not initialized');
    return;
  }

  const payload: SessionEditRequestCountPayload = {
    type: 'session-edit-request:count',
    count,
    timestamp: Date.now()
  };

  io.to('edit-requests').emit('session-edit-request:count', payload);
  console.log(`🔌 WebSocket: Broadcasted session edit request count: ${count}`);
};

// =====================================================
// TIME EDIT REQUEST BROADCASTS
// =====================================================

/**
 * Broadcast when a staff member submits a time edit request
 * Managers in the edit-requests room will receive this
 */
export const broadcastTimeEditRequestSubmitted = (
  requestId: number,
  timeEntryId: number,
  requestType: 'edit' | 'delete',
  userId: number,
  staffName: string,
  entryDate: string
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast time edit request - server not initialized');
    return;
  }

  const payload: TimeEditRequestSubmittedPayload = {
    type: 'time-edit-request:submitted',
    requestId,
    timeEntryId,
    requestType,
    userId,
    staffName,
    entryDate,
    timestamp: Date.now()
  };

  io.to('edit-requests').emit('time-edit-request:submitted', payload);
  console.log(`🔌 WebSocket: Broadcasted time ${requestType} request from ${staffName}`);
};

/**
 * Broadcast when a manager processes a time edit request
 * The staff member who submitted the request will receive this
 */
export const broadcastTimeEditRequestProcessed = (
  requestId: number,
  timeEntryId: number,
  action: 'approved' | 'rejected' | 'modified',
  requestType: 'edit' | 'delete',
  userId: number,
  reviewerId: number,
  reviewerName: string
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast time request processed - server not initialized');
    return;
  }

  const payload: TimeEditRequestProcessedPayload = {
    type: 'time-edit-request:processed',
    requestId,
    timeEntryId,
    action,
    requestType,
    userId,
    reviewerId,
    reviewerName,
    timestamp: Date.now()
  };

  // Broadcast to edit-requests room (managers will see count update)
  io.to('edit-requests').emit('time-edit-request:processed', payload);

  // Also emit to the specific user's room so they get notified
  io.to(`user:${userId}`).emit('time-edit-request:processed', payload);

  console.log(`🔌 WebSocket: Broadcasted time request ${action} by ${reviewerName} for user ${userId}`);
};

/**
 * Broadcast updated pending count for time edit requests
 */
export const broadcastTimeEditRequestCount = (count: number): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast count - server not initialized');
    return;
  }

  const payload: TimeEditRequestCountPayload = {
    type: 'time-edit-request:count',
    count,
    timestamp: Date.now()
  };

  io.to('edit-requests').emit('time-edit-request:count', payload);
  console.log(`🔌 WebSocket: Broadcasted time edit request count: ${count}`);
};
