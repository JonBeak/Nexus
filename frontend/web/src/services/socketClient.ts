/**
 * Socket.io Client Service
 *
 * Singleton pattern for WebSocket connection management.
 * Handles JWT authentication, auto-reconnect, and event subscriptions.
 */

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './apiClient';

// Types for task update events
export interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
  expected_version?: number;
}

export interface TaskBroadcastPayload {
  type: 'tasks:updated';
  updates: TaskUpdate[];
  statusChanges: Record<number, string>;
  userId: number;
  timestamp: number;
}

// Additional payload types for granular events
export interface TaskNotesPayload {
  type: 'task:notes';
  taskId: number;
  orderId: number;
  notes: string | null;
  userId: number;
  timestamp: number;
}

export interface TaskDeletedPayload {
  type: 'task:deleted';
  taskId: number;
  orderId: number;
  userId: number;
  timestamp: number;
}

export interface TaskCreatedPayload {
  type: 'task:created';
  taskId: number;
  orderId: number;
  partId: number;
  taskName: string;
  assignedRole: string | null;
  userId: number;
  timestamp: number;
}

export interface SessionStartedPayload {
  type: 'session:started';
  sessionId: number;
  taskId: number;
  orderId: number;
  userId: number;
  staffName: string;
  activeSessionsCount: number;
  orderStatusChange?: { orderId: number; newStatus: string };
  timestamp: number;
}

export interface SessionStoppedPayload {
  type: 'session:stopped';
  sessionId: number;
  taskId: number;
  orderId: number;
  userId: number;
  durationMinutes: number;
  activeSessionsCount: number;
  timestamp: number;
}

export interface OrderStatusPayload {
  type: 'order:status';
  orderId: number;
  orderNumber: number;
  newStatus: string;
  previousStatus: string;
  userId: number;
  timestamp: number;
}

export interface OrderCreatedPayload {
  type: 'order:created';
  orderId: number;
  orderNumber: number;
  customerId: number;
  userId: number;
  timestamp: number;
}

export interface OrderUpdatedPayload {
  type: 'order:updated';
  orderId: number;
  orderNumber: number;
  updatedFields: string[];
  userId: number;
  timestamp: number;
}

export interface OrderDeletedPayload {
  type: 'order:deleted';
  orderId: number;
  orderNumber: number;
  userId: number;
  timestamp: number;
}

export interface InvoiceUpdatedPayload {
  type: 'invoice:updated';
  orderId: number;
  orderNumber: number;
  action: 'created' | 'linked' | 'unlinked' | 'payment';
  userId: number;
  timestamp: number;
}

export interface TasksRegeneratedPayload {
  type: 'tasks:regenerated';
  orderId: number;
  orderNumber: number;
  tasksCreated: number;
  userId: number;
  timestamp: number;
}

// Edit Request Payloads
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
  userId: number;
  reviewerId: number;
  reviewerName: string;
  timestamp: number;
}

export interface SessionEditRequestCountPayload {
  type: 'session-edit-request:count';
  count: number;
  timestamp: number;
}

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
  userId: number;
  reviewerId: number;
  reviewerName: string;
  timestamp: number;
}

export interface TimeEditRequestCountPayload {
  type: 'time-edit-request:count';
  count: number;
  timestamp: number;
}

// Session Note Payloads
export interface SessionNoteCreatedPayload {
  type: 'session-note:created';
  noteId: number;
  sessionId: number;
  taskId: number;
  userId: number;
  userName: string;
  noteText: string;
  timestamp: number;
}

export interface SessionNoteUpdatedPayload {
  type: 'session-note:updated';
  noteId: number;
  sessionId: number;
  taskId: number;
  userId: number;
  noteText: string;
  timestamp: number;
}

export interface SessionNoteDeletedPayload {
  type: 'session-note:deleted';
  noteId: number;
  sessionId: number;
  taskId: number;
  userId: number;
  timestamp: number;
}

