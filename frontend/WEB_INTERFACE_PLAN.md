# SignHouse Manufacturing Web Interface - Implementation Plan

## Overview
Building a modern, responsive web interface for sign manufacturing business management, inspired by TimeClockPro architecture but adapted for our specific business needs with role-based access control.

## User Roles & Access Control

### Role Definitions
1. **Production Staff** (Shop floor workers)
   - Focus: Job execution and time tracking
   - Access: Job details, production instructions, time clock, personal wage info
   - Restrictions: No customer details, no pricing, no other employee data

2. **Designer** (Creative team)
   - Focus: Design work, job specifications, customer communication
   - Access: Customer details, job requirements, file management, estimates
   - Restrictions: Limited financial data, no employee management

3. **Manager** (Administrative/Owner)
   - Focus: Full business oversight
   - Access: Everything - customers, jobs, employees, financials, reports
   - Restrictions: None

### Role-Based Data Access Matrix

| Feature | Production Staff | Designer | Manager |
|---------|------------------|----------|---------|
| **Customers** |
| View customer details | ❌ | ✅ | ✅ |
| Edit customer info | ❌ | ✅ | ✅ |
| Customer communication | ❌ | ✅ | ✅ |
| **Jobs** |
| View job board | ✅ (limited) | ✅ | ✅ |
| Update job status | ✅ (production only) | ✅ | ✅ |
| View job details | ✅ (specs only) | ✅ | ✅ |
| Edit job details | ❌ | ✅ | ✅ |
| **Estimates/Pricing** |
| View estimates | ❌ | ✅ (no costs) | ✅ |
| Create estimates | ❌ | ✅ | ✅ |
| View pricing | ❌ | ❌ | ✅ |
| Edit pricing | ❌ | ❌ | ✅ |
| **Time & Payroll** |
| Clock in/out | ✅ | ✅ | ✅ |
| View own time/wages | ✅ | ✅ | ✅ |
| View others' time | ❌ | ❌ | ✅ |
| Edit time records | ❌ | ❌ | ✅ |
| **Files & Documents** |
| Upload job files | ✅ (production) | ✅ | ✅ |
| View job files | ✅ (specs/drawings) | ✅ | ✅ |
| Delete files | ❌ | ✅ | ✅ |
| **Reports** |
| Production reports | ✅ (own work) | ✅ (design metrics) | ✅ (all) |
| Financial reports | ❌ | ❌ | ✅ |
| Employee reports | ❌ | ❌ | ✅ |

## Technology Stack Decision

### Frontend Framework: **React + TypeScript**
**Why:** Based on TimeClockPro analysis
- Modern React 18 with hooks and functional components
- TypeScript for type safety and better development experience
- Excellent ecosystem and component libraries

### Build System: **Vite**
**Why:** Fast development and optimized builds
- Lightning-fast dev server with hot module replacement
- Optimized production builds
- Great TypeScript support

### Backend: **Express.js + TypeScript**
**Why:** Simple, proven, integrates well with our MySQL database
- RESTful API design
- Easy to integrate with existing MySQL database
- TypeScript for consistent type safety across stack

### UI Component Library: **shadcn/ui**
**Why:** Professional, accessible, customizable
- Built on Radix UI primitives (accessibility-first)
- Tailwind CSS for styling
- Copy-paste components that we can customize
- Consistent design system

### State Management: **TanStack Query + React Context**
**Why:** Best practices from TimeClockPro
- TanStack Query for server state and caching
- React Context for authentication and global state
- No over-engineering with complex state managers

### Routing: **React Router** 
**Why:** More feature-rich than Wouter for our needs
- Better for complex navigation requirements
- Nested routing for dashboard sections
- Route protection for authentication and roles

## Project Structure

