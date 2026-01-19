/**
 * One-Time Migration Script: Move Cancelled/On-Hold Orders to Folders
 *
 * Scans database for orders with status 'cancelled' or 'on_hold'
 * that have folders in /mnt/channelletter/Orders/ (is_migrated=false)
 * and moves them to 1Cancelled or 1Hold respectively.
 *
 * Usage: npx tsx src/scripts/migrateCancelledHoldOrders.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be moved without actually moving
 */

import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../config/database';
import { SMB_ROOT, ORDERS_FOLDER, CANCELLED_FOLDER, HOLD_FOLDER } from '../config/paths';
import { RowDataPacket } from 'mysql2';

const NEW_ACTIVE_PATH = path.join(SMB_ROOT, ORDERS_FOLDER);
const NEW_CANCELLED_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, CANCELLED_FOLDER);
const NEW_HOLD_PATH = path.join(SMB_ROOT, ORDERS_FOLDER, HOLD_FOLDER);

interface OrderRow extends RowDataPacket {
  order_id: number;
  order_number: number;
  folder_name: string;
  status: string;
  folder_location: string;
}

async function migrate(dryRun: boolean = false) {
  console.log('='.repeat(60));
  console.log('Cancelled/On-Hold Folder Migration Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  // Ensure destination folders exist
  if (!dryRun) {
    if (!fs.existsSync(NEW_CANCELLED_PATH)) {
      fs.mkdirSync(NEW_CANCELLED_PATH, { recursive: true });
      console.log(`✅ Created folder: ${NEW_CANCELLED_PATH}`);
    }
    if (!fs.existsSync(NEW_HOLD_PATH)) {
      fs.mkdirSync(NEW_HOLD_PATH, { recursive: true });
      console.log(`✅ Created folder: ${NEW_HOLD_PATH}`);
    }
  } else {
    console.log(`Would create: ${NEW_CANCELLED_PATH}`);
    console.log(`Would create: ${NEW_HOLD_PATH}`);
  }
  console.log('');

  // Find orders to migrate
  const [rows] = await pool.execute<OrderRow[]>(`
    SELECT order_id, order_number, folder_name, status, folder_location
    FROM orders
    WHERE status IN ('cancelled', 'on_hold')
      AND folder_exists = 1
      AND folder_location = 'active'
      AND (is_migrated = 0 OR is_migrated IS NULL)
      AND folder_name IS NOT NULL
    ORDER BY order_number
  `);

  console.log(`Found ${rows.length} orders to migrate`);
  console.log('');

  if (rows.length === 0) {
    console.log('No orders need migration.');
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  const cancelledOrders: number[] = [];
  const holdOrders: number[] = [];

  for (const order of rows) {
    const sourcePath = path.join(NEW_ACTIVE_PATH, order.folder_name);
    const destFolder = order.status === 'cancelled' ? NEW_CANCELLED_PATH : NEW_HOLD_PATH;
    const destPath = path.join(destFolder, order.folder_name);
    const newLocation = order.status === 'cancelled' ? 'cancelled' : 'hold';
    const destName = order.status === 'cancelled' ? '1Cancelled' : '1Hold';

    console.log(`Order #${order.order_number}: ${order.status}`);
    console.log(`  Folder: ${order.folder_name}`);

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.log(`  [SKIP] Source folder not found at: ${sourcePath}`);
      skipped++;
      continue;
    }

    // Check if destination already exists
    if (fs.existsSync(destPath)) {
      console.log(`  [SKIP] Destination already exists in ${destName}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would move to ${destName}`);
      if (order.status === 'cancelled') {
        cancelledOrders.push(order.order_number);
      } else {
        holdOrders.push(order.order_number);
      }
      success++;
      continue;
    }

    try {
      // Move folder
      fs.renameSync(sourcePath, destPath);

      // Update database
      await pool.execute(
        `UPDATE orders SET folder_location = ? WHERE order_id = ?`,
        [newLocation, order.order_id]
      );

      console.log(`  ✅ Moved to ${destName}`);

      if (order.status === 'cancelled') {
        cancelledOrders.push(order.order_number);
      } else {
        holdOrders.push(order.order_number);
      }
      success++;
    } catch (error) {
      console.error(`  ❌ ERROR:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total orders processed: ${rows.length}`);
  console.log(`${dryRun ? 'Would move' : 'Moved'}: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (cancelledOrders.length > 0) {
    console.log(`Cancelled orders (${cancelledOrders.length}): ${cancelledOrders.join(', ')}`);
  }
  if (holdOrders.length > 0) {
    console.log(`On-hold orders (${holdOrders.length}): ${holdOrders.join(', ')}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

migrate(dryRun)
  .then(() => {
    console.log('');
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
