# Phase 2.e: QuickBooks Invoice Automation

**Status:** ✅ COMPLETE
**Created:** 2025-12-11
**Updated:** 2025-12-16

---

## Executive Summary

Create and manage QuickBooks invoices from Nexus orders. **Hybrid approach**: QB handles invoice creation/storage, we handle email sending with full customization.

---

## What's Been Completed

### Backend Infrastructure ✅

| Component | File | Status |
|-----------|------|--------|
| Invoice Client | `/backend/web/src/utils/quickbooks/invoiceClient.ts` | ✅ Done |
| Invoice Service | `/backend/web/src/services/qbInvoiceService.ts` | ✅ Done |
| Invoice Controller | `/backend/web/src/controllers/qbInvoiceController.ts` | ✅ Done |
| Invoice Repository | `/backend/web/src/repositories/qbInvoiceRepository.ts` | ✅ Done |
| Invoice Types | `/backend/web/src/types/qbInvoice.ts` | ✅ Done |
| Email Service | `/backend/web/src/services/invoiceEmailService.ts` | ✅ Done |
| Scheduled Email Job | `/backend/web/src/jobs/scheduledEmailJob.ts` | ✅ Done |
| Settings Repository | `/backend/web/src/repositories/settingsRepository.ts` | ✅ Done |
| Settings Service | `/backend/web/src/services/settingsService.ts` | ✅ Done |
| Settings Routes | `/backend/web/src/routes/settings.ts` | ✅ Done |

### Database Migrations ✅

| Migration | Purpose | Status |
|-----------|---------|--------|
| `2025-12-13_qb_invoice_automation.sql` | Invoice columns on orders, scheduled_emails table | ✅ Done |
| `20251215_001_create_settings_tables.sql` | Settings tables structure | ✅ Done |
| `20251215_002_seed_settings_data.sql` | Seed email templates | ✅ Done |

### Frontend Components ✅

| Component | File | Status |
|-----------|------|--------|
| Invoice Button | `/frontend/web/src/components/orders/details/components/InvoiceButton.tsx` | ✅ Done |
| Invoice Action Modal | `/frontend/web/src/components/orders/modals/InvoiceActionModal.tsx` | ✅ Done |
| Link Invoice Modal | `/frontend/web/src/components/orders/modals/LinkInvoiceModal.tsx` | ✅ Done |
| Record Payment Modal | `/frontend/web/src/components/orders/modals/RecordPaymentModal.tsx` | ✅ Done |
| QB Invoice API | `/frontend/web/src/services/api/orders/qbInvoiceApi.ts` | ✅ Done |

### QB API Capabilities ✅

| Operation | Endpoint | Status |
|-----------|----------|--------|
| Create Invoice | `POST /invoice` | ✅ Working |
| Update Invoice | `POST /invoice?operation=update` | ✅ Working |
| Get Invoice | `GET /invoice/{id}` | ✅ Working |
| Query by Doc# | `SELECT FROM Invoice WHERE DocNumber=` | ✅ Working |
| Create Payment | `POST /payment` | ✅ Working |
| Get Invoice URL | Computed from ID | ✅ Working |

---

## New Plan: Hybrid Approach

### Why Hybrid?

**QuickBooks Native Send (`POST /invoice/{id}/send`):**
- ❌ Cannot customize email subject
- ❌ Cannot customize email body
- ❌ Uses QB's fixed template from account settings
- ✅ Has "Pay Now" button
- ✅ Professional QB branding

**Our Custom Email:**
- ✅ Full control over subject line
- ✅ Full control over email body/styling
- ✅ Can match Order Confirmation email style
- ✅ Include QB invoice link with "Pay Now"
- ✅ Scheduled sending capability

### Hybrid Solution

