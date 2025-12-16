# SignHouse Manufacturing System - Project Structure

## Directory Organization

```
/home/jon/Nexus/
├── CLAUDE.md                    # Claude development context and standards
├── BUILD_MANAGEMENT.md          # Build, backup, and server management guide
│
├── backend/web/                 # TypeScript/Express backend
│   ├── src/
│   │   ├── config/              # Database connection, environment
│   │   │   └── database.ts      # MySQL connection pool
│   │   ├── controllers/         # Request handlers (HTTP layer)
│   │   │   ├── customers/       # Customer management controllers
│   │   │   ├── orders/          # Order management controllers
│   │   │   ├── qbInvoiceController.ts
│   │   │   ├── qbPaymentController.ts
│   │   │   ├── customerAccountingEmailController.ts
│   │   │   └── ...
│   │   ├── routes/              # Express route definitions
│   │   │   ├── customers.ts     # /api/customers/*
│   │   │   ├── orders.ts        # /api/orders/*
│   │   │   ├── payments.ts      # /api/payments/*
│   │   │   ├── settings.ts      # /api/settings/*
│   │   │   └── ...
│   │   ├── services/            # Business logic layer
│   │   │   ├── qbInvoiceService.ts
│   │   │   ├── qbPaymentService.ts
│   │   │   ├── invoiceEmailService.ts
│   │   │   ├── customerAccountingEmailService.ts
│   │   │   └── ...
│   │   ├── repositories/        # Data access layer
│   │   │   ├── orderRepository.ts
│   │   │   ├── qbInvoiceRepository.ts
│   │   │   ├── customerAccountingEmailRepository.ts
│   │   │   └── ...
│   │   ├── middleware/          # Auth, RBAC, validation
│   │   ├── types/               # TypeScript definitions
│   │   │   ├── orders.ts
│   │   │   ├── qbInvoice.ts
│   │   │   ├── customerAccountingEmails.ts
│   │   │   ├── settings.ts
│   │   │   └── ...
│   │   ├── utils/               # Utilities and integrations
│   │   │   ├── quickbooks/      # QB API client utilities
│   │   │   │   ├── invoiceClient.ts
│   │   │   │   └── ...
│   │   │   └── gmail/           # Gmail API utilities
│   │   └── server.ts            # Express app entry point
│   ├── .env                     # Environment variables (credentials)
│   └── package.json
│
├── frontend/web/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/          # UI components by feature
│   │   │   ├── customers/       # Customer management
│   │   │   │   ├── CustomerForm.tsx
│   │   │   │   ├── AccountingEmailsEditor.tsx
│   │   │   │   ├── ContactsEditor.tsx
│   │   │   │   └── ...
│   │   │   ├── orders/          # Order management
│   │   │   │   ├── details/     # Order details page
│   │   │   │   ├── tasksTable/  # Tasks Table view
│   │   │   │   ├── modals/      # Order modals (Invoice, etc.)
│   │   │   │   └── ...
│   │   │   ├── dashboard/       # Dashboard components
│   │   │   └── ...
│   │   ├── pages/               # Full page components
│   │   │   └── PaymentsPage.tsx
│   │   ├── services/            # API client services
│   │   │   ├── api.ts           # Main API client
│   │   │   └── api/
│   │   │       ├── orders/
│   │   │       │   └── qbInvoiceApi.ts
│   │   │       ├── paymentsApi.ts
│   │   │       ├── customerAccountingEmailsApi.ts
│   │   │       └── ...
│   │   ├── contexts/            # React contexts
│   │   │   └── AuthContext.tsx
│   │   ├── types/               # Frontend TypeScript types
│   │   ├── config/              # Configuration and constants
│   │   │   ├── specificationConstants.ts
│   │   │   └── orderProductTemplates.ts
│   │   └── App.tsx              # Main app with routing
│   └── package.json
│
├── database/
│   └── migrations/              # SQL migration files
│       ├── 20251216_001_add_custom_message_to_templates.sql
│       ├── 20251217_001_add_customer_accounting_emails.sql
│       ├── 20251217_002_add_order_accounting_emails.sql
│       └── ...
│
├── infrastructure/
│   ├── scripts/                 # Server management scripts
│   │   ├── start-production.sh
│   │   ├── start-dev.sh
│   │   ├── stop-servers.sh
│   │   ├── status-servers.sh
│   │   ├── rebuild-dev.sh
│   │   ├── rebuild-production.sh
│   │   ├── backup-builds.sh
│   │   └── ...
│   └── backups/                 # Build backups (DO NOT MODIFY)
│
└── docs/                        # Documentation
    ├── PROJECT_STRUCTURE.md     # This file
    └── ROADMAP.md               # Development roadmap
```

## Technology Stack

| Layer | Technology | Port |
|-------|------------|------|
| Frontend | React + TypeScript + Vite | 5173 |
| Backend | TypeScript + Express | 3001 |
| Database | MySQL 8.0 | 3306 |
| Process Manager | PM2 | - |
| Auth | JWT (1hr access, 30d refresh) | - |

## Architecture Pattern

```
Route → Controller → Service → Repository → Database
```

| Layer | Responsibility | Max Lines |
|-------|----------------|-----------|
| Route | HTTP routing, middleware chains | 15-25/endpoint |
| Controller | Request/response handling | 300/file |
| Service | Business logic, validation | 500/file |
| Repository | Database queries, data access | 300/file |

## Key API Routes

### Customers (`/api/customers`)
- CRUD operations for customers
- Address management (billing, shipping, jobsite)
- Accounting emails (to/cc/bcc for invoices)
- Customer contacts

### Orders (`/api/orders`)
- Order management and workflow
- QuickBooks invoice operations
- Invoice email sending/scheduling
- Email history tracking
- Invoice PDF retrieval

### Payments (`/api/payments`)
- Record payments to QuickBooks
- Multi-invoice payment views

### Settings (`/api/settings`)
- Email templates management
- System configuration
- Audit log with pagination

## External Integrations

### QuickBooks Online
- OAuth 2.0 authentication
- Customer sync (resolve by name)
- Estimate and Invoice creation
- Payment recording
- Balance fetched from QB (no local tracking)
- Customer payment links (InvoiceLink)

### Gmail API
- Service account with domain-wide delegation
- Invoice email sending
- BCC support for audit copies
- Retry logic with exponential backoff

## Development Guidelines

1. **Ports**: Backend 3001, Frontend 5173 (never change)
2. **Paths**: Always use absolute paths `/home/jon/Nexus/...`
3. **File Size**: Max 500 lines per file - refactor before exceeding
4. **Builds**: Use infrastructure scripts, never manual `npm run build`
5. **Hot Reload**: Frontend uses Vite hot-reload during development

## Server Management

```bash
# Start servers
/home/jon/Nexus/infrastructure/scripts/start-production.sh
/home/jon/Nexus/infrastructure/scripts/start-dev.sh

# Stop/Status
/home/jon/Nexus/infrastructure/scripts/stop-servers.sh
/home/jon/Nexus/infrastructure/scripts/status-servers.sh

# Rebuild
/home/jon/Nexus/infrastructure/scripts/rebuild-dev.sh
/home/jon/Nexus/infrastructure/scripts/rebuild-production.sh
```

---

**Last Updated**: 2025-12-17
