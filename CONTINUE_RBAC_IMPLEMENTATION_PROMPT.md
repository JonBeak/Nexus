# 🔐 RBAC Implementation Continuation Prompt

## **Context for New Claude Session**

You are continuing the implementation of a database-driven Role-Based Access Control (RBAC) system for SignHouse, a sign manufacturing business management system. 

### **Current System State**
- **Backend Architecture**: Refactored into layered architecture (Controllers → Services → Database)
- **Authentication**: Working JWT-based auth with user roles (owner, manager, designer, production_staff)
- **Authorization**: Currently uses hardcoded role checks scattered across controller files
- **Database**: MySQL with existing users table containing role enum field

### **RBAC Implementation Progress**

#### **Completed Work:**
✅ **Database Schema Designed**: Complete RBAC schema in `/backend/database/migrations/rbac_schema.sql`
✅ **Seed Data Created**: Permission mappings in `/backend/database/migrations/rbac_seed_data.sql`  
✅ **Middleware Built**: RBAC functions in `/backend/web/src/middleware/rbac.ts`
✅ **Migration Plan**: Detailed 4-phase plan in `/backend/database/migrations/RBAC_MIGRATION_PLAN.md`
✅ **Admin Interface Designed**: UI specs in `/backend/database/migrations/RBAC_ADMIN_INTERFACE_DESIGN.md`

#### **Current Phase**: Phase 1 - Foundation Setup
- ⏸️ **Paused at**: Database backup before creating RBAC tables
- 🎯 **Next Steps**: Create RBAC tables, populate with seed data, verify system still works

### **Key Architecture Understanding**

The system was recently refactored (see `/backend/web/src/routes/customers-refactor-summary.md`):

```
OLD (Single File):           NEW (Layered):
routes/customers.ts (930 lines) → routes/customers.ts (34 lines - routing only)
                               → controllers/customers/*.ts (permission checks here)
                               → services/customers/*.ts (business logic here)  
                               → validation/customers/*.ts (input validation)
```

**Permission Logic Location**: Currently in controller files like:
- `/backend/web/src/controllers/customers/addressController.ts`
- `/backend/web/src/controllers/customers/customerController.ts`
- `/backend/web/src/utils/customers/permissions.ts`

### **Current Permission Problem Example**
```typescript
// In addressController.ts - This is what needs to be replaced
if (user.role !== 'manager' && user.role !== 'owner') {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

### **RBAC Implementation Strategy**

#### **Phase 1: Foundation (Safe)**
1. Create RBAC tables without breaking existing system
2. Populate with current permission logic
3. Set `rbac_enabled = false` (system continues using hardcoded checks)

#### **Phase 2: Hybrid Mode (Transition)**
1. Add hybrid permission functions that can use either RBAC or legacy
2. Test with low-risk endpoints

#### **Phase 3: Gradual Migration (Careful)**
1. Replace hardcoded checks in controllers one by one
2. Use either middleware approach or direct `hasPermission()` calls
3. Start with read operations, end with delete operations

#### **Phase 4: Full RBAC (Complete)**
1. Set `rbac_enabled = true` 
2. Remove all legacy role checking code
3. System fully database-driven

### **Files You Should Examine**

Before implementing, research these files to understand current state:

#### **Current Architecture:**
- `/backend/web/src/routes/customers.ts` - Route definitions (see refactor summary)
- `/backend/web/src/controllers/customers/addressController.ts` - Where address deletion permission is checked
- `/backend/web/src/controllers/customers/customerController.ts` - Customer permission checks
- `/backend/web/src/utils/customers/permissions.ts` - Permission utility functions

#### **RBAC Implementation Files:**
- `/backend/database/migrations/rbac_schema.sql` - Table definitions
- `/backend/database/migrations/rbac_seed_data.sql` - Initial permission data
- `/backend/web/src/middleware/rbac.ts` - RBAC helper functions (already created)
- `/backend/database/migrations/RBAC_MIGRATION_PLAN.md` - Implementation roadmap

#### **Database Structure:**
- `users` table - Current users with role enum field
- Various permission checks throughout `/backend/web/src/controllers/` directory

### **Immediate Task Status**

**What Was Being Done**: Phase 1 database setup
**Paused At**: Creating database backup before running schema migrations
**User Action Needed**: User will run backup command manually due to sudo requirements

**Commands Ready to Execute After Backup**:
```bash
# 1. Create RBAC tables
sudo mysql sign_manufacturing < /home/jon/Nexus/backend/database/migrations/rbac_schema.sql

# 2. Populate with seed data  
sudo mysql sign_manufacturing < /home/jon/Nexus/backend/database/migrations/rbac_seed_data.sql

# 3. Verify RBAC tables created
sudo mysql sign_manufacturing -e "SHOW TABLES;" | grep rbac

# 4. Verify rbac_enabled = false (system continues with legacy checks)
sudo mysql sign_manufacturing -e "SELECT setting_name, setting_value FROM rbac_settings WHERE setting_name = 'rbac_enabled';"
```

### **Success Criteria for Phase 1**
- RBAC tables exist and are populated
- `rbac_enabled = 'false'` (system uses legacy permission checks)
- All existing functionality works unchanged
- Users experience no difference in system behavior
- Rollback plan ready if needed

### **Critical Requirements**
- **Zero Downtime**: System must continue working during all phases
- **Backward Compatibility**: Existing API behavior unchanged until Phase 4
- **Gradual Migration**: No big-bang approach, migrate endpoints one by one
- **Safety First**: Always have rollback plan ready

### **Key Business Context**
- **Users**: 2-3 concurrent users actively using the system
- **Roles**: Owner (admin), Manager (operations), Designer (limited), Production Staff (basic)
- **Critical Operations**: Customer management, address management, time tracking
- **The Problem**: Address deletion currently requires hardcoded role check that excludes 'owner' role

---

## **Instructions for Continuation**

1. **First**: Research current controller structure by reading the files mentioned above
2. **Confirm**: User has completed database backup  
3. **Execute**: Phase 1 setup (create tables, populate data)
4. **Verify**: System still works with legacy permission checks
5. **Proceed**: Only to Phase 2 after Phase 1 is confirmed successful

Remember: This is a production system with active users. Proceed carefully and always verify each step works before moving to the next phase.

---

## **Quick Commands Reference**

```bash
# Check current system status
sudo systemctl status mysql
/home/jon/Nexus/infrastructure/scripts/status-servers.sh

# View controller permission logic
grep -r "role.*===" /home/jon/Nexus/backend/web/src/controllers/
grep -r "role.*!==" /home/jon/Nexus/backend/web/src/controllers/

# Test API endpoints
curl -H "Authorization: Bearer [token]" http://192.168.2.14:3001/api/customers/

# Database access
sudo mysql sign_manufacturing
```

This system will solve the permission scalability problem by moving from 40+ scattered hardcoded checks to a centralized, database-driven permission system. 🎯