# 🚀 RBAC Migration Plan for SignHouse

## **Overview**
Migrate from hardcoded role checks to database-driven RBAC system while maintaining zero downtime and backward compatibility.

## **Phase 1: Foundation Setup**
**Timeline: 1-2 days**
**Risk: Low**

### Steps:
1. **Create RBAC Tables**
   ```bash
   mysql sign_manufacturing < /home/jon/Nexus/backend/database/migrations/rbac_schema.sql
   ```

2. **Populate Initial Data**
   ```bash
   mysql sign_manufacturing < /home/jon/Nexus/backend/database/migrations/rbac_seed_data.sql
   ```

3. **Deploy RBAC Middleware**
   - Add `rbac.ts` middleware (already created)
   - Set `rbac_enabled = 'false'` (system continues using legacy role checks)

4. **Validation**
   ```sql
   -- Verify data population
   SELECT COUNT(*) FROM rbac_permissions; -- Should show ~50+ permissions
   SELECT COUNT(*) FROM rbac_role_permissions; -- Should show role mappings
   SELECT * FROM rbac_settings; -- Should show rbac_enabled = false
   ```

**✅ Success Criteria**: Tables created, data populated, system still works with legacy roles

---

## **Phase 2: Hybrid Implementation**
**Timeline: 3-5 days**
**Risk: Medium**

### Steps:
1. **Update Authentication Middleware**
   ```typescript
   // In existing auth middleware, add RBAC context
   req.user = {
     ...existingUserData,
     permissions: await getUserPermissions(user.user_id) // Pre-fetch for performance
   };
   ```

2. **Create Hybrid Route Wrappers**
   ```typescript
   // Example: Gradually replace direct role checks
   // OLD:
   if (user.role !== 'manager' && user.role !== 'owner') { ... }
   
   // NEW: 
   const canDelete = await hybridPermissionCheck(
     user.user_id, 
     user.role, 
     'customer_addresses.delete', 
     ['manager', 'owner']
   );
   if (!canDelete) { ... }
   ```

3. **Test Critical Endpoints**
   - Start with low-risk endpoints (read operations)
   - Gradually move to higher-risk endpoints (delete operations)

4. **Performance Testing**
   - Monitor permission check performance
   - Optimize caching if needed

**✅ Success Criteria**: System works with both legacy and RBAC checks, performance is acceptable

---

## **Phase 3: Gradual Endpoint Migration**
**Timeline: 1-2 weeks**
**Risk: Medium-High**

### Priority Order:
1. **Low Risk: Read Operations**
   - `customers.read`, `customers.list`
   - `time_tracking.read`, `time_tracking.list`
   
2. **Medium Risk: Update Operations**
   - `customers.update`
   - `customer_addresses.update`
   - `time_tracking.update`

3. **High Risk: Delete/Critical Operations**
   - `customer_addresses.delete` (the one you hit today!)
   - `customers.delete`
   - `accounts.manage_users`

### Migration Process Per Endpoint:
```typescript
// 1. Replace hardcoded check with middleware
// OLD:
router.delete('/:id/addresses/:addressId', authenticateToken, async (req, res) => {
  if (user.role !== 'manager' && user.role !== 'owner') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  // ... rest of logic
});

// NEW:
router.delete('/:id/addresses/:addressId', 
  authenticateToken,
  requirePermission('customer_addresses.delete', (req) => `customer_id:${req.params.id}`),
  async (req, res) => {
    // ... rest of logic (no permission check needed)
  }
);
```

### Testing Per Endpoint:
```bash
# Test with each role
curl -H "Authorization: Bearer [owner-token]" DELETE /api/customers/123/addresses/456    # Should work
curl -H "Authorization: Bearer [manager-token]" DELETE /api/customers/123/addresses/456  # Should work  
curl -H "Authorization: Bearer [designer-token]" DELETE /api/customers/123/addresses/456 # Should fail
curl -H "Authorization: Bearer [staff-token]" DELETE /api/customers/123/addresses/456    # Should fail
```

**✅ Success Criteria**: Each endpoint migrated works correctly for all user roles

---

## **Phase 4: Full RBAC Activation**
**Timeline: 1 day**
**Risk: High**

### Steps:
1. **Enable RBAC System**
   ```sql
   UPDATE rbac_settings SET setting_value = 'true' WHERE setting_name = 'rbac_enabled';
   ```

2. **Remove Legacy Hybrid Checks**
   - Replace all `hybridPermissionCheck()` calls with direct `hasPermission()` calls
   - Remove legacy role checking code

3. **Full System Testing**
   - Test all user roles across all endpoints
   - Performance testing under load
   - Permission cache testing

