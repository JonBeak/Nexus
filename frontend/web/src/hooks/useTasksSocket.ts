/**
 * useTasksSocket Hook
 *
 * React hook for subscribing to real-time task updates via WebSocket.
 * Handles connection lifecycle, room management, and event subscriptions.
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  joinTasksTableRoom,
  leaveTasksTableRoom,
  onTasksUpdated,
  onTaskNotes,
  onTaskDeleted,
  onTaskCreated,
  onSessionStarted,
  onSessionStopped,
  onOrderStatus,
  onOrderCreated,
  onOrderUpdated,
  onOrderDeleted,
  onInvoiceUpdated,
  onTasksRegenerated,
  onSessionNoteCreated,
  onSessionNoteUpdated,
  onSessionNoteDeleted,
  isSocketConnected,
  TaskBroadcastPayload,
  TaskNotesPayload,
  TaskDeletedPayload,
  TaskCreatedPayload,
  SessionStartedPayload,
  SessionStoppedPayload,
  OrderStatusPayload,
  OrderCreatedPayload,
  OrderUpdatedPayload,
  OrderDeletedPayload,
  InvoiceUpdatedPayload,
  TasksRegeneratedPayload,
  SessionNoteCreatedPayload,
  SessionNoteUpdatedPayload,
  SessionNoteDeletedPayload
} from '../services/socketClient';

interface UseTasksSocketOptions {
  /**
   * Current user ID - used to filter out own updates
   */
  userId?: number;
  /**
   * Callback when batch task updates are received from OTHER users
   */
  onTasksUpdated?: (payload: TaskBroadcastPayload) => void;
  /**
   * Callback when task notes are updated
   */
  onTaskNotes?: (payload: TaskNotesPayload) => void;
  /**
   * Callback when a task is deleted
   */
  onTaskDeleted?: (payload: TaskDeletedPayload) => void;
  /**
   * Callback when a task is created
   */
  onTaskCreated?: (payload: TaskCreatedPayload) => void;
  /**
   * Callback when a session starts
   */
  onSessionStarted?: (payload: SessionStartedPayload) => void;
  /**
   * Callback when a session stops
   */
  onSessionStopped?: (payload: SessionStoppedPayload) => void;
  /**
   * Callback when an order status changes (drag-drop, manual update)
   */
  onOrderStatus?: (payload: OrderStatusPayload) => void;
  /**
   * Callback when an order is created (estimate conversion)
   */
  onOrderCreated?: (payload: OrderCreatedPayload) => void;
  /**
   * Callback when an order is updated (fields changed)
   */
  onOrderUpdated?: (payload: OrderUpdatedPayload) => void;
  /**
   * Callback when an order is deleted
   */
  onOrderDeleted?: (payload: OrderDeletedPayload) => void;
  /**
   * Callback when an invoice is updated (created, linked, unlinked, payment)
   */
  onInvoiceUpdated?: (payload: InvoiceUpdatedPayload) => void;
  /**
   * Callback when tasks are regenerated for an order
   */
  onTasksRegenerated?: (payload: TasksRegeneratedPayload) => void;
  /**
   * Callback when a session note is created
   */
  onSessionNoteCreated?: (payload: SessionNoteCreatedPayload) => void;
  /**
   * Callback when a session note is updated
   */
  onSessionNoteUpdated?: (payload: SessionNoteUpdatedPayload) => void;
  /**
   * Callback when a session note is deleted
   */
  onSessionNoteDeleted?: (payload: SessionNoteDeletedPayload) => void;
  /**
   * Callback when socket connects/reconnects
   * Useful for triggering a refetch after reconnection
   */
  onReconnect?: () => void;
  /**
   * Whether the hook is enabled (default: true)
   * Set to false to disable WebSocket connection
   */
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time task updates
 *
 * @example
 * ```tsx
 * useTasksSocket({
 *   userId: currentUser?.user_id,
 *   onTasksUpdated: (payload) => refetch(),
 *   onTaskNotes: (payload) => refetch(),
 *   onTaskDeleted: (payload) => refetch(),
 *   onTaskCreated: (payload) => refetch(),
 *   onSessionStarted: (payload) => refetch(),
 *   onSessionStopped: (payload) => refetch(),
 *   onOrderStatus: (payload) => refetch(),
 *   onReconnect: () => refetch()
 * });
 * ```
 */
