import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import { TimeTrackingPermissions } from '../utils/timeTracking/permissions';

const router = Router();

// Get time entries with filters
router.get('/entries', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check view permission using hybrid RBAC/legacy system
    const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
    if (!canView) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { startDate, endDate, status, users, group, search, quickFilter } = req.query;
    
    // Build base query
    let sql = `
      SELECT 
        te.entry_id,
        te.user_id,
        u.first_name,
        u.last_name,
        te.clock_in,
        te.clock_out,
        te.break_minutes,
        te.total_hours,
        te.status,
        CASE 
          WHEN ter.entry_id IS NOT NULL THEN 1 
          ELSE 0 
        END as is_edited
      FROM time_entries te
      JOIN users u ON te.user_id = u.user_id
      LEFT JOIN (
        SELECT DISTINCT entry_id 
        FROM time_edit_requests 
        WHERE status IN ('approved', 'modified')
      ) ter ON te.entry_id = ter.entry_id
      WHERE te.is_deleted = 0
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Date range filter
    if (startDate) {
      conditions.push('DATE(te.clock_in) >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push('DATE(te.clock_in) <= ?');
      params.push(endDate);
    }
    
    // Status filter
    if (status && status !== 'all') {
      conditions.push('te.status = ?');
      params.push(status);
    }
    
    // User and Group filter
    if (group && group !== '' && group !== 'all') {
      if (group === 'Group A' || group === 'Group B') {
        conditions.push('u.user_group = ?');
        params.push(group);
      } else {
        // If group is a user ID, filter by specific user
        const userId = Number(group);
        if (!isNaN(userId)) {
          conditions.push('te.user_id = ?');
          params.push(userId);
        }
      }
    } else if (users && users !== '') {
      // Legacy support for users parameter (kept for compatibility)
      const userIds = users.toString().split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        conditions.push(`te.user_id IN (${userIds.map(() => '?').join(',')})`);
        params.push(...userIds);
      }
    }
    
    // Search filter
    if (search && search.toString().trim() !== '') {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, \' \', u.last_name) LIKE ?)');
      const searchTerm = `%${search.toString().trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Quick filter
    if (quickFilter && quickFilter !== 'all') {
      switch (quickFilter) {
        case 'late':
          conditions.push('TIME(te.clock_in) > \'09:00:00\'');
          break;
        case 'overtime':
          conditions.push('te.total_hours > 8');
          break;
        case 'edited':
          conditions.push('ter.entry_id IS NOT NULL');
          break;
        case 'missing':
          conditions.push('te.status = \'active\' AND te.clock_out IS NULL');
          break;
      }
    }
    
    // Add conditions to SQL
    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    
    // Simple query without pagination
    sql += ` ORDER BY te.clock_in DESC`;
    
    const entries = await query(sql, params) as any[];
    
    res.json({ entries });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Create new time entry
router.post('/entries', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check create permission using hybrid RBAC/legacy system
    const canCreate = await TimeTrackingPermissions.canCreateTimeEntriesHybrid(user);
    if (!canCreate) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { user_id, clock_in, clock_out, break_minutes = 30, notes = '', status = 'completed' } = req.body;
    
    if (!user_id || !clock_in) {
      return res.status(400).json({ error: 'Missing required fields: user_id, clock_in' });
    }
    
    // Calculate total hours if clock_out is provided
    let total_hours = 0;
    if (clock_out && clock_in !== clock_out) {
      const startTime = new Date(clock_in);
      const endTime = new Date(clock_out);
      const diffMs = endTime.getTime() - startTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const breakHours = (break_minutes || 0) / 60;
      total_hours = Math.max(0, diffHours - breakHours);
    }
    
    // Insert new time entry
    const result = await query(
      `INSERT INTO time_entries (user_id, clock_in, clock_out, break_minutes, total_hours, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [user_id, clock_in, clock_out, break_minutes, total_hours, status, notes]
    ) as any;
    
    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'create', 'time_entry', ?, ?)`,
      [user.user_id, result.insertId, `Created time entry for user ${user_id}`]
    );
    
    res.json({ 
      message: 'Time entry created successfully',
      entry_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// Update single time entry
router.put('/entries/:entryId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check update permission using hybrid RBAC/legacy system
    const canUpdate = await TimeTrackingPermissions.canUpdateTimeEntriesHybrid(user);
    if (!canUpdate) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { entryId } = req.params;
    const { clock_in, clock_out, break_minutes } = req.body;
    
    // Validate the entry exists
    const existingEntry = await query(
      'SELECT * FROM time_entries WHERE entry_id = ? AND is_deleted = 0',
      [entryId]
    ) as any[];
    
    if (existingEntry.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    
    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (clock_in !== undefined) {
      updateFields.push('clock_in = ?');
      updateValues.push(clock_in);
      // Also update payroll clock_in (extract time portion)
      updateFields.push('payroll_clock_in = TIME(?)');
      updateValues.push(clock_in);
    }
    
    if (clock_out !== undefined) {
      updateFields.push('clock_out = ?');
      updateValues.push(clock_out);
      // Also update payroll clock_out (extract time portion)
      updateFields.push('payroll_clock_out = TIME(?)');
      updateValues.push(clock_out);
    }
    
    if (break_minutes !== undefined) {
      updateFields.push('break_minutes = ?');
      updateValues.push(Number(break_minutes));
      // Also update payroll break_minutes
      updateFields.push('payroll_break_minutes = ?');
      updateValues.push(Number(break_minutes));
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    // Recalculate total hours and payroll total hours
    updateFields.push('total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
    updateFields.push('payroll_total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
    updateFields.push('payroll_adjusted = 0');  // Reset to 0 since we're syncing, not adjusting payroll independently
    updateFields.push('updated_at = NOW()');
    
    const sql = `
      UPDATE time_entries 
      SET ${updateFields.join(', ')}
      WHERE entry_id = ?
    `;
    
    await query(sql, [...updateValues, entryId]);
    
    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'update', 'time_entry', ?, ?)`,
      [user.user_id, entryId, JSON.stringify({ clock_in, clock_out, break_minutes })]
    );
    
    res.json({ message: 'Entry updated successfully' });
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// Delete individual time entry
router.delete('/entries/:entryId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const entryId = parseInt(req.params.entryId);
    
    // Check delete permission using hybrid RBAC/legacy system
    const canDelete = await TimeTrackingPermissions.canDeleteTimeEntriesHybrid(user);
    if (!canDelete) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (!entryId || isNaN(entryId)) {
      return res.status(400).json({ error: 'Invalid entry ID' });
    }
    
    // Soft delete the entry
    await query(
      'UPDATE time_entries SET is_deleted = 1, updated_at = NOW() WHERE entry_id = ?',
      [entryId]
    );
    
    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'delete', 'time_entry', ?, ?)`,
      [user.user_id, entryId.toString(), JSON.stringify({ deleted: true })]
    );
    
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// Bulk edit time entries
router.put('/bulk-edit', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check bulk update permission using hybrid RBAC/legacy system
    const canBulkUpdate = await TimeTrackingPermissions.canUpdateTimeEntriesHybrid(user);
    if (!canBulkUpdate) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { entryIds, updates } = req.body;
    
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ error: 'No entries selected' });
    }
    
    // Build update query based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (updates.clock_in !== undefined) {
      updateFields.push('clock_in = ?');
      updateValues.push(updates.clock_in);
      // Also update payroll clock_in
      updateFields.push('payroll_clock_in = TIME(?)');
      updateValues.push(updates.clock_in);
    }
    
    if (updates.clock_out !== undefined) {
      updateFields.push('clock_out = ?');
      updateValues.push(updates.clock_out);
      // Also update payroll clock_out
      updateFields.push('payroll_clock_out = TIME(?)');
      updateValues.push(updates.clock_out);
    }
    
    if (updates.break_minutes !== undefined) {
      updateFields.push('break_minutes = ?');
      updateValues.push(updates.break_minutes);
      // Also update payroll break_minutes
      updateFields.push('payroll_break_minutes = ?');
      updateValues.push(updates.break_minutes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    // Recalculate total hours and payroll total hours if times are updated
    if (updates.clock_in !== undefined || updates.clock_out !== undefined || updates.break_minutes !== undefined) {
      updateFields.push('total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
      updateFields.push('payroll_total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
      updateFields.push('payroll_adjusted = 0');  // Reset to 0 since we're syncing, not adjusting payroll independently
    }
    
    const sql = `
      UPDATE time_entries 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE entry_id IN (${entryIds.map(() => '?').join(',')})
    `;
    
    await query(sql, [...updateValues, ...entryIds]);
    
    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'bulk_edit', 'time_entries', ?, ?)`,
      [user.user_id, entryIds.join(','), JSON.stringify(updates)]
    );
    
    res.json({ message: 'Entries updated successfully' });
  } catch (error) {
    console.error('Error bulk editing entries:', error);
    res.status(500).json({ error: 'Failed to update entries' });
  }
});

// Bulk delete time entries
router.delete('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check bulk delete permission using hybrid RBAC/legacy system
    const canBulkDelete = await TimeTrackingPermissions.canDeleteTimeEntriesHybrid(user);
    if (!canBulkDelete) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { entryIds } = req.body;
    
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ error: 'No entries selected' });
    }
    
    // Soft delete entries
    const sql = `
      UPDATE time_entries 
      SET is_deleted = 1, updated_at = NOW()
      WHERE entry_id IN (${entryIds.map(() => '?').join(',')})
    `;
    
    await query(sql, entryIds);
    
    // Log audit trail
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'bulk_delete', 'time_entries', ?, ?)`,
      [user.user_id, entryIds.join(','), JSON.stringify({ deleted_count: entryIds.length })]
    );
    
    res.json({ message: `${entryIds.length} entries deleted successfully` });
  } catch (error) {
    console.error('Error bulk deleting entries:', error);
    res.status(500).json({ error: 'Failed to delete entries' });
  }
});

// Get users list
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check view users permission using hybrid RBAC/legacy system
    const canViewUsers = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
    if (!canViewUsers) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const users = await query(
      `SELECT user_id, username, first_name, last_name, email, role 
       FROM users 
       WHERE is_active = 1 
       ORDER BY first_name, last_name`
    ) as any[];
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;