4. **Rollback Plan Ready**
   ```sql
   -- Emergency rollback
   UPDATE rbac_settings SET setting_value = 'false' WHERE setting_name = 'rbac_enabled';
   ```

**✅ Success Criteria**: System fully running on RBAC, all users can perform expected actions

---

## **Phase 5: Enhanced Features**
**Timeline: 1-2 weeks**
**Risk: Low**

### Features to Add:
1. **Admin Interface** (See separate design doc)
   - Role management UI
   - Permission assignment UI
   - User permission overrides
   - Audit log viewer

2. **Advanced Permission Features**
   - Temporary permissions
   - Resource-specific permissions (e.g., access only customer X)
   - Permission delegation
   - Bulk permission operations

3. **Performance Optimizations**
   - Redis caching layer
   - Permission pre-loading
   - Database query optimizations

**✅ Success Criteria**: Full-featured permission management system

---

## **🛡️ Risk Mitigation**

### **Automated Testing**
```typescript
// Create comprehensive permission test suite
describe('RBAC System', () => {
  test('Owner can delete addresses', async () => {
    const result = await hasPermission(ownerUserId, 'customer_addresses.delete');
    expect(result).toBe(true);
  });
  
  test('Designer cannot delete addresses', async () => {
    const result = await hasPermission(designerUserId, 'customer_addresses.delete');
    expect(result).toBe(false);
  });
  
  // ... test all role/permission combinations
});
```

### **Monitoring & Alerts**
```typescript
// Add performance monitoring
const permissionCheckStart = Date.now();
const hasAccess = await hasPermission(userId, permissionName);
const duration = Date.now() - permissionCheckStart;

if (duration > 100) { // Alert if permission check takes >100ms
  console.warn(`Slow permission check: ${permissionName} took ${duration}ms`);
}
```

### **Rollback Strategy**
1. **Database Level**: Keep all legacy role enum in users table
2. **Code Level**: Maintain hybrid functions during transition
3. **Feature Flag**: `rbac_enabled` setting for instant rollback

### **Data Backup**
```bash
# Before each phase, backup the database
mysqldump sign_manufacturing > backup_before_phase_X.sql
```

---

## **📊 Success Metrics**

### **Technical Metrics**
- Permission check performance: < 50ms average
- System uptime: 99.9% during migration
- Zero permission-related security incidents
- Cache hit rate: > 90%

### **Business Metrics**  
- All existing users can perform same actions as before
- New permission granularity enables better security
- Admin overhead reduced (no code changes for permission updates)

---

## **🚨 Emergency Procedures**

### **If Migration Breaks Production**
1. **Immediate Rollback**
   ```sql
   UPDATE rbac_settings SET setting_value = 'false' WHERE setting_name = 'rbac_enabled';
   ```

2. **Database Restore** (if needed)
   ```bash
   mysql sign_manufacturing < backup_before_phase_X.sql
   ```

3. **Code Rollback** (if needed)
   ```bash
   git revert [commit-hash]
   # Redeploy previous version
   ```

### **If Users Can't Access Features**
1. **Quick Permission Grant**
   ```sql
   INSERT INTO rbac_user_permissions (user_id, permission_id, access_type, reason)
   SELECT [user_id], permission_id, 'grant', 'Emergency access'
   FROM rbac_permissions WHERE permission_name = '[needed_permission]';
   ```

2. **Clear Permission Cache**
   ```typescript
   clearAllPermissionCache();
   ```

---

## **🎯 Implementation Checklist**

### **Phase 1 Checklist**
- [ ] Run schema migration
- [ ] Run seed data migration  
- [ ] Deploy RBAC middleware
- [ ] Verify `rbac_enabled = false`
- [ ] Test existing functionality still works

### **Phase 2 Checklist**
- [ ] Add RBAC context to auth middleware
- [ ] Create hybrid permission functions
- [ ] Test hybrid functions with sample endpoints
- [ ] Performance test permission checks
- [ ] Monitor system metrics

### **Phase 3 Checklist**
- [ ] Migrate read endpoints
- [ ] Migrate update endpoints
- [ ] Migrate delete endpoints
- [ ] Migrate admin endpoints
- [ ] Test each endpoint with all roles
- [ ] Performance regression testing

### **Phase 4 Checklist**
- [ ] Enable RBAC system
- [ ] Remove hybrid functions
- [ ] Full system testing
- [ ] Load testing
- [ ] Document new permission system

### **Phase 5 Checklist**
- [ ] Build admin interface
- [ ] Add advanced features
- [ ] Optimize performance
- [ ] Create user documentation
- [ ] Train team on new system

---

**Ready to start Phase 1?** The foundation is solid and the risk is minimal. Let's get the tables created and populated! 🚀