```
/home/jon/Nexus/frontend/
├── web/
│   ├── index.html                    # Entry point
│   ├── src/
│   │   ├── App.tsx                   # Main application component
│   │   ├── main.tsx                  # React entry point
│   │   ├── index.css                 # Global styles
│   │   ├── components/               # Feature components
│   │   │   ├── customers/
│   │   │   │   ├── CustomerList.tsx
│   │   │   │   ├── CustomerForm.tsx
│   │   │   │   ├── CustomerDetail.tsx
│   │   │   │   └── AddressManager.tsx
│   │   │   ├── estimates/
│   │   │   │   ├── EstimateList.tsx
│   │   │   │   ├── EstimateForm.tsx
│   │   │   │   └── LineItemEditor.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── JobBoard.tsx          # Trello-style board (role-aware)
│   │   │   │   ├── JobCard.tsx           # Individual job cards (filtered by role)
│   │   │   │   ├── JobCalendar.tsx       # Calendar view
│   │   │   │   ├── JobList.tsx           # List view
│   │   │   │   └── JobDetails.tsx        # Job detail modal (role-filtered)
│   │   │   ├── timeclock/
│   │   │   │   ├── TimeTracker.tsx       # Clock in/out interface
│   │   │   │   ├── TimeHistory.tsx       # Personal time history
│   │   │   │   └── PayrollView.tsx       # Personal wage info
│   │   │   ├── layout/
│   │   │   │   ├── Layout.tsx            # Role-aware layout
│   │   │   │   ├── Sidebar.tsx           # Role-based navigation
│   │   │   │   └── Header.tsx
│   │   │   └── ui/                   # shadcn/ui components
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── table.tsx
│   │   │       └── ...
│   │   ├── contexts/                 # React contexts
│   │   │   ├── AuthContext.tsx           # User auth + role
│   │   │   └── AppContext.tsx
│   │   ├── hooks/                    # Custom hooks
│   │   │   ├── useCustomers.ts           # Role-filtered
│   │   │   ├── useEstimates.ts
│   │   │   ├── useJobs.ts                # Role-filtered
│   │   │   ├── useAuth.ts
│   │   │   └── usePermissions.ts         # Role checking
│   │   ├── lib/                      # Utilities
│   │   │   ├── api.ts                # API client with role headers
│   │   │   ├── utils.ts              # General utilities
│   │   │   ├── permissions.ts        # Role permission logic
│   │   │   └── queryClient.ts        # TanStack Query setup
│   │   ├── pages/                    # Page components
│   │   │   ├── Dashboard.tsx             # Role-specific dashboards
│   │   │   ├── Login.tsx
│   │   │   ├── Customers.tsx             # Designer/Manager only
│   │   │   ├── Estimates.tsx             # Designer/Manager only
│   │   │   ├── Jobs.tsx                  # All roles (filtered views)
│   │   │   ├── TimeClock.tsx             # All roles
│   │   │   └── NotFound.tsx
│   │   └── types/                    # TypeScript definitions
│   │       ├── customer.ts
│   │       ├── estimate.ts
│   │       ├── job.ts
│   │       ├── user.ts               # User roles and permissions
│   │       └── api.ts
│   ├── package.json                  # Dependencies
│   ├── tsconfig.json                 # TypeScript config
│   ├── tailwind.config.ts            # Tailwind CSS config
│   ├── postcss.config.js             # PostCSS config
│   └── vite.config.ts                # Vite configuration
└── WEB_INTERFACE_PLAN.md            # This file
```

## Implementation Phases

### Phase 1: Foundation Setup with Role-Based Auth ⭐ (NEXT)
**Estimate:** 2-3 development sessions

#### Goals:
- Project scaffolding with Vite + React + TypeScript
- Role-based authentication system
- Layout structure with role-aware navigation
- Database API foundation with role filtering

#### Deliverables:
1. **Project Setup**
   ```bash
   npm create vite@latest web -- --template react-ts
   npm install @radix-ui/react-* @tanstack/react-query
   npm install tailwindcss @tailwindcss/forms
   ```

2. **Enhanced Authentication System**
   - Login page with form validation
   - AuthContext with user role management
   - Route protection for different user roles
   - Permission checking utilities

3. **Role-Aware Layout Component**
   - Header with user info, role badge, and logout
   - Sidebar navigation filtered by user role
   - Responsive design for mobile/desktop
   - Role-specific dashboard landing pages

4. **Database Schema Extensions**
   ```sql
   -- Add user management tables
   CREATE TABLE users (
       user_id INT PRIMARY KEY AUTO_INCREMENT,
       username VARCHAR(50) UNIQUE NOT NULL,
       email VARCHAR(255) UNIQUE NOT NULL,
       password_hash VARCHAR(255) NOT NULL,
       first_name VARCHAR(100),
       last_name VARCHAR(100),
       role ENUM('production_staff', 'designer', 'manager') NOT NULL,
       hourly_rate DECIMAL(8,2),
       is_active BOOLEAN DEFAULT TRUE,
       created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   );

   -- Time tracking for all employees
   CREATE TABLE time_entries (
       entry_id INT PRIMARY KEY AUTO_INCREMENT,
       user_id INT NOT NULL,
       clock_in DATETIME NOT NULL,
       clock_out DATETIME,
       break_minutes INT DEFAULT 0,
       total_hours DECIMAL(4,2),
       hourly_rate DECIMAL(8,2),
       total_pay DECIMAL(8,2),
       date DATE NOT NULL,
       notes TEXT,
       created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(user_id)
   );
   ```

