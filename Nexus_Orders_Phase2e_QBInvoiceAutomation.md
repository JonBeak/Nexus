# Phase 2.e: QuickBooks Invoice Automation - Implementation Guide

**Status:** Ready for Implementation
**Priority:** Phase 2 Essential Feature
**Created:** 2025-12-11
**Plan File:** `/home/jon/.claude/plans/purring-plotting-flute.md`

---

## Executive Summary

Implement QuickBooks Invoice integration allowing users to create, update, send, and manage invoices entirely from within Nexus. Record payments to QB and view payment history. QB remains source of truth - no local invoice/payment storage beyond linking IDs.

---

## Business Requirements

### Core Workflow
1. **One invoice per order** - Update existing QB invoice when changes occur, never create duplicates
2. **Never automatic** - All invoice actions are user-initiated with prompts at appropriate stages
3. **QB as source of truth** - Query QB for balance/payment data, don't store locally
4. **Conspicuous UI** - Dynamic invoice button with animated shine when action needed

### Invoice Lifecycle
```
Order Created
    ↓
[No Invoice Yet - Button shows "Create Invoice"]
    ↓
User creates invoice (manually or prompted at status change)
    ↓
[Invoice Created - Button shows "Send Invoice"]
    ↓
User sends invoice (immediately or scheduled)
    ↓
[Invoice Sent - Button shows "View Invoice"]
    ↓
User records payments as they come in
    ↓
[Fully Paid - Order can move to Completed]
```

### Two Order Types

**A) Deposit Required Orders:**
- Trigger prompt: `Pending Confirmation → Pending Files Creation`
- Email template: 50% Deposit Request
- User can: Edit email, Skip, or Send immediately

**B) Standard Orders:**
- Trigger prompt: `Any Status → QC & Packing`
- Email template: Full Invoice
- User can: Edit email, Schedule for future date/time, Skip
- If skipped: Re-prompt at `Shipping`, `Pick Up`, or `Awaiting Payment`

---

## Technical Architecture

### Existing Infrastructure (Reuse)

| Component | Location | Purpose |
|-----------|----------|---------|
| QB API Client | `/backend/web/src/utils/quickbooks/apiClient.ts` | Core API with auto token refresh |
| OAuth Client | `/backend/web/src/utils/quickbooks/oauthClient.ts` | Token management |
| Entity Resolver | `/backend/web/src/utils/quickbooks/entityResolver.ts` | Customer/tax/item ID lookup |
| QB Estimate Service | `/backend/web/src/services/qbEstimateService.ts` | Pattern for order→QB conversion |
| Gmail Integration | Existing from Phase 1.5.c.6.3 | Email sending |

### New Components to Build

```
/backend/web/src/
├── utils/quickbooks/
│   └── invoiceClient.ts              # QB Invoice API methods
├── services/
│   ├── qbInvoiceService.ts           # Invoice business logic
│   └── scheduledEmailService.ts      # Cron job for scheduled emails
├── controllers/
│   └── qbInvoiceController.ts        # HTTP handlers
└── routes/
    └── (add to quickbooks.ts or orders.ts)

/frontend/web/src/components/orders/
├── InvoiceButton.tsx                 # Dynamic button with shine animation
├── modals/
│   ├── InvoiceActionModal.tsx        # Create/Update/Send flow
│   ├── LinkInvoiceModal.tsx          # Link existing QB invoice
│   ├── RecordPaymentModal.tsx        # Record payment form
│   └── PaymentHistoryModal.tsx       # View payment history
└── OrderDetailsPage.tsx              # Integrate invoice button
```

---

## Database Schema Changes

### 1. Modify `orders` table

```sql
ALTER TABLE orders
  ADD COLUMN qb_invoice_id VARCHAR(50) DEFAULT NULL,
  ADD COLUMN qb_invoice_doc_number VARCHAR(50) DEFAULT NULL,
  ADD COLUMN qb_invoice_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN qb_invoice_synced_at DATETIME DEFAULT NULL,
  ADD COLUMN qb_invoice_data_hash VARCHAR(64) DEFAULT NULL,
  ADD COLUMN invoice_sent_at DATETIME DEFAULT NULL;

-- Index for uniqueness check when linking
CREATE UNIQUE INDEX idx_orders_qb_invoice_id ON orders(qb_invoice_id);
```

### 2. Create `scheduled_emails` table