```
┌─────────────────────────────────────────────────────────────┐
│                     HYBRID APPROACH                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  QuickBooks handles:                                         │
│  • Invoice creation & storage                                │
│  • Invoice updates                                           │
│  • Payment tracking                                          │
│  • Invoice PDF generation                                    │
│  • "Pay Now" payment portal                                  │
│                                                              │
│  We handle:                                                  │
│  • Email composition (subject, body, styling)                │
│  • Email sending (via Gmail API)                             │
│  • Email scheduling                                          │
│  • Include QB invoice URL for "View & Pay"                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Completed Work (Phase 2.e.5 - 2.e.7)

### Phase 2.e.5: Email Template Redesign ✅

**Goal:** Match the Order Confirmation email styling

- [x] Update `email_templates` table body to use styled HTML matching Order Confirmation
- [x] Ensure template variables work: `{orderNumber}`, `{customerName}`, `{invoiceTotal}`, `{qbInvoiceUrl}`
- [x] Added custom message support with `{customMessage}` variable
- [x] Added balance line with `{balanceLine}` for deposit vs full invoice display

### Phase 2.e.6: Invoice Button Integration ✅

- [x] InvoiceButton shows correct states (create/update/send/view)
- [x] InvoiceActionModal flow end-to-end working
- [x] Email preview before sending (with PDF tab)
- [x] Scheduled email functionality with time picker

### Phase 2.e.7: Testing & Polish ✅

- [x] End-to-end test: Create order → Create invoice → Send email → Record payment
- [x] QB invoice URL works in sent emails
- [x] Staleness detection (order changes after invoice created)
- [x] Error handling edge cases

---

## Phase 2.f: Customer Accounting Emails + Email History ✅

**Completed:** 2025-12-16

- [x] Customer accounting emails (to/cc/bcc) stored in `customer_accounting_emails` table
- [x] Per-order accounting emails override via `order_accounting_emails` table
- [x] Invoice PDF attachment via Gmail API
- [x] Email history tracking with `invoice_emails` table
- [x] Email history display in InvoiceActionModal
- [x] Payments system with balance fetched from QuickBooks

---

## Phase 2.g: Bi-Directional Sync + Panel Dashboard ✅

**Completed:** 2025-12-16

### Bi-Directional Invoice Sync
- [x] Compare local order data with QuickBooks invoice in real-time
- [x] Detect QB-side modifications via content hash comparison
- [x] Conflict resolution modal with use_local, use_qb, keep_both options
- [x] Track `qb_invoice_last_updated_time` and `qb_invoice_sync_token`
- [x] InvoiceConflictModal component for resolution

### Customer Invoice Browser (for Linking)
- [x] Paginated query of customer's QB invoices
- [x] Search by doc number or invoice ID
- [x] Preview invoice before linking
- [x] Enhanced LinkInvoiceModal with browse/search tabs

### Panel Dashboard
- [x] Configurable workflow panels with assignment/status filtering
- [x] Compact order rows showing key info at a glance
- [x] Panel selection modal for dashboard customization
- [x] Persistent panel configuration via `dashboard_panels` table

### Invoices Listing Page
- [x] Dedicated /invoices route with analytics cards
- [x] Balance tracking with `cached_balance` from QB
- [x] Invoice table with customer, order, and payment info
- [x] Filtering and search capabilities

### Other Enhancements
- [x] Order part headers (`is_header_row` flag for grouping)
- [x] Auto-apply Ready for Pickup/Shipping tags based on order status
- [x] Per-order accounting emails editor (AccountingEmailsEditor component)

---

## Email Template Structure (New)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice #{orderNumber}</title>
  <style>
    /* Match Order Confirmation email styling */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f6f8;
      /* ... full styling from gmailService.ts ... */
    }
  </style>
</head>
<body>
  <!-- Header: "Invoice Ready" -->
  <!-- Body: Order details, invoice total, due date -->
  <!-- CTA Button: "View & Pay Invoice" → {qbInvoiceUrl} -->
  <!-- Footer: Company contact info -->
</body>
</html>
```

---

## Key Files Reference

### Backend
- `/backend/web/src/utils/quickbooks/invoiceClient.ts` - QB API calls
- `/backend/web/src/services/qbInvoiceService.ts` - Business logic
- `/backend/web/src/services/invoiceEmailService.ts` - Email sending
- `/backend/web/src/services/gmailService.ts` - Reference for email styling

### Frontend
- `/frontend/web/src/components/orders/details/components/InvoiceButton.tsx`
- `/frontend/web/src/components/orders/modals/InvoiceActionModal.tsx`

### Database
- `orders` table: `qb_invoice_id`, `qb_invoice_url`, `invoice_sent_at` columns
- `email_templates` table: Template storage
- `scheduled_emails` table: Scheduled email queue

---

## Archived: Original Custom Email Plan

The original plan included building custom email templates stored in database with a rich template editor UI. This has been simplified:

- ~~Phase 2.e.6: Email Templates & Sending~~ → Simplified to styled HTML in database
- ~~Phase 3.6: Email Templates Editor UI~~ → Deferred (can edit templates directly in DB for now)

---

**Document Status:** COMPLETE - All phases through 2.g implemented
**Last Updated:** 2025-12-16