// Event listener types
type TasksUpdatedCallback = (payload: TaskBroadcastPayload) => void;
type TaskNotesCallback = (payload: TaskNotesPayload) => void;
type TaskDeletedCallback = (payload: TaskDeletedPayload) => void;
type TaskCreatedCallback = (payload: TaskCreatedPayload) => void;
type SessionStartedCallback = (payload: SessionStartedPayload) => void;
type SessionStoppedCallback = (payload: SessionStoppedPayload) => void;
type OrderStatusCallback = (payload: OrderStatusPayload) => void;
type OrderCreatedCallback = (payload: OrderCreatedPayload) => void;
type OrderUpdatedCallback = (payload: OrderUpdatedPayload) => void;
type OrderDeletedCallback = (payload: OrderDeletedPayload) => void;
type InvoiceUpdatedCallback = (payload: InvoiceUpdatedPayload) => void;
type TasksRegeneratedCallback = (payload: TasksRegeneratedPayload) => void;
// Edit request callbacks
type SessionEditRequestSubmittedCallback = (payload: SessionEditRequestSubmittedPayload) => void;
type SessionEditRequestProcessedCallback = (payload: SessionEditRequestProcessedPayload) => void;
type SessionEditRequestCountCallback = (payload: SessionEditRequestCountPayload) => void;
type TimeEditRequestSubmittedCallback = (payload: TimeEditRequestSubmittedPayload) => void;
type TimeEditRequestProcessedCallback = (payload: TimeEditRequestProcessedPayload) => void;
type TimeEditRequestCountCallback = (payload: TimeEditRequestCountPayload) => void;
// Session note callbacks
type SessionNoteCreatedCallback = (payload: SessionNoteCreatedPayload) => void;
type SessionNoteUpdatedCallback = (payload: SessionNoteUpdatedPayload) => void;
type SessionNoteDeletedCallback = (payload: SessionNoteDeletedPayload) => void;

// Singleton socket instance
let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

// Event listeners
const tasksUpdatedListeners = new Set<TasksUpdatedCallback>();
const taskNotesListeners = new Set<TaskNotesCallback>();
const taskDeletedListeners = new Set<TaskDeletedCallback>();
const taskCreatedListeners = new Set<TaskCreatedCallback>();
const sessionStartedListeners = new Set<SessionStartedCallback>();
const sessionStoppedListeners = new Set<SessionStoppedCallback>();
const orderStatusListeners = new Set<OrderStatusCallback>();
const orderCreatedListeners = new Set<OrderCreatedCallback>();
const orderUpdatedListeners = new Set<OrderUpdatedCallback>();
const orderDeletedListeners = new Set<OrderDeletedCallback>();
const invoiceUpdatedListeners = new Set<InvoiceUpdatedCallback>();
const tasksRegeneratedListeners = new Set<TasksRegeneratedCallback>();
// Edit request listeners
const sessionEditRequestSubmittedListeners = new Set<SessionEditRequestSubmittedCallback>();
const sessionEditRequestProcessedListeners = new Set<SessionEditRequestProcessedCallback>();
const sessionEditRequestCountListeners = new Set<SessionEditRequestCountCallback>();
const timeEditRequestSubmittedListeners = new Set<TimeEditRequestSubmittedCallback>();
const timeEditRequestProcessedListeners = new Set<TimeEditRequestProcessedCallback>();
const timeEditRequestCountListeners = new Set<TimeEditRequestCountCallback>();
// Session note listeners
const sessionNoteCreatedListeners = new Set<SessionNoteCreatedCallback>();
const sessionNoteUpdatedListeners = new Set<SessionNoteUpdatedCallback>();
const sessionNoteDeletedListeners = new Set<SessionNoteDeletedCallback>();

/**
 * Get the WebSocket base URL from the API URL
 * Converts /api endpoint to root for Socket.io
 */
const getSocketUrl = (): string => {
  // API_BASE_URL is like "http://192.168.2.14:3001/api" or "/api" (relative)
  if (API_BASE_URL.startsWith('/')) {
    // Relative URL - use current origin
    return window.location.origin;
  }
  // Absolute URL - extract base (remove /api suffix)
  return API_BASE_URL.replace(/\/api\/?$/, '');
};

/**
 * Get the current access token from localStorage
 */
const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

/**
 * Initialize Socket.io connection with JWT authentication
 */
