/**
 * Dashboard Panel Repository
 * Data access layer for customizable Orders Dashboard panels
 *
 * Created: 2025-12-17
 */

import { query, queryDynamic } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  DashboardPanelDefinition,
  UserDashboardPanel,
  UserPanelWithDefinition,
  PanelFilters,
  PanelOrderRow,
  CreatePanelRequest,
  UpdatePanelRequest
} from '../types/dashboardPanel';
import { DEPOSIT_TRACKING_STATUSES } from '../types/orders';

// =============================================================================
// Panel Definitions CRUD
// =============================================================================

/**
 * Get all panel definitions
 */
export async function getAllPanelDefinitions(includeInactive = false): Promise<DashboardPanelDefinition[]> {
  const sql = includeInactive
    ? 'SELECT * FROM dashboard_panel_definitions ORDER BY display_order'
    : 'SELECT * FROM dashboard_panel_definitions WHERE is_active = TRUE ORDER BY display_order';

  const rows = await query(sql) as RowDataPacket[];

  return rows.map(row => ({
    ...row,
    filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters
  })) as DashboardPanelDefinition[];
}

/**
 * Get panel definition by ID
 */
export async function getPanelDefinitionById(panelId: number): Promise<DashboardPanelDefinition | null> {
  const rows = await query(
    'SELECT * FROM dashboard_panel_definitions WHERE panel_id = ?',
    [panelId]
  ) as RowDataPacket[];

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters
  } as DashboardPanelDefinition;
}

/**
 * Get panel definition by key
 */
export async function getPanelDefinitionByKey(panelKey: string): Promise<DashboardPanelDefinition | null> {
  const rows = await query(
    'SELECT * FROM dashboard_panel_definitions WHERE panel_key = ?',
    [panelKey]
  ) as RowDataPacket[];

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters
  } as DashboardPanelDefinition;
}

/**
 * Create new panel definition
 */