```sql
CREATE TABLE scheduled_emails (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  email_type ENUM('deposit_request', 'full_invoice', 'reminder') NOT NULL,
  recipient_emails JSON NOT NULL,  -- Array of emails
  cc_emails JSON DEFAULT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  status ENUM('pending', 'sent', 'cancelled', 'failed') DEFAULT 'pending',
  sent_at DATETIME DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES employees(employee_id),
  INDEX idx_scheduled_emails_status_time (status, scheduled_for)
);
```

### 3. Create `email_templates` table

```sql
CREATE TABLE email_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_key VARCHAR(50) UNIQUE NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  variables JSON DEFAULT NULL,  -- Available merge variables
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default templates (content to be drafted during implementation)
INSERT INTO email_templates (template_key, template_name, subject, body, variables) VALUES
('deposit_request', '50% Deposit Request',
 'Invoice #{orderNumber} - Deposit Required | {customerName}',
 'Template body here with {variables}...',
 '["orderNumber", "customerName", "invoiceTotal", "depositAmount", "qbInvoiceUrl"]'),
('full_invoice', 'Full Invoice',
 'Invoice #{orderNumber} | {customerName}',
 'Template body here with {variables}...',
 '["orderNumber", "customerName", "invoiceTotal", "dueDate", "qbInvoiceUrl"]');
```

---

## API Endpoints

### Invoice Operations

```
POST   /api/orders/:orderId/qb-invoice
       Create QB invoice from order data
       Response: { success, qbInvoiceId, qbInvoiceUrl }

PUT    /api/orders/:orderId/qb-invoice
       Update existing QB invoice with current order data
       Response: { success, qbInvoiceId }

GET    /api/orders/:orderId/qb-invoice
       Get invoice details from QB (includes balance, status)
       Response: { success, invoice: { id, docNumber, total, balance, status, ... } }

POST   /api/orders/:orderId/qb-invoice/link
       Link existing QB invoice to order
       Body: { qbInvoiceId } or { docNumber }
       Response: { success, qbInvoiceId, qbInvoiceUrl }

GET    /api/orders/:orderId/qb-invoice/check-updates
       Check if order data changed since last sync (hash comparison)
       Response: { success, needsUpdate: boolean, currentHash, syncedHash }
```

### Payment Operations

```
POST   /api/orders/:orderId/qb-payment
       Record payment to QB invoice
       Body: { amount, paymentDate, paymentMethod, referenceNumber?, memo? }
       Response: { success, paymentId, newBalance }

GET    /api/orders/:orderId/qb-payments
       Get payment history from QB
       Response: { success, payments: [...], invoiceBalance }
```

### Email Operations

```
POST   /api/orders/:orderId/invoice-email/send
       Send invoice email immediately
       Body: { recipientEmails, ccEmails?, subject, body }
       Response: { success }

POST   /api/orders/:orderId/invoice-email/schedule
       Schedule invoice email for future
       Body: { recipientEmails, ccEmails?, subject, body, scheduledFor }
       Response: { success, scheduledEmailId }

GET    /api/orders/:orderId/invoice-email/scheduled
       Get pending scheduled email for order
       Response: { success, scheduledEmail: {...} | null }

PUT    /api/orders/:orderId/invoice-email/scheduled/:id
       Update scheduled email
       Body: { subject?, body?, scheduledFor?, recipientEmails? }
       Response: { success }

DELETE /api/orders/:orderId/invoice-email/scheduled/:id
       Cancel scheduled email
       Response: { success }

GET    /api/email-templates/:templateKey
       Get email template for editing
       Response: { success, template: { subject, body, variables } }
```

---

## QuickBooks API Methods

### Invoice Methods (add to invoiceClient.ts)

```typescript
// Create invoice
async function createQBInvoice(data: {
  customerId: string;
  customerName: string;
  lineItems: QBLineItem[];
  taxCodeId: string;
  docNumber?: string;  // Our order number
  dueDate?: string;
  memo?: string;
}): Promise<QBInvoice>

// Update invoice
async function updateQBInvoice(
  invoiceId: string,
  data: Partial<CreateInvoiceData>
): Promise<QBInvoice>

// Get invoice (includes balance)
async function getQBInvoice(invoiceId: string): Promise<QBInvoice>

// Query invoice by doc number (for linking)
async function queryQBInvoiceByDocNumber(docNumber: string): Promise<QBInvoice | null>

// Get invoice PDF URL
async function getQBInvoicePdfUrl(invoiceId: string): Promise<string>
```

### Payment Methods

