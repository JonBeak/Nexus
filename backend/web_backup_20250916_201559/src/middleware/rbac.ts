// =====================================================
// RBAC Middleware and Helper Functions
// For Controller-Based Architecture
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

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

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    username: string;
    role: string;
  };
}

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
 * Check multiple permissions at once
 */
export async function hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
  if (permissionNames.length === 0) return false;
  
  for (const permission of permissionNames) {
    if (await hasPermission(userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all specified permissions
 */
export async function hasAllPermissions(userId: number, permissionNames: string[]): Promise<boolean> {
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

/**
 * Clear all permission cache (call when system permissions change)
 */
export function clearAllPermissionCache(): void {
  permissionCache.clear();
}

// =====================================================
// MIDDLEWARE FUNCTIONS
// =====================================================

/**
 * Middleware to require a specific permission
 */
export function requirePermission(permissionName: string, resourceContextFn?: (req: AuthenticatedRequest) => string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

/**
 * Grant temporary permission to user
 */
export async function grantTemporaryPermission(
  userId: number,
  permissionName: string,
  expiresInHours: number,
  grantedBy: number,
  reason: string
): Promise<boolean> {
  try {
    // Get permission ID
    const permissionResult = await query(
      'SELECT permission_id FROM rbac_permissions WHERE permission_name = ? AND is_active = 1',
      [permissionName]
    ) as RowDataPacket[];

    if (permissionResult.length === 0) {
      throw new Error(`Permission '${permissionName}' not found`);
    }

    const permissionId = permissionResult[0].permission_id;
    const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));

    await query(`
      INSERT INTO rbac_user_permissions 
      (user_id, permission_id, access_type, expires_at, granted_by, reason)
      VALUES (?, ?, 'grant', ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        access_type = 'grant',
        expires_at = VALUES(expires_at),
        granted_by = VALUES(granted_by),
        reason = VALUES(reason),
        granted_at = CURRENT_TIMESTAMP
    `, [userId, permissionId, expiresAt, grantedBy, reason]);

    // Clear user's permission cache
    clearUserPermissionCache(userId);
    
    return true;
  } catch (error) {
    console.error('Error granting temporary permission:', error);
    return false;
  }
}

/**
 * Get user's current permissions with metadata
 */
export async function getUserPermissionsWithMetadata(userId: number): Promise<any[]> {
  const permissionsQuery = `
    SELECT 
      p.permission_name,
      p.permission_description,
      r.resource_name,
      a.action_name,
      'role' as source,
      role.role_name as source_detail,
      NULL as expires_at
    FROM rbac_permissions p
    JOIN rbac_resources r ON p.resource_id = r.resource_id
    JOIN rbac_actions a ON p.action_id = a.action_id
    JOIN rbac_role_permissions rp ON p.permission_id = rp.permission_id
    JOIN rbac_roles role ON rp.role_id = role.role_id
    JOIN users u ON u.role = role.role_name
    WHERE u.user_id = ? AND p.is_active = 1 AND role.is_active = 1

    UNION ALL

    SELECT 
      p.permission_name,
      p.permission_description,
      r.resource_name,
      a.action_name,
      up.access_type as source,
      up.reason as source_detail,
      up.expires_at
    FROM rbac_permissions p
    JOIN rbac_resources r ON p.resource_id = r.resource_id
    JOIN rbac_actions a ON p.action_id = a.action_id
    JOIN rbac_user_permissions up ON p.permission_id = up.permission_id
    WHERE up.user_id = ? 
    AND p.is_active = 1 
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
    
    ORDER BY permission_name
  `;

  return await query(permissionsQuery, [userId, userId]) as RowDataPacket[];
}

// =====================================================
// BACKWARDS COMPATIBILITY HELPERS
// =====================================================

/**
 * Helper to check old role-based permissions during migration
 * This allows gradual migration without breaking existing code
 */
export function checkLegacyRolePermission(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Hybrid permission check - uses RBAC if enabled, falls back to role-based
 */
export async function hybridPermissionCheck(
  userId: number,
  userRole: string,
  permissionName: string,
  legacyRoles: string[]
): Promise<boolean> {
  try {
    // Check if RBAC is enabled
    const rbacEnabled = await query(
      "SELECT setting_value FROM rbac_settings WHERE setting_name = 'rbac_enabled'",
      []
    ) as RowDataPacket[];

    if (rbacEnabled.length > 0 && rbacEnabled[0].setting_value === 'true') {
      return await hasPermission(userId, permissionName);
    } else {
      return checkLegacyRolePermission(userRole, legacyRoles);
    }
  } catch (error) {
    console.error('Error in hybrid permission check:', error);
    // Fall back to legacy role check on error
    return checkLegacyRolePermission(userRole, legacyRoles);
  }
}

// =====================================================
// CONTROLLER INTEGRATION EXAMPLES
// =====================================================

/**
 * Example: Using RBAC in Controller (Direct Approach)
 * 
 * // Before (hardcoded role check):
 * export class AddressController {
 *   static async deleteAddress(req: Request, res: Response) {
 *     const user = (req as any).user;
 *     
 *     if (user.role !== 'manager' && user.role !== 'owner') {
 *       return res.status(403).json({ error: 'Unauthorized' });
 *     }
 *     
 *     // ... business logic
 *   }
 * }
 * 
 * // After (RBAC approach):
 * export class AddressController {
 *   static async deleteAddress(req: Request, res: Response) {
 *     const user = (req as any).user;
 *     
 *     const canDelete = await hasPermission(user.user_id, 'customer_addresses.delete');
 *     if (!canDelete) {
 *       return res.status(403).json({ error: 'Insufficient permissions' });
 *     }
 *     
 *     // ... business logic (same as before)
 *   }
 * }
 * 
 * // Alternative: Middleware approach in routes:
 * router.delete('/:id/addresses/:addressId', 
 *   authenticateToken,
 *   requirePermission('customer_addresses.delete'),
 *   AddressController.deleteAddress  // Controller becomes permission-free
 * );
 */