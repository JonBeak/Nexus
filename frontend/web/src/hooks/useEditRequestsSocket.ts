/**
 * useEditRequestsSocket Hook
 *
 * React hook for subscribing to real-time edit request notifications via WebSocket.
 * Used by managers to receive instant updates when staff submit edit requests.
 * Used by staff to receive notifications when their requests are processed.
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  joinEditRequestsRoom,
  leaveEditRequestsRoom,
  onSessionEditRequestSubmitted,
  onSessionEditRequestProcessed,
  onSessionEditRequestCount,
  onTimeEditRequestSubmitted,
  onTimeEditRequestProcessed,
  onTimeEditRequestCount,
  isSocketConnected,
  SessionEditRequestSubmittedPayload,
  SessionEditRequestProcessedPayload,
  SessionEditRequestCountPayload,
  TimeEditRequestSubmittedPayload,
  TimeEditRequestProcessedPayload,
  TimeEditRequestCountPayload
} from '../services/socketClient';

interface UseEditRequestsSocketOptions {
  /**
   * Current user ID - used to filter relevant notifications
   */
  userId?: number;
  /**
   * Whether this user is a manager (joins edit-requests room)
   */
  isManager?: boolean;
  /**
   * Session edit request callbacks
   */
  onSessionRequestSubmitted?: (payload: SessionEditRequestSubmittedPayload) => void;
  onSessionRequestProcessed?: (payload: SessionEditRequestProcessedPayload) => void;
  onSessionRequestCount?: (payload: SessionEditRequestCountPayload) => void;
  /**
   * Time edit request callbacks
   */
  onTimeRequestSubmitted?: (payload: TimeEditRequestSubmittedPayload) => void;
  onTimeRequestProcessed?: (payload: TimeEditRequestProcessedPayload) => void;
  onTimeRequestCount?: (payload: TimeEditRequestCountPayload) => void;
  /**
   * Callback when socket reconnects
   */
  onReconnect?: () => void;
  /**
   * Whether the hook is enabled (default: true)
   */
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time edit request notifications
 *
 * @example
 * ```tsx
 * // For managers - receive all edit request notifications
 * useEditRequestsSocket({
 *   isManager: true,
 *   onSessionRequestSubmitted: () => refetchSessionRequests(),
 *   onSessionRequestCount: (payload) => setSessionCount(payload.count),
 *   onTimeRequestSubmitted: () => refetchTimeRequests(),
 *   onTimeRequestCount: (payload) => setTimeCount(payload.count),
 * });
 *
 * // For staff - receive notifications when their requests are processed
 * useEditRequestsSocket({
 *   userId: currentUser?.user_id,
 *   onSessionRequestProcessed: (payload) => {
 *     if (payload.userId === currentUser?.user_id) {
 *       showToast(`Your session edit request was ${payload.action}`);
 *     }
 *   },
 * });
 * ```
 */
export const useEditRequestsSocket = ({
  userId,
  isManager = false,
  onSessionRequestSubmitted,
  onSessionRequestProcessed,
  onSessionRequestCount,
  onTimeRequestSubmitted,
  onTimeRequestProcessed,
  onTimeRequestCount,
  onReconnect,
  enabled = true
}: UseEditRequestsSocketOptions = {}) => {
  const isJoinedRef = useRef(false);
  const wasConnectedRef = useRef(false);

  // Session request handlers
  const handleSessionRequestSubmitted = useCallback((payload: SessionEditRequestSubmittedPayload) => {
    onSessionRequestSubmitted?.(payload);
  }, [onSessionRequestSubmitted]);

  const handleSessionRequestProcessed = useCallback((payload: SessionEditRequestProcessedPayload) => {
    // Staff only care about their own requests being processed
    if (!isManager && userId && payload.userId !== userId) {
      return;
    }
    onSessionRequestProcessed?.(payload);
  }, [isManager, userId, onSessionRequestProcessed]);

  const handleSessionRequestCount = useCallback((payload: SessionEditRequestCountPayload) => {
    onSessionRequestCount?.(payload);
  }, [onSessionRequestCount]);

  // Time request handlers
  const handleTimeRequestSubmitted = useCallback((payload: TimeEditRequestSubmittedPayload) => {
    onTimeRequestSubmitted?.(payload);
  }, [onTimeRequestSubmitted]);

  const handleTimeRequestProcessed = useCallback((payload: TimeEditRequestProcessedPayload) => {
    // Staff only care about their own requests being processed
    if (!isManager && userId && payload.userId !== userId) {
      return;
    }
    onTimeRequestProcessed?.(payload);
  }, [isManager, userId, onTimeRequestProcessed]);

  const handleTimeRequestCount = useCallback((payload: TimeEditRequestCountPayload) => {
    onTimeRequestCount?.(payload);
  }, [onTimeRequestCount]);

  // Setup subscriptions
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscribers: (() => void)[] = [];

    const setup = async () => {
      try {
        // Subscribe to events
        unsubscribers.push(onSessionEditRequestSubmitted(handleSessionRequestSubmitted));
        unsubscribers.push(onSessionEditRequestProcessed(handleSessionRequestProcessed));
        unsubscribers.push(onSessionEditRequestCount(handleSessionRequestCount));
        unsubscribers.push(onTimeEditRequestSubmitted(handleTimeRequestSubmitted));
        unsubscribers.push(onTimeEditRequestProcessed(handleTimeRequestProcessed));
        unsubscribers.push(onTimeEditRequestCount(handleTimeRequestCount));

        // Managers join the edit-requests room to receive all notifications
        if (isManager) {
          await joinEditRequestsRoom();
          isJoinedRef.current = true;
        }

        // Check if this was a reconnection
        if (wasConnectedRef.current) {
          console.log('🔌 WebSocket: Edit requests - Reconnected - triggering refetch');
          onReconnect?.();
        }
        wasConnectedRef.current = true;
      } catch (error) {
        console.error('🔌 WebSocket: Failed to setup edit requests socket:', error);
      }
    };

    setup();

    // Cleanup on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
      if (isJoinedRef.current && isManager) {
        leaveEditRequestsRoom();
        isJoinedRef.current = false;
      }
    };
  }, [
    enabled,
    isManager,
    handleSessionRequestSubmitted,
    handleSessionRequestProcessed,
    handleSessionRequestCount,
    handleTimeRequestSubmitted,
    handleTimeRequestProcessed,
    handleTimeRequestCount,
    onReconnect
  ]);

  return {
    isConnected: isSocketConnected()
  };
};

export default useEditRequestsSocket;
