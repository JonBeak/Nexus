/**
 * Job Code Generator Utility
 * 
 * Extracted from estimateVersioningService.ts during refactoring
 * Handles all job number and job code generation logic
 */

export class JobCodeGenerator {
  /**
   * Generate versioned job code for estimates
   * Format: CH{YYYYMMDD}{timestamp}v{version}
   */
  static generateVersionedJobCode(version: number): string {
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Simple counter for now to avoid complex async issues
      const timestamp = Date.now().toString().slice(-3);
      return `CH${dateStr}${timestamp}v${version}`;
    } catch (error) {
      console.error('Error generating job code:', error);
      throw new Error('Failed to generate job code');
    }
  }
}