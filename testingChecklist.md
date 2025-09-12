# Testing Checklist - Sign Manufacturing System

## Core System Functionality
- [ ] Existing features still work (customers, time tracking, inventory, job estimation)
- [ ] Error cases handled gracefully
- [ ] Database transactions complete or rollback
- [ ] Frontend displays appropriate loading/error states
- [ ] Audit trail updated (where applicable)
- [ ] No console errors in browser
- [ ] API returns consistent response format

## Security & Access Control
- [ ] Role-based access control properly restricts features
- [ ] Authentication workflow functions correctly
- [ ] User permissions enforced across all modules

## Module-Specific Testing

### Time Tracking
- [ ] Time tracking approval workflow functions correctly
- [ ] Edit requests workflow working
- [ ] Schedule management accurate

### Inventory
- [ ] Inventory stock levels update properly
- [ ] Low stock alerts functional
- [ ] Reservation system working

### Customer Management
- [ ] Customer address management works across all modules
- [ ] Communication preferences respected
- [ ] Multi-address support functional

### Job Estimation & Versioning
- [ ] Job estimation calculations are accurate
- [ ] Job versioning workflow: Customer → Job → Version → Builder navigation
- [ ] Version numbers display correctly (v1, v2, v3, etc.)
- [ ] Draft estimates are editable, finalized estimates are read-only
- [ ] Job name uniqueness validation prevents conflicts
- [ ] Version duplication creates proper parent-child relationships
- [ ] Numeric values from database parse correctly (no .toFixed() errors)
- [ ] Status badges display appropriately (Draft, Sent, Approved, etc.)
- [ ] Edit lock system UI displays correctly (even though backend is placeholder)
- [ ] Multiple orders workflow: attempting to order 2nd estimate shows modal and creates new job with suffix
- [ ] New job inherits customer data and estimate is properly duplicated with ordered status
- [ ] Job numbers follow correct format: 2025001, 2025001B, 2025001C (no dashes)
- [ ] Status colors are consistent across all components (breadcrumb, actions, version manager)

### GridJobBuilderRefactored (Phase 1 - Dynamic Templates)
- [ ] Channel Letters product loads dynamic options from inventory tables
- [ ] Face Material options populated from face_materials table
- [ ] Return Color options populated from return_colors table
- [ ] LED Type options populated from leds table with CONCAT formatting
- [ ] Field validation working with DynamicTemplateService
- [ ] Template loading errors handled gracefully with fallback to static templates
- [ ] Async product selection working without blocking UI
- [ ] Template caching preventing unnecessary API calls

### GridJobBuilderRefactored (Phase 2 - Auto-Save + Validation) - ✅ IMPLEMENTED
- [ ] Auto-save functionality working with debounced saves
- [ ] Unsaved changes warning when leaving page
- [ ] Clear table confirmation dialog working
- [ ] ✅ Real-time field validation with red borders on invalid inputs using useGridValidation hook
- [ ] ✅ EstimateTable validation overlay warnings for invalid estimate states
- [ ] ✅ Real-time price calculations triggered on field changes with validation-aware calculations

### GridJobBuilderRefactored (Phase 5 - Comprehensive Validation Integration) - ✅ IMPLEMENTED - September 2025
- [ ] ✅ useGridValidation hook provides field-level validation state
- [ ] ✅ Red borders appear on fields with invalid inputs (quantity, price, complexity)
- [ ] ✅ Error tooltips display validation messages on hover
- [ ] ✅ Validation is purely informational - never blocks saves or functionality
- [ ] ✅ Database schema accepts VARCHAR(255) inputs for all numeric fields
- [ ] ✅ Pricing calculations skip invalid fields to prevent garbage math
- [ ] ✅ Infinite render loops eliminated through four-phase memoization fixes
- [ ] ✅ EstimateTable memoization prevents unnecessary re-renders
- [ ] ✅ Validation state isolated to prevent circular dependencies
- [ ] ✅ Performance improvements noticeable during heavy user interaction

## Data Integrity
- [ ] All database operations maintain consistency
- [ ] Circular reference protection working (estimate versioning)
- [ ] Audit trail captures all changes with proper user attribution
- [ ] Foreign key relationships maintained
- [ ] ✅ Validation system database compatibility - VARCHAR(255) fields accept all string inputs
- [ ] ✅ Invalid numeric inputs stored exactly as entered for complete audit trail
- [ ] ✅ Pricing calculations handle invalid inputs gracefully without crashing
- [ ] ✅ Validation state persists through auto-save operations

## Performance
- [ ] Page load times acceptable
- [ ] Large dataset operations complete in reasonable time
- [ ] API response times under 2 seconds for normal operations
- [ ] No memory leaks in long-running sessions

## Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)  
- [ ] Safari (latest)
- [ ] Mobile responsive design working

## Production Environment
- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 5173
- [ ] Database connection stable
- [ ] Log files being generated properly
- [ ] No port conflicts
- [ ] SSL/TLS certificates valid (if applicable)

## Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Database migrations tested
- [ ] Rollback plan in place
- [ ] Stakeholders notified
- [ ] Documentation updated
- [ ] Backup created