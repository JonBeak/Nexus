/**
 * Time Entries Routes
 * Refactored to use Service + Repository pattern (CLAUDE.md compliant)
 * Reduced from 445 lines to ~150 lines (66% reduction)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { TimeEntriesService } from '../services/timeManagement/TimeEntriesService';

const router = Router();

/**
 * Get time entries with filters
 * GET /time-management/entries
 */
router.get('/entries',
  authenticateToken,
  requirePermission('time_tracking.list'),
  async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate, status, users, group, search, quickFilter } = req.query;

    // Call service
    const result = await TimeEntriesService.getTimeEntries(
      user,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        status: status as string,
        users: users as string,
        group: group as string,
        search: search as string,
        quickFilter: quickFilter as string
      },
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json({ entries: result.data });
  } catch (error: any) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

/**
 * Create new time entry
 * POST /time-management/entries
 */
router.post('/entries',
  authenticateToken,
  requirePermission('time_tracking.create'),
  async (req, res) => {
  try {
    const user = (req as any).user;
    const { user_id, clock_in, clock_out, break_minutes, notes, status } = req.body;

    // Call service
    const result = await TimeEntriesService.createTimeEntry(
      user,
      {
        user_id,
        clock_in,
        clock_out,
        break_minutes,
        notes,
        status
      },
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json({
      message: 'Time entry created successfully',
      entry_id: result.data!.entry_id
    });
  } catch (error: any) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

/**
 * Update single time entry
 * PUT /time-management/entries/:entryId
 */
router.put('/entries/:entryId',
  authenticateToken,
  requirePermission('time_tracking.update'),
  async (req, res) => {
  try {
    const user = (req as any).user;
    const { entryId } = req.params;
    const { clock_in, clock_out, break_minutes } = req.body;

    // Call service
    const result = await TimeEntriesService.updateTimeEntry(
      user,
      Number(entryId),
      {
        clock_in,
        clock_out,
        break_minutes
      },
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json({ message: 'Entry updated successfully' });
  } catch (error: any) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

/**
 * Delete individual time entry
 * DELETE /time-management/entries/:entryId
 */
router.delete('/entries/:entryId',
  authenticateToken,
  requirePermission('time_tracking.update'),
  async (req, res) => {
  try {
    const user = (req as any).user;
    const { entryId } = req.params;

    // Call service
    const result = await TimeEntriesService.deleteTimeEntry(
      user,
      Number(entryId),
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

/**
 * Bulk edit time entries
 * PUT /time-management/bulk-edit
 */
router.put('/bulk-edit',
  authenticateToken,
  requirePermission('time_tracking.update'),
  async (req, res) => {
  try {
    const user = (req as any).user;
    const { entryIds, updates } = req.body;

    // Call service
    const result = await TimeEntriesService.bulkUpdateEntries(
      user,
      entryIds,
      updates,
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json({ message: 'Entries updated successfully' });
  } catch (error: any) {
    console.error('Error bulk editing entries:', error);
    res.status(500).json({ error: 'Failed to update entries' });
  }
});

/**
 * Bulk delete time entries
 * DELETE /time-management/bulk-delete
 */
router.delete('/bulk-delete',
  authenticateToken,
  requirePermission('time_tracking.update'),
  async (req, res) => {
  try {
    const user = (req as any).user;
    const { entryIds } = req.body;

    // Call service
    const result = await TimeEntriesService.bulkDeleteEntries(
      user,
      entryIds,
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json({ message: `${result.data!.count} entries deleted successfully` });
  } catch (error: any) {
    console.error('Error bulk deleting entries:', error);
    res.status(500).json({ error: 'Failed to delete entries' });
  }
});

/**
 * Get users list
 * GET /time-management/users
 */
router.get('/users',
  authenticateToken,
  requirePermission('time_tracking.list'),
  async (req, res) => {
  try {
    const user = (req as any).user;

    // Call service
    const result = await TimeEntriesService.getActiveUsers(user, {});

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
