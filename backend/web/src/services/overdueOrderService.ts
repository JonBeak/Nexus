/**
 * Overdue Order Service
 * Business Logic Layer for automated overdue order detection
 *
 * Created: 2026-01-22
 *
 * Detects orders past their due dates and marks them as overdue:
 * - Orders with hard_due_date_time: overdue when that specific time passes
 * - Orders with only due_date: overdue at 4pm (end of workday) on the due date
 */

import { overdueOrderRepository, OverdueOrderData } from '../repositories/overdueOrderRepository';
import { broadcastOrderStatus } from '../websocket/taskBroadcast';

// System user ID for automated changes (null = system/automated)
const SYSTEM_USER_ID: number | null = null;

export interface OverdueProcessResult {
  success: boolean;
  processed: number;
  failed: number;
  orders: Array<{
    orderId: number;
    orderNumber: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Process all overdue orders
 *
 * Finds orders past their deadline and marks them as overdue.
 * Creates status history entries and broadcasts WebSocket updates.
 *
 * @returns Results of the processing including success/failure counts
 */
export async function processOverdueOrders(): Promise<OverdueProcessResult> {
  const result: OverdueProcessResult = {
    success: true,
    processed: 0,
    failed: 0,
    orders: []
  };

  try {
    // Find orders that should be marked overdue
    const overdueOrders = await overdueOrderRepository.getOverdueOrders();

    if (overdueOrders.length === 0) {
      return result;
    }

    console.log(`⏰ Found ${overdueOrders.length} order(s) to mark as overdue`);

    // Process each overdue order
    for (const order of overdueOrders) {
      try {
        // Generate appropriate notes based on due date type
        const notes = generateOverdueNotes(order);

        // Mark order as overdue in database
        const { previousStatus } = await overdueOrderRepository.markOrderOverdue(
          order.order_id,
          notes,
          SYSTEM_USER_ID
        );

        // Broadcast WebSocket update for real-time UI sync
        broadcastOrderStatus(
          order.order_id,
          order.order_number,
          'overdue',
          previousStatus,
          0  // Use 0 for broadcast (doesn't hit DB, just needs number type)
        );

        result.processed++;
        result.orders.push({
          orderId: order.order_id,
          orderNumber: order.order_number,
          success: true
        });

        console.log(`  ✅ Order #${order.order_number} marked overdue (was: ${previousStatus})`);
      } catch (error) {
        result.failed++;
        result.orders.push({
          orderId: order.order_id,
          orderNumber: order.order_number,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        console.error(`  ❌ Failed to mark order #${order.order_number} as overdue:`, error);
      }
    }

    // Set overall success to false if any failures
    if (result.failed > 0) {
      result.success = false;
    }

  } catch (error) {
    console.error('❌ Failed to query overdue orders:', error);
    result.success = false;
  }

  return result;
}

/**
 * Generate notes for the status history entry
 *
 * @param order - The overdue order data
 * @returns Descriptive notes explaining why the order is overdue
 */
function generateOverdueNotes(order: OverdueOrderData): string {
  if (order.hard_due_date_time) {
    // Has specific hard due time
    return `Auto-marked overdue: due ${order.due_date} at ${order.hard_due_date_time} has passed`;
  } else {
    // Date-only, marked at 4pm
    return `Auto-marked overdue: due ${order.due_date} (4pm workday end)`;
  }
}
