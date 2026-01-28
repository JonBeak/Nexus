/**
 * Calendar View Utilities
 * Date generation, business day calculations, and helper functions
 */

import { CalendarOrder, DateColumn, ProgressColor } from './types';

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a date string (YYYY-MM-DD) as local date, not UTC
 * This prevents timezone conversion issues where "2026-01-23" becomes Jan 22 in EST
 */
export function parseLocalDate(dateStr: string): Date {
  // Handle ISO strings with time component
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);  // month is 0-indexed
}

/**
 * Format date as 'YYYY-MM-DD' for map keys and comparisons
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get "effective today" for calendar display
 * Returns the next business day if:
 * - Today is a weekend or holiday, OR
 * - Past work hours (4 PM)
 * This ensures jobs due today appear only in Overdue after hours,
 * and viewing on weekends shows Monday as "Today"
 */
export function getEffectiveToday(holidays: Set<string>): Date {
  const WORK_END = 16; // 4:00 PM
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const todayKey = formatDateKey(today);
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const isHoliday = holidays.has(todayKey);

  // If today is weekend/holiday OR past work hours, find next business day
  if (isWeekend || isHoliday || currentHour >= WORK_END) {
    const nextDay = new Date(today);
    do {
      nextDay.setDate(nextDay.getDate() + 1);
      const dateKey = formatDateKey(nextDay);
      const dayIsWeekend = nextDay.getDay() === 0 || nextDay.getDay() === 6;
      const dayIsHoliday = holidays.has(dateKey);
      if (!dayIsWeekend && !dayIsHoliday) {
        return nextDay;
      }
    } while (true);
  }

  // Within business hours on a workday
  return today;
}

/**
 * Get display label for a date (Today, Tomorrow, or 'Dec 15')
 * Uses effectiveToday (which shifts to next business day after 4 PM)
 */
function getDisplayLabel(date: Date, effectiveToday: Date): string {
  const dateKey = formatDateKey(date);
  const effectiveTodayKey = formatDateKey(effectiveToday);

  if (dateKey === effectiveTodayKey) return 'Today';

  const tomorrow = new Date(effectiveToday);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === formatDateKey(tomorrow)) return 'Tomorrow';

  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Get day abbreviation (Mon, Tue, etc.)
 */
function getDayAbbreviation(date: Date): string {
  return DAY_ABBREVIATIONS[date.getDay()];
}

/**
 * Generate date columns for the calendar view
 *
 * @param startDate - The starting date for the visible range
 * @param totalDays - Total calendar days to scan (max 90)
 * @param visibleBusinessDays - Number of business day columns to show (default 10)
 * @param holidays - Set of holiday dates in 'YYYY-MM-DD' format
 * @param ordersByDate - Map of orders grouped by due date
 * @param effectiveToday - The "effective today" date (shifts to next business day after work hours)
 * @returns Array of DateColumn objects (only business days or days with orders)
 */
export function generateDateColumns(
  startDate: Date,
  totalDays: number,
  visibleBusinessDays: number,
  holidays: Set<string>,
  ordersByDate: Map<string, CalendarOrder[]>,
  effectiveToday: Date
): DateColumn[] {
  const columns: DateColumn[] = [];
  const effectiveTodayKey = formatDateKey(effectiveToday);

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  let businessDaysCount = 0;

  for (let i = 0; i < totalDays && businessDaysCount < visibleBusinessDays; i++) {
    const dateKey = formatDateKey(current);
    const isWeekend = current.getDay() === 0 || current.getDay() === 6;
    const isHoliday = holidays.has(dateKey);
    const orders = ordersByDate.get(dateKey) || [];

    // Include column for any weekday (including holidays)
    // Weekends are never shown - their orders are shifted to Friday
    // Holidays still appear as columns since they're workdays (orders due on them are shifted)
    if (!isWeekend) {
      columns.push({
        date: new Date(current),
        dateKey,
        displayLabel: getDisplayLabel(current, effectiveToday),
        dayOfWeek: getDayAbbreviation(current),
        isWeekend,
        isHoliday,
        isToday: dateKey === effectiveTodayKey,
        orders
      });

      // Count all weekdays toward the visible limit
      businessDaysCount++;
    }

    current.setDate(current.getDate() + 1);
  }

  return columns;
}

/**
 * Calculate work days left until due date (or days overdue if negative)
 * Replicates logic from OrdersTable.tsx for consistency
 */
