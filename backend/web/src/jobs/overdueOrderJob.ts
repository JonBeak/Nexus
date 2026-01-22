/**
 * Overdue Order Job
 * Scheduled task to automatically mark orders as overdue
 *
 * Created: 2026-01-22
 *
 * Schedule:
 * - Runs immediately on server startup (catches any missed during downtime)
 * - Then hourly during workday (8am-5pm, Mon-Fri)
 * - Cron pattern: "0 8-17 * * 1-5" (minute hour day month weekday)
 *
 * Logic:
 * - Orders with hard_due_date_time: marked overdue when that time passes
 * - Orders with only due_date: marked overdue at 4pm on the due date
 */

import cron from 'node-cron';
import { processOverdueOrders } from '../services/overdueOrderService';

/**
 * Run the overdue check (shared logic for startup and scheduled runs)
 */
async function runOverdueCheck(source: 'startup' | 'scheduled'): Promise<void> {
  const checkTime = new Date().toISOString();
  console.log(`⏰ Overdue order check starting (${source})... [${checkTime}]`);

  try {
    const result = await processOverdueOrders();

    if (result.processed > 0 || result.failed > 0) {
      console.log(`⏰ Overdue order check complete: ${result.processed} marked overdue, ${result.failed} failed [${checkTime}]`);
    } else if (source === 'startup') {
      console.log(`⏰ Overdue order check complete: no overdue orders found [${checkTime}]`);
    }
    // Don't log "no orders" for scheduled runs - avoid log spam
  } catch (error) {
    console.error('❌ Overdue order job error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * Start the overdue order check job
 * - Runs immediately on startup (after 5 second delay)
 * - Then runs at the top of each hour, 8am-5pm, Monday-Friday
 */
export function startOverdueOrderJob(): void {
  // Run immediately on startup (5 second delay to ensure server is ready)
  setTimeout(() => {
    runOverdueCheck('startup');
  }, 5000);

  // Schedule: top of each hour, hours 8-17, Mon-Fri
  // node-cron format: "minute hour day month weekday"
  cron.schedule('0 8-17 * * 1-5', () => {
    runOverdueCheck('scheduled');
  });

  console.log('⏰ Overdue order job started (runs on startup + hourly 8am-5pm Mon-Fri)');
}
