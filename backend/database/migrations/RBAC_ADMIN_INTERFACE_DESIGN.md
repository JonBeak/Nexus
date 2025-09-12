# 🎛️ RBAC Admin Interface Design

## **Overview**
User-friendly admin interface for managing roles, permissions, and user access in the SignHouse system.

---

## **📱 Interface Pages/Components**

### **1. Permissions Dashboard**
**Route**: `/admin/permissions`
**Access**: `system.admin` permission

#### **Features**:
- **Permission Overview Grid**
  ```
  Resource      | Create | Read | Update | Delete | Export | Admin |
  --------------|--------|------|--------|--------|--------|-------|
  Customers     |   ✓    |  ✓   |   ✓    |   ✓    |   ✓    |       |
  Addresses     |   ✓    |  ✓   |   ✓    |   ✓    |        |       |
  Time Tracking |   ✓    |  ✓   |   ✓    |   ✓    |   ✓    |       |
  ```

- **Permission Search & Filter**
  - Search by permission name
  - Filter by resource
  - Filter by action  
  - Filter by active/inactive

- **Permission Actions**
  - Create new permission
  - Edit permission description
  - Activate/deactivate permission
  - View permission usage (which roles/users have it)

#### **UI Components**:
```typescript
interface PermissionGridProps {
  permissions: Permission[];
  onEdit: (permission: Permission) => void;
  onToggleActive: (permissionId: number) => void;
}

interface PermissionModalProps {
  permission?: Permission;
  resources: Resource[];
  actions: Action[];
  onSave: (permission: Permission) => void;
  onClose: () => void;
}
```

---

### **2. Roles Management**  
**Route**: `/admin/roles`
**Access**: `system.admin` permission

#### **Features**:
- **Role List View**
  ```
  Role Name          | Users | Permissions | Color   | Actions
  -------------------|-------|-------------|---------|----------
  Owner              |   2   |     45      | 🔴 Red  | Edit | View
  Manager            |   3   |     38      | 🟡 Yellow| Edit | View  
  Designer           |   4   |     22      | 🔵 Blue | Edit | View
  Production Staff   |   8   |     12      | 🟢 Green| Edit | View
  ```

- **Role Permission Matrix**
  - Visual grid showing role → permission mappings
  - Bulk permission assignment
  - Permission inheritance visualization

- **Role Actions**
  - Create new role
  - Clone existing role
  - Bulk permission assignment
  - Role analytics (usage, access patterns)

#### **Role Editor Component**:
```typescript
interface RoleEditorProps {
  role?: Role;
  permissions: Permission[];
  onSave: (role: Role) => void;
  onCancel: () => void;
}

interface PermissionAssignmentProps {
  roleId: number;
  permissions: Permission[];
  currentPermissions: number[];
  onPermissionToggle: (permissionId: number) => void;
  groupedByResource?: boolean;
}
```

---

### **3. User Permissions**
**Route**: `/admin/users`
**Access**: `accounts.manage_users` permission

#### **Features**:
- **User List with Permission Summary**
  ```
  User              | Role     | Extra Permissions | Denied | Last Active
  ------------------|----------|-------------------|--------|-------------
  Jon (owner)       | Owner    | +2 temp           | 0      | 2 min ago
  Paul (manager)    | Manager  | 0                 | 0      | 1 hour ago
  Sarah (designer)  | Designer | +1 (vinyl.delete) | 0      | 3 hours ago
  ```

- **Individual User Permission Editor**
  - Shows role-based permissions (grayed out)
  - Shows user-specific grants (green highlights)  
  - Shows user-specific denials (red highlights)
  - Temporary permission management

- **Bulk Operations**
  - Grant permission to multiple users
  - Remove permission from multiple users
  - Role changes

#### **User Permission Components**:
```typescript
interface UserPermissionEditorProps {
  user: User;
  rolePermissions: string[];
  userPermissions: UserPermission[];
  onGrantPermission: (permissionId: number, temporary?: boolean) => void;
  onRevokePermission: (permissionId: number) => void;
}

interface TempPermissionModalProps {
  userId: number;
  permissionId: number;
  onGrant: (hours: number, reason: string) => void;
}
```

---

### **4. Audit Log Viewer**
**Route**: `/admin/audit`  
**Access**: `system.admin` permission

#### **Features**:
- **Permission Check Log**
  ```
  Time        | User    | Permission            | Resource  | Result | IP
  ------------|---------|----------------------|-----------|--------|----------
  12:34:56   | Sarah   | customers.delete     | ID: 642   | ✓ GRANT| 192.168.2.14
  12:34:45   | Mike    | customer_addresses.delete | ID: 639 | ✗ DENY | 192.168.2.15
  12:33:22   | Jon     | system.admin         | -         | ✓ GRANT| 192.168.2.10
  ```

- **Advanced Filtering**
  - Filter by user, permission, result
  - Date range selection
  - Export audit logs

- **Permission Change Log**
  - Track who granted/revoked permissions
  - Role membership changes
  - System setting changes

#### **Audit Components**:
```typescript
interface AuditLogViewerProps {
  logs: AuditLog[];
  filters: AuditFilters;
  onFilterChange: (filters: AuditFilters) => void;
  onExport: () => void;
}

interface AuditFilters {
  userId?: number;
  permissionName?: string;
  accessGranted?: boolean;
  dateRange: { from: Date; to: Date };
}
```

---

### **5. System Settings**
**Route**: `/admin/settings`
**Access**: `system.admin` permission

