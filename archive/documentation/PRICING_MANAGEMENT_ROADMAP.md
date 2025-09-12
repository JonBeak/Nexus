# Pricing Management System - Implementation Roadmap

## System Overview
A comprehensive pricing management system with audit trails, approval workflows, supplier cost monitoring, and real-time calculation integration with the job estimation system.

## Business Requirements Analysis

### User Access Levels:
- **Managers**: Request price changes, view pricing, use job estimation/builder
- **Owners**: Approve price changes, make direct changes, full system access
- **System**: Auto-alert on supplier cost changes, automated calculations

### Core Features Required:
1. **Pricing Tables Management** - All Excel lookup tables in database
2. **Audit Trail System** - Complete change history with user tracking
3. **Approval Workflows** - Manager requests, owner approvals
4. **Supplier Cost Monitoring** - Track supplier costs, alert on changes
5. **CSV Import/Export** - Bulk data management capabilities
6. **Frontend Interface** - Self-service pricing management
7. **Real-time Integration** - Connect to job builder calculations
8. **Archetype Pricing** - Average across suppliers for quotes

## Database Architecture Plan

### Phase 1: Foundation Tables
- **suppliers** - Master supplier directory
- **pricing_change_requests** - Approval workflow system
- **pricing_audit_log** - Universal audit trail
- **supplier_cost_alerts** - Cost change monitoring
- **pricing_system_config** - System configuration

### Phase 2: Channel Letter Pricing (Excel Integration)
- **channel_letter_types** - Type definitions, base rates, size constraints
- **led_types_pricing** - LED specs, costs per LED/foot, supplier tracking
- **transformer_types_pricing** - Wattage, costs, UL compatibility
- **ul_listing_pricing** - UL fees, base + per-set structure

### Phase 3: Additional Product Categories
Based on OLD_ESTIMATOR_INFORMATION.md Excel formulas:
- **vinyl_materials_pricing** - T, Tc, Perf rates
- **substrate_materials_pricing** - Cut types, pins, standoffs
- **backer_materials_pricing** - Aluminum/ACM by dimensions
- **push_thru_materials_pricing** - Substrate + finishing
- **blade_sign_pricing** - Circle/standard, frame costs
- **led_neon_pricing** - Base + length rates
- **painting_rates** - Face/return by sqft
- **wiring_rates** - DC/Wall plug costs
- **assembly_labor_rates** - Complexity-based labor
- **cutting_rates** - CNC rates by material
- **shipping_rates** - Base/multi/pallet/crate rates
- **material_cut_rates** - Raw material cutting

### Phase 4: Supporting Systems
- **supplier_item_costs** - Specific supplier pricing
- **pricing_calculation_cache** - Performance optimization
- **pricing_variance_alerts** - Price change notifications

## Frontend Interface Plan

### Admin Dashboard Structure:
```
/admin/pricing/
├── dashboard/           - Overview, alerts, recent changes
├── channel-letters/     - Channel letter pricing management
├── materials/          - All material pricing categories
├── labor/             - Labor and service rates
├── suppliers/         - Supplier management
├── approval-queue/    - Pending price change requests
├── audit-log/         - Complete change history
├── bulk-import/       - CSV import/export tools
├── alerts/           - Supplier cost change alerts
└── reports/          - Pricing analysis and trends
```

### Key Interface Features:
1. **Data Grid Components** - Sortable, filterable pricing tables
2. **Approval Workflow UI** - Request submission, review interface
3. **Import/Export Tools** - CSV templates, bulk operations
4. **Alert Management** - Supplier cost change notifications
5. **Audit Trail Viewer** - Historical change tracking
6. **Price Calculator Preview** - Test calculations in real-time

## Implementation Phases

### Phase 1: Database Foundation (Week 1)
**Deliverables:**
- [ ] Complete database schema creation
- [ ] Audit trigger system implementation
- [ ] Basic supplier management tables
- [ ] Approval workflow system
- [ ] System configuration framework

