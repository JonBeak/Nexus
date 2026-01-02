// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed dead default export (export default pool)
// - Added JSDoc documentation for all exported functions
// - Enhanced query() error logging with SQL context and sanitized params
// - Added performance monitoring (slow query detection)
// - Added connection pool health monitoring (getPoolHealth, startPoolHealthMonitoring)
// - Marked pool export as @deprecated to encourage migration to query() helper
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'signmanufacturing',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
  // Note: timezone setting removed - was causing 5-hour offset in time calculations
  // MySQL2 now returns dates in server's local timezone, matching getCurrentEasternTime()
};

/**
 * MySQL connection pool instance
 * @deprecated Direct pool usage is discouraged. Use query() helper instead for consistency.
 * Will be made private once all files migrate to query() helper.
 */
export const pool = mysql.createPool(dbConfig);

// Performance monitoring thresholds
const SLOW_QUERY_THRESHOLD_MS = 1000; // Log queries taking longer than 1 second
const POOL_HEALTH_CHECK_INTERVAL_MS = 60000; // Check pool health every 60 seconds

/**
 * Centralized database query helper function using prepared statements
 *
 * Benefits:
 * - Automatic destructuring of [rows, fields] tuple
 * - Centralized error logging with SQL context
 * - Performance monitoring and slow query detection
 * - Single enhancement point for future features (metrics, retry logic, etc.)
 * - Cleaner syntax at call sites
 *
 * @param sql - SQL query string with ? placeholders
 * @param params - Array of parameter values to bind to placeholders
 * @returns Query result rows
 *
 * @example
 * const users = await query('SELECT * FROM users WHERE id = ?', [userId]) as RowDataPacket[];
 */
export const query = async (sql: string, params: any[] = []): Promise<any> => {
  const startTime = Date.now();

  try {
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;

    // Performance monitoring - log slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn('⚠️  Slow query detected:', {
        duration: `${duration}ms`,
        sql: sql.substring(0, 200),
        threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`
      });
    }

    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error with SQL context (sanitize params to avoid logging sensitive data)
    const sanitizedParams = params.map(param => {
      // Don't log potential passwords, tokens, or sensitive strings
      if (typeof param === 'string' && param.length > 20) {
        return '[REDACTED]';
      }
      return param;
    });

    console.error('❌ Database query error:', {
      error: error instanceof Error ? error.message : error,
      sql: sql.substring(0, 200), // Limit SQL length in logs
      params: sanitizedParams,
      duration: `${duration}ms`
    });
    throw error;
  }
};

/**
 * Query helper for dynamic SQL where prepared statements may not work well
 *
 * Use this when the SQL structure varies dynamically (different number of placeholders
 * based on runtime conditions). Unlike query() which uses pool.execute() with prepared
 * statements, this uses pool.query() which doesn't have prepared statement caching issues.
 *
 * @param sql - SQL query string with ? placeholders
 * @param params - Array of parameter values to bind to placeholders
 * @returns Query result rows
 *
 * @example
 * const orders = await queryDynamic(
 *   `SELECT * FROM orders WHERE status IN (?, ?) LIMIT ?`,
 *   ['pending', 'active', 10]
 * ) as RowDataPacket[];
 */
export const queryDynamic = async (sql: string, params: any[] = []): Promise<any> => {
  const startTime = Date.now();

  try {
    const [rows] = await pool.query(sql, params);
    const duration = Date.now() - startTime;

    // Performance monitoring - log slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn('⚠️  Slow query detected:', {
        duration: `${duration}ms`,
        sql: sql.substring(0, 200),
        threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`
      });
    }

    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error with SQL context (sanitize params to avoid logging sensitive data)
    const sanitizedParams = params.map(param => {
      // Don't log potential passwords, tokens, or sensitive strings
      if (typeof param === 'string' && param.length > 20) {
        return '[REDACTED]';
      }
      return param;
    });

    console.error('❌ Database query error:', {
      error: error instanceof Error ? error.message : error,
      sql: sql.substring(0, 200), // Limit SQL length in logs
      params: sanitizedParams,
      duration: `${duration}ms`
    });
    throw error;
  }
};

/**
 * Test database connection on server startup
 * Used for health checks and startup validation
 *
 * @returns true if connection successful, false otherwise
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

/**
 * Get current connection pool health statistics
 * Useful for monitoring and debugging connection issues
 *
 * @returns Pool health metrics
 */
export const getPoolHealth = () => {
  const poolInstance = pool.pool as any; // Access internal pool object

  return {
    activeConnections: poolInstance._allConnections?.length || 0,
    freeConnections: poolInstance._freeConnections?.length || 0,
    queuedRequests: poolInstance._connectionQueue?.length || 0,
    connectionLimit: dbConfig.connectionLimit,
    timestamp: new Date().toISOString()
  };
};

/**
 * Log connection pool health periodically
 * Helps identify connection pool exhaustion issues
 */
export const startPoolHealthMonitoring = () => {
  setInterval(() => {
    const health = getPoolHealth();

    // Only log if there are active connections or queued requests
    if (health.activeConnections > 0 || health.queuedRequests > 0) {
      console.log('📊 Connection pool health:', health);
    }

    // Warn if pool is getting exhausted
    if (health.queuedRequests > 0) {
      console.warn('⚠️  Connection pool has queued requests:', health);
    }

    // Warn if pool is nearly exhausted
    if (health.freeConnections === 0 && health.activeConnections > 0) {
      console.warn('⚠️  Connection pool exhausted (no free connections):', health);
    }
  }, POOL_HEALTH_CHECK_INTERVAL_MS);
};