#### Success Criteria:
- Users log in and see role-appropriate interface
- Navigation shows only permitted sections
- API endpoints respect role-based permissions
- Different dashboard views per role

### Phase 2: Customer Management (Designer/Manager Only)
**Estimate:** 3-4 development sessions

#### Goals:
- Complete customer CRUD operations (Designer/Manager access)
- Multi-address management
- Search and filtering
- Role-based data hiding

#### Role-Specific Features:
- **Designers**: Can view/edit customer details, no pricing info
- **Managers**: Full access to all customer data including financial history
- **Production Staff**: No access to customer module

#### Success Criteria:
- Role-appropriate customer data access
- Production staff cannot access customer information
- Designers see customer details without sensitive financial data

### Phase 3: Enhanced Estimating System (Designer/Manager)
**Estimate:** 3-4 development sessions

#### Goals:
- Quote creation and management with role filtering
- Role-appropriate pricing display
- PDF generation and email delivery

#### Role-Specific Features:
- **Designers**: Create estimates, see line items but not cost/margin data
- **Managers**: Full pricing control, margin visibility, approval workflow
- **Production Staff**: No estimate access

### Phase 4: Visual Job Management - Role-Aware Trello Replacement ⭐
**Estimate:** 5-6 development sessions

#### Goals:
- Visual kanban-style job board with role-based filtering
- Role-specific job card information
- Multiple view modes adapted for each role
- Time tracking integration

#### Role-Specific Job Board Features:

##### Production Staff View:
- **Job Cards Show**: Job title, production instructions, materials needed, due date
- **Job Cards Hide**: Customer details, pricing, profit margins
- **Available Columns**: "Ready for Production" → "In Progress" → "Quality Check" → "Completed"
- **Actions**: Update production status, log time, upload production photos
- **Time Integration**: Clock in/out directly from job cards

##### Designer View:
- **Job Cards Show**: Customer name, design requirements, specifications, due dates
- **Job Cards Hide**: Detailed pricing, employee time logs
- **Available Columns**: "Design Brief" → "In Design" → "Client Review" → "Approved" → "Production Ready"
- **Actions**: Upload design files, communicate with customers, update design status
- **File Management**: Full access to design files and revisions

##### Manager View:
- **Job Cards Show**: Everything - customer, pricing, margins, employee time, full status
- **Available Columns**: All columns from quote to completion
- **Actions**: Full control - edit jobs, reassign, view profitability, manage workflow
- **Analytics**: View job profitability, employee efficiency, bottleneck identification