export async function createPanelDefinition(
  data: CreatePanelRequest,
  userId: number
): Promise<number> {
  // Get max display order
  const maxOrderRows = await query(
    'SELECT MAX(display_order) as max_order FROM dashboard_panel_definitions'
  ) as RowDataPacket[];
  const nextOrder = (maxOrderRows[0]?.max_order ?? 0) + 1;

  const result = await query(
    `INSERT INTO dashboard_panel_definitions
     (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.panel_name,
      data.panel_key,
      data.description ?? null,
      data.icon_name ?? 'LayoutList',
      data.color_class ?? 'bg-blue-100 text-blue-800',
      nextOrder,
      data.max_rows ?? 10,
      JSON.stringify(data.filters),
      userId
    ]
  ) as ResultSetHeader;

  return result.insertId;
}

/**
 * Update panel definition
 */
export async function updatePanelDefinition(
  panelId: number,
  updates: UpdatePanelRequest
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.panel_name !== undefined) {
    fields.push('panel_name = ?');
    values.push(updates.panel_name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.icon_name !== undefined) {
    fields.push('icon_name = ?');
    values.push(updates.icon_name);
  }
  if (updates.color_class !== undefined) {
    fields.push('color_class = ?');
    values.push(updates.color_class);
  }
  if (updates.display_order !== undefined) {
    fields.push('display_order = ?');
    values.push(updates.display_order);
  }
  if (updates.max_rows !== undefined) {
    fields.push('max_rows = ?');
    values.push(updates.max_rows);
  }
  if (updates.filters !== undefined) {
    fields.push('filters = ?');
    values.push(JSON.stringify(updates.filters));
  }
  if (updates.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.is_active);
  }

  if (fields.length === 0) return;

  values.push(panelId);
  await query(`UPDATE dashboard_panel_definitions SET ${fields.join(', ')} WHERE panel_id = ?`, values);
}

/**
 * Soft delete panel definition (set is_active = false)
 */
export async function deactivatePanelDefinition(panelId: number): Promise<void> {
  await query(
    'UPDATE dashboard_panel_definitions SET is_active = FALSE WHERE panel_id = ?',
    [panelId]
  );
}

/**
 * Reorder panel definitions
 */
export async function reorderPanelDefinitions(
  orders: Array<{ panel_id: number; display_order: number }>
): Promise<void> {
  for (const item of orders) {
    await query(
      'UPDATE dashboard_panel_definitions SET display_order = ? WHERE panel_id = ?',
      [item.display_order, item.panel_id]
    );
  }
}

// =============================================================================
// User Panel Preferences
// =============================================================================

/**
 * Get user's selected panels with definition data
 */
export async function getUserPanels(userId: number): Promise<UserPanelWithDefinition[]> {
  const rows = await query(
    `SELECT
       up.id,
       up.user_id,
       up.panel_id,
       up.display_order,
       up.is_collapsed,
       up.created_at,
       up.updated_at,
       pd.panel_name,
       pd.panel_key,
       pd.description,
       pd.icon_name,
       pd.color_class,
       pd.max_rows,
       pd.filters,
       pd.is_system
     FROM user_dashboard_panels up
     JOIN dashboard_panel_definitions pd ON up.panel_id = pd.panel_id
     WHERE up.user_id = ? AND pd.is_active = TRUE
     ORDER BY up.display_order`,
    [userId]
  ) as RowDataPacket[];

  return rows.map(row => ({
    ...row,
    filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters
  })) as UserPanelWithDefinition[];
}

/**
 * Set user's panel selection (replaces existing)
 */
export async function setUserPanels(userId: number, panelIds: number[]): Promise<void> {
  // Delete existing selections
  await query('DELETE FROM user_dashboard_panels WHERE user_id = ?', [userId]);

  // Insert new selections
  for (let i = 0; i < panelIds.length; i++) {
    await query(
      `INSERT INTO user_dashboard_panels (user_id, panel_id, display_order)
       VALUES (?, ?, ?)`,
      [userId, panelIds[i], i]
    );
  }
}

/**
 * Reorder user's panels
 */
export async function reorderUserPanels(
  userId: number,
  orders: Array<{ panel_id: number; display_order: number }>
): Promise<void> {
  for (const item of orders) {
    await query(
      `UPDATE user_dashboard_panels
       SET display_order = ?
       WHERE user_id = ? AND panel_id = ?`,
      [item.display_order, userId, item.panel_id]
    );
  }
}

/**
 * Toggle panel collapsed state
 */
export async function togglePanelCollapsed(
  userId: number,
  panelId: number,
  collapsed: boolean
): Promise<void> {
  await query(
    `UPDATE user_dashboard_panels
     SET is_collapsed = ?
     WHERE user_id = ? AND panel_id = ?`,
    [collapsed, userId, panelId]
  );
}

/**
 * Add a single panel to user's selection
 */
export async function addUserPanel(userId: number, panelId: number): Promise<void> {
  // Get max display order for this user
  const maxOrderRows = await query(
    'SELECT MAX(display_order) as max_order FROM user_dashboard_panels WHERE user_id = ?',
    [userId]
  ) as RowDataPacket[];
  const nextOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

  await query(
    `INSERT IGNORE INTO user_dashboard_panels (user_id, panel_id, display_order)
     VALUES (?, ?, ?)`,
    [userId, panelId, nextOrder]
  );
}

/**
 * Remove a single panel from user's selection
 */
export async function removeUserPanel(userId: number, panelId: number): Promise<void> {
  await query(
    'DELETE FROM user_dashboard_panels WHERE user_id = ? AND panel_id = ?',
    [userId, panelId]
  );
}

// =============================================================================
// Panel Order Queries (Filter Query Builder)
// =============================================================================

/**
 * Get orders matching panel filters
 */
export async function getOrdersForPanel(
  filters: PanelFilters,
  limit: number | null | undefined = 10
): Promise<{ orders: PanelOrderRow[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  // Ensure limit is a valid number (handles null/undefined from database)
  const safeLimit = typeof limit === 'number' && limit > 0 ? limit : 10;

  // Ensure filters is a valid object
  const safeFilters = filters && typeof filters === 'object' ? filters : {};

  // Status filter (include)
  if (safeFilters.statuses && safeFilters.statuses.length > 0) {
    conditions.push(`o.status IN (${safeFilters.statuses.map(() => '?').join(', ')})`);
    params.push(...safeFilters.statuses);
  }

  // Status filter (exclude)
  if (safeFilters.excludeStatuses && safeFilters.excludeStatuses.length > 0) {
    conditions.push(`o.status NOT IN (${safeFilters.excludeStatuses.map(() => '?').join(', ')})`);
    params.push(...safeFilters.excludeStatuses);
  }

  // Status filter (exclude when invoice sent)
  // Excludes orders with these statuses only if invoice_sent_at IS NOT NULL
  if (safeFilters.excludeStatusesWhenSent && safeFilters.excludeStatusesWhenSent.length > 0) {
    conditions.push(`NOT (o.status IN (${safeFilters.excludeStatusesWhenSent.map(() => '?').join(', ')}) AND o.invoice_sent_at IS NOT NULL)`);
    params.push(...safeFilters.excludeStatusesWhenSent);
  }

  // Invoice status filter
  if (safeFilters.invoiceStatus) {
    switch (safeFilters.invoiceStatus) {
      case 'no_invoice':
        conditions.push('o.qb_invoice_id IS NULL');
        break;
      case 'needs_invoice':
        // Orders without invoice that SHOULD have one based on deposit_required and status:
        // - If deposit_required: needs invoice during deposit tracking stages
        // - If NOT deposit_required: needs invoice at shipping, pick_up, or awaiting_payment
        const depositTrackingList = DEPOSIT_TRACKING_STATUSES.map(s => `'${s}'`).join(', ');
        conditions.push(`o.qb_invoice_id IS NULL
          AND (
            (o.deposit_required = 1 AND o.status IN (${depositTrackingList}))
            OR
            (o.deposit_required = 0 AND o.status IN ('shipping', 'pick_up', 'awaiting_payment'))
          )`);
        break;
      case 'open_balance':
        conditions.push('o.qb_invoice_id IS NOT NULL AND (o.cached_balance IS NULL OR o.cached_balance > 0)');
        break;
      case 'fully_paid':
        conditions.push('o.qb_invoice_id IS NOT NULL AND o.cached_balance = 0');
        break;
      case 'deposit_required_not_paid':
        // Only show deposit required for orders past pending_confirmation
        const depositStatusList = DEPOSIT_TRACKING_STATUSES.map(s => `'${s}'`).join(', ');
        conditions.push(`o.deposit_required = 1
          AND (o.cached_balance IS NULL OR o.cached_balance >= o.cached_invoice_total)
          AND o.status IN (${depositStatusList})`);
        break;
    }
  }

  // Shipping type filter
  if (safeFilters.shippingType) {
    switch (safeFilters.shippingType) {
      case 'shipping':
        conditions.push('o.shipping_required = 1');
        break;
      case 'pick_up':
        conditions.push('o.shipping_required = 0');
        break;
      // 'both' - no filter needed
    }
  }

  // Due date range filter
  if (safeFilters.dueDateRange) {
    switch (safeFilters.dueDateRange) {
      case 'overdue':
        conditions.push('o.due_date IS NOT NULL AND o.due_date < CURDATE()');
        break;
      case 'today':
        conditions.push('o.due_date = CURDATE()');
        break;
      case 'this_week':
        // From today to end of current week (Sunday)
        conditions.push(`o.due_date IS NOT NULL AND o.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL (7 - DAYOFWEEK(CURDATE())) DAY)`);
        break;
      case 'next_7_days':
        conditions.push('o.due_date IS NOT NULL AND o.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)');
        break;
      case 'next_30_days':
        conditions.push('o.due_date IS NOT NULL AND o.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
        break;
    }
  }

  // Hard due time filter
  if (safeFilters.hasHardDueTime === true) {
    conditions.push('o.hard_due_date_time IS NOT NULL');
  } else if (safeFilters.hasHardDueTime === false) {
    conditions.push('o.hard_due_date_time IS NULL');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Determine if we need days_in_status calculation
  const needsDaysInStatus = safeFilters.showDaysInStatus || safeFilters.sortByDaysInStatus;
  // Determine if we need days_overdue calculation (for overdue panels)
  const needsDaysOverdue = safeFilters.dueDateRange === 'overdue';

  // Count total matching orders (use queryDynamic for dynamic WHERE clause)
  const countSql = `
    SELECT COUNT(*) as total
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    ${whereClause}
  `;
  const countResult = await queryDynamic(countSql, params) as RowDataPacket[];
  const total = countResult[0].total;

  // Build ORDER BY clause
  let orderByClause: string;
  if (safeFilters.sortByDaysInStatus) {
    orderByClause = 'ORDER BY days_in_status DESC, o.order_number DESC';
  } else {
    orderByClause = `ORDER BY
      CASE WHEN o.due_date IS NULL THEN 1 ELSE 0 END,
      o.due_date ASC,
      o.order_number DESC`;
  }

  // Get orders with optional days_in_status and days_overdue calculations
  const dataSql = `
    SELECT
      o.order_id,
      o.order_number,
      o.order_name,
      c.company_name AS customer_name,
      o.due_date,
      o.hard_due_date_time,
      o.status,
      o.qb_invoice_id,
      o.cached_balance,
      o.cached_invoice_total,
      o.deposit_required,
      o.shipping_required
      ${needsDaysInStatus ? `,
      DATEDIFF(CURDATE(), COALESCE(
        (SELECT MAX(h.changed_at) FROM order_status_history h WHERE h.order_id = o.order_id),
        o.created_at
      )) AS days_in_status` : ''}
      ${needsDaysOverdue ? `,
      DATEDIFF(CURDATE(), o.due_date) AS days_overdue` : ''}
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    ${whereClause}
    ${orderByClause}
    LIMIT ?
  `;

  // Use queryDynamic for dynamic WHERE clause
  const dataParams = [...params, safeLimit];
  const rows = await queryDynamic(dataSql, dataParams) as RowDataPacket[];

  const orders: PanelOrderRow[] = rows.map(row => {
    // Determine invoice status
    let invoiceStatus: PanelOrderRow['invoice_status'] = null;
    if (!row.qb_invoice_id) {
      invoiceStatus = 'no_invoice';
    } else if (row.cached_balance === null || row.cached_balance > 0) {
      if (row.deposit_required && (row.cached_balance === null || row.cached_balance >= row.cached_invoice_total)) {
        invoiceStatus = 'deposit_required_not_paid';
      } else {
        invoiceStatus = 'open_balance';
      }
    } else {
      invoiceStatus = 'fully_paid';
    }

    return {
      order_id: row.order_id,
      order_number: row.order_number,
      order_name: row.order_name,
      customer_name: row.customer_name,
      due_date: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      hard_due_date_time: row.hard_due_date_time || null,
      status: row.status,
      has_invoice: !!row.qb_invoice_id,
      invoice_status: invoiceStatus,
      shipping_required: row.shipping_required === 1,
      days_in_status: needsDaysInStatus ? (row.days_in_status ?? 0) : undefined,
      days_overdue: needsDaysOverdue ? (row.days_overdue ?? 0) : undefined
    };
  });

  return { orders, total };
}

// =============================================================================
// Audit Log Integration
// =============================================================================

/**
 * Log audit entry for dashboard panel changes
 */
export async function logPanelAudit(
  tableName: string,
  recordId: number,
  action: 'create' | 'update' | 'delete' | 'restore',
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  changeSummary: string,
  changedBy: number
): Promise<void> {
  await query(
    `INSERT INTO settings_audit_log
     (table_name, record_id, action, old_values, new_values, change_summary, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tableName,
      recordId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changeSummary,
      changedBy
    ]
  );
}