export const initializeSocket = (): Promise<Socket> => {
  // Return existing connection promise if already connecting
  if (connectionPromise) {
    return connectionPromise;
  }

  // Return existing socket if already connected
  if (socket?.connected) {
    return Promise.resolve(socket);
  }

  connectionPromise = new Promise((resolve, reject) => {
    const token = getAccessToken();

    if (!token) {
      connectionPromise = null;
      reject(new Error('No access token available'));
      return;
    }

    const socketUrl = getSocketUrl();
    console.log('🔌 WebSocket: Connecting to', socketUrl);

    socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket: Connected (id:', socket?.id, ')');
      connectionPromise = null;
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket: Connection error:', error.message);
      connectionPromise = null;
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket: Disconnected -', reason);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - don't auto reconnect
        socket = null;
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 WebSocket: Reconnected after', attemptNumber, 'attempts');
      // Rejoin rooms after reconnect
      if (socket) {
        socket.emit('join:tasks-table');
      }
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔌 WebSocket: Reconnection error:', error.message);
    });

    // Set up task update listener
    socket.on('tasks:updated', (payload: TaskBroadcastPayload) => {
      console.log('🔌 WebSocket: Received tasks:updated', payload);
      tasksUpdatedListeners.forEach(callback => callback(payload));
    });

    // Set up granular event listeners
    socket.on('task:notes', (payload: TaskNotesPayload) => {
      console.log('🔌 WebSocket: Received task:notes', payload);
      taskNotesListeners.forEach(callback => callback(payload));
    });

    socket.on('task:deleted', (payload: TaskDeletedPayload) => {
      console.log('🔌 WebSocket: Received task:deleted', payload);
      taskDeletedListeners.forEach(callback => callback(payload));
    });

    socket.on('task:created', (payload: TaskCreatedPayload) => {
      console.log('🔌 WebSocket: Received task:created', payload);
      taskCreatedListeners.forEach(callback => callback(payload));
    });

    socket.on('session:started', (payload: SessionStartedPayload) => {
      console.log('🔌 WebSocket: Received session:started', payload);
      sessionStartedListeners.forEach(callback => callback(payload));
    });

    socket.on('session:stopped', (payload: SessionStoppedPayload) => {
      console.log('🔌 WebSocket: Received session:stopped', payload);
      sessionStoppedListeners.forEach(callback => callback(payload));
    });

    socket.on('order:status', (payload: OrderStatusPayload) => {
      console.log('🔌 WebSocket: Received order:status', payload);
      orderStatusListeners.forEach(callback => callback(payload));
    });

    socket.on('order:created', (payload: OrderCreatedPayload) => {
      console.log('🔌 WebSocket: Received order:created', payload);
      orderCreatedListeners.forEach(callback => callback(payload));
    });

    socket.on('order:updated', (payload: OrderUpdatedPayload) => {
      console.log('🔌 WebSocket: Received order:updated', payload);
      orderUpdatedListeners.forEach(callback => callback(payload));
    });

    socket.on('order:deleted', (payload: OrderDeletedPayload) => {
      console.log('🔌 WebSocket: Received order:deleted', payload);
      orderDeletedListeners.forEach(callback => callback(payload));
    });

    socket.on('invoice:updated', (payload: InvoiceUpdatedPayload) => {
      console.log('🔌 WebSocket: Received invoice:updated', payload);
      invoiceUpdatedListeners.forEach(callback => callback(payload));
    });

    socket.on('tasks:regenerated', (payload: TasksRegeneratedPayload) => {
      console.log('🔌 WebSocket: Received tasks:regenerated', payload);
      tasksRegeneratedListeners.forEach(callback => callback(payload));
    });

    // Edit request event handlers
    socket.on('session-edit-request:submitted', (payload: SessionEditRequestSubmittedPayload) => {
      console.log('🔌 WebSocket: Received session-edit-request:submitted', payload);
      sessionEditRequestSubmittedListeners.forEach(callback => callback(payload));
    });

    socket.on('session-edit-request:processed', (payload: SessionEditRequestProcessedPayload) => {
      console.log('🔌 WebSocket: Received session-edit-request:processed', payload);
      sessionEditRequestProcessedListeners.forEach(callback => callback(payload));
    });

    socket.on('session-edit-request:count', (payload: SessionEditRequestCountPayload) => {
      console.log('🔌 WebSocket: Received session-edit-request:count', payload);
      sessionEditRequestCountListeners.forEach(callback => callback(payload));
    });

    socket.on('time-edit-request:submitted', (payload: TimeEditRequestSubmittedPayload) => {
      console.log('🔌 WebSocket: Received time-edit-request:submitted', payload);
      timeEditRequestSubmittedListeners.forEach(callback => callback(payload));
    });

    socket.on('time-edit-request:processed', (payload: TimeEditRequestProcessedPayload) => {
      console.log('🔌 WebSocket: Received time-edit-request:processed', payload);
      timeEditRequestProcessedListeners.forEach(callback => callback(payload));
    });

    socket.on('time-edit-request:count', (payload: TimeEditRequestCountPayload) => {
      console.log('🔌 WebSocket: Received time-edit-request:count', payload);
      timeEditRequestCountListeners.forEach(callback => callback(payload));
    });

    // Session note event handlers
    socket.on('session-note:created', (payload: SessionNoteCreatedPayload) => {
      console.log('🔌 WebSocket: Received session-note:created', payload);
      sessionNoteCreatedListeners.forEach(callback => callback(payload));
    });

    socket.on('session-note:updated', (payload: SessionNoteUpdatedPayload) => {
      console.log('🔌 WebSocket: Received session-note:updated', payload);
      sessionNoteUpdatedListeners.forEach(callback => callback(payload));
    });

    socket.on('session-note:deleted', (payload: SessionNoteDeletedPayload) => {
      console.log('🔌 WebSocket: Received session-note:deleted', payload);
      sessionNoteDeletedListeners.forEach(callback => callback(payload));
    });
  });

  return connectionPromise;
};

