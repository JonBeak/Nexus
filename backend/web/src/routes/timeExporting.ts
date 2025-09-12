import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import { TimeTrackingPermissions } from '../utils/timeTracking/permissions';

const router = Router();

// Export time entries
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check export permission using hybrid RBAC/legacy system
    const canExport = await TimeTrackingPermissions.canExportTimeDataHybrid(user);
    if (!canExport) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { startDate, endDate, status, users, search, quickFilter, format } = req.query;
    
    // Build the same query as the entries endpoint
    let sql = `
      SELECT 
        u.first_name,
        u.last_name,
        DATE(te.clock_in) as date,
        TIME(te.clock_in) as clock_in_time,
        TIME(te.clock_out) as clock_out_time,
        te.break_minutes,
        te.total_hours,
        te.status,
        CASE 
          WHEN ter.entry_id IS NOT NULL THEN 'Yes' 
          ELSE 'No' 
        END as edited
      FROM time_entries te
      JOIN users u ON te.user_id = u.user_id
      LEFT JOIN (
        SELECT DISTINCT entry_id 
        FROM time_edit_requests 
        WHERE status IN ('approved', 'modified')
      ) ter ON te.entry_id = ter.entry_id
      WHERE te.is_deleted = 0
    `;
    
    const params: any[] = [];
    
    // Apply same filters as entries endpoint
    if (startDate) {
      sql += ` AND DATE(te.clock_in) >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      sql += ` AND DATE(te.clock_in) <= ?`;
      params.push(endDate);
    }
    
    if (status && status !== 'all') {
      sql += ` AND te.status = ?`;
      params.push(status);
    }
    
    if (users && users !== '') {
      const userIds = users.toString().split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        sql += ` AND te.user_id IN (${userIds.map(() => '?').join(',')})`;
        params.push(...userIds);
      }
    }
    
    if (search && search.toString().trim() !== '') {
      sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)`;
      const searchTerm = `%${search.toString().trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (quickFilter && quickFilter !== 'all') {
      switch (quickFilter) {
        case 'late':
          sql += ` AND TIME(te.clock_in) > '09:00:00'`;
          break;
        case 'overtime':
          sql += ` AND te.total_hours > 8`;
          break;
        case 'edited':
          sql += ` AND ter.entry_id IS NOT NULL`;
          break;
        case 'missing':
          sql += ` AND te.status = 'active' AND te.clock_out IS NULL`;
          break;
      }
    }
    
    sql += ` ORDER BY te.clock_in DESC`;
    
    const entries = await query(sql, params) as any[];
    
    if (format === 'csv') {
      // Generate CSV
      const headers = 'Employee,Date,Clock In,Clock Out,Break (min),Total Hours,Status,Edited\n';
      const csvData = entries.map(entry => 
        `"${entry.first_name} ${entry.last_name}","${entry.date}","${entry.clock_in_time || ''}","${entry.clock_out_time || ''}","${entry.break_minutes}","${entry.total_hours}","${entry.status}","${entry.edited}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="time-entries.csv"');
      res.send(headers + csvData);
      
    } else if (format === 'pdf') {
      // For PDF, we'll return JSON data with instructions to generate PDF client-side
      // This is a simplified approach - in production you might use a PDF library
      res.json({ 
        message: 'PDF export not yet implemented. Use CSV export for now.',
        data: entries 
      });
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or pdf' });
    }
    
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;