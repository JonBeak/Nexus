/**
 * QuickBooks OAuth State Cleanup Job
 * Scheduled task to clean up expired CSRF protection tokens
 *
 * Schedule: Daily at 2:00 AM
 * Purpose: Remove expired OAuth state tokens from qb_oauth_states table
 */

import cron from 'node-cron';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { logger } from '../utils/logger';

/**
 * Start QuickBooks cleanup job
 * Runs daily at 2:00 AM to clean expired OAuth state tokens
 */
export function startQuickBooksCleanupJob(): void {
  // Schedule: 0 2 * * * = Daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('🧹 Starting QuickBooks OAuth state cleanup...');

      const deletedCount = await quickbooksRepository.cleanupExpiredOAuthStates();

      if (deletedCount > 0) {
        logger.info(`✅ Cleaned up ${deletedCount} expired OAuth state token(s)`, {
          deletedCount,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info('✅ No expired OAuth state tokens found', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('❌ Failed to clean up OAuth state tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  logger.info('📅 QuickBooks cleanup job scheduled (daily at 2:00 AM)');
}