```typescript
// Record payment
async function createQBPayment(data: {
  customerId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethodRef?: string;  // QB payment method ID
  referenceNumber?: string;
  memo?: string;
}): Promise<QBPayment>

// Get payments for invoice
async function getQBPaymentsForInvoice(invoiceId: string): Promise<QBPayment[]>
```

### QB API Reference

```
POST /v3/company/{realmId}/invoice           - Create invoice
POST /v3/company/{realmId}/invoice?operation=update  - Update invoice
GET  /v3/company/{realmId}/invoice/{id}      - Read invoice
GET  /v3/company/{realmId}/query?query=...   - Query invoices

POST /v3/company/{realmId}/payment           - Create payment
GET  /v3/company/{realmId}/query?query=SELECT * FROM Payment WHERE ... - Query payments
```

---

## Frontend Components

### 1. InvoiceButton.tsx

Dynamic button that changes state based on order data:

```typescript
type InvoiceButtonState = 'create' | 'update' | 'send' | 'view';

interface Props {
  order: Order;
  onAction: (action: InvoiceButtonState) => void;
}

// State determination logic:
// - No qb_invoice_id → 'create'
// - qb_invoice_id exists AND needsUpdate → 'update'
// - qb_invoice_id exists AND !invoice_sent_at → 'send'
// - qb_invoice_id exists AND invoice_sent_at → 'view'
```

**Shine Animation CSS:**
```css
.invoice-button-action-needed {
  position: relative;
  overflow: hidden;
}

.invoice-button-action-needed::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shine 2s infinite;
}

@keyframes shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}
```

### 2. InvoiceActionModal.tsx

Combined modal for Create/Update/Send flow:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Create/Update/Send] Invoice                              [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Order: #200543 - ABC Sign Company                              │
│  Invoice Total: $4,250.00                                       │
│  [For deposit: "50% Deposit: $2,125.00"]                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  EMAIL TO CUSTOMER                                               │
│                                                                  │
│  To: [john@abcsigns.com, accounting@abcsigns.com]          [+]  │
│  CC: [optional]                                             [+]  │
│                                                                  │
│  Subject: ________________________________________________      │
│                                                                  │
│  Body:                                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ (Rich text editor with template loaded)                   │  │
│  │                                                           │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ☐ Schedule for later: [Date picker] [Time picker]              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Skip - Don't Send]    [Create/Update Only]    [Send Invoice]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. RecordPaymentModal.tsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Record Payment                                            [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Invoice #200543                                                 │
│  Total: $4,250.00                                               │
│  Paid: $2,125.00                                                │
│  ─────────────────                                              │
│  Balance Due: $2,125.00                                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Amount: [$_________]  [Pay Full Balance]                       │
│                                                                  │
│  Payment Date: [Dec 11, 2025  📅]                               │
│                                                                  │
│  Payment Method: [E-Transfer        ▼]                          │
│    • Cash                                                        │
│    • Check                                                       │
│    • Credit Card                                                 │
│    • E-Transfer                                                  │
│    • Wire Transfer                                               │
│                                                                  │
│  Reference #: [________________________]                         │
│  (Check number, transaction ID, etc.)                           │
│                                                                  │
│  Notes: [________________________]                               │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]    [Record Payment]        │
└─────────────────────────────────────────────────────────────────┘
```

### 4. PaymentHistoryModal.tsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Payment History - Invoice #200543                         [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Invoice Total: $4,250.00                                       │
│  Total Paid: $2,125.00                                          │
│  Balance Due: $2,125.00                                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Date        Method       Reference      Amount                  │
│  ──────────────────────────────────────────────────────         │
│  Dec 5, 2025  E-Transfer  TXN-12345     $2,125.00               │
│                                                                  │
│  (No more payments)                                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                              [Close]    [Record New Payment]     │
└─────────────────────────────────────────────────────────────────┘
```

### 5. LinkInvoiceModal.tsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Link Existing QuickBooks Invoice                          [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Search by Invoice Number:                                       │
│  [________________________] [Search]                             │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Found Invoice:                                                  │
│  • Invoice #: INV-2025-0543                                     │
│  • Customer: ABC Sign Company                                    │
│  • Total: $4,250.00                                             │
│  • Balance: $2,125.00                                           │
│  • Date: Dec 1, 2025                                            │
│                                                                  │
│  ⚠️ This invoice is not linked to any order.                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]    [Link This Invoice]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hash Comparison for Change Detection

Reuse pattern from QB Estimate staleness detection:

