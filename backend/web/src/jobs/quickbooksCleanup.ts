// File Clean up Finished: 2025-11-15
// Analysis: File is clean and well-architected
// - Follows 3-layer pattern (Job → Repository → Database) ✅
// - Uses repository pattern, no direct database queries ✅
// - Proper error handling and logging ✅
// - 45 lines (well under 500 limit) ✅
// - All imports used ✅
// - No migrations needed ✅
//
// Updated: 2025-11-18 - Removed winston logger, standardized on console.log
/**
 * QuickBooks OAuth State Cleanup Job
 * Scheduled task to clean up expired CSRF protection tokens
 *
 * Schedule: Daily at 2:00 AM
 * Purpose: Remove expired OAuth state tokens from qb_oauth_states table
 */

import cron from 'node-cron';
import { quickbooksOAuthRepository } from '../repositories/quickbooksOAuthRepository';

/**
 * Start QuickBooks cleanup job
 * Runs daily at 2:00 AM to clean expired OAuth state tokens
 */
export function startQuickBooksCleanupJob(): void {
  // Schedule: 0 2 * * * = Daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🧹 Starting QuickBooks OAuth state cleanup...');

      const deletedCount = await quickbooksOAuthRepository.cleanupExpiredOAuthStates();

      if (deletedCount > 0) {
        console.log(`✅ Cleaned up ${deletedCount} expired OAuth state token(s) [${new Date().toISOString()}]`);
      } else {
        console.log(`✅ No expired OAuth state tokens found [${new Date().toISOString()}]`);
      }
    } catch (error) {
      console.error('❌ Failed to clean up OAuth state tokens:', error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  });

  console.log('📅 QuickBooks cleanup job scheduled (daily at 2:00 AM)');
}