**Files to Create:**
- `/database/migrations/create_pricing_management_system.sql`
- `/backend/web/src/repositories/pricingRepository.ts`
- `/backend/web/src/services/pricingService.ts`
- `/backend/web/src/controllers/pricingController.ts`

### Phase 2: Channel Letter Pricing (Week 1-2)
**Deliverables:**
- [ ] Channel letter type management
- [ ] LED pricing with supplier tracking
- [ ] Transformer pricing system
- [ ] UL listing cost structure
- [ ] CSV import templates for channel letter data

**Excel Formula Integration:**
- Channel letter base calculations
- LED count and cost calculations
- Transformer requirements and costs
- UL listing fee structures
- Complexity multiplier handling

### Phase 3: Frontend Management Interface (Week 2-3)
**Deliverables:**
- [ ] Pricing management dashboard
- [ ] Channel letter pricing interface
- [ ] Supplier management interface
- [ ] Approval workflow interface
- [ ] Bulk import/export functionality
- [ ] Audit log viewer

**Components to Build:**
- `PricingDashboard.tsx`
- `ChannelLetterPricing.tsx`
- `SupplierManagement.tsx`
- `ApprovalQueue.tsx`
- `BulkImport.tsx`
- `AuditLogViewer.tsx`

### Phase 4: Additional Product Categories (Week 3-4)
**Deliverables:**
- [ ] Vinyl materials pricing
- [ ] Substrate and backer pricing
- [ ] Push-thru and blade sign pricing
- [ ] LED neon pricing
- [ ] Painting and labor rates
- [ ] Wiring and assembly costs
- [ ] Shipping rate management

### Phase 5: Supplier Integration & Alerts (Week 4-5)
**Deliverables:**
- [ ] Supplier cost tracking system
- [ ] Automated cost change alerts
- [ ] Supplier cost history
- [ ] Archetype price calculation engine
- [ ] Notification system integration

### Phase 6: Job Builder Integration (Week 5-6)
**Deliverables:**
- [ ] Pricing calculation service integration
- [ ] Real-time price updates in job builder
- [ ] Excel formula implementation in calculation engine
- [ ] Price variance detection
- [ ] Performance optimization with caching

## Excel Formula Integration Strategy

### Current Excel Formula Categories:
From OLD_ESTIMATOR_INFORMATION.md, we need to implement:

1. **Channel Letters**: Complex VLOOKUP chains for type pricing, LED calculations
2. **Vinyl**: T/Tc/Perf calculations with dimension parsing
3. **Substrate Cut**: XY dimensions, pins, standoffs, assembly costs
4. **Backer**: Aluminum/ACM calculations with multi-dimensional pricing
5. **Push Thru**: Material + box + cutting + assembly calculations
6. **Blade Sign**: Circle detection, frame costs, LED integration
7. **LED Neon**: Base + length calculations with welding costs
8. **Painting**: Face/return calculations by square footage
9. **Wiring**: DC/Wall plug costs + wire footage calculations
10. **Custom**: Flexible A/B/C calculation structure
11. **Multipliers**: Section and total multiplier applications
12. **Discounts**: Percentage and dollar amount discounts
13. **UL**: Base + sets pricing with complex fee structures
14. **Shipping**: Multi-tier shipping cost calculations
15. **Material Cut**: Raw material cutting rates

### Formula Implementation Approach:
- Convert Excel VLOOKUP to database queries
- Implement TEXTSPLIT logic for dimension parsing
- Create calculation services for each product category
- Maintain Excel formula accuracy while improving performance
- Add validation and error handling for edge cases

## Technical Architecture Decisions

### Database Design Principles:
- **Effective Dating**: All pricing has effective/expiry dates
- **Audit Everything**: Every change logged with user/timestamp
- **Supplier Separation**: Archetype prices separate from supplier costs
- **Flexible Configuration**: JSON fields for complex pricing rules
- **Performance Optimization**: Calculated price caching

