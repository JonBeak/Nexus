// File Clean up Finished: Nov 13, 2025
/**
 * Cleanup Summary (Nov 13, 2025):
 * - Consolidated getBiWeeklyWageData() and getBiWeeklyWageDataWithOverrides() into single method
 * - Extracted DEFAULT_OVERTIME_THRESHOLD_HOURS constant (was hardcoded 8)
 * - Added documentation for provincial_tax (future feature, currently unused)
 * - Added JSDoc comments with parameter descriptions
 *
 * Further Cleanup Opportunities (deferred):
 * - Consider adding performance optimization for DATE() function in time_entries query
 * - Verify if PayrollRepository.getAllPayrollSettings() is used, remove if dead code
 * - Potential database migration to add comment on provincial_tax column
 */

/**
 * Payroll Calculation Service
 *
 * Business logic layer for payroll calculations and time processing
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - Complex payroll time calculations (rounding, breaks, overtime detection)
 * - Wage calculations (regular/overtime/holiday pay, vacation pay)
 * - Payroll adjustment processing with audit trails
 * - Business rule validation and enforcement
 *
 * Extracted from wages.ts during refactoring - all calculation logic preserved exactly
 */

import { PayrollRepository } from '../repositories/payrollRepository';

// =============================================
// CONSTANTS
// =============================================

/**
 * Default overtime threshold in hours per day
 * Used as fallback when overtime_threshold_daily setting is not configured
 * Standard Canadian employment law: 8 hours/day or 44 hours/week
 */
const DEFAULT_OVERTIME_THRESHOLD_HOURS = 8;
import {
  PayrollSettings,
  PayrollSettingsMap,
  TimeEntry,
  WorkSchedule,
  PayrollUser,
  UserWageData,
  PayrollCalculationResult,
  DeductionOverrideMap,
  PayrollUpdateChange,
  PayrollCalculationService as IPayrollCalculationService
} from '../types/payrollTypes';

export class PayrollCalculationService implements IPayrollCalculationService {
  
  constructor(private payrollRepository: PayrollRepository) {}
  
  // =============================================
  // PAYROLL SETTINGS MANAGEMENT
  // =============================================
  
  async getPayrollSettingsMap(): Promise<PayrollSettingsMap> {
    try {
      const settings = await this.payrollRepository.getPayrollSettings();
      const settingsMap: PayrollSettingsMap = {};
      
      settings.forEach(s => {
        settingsMap[s.setting_name] = parseFloat(s.setting_value.toString());
      });
      
      return settingsMap;
    } catch (error) {
      console.error('Service error creating settings map:', error);
      throw new Error('Failed to load payroll settings');
    }
  }
  
  async updatePayrollSettings(updates: Array<{ name: string; value: number }>): Promise<void> {
    try {
      for (const setting of updates) {
        await this.payrollRepository.updatePayrollSetting(setting.name, setting.value);
      }
    } catch (error) {
      console.error('Service error updating payroll settings:', error);
      throw new Error('Failed to update payroll settings');
    }
  }
  
  // =============================================
  // CORE PAYROLL CALCULATION LOGIC
  // =============================================
  
  /**
   * Calculate payroll adjustments for a time entry
   * Preserves exact logic from original wages.ts (lines 124-158)
   */
  async calculatePayrollAdjustments(
    entry: TimeEntry, 
    settings: PayrollSettingsMap, 
    schedule?: WorkSchedule
  ): Promise<Partial<TimeEntry>> {
    try {
      let payroll_clock_in = entry.actual_clock_in;
      let payroll_clock_out = entry.actual_clock_out;
      
      if (schedule && schedule.expected_start_time && schedule.expected_end_time) {
        const scheduled_start = schedule.expected_start_time;
        const scheduled_end = schedule.expected_end_time;
        
        // Clock in rounding: round up to scheduled start if early
        if (entry.actual_clock_in < scheduled_start) {
          payroll_clock_in = scheduled_start;
        }
        
        // Clock out rounding: round down if within threshold
        if (entry.actual_clock_out && scheduled_end) {
          const actualOutTime = new Date(`2000-01-01T${entry.actual_clock_out}`);
          const scheduledEndTime = new Date(`2000-01-01T${scheduled_end}`);
          const diffMinutes = (actualOutTime.getTime() - scheduledEndTime.getTime()) / (1000 * 60);
          
          if (diffMinutes > 0 && diffMinutes <= (settings.rounding_threshold_minutes || 0)) {
            payroll_clock_out = scheduled_end;
          }
        }
      }
      
      // Calculate payroll hours
      let payroll_total_hours = 0;
      if (payroll_clock_in && payroll_clock_out) {
        const start = new Date(`2000-01-01T${payroll_clock_in}`);
        const end = new Date(`2000-01-01T${payroll_clock_out}`);
        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const breakHours = (entry.break_minutes || 0) / 60;
        payroll_total_hours = Math.max(0, diffHours - breakHours);
      }
      
      return {
        payroll_clock_in,
        payroll_clock_out,
        payroll_break_minutes: entry.break_minutes || 0,
        payroll_total_hours,
        is_overtime: payroll_total_hours > (settings.overtime_threshold_daily || DEFAULT_OVERTIME_THRESHOLD_HOURS),
        is_holiday: !!entry.holiday_name
      };
    } catch (error) {
      console.error('Service error calculating payroll adjustments:', error);
      throw new Error('Failed to calculate payroll adjustments');
    }
  }
  