#### Enhanced Database Schema:
```sql
-- Enhanced jobs table with role-aware fields
ALTER TABLE jobs ADD COLUMN assigned_to_user_id INT;
ALTER TABLE jobs ADD COLUMN design_files_path VARCHAR(500);
ALTER TABLE jobs ADD COLUMN production_notes TEXT;
ALTER TABLE jobs ADD COLUMN customer_visible_status VARCHAR(100);

-- Job time tracking
CREATE TABLE job_time_entries (
    entry_id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    activity_type ENUM('design', 'production', 'quality_check', 'setup') NOT NULL,
    description TEXT,
    billable_hours DECIMAL(4,2),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

#### Role-Specific Components:
```tsx
// Role-aware job card component
export function JobCard({ job, userRole }: { job: Job; userRole: UserRole }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-sm">{job.title}</h3>
          {(userRole === 'manager' || userRole === 'designer') && (
            <Badge variant={job.priority === 'urgent' ? 'destructive' : 'default'}>
              {job.priority}
            </Badge>
          )}
        </div>
        
        {/* Customer name - only for Designer/Manager */}
        {userRole !== 'production_staff' && (
          <p className="text-xs text-gray-600 mb-2">{job.customer_name}</p>
        )}
        
        {/* Production-specific info */}
        {userRole === 'production_staff' && (
          <div className="text-xs text-gray-600 mb-2">
            <p>Materials: {job.materials_summary}</p>
            <p>Est. Time: {job.estimated_hours}h</p>
          </div>
        )}
        
        {/* Manager-only financial info */}
        {userRole === 'manager' && (
          <div className="text-xs text-blue-600 mb-2">
            <p>Value: ${job.total_value}</p>
            <p>Margin: {job.margin_percent}%</p>
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs">
          <span>{job.due_date}</span>
          <div className="flex space-x-1">
            {job.file_count > 0 && <FileIcon size={12} />}
            {userRole === 'production_staff' && job.has_time_entry && (
              <ClockIcon size={12} className="text-green-500" />
            )}
          </div>
        </div>
        
        {/* Role-specific quick actions */}
        {userRole === 'production_staff' && (
          <Button size="sm" className="w-full mt-2" onClick={() => clockIntoJob(job.id)}>
            Start Work
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Permission checking hook
export function usePermissions() {
  const { user } = useAuth();
  
  const canViewCustomers = user?.role === 'designer' || user?.role === 'manager';
  const canViewPricing = user?.role === 'manager';
  const canEditJobs = user?.role === 'designer' || user?.role === 'manager';
  const canViewEmployeeData = user?.role === 'manager';
  
  return {
    canViewCustomers,
    canViewPricing,
    canEditJobs,
    canViewEmployeeData,
    role: user?.role
  };
}
```

#### Success Criteria:
- Production staff see only job execution information, no customer/pricing data
- Designers have customer context but not financial details
- Managers have complete visibility and control
- Time tracking integrated seamlessly into job workflow
- Each role sees relevant job board columns and actions

### Phase 5: Time Clock & Personal Dashboard (All Roles)
**Estimate:** 2-3 development sessions

#### Goals:
- Universal time tracking for all employees
- Personal dashboard with role-appropriate information
- Wage tracking for individual users

#### Role-Specific Features:
- **All Roles**: Clock in/out, view personal time history, see own wage calculations
- **Production Staff**: Integration with job time tracking, productivity metrics
- **Managers**: Overview of all employee time, payroll calculations, efficiency reports

## API Design with Role-Based Access

### Authentication & Authorization Middleware:
```typescript
// Role-based access middleware
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // From auth middleware
    
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Data filtering middleware
export const filterDataByRole = (req: Request, res: Response, next: NextFunction) => {
  req.dataFilters = {
    role: req.user.role,
    userId: req.user.id
  };
  next();
};

// Example protected routes
app.get('/api/customers', requireRole(['designer', 'manager']), getCustomers);
app.get('/api/jobs', authenticateUser, filterDataByRole, getJobs);
app.get('/api/time-entries', authenticateUser, getFilteredTimeEntries);
```

### Role-Filtered API Responses:
```typescript
// Job data filtering based on role
export async function getJobs(req: Request, res: Response) {
  const { role, userId } = req.dataFilters;
  let query = 'SELECT ';
  
  switch (role) {
    case 'production_staff':
      query += `
        job_id, job_number, title, description, status, priority, due_date,
        production_notes, materials_summary, estimated_hours
        FROM jobs WHERE status IN ('production', 'ready_to_ship')
      `;
      break;
      
    case 'designer':
      query += `
        j.*, c.company_name, c.contact_name
        FROM jobs j
        JOIN customers c ON j.customer_id = c.customer_id
        WHERE j.status NOT IN ('completed', 'cancelled')
      `;
      break;
      
    case 'manager':
      query += `
        j.*, c.company_name, c.contact_name, 
        e.total_amount as estimate_value
        FROM jobs j
        JOIN customers c ON j.customer_id = c.customer_id
        LEFT JOIN estimates e ON j.estimate_id = e.estimate_id
      `;
      break;
  }
  
  const jobs = await db.query(query);
  res.json({ jobs });
}
```

## Development Standards

### Code Quality
- **TypeScript**: Strict mode enabled, no `any` types
- **Role-based TypeScript types**: Strong typing for permissions
- **ESLint + Prettier**: Consistent code formatting
- **Component Testing**: React Testing Library for critical components
- **API Testing**: Role-based endpoint testing

### Security
- **Input Validation**: Zod schemas for all API inputs
- **Role Validation**: Server-side permission checking on every request
- **SQL Injection Prevention**: Prepared statements only
- **Data Filtering**: Never send unauthorized data to client
- **Session Security**: Secure session management with role persistence

## Next Immediate Steps

1. **Create user management database tables**
2. **Set up role-based authentication system**
3. **Create Vite project** in `/home/jon/Nexus/frontend/web/`
4. **Set up Express API** with role-based middleware
5. **Build role-aware layout** with appropriate navigation

## Success Metrics

### Phase 1 Success:
- ✅ Three distinct user experiences based on role
- ✅ Production staff cannot access customer/pricing data
- ✅ Designers have customer context without financial sensitivity
- ✅ Managers have complete system access
- ✅ API properly filters data based on user role

### Phase 4 Success (Role-Aware Job Board):
- ✅ Production staff see only relevant job execution information
- ✅ Designers have design-focused workflow with customer context
- ✅ Managers have complete project oversight and financial visibility
- ✅ Time tracking seamlessly integrated with job workflow
- ✅ Each role has optimized interface for their daily work

---

**Note:** This role-based approach ensures that each user type has an interface optimized for their specific responsibilities while maintaining appropriate data security and privacy. The system grows naturally from simple time tracking to comprehensive business management while respecting role boundaries.