### API Architecture:
```
/api/pricing/
├── channel-letters/     - Channel letter CRUD operations
├── materials/          - Material pricing endpoints
├── suppliers/         - Supplier management
├── approvals/         - Workflow management
├── import/            - Bulk import endpoints
├── calculate/         - Price calculation services
└── alerts/           - Cost change alerts
```

### Frontend Architecture:
- **React Components**: Reusable pricing management components
- **State Management**: Context for pricing data
- **Form Validation**: Client-side validation with server confirmation
- **Real-time Updates**: WebSocket for price change notifications
- **CSV Handling**: Client-side CSV parsing and validation

## Data Migration Strategy

### CSV Import Templates:
We'll create templates for each pricing category that match your Excel structure:

1. **channel_letter_types.csv**
2. **led_types_pricing.csv**
3. **transformer_types_pricing.csv**
4. **ul_listing_pricing.csv**
5. **vinyl_materials_pricing.csv**
6. **substrate_materials_pricing.csv**
7. **[additional categories].csv**

### Migration Process:
1. Create CSV templates with exact column headers
2. You format your Excel data to match templates
3. Bulk import through frontend interface
4. Validation and error handling for data quality
5. Audit trail records import operations

## Success Metrics

### Phase 1 Success:
- [ ] All database tables created successfully
- [ ] Audit trail system capturing all changes
- [ ] Approval workflow functional
- [ ] Basic CRUD operations working

### Phase 2 Success:
- [ ] Channel letter pricing fully implemented
- [ ] Excel formula accuracy maintained
- [ ] CSV import working for channel letter data
- [ ] Supplier cost tracking operational

### Phase 3 Success:
- [ ] Complete frontend interface functional
- [ ] Managers can request price changes
- [ ] Owners can approve/reject requests
- [ ] Audit log provides complete history

### Phase 4-6 Success:
- [ ] All Excel product categories implemented
- [ ] Job builder using real pricing data
- [ ] Supplier cost alerts working
- [ ] Performance meets production requirements

## Risk Mitigation

### Data Accuracy Risks:
- **Excel Formula Complexity**: Start with simple formulas, build up gradually
- **Data Migration Errors**: Extensive validation and testing with sample data
- **Price Calculation Bugs**: Comparison testing against Excel results

### System Performance Risks:
- **Database Query Performance**: Proper indexing and query optimization
- **Real-time Calculation Load**: Caching system for frequently accessed prices
- **UI Responsiveness**: Pagination and lazy loading for large datasets

### Business Process Risks:
- **Approval Workflow Adoption**: Clear user training and intuitive interface
- **Data Entry Errors**: Validation rules and confirmation workflows
- **System Reliability**: Comprehensive error handling and logging

## Timeline Summary (Updated Sept 1, 2025)
- **Week 1**: ✅ COMPLETED - Database foundation + Vinyl documentation
- **Week 2**: 🔄 IN PROGRESS - Complete product category documentation (Channel Letters, Substrate, Labor, UL, Shipping)
- **Week 3**: Database schema refinement based on all Excel formulas
- **Week 4**: Calculation engine development + API endpoints
- **Week 5**: Frontend pricing management interface
- **Week 6**: Job builder integration + testing

**Total Estimated Duration: 6 weeks**

## Next Steps (Updated)
1. ✅ Database schema and tables (COMPLETED)
2. ✅ CSV import templates (COMPLETED) 
3. 🔄 Document all Excel calculation formulas (IN PROGRESS - Vinyl done, Channel Letters next)
4. Build calculation engine that replicates Excel exactly
5. Develop frontend pricing interface
6. Integrate with job estimation system

**MAJOR PROGRESS**: Database foundation complete, vinyl calculations fully documented with all Excel formula logic captured.

This roadmap ensures we build a comprehensive, production-ready pricing management system that gives you complete control over your pricing data while maintaining full audit trails and approval workflows.