// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed duplicate interface (now using AuthRequest from ../types)
//   - Removed unused exports: grantTemporaryPermission, getUserPermissionsWithMetadata,
//     clearAllPermissionCache, hybridPermissionCheck
//   - Made hasAnyPermission and hasAllPermissions internal (removed export)
//   - Removed 40 lines of documentation examples
//   - Result: 430 lines → 262 lines (39% reduction)
//   - Kept: Permission logging infrastructure, clearUserPermissionCache for cache invalidation
// =====================================================
// RBAC Middleware and Helper Functions
// For Controller-Based Architecture
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../types';

/**
 * ARCHITECTURE NOTE:
 * The system uses a layered architecture:
 * Routes (routing) → Controllers (permissions + HTTP) → Services (business logic)
 *
 * RBAC can be implemented in two ways:
 * 1. Middleware approach: Add requirePermission() to route definitions
 * 2. Controller approach: Use hasPermission() directly in controller methods
 *
 * Both approaches are provided below.
 */

// Cache for user permissions (in production, use Redis)
const permissionCache = new Map<string, { permissions: Set<string>, expires: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// =====================================================
// CORE PERMISSION FUNCTIONS
// =====================================================

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: number, permissionName: string, resourceContext?: string): Promise<boolean> {
  try {
    // Check cache first
    const cacheKey = `user_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      const hasAccess = cached.permissions.has(permissionName);
      await logPermissionCheck(userId, permissionName, resourceContext, hasAccess);
      return hasAccess;
    }

    // Fetch permissions from database
    const permissions = await getUserPermissions(userId);

    // Cache the results
    permissionCache.set(cacheKey, {
      permissions: new Set(permissions),
      expires: Date.now() + CACHE_TTL
    });

    const hasAccess = permissions.includes(permissionName);
    await logPermissionCheck(userId, permissionName, resourceContext, hasAccess);

    return hasAccess;
  } catch (error) {
    console.error('Error checking permission:', error);
    await logPermissionCheck(userId, permissionName, resourceContext, false, `Error: ${error}`);
    return false;
  }
}

/**
 * Get all permissions for a user (role-based + user-specific overrides)
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  const permissionsQuery = `
    SELECT DISTINCT p.permission_name
    FROM rbac_permissions p
    WHERE p.is_active = 1 AND (
      -- Role-based permissions
      p.permission_id IN (
        SELECT rp.permission_id 
        FROM rbac_role_permissions rp
        JOIN rbac_roles r ON rp.role_id = r.role_id
        JOIN users u ON u.role = r.role_name
        WHERE u.user_id = ? AND r.is_active = 1
      )
      -- User-specific granted permissions (not expired)
      OR p.permission_id IN (
        SELECT up.permission_id
        FROM rbac_user_permissions up 
        WHERE up.user_id = ? 
        AND up.access_type = 'grant'
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
      )
    )
    -- Exclude user-specific denied permissions
    AND p.permission_id NOT IN (
      SELECT up.permission_id
      FROM rbac_user_permissions up 
      WHERE up.user_id = ? 
      AND up.access_type = 'deny'
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
    )
    ORDER BY p.permission_name
  `;

  const results = await query(permissionsQuery, [userId, userId, userId]) as RowDataPacket[];
  return results.map(row => row.permission_name);
}

/**
 * Check multiple permissions at once (internal helper for middleware)
 */
async function hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
  if (permissionNames.length === 0) return false;

  for (const permission of permissionNames) {
    if (await hasPermission(userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all specified permissions (internal helper for middleware)
 */
async function hasAllPermissions(userId: number, permissionNames: string[]): Promise<boolean> {
  if (permissionNames.length === 0) return true;

  for (const permission of permissionNames) {
    if (!await hasPermission(userId, permission)) {
      return false;
    }
  }
  return true;
}

/**
 * Clear permission cache for a user (call when roles/permissions change)
 */
export function clearUserPermissionCache(userId: number): void {
  const cacheKey = `user_${userId}`;
  permissionCache.delete(cacheKey);
}

// =====================================================
// MIDDLEWARE FUNCTIONS
// =====================================================

/**
 * Middleware to require a specific permission
 */
export function requirePermission(permissionName: string, resourceContextFn?: (req: AuthRequest) => string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user || !user.user_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const resourceContext = resourceContextFn ? resourceContextFn(req) : undefined;
    const hasAccess = await hasPermission(user.user_id, permissionName, resourceContext);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_permission: permissionName,
        resource_context: resourceContext
      });
    }

    next();
  };
}

/**
 * Middleware to require any of the specified permissions
 */
export function requireAnyPermission(permissionNames: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user || !user.user_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await hasAnyPermission(user.user_id, permissionNames);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_permissions: `Any of: ${permissionNames.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Middleware to require all specified permissions
 */
export function requireAllPermissions(permissionNames: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user || !user.user_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await hasAllPermissions(user.user_id, permissionNames);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_permissions: `All of: ${permissionNames.join(', ')}`
      });
    }

    next();
  };
}

// =====================================================
// UTILITY FUNCTIONS  
// =====================================================

/**
 * Log permission checks for audit trail
 */
async function logPermissionCheck(
  userId: number, 
  permissionName: string, 
  resourceContext?: string, 
  accessGranted: boolean = false,
  errorMessage?: string
): Promise<void> {
  try {
    // Only log if setting is enabled
    const logSetting = await query(
      "SELECT setting_value FROM rbac_settings WHERE setting_name = 'log_permission_checks'",
      []
    ) as RowDataPacket[];
    
    if (logSetting.length === 0 || logSetting[0].setting_value !== 'true') {
      return;
    }

    await query(`
      INSERT INTO rbac_permission_log 
      (user_id, permission_name, resource_context, access_granted, ip_address, user_agent) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userId,
      permissionName,
      resourceContext || null,
      accessGranted,
      null, // IP address - would need to be passed from request
      null  // User agent - would need to be passed from request
    ]);
  } catch (error) {
    console.error('Error logging permission check:', error);
  }
}