  /**
   * Process time entries and calculate payroll values
   * Preserves exact logic from original wages.ts (lines 122-201)
   */
  async processTimeEntries(
    entries: TimeEntry[], 
    settings: PayrollSettingsMap
  ): Promise<TimeEntry[]> {
    try {
      const processedEntries = await Promise.all(entries.map(async (entry: TimeEntry) => {
        // If payroll values not yet calculated, calculate them
        if (!entry.payroll_clock_in) {
          // Get user's schedule for this day
          const dayOfWeek = new Date(entry.entry_date + 'T12:00:00')
            .toLocaleDateString('en-US', { weekday: 'long' });
          
          const schedules = await this.payrollRepository.getUserSchedule(entry.user_id, dayOfWeek);
          const schedule = schedules.length > 0 ? schedules[0] : undefined;
          
          const adjustments = await this.calculatePayrollAdjustments(entry, settings, schedule);
          
          // Update the database with calculated payroll values
          await this.payrollRepository.updateTimeEntry(entry.entry_id, adjustments);
          
          // Update the entry object
          Object.assign(entry, adjustments);
        }
        
        return entry;
      }));
      
      return processedEntries;
    } catch (error) {
      console.error('Service error processing time entries:', error);
      throw new Error('Failed to process time entries');
    }
  }
  
  /**
   * Calculate wage data for users
   * Preserves exact logic from original wages.ts (lines 204-289)
   */
  async calculateWageData(
    users: PayrollUser[], 
    entries: TimeEntry[], 
    settings: PayrollSettingsMap, 
    overrides: DeductionOverrideMap
  ): Promise<UserWageData[]> {
    try {
      const userWageData = users.map(user => {
        const userEntries = entries.filter(e => e.user_id === user.user_id);
        
        // Create entries map by date
        const entriesMap: { [date: string]: TimeEntry } = {};
        userEntries.forEach(entry => {
          entriesMap[entry.entry_date] = entry;
        });
        
        // Calculate totals - preserving exact logic from original
        let regular_hours = 0;
        let overtime_hours = 0;
        let holiday_hours = 0;
        
        userEntries.forEach(entry => {
          const hours = parseFloat(entry.payroll_total_hours?.toString() || '0');
          
          if (entry.is_holiday) {
            holiday_hours += hours;
          } else if (hours > (settings.overtime_threshold_daily || DEFAULT_OVERTIME_THRESHOLD_HOURS)) {
            const overtimeThreshold = settings.overtime_threshold_daily || DEFAULT_OVERTIME_THRESHOLD_HOURS;
            regular_hours += overtimeThreshold;
            overtime_hours += hours - overtimeThreshold;
          } else {
            regular_hours += hours;
          }
        });
        
        // Calculate pay
        const hourlyRate = parseFloat(user.hourly_rate.toString()) || 0;
        const regular_pay = regular_hours * hourlyRate;
        const overtime_pay = overtime_hours * hourlyRate * (parseFloat(user.overtime_rate_multiplier.toString()) || 1.5);
        const holiday_pay = holiday_hours * hourlyRate * (parseFloat(user.holiday_rate_multiplier.toString()) || 1.5);
        const gross_pay = regular_pay + overtime_pay + holiday_pay;
        
        // Calculate vacation pay (on gross)
        const vacation_pay = gross_pay * (parseFloat(user.vacation_pay_percent.toString()) || parseFloat(settings.vacation_pay_default?.toString()) || 0) / 100;
        
        // Get deduction overrides for this user
        const userOverrides = overrides[user.user_id] || {};

        // Use overrides if available, otherwise default to 0
        const federal_tax = userOverrides.tax || 0;

        // FUTURE FEATURE: Provincial tax calculation
        // Currently set to 0 as business uses federal tax only
        // Database column and interfaces maintained for future provincial tax support
        // See: payroll_deduction_overrides.provincial_tax (cleanup note: Nov 13, 2025)
        const provincial_tax = 0;

        const ei_deduction = userOverrides.ei || 0;
        const cpp_deduction = userOverrides.cpp || 0;
        
        const total_deductions = federal_tax + provincial_tax + ei_deduction + cpp_deduction;
        const net_pay = gross_pay + vacation_pay - total_deductions;
        
        const totals: PayrollCalculationResult = {
          regular_hours,
          overtime_hours,
          holiday_hours,
          regular_pay,
          overtime_pay,
          holiday_pay,
          gross_pay,
          vacation_pay,
          federal_tax,
          provincial_tax,
          ei_deduction,
          cpp_deduction,
          total_deductions,
          net_pay
        };
        
        return {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          user_group: user.user_group,
          hourly_rate: user.hourly_rate,
          entries: entriesMap,
          totals
        } as UserWageData;
      });
      
      return userWageData;
    } catch (error) {
      console.error('Service error calculating wage data:', error);
      throw new Error('Failed to calculate wage data');
    }
  }
  
