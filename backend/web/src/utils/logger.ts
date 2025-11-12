/**
 * Structured Logger Utility
 * Winston-based logging with multiple transports and formats
 *
 * Log Levels:
 * - error: Error messages
 * - warn: Warning messages
 * - info: Informational messages
 * - debug: Debug messages (development only)
 */

import winston from 'winston';
import path from 'path';

// Define log directory
const LOG_DIR = process.env.LOG_DIR || '/tmp';

// Create Winston logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'quickbooks-service' },
  transports: [
    // Error log - only errors
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'quickbooks-error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log - all levels
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'quickbooks-combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// If not production, also log to console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Convenience logging methods
export default {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
};
