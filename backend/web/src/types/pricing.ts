// File Clean up Finished: Nov 14, 2025
// Changes (Phase 1):
//   - Removed dead session management types (EstimationSession, EstimateDraft, etc.)
//   - Removed dead calculation types (CalculationInput, CalculationResult, CalculationBreakdown)
//   - Removed dead validation types (ValidationResult, ValidationError, ValidationWarning)
//   - Removed dead conflict detection types (SaveConflict)
//   - Removed category-specific calculation input types (no longer used in backend)
//   - Removed multiplier/discount types (were for old session system)
//
// Changes (Phase 2 - Nov 14, 2025):
//   - Removed RateQueryResult (was only used by removed getSpecificRate method)
//
// Note: Category-specific calculation types now live in frontend calculation engine
//
// =====================================================
// PRICING TYPES - Rate Lookup System
// =====================================================

// This file is intentionally minimal - pricing data types are defined in:
// - Frontend: /frontend/web/src/services/pricingDataResource.ts
// - Backend queries return generic RowDataPacket[] from mysql2