/**
 * Disconnect the socket connection
 */
export const disconnectSocket = (): void => {
  if (socket) {
    console.log('🔌 WebSocket: Disconnecting...');
    socket.disconnect();
    socket = null;
    connectionPromise = null;
  }
};

/**
 * Get the current socket instance (may be null if not connected)
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Check if socket is connected
 */
export const isSocketConnected = (): boolean => {
  return socket?.connected ?? false;
};

/**
 * Join the tasks-table room for real-time task updates
 */
export const joinTasksTableRoom = async (): Promise<void> => {
  const sock = await initializeSocket();
  sock.emit('join:tasks-table');
  console.log('🔌 WebSocket: Joined tasks-table room');
};

/**
 * Leave the tasks-table room
 */
export const leaveTasksTableRoom = (): void => {
  if (socket?.connected) {
    socket.emit('leave:tasks-table');
    console.log('🔌 WebSocket: Left tasks-table room');
  }
};

/**
 * Subscribe to task update events
 * Returns an unsubscribe function
 */
export const onTasksUpdated = (callback: TasksUpdatedCallback): (() => void) => {
  tasksUpdatedListeners.add(callback);
  return () => {
    tasksUpdatedListeners.delete(callback);
  };
};

/**
 * Subscribe to task notes events
 */
export const onTaskNotes = (callback: TaskNotesCallback): (() => void) => {
  taskNotesListeners.add(callback);
  return () => {
    taskNotesListeners.delete(callback);
  };
};

/**
 * Subscribe to task deleted events
 */
export const onTaskDeleted = (callback: TaskDeletedCallback): (() => void) => {
  taskDeletedListeners.add(callback);
  return () => {
    taskDeletedListeners.delete(callback);
  };
};

/**
 * Subscribe to task created events
 */
export const onTaskCreated = (callback: TaskCreatedCallback): (() => void) => {
  taskCreatedListeners.add(callback);
  return () => {
    taskCreatedListeners.delete(callback);
  };
};

/**
 * Subscribe to session started events
 */
export const onSessionStarted = (callback: SessionStartedCallback): (() => void) => {
  sessionStartedListeners.add(callback);
  return () => {
    sessionStartedListeners.delete(callback);
  };
};

/**
 * Subscribe to session stopped events
 */
export const onSessionStopped = (callback: SessionStoppedCallback): (() => void) => {
  sessionStoppedListeners.add(callback);
  return () => {
    sessionStoppedListeners.delete(callback);
  };
};

/**
 * Subscribe to order status change events
 */
export const onOrderStatus = (callback: OrderStatusCallback): (() => void) => {
  orderStatusListeners.add(callback);
  return () => {
    orderStatusListeners.delete(callback);
  };
};

/**
 * Subscribe to order created events
 */
export const onOrderCreated = (callback: OrderCreatedCallback): (() => void) => {
  orderCreatedListeners.add(callback);
  return () => {
    orderCreatedListeners.delete(callback);
  };
};

/**
 * Subscribe to order updated events
 */