  /**
   * Process payroll changes with recalculation
   * Preserves exact logic from original wages.ts (lines 314-344)
   */
  async processPayrollChanges(changes: PayrollUpdateChange[]): Promise<void> {
    try {
      for (const change of changes) {
        // Recalculate hours - exact logic preserved
        let payroll_total_hours = 0;
        if (change.payroll_clock_in && change.payroll_clock_out) {
          const start = new Date(`2000-01-01T${change.payroll_clock_in}`);
          const end = new Date(`2000-01-01T${change.payroll_clock_out}`);
          const diffMs = end.getTime() - start.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          const breakHours = (change.payroll_break_minutes || 0) / 60;
          payroll_total_hours = Math.max(0, diffHours - breakHours);
        }
        
        await this.payrollRepository.updatePayrollEntry(change.entry_id, {
          payroll_clock_in: change.payroll_clock_in,
          payroll_clock_out: change.payroll_clock_out,
          payroll_break_minutes: change.payroll_break_minutes,
          payroll_total_hours
        });
      }
    } catch (error) {
      console.error('Service error processing payroll changes:', error);
      throw new Error('Failed to process payroll changes');
    }
  }
  
  // =============================================
  // BI-WEEKLY WAGE DATA CALCULATION
  // =============================================

  /**
   * Get comprehensive bi-weekly wage data
   * Orchestrates the complete payroll calculation workflow
   *
   * @param startDate - Pay period start date (YYYY-MM-DD)
   * @param endDate - Pay period end date (YYYY-MM-DD)
   * @param overrides - Optional deduction overrides (loaded by DeductionService)
   * @param group - Optional user group filter ('Group A', 'Group B', 'all', or user_id)
   *
   * Note: Consolidated from getBiWeeklyWageData() and getBiWeeklyWageDataWithOverrides()
   * to eliminate code duplication (cleanup Nov 13, 2025)
   */
  async getBiWeeklyWageData(
    startDate: string,
    endDate: string,
    overrides: DeductionOverrideMap = {},
    group?: string
  ): Promise<UserWageData[]> {
    try {
      // Get payroll settings
      const settings = await this.getPayrollSettingsMap();

      // Get users with wage info
      const users = await this.payrollRepository.getPayrollUsers(group);

      // Get time entries for the date range
      const entries = await this.payrollRepository.getTimeEntries(startDate, endDate);

      // Process payroll adjustments for each entry
      const processedEntries = await this.processTimeEntries(entries, settings);

      // Calculate wage data with provided overrides (empty object if none provided)
      const userWageData = await this.calculateWageData(users, processedEntries, settings, overrides);

      return userWageData;
    } catch (error) {
      console.error('Service error getting bi-weekly wage data:', error);
      throw new Error('Failed to get bi-weekly wage data');
    }
  }
}