// =====================================================
// ESTIMATION SESSION SERVICE - User-Isolated Draft Management
// =====================================================

import { 
  EstimationSession, 
  EstimateDraft, 
  SaveConflict, 
  CalculationInput,
  CalculationResult,
  ValidationResult 
} from '../types/pricing';
import { PricingCalculationEngine } from './pricingCalculationEngine';
import { RateLookupService } from './rateLookupService';
import { JobEstimationRepository } from '../repositories/jobEstimationRepository';
import { query } from '../config/database';

export class EstimationSessionService {
  private rateLookupService: RateLookupService;
  private jobRepository: JobEstimationRepository;
  
  // In-memory session cache (in production, use Redis)
  private static sessionCache = new Map<string, EstimationSession>();
  
  constructor() {
    this.rateLookupService = new RateLookupService();
    this.jobRepository = new JobEstimationRepository();
  }
  
  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================
  
  /**
   * Create new estimation session for user
   * Each user can have multiple concurrent sessions
   */
  async createSession(userId: number, estimateId?: number): Promise<EstimationSession> {
    const sessionId = this.generateSessionId(userId);
    
    let draftData: EstimateDraft;
    
    if (estimateId) {
      // Load existing estimate into draft mode
      const existingEstimate = await this.jobRepository.getEstimateById(estimateId);
      draftData = await this.convertEstimateToDraft(existingEstimate);
    } else {
      // Create new draft
      draftData = this.createEmptyDraft();
    }
    
    const session: EstimationSession = {
      sessionId,
      userId,
      estimateId,
      draftData,
      lastModified: new Date(),
      isActive: true
    };
    
    EstimationSessionService.sessionCache.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Get active session for user
   */
  getSession(sessionId: string, userId: number): EstimationSession | null {
    const session = EstimationSessionService.sessionCache.get(sessionId);
    
    if (!session || session.userId !== userId || !session.isActive) {
      return null;
    }
    
    return session;
  }
  
  /**
   * Update session draft data
   */
  updateSession(sessionId: string, userId: number, draftData: Partial<EstimateDraft>): EstimationSession {
    const session = this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    session.draftData = { ...session.draftData, ...draftData };
    session.lastModified = new Date();
    
    EstimationSessionService.sessionCache.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Close session and clean up
   */
  closeSession(sessionId: string, userId: number): void {
    const session = this.getSession(sessionId, userId);
    if (session) {
      session.isActive = false;
      EstimationSessionService.sessionCache.delete(sessionId);
    }
  }
  
  // =====================================================
  // REAL-TIME CALCULATIONS
  // =====================================================
  
  /**
   * Calculate item pricing in real-time (no database saves)
   * This is called as user types in the job builder
   */
  async calculateItemRealTime(
    sessionId: string, 
    userId: number, 
    calculationInput: CalculationInput
  ): Promise<CalculationResult> {
    const session = this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    // Get current rates (cached for performance)
    const rates = await this.rateLookupService.getCurrentRates(calculationInput.category);
    
    // Perform calculation using stateless engine
    const result = PricingCalculationEngine.calculateItem(calculationInput, rates);
    
    return result;
  }
  
  /**
   * Validate calculation inputs without calculating
   */
  async validateCalculationInput(
    sessionId: string,
    userId: number,
    calculationInput: CalculationInput
  ): Promise<ValidationResult> {
    const session = this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    // Validate input data structure
    const errors = [];
    const warnings = [];
    
    // Category-specific validation
    switch (calculationInput.category) {
      case 'vinyl':
        if (!calculationInput.inputData.vinyl_type) {
          errors.push({ field: 'vinyl_type', message: 'Vinyl type is required', code: 'REQUIRED' });
        }
        if (!calculationInput.inputData.dimensions) {
          errors.push({ field: 'dimensions', message: 'Dimensions are required', code: 'REQUIRED' });
        }
        break;
        
      case 'channel_letters':
        if (!calculationInput.inputData.letter_data) {
          errors.push({ field: 'letter_data', message: 'Letter analysis data is required', code: 'REQUIRED' });
        }
        if (!calculationInput.inputData.return_depth) {
          errors.push({ field: 'return_depth', message: 'Return depth is required', code: 'REQUIRED' });
        }
        break;
        
      // Add validation for other categories
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  // =====================================================
  // SAVE OPERATIONS WITH CONFLICT DETECTION
  // =====================================================
  
  /**
   * Save draft to database with conflict detection
   */
  async saveDraft(sessionId: string, userId: number): Promise<{ success: boolean, conflict?: SaveConflict }> {
    const session = this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    // Check for conflicts if updating existing estimate
    if (session.estimateId) {
      const conflict = await this.detectSaveConflicts(session);
      if (conflict) {
        return { success: false, conflict };
      }
    }
    
    try {
      let estimateId: number;
      
      if (session.estimateId) {
        // Update existing estimate
        await this.updateExistingEstimate(session);
        estimateId = session.estimateId;
      } else {
        // Create new estimate
        estimateId = await this.createNewEstimate(session, userId);
        session.estimateId = estimateId;
      }
      
      // Update session with successful save
      session.lastModified = new Date();
      EstimationSessionService.sessionCache.set(sessionId, session);
      
      // Log audit trail
      await this.logAuditTrail(userId, 'save_estimate', 'job_estimates', estimateId.toString(), {
        action: session.estimateId ? 'update' : 'create',
        groups: session.draftData.groups.length,
        items: session.draftData.groups.reduce((sum, group) => sum + group.items.length, 0),
        total: session.draftData.totals.finalTotal
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Error saving estimate:', error);
      throw new Error('Failed to save estimate');
    }
  }
  
  /**
   * Detect concurrent modification conflicts
   */
  private async detectSaveConflicts(session: EstimationSession): Promise<SaveConflict | null> {
    if (!session.estimateId) return null;
    
    try {
      const currentEstimate = await query(
        'SELECT updated_at, updated_by FROM job_estimates WHERE id = ?',
        [session.estimateId]
      ) as any[];
      
      if (currentEstimate.length === 0) {
        return {
          conflictType: 'estimate_deleted',
          conflictDetails: {
            lastServerModified: new Date(),
            currentUserModified: session.lastModified,
            conflictingChanges: ['Estimate was deleted by another user']
          },
          resolution: 'cancel'
        };
      }
      
      const serverLastModified = new Date(currentEstimate[0].updated_at);
      
      // Check if server was modified after our session started
      if (serverLastModified > session.lastModified) {
        // Get conflicting user info
        const conflictingUser = await query(
          'SELECT first_name, last_name FROM users WHERE user_id = ?',
          [currentEstimate[0].updated_by]
        ) as any[];
        
        return {
          conflictType: 'concurrent_modification',
          conflictDetails: {
            lastServerModified: serverLastModified,
            currentUserModified: session.lastModified,
            conflictingUser: conflictingUser.length > 0 ? 
              `${conflictingUser[0].first_name} ${conflictingUser[0].last_name}` : 'Unknown',
            conflictingChanges: ['Estimate was modified by another user']
          },
          resolution: 'merge' // Let user decide
        };
      }
      
      return null; // No conflicts
      
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return null;
    }
  }
  
  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================
  
  private generateSessionId(userId: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${userId}_${timestamp}_${random}`;
  }
  
  private createEmptyDraft(): EstimateDraft {
    return {
      estimateInfo: {
        estimate_name: '',
        notes: ''
      },
      groups: [],
      totals: {
        subtotal: 0,
        totalMultipliers: 0,
        totalDiscounts: 0,
        preTaxTotal: 0,
        taxRate: 0.13, // Default 13% tax
        taxAmount: 0,
        finalTotal: 0
      },
      multipliers: [],
      discounts: []
    };
  }
  
  private async convertEstimateToDraft(estimate: any): Promise<EstimateDraft> {
    // Convert database estimate format to draft format
    // This would map the existing data structure
    return this.createEmptyDraft(); // Placeholder
  }
  
  private async updateExistingEstimate(session: EstimationSession): Promise<void> {
    // Update database with draft data
    // This would convert draft format back to database format
  }
  
  private async createNewEstimate(session: EstimationSession, userId: number): Promise<number> {
    // Create new estimate in database
    // Return the new estimate ID
    return 1; // Placeholder
  }
  
  private async logAuditTrail(
    userId: number, 
    action: string, 
    entityType: string, 
    entityId: string, 
    details: any
  ): Promise<void> {
    await query(
      'INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, JSON.stringify(details)]
    );
  }
}