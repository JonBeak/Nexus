// File Clean up Finished: 2025-11-15
// Analysis: No changes needed - well-architected service
// - Proper service layer implementation (utility service)
// - 108 lines (well under limit)
// - No database coupling (correct for utility)
// - All imports actively used
// - Proper error handling and logging
// - No migrations needed (no pool.execute, no dead code)
// - Successfully extracted from printController during recent refactoring

/**
 * PDF Merge Service
 * Handles merging multiple PDFs into a single document for batch operations
 *
 * Primary use case: Batch printing of order forms with specified quantities
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

interface PDFToMerge {
  path: string;
  copies: number;
  label: string;
}

interface MergeResult {
  mergedPath: string;
  skipped: string[];
}

export class PDFMergeService {
  /**
   * Merge multiple PDFs into a single document
   *
   * Each PDF can be included multiple times (copies parameter)
   * Files that don't exist will be skipped and reported
   *
   * @param pdfPaths - Array of PDFs to merge with copy counts
   * @returns Object with path to merged PDF and list of skipped files
   * @throws Error if PDF operations fail
   */
  async mergePDFs(pdfPaths: PDFToMerge[]): Promise<MergeResult> {
    const mergedPdf = await PDFDocument.create();
    const skipped: string[] = [];

    for (const { path: pdfPath, copies, label } of pdfPaths) {
      if (copies === 0) continue;

      console.log(`[PDF Merge] Adding ${copies}x ${label} from: ${pdfPath}`);

      try {
        // Check if file exists first
        const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);

        if (!fileExists) {
          console.warn(`[PDF Merge] ⚠️ Skipping ${label} - file not found: ${pdfPath}`);
          skipped.push(label);
          continue;
        }

        // Read the source PDF
        const pdfBytes = await fs.readFile(pdfPath);
        const sourcePdf = await PDFDocument.load(pdfBytes);

        // Copy all pages the specified number of times
        for (let i = 0; i < copies; i++) {
          const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
          console.log(`[PDF Merge] Added copy ${i + 1}/${copies} of ${label} (${sourcePdf.getPageCount()} pages)`);
        }
      } catch (error: any) {
        console.error(`[PDF Merge] ⚠️ Error adding ${label}:`, error.message);
        skipped.push(label);
      }
    }

    // Save merged PDF to temp file
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const tempPath = path.join(tempDir, `merged-order-forms-${timestamp}.pdf`);

    const mergedBytes = await mergedPdf.save();
    await fs.writeFile(tempPath, mergedBytes);

    const totalPages = mergedPdf.getPageCount();
    console.log(`[PDF Merge] ✅ Created merged PDF with ${totalPages} total pages: ${tempPath}`);

    return {
      mergedPath: tempPath,
      skipped
    };
  }

  /**
   * Clean up temporary merged PDF file
   * Safe to call even if file doesn't exist
   *
   * @param filePath - Path to temporary file to delete
   */
  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`[PDF Merge] Cleaned up temp file: ${filePath}`);
    } catch (error: any) {
      // Only warn if error is NOT "file not found"
      if (error.code !== 'ENOENT') {
        console.warn(`[PDF Merge] Failed to cleanup temp file ${filePath}:`, error.message);
      }
    }
  }
}

// Export singleton instance
export const pdfMergeService = new PDFMergeService();