```typescript
// Backend: Generate hash from invoice-relevant order data
function generateInvoiceDataHash(order: Order): string {
  const invoiceData = {
    parts: order.parts.map(p => ({
      name: p.name,
      quantity: p.quantity,
      unitPrice: p.unit_price,
      total: p.total,
      description: p.invoice_description
    })),
    customerId: order.customer_id,
    // Add other invoice-relevant fields
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(invoiceData))
    .digest('hex');
}

// Compare on frontend or via API
const needsUpdate = currentHash !== order.qb_invoice_data_hash;
```

---

## Status Change Integration

Modify existing status change handler to prompt for invoice action:

```typescript
// In status change flow (StatusSelectModal or similar)
async function handleStatusChange(orderId: number, newStatus: string) {
  const order = await getOrder(orderId);
  const oldStatus = order.status;

  // Check for invoice prompt triggers
  const shouldPromptInvoice = checkInvoicePromptTrigger(order, oldStatus, newStatus);

  if (shouldPromptInvoice) {
    // Show InvoiceActionModal before completing status change
    const result = await showInvoiceActionModal(order, shouldPromptInvoice.type);

    if (result === 'cancelled') {
      return; // Don't change status
    }
    // result can be 'skipped', 'created', 'sent', etc.
  }

  // Proceed with status change
  await updateOrderStatus(orderId, newStatus);
}

function checkInvoicePromptTrigger(order, oldStatus, newStatus): PromptType | null {
  // Deposit required: Pending Confirmation → Pending Files Creation
  if (order.deposit_required &&
      oldStatus === 'pending_confirmation' &&
      newStatus === 'pending_files_creation') {
    return { type: 'deposit_request', required: false };
  }

  // Standard: Any → QC & Packing
  if (newStatus === 'qc_packing' && !order.qb_invoice_id) {
    return { type: 'full_invoice', required: false };
  }

  // Re-prompt: QC & Packing → Shipping/Pick Up/Awaiting Payment (if not sent)
  if (['shipping', 'pick_up', 'awaiting_payment'].includes(newStatus) &&
      order.qb_invoice_id && !order.invoice_sent_at) {
    return { type: 'reminder_to_send', required: false };
  }

  return null;
}
```

---

## Cron Job: Scheduled Email Sender