export const onOrderUpdated = (callback: OrderUpdatedCallback): (() => void) => {
  orderUpdatedListeners.add(callback);
  return () => {
    orderUpdatedListeners.delete(callback);
  };
};

/**
 * Subscribe to order deleted events
 */
export const onOrderDeleted = (callback: OrderDeletedCallback): (() => void) => {
  orderDeletedListeners.add(callback);
  return () => {
    orderDeletedListeners.delete(callback);
  };
};

/**
 * Subscribe to invoice updated events
 */
export const onInvoiceUpdated = (callback: InvoiceUpdatedCallback): (() => void) => {
  invoiceUpdatedListeners.add(callback);
  return () => {
    invoiceUpdatedListeners.delete(callback);
  };
};

/**
 * Subscribe to tasks regenerated events
 */
export const onTasksRegenerated = (callback: TasksRegeneratedCallback): (() => void) => {
  tasksRegeneratedListeners.add(callback);
  return () => {
    tasksRegeneratedListeners.delete(callback);
  };
};

/**
 * Refresh socket connection with new token
 * Call this after token refresh to update the socket auth
 */
export const refreshSocketAuth = async (): Promise<void> => {
  if (socket) {
    disconnectSocket();
  }
  await initializeSocket();
};

// =====================================================
// EDIT REQUESTS ROOM & SUBSCRIPTIONS
// =====================================================

/**
 * Join the edit-requests room for real-time edit request notifications
 * Used by managers to receive notifications when staff submit edit requests
 */
export const joinEditRequestsRoom = async (): Promise<void> => {
  const sock = await initializeSocket();
  sock.emit('join:edit-requests');
  console.log('🔌 WebSocket: Joined edit-requests room');
};

/**
 * Leave the edit-requests room
 */
export const leaveEditRequestsRoom = (): void => {
  if (socket?.connected) {
    socket.emit('leave:edit-requests');
    console.log('🔌 WebSocket: Left edit-requests room');
  }
};

// Session Edit Request Subscriptions
export const onSessionEditRequestSubmitted = (callback: SessionEditRequestSubmittedCallback): (() => void) => {
  sessionEditRequestSubmittedListeners.add(callback);
  return () => {
    sessionEditRequestSubmittedListeners.delete(callback);
  };
};

export const onSessionEditRequestProcessed = (callback: SessionEditRequestProcessedCallback): (() => void) => {
  sessionEditRequestProcessedListeners.add(callback);
  return () => {
    sessionEditRequestProcessedListeners.delete(callback);
  };
};

export const onSessionEditRequestCount = (callback: SessionEditRequestCountCallback): (() => void) => {
  sessionEditRequestCountListeners.add(callback);
  return () => {
    sessionEditRequestCountListeners.delete(callback);
  };
};

// Time Edit Request Subscriptions
export const onTimeEditRequestSubmitted = (callback: TimeEditRequestSubmittedCallback): (() => void) => {
  timeEditRequestSubmittedListeners.add(callback);
  return () => {
    timeEditRequestSubmittedListeners.delete(callback);
  };
};

export const onTimeEditRequestProcessed = (callback: TimeEditRequestProcessedCallback): (() => void) => {
  timeEditRequestProcessedListeners.add(callback);
  return () => {
    timeEditRequestProcessedListeners.delete(callback);
  };
};

export const onTimeEditRequestCount = (callback: TimeEditRequestCountCallback): (() => void) => {
  timeEditRequestCountListeners.add(callback);
  return () => {
    timeEditRequestCountListeners.delete(callback);
  };
};

// =====================================================
// SESSION NOTE SUBSCRIPTIONS
// =====================================================

export const onSessionNoteCreated = (callback: SessionNoteCreatedCallback): (() => void) => {
  sessionNoteCreatedListeners.add(callback);
  return () => {
    sessionNoteCreatedListeners.delete(callback);
  };
};

export const onSessionNoteUpdated = (callback: SessionNoteUpdatedCallback): (() => void) => {
  sessionNoteUpdatedListeners.add(callback);
  return () => {
    sessionNoteUpdatedListeners.delete(callback);
  };
};

export const onSessionNoteDeleted = (callback: SessionNoteDeletedCallback): (() => void) => {
  sessionNoteDeletedListeners.add(callback);
  return () => {
    sessionNoteDeletedListeners.delete(callback);
  };
};