export const useTasksSocket = ({
  userId,
  onTasksUpdated: onTasksUpdatedCallback,
  onTaskNotes: onTaskNotesCallback,
  onTaskDeleted: onTaskDeletedCallback,
  onTaskCreated: onTaskCreatedCallback,
  onSessionStarted: onSessionStartedCallback,
  onSessionStopped: onSessionStoppedCallback,
  onOrderStatus: onOrderStatusCallback,
  onOrderCreated: onOrderCreatedCallback,
  onOrderUpdated: onOrderUpdatedCallback,
  onOrderDeleted: onOrderDeletedCallback,
  onInvoiceUpdated: onInvoiceUpdatedCallback,
  onTasksRegenerated: onTasksRegeneratedCallback,
  onSessionNoteCreated: onSessionNoteCreatedCallback,
  onSessionNoteUpdated: onSessionNoteUpdatedCallback,
  onSessionNoteDeleted: onSessionNoteDeletedCallback,
  onReconnect,
  enabled = true
}: UseTasksSocketOptions = {}) => {
  const isJoinedRef = useRef(false);
  const wasConnectedRef = useRef(false);

  // Handle incoming batch task updates
  const handleTasksUpdated = useCallback((payload: TaskBroadcastPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own batch update');
      return;
    }
    onTasksUpdatedCallback?.(payload);
  }, [userId, onTasksUpdatedCallback]);

  // Handle task notes updates
  const handleTaskNotes = useCallback((payload: TaskNotesPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own notes update');
      return;
    }
    onTaskNotesCallback?.(payload);
  }, [userId, onTaskNotesCallback]);

  // Handle task deleted
  const handleTaskDeleted = useCallback((payload: TaskDeletedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own task deletion');
      return;
    }
    onTaskDeletedCallback?.(payload);
  }, [userId, onTaskDeletedCallback]);

  // Handle task created
  const handleTaskCreated = useCallback((payload: TaskCreatedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own task creation');
      return;
    }
    onTaskCreatedCallback?.(payload);
  }, [userId, onTaskCreatedCallback]);

  // Handle session started
  const handleSessionStarted = useCallback((payload: SessionStartedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own session start');
      return;
    }
    onSessionStartedCallback?.(payload);
  }, [userId, onSessionStartedCallback]);

  // Handle session stopped
  const handleSessionStopped = useCallback((payload: SessionStoppedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own session stop');
      return;
    }
    onSessionStoppedCallback?.(payload);
  }, [userId, onSessionStoppedCallback]);

  // Handle order status change
  const handleOrderStatus = useCallback((payload: OrderStatusPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own order status change');
      return;
    }
    onOrderStatusCallback?.(payload);
  }, [userId, onOrderStatusCallback]);

  // Handle order created
  const handleOrderCreated = useCallback((payload: OrderCreatedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own order creation');
      return;
    }
    onOrderCreatedCallback?.(payload);
  }, [userId, onOrderCreatedCallback]);

  // Handle order updated
  const handleOrderUpdated = useCallback((payload: OrderUpdatedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own order update');
      return;
    }
    onOrderUpdatedCallback?.(payload);
  }, [userId, onOrderUpdatedCallback]);

  // Handle order deleted
  const handleOrderDeleted = useCallback((payload: OrderDeletedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own order deletion');
      return;
    }
    onOrderDeletedCallback?.(payload);
  }, [userId, onOrderDeletedCallback]);

  // Handle invoice updated
  const handleInvoiceUpdated = useCallback((payload: InvoiceUpdatedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own invoice update');
      return;
    }
    onInvoiceUpdatedCallback?.(payload);
  }, [userId, onInvoiceUpdatedCallback]);

  // Handle tasks regenerated
  const handleTasksRegenerated = useCallback((payload: TasksRegeneratedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own tasks regeneration');
      return;
    }
    onTasksRegeneratedCallback?.(payload);
  }, [userId, onTasksRegeneratedCallback]);

  // Handle session note created
  const handleSessionNoteCreated = useCallback((payload: SessionNoteCreatedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own session note creation');
      return;
    }
    onSessionNoteCreatedCallback?.(payload);
  }, [userId, onSessionNoteCreatedCallback]);

  // Handle session note updated
  const handleSessionNoteUpdated = useCallback((payload: SessionNoteUpdatedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own session note update');
      return;
    }
    onSessionNoteUpdatedCallback?.(payload);
  }, [userId, onSessionNoteUpdatedCallback]);

  // Handle session note deleted
  const handleSessionNoteDeleted = useCallback((payload: SessionNoteDeletedPayload) => {
    if (userId && payload.userId === userId) {
      console.log('🔌 WebSocket: Ignoring own session note deletion');
      return;
    }
    onSessionNoteDeletedCallback?.(payload);
  }, [userId, onSessionNoteDeletedCallback]);

  // Join room and subscribe to updates
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscribers: (() => void)[] = [];

    const setup = async () => {
      try {
        // Subscribe to all event types
        unsubscribers.push(onTasksUpdated(handleTasksUpdated));
        unsubscribers.push(onTaskNotes(handleTaskNotes));
        unsubscribers.push(onTaskDeleted(handleTaskDeleted));
        unsubscribers.push(onTaskCreated(handleTaskCreated));
        unsubscribers.push(onSessionStarted(handleSessionStarted));
        unsubscribers.push(onSessionStopped(handleSessionStopped));
        unsubscribers.push(onOrderStatus(handleOrderStatus));
        unsubscribers.push(onOrderCreated(handleOrderCreated));
        unsubscribers.push(onOrderUpdated(handleOrderUpdated));
        unsubscribers.push(onOrderDeleted(handleOrderDeleted));
        unsubscribers.push(onInvoiceUpdated(handleInvoiceUpdated));
        unsubscribers.push(onTasksRegenerated(handleTasksRegenerated));
        unsubscribers.push(onSessionNoteCreated(handleSessionNoteCreated));
        unsubscribers.push(onSessionNoteUpdated(handleSessionNoteUpdated));
        unsubscribers.push(onSessionNoteDeleted(handleSessionNoteDeleted));

        // Then join the room
        await joinTasksTableRoom();
        isJoinedRef.current = true;

        // Check if this was a reconnection
        if (wasConnectedRef.current) {
          console.log('🔌 WebSocket: Reconnected - triggering refetch');
          onReconnect?.();
        }
        wasConnectedRef.current = true;
      } catch (error) {
        console.error('🔌 WebSocket: Failed to join tasks-table room:', error);
      }
    };

    setup();

    // Cleanup on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
      if (isJoinedRef.current) {
        leaveTasksTableRoom();
        isJoinedRef.current = false;
      }
    };
  }, [
    enabled,
    handleTasksUpdated,
    handleTaskNotes,
    handleTaskDeleted,
    handleTaskCreated,
    handleSessionStarted,
    handleSessionStopped,
    handleOrderStatus,
    handleOrderCreated,
    handleOrderUpdated,
    handleOrderDeleted,
    handleInvoiceUpdated,
    handleTasksRegenerated,
    handleSessionNoteCreated,
    handleSessionNoteUpdated,
    handleSessionNoteDeleted,
    onReconnect
  ]);

  return {
    isConnected: isSocketConnected()
  };
};

export default useTasksSocket;
