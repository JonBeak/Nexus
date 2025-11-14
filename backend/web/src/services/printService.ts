// File Clean up Finished: Nov 14, 2025
/**
 * Print Service - Server-side PDF printing
 * Handles printing Order Forms directly to local/network printers using CUPS
 *
 * Cleanup Summary (Nov 14, 2025):
 * - Utility service for CUPS printer integration
 * - All static methods - appropriate for utility functionality
 * - Proper error handling and logging throughout
 * - Well-documented with clear method signatures
 * - Actively used by /api/print endpoints
 * - No cleanup needed - file follows all best practices
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface PrintOptions {
  printerName?: string;  // Specific printer name (optional, uses default if not provided)
  copies?: number;        // Number of copies
  fitToPage?: boolean;    // Scale to fit page
  orientation?: 'portrait' | 'landscape';
  mediaSize?: string;     // e.g., 'Letter', 'A4'
}

export class PrintService {
  /**
   * Get list of available printers
   */
  static async getAvailablePrinters(): Promise<Array<{ name: string; isDefault: boolean; status: string }>> {
    try {
      const { stdout } = await execAsync('lpstat -p -d');
      const printers: Array<{ name: string; isDefault: boolean; status: string }> = [];

      // Parse printer list
      const lines = stdout.split('\n');
      let defaultPrinter = '';

      // Find default printer
      const defaultLine = lines.find(line => line.startsWith('system default destination:'));
      if (defaultLine) {
        defaultPrinter = defaultLine.split(':')[1]?.trim() || '';
      }

      // Parse printer status lines
      for (const line of lines) {
        if (line.startsWith('printer ')) {
          const match = line.match(/printer\s+(\S+)\s+(.+)/);
          if (match) {
            const printerName = match[1];
            const status = match[2];
            printers.push({
              name: printerName,
              isDefault: printerName === defaultPrinter,
              status: status
            });
          }
        }
      }

      return printers;
    } catch (error) {
      console.error('Error getting printers:', error);
      throw new Error('Failed to get available printers. Ensure CUPS is installed and configured.');
    }
  }

  /**
   * Print a PDF file to a printer
   */
  static async printPDF(pdfPath: string, options: PrintOptions = {}): Promise<{ success: boolean; message: string; jobId?: string }> {
    // Verify PDF exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Build lp command with options
    const lpOptions: string[] = [];

    // Printer name
    if (options.printerName) {
      lpOptions.push(`-d "${options.printerName}"`);
    }

    // Number of copies
    if (options.copies && options.copies > 1) {
      lpOptions.push(`-n ${options.copies}`);
    }

    // Fit to page (scale)
    if (options.fitToPage === false) {
      // Print at actual size (no scaling) - multiple options for maximum compatibility
      lpOptions.push('-o fit-to-page=false');
      lpOptions.push('-o scaling=100');
      lpOptions.push('-o natural-scaling=100');
      lpOptions.push('-o position=center');  // Center on page without scaling
    } else {
      // Fit to page (default browser-like behavior)
      lpOptions.push('-o fit-to-page=true');
    }

    // Orientation
    if (options.orientation) {
      lpOptions.push(`-o orientation-requested=${options.orientation === 'landscape' ? '4' : '3'}`);
    }

    // Media size
    if (options.mediaSize) {
      lpOptions.push(`-o media=${options.mediaSize}`);
    }

    // Additional options for quality
    lpOptions.push('-o print-quality=5'); // Highest quality

    // Build full command
    const command = `lp ${lpOptions.join(' ')} "${pdfPath}"`;

    console.log(`[Print Service] Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command);

      // Extract job ID from output (format: "request id is PrinterName-JobID")
      const jobIdMatch = stdout.match(/request id is\s+(.+)/);
      const jobId = jobIdMatch ? jobIdMatch[1].trim() : undefined;

      console.log(`[Print Service] ✓ Print job submitted: ${jobId || 'unknown'}`);

      return {
        success: true,
        message: `Print job submitted successfully${jobId ? `: ${jobId}` : ''}`,
        jobId
      };
    } catch (error: any) {
      console.error('[Print Service] Print failed:', error);
      throw new Error(`Print failed: ${error.message}`);
    }
  }

  /**
   * Print Order Form (Master) with custom settings
   */
  static async printOrderFormMaster(
    pdfPath: string,
    printerName?: string
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    return this.printPDF(pdfPath, {
      printerName,
      fitToPage: true,          // Scale to fit page
      orientation: 'landscape', // Order forms are landscape
      mediaSize: 'Letter',      // Letter size (11" x 8.5" landscape)
      copies: 1
    });
  }

  /**
   * Cancel a print job
   */
  static async cancelPrintJob(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      await execAsync(`cancel ${jobId}`);
      return {
        success: true,
        message: `Print job ${jobId} cancelled successfully`
      };
    } catch (error: any) {
      console.error('[Print Service] Cancel failed:', error);
      throw new Error(`Failed to cancel print job: ${error.message}`);
    }
  }

  /**
   * Get print job status
   */
  static async getPrintJobStatus(jobId: string): Promise<{ status: string; details: string }> {
    try {
      const { stdout } = await execAsync(`lpstat -o ${jobId}`);
      return {
        status: 'active',
        details: stdout.trim()
      };
    } catch (error: any) {
      // Job not found likely means it completed or was cancelled
      return {
        status: 'completed',
        details: 'Job not in queue (completed or cancelled)'
      };
    }
  }
}