```typescript
// /backend/web/src/jobs/scheduledEmailJob.ts

import cron from 'node-cron';
import { sendEmail } from '../services/gmailService';
import { query } from '../config/database';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[ScheduledEmail] Checking for pending emails...');

  try {
    const pendingEmails = await query(`
      SELECT se.*, o.order_number
      FROM scheduled_emails se
      JOIN orders o ON se.order_id = o.order_id
      WHERE se.status = 'pending'
        AND se.scheduled_for <= NOW()
      ORDER BY se.scheduled_for ASC
      LIMIT 10
    `);

    for (const email of pendingEmails) {
      try {
        await sendEmail({
          to: JSON.parse(email.recipient_emails),
          cc: email.cc_emails ? JSON.parse(email.cc_emails) : undefined,
          subject: email.subject,
          body: email.body
        });

        await query(`
          UPDATE scheduled_emails
          SET status = 'sent', sent_at = NOW()
          WHERE id = ?
        `, [email.id]);

        // Also update order's invoice_sent_at
        await query(`
          UPDATE orders
          SET invoice_sent_at = NOW()
          WHERE order_id = ?
        `, [email.order_id]);

        console.log(`[ScheduledEmail] Sent email for order #${email.order_number}`);

      } catch (error) {
        console.error(`[ScheduledEmail] Failed for order #${email.order_number}:`, error);

        await query(`
          UPDATE scheduled_emails
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `, [error.message, email.id]);
      }
    }
  } catch (error) {
    console.error('[ScheduledEmail] Job failed:', error);
  }
});
```

---

## Implementation Phases

### Phase 2.e.1: Database & Core Backend (Est. 1-2 sessions)
- [ ] Run database migrations (orders columns, scheduled_emails, email_templates)
- [ ] Create `/utils/quickbooks/invoiceClient.ts` with QB API methods
- [ ] Create `/services/qbInvoiceService.ts` with business logic
- [ ] Create `/controllers/qbInvoiceController.ts` with HTTP handlers
- [ ] Add routes to `/routes/quickbooks.ts` or `/routes/orders.ts`
- [ ] Test with QB sandbox

### Phase 2.e.2: Invoice Create/Update/Get (Est. 1 session)
- [ ] Implement createQBInvoice - map order parts to QB line items
- [ ] Implement updateQBInvoice - sync changes
- [ ] Implement getQBInvoice - fetch balance/status
- [ ] Add hash comparison for change detection
- [ ] Test CRUD operations

### Phase 2.e.3: Link Existing Invoice (Est. 0.5 session)
- [ ] Implement queryQBInvoiceByDocNumber
- [ ] Add uniqueness validation
- [ ] Create LinkInvoiceModal.tsx
- [ ] Test linking flow

### Phase 2.e.4: Payment Recording (Est. 1 session)
- [ ] Implement createQBPayment
- [ ] Implement getQBPaymentsForInvoice
- [ ] Create RecordPaymentModal.tsx
- [ ] Create PaymentHistoryModal.tsx
- [ ] Test payment flow

### Phase 2.e.5: Frontend Invoice Button (Est. 1 session)
- [ ] Create InvoiceButton.tsx with state logic
- [ ] Add shine animation CSS
- [ ] Integrate into OrderDetailsPage.tsx (top-right corner)
- [ ] Create InvoiceActionModal.tsx
- [ ] Test all button states

### Phase 2.e.6: Email Templates & Sending (Est. 1 session)
- [ ] Seed email templates with proper content
- [ ] Implement template loading/variable substitution
- [ ] Integrate Gmail sending (reuse existing)
- [ ] Add email editor to InvoiceActionModal
- [ ] Test immediate send

### Phase 2.e.7: Email Scheduling (Est. 0.5 session)
- [ ] Implement scheduled_emails CRUD
- [ ] Create cron job
- [ ] Add schedule UI to modal
- [ ] Add cancel/edit scheduled email
- [ ] Test scheduling flow

### Phase 2.e.8: Status Change Prompts (Est. 0.5 session)
- [ ] Integrate invoice prompts into status change flow
- [ ] Handle skip/defer logic
- [ ] Test all trigger points

### Phase 2.e.9: Polish & Testing (Est. 1 session)
- [ ] Error handling edge cases
- [ ] Loading states
- [ ] QB API rate limiting consideration
- [ ] End-to-end testing
- [ ] Documentation update

---

## Testing Checklist

- [ ] Create invoice from order with multiple parts
- [ ] Update invoice after changing order quantities
- [ ] Link existing QB invoice to order (verify uniqueness)
- [ ] Record full payment - balance goes to $0
- [ ] Record partial payment - balance updated correctly
- [ ] View payment history with multiple payments
- [ ] Send invoice email immediately
- [ ] Schedule invoice email for future
- [ ] Cancel scheduled email
- [ ] Edit scheduled email
- [ ] Invoice button shows correct state (create/update/send/view)
- [ ] Shine animation appears at appropriate stages
- [ ] Status change prompts appear correctly
- [ ] Skip invoice action and continue status change
- [ ] Re-prompt when moving to later stage after skip
- [ ] Hash comparison correctly detects changes

---

## Key Files Reference

### Backend - Existing (Study These Patterns)
- `/backend/web/src/utils/quickbooks/apiClient.ts` - Core QB API client
- `/backend/web/src/services/qbEstimateService.ts` - Order→QB conversion pattern
- `/backend/web/src/utils/quickbooks/entityResolver.ts` - Customer/tax resolution
- `/backend/web/src/services/gmailService.ts` - Email sending

### Backend - To Create
- `/backend/web/src/utils/quickbooks/invoiceClient.ts`
- `/backend/web/src/services/qbInvoiceService.ts`
- `/backend/web/src/controllers/qbInvoiceController.ts`
- `/backend/web/src/jobs/scheduledEmailJob.ts`

### Frontend - Existing (Integration Points)
- `/frontend/web/src/components/orders/OrderDetailsPage.tsx`
- `/frontend/web/src/components/orders/modals/StatusSelectModal.tsx`

### Frontend - To Create
- `/frontend/web/src/components/orders/InvoiceButton.tsx`
- `/frontend/web/src/components/orders/modals/InvoiceActionModal.tsx`
- `/frontend/web/src/components/orders/modals/LinkInvoiceModal.tsx`
- `/frontend/web/src/components/orders/modals/RecordPaymentModal.tsx`
- `/frontend/web/src/components/orders/modals/PaymentHistoryModal.tsx`

---

## Notes

- Follow existing 3-layer architecture: Route → Controller → Service → Repository
- Use `query()` helper for all database operations
- Maximum 500 lines per file - split if needed
- Test with QB sandbox before production
- Gmail API has 2,000 emails/day limit (sufficient for current volume)
