import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import { TimeTrackingPermissions } from '../utils/timeTracking/permissions';

const router = Router();

// Get weekly summary data
router.get('/weekly-summary', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check analytics view permission using hybrid RBAC/legacy system
    const canViewAnalytics = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
    if (!canViewAnalytics) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { startDate, endDate, users, group } = req.query;
    
    let sql = `
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
    `;
    
    const params: any[] = [startDate, endDate];
    
    // User and Group filter
    if (group && group !== '' && group !== 'all') {
      if (group === 'Group A' || group === 'Group B') {
        sql += ` AND u.user_group = ?`;
        params.push(group);
      } else {
        // If group is a user ID, filter by specific user
        const userId = Number(group);
        if (!isNaN(userId)) {
          sql += ` AND u.user_id = ?`;
          params.push(userId);
        }
      }
    } else if (users && users !== '') {
      // Legacy support for users parameter
      const userIds = users.toString().split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        sql += ` AND u.user_id IN (${userIds.map(() => '?').join(',')})`;
        params.push(...userIds);
      }
    }
    
    sql += ` GROUP BY u.user_id, u.first_name, u.last_name ORDER BY u.first_name, u.last_name`;
    
    const summary = await query(sql, params) as any[];
    res.json(summary);
  } catch (error) {
    console.error('Error fetching weekly summary:', error);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// Get analytics overview
router.get('/analytics-overview', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check analytics view permission using hybrid RBAC/legacy system
    const canViewAnalytics = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
    if (!canViewAnalytics) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { startDate, endDate, users } = req.query;
    
    let userFilter = '';
    let params: any[] = [startDate, endDate];
    
    if (users && users !== '') {
      const userIds = users.toString().split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        userFilter = ` AND te.user_id IN (${userIds.map(() => '?').join(',')})`;
        params.push(...userIds);
      }
    }
    
    // Parallel queries for analytics data
    const [
      totalStats,
      onTimeStats,
      editRequestStats,
      topPerformers,
      totalEmployees
    ] = await Promise.all([
      // Total hours and overtime
      query(`
        SELECT 
          COUNT(DISTINCT te.user_id) as active_employees,
          COALESCE(SUM(te.total_hours), 0) as total_hours,
          COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours,
          COUNT(DISTINCT DATE(te.clock_in)) as total_work_days
        FROM time_entries te 
        WHERE te.is_deleted = 0 
          AND DATE(te.clock_in) BETWEEN ? AND ?
          ${userFilter}
      `, params),
      
      // On-time statistics  
      query(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(CASE WHEN TIME(te.clock_in) <= '09:00:00' THEN 1 END) as on_time_entries
        FROM time_entries te
        WHERE te.is_deleted = 0 
          AND DATE(te.clock_in) BETWEEN ? AND ?
          ${userFilter}
      `, params),
      
      // Edit request statistics
      query(`
        SELECT 
          COUNT(DISTINCT te.entry_id) as edited_entries
        FROM time_entries te
        JOIN time_edit_requests ter ON te.entry_id = ter.entry_id
        WHERE te.is_deleted = 0 
          AND ter.status IN ('approved', 'modified')
          AND DATE(te.clock_in) BETWEEN ? AND ?
          ${userFilter}
      `, params),
      
      // Top performers by hours
      query(`
        SELECT 
          u.user_id,
          u.first_name,
          u.last_name,
          COALESCE(SUM(te.total_hours), 0) as total_hours
        FROM users u
        LEFT JOIN time_entries te ON u.user_id = te.user_id 
          AND te.is_deleted = 0
          AND DATE(te.clock_in) BETWEEN ? AND ?
        WHERE u.is_active = 1
          ${userFilter.replace('te.user_id', 'u.user_id')}
        GROUP BY u.user_id, u.first_name, u.last_name
        ORDER BY total_hours DESC
        LIMIT 5
      `, params.map(p => userFilter.includes('te.user_id') ? p : p)),
      
      // Total active employees
      query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE is_active = 1
        ${users && users !== '' ? ` AND user_id IN (${users.toString().split(',').map(Number).filter(Boolean).map(() => '?').join(',')})` : ''}
      `, users && users !== '' ? users.toString().split(',').map(Number).filter(Boolean) : [])
    ]);
    
    const totalStatsData = (totalStats as any[])[0];
    const onTimeStatsData = (onTimeStats as any[])[0];
    const editStatsData = (editRequestStats as any[])[0];
    const topPerformersData = topPerformers as any[];
    const totalEmployeesData = (totalEmployees as any[])[0];
    
    const analytics = {
      totalEmployees: totalEmployeesData.count,
      totalHours: Number(totalStatsData.total_hours),
      overtimeHours: Number(totalStatsData.overtime_hours),
      averageHoursPerEmployee: totalStatsData.active_employees > 0 ? 
        Number(totalStatsData.total_hours) / totalStatsData.active_employees : 0,
      onTimePercentage: onTimeStatsData.total_entries > 0 ? 
        (onTimeStatsData.on_time_entries / onTimeStatsData.total_entries) * 100 : 100,
      attendanceRate: totalEmployeesData.count > 0 ? 
        (totalStatsData.active_employees / totalEmployeesData.count) * 100 : 0,
      editRequestsCount: Number(editStatsData.edited_entries),
      topPerformers: topPerformersData
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// Get analytics data
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check analytics view permission using hybrid RBAC/legacy system
    const canViewAnalytics = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
    if (!canViewAnalytics) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { userId, startDate, endDate } = req.query;
    
    // Get various analytics metrics
    const [
      totalHours,
      overtimeHours,
      daysWorked,
      weekendsWorked,
      lateEntries
    ] = await Promise.all([
      // Total hours worked
      query(
        `SELECT COALESCE(SUM(total_hours), 0) as total 
         FROM time_entries 
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? AND is_deleted = 0`,
        [userId, startDate, endDate]
      ),
      
      // Overtime hours (>8 hours per day)
      query(
        `SELECT COALESCE(SUM(GREATEST(total_hours - 8, 0)), 0) as overtime 
         FROM time_entries 
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? AND is_deleted = 0`,
        [userId, startDate, endDate]
      ),
      
      // Days worked
      query(
        `SELECT COUNT(DISTINCT DATE(clock_in)) as days 
         FROM time_entries 
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? AND is_deleted = 0`,
        [userId, startDate, endDate]
      ),
      
      // Weekends worked
      query(
        `SELECT COUNT(DISTINCT DATE(clock_in)) as weekends 
         FROM time_entries 
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? 
         AND DAYOFWEEK(clock_in) IN (1, 7) AND is_deleted = 0`,
        [userId, startDate, endDate]
      ),
      
      // Late entries (after 9 AM)
      query(
        `SELECT COUNT(*) as late 
         FROM time_entries 
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? 
         AND TIME(clock_in) > '09:00:00' AND is_deleted = 0`,
        [userId, startDate, endDate]
      )
    ]);
    
    res.json({
      totalHours: (totalHours as any)[0].total,
      overtimeHours: (overtimeHours as any)[0].overtime,
      daysWorked: (daysWorked as any)[0].days,
      weekendsWorked: (weekendsWorked as any)[0].weekends,
      lateEntries: (lateEntries as any)[0].late
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get missing entries based on work schedules and holidays
router.get('/missing-entries', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  // Set a timeout to prevent long-running queries
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout - try a smaller date range' });
    }
  }, 8000); // 8 second timeout
  
  try {
    const user = (req as any).user;
    
    // Check analytics view permission using hybrid RBAC/legacy system
    const canViewAnalytics = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
    if (!canViewAnalytics) {
      clearTimeout(timeout);
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { startDate, endDate, users } = req.query;
    
    // Input validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!startDate || !endDate || !dateRegex.test(startDate as string) || !dateRegex.test(endDate as string)) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    
    // Safe date construction with validation
    let start: Date, end: Date;
    try {
      start = new Date(startDate as string + 'T00:00:00.000Z');
      end = new Date(endDate as string + 'T00:00:00.000Z');
      
      // Validate dates are not NaN
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date values');
      }
      
      // Ensure start <= end
      if (start > end) {
        clearTimeout(timeout);
        return res.status(400).json({ error: 'Start date must be before or equal to end date' });
      }
    } catch (error) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    // Limit date range to prevent performance issues
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Date range too large. Maximum 90 days allowed.' });
    }
    
    console.log(`[MISSING] Processing date range: ${startDate} to ${endDate} (${daysDiff + 1} days)`);
    
    // Build user filter for batch queries
    let userFilter = '';
    const userParams: any[] = [startDate, endDate];
    if (users && users !== '') {
      const userIds = users.toString().split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        userFilter = ` AND u.user_id IN (${userIds.map(() => '?').join(',')})`;
        userParams.push(...userIds);
      }
    }
    
    // BATCH QUERY 1: Get all active users, their schedules, and existing entries in one go
    const batchQuery = `
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        ws.day_of_week,
        ws.is_work_day,
        ws.expected_start_time,
        ws.expected_end_time,
        GROUP_CONCAT(DISTINCT DATE_FORMAT(DATE(te.clock_in), '%Y-%m-%d')) as existing_dates
      FROM users u
      LEFT JOIN work_schedules ws ON u.user_id = ws.user_id
      LEFT JOIN time_entries te ON u.user_id = te.user_id 
        AND DATE(te.clock_in) BETWEEN ? AND ? 
        AND te.is_deleted = 0
      WHERE u.is_active = 1 ${userFilter}
      GROUP BY u.user_id, u.first_name, u.last_name, ws.day_of_week, ws.is_work_day, ws.expected_start_time, ws.expected_end_time
      ORDER BY u.user_id, FIELD(ws.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    `;
    
    const batchResults = await query(batchQuery, userParams) as any[];
    console.log(`[MISSING] Batch query returned ${batchResults.length} user/schedule combinations (${Date.now() - startTime}ms)`);
    
    // BATCH QUERY 2: Get all holidays in date range
    const holidays = await query(
      `SELECT holiday_date FROM company_holidays 
       WHERE holiday_date BETWEEN ? AND ? AND is_active = 1`,
      [startDate, endDate]
    ) as any[];
    
    const holidayDates = new Set(holidays.map(h => {
      if (h.holiday_date instanceof Date) {
        return h.holiday_date.toISOString().split('T')[0];
      }
      return h.holiday_date.toString().split('T')[0];
    }));
    console.log(`[MISSING] Found ${holidays.length} holidays (${Date.now() - startTime}ms)`);
    
    // BATCH QUERY 3: Get all vacation periods
    const vacations = await query(
      `SELECT user_id, start_date, end_date FROM vacation_periods
       WHERE (start_date <= ? AND end_date >= ?) OR 
             (start_date BETWEEN ? AND ?) OR
             (end_date BETWEEN ? AND ?)`,
      [endDate, startDate, startDate, endDate, startDate, endDate]
    ) as any[];
    
    // Pre-compute vacation lookup map
    const vacationMap = new Map<number, Set<string>>();
    for (const vacation of vacations) {
      if (!vacationMap.has(vacation.user_id)) {
        vacationMap.set(vacation.user_id, new Set<string>());
      }
      
      const userVacationDates = vacationMap.get(vacation.user_id)!;
      const vStartStr = vacation.start_date instanceof Date 
        ? vacation.start_date.toISOString().split('T')[0] 
        : vacation.start_date.toString().split('T')[0];
      const vEndStr = vacation.end_date instanceof Date 
        ? vacation.end_date.toISOString().split('T')[0] 
        : vacation.end_date.toString().split('T')[0];
      
      // Safe vacation date iteration
      const vStart = new Date(vStartStr + 'T00:00:00.000Z');
      const vEnd = new Date(vEndStr + 'T00:00:00.000Z');
      let vCurrentDate = new Date(vStart);
      let vacationIterations = 0;
      const MAX_VACATION_DAYS = 365; // Safety limit
      
      while (vCurrentDate <= vEnd && vacationIterations < MAX_VACATION_DAYS) {
        const year = vCurrentDate.getFullYear();
        const month = String(vCurrentDate.getMonth() + 1).padStart(2, '0');
        const day = String(vCurrentDate.getDate()).padStart(2, '0');
        userVacationDates.add(`${year}-${month}-${day}`);
        
        vCurrentDate.setUTCDate(vCurrentDate.getUTCDate() + 1);
        vacationIterations++;
      }
    }
    console.log(`[MISSING] Processed ${vacations.length} vacation periods (${Date.now() - startTime}ms)`);
    
    // Process batch results into structured data
    const userData = new Map<number, {
      user_id: number;
      first_name: string;
      last_name: string;
      schedules: Map<string, any>;
      existingDates: Set<string>;
    }>();
    
    for (const row of batchResults) {
      if (!userData.has(row.user_id)) {
        userData.set(row.user_id, {
          user_id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          schedules: new Map(),
          existingDates: new Set(row.existing_dates ? row.existing_dates.split(',').filter(Boolean) : [])
        });
      }
      
      const userInfo = userData.get(row.user_id)!;
      
      // Add schedule info (if exists)
      if (row.day_of_week) {
        userInfo.schedules.set(row.day_of_week, {
          is_work_day: Boolean(row.is_work_day),
          expected_start_time: row.expected_start_time || '09:00',
          expected_end_time: row.expected_end_time || '17:00'
        });
      }
    }
    
    // Add default schedules for users without custom schedules
    const defaultSchedule = {
      'Monday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Tuesday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Wednesday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Thursday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Friday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Saturday': { is_work_day: false, expected_start_time: null, expected_end_time: null },
      'Sunday': { is_work_day: false, expected_start_time: null, expected_end_time: null }
    };
    
    for (const [userId, userInfo] of userData) {
      if (userInfo.schedules.size === 0) {
        for (const [day, schedule] of Object.entries(defaultSchedule)) {
          userInfo.schedules.set(day, schedule);
        }
      }
    }
    
    console.log(`[MISSING] Processed ${userData.size} users (${Date.now() - startTime}ms)`);
    
    // Generate missing entries with safe iteration
    const missingEntries: any[] = [];
    let currentDate = new Date(start);
    let iterations = 0;
    const MAX_ITERATIONS = daysDiff + 5; // Safety buffer
    
    while (currentDate <= end && iterations < MAX_ITERATIONS) {
      // Check timeout
      if (Date.now() - startTime > 7000) { // 7 second safety margin
        console.log(`[MISSING] Timeout approaching, stopping at ${iterations} iterations`);
        break;
      }
      
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Skip holidays
      if (holidayDates.has(dateStr)) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        iterations++;
        continue;
      }
      
      // Check each user for missing entries on this date
      for (const [userId, userInfo] of userData) {
        // Skip if user is on vacation
        if (vacationMap.get(userId)?.has(dateStr)) {
          continue;
        }
        
        // Get schedule for this day
        const daySchedule = userInfo.schedules.get(dayName);
        if (!daySchedule || !daySchedule.is_work_day) {
          continue;
        }
        
        // Check if entry exists
        if (!userInfo.existingDates.has(dateStr)) {
          missingEntries.push({
            user_id: userId,
            first_name: userInfo.first_name,
            last_name: userInfo.last_name,
            missing_date: dateStr,
            day_of_week: dayName,
            expected_start: daySchedule.expected_start_time,
            expected_end: daySchedule.expected_end_time
          });
        }
      }
      
      // Move to next day with safe increment
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      iterations++;
    }
    
    clearTimeout(timeout);
    console.log(`[MISSING] Complete! Found ${missingEntries.length} missing entries in ${iterations} iterations (${Date.now() - startTime}ms)`);
    
    res.json(missingEntries);
    
  } catch (error) {
    clearTimeout(timeout);
    console.error('Error fetching missing entries:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to fetch missing entries',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

export default router;