export function calculateWorkDaysLeft(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  holidays: Set<string>
): number | null {
  if (!dueDate) return null;

  const WORK_START = 7.5;  // 7:30am
  const WORK_END = 16;     // 4pm
  const WORK_HOURS_PER_DAY = 8.5;

  const now = new Date();
  const dueDateTime = parseLocalDate(dueDate);

  if (dueTime) {
    const [h, m] = dueTime.split(':').map(Number);
    dueDateTime.setHours(h, m, 0, 0);
  } else {
    dueDateTime.setHours(16, 0, 0, 0);
  }

  const isPastDue = now >= dueDateTime;
  const startTime = isPastDue ? new Date(dueDateTime) : new Date(now);
  const endTime = isPastDue ? new Date(now) : new Date(dueDateTime);

  let workHours = 0;
  const current = new Date(startTime);
  current.setHours(0, 0, 0, 0);

  while (current <= endTime) {
    const dateStr = formatDateKey(current);
    const dayOfWeek = current.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      const isFirstDay = current.toDateString() === startTime.toDateString();
      const isLastDay = current.toDateString() === endTime.toDateString();

      let dayStart = WORK_START;
      let dayEnd = WORK_END;

      if (isFirstDay) {
        const startHour = startTime.getHours() + startTime.getMinutes() / 60;
        dayStart = Math.max(startHour, WORK_START);
        if (dayStart >= WORK_END) dayStart = WORK_END;
      }

      if (isLastDay) {
        const endHour = endTime.getHours() + endTime.getMinutes() / 60;
        dayEnd = Math.min(endHour, WORK_END);
        if (dayEnd <= WORK_START) dayEnd = WORK_START;
      }

      if (dayEnd > dayStart) {
        workHours += dayEnd - dayStart;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const workDays = workHours / WORK_HOURS_PER_DAY;
  const result = Math.round(workDays * 10) / 10;
  return isPastDue ? -result : result;
}

/**
 * Get progress color based on work days left and completion status
 * Blue (green) = completed OR not overdue
 * Red = overdue (incomplete, past due)
 * Darkred = has hard due time (highest visual priority)
 */
export function getProgressColor(
  workDaysLeft: number | null,
  progressPercent?: number,
  hasHardDueTime?: boolean,
  status?: string
): ProgressColor {
  // If job is complete, show blue (green) - but QC&Packing still has work to do
  if (progressPercent === 100 && status !== 'qc_packing') return 'green';

  // Hard due time takes priority (darker red styling)
  if (hasHardDueTime) return 'darkred';

  // Only show urgency colors for incomplete jobs
  if (workDaysLeft === null) return 'green';
  if (workDaysLeft < 0) return 'red';      // Overdue
  return 'green';                           // Not overdue
}

/**
 * Find previous business day (not weekend, not holiday)
 */
function findPreviousBusinessDay(date: Date, holidays: Set<string>): Date {
  const result = new Date(date);
  do {
    result.setDate(result.getDate() - 1);
    const dateKey = formatDateKey(result);
    const isWeekend = result.getDay() === 0 || result.getDay() === 6;
    const isHoliday = holidays.has(dateKey);
    if (!isWeekend && !isHoliday) {
      return result;
    }
  } while (true);
}

/**
 * Group orders by due date
 * Orders due on weekends or holidays are shifted to the previous business day
 */
export function groupOrdersByDate(
  orders: CalendarOrder[],
  holidays: Set<string>
): Map<string, CalendarOrder[]> {
  const grouped = new Map<string, CalendarOrder[]>();

  for (const order of orders) {
    if (!order.due_date) continue;

    // Get the due date (parse as local to avoid UTC timezone shift)
    const dueDate = parseLocalDate(order.due_date);

    // Check if it's a weekend or holiday
    let dateKey = formatDateKey(dueDate);
    const isWeekend = dueDate.getDay() === 0 || dueDate.getDay() === 6;
    const isHoliday = holidays.has(dateKey);

    // Shift weekends and holidays to previous business day
    if (isWeekend || isHoliday) {
      const shiftedDate = findPreviousBusinessDay(dueDate, holidays);
      dateKey = formatDateKey(shiftedDate);
    }

    const existing = grouped.get(dateKey) || [];
    existing.push(order);
    grouped.set(dateKey, existing);
  }

  // Sort orders within each day:
  // 1. Hard due time orders first (prioritized)
  // 2. Then by due date (earlier first)
  for (const [, dayOrders] of grouped) {
    dayOrders.sort((a, b) => {
      // Priority 1: Hard due time orders first
      const aHasHardDue = a.hard_due_date_time ? 1 : 0;
      const bHasHardDue = b.hard_due_date_time ? 1 : 0;
      if (aHasHardDue !== bHasHardDue) {
        return bHasHardDue - aHasHardDue; // Hard due orders first
      }

      // Priority 2: Sort by due date (earlier first)
      const aDate = a.due_date ? parseLocalDate(a.due_date).getTime() : Infinity;
      const bDate = b.due_date ? parseLocalDate(b.due_date).getTime() : Infinity;
      return aDate - bDate;
    });
  }

  return grouped;
}

/**
 * Navigate week - move forward or backward by business days
 */
export function navigateWeek(
  currentStart: Date,
  direction: 'prev' | 'next' | 'today',
  holidays: Set<string>,
  businessDaysToMove: number = 5
): Date {
  if (direction === 'today') {
    // Use effective today (shifts to next business day after work hours)
    return getEffectiveToday(holidays);
  }

  let moved = 0;
  const result = new Date(currentStart);
  result.setHours(0, 0, 0, 0);

  while (moved < businessDaysToMove) {
    result.setDate(result.getDate() + (direction === 'next' ? 1 : -1));
    const dateKey = formatDateKey(result);
    const isWeekend = result.getDay() === 0 || result.getDay() === 6;
    const isHoliday = holidays.has(dateKey);

    if (!isWeekend && !isHoliday) {
      moved++;
    }
  }

  return result;
}

/**
 * Calculate progress percentage from task counts
 */
export function calculateProgress(totalTasks: number | undefined, completedTasks: number | undefined): number {
  if (!totalTasks || totalTasks === 0) return 0;
  return Math.round(((completedTasks || 0) / totalTasks) * 100);
}
