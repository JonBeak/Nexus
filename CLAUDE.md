<SignHouseInstructions>
  <PrimaryDirective>
    We're building a production sign manufacturing system together. 
    You handle implementation while I guide architecture and business requirements.
  </PrimaryDirective>

  <ProductionSafetyRules>
    <Critical>THIS IS PRODUCTION - Every change affects live business operations</Critical>
    <AbsoluteRules>
      <Rule id="1">Port Configuration: Backend MUST stay on 3001, Frontend MUST stay on 5173</Rule>
      <Rule id="2">Backup Directory: NEVER modify files in /infrastructure/backups/</Rule>
      <Rule id="3">Path Convention: ALWAYS use absolute paths: /home/jon/Nexus/...</Rule>
      <Rule id="4">Code Size Limit: Maximum 500 lines per file - refactor before exceeding</Rule>
      <Rule id="5">Error Handling: Every database and file operation MUST include error handling</Rule>
      <Rule id="6">Pattern Consistency: ALWAYS examine existing code patterns before writing new code</Rule>
      <Rule id="7">CRITICAL GIT SAFETY: NEVER use "git checkout HEAD --" or any destructive git operations without creating backups first. User lost hours of work - always commit progress or create backups before any revert operations.</Rule>
    </AbsoluteRules>
  </ProductionSafetyRules>

  <MandatoryWorkflow>
    <ResearchPhase>
      <InitialResponse>Let me understand the existing codebase and plan the approach.</InitialResponse>
      <RequiredActions>
        <Action>Examine relevant files in /home/jon/Nexus/ for established patterns</Action>
        <Action>Map database schema for affected tables (SHOW CREATE TABLE)</Action>
        <Action>Identify all components that will be impacted</Action>
        <Action>Document inputs, outputs, and business logic</Action>
        <Action>Verify understanding of customer workflow implications</Action>
        <Action>Keep researching until you have complete confidence in both the problem and the solution</Action>
      </RequiredActions>
      <CompletionCriteria>Must have complete confidence in understanding the problem AND the solution before proceeding</CompletionCriteria>
    </ResearchPhase>

  <ProposalPhase>
      <Prerequisite>Only proceed after achieving complete confidence in the solution</Prerequisite>
      <ResponseFormat>Based on research, I recommend [solution]. This will modify [files] following [pattern]. Please confirm before I proceed.</ResponseFormat>
      <MustInclude>
        <Item>Files to be modified/created</Item>
        <Item>Database changes (if any)</Item>
        <Item>Impact on existing features</Item>
        <Item>File size assessment (will any exceed 500 lines?)</Item>
        <Item>Testing approach</Item>
      </MustInclude>
      <WaitFor>Explicit confirmation before proceeding</WaitFor>
    </ProposalPhase>

  <ImplementationPhase>
      <RefactoringTrigger>
        <Condition>If changes will exceed 500 lines</Condition>
        <Actions>
          <Action>Plan refactoring BEFORE starting</Action>
          <Action>Split into focused modules</Action>
          <Action>Create subdirectories for related functionality</Action>
          <Action>Extract reusable logic</Action>
        </Actions>
      </RefactoringTrigger>
      <DuringImplementation>
        <Requirement>Follow existing patterns exactly</Requirement>
        <Requirement>Include comprehensive error handling</Requirement>
        <Requirement>Add appropriate logging</Requirement>
        <Requirement>Maintain TypeScript type safety</Requirement>
      </DuringImplementation>
    </ImplementationPhase>

  <VerificationPhase>
      <Action>Test with real production data (read-only)</Action>
      <Action>Verify no regression in working features</Action>
      <Action>Check all error paths</Action>
      <Action>Confirm audit trail updates (where applicable)</Action>
    </VerificationPhase>
  </MandatoryWorkflow>

  <SystemArchitecture>
    <TechnologyStack>
      <Backend>
        <Technology>TypeScript/Node.js + Express</Technology>
        <Port>3001</Port>
        <Path>/backend/web/</Path>
      </Backend>
      <Frontend>
        <Technology>React + TypeScript + Vite</Technology>
        <Port>5173</Port>
        <Path>/frontend/web/</Path>
      </Frontend>
      <Database>
        <Technology>MySQL 8.0</Technology>
        <Connection>localhost:3306</Connection>
        <Name>sign_manufacturing</Name>
        <Driver>mysql2/promise with connection pooling</Driver>
      </Database>
      <Authentication>
        <Type>JWT Tokens</Type>
        <AccessToken>1 hour expiry</AccessToken>
        <RefreshToken>30 day expiry</RefreshToken>
      </Authentication>
    </TechnologyStack>

  <FileOrganization>
      <Root>/home/jon/Nexus/</Root>
      <Structure>
        <Directory path="backend/web/">
          <Subdirectory path="src/config/">database.ts - connection pool</Subdirectory>
          <Subdirectory path="src/controllers/">Request handlers</Subdirectory>
          <Subdirectory path="src/routes/">Express route definitions</Subdirectory>
          <Subdirectory path="src/services/">Business logic layer</Subdirectory>
          <Subdirectory path="src/middleware/">Auth, RBAC, validation</Subdirectory>
          <Subdirectory path="src/types/">TypeScript definitions</Subdirectory>
          <File path=".env">Database credentials</File>
          <File path="package.json">Backend dependencies</File>
        </Directory>
        <Directory path="frontend/web/">
          <Subdirectory path="src/components/">UI components by feature</Subdirectory>
          <Subdirectory path="src/services/">api.ts - Main API client | jobVersioningApi.ts - Dedicated versioning service</Subdirectory>
          <Subdirectory path="src/contexts/">AuthContext, etc.</Subdirectory>
          <Subdirectory path="src/types/">Frontend TypeScript types</Subdirectory>
          <File path="package.json">Frontend dependencies</File>
        </Directory>
        <Directory path="infrastructure/">
          <Subdirectory path="backups/">DO NOT MODIFY</Subdirectory>
          <Subdirectory path="scripts/">Server management</Subdirectory>
        </Directory>
        <Directory path="database/">
          <Subdirectory path="migrations/">Schema changes</Subdirectory>
        </Directory>
      </Structure>
    </FileOrganization>
  </SystemArchitecture>

  <ImplementedRoutes>
    <Route path="/login">Authentication with JWT refresh token system</Route>
    <Route path="/dashboard">Main dashboard with role-based feature access</Route>
    <Route path="/customers">Customer management with addresses and preferences - See Nexus_Customers.md</Route>
    <Route path="/time-management">Time tracking, approvals, scheduling (Manager+ only) - See Nexus_TimeManagement.md</Route>
    <Route path="/vinyl-inventory">Vinyl inventory management with bulk operations - See Nexus_Vinyls.md</Route>
    <Route path="/wages">Payroll and wage management (Owner only) - See Nexus_WagesManagement.md</Route>
    <Route path="/account-management">User account and RBAC management (Manager+ only) - See Nexus_AccountsManagement.md</Route>
    <Route path="/supply-chain">Supply chain and supplier management (Manager+ only) - See Nexus_SupplyChain.md</Route>
    <Route path="/job-estimation">Job estimation with complex product forms (Manager+ only) - See Nexus_JobEstimation.md</Route>
  </ImplementedRoutes>

  <WorkingFeatures>
    <Feature name="CustomerManagement">Full CRUD with multi-address support (644+ customers, communication prefs, history tracking)</Feature>
    <Feature name="TimeTracking">Complete time management system (44 entries, approvals, scheduling, edit requests with notifications)</Feature>
    <Feature name="VinylInventory">Comprehensive vinyl products management (512 inventory items, 190 products with bulk operations)</Feature>
    <Feature name="WageManagement">Full payroll system with wage calculations, deduction overrides, payment history</Feature>
    <Feature name="Authentication">JWT with automatic refresh, comprehensive RBAC (59 permissions, 132 role assignments, login tracking)</Feature>
    <Feature name="AuditSystem">Complete audit trail for all data changes (111+ tracked events)</Feature>
    <Feature name="TaxRules">Tax calculation system based on billing address (29 rules, 67 provinces)</Feature>
    <Feature name="JobEstimation">Currently in development. Major refactoring going on. Please check ArchitectureReference for more information</Feature>
    <Feature name="AccountManagement">User account system with role management, vacation tracking, schedule management</Feature>
    <Feature name="CompanyOperations">Holiday management, work schedules, company-wide settings</Feature>
  </WorkingFeatures>

  <FuturePriorities>
    <Priority order="4"><Feature name="SupplyChain">Supply chain management with suppliers, orders, cost tracking, low stock alerts</Feature></Priority>
    <Priority order="5">Estimation PDF export integration with persisted grid data</Priority>
    <Priority order="6">Material requirements calculation from grid data for order conversion</Priority>
    <Priority order="7">Supply chain integration for real-time material costs in pricing</Priority>
    <Priority order="8">Job tracking dashboard enhancement (Quote → Production → Shipped workflow)</Priority>
    <Priority order="9">QuickBooks integration for accounting sync</Priority>
  </FuturePriorities>


  <BusinessDomainRules>
    <Rule name="TaxCalculation">Based on billing address using tax_rules table with provincial tax rates</Rule>
    <Rule name="BusinessModel">Wholesale manufacturing for other sign companies (no permits/installation)</Rule>
    <Rule name="JobWorkflow">Quote → Approved → Order Form → Production → Shipped (with full status tracking)</Rule>
    <Rule name="TimeTracking">Employee time entries require manager approval, with edit request workflow</Rule>
    <Rule name="InventoryControl">Vinyl inventory with low stock alerts, supplier cost tracking, and reservation system</Rule>
    <Rule name="RoleBasedAccess">Comprehensive RBAC system with granular permissions and audit logging</Rule>
  </BusinessDomainRules>

  <CodeStandards>
    <Backend>
      <PatternLocation>/home/jon/Nexus/backend/web/src/controllers/</PatternLocation>
      <Example>
        <![CDATA[
import { pool } from '../config/database';
import { Request, Response } from 'express';

export const exampleController = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM table_name WHERE column = ?',
      [req.params.value]
    );
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database operation failed'
    });
  }
};
        ]]>
      </Example>
    </Backend>

  <Frontend>
      <PatternLocation>/home/jon/Nexus/frontend/web/src/components/</PatternLocation>
      <Example>
        <![CDATA[
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';

interface Props {
  // Always define proper TypeScript interfaces
}

export const ExampleComponent = ({ }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Always handle loading and error states
  
  return (
    // Component JSX
  );
};
        ]]>
      </Example>
    </Frontend>
  </CodeStandards>

  <RefactoringBestPractices>
    <Methodology>Deep-dive analysis → Plan creation → Backup → Implementation → Testing → Documentation</Methodology>
    <SafetyFirst>ALWAYS create backups before refactoring, maintain backward compatibility, zero breaking changes</SafetyFirst>
    <DRYPrinciple>Eliminate code duplication by sharing common configurations and consolidating identical methods</DRYPrinciple>
    <FileSize>Split files exceeding 500 lines while preserving all existing imports and functionality</FileSize>
    <SingleResponsibility>Separate concerns into focused, maintainable modules with clear boundaries</SingleResponsibility>
    <ExampleSuccess>Frontend API refactoring: 26% code reduction, eliminated duplication, improved maintainability</ExampleSuccess>
  </RefactoringBestPractices>

  <ArchitectureStandard>
    <EnhancedThreeLayer>
      <MandatoryPattern>
        Route → Controller → Service → Repository → Database
      </MandatoryPattern>
      
      <LayerResponsibilities>
        <Route>HTTP routing, middleware chains, authentication, permissions (15-25 lines per endpoint)</Route>
        <Controller>Request/response handling, data extraction, error formatting (20-40 lines per method, 300 lines max per file)</Controller>
        <Service>Business logic, validation, orchestration, calculations (50-200 lines per method, 500 lines max per file)</Service>
        <Repository>Database queries, data access, caching (20-60 lines per method, 300 lines max per file)</Repository>
      </LayerResponsibilities>
      
      <StrictRules>
        <Rule>Routes contain ONLY middleware chains - no business logic</Rule>
        <Rule>Controllers contain ONLY HTTP concerns - no database queries</Rule>
        <Rule>Services contain ALL business logic - no HTTP or database details</Rule>
        <Rule>Repositories contain ONLY data access - no business logic</Rule>
        <Rule>Each layer MUST stay within specified line limits</Rule>
        <Rule>All new features MUST follow this pattern</Rule>
        <Rule>All refactoring MUST migrate to this pattern</Rule>
      </StrictRules>
    </EnhancedThreeLayer>
  </ArchitectureStandard>

  <SystemAccess>
    <ServerManagement>
      <StartServers>/home/jon/Nexus/infrastructure/scripts/start-servers.sh</StartServers>
      <StopServers>/home/jon/Nexus/infrastructure/scripts/stop-servers.sh</StopServers>
      <CheckStatus>/home/jon/Nexus/infrastructure/scripts/status-servers.sh</CheckStatus>
      <ViewLogs>
        <Backend>tail -f /tmp/signhouse-backend.log</Backend>
        <Frontend>tail -f /tmp/signhouse-frontend.log</Frontend>
      </ViewLogs>
    </ServerManagement>

    <DatabaseAccess>
      <CheckStatus>systemctl status mysql</CheckStatus>
      <Credentials>/home/jon/Nexus/backend/web/.env</Credentials>
      <QuickConnect>mysql -u root -p sign_manufacturing</QuickConnect>
    </DatabaseAccess>

    <DemoUsers>
      <User role="manager">
        <Username>admin</Username>
        <Password>admin123</Password>
      </User>
      <User role="designer">
        <Username>designer</Username>
        <Password>design123</Password>
      </User>
      <User role="production_staff">
        <Username>staff</Username>
        <Password>staff123</Password>
      </User>
    </DemoUsers>
  </SystemAccess>

  <ResponsePatterns>
    <StartingTask>
      Let me understand the existing codebase and plan the approach. I'll examine [specific files] to understand the current patterns.
    </StartingTask>

    <AfterResearch>
      I found the established pattern in [file]. The approach involves [explanation]. This will require modifying [files].
    </AfterResearch>

    <ConfirmingConfidence>
      After thorough research, I'm confident that [solution description]. This approach will [benefits/outcomes].
    </ConfirmingConfidence>

    <BeforeImplementation>
      Based on my research, I recommend [solution]. This will:
      - Modify [files]
      - Follow the pattern from [reference file]
      - [Any risks or considerations]
      
      Please confirm before I proceed with implementation.
    </BeforeImplementation>

    <WhenUncertain>
      I found [issue/ambiguity]. Should I:
      - Option A: [description]
      - Option B: [description]
      
      Which approach aligns better with business requirements?
    </WhenUncertain>

    <RefactoringNeeded>
      This implementation will exceed 500 lines. I'll refactor it into:
      - module1.ts: [purpose, ~lines]
      - module2.ts: [purpose, ~lines]
      - module3.ts: [purpose, ~lines]
    </RefactoringNeeded>
  </ResponsePatterns>

  <DatabaseGuidelines>
    <BeforeChanges>
      <![CDATA[
-- Always check existing structure
SHOW CREATE TABLE table_name;
DESCRIBE table_name;

-- Check for dependencies
SELECT * FROM information_schema.KEY_COLUMN_USAGE 
WHERE REFERENCED_TABLE_NAME = 'table_name';

-- Test with sample data first
SELECT * FROM table_name LIMIT 10;
      ]]>
    </BeforeChanges>

    <ConnectionConfiguration>
      <Host>localhost:3306</Host>
      <Database>sign_manufacturing</Database>
      <CredentialsLocation>/home/jon/Nexus/backend/web/.env</CredentialsLocation>
      <PoolConfiguration>/backend/web/src/config/database.ts</PoolConfiguration>
    </ConnectionConfiguration>
  </DatabaseGuidelines>

  <QuickReference>
    <CriticalPaths>
      <Path name="DatabaseConfig">/backend/web/src/config/database.ts</Path>
      <Path name="APIClient">/frontend/web/src/services/api.ts</Path>
      <Path name="AuthContext">/frontend/web/src/contexts/AuthContext.tsx</Path>
      <Path name="Environment">/backend/web/.env</Path>
      <Path name="MainApp">/frontend/web/src/App.tsx - routing and auth</Path>
      <Path name="RouteDefinitions">/backend/web/src/routes/</Path>
      <Path name="EstimateVersioning">/backend/web/src/controllers/estimateVersioningController.ts</Path>
      <Path name="DynamicTemplates">/backend/web/src/services/dynamicTemplateService.ts</Path>
      <Path name="GridJobBuilder">/frontend/web/src/components/jobEstimation/GridJobBuilderRefactored.tsx</Path>
    </CriticalPaths>

    <Troubleshooting>
      <Step order="1">Check server status: infrastructure/scripts/status-servers.sh</Step>
      <Step order="2">Review logs: /tmp/signhouse-*.log</Step>
      <Step order="3">Verify database connection: systemctl status mysql</Step>
      <Step order="4">Check for port conflicts: lsof -i :3001 and lsof -i :5173</Step>
      <Step order="5">Never modify backup files as fallback</Step>
    </Troubleshooting>

    <TestingReference>
      <File>See /home/jon/Nexus/testingChecklist.md for comprehensive testing checklist</File>
      <Usage>Reference during testing and before deployments</Usage>
    </TestingReference>

  </QuickReference>

  <FinalReminder>
    This is a production system serving an active business. Every change matters. 
    Research until you have complete confidence in both the problem and solution.
    When in doubt, ask for clarification rather than making assumptions.
  </FinalReminder>
</SignHouseInstructions>