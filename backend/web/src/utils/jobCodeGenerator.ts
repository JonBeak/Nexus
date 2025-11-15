// File Clean up Finished: 2025-11-15
// Changes:
//   - Migrated from timestamp-based (collision risk) to sequence-based (transaction-safe)
//   - Changed prefix from "CH" to "SH" (SignHouse)
//   - New format: SH-YYYYMMDD-XXX-vN (human-readable with dashes)
//   - Sequence now provided by EstimateRepository.getNextSequenceForDate()
//   - Guaranteed unique codes via database auto-increment logic
//   - Removed Date.now() collision risk (was using only last 3 digits)

/**
 * Job Code Generator Utility
 *
 * Generates unique job codes for estimate versions using a transaction-safe
 * auto-increment sequence per date.
 *
 * Format: SH-YYYYMMDD-SEQ-vVERSION
 * Example: SH-20251115-001-v1
 *
 * - SH: SignHouse prefix
 * - YYYYMMDD: Creation date
 * - SEQ: 3-digit sequence (001-999) from database
 * - vVERSION: Estimate version number
 *
 * Sequence is fetched from EstimateRepository.getNextSequenceForDate()
 * within the same transaction to prevent collisions.
 */
export class JobCodeGenerator {
  /**
   * Generate versioned job code for estimates
   *
   * @param dateStr - Date in YYYYMMDD format
   * @param sequence - Sequence number from database (1-999)
   * @param version - Estimate version number
   * @returns Formatted job code: SH-20251115-001-v1
   */
  static generateVersionedJobCode(
    dateStr: string,
    sequence: number,
    version: number
  ): string {
    try {
      // Validate inputs
      if (!dateStr || !/^\d{8}$/.test(dateStr)) {
        throw new Error('Invalid date format. Expected YYYYMMDD');
      }
      if (sequence < 1 || sequence > 999) {
        throw new Error('Sequence must be between 1 and 999');
      }
      if (version < 1) {
        throw new Error('Version must be positive');
      }

      // Format sequence with leading zeros (001, 002, etc.)
      const sequenceStr = sequence.toString().padStart(3, '0');

      // Generate code: SH-20251115-001-v1
      const jobCode = `SH-${dateStr}-${sequenceStr}-v${version}`;

      console.log(`Generated job code: ${jobCode} (date: ${dateStr}, seq: ${sequence}, ver: ${version})`);

      return jobCode;
    } catch (error) {
      console.error('Error generating job code:', error);
      throw error instanceof Error ? error : new Error('Failed to generate job code');
    }
  }

  /**
   * Get current date string in YYYYMMDD format
   * Utility method for consistent date formatting
   */
  static getCurrentDateString(): string {
    const today = new Date();
    return today.toISOString().slice(0, 10).replace(/-/g, '');
  }
}