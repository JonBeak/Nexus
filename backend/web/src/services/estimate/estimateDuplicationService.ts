// File Clean up Finished: Nov 14, 2025 (Re-cleaned same day)
// File Clean up Finished: 2025-11-15 (Architectural cleanup)
// Changes:
//   - Migrated all 4 direct SQL queries to repository methods
//   - duplicateEstimateToNewJob(): Now uses getSourceEstimateForDuplication() + createDuplicateEstimateToNewJob()
//   - duplicateEstimate(): Now uses createDuplicateEstimate()
//   - duplicatePhase4Data(): Now uses duplicateEstimateItems()
//   - Removed unused RowDataPacket and ResultSetHeader imports
//   - All database access now properly delegated to repository layer
//   - Service layer only contains business logic and transaction orchestration

/**
 * Estimate Duplication Service
 *
 * Extracted from estimateService.ts during refactoring
 * Handles estimate duplication and copying logic
 *
 * Responsibilities:
 * - Estimate duplication within same job
 * - Cross-job estimate copying
 * - Grid-based data structure handling (Phase 4+)
 */
import { JobCodeGenerator } from '../../utils/jobCodeGenerator';
import { EstimateRepository } from '../../repositories/estimateRepository';
import { estimateLineDescriptionRepository } from '../../repositories/estimateLineDescriptionRepository';

export class EstimateDuplicationService {
  private estimateRepository = new EstimateRepository();

  // =============================================
  // ESTIMATE DUPLICATION METHODS
  // =============================================

  async duplicateEstimateToNewJob(
    connection: any,
    sourceEstimateId: number,
    targetJobId: number,
    targetVersion: number,
    userId: number
  ): Promise<number> {
    // Get source estimate data
    const source = await this.estimateRepository.getSourceEstimateForDuplication(
      connection,
      sourceEstimateId
    );

    if (!source) {
      throw new Error('Source estimate not found');
    }

    // Get current date for job code
    const dateStr = JobCodeGenerator.getCurrentDateString();

    // Get next sequence number for today (transaction-safe)
    const sequence = await this.estimateRepository.getNextSequenceForDate(connection, dateStr);

    // Generate new job code for the target version
    const newJobCode = JobCodeGenerator.generateVersionedJobCode(dateStr, sequence, targetVersion);

    // Create new estimate in target job
    const newEstimateId = await this.estimateRepository.createDuplicateEstimateToNewJob(
      connection,
      newJobCode,
      targetJobId,
      targetVersion,
      source.customer_id,
      source.subtotal,
      source.tax_rate,
      source.tax_amount,
      source.total_amount,
      source.notes,
      userId,
      source.high_standards
    );

    // Duplicate the estimate items and groups
    await this.duplicateEstimateData(connection, sourceEstimateId, newEstimateId);

    // NEW: Copy QB line descriptions if source is prepared (Phase 4.c)
    const sourceEstimate = await this.estimateRepository.getEstimateById(sourceEstimateId);
    if (sourceEstimate?.is_prepared) {
      const copiedCount = await estimateLineDescriptionRepository.copyDescriptions(
        sourceEstimateId,
        newEstimateId,
        connection
      );
      console.log(`✓ Copied ${copiedCount} QB descriptions to duplicated estimate`);
    }

    return newEstimateId;
  }

  async duplicateEstimate(
    connection: any,
    sourceEstimateId: number,
    jobId: number,
    version: number,
    jobCode: string,
    userId: number,
    notes?: string
  ): Promise<number> {
    try {
      // Validate source estimate exists
      if (!(await this.estimateRepository.estimateExists(sourceEstimateId))) {
        throw new Error('Source estimate not found');
      }

      // Create new estimate record
      const newEstimateId = await this.estimateRepository.createDuplicateEstimate(
        connection,
        jobCode,
        jobId,
        version,
        sourceEstimateId,
        notes || null,
        userId
      );

      // Duplicate the estimate items and groups
      await this.duplicateEstimateData(connection, sourceEstimateId, newEstimateId);

      // NEW: Copy QB line descriptions if source is prepared (Phase 4.c)
      const sourceEstimate = await this.estimateRepository.getEstimateById(sourceEstimateId);
      if (sourceEstimate?.is_prepared) {
        const copiedCount = await estimateLineDescriptionRepository.copyDescriptions(
          sourceEstimateId,
          newEstimateId,
          connection
        );
        console.log(`✓ Copied ${copiedCount} QB descriptions to duplicated estimate`);
      }

      return newEstimateId;
    } catch (error) {
      console.error('Error duplicating estimate:', error);
      throw new Error('Failed to duplicate estimate');
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  /**
   * Duplicates estimate data (items) from source to target estimate
   * Uses grid-based structure (Phase 4+)
   */
  private async duplicateEstimateData(connection: any, sourceEstimateId: number, newEstimateId: number): Promise<void> {
    try {
      // Duplicate grid data directly (no groups)
      await this.duplicatePhase4Data(connection, sourceEstimateId, newEstimateId);
    } catch (error) {
      console.error('Error duplicating estimate data:', error);
      throw new Error('Failed to duplicate estimate data');
    }
  }

  /**
   * Duplicates grid-based estimate data (direct item structure)
   */
  private async duplicatePhase4Data(connection: any, sourceEstimateId: number, newEstimateId: number): Promise<void> {
    await this.estimateRepository.duplicateEstimateItems(
      connection,
      sourceEstimateId,
      newEstimateId
    );
  }
}
