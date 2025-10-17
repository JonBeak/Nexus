/**
 * Shared Query Builder for Time Entries
 * Eliminates duplicate query building logic between timeEntries and timeExporting routes
 * Extracted from timeEntries.ts and timeExporting.ts (80+ lines of duplication)
 */

export interface TimeEntryFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  users?: string;
  group?: string;
  search?: string;
  quickFilter?: string;
}

export interface QueryResult {
  sql: string;
  params: any[];
}

export class SharedQueryBuilder {
  /**
   * Build complete time entries query with filters
   * @param filters - Filter parameters
   * @param forExport - If true, returns export-optimized columns
   * @returns SQL query and parameters
   */
  static buildTimeEntriesQuery(filters: TimeEntryFilters, forExport: boolean = false): QueryResult {
    // Base query - different column selection for export vs list view
    let sql = forExport
      ? this._buildExportBaseQuery()
      : this._buildListBaseQuery();

    const params: any[] = [];

    // Build WHERE conditions
    const { conditions, conditionParams } = this.buildFilterConditions(filters);

    // Add conditions to SQL
    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
      params.push(...conditionParams);
    }

    // Add ORDER BY
    sql += ' ORDER BY te.clock_in DESC';

    return { sql, params };
  }

  /**
   * Build filter conditions for WHERE clause
   * @param filters - Filter parameters
   * @returns Array of condition strings and parameters
   */
  static buildFilterConditions(filters: TimeEntryFilters): {
    conditions: string[];
    conditionParams: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    // Date range filters
    this.applyDateRange(conditions, params, filters);

    // Status filter
    this.applyStatusFilter(conditions, params, filters);

    // Group/User filter
    this.applyGroupFilter(conditions, params, filters);

    // Search filter
    this.applySearchFilter(conditions, params, filters);

    // Quick filter
    this.applyQuickFilter(conditions, params, filters);

    return { conditions, conditionParams: params };
  }

  /**
   * Apply date range filters
   */
  static applyDateRange(conditions: string[], params: any[], filters: TimeEntryFilters): void {
    if (filters.startDate) {
      conditions.push('DATE(te.clock_in) >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('DATE(te.clock_in) <= ?');
      params.push(filters.endDate);
    }
  }

  /**
   * Apply status filter
   */
  static applyStatusFilter(conditions: string[], params: any[], filters: TimeEntryFilters): void {
    if (filters.status && filters.status !== 'all') {
      conditions.push('te.status = ?');
      params.push(filters.status);
    }
  }

  /**
   * Apply group/user filter
   * Handles: 'all', 'Group A', 'Group B', or userId
   */
  static applyGroupFilter(conditions: string[], params: any[], filters: TimeEntryFilters): void {
    if (filters.group && filters.group !== '' && filters.group !== 'all') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        // Filter by user group
        conditions.push('u.user_group = ?');
        params.push(filters.group);
      } else {
        // Filter by specific user ID
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          conditions.push('te.user_id = ?');
          params.push(userId);
        }
      }
    } else if (filters.users && filters.users !== '') {
      // Legacy support for users parameter (comma-separated IDs)
      const userIds = filters.users.split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        conditions.push(`te.user_id IN (${userIds.map(() => '?').join(',')})`);
        params.push(...userIds);
      }
    }
  }

  /**
   * Apply search filter (name search)
   */
  static applySearchFilter(conditions: string[], params: any[], filters: TimeEntryFilters): void {
    if (filters.search && filters.search.trim() !== '') {
      conditions.push(
        '(u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, \' \', u.last_name) LIKE ?)'
      );
      const searchTerm = `%${filters.search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
  }

  /**
   * Apply quick filter (late, overtime, edited, missing)
   */
  static applyQuickFilter(conditions: string[], params: any[], filters: TimeEntryFilters): void {
    if (!filters.quickFilter || filters.quickFilter === 'all') {
      return;
    }

    switch (filters.quickFilter) {
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

  /**
   * Build base query for list view
   * Returns entry details with edit status
   */
  private static _buildListBaseQuery(): string {
    return `
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
  }

  /**
   * Build base query for export view
   * Returns flattened data optimized for CSV/PDF export
   */
  private static _buildExportBaseQuery(): string {
    return `
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
  }
}