#### **Features**:
- **RBAC Configuration**
  ```
  Setting                    | Value  | Description
  --------------------------|--------|----------------------------------
  RBAC Enabled              | ✅ Yes | Use permission system
  Cache Permissions         | ✅ Yes | Cache for performance  
  Log Permission Checks     | ✅ Yes | Audit trail
  Permission Cache TTL      | 1 hour | How long to cache
  Require Permission Reason | ❌ No  | Require reason for user grants
  ```

- **System Actions**
  - Clear all permission cache
  - Rebuild permission cache
  - Export system configuration
  - Import permission templates

#### **Settings Components**:
```typescript
interface SystemSettingsProps {
  settings: RbacSettings;
  onSettingChange: (name: string, value: string) => void;
  onClearCache: () => void;
  onRebuildCache: () => void;
}
```

---

## **🎨 UI/UX Design Patterns**

### **Visual Hierarchy**
1. **Green Indicators**: Granted permissions, active items
2. **Red Indicators**: Denied permissions, inactive items  
3. **Yellow Indicators**: Temporary permissions, warnings
4. **Gray Indicators**: Inherited permissions (from role)

### **Interactive Elements**
```typescript
// Permission Toggle Component
interface PermissionToggleProps {
  permission: string;
  granted: boolean;
  inherited: boolean;
  temporary?: { expires: Date; reason: string };
  onToggle: (granted: boolean) => void;
  disabled?: boolean;
}

// Role Badge Component  
interface RoleBadgeProps {
  role: Role;
  showPermissionCount?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}
```

### **Data Tables**
- **Sortable columns**
- **Pagination** (25/50/100 items per page)
- **Search within table**
- **Export options** (CSV, JSON)
- **Bulk selection** for multi-operations

---

## **🔌 API Endpoints for Admin Interface**

### **Permissions Management**
```typescript
// GET /api/admin/permissions
interface PermissionsResponse {
  permissions: Permission[];
  resources: Resource[];
  actions: Action[];
}

// POST /api/admin/permissions
interface CreatePermissionRequest {
  resourceId: number;
  actionId: number;
  description?: string;
}

// PUT /api/admin/permissions/:id
interface UpdatePermissionRequest {
  description?: string;
  isActive?: boolean;
}
```

### **Roles Management**
```typescript  
// GET /api/admin/roles
interface RolesResponse {
  roles: (Role & { userCount: number; permissionCount: number })[];
}

// POST /api/admin/roles/:id/permissions
interface AssignPermissionsRequest {
  permissionIds: number[];
  notes?: string;
}

// GET /api/admin/roles/:id/permissions
interface RolePermissionsResponse {
  permissions: Permission[];
  assignments: RolePermissionAssignment[];
}
```

### **User Management**
```typescript
// GET /api/admin/users/:id/permissions
interface UserPermissionsResponse {
  rolePermissions: string[];
  userPermissions: UserPermission[];
  effectivePermissions: string[];
}

// POST /api/admin/users/:id/permissions
interface GrantUserPermissionRequest {
  permissionId: number;
  accessType: 'grant' | 'deny';
  expiresInHours?: number;
  reason: string;
}
```

### **Audit & Reporting**
```typescript
// GET /api/admin/audit/permissions
interface AuditQueryParams {
  userId?: number;
  permissionName?: string;
  accessGranted?: boolean;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

// GET /api/admin/reports/permission-usage
interface PermissionUsageReport {
  permissionName: string;
  grantedToRoles: number;
  grantedToUsers: number;
  totalChecks: number;
  successfulChecks: number;
}
```

---

## **⚡ Performance Considerations**

### **Frontend Optimizations**
```typescript
// Lazy load heavy components
const AuditLogViewer = lazy(() => import('./AuditLogViewer'));
const PermissionMatrix = lazy(() => import('./PermissionMatrix'));

// Virtual scrolling for large lists
import { FixedSizeList as List } from 'react-window';

// Debounced search
const debouncedSearch = useMemo(
  () => debounce((term: string) => setSearchTerm(term), 300),
  []
);
```

### **Backend Optimizations**
```sql
-- Optimized queries with proper indexes
SELECT p.*, r.resource_name, a.action_name,
       COUNT(rp.role_id) as role_count,
       COUNT(up.user_id) as user_count
FROM rbac_permissions p
JOIN rbac_resources r ON p.resource_id = r.resource_id  
JOIN rbac_actions a ON p.action_id = a.action_id
LEFT JOIN rbac_role_permissions rp ON p.permission_id = rp.permission_id
LEFT JOIN rbac_user_permissions up ON p.permission_id = up.permission_id
GROUP BY p.permission_id
ORDER BY p.permission_name;
```

---

## **🔐 Security Considerations**

### **Access Control**
- Admin interface requires `system.admin` permission
- Audit logs are read-only except for owners
- Permission changes logged with who made the change
- Sensitive operations require confirmation

### **Validation**
```typescript
// Input validation on all admin operations
interface PermissionValidator {
  validateRoleCreation(role: CreateRoleRequest): ValidationResult;
  validatePermissionAssignment(assignment: AssignPermissionRequest): ValidationResult;
  validateUserPermissionGrant(grant: GrantPermissionRequest): ValidationResult;
}
```

### **Rate Limiting**
```typescript
// Prevent admin API abuse
app.use('/api/admin', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

---

## **📱 Mobile Responsiveness**

### **Key Considerations**
- **Card-based layout** for mobile screens
- **Simplified permission matrix** (accordion style)
- **Touch-friendly toggles** for permission grants
- **Swipe actions** for common operations
- **Offline capability** for audit log viewing

---

**Ready to build this admin interface?** The foundation is comprehensive and will make permission management a breeze! 🎯