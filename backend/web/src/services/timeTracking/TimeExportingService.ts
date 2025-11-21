// File Clean up Finished: 2025-11-20
// Created during cleanup refactoring - extracted from timeExporting.ts route
/**
 * Time Exporting Service
 * Handles export formatting for time entries (CSV, PDF)
 * Business logic layer for time entry exports
 */

import { TimeEntryRepository } from '../../repositories/timeTracking/TimeEntryRepository';
import { TimeEntryFilters } from '../../repositories/timeTracking/SharedQueryBuilder';

export interface ExportResult {
  content: string;
  contentType: string;
  filename: string;
}

export class TimeExportingService {
  /**
   * Export time entries as CSV
   * @param filters - Time entry filters
   * @returns CSV content with headers
   */
  static async exportToCsv(filters: TimeEntryFilters): Promise<ExportResult> {
    // Get export-optimized entries from repository
    const entries = await TimeEntryRepository.findEntries(filters, true);

    // Generate CSV headers
    const headers = 'Employee,Date,Clock In,Clock Out,Break (min),Total Hours,Status,Edited\n';

    // Generate CSV rows
    const csvData = entries
      .map((entry: any) => {
        return `"${entry.first_name} ${entry.last_name}","${entry.date}","${
          entry.clock_in_time || ''
        }","${entry.clock_out_time || ''}","${entry.break_minutes}","${entry.total_hours}","${
          entry.status
        }","${entry.edited}"`;
      })
      .join('\n');

    return {
      content: headers + csvData,
      contentType: 'text/csv',
      filename: 'time-entries.csv'
    };
  }

  /**
   * Export time entries as PDF (placeholder)
   * @param filters - Time entry filters
   * @returns PDF generation instructions
   */
  static async exportToPdf(filters: TimeEntryFilters): Promise<any> {
    // Get export-optimized entries from repository
    const entries = await TimeEntryRepository.findEntries(filters, true);

    // PDF generation not yet implemented - return data for client-side generation
    return {
      message: 'PDF export not yet implemented. Use CSV export for now.',
      data: entries
    };
  }
}
