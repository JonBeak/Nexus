import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import { TimeTrackingPermissions } from '../utils/timeTracking/permissions';

const router = Router();

// Get/Update work schedules
router.get('/schedules/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const schedules = await query(
      `SELECT * FROM work_schedules WHERE user_id = ? ORDER BY FIELD(day_of_week, 
       'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [req.params.userId]
    ) as any[];
    
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

router.put('/schedules/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { schedules } = req.body;
    const userId = req.params.userId;
    
    // Delete existing schedules
    await query('DELETE FROM work_schedules WHERE user_id = ?', [userId]);
    
    // Insert new schedules
    for (const schedule of schedules) {
      await query(
        `INSERT INTO work_schedules 
         (user_id, day_of_week, is_work_day, expected_start_time, expected_end_time) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, schedule.day_of_week, schedule.is_work_day, 
         schedule.expected_start_time, schedule.expected_end_time]
      );
    }
    
    res.json({ message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Manage holidays
router.get('/holidays', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const holidays = await query(
      'SELECT * FROM company_holidays WHERE is_active = 1 ORDER BY holiday_date'
    ) as any[];
    
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

router.post('/holidays', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { holiday_name, holiday_date, overwrite = false } = req.body;
    
    // Check if there's already an active holiday on this date
    const existingHolidays = await query(
      'SELECT * FROM company_holidays WHERE holiday_date = ? AND is_active = 1',
      [holiday_date]
    ) as any[];
    
    if (existingHolidays.length > 0 && !overwrite) {
      // Return conflict with existing holiday info
      return res.status(409).json({
        error: 'Holiday already exists on this date',
        existing_holiday: existingHolidays[0],
        requires_overwrite: true
      });
    }
    
    if (existingHolidays.length > 0 && overwrite) {
      // Deactivate existing holiday(s) on this date
      await query(
        'UPDATE company_holidays SET is_active = 0 WHERE holiday_date = ? AND is_active = 1',
        [holiday_date]
      );
    }
    
    // Insert new holiday
    await query(
      'INSERT INTO company_holidays (holiday_name, holiday_date) VALUES (?, ?)',
      [holiday_name, holiday_date]
    );
    
    res.json({ message: 'Holiday added successfully' });
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

router.delete('/holidays/:holidayId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await query(
      'UPDATE company_holidays SET is_active = 0 WHERE holiday_id = ?',
      [req.params.holidayId]
    );
    
    res.json({ message: 'Holiday removed successfully' });
  } catch (error) {
    console.error('Error removing holiday:', error);
    res.status(500).json({ error: 'Failed to remove holiday' });
  }
});

// Export holidays as CSV
router.get('/holidays/export', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const holidays = await query(
      'SELECT holiday_name, holiday_date FROM company_holidays WHERE is_active = 1 ORDER BY holiday_date'
    ) as any[];
    
    // Create CSV content
    let csvContent = 'Holiday Name,Date\n';
    holidays.forEach(holiday => {
      const formattedDate = new Date(holiday.holiday_date).toISOString().split('T')[0];
      csvContent += `"${holiday.holiday_name}","${formattedDate}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="company_holidays.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting holidays:', error);
    res.status(500).json({ error: 'Failed to export holidays' });
  }
});

// Import holidays from CSV
router.post('/holidays/import', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check schedule management permission using hybrid RBAC/legacy system
    const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
    if (!canManage) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { csvData, overwriteAll = false } = req.body;
    
    if (!csvData) {
      return res.status(400).json({ error: 'No CSV data provided' });
    }
    
    // Parse CSV data (skip header row)
    const lines = csvData.trim().split('\n');
    const holidaysToImport: Array<{name: string, date: string}> = [];
    const conflicts: Array<{name: string, date: string, existing: any}> = [];
    
    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing (handles quoted fields)
      const matches = line.match(/^"([^"]*)","([^"]*)"$/) || line.match(/^([^,]*),(.*)$/);
      if (!matches) continue;
      
      const name = matches[1].trim();
      const date = matches[2].trim();
      
      if (name && date) {
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ error: `Invalid date format: ${date}. Use YYYY-MM-DD format.` });
        }
        
        holidaysToImport.push({ name, date });
      }
    }
    
    if (holidaysToImport.length === 0) {
      return res.status(400).json({ error: 'No valid holidays found in CSV data' });
    }
    
    // Check for conflicts if not overwriting all
    if (!overwriteAll) {
      for (const holiday of holidaysToImport) {
        const existing = await query(
          'SELECT * FROM company_holidays WHERE holiday_date = ? AND is_active = 1',
          [holiday.date]
        ) as any[];
        
        if (existing.length > 0) {
          conflicts.push({
            name: holiday.name,
            date: holiday.date,
            existing: existing[0]
          });
        }
      }
      
      if (conflicts.length > 0) {
        return res.status(409).json({
          error: 'Some holidays conflict with existing ones',
          conflicts,
          requires_overwrite: true
        });
      }
    }
    
    // Import holidays
    let importedCount = 0;
    for (const holiday of holidaysToImport) {
      if (overwriteAll) {
        // Deactivate existing holidays on this date
        await query(
          'UPDATE company_holidays SET is_active = 0 WHERE holiday_date = ? AND is_active = 1',
          [holiday.date]
        );
      }
      
      // Insert new holiday
      await query(
        'INSERT INTO company_holidays (holiday_name, holiday_date) VALUES (?, ?)',
        [holiday.name, holiday.date]
      );
      importedCount++;
    }
    
    res.json({ 
      message: `Successfully imported ${importedCount} holidays`,
      imported_count: importedCount
    });
  } catch (error) {
    console.error('Error importing holidays:', error);
    res.status(500).json({ error: 'Failed to import holidays' });
  }
});

export default router;