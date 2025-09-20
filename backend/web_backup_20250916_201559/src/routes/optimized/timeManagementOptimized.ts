// Optimized Time Management API - Phase 3
// Consolidates endpoints, improves performance, and reduces code duplication

import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { query } from '../../config/database';
import { TimeTrackingPermissions } from '../../utils/timeTracking/permissions';
import { timeDataCache, usersCache, analyticsCache, invalidateTimeCache } from '../../middleware/cache';
import { 
  dateRangeValidation, 
  timeEntryValidation, 
  bulkEditValidation, 
  exportValidation,
  sanitizeSearchTerm,
  rateLimit 
} from '../../middleware/validation';

const router = Router();

// Middleware to check manager access
const requireManagerAccess = async (req: any, res: any, next: any) => {
  const user = req.user;
  const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
  if (!canManage) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

// Common query builder for time entries
const buildTimeEntriesQuery = (params: {
  startDate?: string;
  endDate?: string;
  status?: string;
  group?: string;
  search?: string;
  quickFilter?: string;
}) => {
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
  const values: any[] = [];

  // Date range filter
  if (params.startDate) {
    conditions.push('DATE(te.clock_in) >= ?');
    values.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push('DATE(te.clock_in) <= ?');
    values.push(params.endDate);
  }

  // Status filter
  if (params.status && params.status !== 'all') {
    conditions.push('te.status = ?');
    values.push(params.status);
  }

  // Group/User filter
  if (params.group && params.group !== '' && params.group !== 'all') {
    if (params.group === 'Group A' || params.group === 'Group B') {
      conditions.push('u.user_group = ?');
      values.push(params.group);
    } else {
      const userId = Number(params.group);
      if (!isNaN(userId)) {
        conditions.push('te.user_id = ?');
        values.push(userId);
      }
    }
  }

  // Search filter
  if (params.search && params.search.trim() !== '') {
    conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, \' \', u.last_name) LIKE ?)');
    const searchTerm = `%${params.search.trim()}%`;
    values.push(searchTerm, searchTerm, searchTerm);
  }

  // Quick filter
  if (params.quickFilter && params.quickFilter !== 'all') {
    switch (params.quickFilter) {
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

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }

  return { sql, values };
};

// CONSOLIDATED ENDPOINT: Get time data (entries, summary, analytics, missing)
router.get('/data', 
  authenticateToken, 
  requireManagerAccess, 
  sanitizeSearchTerm,
  dateRangeValidation,
  timeDataCache,
  rateLimit(60, 60000), // 60 requests per minute
  async (req, res) => {
  try {
    const { 
      dataType, // 'entries' | 'summary' | 'analytics' | 'missing'
      startDate, 
      endDate, 
      status, 
      group, 
      search, 
      period,
      limit = 1000 
    } = req.query;

    const params = {
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      group: group as string,
      search: search as string
    };

    switch (dataType) {
      case 'entries':
        const { sql: entrySql, values: entryValues } = buildTimeEntriesQuery(params);
        const entriesQuery = `${entrySql} ORDER BY te.clock_in DESC LIMIT ?`;
        const entries = await query(entriesQuery, [...entryValues, Number(limit)]) as any[];
        return res.json({ entries });

      case 'summary':
        const summaryQuery = `
          SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            COALESCE(SUM(te.total_hours), 0) as total_hours,
            COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours,
            COUNT(DISTINCT DATE(te.clock_in)) as days_worked,
            COUNT(CASE WHEN TIME(te.clock_in) > '09:00:00' THEN 1 END) as late_days,
            COUNT(CASE WHEN ter.entry_id IS NOT NULL THEN 1 END) as edited_entries
          FROM users u
          LEFT JOIN time_entries te ON u.user_id = te.user_id 
            AND te.is_deleted = 0
            AND DATE(te.clock_in) BETWEEN ? AND ?
          LEFT JOIN (
            SELECT DISTINCT entry_id 
            FROM time_edit_requests 
            WHERE status IN ('approved', 'modified')
          ) ter ON te.entry_id = ter.entry_id
          WHERE u.is_active = 1
          ${group && group !== 'all' && group !== '' ? 
            (group === 'Group A' || group === 'Group B' ? 'AND u.user_group = ?' : 'AND u.user_id = ?') 
            : ''
          }
          GROUP BY u.user_id, u.first_name, u.last_name 
          ORDER BY u.first_name, u.last_name
        `;
        
        const summaryParams = [startDate, endDate];
        if (group && group !== 'all' && group !== '') {
          summaryParams.push(group === 'Group A' || group === 'Group B' ? group : Number(group));
        }
        
        const summary = await query(summaryQuery, summaryParams) as any[];
        return res.json(summary);

      case 'analytics':
        // Parallel analytics queries for better performance
        const [totalStats, onTimeStats, editStats, topPerformers, totalEmployees] = await Promise.all([
          query(`
            SELECT 
              COUNT(DISTINCT te.user_id) as active_employees,
              COALESCE(SUM(te.total_hours), 0) as total_hours,
              COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours
            FROM time_entries te 
            WHERE te.is_deleted = 0 AND DATE(te.clock_in) BETWEEN ? AND ?
            ${group && group !== 'all' && group !== '' ? 
              (group === 'Group A' || group === 'Group B' ? 'AND EXISTS(SELECT 1 FROM users WHERE user_id = te.user_id AND user_group = ?)' : 'AND te.user_id = ?') 
              : ''
            }
          `, group && group !== 'all' && group !== '' ? [startDate, endDate, group] : [startDate, endDate]),

          query(`
            SELECT 
              COUNT(*) as total_entries,
              COUNT(CASE WHEN TIME(te.clock_in) <= '09:00:00' THEN 1 END) as on_time_entries
            FROM time_entries te
            WHERE te.is_deleted = 0 AND DATE(te.clock_in) BETWEEN ? AND ?
            ${group && group !== 'all' && group !== '' ? 
              (group === 'Group A' || group === 'Group B' ? 'AND EXISTS(SELECT 1 FROM users WHERE user_id = te.user_id AND user_group = ?)' : 'AND te.user_id = ?') 
              : ''
            }
          `, group && group !== 'all' && group !== '' ? [startDate, endDate, group] : [startDate, endDate]),

          query(`
            SELECT COUNT(DISTINCT te.entry_id) as edited_entries
            FROM time_entries te
            JOIN time_edit_requests ter ON te.entry_id = ter.entry_id
            WHERE te.is_deleted = 0 AND ter.status IN ('approved', 'modified')
              AND DATE(te.clock_in) BETWEEN ? AND ?
              ${group && group !== 'all' && group !== '' ? 
                (group === 'Group A' || group === 'Group B' ? 'AND EXISTS(SELECT 1 FROM users WHERE user_id = te.user_id AND user_group = ?)' : 'AND te.user_id = ?') 
                : ''
              }
          `, group && group !== 'all' && group !== '' ? [startDate, endDate, group] : [startDate, endDate]),

          query(`
            SELECT u.user_id, u.first_name, u.last_name, COALESCE(SUM(te.total_hours), 0) as total_hours
            FROM users u
            LEFT JOIN time_entries te ON u.user_id = te.user_id 
              AND te.is_deleted = 0 AND DATE(te.clock_in) BETWEEN ? AND ?
            WHERE u.is_active = 1
            ${group && group !== 'all' && group !== '' ? 
              (group === 'Group A' || group === 'Group B' ? 'AND u.user_group = ?' : 'AND u.user_id = ?') 
              : ''
            }
            GROUP BY u.user_id, u.first_name, u.last_name
            ORDER BY total_hours DESC LIMIT 5
          `, group && group !== 'all' && group !== '' ? [startDate, endDate, group] : [startDate, endDate]),

          query(`
            SELECT COUNT(*) as count FROM users WHERE is_active = 1
            ${group && group !== 'all' && group !== '' ? 
              (group === 'Group A' || group === 'Group B' ? 'AND user_group = ?' : 'AND user_id = ?') 
              : ''
            }
          `, group && group !== 'all' && group !== '' ? [group] : [])
        ]);

        const analytics = {
          totalEmployees: (totalEmployees as any[])[0].count,
          totalHours: Number((totalStats as any[])[0].total_hours),
          overtimeHours: Number((totalStats as any[])[0].overtime_hours),
          averageHoursPerEmployee: (totalStats as any[])[0].active_employees > 0 ? 
            Number((totalStats as any[])[0].total_hours) / (totalStats as any[])[0].active_employees : 0,
          onTimePercentage: (onTimeStats as any[])[0].total_entries > 0 ? 
            ((onTimeStats as any[])[0].on_time_entries / (onTimeStats as any[])[0].total_entries) * 100 : 100,
          attendanceRate: (totalEmployees as any[])[0].count > 0 ? 
            ((totalStats as any[])[0].active_employees / (totalEmployees as any[])[0].count) * 100 : 0,
          editRequestsCount: Number((editStats as any[])[0].edited_entries),
          topPerformers: topPerformers as any[]
        };

        return res.json(analytics);

      case 'missing':
        // Simplified missing entries query with performance optimizations
        const missingQuery = `
          SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            dates.date_value as missing_date,
            DAYNAME(dates.date_value) as day_of_week,
            COALESCE(ws.expected_start_time, '09:00:00') as expected_start,
            COALESCE(ws.expected_end_time, '17:00:00') as expected_end
          FROM (
            SELECT DATE_ADD(?, INTERVAL seq.seq DAY) as date_value
            FROM (
              SELECT 0 as seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
              UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
              UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
              UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
              UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
              UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
              UNION SELECT 30
            ) seq
            WHERE DATE_ADD(?, INTERVAL seq.seq DAY) <= ?
          ) dates
          CROSS JOIN users u
          LEFT JOIN work_schedules ws ON u.user_id = ws.user_id 
            AND ws.day_of_week = DAYNAME(dates.date_value)
          LEFT JOIN time_entries te ON u.user_id = te.user_id 
            AND DATE(te.clock_in) = dates.date_value AND te.is_deleted = 0
          LEFT JOIN company_holidays ch ON ch.holiday_date = dates.date_value AND ch.is_active = 1
          LEFT JOIN vacation_periods vp ON u.user_id = vp.user_id 
            AND dates.date_value BETWEEN vp.start_date AND vp.end_date
          WHERE u.is_active = 1
            AND COALESCE(ws.is_work_day, DAYOFWEEK(dates.date_value) NOT IN (1, 7)) = 1
            AND te.entry_id IS NULL
            AND ch.holiday_id IS NULL  
            AND vp.vacation_id IS NULL
            ${group && group !== 'all' && group !== '' ? 
              (group === 'Group A' || group === 'Group B' ? 'AND u.user_group = ?' : 'AND u.user_id = ?') 
              : ''
            }
          ORDER BY dates.date_value DESC, u.first_name, u.last_name
          LIMIT 500
        `;

        const missingParams = [startDate, startDate, endDate];
        if (group && group !== 'all' && group !== '') {
          missingParams.push(group);
        }

        const missing = await query(missingQuery, missingParams) as any[];
        return res.json(missing);

      default:
        return res.status(400).json({ error: 'Invalid dataType. Use: entries, summary, analytics, or missing' });
    }

  } catch (error) {
    console.error('Error fetching time data:', error);
    res.status(500).json({ error: 'Failed to fetch time data' });
  }
});

// OPTIMIZED CRUD Operations
router.post('/entries', 
  authenticateToken, 
  requireManagerAccess, 
  timeEntryValidation,
  async (req, res) => {
  try {
    const { user_id, clock_in, clock_out, break_minutes = 30, date } = req.body;

    if (!user_id || !clock_in) {
      return res.status(400).json({ error: 'Missing required fields: user_id, clock_in' });
    }

    // Calculate total hours efficiently
    const totalHoursQuery = clock_out ? 
      'ROUND((TIMESTAMPDIFF(MINUTE, ?, ?) - ?) / 60, 2)' : 
      '0';

    const insertQuery = `
      INSERT INTO time_entries (
        user_id, clock_in, clock_out, break_minutes, total_hours, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ${totalHoursQuery}, 'completed', NOW(), NOW()
      )
    `;

    const params = clock_out ? 
      [user_id, clock_in, clock_out, break_minutes, clock_in, clock_out, break_minutes] :
      [user_id, clock_in, clock_out, break_minutes];

    const result = await query(insertQuery, params) as any;

    // Audit trail
    await query(
      'INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [(req as any).user.user_id, 'create', 'time_entry', result.insertId, JSON.stringify({ user_id, clock_in, clock_out, break_minutes })]
    );

    // Invalidate relevant cache
    invalidateTimeCache();

    res.json({ message: 'Time entry created successfully', entry_id: result.insertId });
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// OPTIMIZED Bulk operations
router.put('/entries/bulk', 
  authenticateToken, 
  requireManagerAccess, 
  bulkEditValidation,
  rateLimit(10, 60000), // 10 bulk operations per minute
  async (req, res) => {
  try {
    const { entry_ids, clock_in, clock_out, break_minutes } = req.body;

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return res.status(400).json({ error: 'No entries selected' });
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (clock_in !== undefined) {
      updateFields.push('clock_in = ?');
      updateValues.push(clock_in);
    }

    if (clock_out !== undefined) {
      updateFields.push('clock_out = ?');
      updateValues.push(clock_out);
    }

    if (break_minutes !== undefined) {
      updateFields.push('break_minutes = ?');
      updateValues.push(Number(break_minutes));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Always recalculate total hours
    updateFields.push('total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
    updateFields.push('updated_at = NOW()');

    const updateQuery = `
      UPDATE time_entries 
      SET ${updateFields.join(', ')}
      WHERE entry_id IN (${entry_ids.map(() => '?').join(',')}) AND is_deleted = 0
    `;

    await query(updateQuery, [...updateValues, ...entry_ids]);

    // Single audit entry for bulk operation
    await query(
      'INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [(req as any).user.user_id, 'bulk_edit', 'time_entries', entry_ids.join(','), JSON.stringify({ clock_in, clock_out, break_minutes, count: entry_ids.length })]
    );

    // Invalidate relevant cache
    invalidateTimeCache();

    res.json({ message: `${entry_ids.length} entries updated successfully` });
  } catch (error) {
    console.error('Error bulk editing entries:', error);
    res.status(500).json({ error: 'Failed to update entries' });
  }
});

router.delete('/entries', authenticateToken, requireManagerAccess, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No entries selected' });
    }

    // Soft delete with single query
    const deleteQuery = `
      UPDATE time_entries 
      SET is_deleted = 1, updated_at = NOW()
      WHERE entry_id IN (${ids.map(() => '?').join(',')}) AND is_deleted = 0
    `;

    const result = await query(deleteQuery, ids) as any;

    // Single audit entry
    await query(
      'INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [(req as any).user.user_id, 'bulk_delete', 'time_entries', ids.join(','), JSON.stringify({ count: result.affectedRows })]
    );

    // Invalidate relevant cache
    invalidateTimeCache();

    res.json({ message: `${result.affectedRows} entries deleted successfully` });
  } catch (error) {
    console.error('Error bulk deleting entries:', error);
    res.status(500).json({ error: 'Failed to delete entries' });
  }
});

// OPTIMIZED Export with streaming for large datasets
router.get('/export', 
  authenticateToken, 
  requireManagerAccess,
  sanitizeSearchTerm,
  exportValidation,
  rateLimit(5, 60000), // 5 exports per minute
  async (req, res) => {
  try {
    const { format = 'csv', ...filterParams } = req.query;
    const { sql, values } = buildTimeEntriesQuery(filterParams as any);

    // Modified query for export
    const exportSql = sql.replace(
      'te.entry_id,\n      te.user_id,\n      u.first_name,\n      u.last_name,\n      te.clock_in,\n      te.clock_out,\n      te.break_minutes,\n      te.total_hours,\n      te.status,',
      'u.first_name, u.last_name, DATE(te.clock_in) as date, TIME(te.clock_in) as clock_in_time, TIME(te.clock_out) as clock_out_time, te.break_minutes, te.total_hours, te.status,'
    ) + ' ORDER BY te.clock_in DESC';

    const entries = await query(exportSql, values) as any[];

    if (format === 'csv') {
      const headers = 'Employee,Date,Clock In,Clock Out,Break (min),Total Hours,Status,Edited\n';
      const csvData = entries.map(entry => 
        `"${entry.first_name} ${entry.last_name}","${entry.date}","${entry.clock_in_time || ''}","${entry.clock_out_time || ''}","${entry.break_minutes}","${entry.total_hours}","${entry.status}","${entry.is_edited ? 'Yes' : 'No'}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="time-entries.csv"');
      res.send(headers + csvData);
    } else {
      res.status(400).json({ error: 'Only CSV export is currently supported' });
    }

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// OPTIMIZED Missing entry management
router.post('/mark-excused', authenticateToken, requireManagerAccess, async (req, res) => {
  try {
    const { user_id, missing_date, reason = 'Excused by manager' } = req.body;

    if (!user_id || !missing_date) {
      return res.status(400).json({ error: 'Missing required fields: user_id, missing_date' });
    }

    // Insert excused entry record
    await query(
      'INSERT INTO excused_absences (user_id, absence_date, reason, excused_by, created_at) VALUES (?, ?, ?, ?, NOW())',
      [user_id, missing_date, reason, (req as any).user.user_id]
    );

    // Audit trail
    await query(
      'INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [(req as any).user.user_id, 'mark_excused', 'absence', `${user_id}-${missing_date}`, JSON.stringify({ user_id, missing_date, reason })]
    );

    res.json({ message: 'Absence marked as excused successfully' });
  } catch (error) {
    console.error('Error marking absence as excused:', error);
    res.status(500).json({ error: 'Failed to mark absence as excused' });
  }
});

// Get active users list (cached for performance)
router.get('/users', 
  authenticateToken, 
  requireManagerAccess, 
  usersCache,
  async (req, res) => {
  try {
    const users = await query(
      'SELECT user_id, first_name, last_name, user_group FROM users WHERE is_active = 1 ORDER BY first_name, last_name'
    ) as any[];
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;