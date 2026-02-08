<SignHouseInstructions>
  <PrimaryDirective>
    We're building a production sign manufacturing system together.
    You handle implementation while I guide architecture and business requirements.
  </PrimaryDirective>

  <KeyDocumentation>
    <Document name="CODE_STANDARDS.md">
      <Path>/home/jon/Nexus/docs/CODE_STANDARDS.md</Path>
      <Purpose>Detailed code examples for backend/frontend patterns, common issue solutions with before/after code, database query pattern examples</Purpose>
      <WhenToReference>When writing new backend services/repositories/controllers, debugging MySQL boolean or credential issues, or needing code pattern examples</WhenToReference>
    </Document>
    <Document name="SYSTEM_OPERATIONS.md">
      <Path>/home/jon/Nexus/docs/SYSTEM_OPERATIONS.md</Path>
      <Purpose>Server management, dual-instance architecture, build/backup commands, dev workflow, troubleshooting</Purpose>
      <WhenToReference>Before any build, deployment, server, backup, or database connection operations</WhenToReference>
    </Document>
    <Document name="PROJECT_STRUCTURE.md">
      <Path>/home/jon/Nexus/docs/PROJECT_STRUCTURE.md</Path>
      <Purpose>Directory organization, tech stack, architecture pattern, key API routes, file size limits</Purpose>
      <WhenToReference>When navigating the codebase, understanding architecture, or adding new files/routes</WhenToReference>
    </Document>
    <Document name="HOME_DEV_SETUP.md">
      <Path>/home/jon/Nexus/docs/HOME_DEV_SETUP.md</Path>
      <Purpose>Home (Windows) development environment setup - HTTPS, SSL certs, QB credentials via .env, DuckDNS configuration</Purpose>
      <WhenToReference>When working from home environment or troubleshooting home dev setup</WhenToReference>
    </Document>
    <Document name="CSS_PATTERNS_GUIDE.md">
      <Path>/home/jon/Nexus/docs/CSS_PATTERNS_GUIDE.md</Path>
      <Purpose>CSS layout patterns and fixes - scrolling backgrounds, GPU rendering, scrollbar reservation</Purpose>
      <WhenToReference>When implementing layouts with horizontal scroll, grids, or fixing rendering issues</WhenToReference>
    </Document>
    <Document name="INDUSTRIAL_STYLING_GUIDE.md">
      <Path>/home/jon/Nexus/docs/INDUSTRIAL_STYLING_GUIDE.md</Path>
      <Purpose>Industrial theme colors, PAGE_STYLES constants, CSS variables for theming</Purpose>
      <WhenToReference>When styling components - always use PAGE_STYLES, never hardcode colors</WhenToReference>
    </Document>
  </KeyDocumentation>

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
      <Rule id="8">BUILD SCRIPTS ONLY: NEVER manually run npm run build, mv dist, or manipulate build folders directly. ALWAYS use the preset scripts in /infrastructure/scripts/. See docs/SYSTEM_OPERATIONS.md for all server/build/backup commands.</Rule>
      <Rule id="9">HOT-RELOAD: Frontend uses Vite hot-reload in dev - do NOT rebuild. Use frontend-rebuild scripts ONLY for production deployments.</Rule>
    </AbsoluteRules>
  </ProductionSafetyRules>

  <CriticalRules>
    <DatabaseRules>
      <Rule>MySQL booleans: ALWAYS use `!!` to convert tinyint to JS boolean (e.g., `!!row.is_active`)</Rule>
      <Rule>Database credentials: ALWAYS use DB_HOST, DB_USER, DB_PASSWORD, DB_NAME from .env</Rule>
      <Rule>NEVER use root database user. Always use dedicated non-root user from .env</Rule>
      <Rule>ALWAYS use `query()` from config/database.ts, NEVER `pool.execute()` directly</Rule>
      <Rule>Legacy code may still use pool.execute() - update to query() when touching those files</Rule>
      <Rule>DB credentials: always from .env. QB credentials: encrypted in database (office) or .env (home - see HOME_DEV_SETUP.md)</Rule>
      <Rule>CLI MySQL queries: ALWAYS source .env first, then use variables: `source /home/jon/Nexus/backend/web/.env && mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"` - NEVER hardcode credentials in bash commands</Rule>
    </DatabaseRules>
    <ArchitectureRules>
      <Rule>Repository imports query() -> Service calls repository -> Controller calls service -> Route defines middleware</Rule>
      <Rule>Routes: ONLY middleware chains. Controllers: ONLY HTTP concerns. Services: ALL business logic. Repositories: ONLY data access.</Rule>
    </ArchitectureRules>
    <DetailedExamples>See docs/CODE_STANDARDS.md for full code examples and common issue solutions</DetailedExamples>
  </CriticalRules>

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
      <Backend>TypeScript/Node.js + Express on port 3001 (/backend/web/)</Backend>
      <Frontend>React + TypeScript + Vite on port 5173 (/frontend/web/)</Frontend>
      <Database>MySQL 8.0 on localhost:3306 (sign_manufacturing) via mysql2/promise with connection pooling</Database>
      <Authentication>JWT Tokens - 1 hour access, 30 day refresh</Authentication>
    </TechnologyStack>
    <FullStructure>See docs/PROJECT_STRUCTURE.md for directory organization and file layout</FullStructure>
  </SystemArchitecture>

  <ArchitectureStandard>
    <MandatoryPattern>Route -> Controller -> Service -> Repository -> Database</MandatoryPattern>
    <StrictRules>
      <Rule>Routes contain ONLY middleware chains - no business logic</Rule>
      <Rule>Controllers contain ONLY HTTP concerns - no database queries</Rule>
      <Rule>Services contain ALL business logic - no HTTP or database details</Rule>
      <Rule>Repositories contain ONLY data access - no business logic</Rule>
      <Rule>All new features MUST follow this pattern</Rule>
      <Rule>All refactoring MUST migrate to this pattern</Rule>
    </StrictRules>
    <LineLimits>See docs/PROJECT_STRUCTURE.md for per-layer line limits</LineLimits>
  </ArchitectureStandard>

  <BusinessDomainRules>
    <Rule name="TaxCalculation">Based on billing address using tax_rules table with provincial tax rates</Rule>
    <Rule name="BusinessModel">Wholesale manufacturing for other sign companies (no permits/installation)</Rule>
    <Rule name="JobWorkflow">Quote -> Approved -> Order Form -> Production -> Shipped (with full status tracking)</Rule>
    <Rule name="TimeTracking">Employee time entries require manager approval, with edit request workflow</Rule>
    <Rule name="InventoryControl">Vinyl inventory with low stock alerts, supplier cost tracking, and reservation system</Rule>
    <Rule name="RoleBasedAccess">Comprehensive RBAC system with granular permissions and audit logging</Rule>
    <Rule name="FrontendRBAC">Frontend uses simple role checks (owner/manager/staff) for UI visibility; backend enforces granular permissions on API calls. No frontend permission API needed.</Rule>
  </BusinessDomainRules>

  <CriticalPaths>
    <Path name="DatabaseConfig">/backend/web/src/config/database.ts</Path>
    <Path name="APIClient">/frontend/web/src/services/api/index.ts</Path>
    <Path name="AuthContext">/frontend/web/src/contexts/AuthContext.tsx</Path>
    <Path name="Environment">/backend/web/.env</Path>
    <Path name="MainApp">/frontend/web/src/App.tsx - routing and auth</Path>
    <Path name="RouteDefinitions">/backend/web/src/routes/</Path>
    <Path name="EstimateVersioning">/backend/web/src/controllers/estimateVersioningController.ts</Path>
    <Path name="DynamicTemplates">/backend/web/src/services/dynamicTemplateService.ts</Path>
    <Path name="GridJobBuilder">/frontend/web/src/components/jobEstimation/GridJobBuilderRefactored.tsx</Path>
    <Path name="TasksTable">/frontend/web/src/components/orders/tasksTable/TasksTable.tsx</Path>
  </CriticalPaths>

  <DateHandlingRules>
    <Critical>MySQL DATE columns return UTC midnight strings that shift to the previous day in Eastern timezone when parsed with new Date()</Critical>
    <Rules>
      <Rule>ALWAYS import date formatters from `utils/dateUtils.ts` — NEVER define inline `formatDate` functions</Rule>
      <Rule>NEVER use `new Date(dateStr)` for date-only values (DATE columns) — use the safe `parseLocalDate` pattern that extracts YYYY-MM-DD components</Rule>
      <Rule>Datetime values (DATETIME/TIMESTAMP columns with time component) are safe with `new Date()` — timezone conversion is correct for those</Rule>
    </Rules>
    <QuickReference>
      <Format function="formatDate(str)">Short date: "Sun, Feb 8" — for compact displays (tasks table, time entries)</Format>
      <Format function="formatDateWithYear(str)">Date with year: "Feb 8, 2026" — most common format. Pass { weekday: true } for "Sunday, Feb 8, 2026"</Format>
      <Format function="formatMonthDay(str)">Month + day: "Feb 8" — for supply chain/material requirements</Format>
      <Format function="formatDateTimeWithYear(str)">Full datetime: "Feb 8, 2026, 2:30 PM" — for audit logs, file dates</Format>
      <Format function="formatDateTime(str)">Short datetime: "Feb 8, 2:30 PM" — for recent timestamps (no year needed)</Format>
      <Format function="formatRelativeDate(str)">Relative: "Today" / "Tomorrow" / "Feb 8" — for dashboard panels</Format>
      <Format function="formatDateLong(str)">Long date: "February 8, 2026" — for formal displays</Format>
    </QuickReference>
    <BackendNote>Server-side (Eastern TZ): `toISOString().split('T')[0]` is acceptable. Prefer `DATE_FORMAT` in SQL queries.</BackendNote>
  </DateHandlingRules>

  <FinalReminder>
    This is a production system serving an active business. Every change matters.
    Research until you have complete confidence in both the problem and solution.
    When in doubt, ask for clarification rather than making assumptions.
  </FinalReminder>
</SignHouseInstructions>
