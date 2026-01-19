/**
 * Task Broadcast Helper
 *
 * Emits real-time task update events to all clients in the tasks-table room.
 * Used by orderTaskService after successful task updates.
 */

import { getSocketServer } from './socketServer';

// Types for task update broadcasts
export interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
  expected_version?: number;
}

export interface TaskBroadcastPayload {
  type: 'tasks:updated';
  updates: TaskUpdate[];
  statusChanges: Record<number, string>;  // orderId -> newStatus
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
  partId: number | null;  // null for job-level tasks (e.g., QC & Packing)
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
  activeSessionsCount: number;  // Current count of active sessions on this task
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
  activeSessionsCount: number;  // Current count of active sessions on this task
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

// Session Note payloads
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

/**
 * Broadcast task updates to all clients in the tasks-table room
 *
 * @param updates - Array of task updates that were applied
 * @param statusChanges - Map of order status transitions (orderId -> newStatus)
 * @param userId - The user who made the changes (clients can filter their own updates)
 */
export const broadcastTaskUpdate = (
  updates: TaskUpdate[],
  statusChanges: Map<number, string>,
  userId: number
): void => {
  const io = getSocketServer();

  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: TaskBroadcastPayload = {
    type: 'tasks:updated',
    updates,
    statusChanges: Object.fromEntries(statusChanges),
    userId,
    timestamp: Date.now()
  };

  // Emit to all clients in the tasks-table room
  io.to('tasks-table').emit('tasks:updated', payload);

  console.log(`🔌 WebSocket: Broadcasted ${updates.length} task update(s) from user ${userId}`);
};

/**
 * Get the number of clients currently in the tasks-table room
 */
export const getTasksTableClientCount = async (): Promise<number> => {
  const io = getSocketServer();

  if (!io) {
    return 0;
  }

  const sockets = await io.in('tasks-table').fetchSockets();
  return sockets.length;
};

/**
 * Broadcast task notes update
 */
export const broadcastTaskNotes = (
  taskId: number,
  orderId: number,
  notes: string | null,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: TaskNotesPayload = {
    type: 'task:notes',
    taskId,
    orderId,
    notes,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('task:notes', payload);
  console.log(`🔌 WebSocket: Broadcasted task notes update for task ${taskId} from user ${userId}`);
};

/**
 * Broadcast task deletion
 */
export const broadcastTaskDeleted = (
  taskId: number,
  orderId: number,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: TaskDeletedPayload = {
    type: 'task:deleted',
    taskId,
    orderId,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('task:deleted', payload);
  console.log(`🔌 WebSocket: Broadcasted task deletion for task ${taskId} from user ${userId}`);
};

/**
 * Broadcast task creation
 */
export const broadcastTaskCreated = (
  taskId: number,
  orderId: number,
  partId: number | null,  // null for job-level tasks (e.g., QC & Packing)
  taskName: string,
  assignedRole: string | null,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: TaskCreatedPayload = {
    type: 'task:created',
    taskId,
    orderId,
    partId,
    taskName,
    assignedRole,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('task:created', payload);
  console.log(`🔌 WebSocket: Broadcasted task creation for task ${taskId} from user ${userId}`);
};

/**
 * Broadcast session started
 */
export const broadcastSessionStarted = (
  sessionId: number,
  taskId: number,
  orderId: number,
  userId: number,
  staffName: string,
  activeSessionsCount: number,
  orderStatusChange?: { orderId: number; newStatus: string }
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: SessionStartedPayload = {
    type: 'session:started',
    sessionId,
    taskId,
    orderId,
    userId,
    staffName,
    activeSessionsCount,
    orderStatusChange,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('session:started', payload);
  console.log(`🔌 WebSocket: Broadcasted session start for task ${taskId} by user ${userId} (${activeSessionsCount} active)`);
};

/**
 * Broadcast session stopped
 */
export const broadcastSessionStopped = (
  sessionId: number,
  taskId: number,
  orderId: number,
  userId: number,
  durationMinutes: number,
  activeSessionsCount: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: SessionStoppedPayload = {
    type: 'session:stopped',
    sessionId,
    taskId,
    orderId,
    userId,
    durationMinutes,
    activeSessionsCount,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('session:stopped', payload);
  console.log(`🔌 WebSocket: Broadcasted session stop for task ${taskId} by user ${userId} (${durationMinutes} min, ${activeSessionsCount} still active)`);
};

/**
 * Broadcast order status change (for drag-drop and manual status updates)
 */
export const broadcastOrderStatus = (
  orderId: number,
  orderNumber: number,
  newStatus: string,
  previousStatus: string,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: OrderStatusPayload = {
    type: 'order:status',
    orderId,
    orderNumber,
    newStatus,
    previousStatus,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('order:status', payload);
  console.log(`🔌 WebSocket: Broadcasted order status for #${orderNumber} (${previousStatus} → ${newStatus})`);
};

/**
 * Broadcast order created event
 */
export const broadcastOrderCreated = (
  orderId: number,
  orderNumber: number,
  customerId: number,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: OrderCreatedPayload = {
    type: 'order:created',
    orderId,
    orderNumber,
    customerId,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('order:created', payload);
  console.log(`🔌 WebSocket: Broadcasted order created #${orderNumber} by user ${userId}`);
};

/**
 * Broadcast order updated event
 */
export const broadcastOrderUpdated = (
  orderId: number,
  orderNumber: number,
  updatedFields: string[],
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: OrderUpdatedPayload = {
    type: 'order:updated',
    orderId,
    orderNumber,
    updatedFields,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('order:updated', payload);
  console.log(`🔌 WebSocket: Broadcasted order updated #${orderNumber} fields: ${updatedFields.join(', ')}`);
};

/**
 * Broadcast order deleted event
 */
export const broadcastOrderDeleted = (
  orderId: number,
  orderNumber: number,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: OrderDeletedPayload = {
    type: 'order:deleted',
    orderId,
    orderNumber,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('order:deleted', payload);
  console.log(`🔌 WebSocket: Broadcasted order deleted #${orderNumber} by user ${userId}`);
};

/**
 * Broadcast invoice updated event
 */
export const broadcastInvoiceUpdated = (
  orderId: number,
  orderNumber: number,
  action: 'created' | 'linked' | 'unlinked' | 'payment',
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: InvoiceUpdatedPayload = {
    type: 'invoice:updated',
    orderId,
    orderNumber,
    action,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('invoice:updated', payload);
  console.log(`🔌 WebSocket: Broadcasted invoice ${action} for #${orderNumber} by user ${userId}`);
};

/**
 * Broadcast tasks regenerated event
 * Called after generateTasksForOrder completes
 */
export const broadcastTasksRegenerated = (
  orderId: number,
  orderNumber: number,
  tasksCreated: number,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: TasksRegeneratedPayload = {
    type: 'tasks:regenerated',
    orderId,
    orderNumber,
    tasksCreated,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('tasks:regenerated', payload);
  console.log(`🔌 WebSocket: Broadcasted tasks regenerated for #${orderNumber} (${tasksCreated} tasks) by user ${userId}`);
};

// =====================================================
// SESSION NOTE BROADCASTS
// =====================================================

/**
 * Broadcast session note created
 */
export const broadcastSessionNoteCreated = (
  noteId: number,
  sessionId: number,
  taskId: number,
  userId: number,
  userName: string,
  noteText: string
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: SessionNoteCreatedPayload = {
    type: 'session-note:created',
    noteId,
    sessionId,
    taskId,
    userId,
    userName,
    noteText,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('session-note:created', payload);
  console.log(`🔌 WebSocket: Broadcasted session note created for session ${sessionId} by user ${userId}`);
};

/**
 * Broadcast session note updated
 */
export const broadcastSessionNoteUpdated = (
  noteId: number,
  sessionId: number,
  taskId: number,
  userId: number,
  noteText: string
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: SessionNoteUpdatedPayload = {
    type: 'session-note:updated',
    noteId,
    sessionId,
    taskId,
    userId,
    noteText,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('session-note:updated', payload);
  console.log(`🔌 WebSocket: Broadcasted session note updated for note ${noteId} by user ${userId}`);
};

/**
 * Broadcast session note deleted
 */
export const broadcastSessionNoteDeleted = (
  noteId: number,
  sessionId: number,
  taskId: number,
  userId: number
): void => {
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast - server not initialized');
    return;
  }

  const payload: SessionNoteDeletedPayload = {
    type: 'session-note:deleted',
    noteId,
    sessionId,
    taskId,
    userId,
    timestamp: Date.now()
  };

  io.to('tasks-table').emit('session-note:deleted', payload);
  console.log(`🔌 WebSocket: Broadcasted session note deleted for note ${noteId} by user ${userId}`);
};

// =====================================================
// PRICING CACHE INVALIDATION BROADCASTS
// =====================================================

export interface PricingCacheInvalidatedPayload {
  type: 'pricing:cache-invalidated';
  category: string;  // 'power-supplies', 'leds', 'painting-matrix', 'vinyl-matrix', etc.
  userId?: number;
  timestamp: number;
}

/**
 * Invalidate pricing cache and broadcast to all connected clients
 * Called when pricing-related settings change (power supplies, LEDs, matrices, etc.)
 *
 * This function:
 * 1. Clears the backend RateLookupService cache
 * 2. Broadcasts to all frontend clients so they clear their caches
 *
 * @param category - The category of pricing that changed
 * @param userId - The user who made the change (optional)
 */
export const invalidatePricingCache = (
  category: string,
  userId?: number
): void => {
  // Import here to avoid circular dependency
  const { RateLookupService } = require('../services/rateLookupService');

  // Step 1: Clear backend cache
  const rateLookupService = new RateLookupService();
  rateLookupService.clearCache();
  console.log(`💾 Backend: Cleared pricing cache for category: ${category}`);

  // Step 2: Broadcast to all connected frontend clients
  const io = getSocketServer();
  if (!io) {
    console.warn('🔌 WebSocket: Cannot broadcast pricing invalidation - server not initialized');
    return;
  }

  const payload: PricingCacheInvalidatedPayload = {
    type: 'pricing:cache-invalidated',
    category,
    userId,
    timestamp: Date.now()
  };

  // Broadcast to ALL connected clients (not just tasks-table room)
  // Pricing affects any user who might be creating estimates
  io.emit('pricing:cache-invalidated', payload);
  console.log(`🔌 WebSocket: Broadcasted pricing cache invalidation for category: ${category}`);
};
