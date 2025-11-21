// File Clean up Finished: 2025-11-20
// Created during cleanup refactoring - extracted from timeExporting.ts route
/**
 * Time Exporting Controller
 * Handles HTTP requests for time entry exports (CSV, PDF)
 */

import { Response } from 'express';
import { TimeExportingService } from '../../services/timeTracking/TimeExportingService';
import { AuthRequest } from '../../types';
import { sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Export time entries in specified format
 * GET /api/time-management/export
 * Query params: startDate, endDate, status, users, group, search, quickFilter, format
 */
export const exportEntries = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, status, users, group, search, quickFilter, format } = req.query;

    // Build filters from query parameters
    const filters = {
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      users: users as string,
      group: group as string,
      search: search as string,
      quickFilter: quickFilter as string
    };

    // Handle different export formats
    if (format === 'csv') {
      const result = await TimeExportingService.exportToCsv(filters);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } else if (format === 'pdf') {
      const result = await TimeExportingService.exportToPdf(filters);
      res.json(result);
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or pdf' });
    }
  } catch (error: any) {
    console.error('Error exporting data:', error);
    sendErrorResponse(res, 'Failed to export data', 'INTERNAL_ERROR');
  }
};
