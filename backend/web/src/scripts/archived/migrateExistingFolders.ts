// File Clean up Finished: 2025-11-21 (Archived migration script - no changes needed)

/**
 * ⚠️ ARCHIVED - MIGRATION COMPLETED ⚠️
 *
 * Completion Date: November 10, 2025
 * Migration Results: Successfully migrated 1,978 existing SMB folders to database
 * Order Range: 100000-101977 (migrated orders)
 *
 * This script was a ONE-TIME migration and should NOT be run again.
 * All existing folders at the time of migration have been imported.
 *
 * Original Purpose:
 * One-Time Migration Script: Existing SMB Folders → Database Orders
 * Scans /mnt/channelletter and /mnt/channelletter/1Finished
 * Creates orders for folders following pattern: "{order_name} ----- {customer_name}"
 *
 * Order Number Range: 100000-199999 (migrated orders)
 * Regular App Orders: 200000+ (unaffected)
 *
 * Usage: npx tsx src/scripts/migrateExistingFolders.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../config/database';
import { SMB_ROOT, FINISHED_FOLDER } from '../config/paths';
const MIGRATION_LOG = '/tmp/order-migration-log.txt';
const UNMATCHED_LOG = '/tmp/order-migration-unmatched.log';

// Starting order number for migrated orders
const MIGRATED_ORDER_START = 100000;

interface MigrationStats {
  totalFolders: number;
  successfullyCreated: number;
  skippedNoCustomer: number;
  skippedInvalid: number;
  errors: number;
}

interface ParsedFolder {
  folderName: string;
  orderName: string;
  customerName: string;
  location: 'active' | 'finished';
}

class FolderMigration {
  private stats: MigrationStats = {
    totalFolders: 0,
    successfullyCreated: 0,
    skippedNoCustomer: 0,
    skippedInvalid: 0,
    errors: 0
  };

  private logStream: fs.WriteStream;
  private unmatchedStream: fs.WriteStream;
  private nextOrderNumber = MIGRATED_ORDER_START;

  constructor() {
    // Initialize log files
    this.logStream = fs.createWriteStream(MIGRATION_LOG, { flags: 'w' });
    this.unmatchedStream = fs.createWriteStream(UNMATCHED_LOG, { flags: 'w' });
  }

  /**
   * Initialize next order number from database
   * Resumes from highest existing migrated order + 1
   */
  async initializeOrderNumber(): Promise<void> {
    try {
      const [rows] = await pool.execute<any[]>(
        `SELECT MAX(order_number) as max_order FROM orders WHERE is_migrated = true`
      );

      if (rows.length > 0 && rows[0].max_order) {
        this.nextOrderNumber = rows[0].max_order + 1;
        this.log(`Resuming from order number: ${this.nextOrderNumber}`);
      } else {
        this.nextOrderNumber = MIGRATED_ORDER_START;
        this.log(`Starting from order number: ${this.nextOrderNumber}`);
      }
    } catch (error) {
      console.error('Error initializing order number:', error);
      this.nextOrderNumber = MIGRATED_ORDER_START;
    }
  }

  /**
   * Log to console and file
   */
  log(message: string): void {
    console.log(message);
    this.logStream.write(message + '\n');
  }

  /**
   * Log unmatched customer
   */
  logUnmatched(folderName: string, customerName: string): void {
    const message = `${folderName} | Customer: ${customerName}`;
    this.unmatchedStream.write(message + '\n');
  }

  /**
   * Parse folder name: "JobName ----- CustomerName"
   * Returns null if format is invalid
   */
  parseFolder(folderName: string, location: 'active' | 'finished'): ParsedFolder | null {
    // Check for ----- separator
    if (!folderName.includes(' ----- ')) {
      return null;
    }

    const parts = folderName.split(' ----- ');
    if (parts.length !== 2) {
      return null;
    }

    const orderName = parts[0].trim();
    const customerName = parts[1].trim();

    if (!orderName || !customerName) {
      return null;
    }

    return {
      folderName,
      orderName,
      customerName,
      location
    };
  }

  /**
   * Find customer by company name (case-insensitive)
   */
  async findCustomer(customerName: string): Promise<number | null> {
    try {
      const [rows] = await pool.execute<any[]>(
        `SELECT customer_id FROM customers WHERE LOWER(company_name) = LOWER(?) LIMIT 1`,
        [customerName]
      );

      if (rows.length === 0) {
        return null;
      }

      return rows[0].customer_id;
    } catch (error) {
      console.error(`Error finding customer "${customerName}":`, error);
      return null;
    }
  }

  /**
   * Create order for folder
   */
  async createOrderForFolder(parsed: ParsedFolder): Promise<boolean> {
    try {
      // Check if folder already exists in database (skip duplicates)
      const [existingRows] = await pool.execute<any[]>(
        `SELECT order_id FROM orders WHERE LOWER(folder_name) = LOWER(?) LIMIT 1`,
        [parsed.folderName]
      );

      if (existingRows.length > 0) {
        // Already migrated, skip silently
        return false;
      }

      // Find customer
      const customerId = await findCustomer(parsed.customerName);

      if (!customerId) {
        this.log(`[SKIP] ${parsed.folderName}`);
        this.log(`  → Customer not found: ${parsed.customerName}`);
        this.logUnmatched(parsed.folderName, parsed.customerName);
        this.stats.skippedNoCustomer++;
        return false;
      }

      // Determine status based on location
      const status = parsed.location === 'active' ? 'in_production' : 'completed';

      // Create order
      const [result] = await pool.execute<any>(
        `INSERT INTO orders (
          order_number,
          version_number,
          order_name,
          customer_id,
          order_date,
          status,
          folder_name,
          folder_exists,
          folder_location,
          is_migrated,
          form_version,
          shipping_required,
          created_by
        ) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.nextOrderNumber,
          1,  // version_number
          parsed.orderName,
          customerId,
          status,
          parsed.folderName,
          true,  // folder_exists
          parsed.location,
          true,  // is_migrated
          1,  // form_version
          false,  // shipping_required
          1  // created_by (system user)
        ]
      );

      const orderId = result.insertId;

      // Create status history entry
      await pool.execute(
        `INSERT INTO order_status_history (order_id, status, changed_by, notes)
         VALUES (?, ?, ?, ?)`,
        [orderId, status, 1, 'Migrated from existing SMB folder']
      );

      this.log(`[SUCCESS] ${parsed.folderName}`);
      this.log(`  → Order #${this.nextOrderNumber}, Customer ID: ${customerId} (${parsed.customerName})`);

      this.nextOrderNumber++;
      this.stats.successfullyCreated++;
      return true;
    } catch (error) {
      this.log(`[ERROR] ${parsed.folderName}`);
      this.log(`  → ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Scan directory and return folder names
   */
  scanDirectory(dirPath: string): string[] {
    try {
      if (!fs.existsSync(dirPath)) {
        console.warn(`Directory does not exist: ${dirPath}`);
        return [];
      }

      const items = fs.readdirSync(dirPath);
      const folders: string[] = [];

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        if (fs.statSync(itemPath).isDirectory()) {
          folders.push(item);
        }
      }

      return folders;
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Run migration
   */
  async run(): Promise<void> {
    this.log('=== Order Folder Migration Started ===');
    this.log(`Date: ${new Date().toISOString()}`);
    this.log('');

    try {
      // Initialize next order number from database
      await this.initializeOrderNumber();
      this.log('');

      // Scan active folders
      this.log('Scanning /mnt/channelletter...');
      const activeFolders = this.scanDirectory(SMB_ROOT);
      this.log(`Found ${activeFolders.length} active folders`);
      this.log('');

      // Scan finished folders
      this.log('Scanning /mnt/channelletter/1Finished...');
      const finishedFolders = this.scanDirectory(path.join(SMB_ROOT, FINISHED_FOLDER));
      this.log(`Found ${finishedFolders.length} finished folders`);
      this.log('');

      this.stats.totalFolders = activeFolders.length + finishedFolders.length;
      this.log(`Processing ${this.stats.totalFolders} total folders...`);
      this.log('');

      // Process active folders
      for (const folderName of activeFolders) {
        const parsed = this.parseFolder(folderName, 'active');

        if (!parsed) {
          this.log(`[SKIP] ${folderName}`);
          this.log(`  → Invalid folder name format (expected: "JobName ----- CustomerName")`);
          this.stats.skippedInvalid++;
          continue;
        }

        await this.createOrderForFolder(parsed);
      }

      // Process finished folders
      for (const folderName of finishedFolders) {
        const parsed = this.parseFolder(folderName, 'finished');

        if (!parsed) {
          this.log(`[SKIP] ${folderName}`);
          this.log(`  → Invalid folder name format (expected: "JobName ----- CustomerName")`);
          this.stats.skippedInvalid++;
          continue;
        }

        await this.createOrderForFolder(parsed);
      }

      // Print summary
      this.log('');
      this.log('=== Migration Summary ===');
      this.log(`Total Folders: ${this.stats.totalFolders}`);
      this.log(`Successfully Created: ${this.stats.successfullyCreated} orders`);
      this.log(`Skipped (Invalid Format): ${this.stats.skippedInvalid} folders`);
      this.log(`Skipped (No Customer Match): ${this.stats.skippedNoCustomer} folders`);
      this.log(`Errors: ${this.stats.errors}`);
      this.log('');

      if (this.stats.skippedNoCustomer > 0) {
        this.log(`Unmatched customers written to: ${UNMATCHED_LOG}`);
        this.log('');
      }

      this.log('=== Migration Completed ===');
      this.log(`Date: ${new Date().toISOString()}`);

    } catch (error) {
      this.log('');
      this.log('=== Migration Failed ===');
      this.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      // Close log streams
      this.logStream.end();
      this.unmatchedStream.end();
    }
  }
}

// Run migration
async function main() {
  console.log('🚀 Starting folder migration...\n');

  const migration = new FolderMigration();

  try {
    await migration.run();
    console.log(`\n✅ Migration completed! Check logs at:`);
    console.log(`   ${MIGRATION_LOG}`);
    console.log(`   ${UNMATCHED_LOG}`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Helper function to find customer (used in migration class)
async function findCustomer(customerName: string): Promise<number | null> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT customer_id FROM customers WHERE LOWER(company_name) = LOWER(?) LIMIT 1`,
      [customerName]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0].customer_id;
  } catch (error) {
    console.error(`Error finding customer "${customerName}":`, error);
    return null;
  }
}

// Execute
main();
