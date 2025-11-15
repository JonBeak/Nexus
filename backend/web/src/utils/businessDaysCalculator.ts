// File Clean up Finished: 2025-11-15
// No changes required - well-architected utility class, actively used, follows modern patterns

/**
 * Business Days Calculator Utility
 *
 * Calculates due dates and business days between dates,
 * excluding weekends (Saturday, Sunday) and company holidays.
 *
 * Leverages TimeAnalyticsRepository for holiday data.
 *
 * @module utils/businessDaysCalculator
 * @created 2025-11-06
 * @phase Phase 1.5.a.5 - Approve Estimate Modal Enhancements
 */

import { TimeAnalyticsRepository } from '../repositories/timeManagement/TimeAnalyticsRepository';

export class BusinessDaysCalculator {
  /**
   * Calculate target date by adding business days (excluding weekends and holidays)
   *
   * @param startDate - Starting date (e.g., today)
   * @param businessDays - Number of business days to add
   * @returns Target date after adding business days
   *
   * @example
   * const today = new Date('2025-11-06'); // Wednesday
   * const dueDate = await BusinessDaysCalculator.calculateDueDate(today, 10);
   * // Returns: 2025-11-20 (Thursday) - skipped 2 weekends (4 days)
   */
  static async calculateDueDate(startDate: Date, businessDays: number): Promise<Date> {
    if (businessDays <= 0) {
      return new Date(startDate);
    }

    // Calculate buffer for holiday lookup (businessDays * 2 + 30 days)
    // Assumes ~40% weekend/holiday rate
    const endBuffer = new Date(startDate);
    endBuffer.setDate(endBuffer.getDate() + (businessDays * 2 + 30));

    // Fetch company holidays for date range
    const holidays = await TimeAnalyticsRepository.getHolidaysInRange({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endBuffer)
    });

    // Convert holidays to Set for O(1) lookup
    const holidaySet = new Set(
      holidays.map(h => this.formatDate(new Date(h.holiday_date)))
    );

    // Add business days
    let currentDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);

      // Skip weekends
      if (this.isWeekend(currentDate)) {
        continue;
      }

      // Skip holidays
      if (this.isHoliday(currentDate, holidaySet)) {
        continue;
      }

      // This is a valid business day
      daysAdded++;
    }

    return currentDate;
  }

  /**
   * Calculate number of business days between two dates (inclusive of start, exclusive of end)
   *
   * @param startDate - Starting date
   * @param endDate - Ending date
   * @returns Number of business days between dates
   *
   * @example
   * const start = new Date('2025-11-06'); // Wednesday
   * const end = new Date('2025-11-20');   // Thursday
   * const days = await BusinessDaysCalculator.calculateBusinessDaysBetween(start, end);
   * // Returns: 10 (excluded 2 weekends = 4 days)
   */
  static async calculateBusinessDaysBetween(startDate: Date, endDate: Date): Promise<number> {
    // If end is before start, return 0
    if (endDate < startDate) {
      return 0;
    }

    // Fetch holidays for date range
    const holidays = await TimeAnalyticsRepository.getHolidaysInRange({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    });

    // Convert holidays to Set for O(1) lookup
    const holidaySet = new Set(
      holidays.map(h => this.formatDate(new Date(h.holiday_date)))
    );

    // Count business days
    let businessDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      // Check if this is a business day
      if (!this.isWeekend(currentDate) && !this.isHoliday(currentDate, holidaySet)) {
        businessDays++;
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * Check if date is a weekend (Saturday or Sunday)
   *
   * @param date - Date to check
   * @returns True if weekend, false otherwise
   */
  static isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
  }

  /**
   * Check if date is a company holiday
   *
   * @param date - Date to check
   * @param holidaySet - Set of holiday dates in YYYY-MM-DD format
   * @returns True if holiday, false otherwise
   */
  static isHoliday(date: Date, holidaySet: Set<string>): boolean {
    return holidaySet.has(this.formatDate(date));
  }

  /**
   * Format date as YYYY-MM-DD
   *
   * @param date - Date to format
   * @returns Formatted date string
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get next business day (skips weekends and holidays)
   *
   * @param startDate - Starting date
   * @returns Next business day
   *
   * @example
   * const friday = new Date('2025-11-07');
   * const nextBusinessDay = await BusinessDaysCalculator.getNextBusinessDay(friday);
   * // Returns: 2025-11-10 (Monday)
   */
  static async getNextBusinessDay(startDate: Date): Promise<Date> {
    return this.calculateDueDate(startDate, 1);
  }

  /**
   * Check if a specific date is a business day
   *
   * @param date - Date to check
   * @returns True if business day, false if weekend or holiday
   */
  static async isBusinessDay(date: Date): Promise<boolean> {
    // Check weekend first (no DB query needed)
    if (this.isWeekend(date)) {
      return false;
    }

    // Check holidays
    const holidays = await TimeAnalyticsRepository.getHolidaysInRange({
      startDate: this.formatDate(date),
      endDate: this.formatDate(date)
    });

    return holidays.length === 0;
  }
}
