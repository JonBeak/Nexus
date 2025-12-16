# Orders Page - Invoice System

> **⚠️ SUPERSEDED: See `Nexus_Orders_Phase2e_QBInvoiceAutomation.md` for current implementation**
>
> This document contains original planning notes. The actual implementation uses a **Hybrid Approach**:
> - QuickBooks handles invoice creation, storage, and payments
> - Nexus sends custom emails with QB invoice links
> - No local invoice storage beyond linking IDs
>
> **Status:** Phase 2.e in progress (2025-12-15)

---

## Original Planning Document (Historical Reference)

## Purpose
Define the invoice creation workflow, editing capabilities, QuickBooks integration format, and how invoices sync with the Master Order Object.

---

## Overview

Invoices are **created automatically** when an order is created and evolve with the order. They can be edited by managers, support custom line items, and integrate directly with QuickBooks.

### Key Principles
1. **Created at Order Initiation**: Invoice is generated in draft status when order is created (or 50% deposit invoice if required)
2. **Dynamic Updates**: Automatically updated when order parts/pricing change
3. **Manager Editable**: Line items can be modified, custom items added (in-line editing)
4. **QuickBooks as Source of Truth**: Invoice status, balance, and payments managed in QuickBooks
5. **QuickBooks Integration**: Create/update invoices in QuickBooks, send from QuickBooks
6. **Payment Terms Tracking**: Each customer has payment terms, due dates adjust accordingly
7. **Deposit Invoices**: Can send 50% deposit invoices after order confirmed by customer (manual, configurable per customer)
8. **Status Tracking**: Draft → Sent → Partially Paid → Paid (synced from QuickBooks)

---

## Invoice Lifecycle

```
Order Created
    ↓
[Invoice Auto-Created: DRAFT]
    • Populated from order parts
    • Totals calculated
    • Not sent to customer yet
    ↓
Order Confirmed by Customer
    ↓
[Invoice: DRAFT - Ready to Send]
    • Manager can edit if needed
    • Add custom items
    • Adjust pricing
    ↓
Job Shipped/Delivered
    ↓
[Invoice: SENT]
    • Sent to customer
    • Payment expected
    • Tracks due date
    ↓
Payment Received (Partial)
    ↓
[Invoice: PARTIALLY PAID]
    • Tracks outstanding balance
    ↓
Payment Received (Full)
    ↓
[Invoice: PAID]
    • Job complete
    • Move to Completed stage
```

---

## Invoice Data Structure

### TypeScript Interface

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;              // "INV-2025-0431"
  orderId: string;                    // FK to orders

  // === STATUS ===
  status: InvoiceStatus;
  createdDate: Date;
  sentDate?: Date;
  dueDate?: Date;                     // Typically 30 days from sent
  paidDate?: Date;

  // === CUSTOMER ===
  customerId: string;
  customerName: string;
  billingAddress: Address;
  pointPersonEmail: string[];          // Array of point person emails
  accountingEmail: string[];           // Customer accounting emails
  jobNumber?: string;                  // Customer's job reference
  poNumber?: string;                   // Customer's PO reference

  // === LINE ITEMS ===
  lineItems: InvoiceLineItem[];       // From order parts
  customLineItems: InvoiceLineItem[]; // Manually added

  // === FINANCIAL ===
  subtotal: number;
  taxRate: number;                    // From customer billing address
  taxAmount: number;
  total: number;

  // === PAYMENTS ===
  payments: Payment[];
  amountPaid: number;
  amountDue: number;

  // === TERMS ===
  paymentTerms: string;               // "On Receipt" (default), "Net 30", "50% deposit", etc.
  notes?: string;

  // === METADATA ===
  version: number;
  lastModifiedDate: Date;
  lastModifiedBy: string;

  // === QUICKBOOKS ===
  quickBooksId?: string;              // If synced
  lastSyncedToQB?: Date;
}

enum InvoiceStatus {
  DRAFT = 'draft',                    // Not sent yet
  SENT = 'sent',                      // Sent to customer
  PARTIALLY_PAID = 'partially_paid',  // Some payment received
  PAID = 'paid',                      // Fully paid
  OVERDUE = 'overdue',                // Past due date, unpaid
  CANCELLED = 'cancelled'             // Order cancelled
}

interface InvoiceLineItem {
  id: string;
  invoiceId: string;

  // === ITEM DETAILS ===
  itemName: string;                   // "24\" Channel Letters 'OPEN'"
  description: string;                // Detailed description (editable in-line)
  quantity: number;
  unitPrice: number;
  total: number;                      // quantity * unitPrice

  // === SOURCE ===
  isManuallyAdded: boolean;           // true if custom line item

  // === ESTIMATE DATA (for reference) ===
  calculationDisplay?: string;        // Grayed out column if auto-generated from Estimate

  // === QUICKBOOKS ===
  qbItemId?: string;                  // QB product/service ID
  qbItemName?: string;                // QB item name mapping
}

interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  reference?: string;                 // Check #, transaction ID
  notes?: string;
  recordedBy: string;                 // User ID
}

enum PaymentMethod {
  CASH = 'cash',
  CHECK = 'check',
  CREDIT_CARD = 'credit_card',
  E_TRANSFER = 'e_transfer',
  WIRE_TRANSFER = 'wire_transfer',
  QUICKBOOKS_PAYMENT = 'quickbooks_payment'
}
```

---

## Invoice Creation (Automatic)

### When Order is Created

```javascript
async function createInvoiceForOrder(order, customer) {
  // Auto-generate invoice number
  const invoiceNumber = await generateInvoiceNumber();  // "INV-2025-0431"

  // Convert order parts to invoice line items
  const lineItems = order.parts.map(part => ({
    id: generateId(),
    itemName: part.title,
    description: buildPartDescription(part),
    quantity: part.quantity,
    unitPrice: part.subtotal / part.quantity,
    total: part.subtotal,
    sourceType: 'order_part',
    sourceId: part.id,
    isManuallyAdded: false,
    calculationDisplay: extractCalculationDisplay(part),
    originalEstimateData: part.estimateLineItems
  }));

  // Calculate tax based on billing address
  const taxRate = await getTaxRate(customer.billingAddressId);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Create invoice
  const invoice = {
    id: generateId(),
    invoiceNumber,
    orderId: order.id,
    status: 'draft',
    createdDate: new Date(),
    customerId: customer.id,
    customerName: customer.company_name,
    billingAddress: customer.billingAddress,
    lineItems,
    customLineItems: [],
    subtotal,
    taxRate,
    taxAmount,
    total,
    payments: [],
    amountPaid: 0,
    amountDue: total,
    paymentTerms: customer.defaultPaymentTerms || 'Net 30',
    version: 1
  };

  await saveInvoice(invoice);

  // Link to order
  order.invoiceId = invoice.id;
  order.invoiceStatus = 'draft';
  await saveOrder(order);

  return invoice;
}
```

### Auto-Update on Order Changes

```javascript
async function syncInvoiceWithOrder(orderId) {
  const order = await getOrderById(orderId);
  const invoice = await getInvoiceById(order.invoiceId);

  // Only auto-update if invoice is still in draft
  if (invoice.status !== 'draft') {
    // Warn manager that invoice is sent but order changed
    await createAlert({
      type: 'warning',
      message: `Order ${order.orderNumber} changed but invoice already sent`,
      action: 'review_invoice'
    });
    return;
  }

  // Recalculate line items from current order parts
  const updatedLineItems = order.parts.map(part => {
    // Find existing line item for this part
    const existingItem = invoice.lineItems.find(item => item.sourceId === part.id);

    return {
      ...(existingItem || { id: generateId() }),
      itemName: part.title,
      description: buildPartDescription(part),
      quantity: part.quantity,
      unitPrice: part.subtotal / part.quantity,
      total: part.subtotal,
      sourceType: 'order_part',
      sourceId: part.id
    };
  });

  // Preserve custom line items
  invoice.lineItems = updatedLineItems;

  // Recalculate totals
  const subtotal = [...invoice.lineItems, ...invoice.customLineItems]
    .reduce((sum, item) => sum + item.total, 0);

  invoice.subtotal = subtotal;
  invoice.taxAmount = subtotal * invoice.taxRate;
  invoice.total = subtotal + invoice.taxAmount;
  invoice.amountDue = invoice.total - invoice.amountPaid;
  invoice.version++;

  await saveInvoice(invoice);
  await logTimelineEvent(orderId, `Invoice auto-updated to v${invoice.version}`);
}
```

---

## Invoice Editing UI

**NOTE**: Edit descriptions in-line (no separate Edit Line Item Modal). Edit form should be dynamic to allow for long, multi-line descriptions. Show a grayed out column for calculationDisplay if auto-generated from Estimate.

### Invoice Editor Modal

```
┌────────────────────────────────────────────────────────────────────────┐
│  EDIT INVOICE - INV-2025-0431                               [Save] [X] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Order: #200431       |  Customer: ABC Sign Company                   │
│  Status: [Draft ▼]    |  Due Date: [Nov 30, 2025 📅]                  │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  LINE ITEMS (From Order Parts)                                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Item                          Qty    Unit Price    Total      Action  │
│  ────────────────────────────────────────────────────────────────────  │
│  Channel Letters 'OPEN'                                                │
│  w/ LEDs, PS, UL               1      $2,450.00     $2,450.00  [Edit]  │
│                                                                         │
│  ACM Backer Panel              1        $450.00       $450.00  [Edit]  │
│  Black ACM, painted edges                                              │
│  ────────────────────────────────────────────────────────────────────  │
│                                                          [+ Add Custom Item]  │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  CUSTOM LINE ITEMS (Manually Added)                                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [+ Add Rush Fee]  [+ Add Shipping]  [+ Add Discount]  [+ Add Other]  │
│                                                                         │
│  (No custom items)                                                      │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  CALCULATION                                                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Subtotal:                                               $2,900.00     │
│  Tax (13% HST):                                            $377.00     │
│  ─────────────────────────────────────────────────────────────────     │
│  TOTAL:                                                  $3,277.00     │
│                                                                         │
│  Amount Paid:                                                $0.00     │
│  ─────────────────────────────────────────────────────────────────     │
│  AMOUNT DUE:                                             $3,277.00     │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  PAYMENT TERMS                                                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Terms: [Net 30 ▼]  (or custom: ________________________)             │
│                                                                         │
│  Notes: _______________________________________________________        │
│         _______________________________________________________        │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  ACTIONS                                                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Send Invoice to Customer]  [Export to QuickBooks]  [Preview PDF]    │
│  [Record Payment]             [View Payment History]                   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Edit Line Item Modal

```
┌────────────────────────────────────────────────────────────────────────┐
│  EDIT LINE ITEM                                          [Save] [Cancel]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Item Name (for invoice display):                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Channel Letters 'OPEN' w/ LEDs                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Description (appears on invoice):                                     │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Individual illuminated channel letters spelling "OPEN"            │ │
│  │ • 24" letter height                                               │ │
│  │ • White acrylic faces with red vinyl                             │ │
│  │ • Black aluminum returns                                          │ │
│  │ • LED illuminated with power supply                               │ │
│  │ • UL listed                                                        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Quantity: [1        ]                                                 │
│                                                                         │
│  Unit Price: [$2,450.00]                                               │
│                                                                         │
│  Total: $2,450.00 (calculated)                                         │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  ESTIMATE DATA (For Reference - Not Shown on Invoice)                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Original Calculation Display:                                         │
│  • 4 letters × 24" height                                              │
│  • Face: White acrylic @ $45/sq ft                                     │
│  • Returns: 4" depth, black aluminum                                   │
│  • LEDs: 48" total × $2.50/ft = $120                                   │
│  • Labor: 8 hours × $75/hr = $600                                      │
│                                                                         │
│  [This data is for your reference and audit purposes only]             │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Add Custom Line Item

```
┌────────────────────────────────────────────────────────────────────────┐
│  ADD CUSTOM LINE ITEM                                    [Add] [Cancel] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Type: [● Rush Fee] [ ] Shipping [ ] Discount [ ] Other                │
│                                                                         │
│  Item Name:                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Rush Processing Fee                                               │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Description (optional):                                                │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Expedited production to meet Nov 16 deadline                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Quantity: [1        ]                                                 │
│                                                                         │
│  Unit Price: [$300.00   ]                                              │
│                                                                         │
│  Total: $300.00                                                        │
│                                                                         │
│  [ ] Taxable                                                            │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## QuickBooks Integration

### Existing Integration
The system already has QuickBooks integration implemented in:
- `/backend/web/src/utils/quickbooks/apiClient.ts`
- `/backend/web/src/utils/quickbooks/oauthClient.ts`
- `/backend/web/src/utils/quickbooks/dbManager.ts`

### Phase 1: Manual Process
- Invoice auto-created in Nexus with 'draft' status
- Manager manually enters invoice into QuickBooks
- Manager manually updates payment status in Nexus
- Uses existing QB connection for customer data sync

### Phase 2: Automated Integration
- Leverage existing QB API integration
- Auto-create invoices in QB when order confirmed
- Sync payment status from QB
- Poll QB for updates every 30 minutes

### Export Format

QuickBooks expects a specific structure for estimates/invoices. We need to map our invoice data to QB format.

### QuickBooks Data Mapping

```typescript
interface QuickBooksInvoice {
  // Header
  CustomerRef: {
    value: string;        // QB customer ID
    name: string;
  };
  TxnDate: string;        // "2025-10-31"
  DueDate?: string;       // "2025-11-30"
  DocNumber: string;      // Our invoice number "INV-2025-0431"

  // Line Items
  Line: QuickBooksLineItem[];

  // Totals
  TotalAmt: number;
  Balance: number;

  // Terms
  SalesTermRef?: {
    value: string;        // QB payment terms ID
  };

  // Notes
  CustomerMemo?: {
    value: string;
  };

  // Tracking
  PrivateNote?: string;   // Internal notes
}

interface QuickBooksLineItem {
  DetailType: 'SalesItemLineDetail' | 'DiscountLineDetail';
  Amount: number;

  SalesItemLineDetail?: {
    ItemRef: {
      value: string;      // QB product/service item ID
      name: string;
    };
    Qty: number;
    UnitPrice: number;
    TaxCodeRef?: {
      value: string;      // QB tax code
    };
  };

  Description: string;
}
```

### Export Function

```javascript
async function exportInvoiceToQuickBooks(invoiceId) {
  const invoice = await getInvoiceById(invoiceId);
  const customer = await getCustomerById(invoice.customerId);

  // Check if customer exists in QuickBooks
  let qbCustomerId = customer.quickBooksId;
  if (!qbCustomerId) {
    // Create customer in QB first
    qbCustomerId = await createQuickBooksCustomer(customer);
    customer.quickBooksId = qbCustomerId;
    await saveCustomer(customer);
  }

  // Map invoice line items to QB format
  const qbLineItems = [];

  // Add order part line items
  for (const item of invoice.lineItems) {
    const qbItem = await mapToQuickBooksItem(item);
    qbLineItems.push({
      DetailType: 'SalesItemLineDetail',
      Amount: item.total,
      Description: `${item.itemName}\n${item.description}`,
      SalesItemLineDetail: {
        ItemRef: {
          value: qbItem.id,
          name: qbItem.name
        },
        Qty: item.quantity,
        UnitPrice: item.unitPrice
      }
    });
  }

  // Add custom line items
  for (const item of invoice.customLineItems) {
    const qbItem = await mapToQuickBooksItem(item);
    qbLineItems.push({
      DetailType: 'SalesItemLineDetail',
      Amount: item.total,
      Description: `${item.itemName}\n${item.description}`,
      SalesItemLineDetail: {
        ItemRef: {
          value: qbItem.id,
          name: qbItem.name
        },
        Qty: item.quantity,
        UnitPrice: item.unitPrice
      }
    });
  }

  // Build QB invoice object
  const qbInvoice = {
    CustomerRef: {
      value: qbCustomerId,
      name: customer.company_name
    },
    TxnDate: formatDate(invoice.createdDate),
    DueDate: invoice.dueDate ? formatDate(invoice.dueDate) : undefined,
    DocNumber: invoice.invoiceNumber,
    Line: qbLineItems,
    TotalAmt: invoice.total,
    Balance: invoice.amountDue,
    PrivateNote: `Nexus Order: ${invoice.orderId}`
  };

  // Send to QuickBooks API
  const qbResponse = await quickBooksAPI.createInvoice(qbInvoice);

  // Update our invoice with QB reference
  invoice.quickBooksId = qbResponse.Invoice.Id;
  invoice.lastSyncedToQB = new Date();
  await saveInvoice(invoice);

  await logTimelineEvent(invoice.orderId, `Invoice synced to QuickBooks (${qbResponse.Invoice.Id})`);

  return qbResponse;
}
```

### QuickBooks Item Mapping

We need a mapping table to convert our product types to QuickBooks items:

```sql
CREATE TABLE quickbooks_item_mappings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_type VARCHAR(50),           -- 'channel_letters', 'acm_panel', etc.
  quickbooks_item_id VARCHAR(50),     -- QB item ID
  quickbooks_item_name VARCHAR(255),  -- QB item name
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example data:
INSERT INTO quickbooks_item_mappings VALUES
  (1, 'channel_letters', 'QB123', 'Channel Letters - Custom', 'Custom fabricated channel letters'),
  (2, 'acm_panel', 'QB124', 'ACM Panel Fabrication', 'Aluminum composite panel'),
  (3, 'led_installation', 'QB125', 'LED Installation', 'LED module installation and wiring'),
  (4, 'rush_fee', 'QB126', 'Rush Fee', 'Expedited production fee'),
  (5, 'shipping', 'QB127', 'Shipping & Handling', 'Shipping and packaging');
```

### QB Item Selection

**NOTE**: We will NOT do Smart QB Item Selection. If you cannot find an item, just use "Custom Service" as the fallback QB item.

```javascript
async function mapToQuickBooksItem(lineItem) {
  // Check if we've already mapped this specific item
  if (lineItem.qbItemId) {
    return {
      id: lineItem.qbItemId,
      name: lineItem.qbItemName
    };
  }

  // Fallback: use Custom Service for all items
  const customServiceMapping = await getQBMapping('custom_service');
  return {
    id: customServiceMapping.quickbooks_item_id,
    name: customServiceMapping.quickbooks_item_name || 'Custom Service'
  };
}
```

---

## Payment Recording

**NOTE**: We will NOT record payments for now - just comment out this section for future implementation. Whenever we reference an invoice, we will call the QuickBooks API (need to be efficient with this) to find the current balance. Payments will be recorded directly into QuickBooks.

### Record Payment UI (Future Implementation)

```
┌────────────────────────────────────────────────────────────────────────┐
│  RECORD PAYMENT - INV-2025-0431                        [Save] [Cancel]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Invoice Total: $3,277.00                                              │
│  Already Paid:     $0.00                                               │
│  ─────────────────────────                                             │
│  Amount Due:    $3,277.00                                              │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Payment Amount: [$________] or [Pay Full Amount]                      │
│                                                                         │
│  Payment Date: [Nov 15, 2025 📅]                                       │
│                                                                         │
│  Payment Method:                                                        │
│  [● Cash] [ ] Check [ ] Credit Card [ ] E-Transfer [ ] Wire Transfer  │
│                                                                         │
│  Reference (Check #, Transaction ID):                                  │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ _________________________________________________________________ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Notes:                                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ _________________________________________________________________ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Payment Recording Logic

```javascript
async function recordPayment(invoiceId, paymentData) {
  const invoice = await getInvoiceById(invoiceId);
  const order = await getOrderById(invoice.orderId);

  // Validate payment amount
  if (paymentData.amount <= 0) {
    throw new Error('Payment amount must be positive');
  }

  if (paymentData.amount > invoice.amountDue) {
    throw new Error('Payment exceeds amount due');
  }

  // Create payment record
  const payment = {
    id: generateId(),
    invoiceId: invoice.id,
    amount: paymentData.amount,
    paymentDate: paymentData.paymentDate || new Date(),
    paymentMethod: paymentData.paymentMethod,
    reference: paymentData.reference,
    notes: paymentData.notes,
    recordedBy: paymentData.userId
  };

  invoice.payments.push(payment);

  // Update invoice amounts
  invoice.amountPaid += payment.amount;
  invoice.amountDue = invoice.total - invoice.amountPaid;

  // Update invoice status
  if (invoice.amountDue === 0) {
    invoice.status = 'paid';
    invoice.paidDate = payment.paymentDate;

    // Move order to Completed stage
    if (order.kanbanStage === 'awaiting_payment') {
      await moveOrderToStage(order.id, 'completed');
    }
  } else {
    invoice.status = 'partially_paid';
  }

  await saveInvoice(invoice);

  // Update order
  order.invoiceStatus = invoice.status;
  await saveOrder(order);

  // Log timeline
  await logTimelineEvent(order.id, `Payment received: $${payment.amount} via ${payment.paymentMethod}`);

  return invoice;
}
```

---

## Invoice PDF Generation

**NOTE**: We will NOT generate invoice PDFs ourselves. We will generate QuickBooks Invoices, and from QuickBooks we will generate and send the invoice PDFs with payment link and email. In the future, we may send directly from our app.

### Invoice PDF Structure (via QuickBooks)

QuickBooks will handle invoice PDF generation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        [COMPANY LOGO]                                    │
│                   [Company Name & Address]                               │
│              Phone: (555) 555-5555 | Email: info@company.com            │
│                                                                          │
│                            INVOICE                                       │
└─────────────────────────────────────────────────────────────────────────┘

Invoice #: INV-2025-0431                      Date: October 31, 2025
Order #: 200431                               Due Date: November 30, 2025
Job # (Customer): JOB-2025-123                PO #: PO-456789

BILL TO:
─────────────────────────────────
ABC Sign Company
Attn: John Smith
123 Main Street
Toronto, ON M1A 2B3
Phone: (555) 123-4567
Email: john@abcsign.com

─────────────────────────────────────────────────────────────────────────

DESCRIPTION                                    QTY    PRICE      AMOUNT
─────────────────────────────────────────────────────────────────────────
Channel Letters 'OPEN' w/ LEDs                  1    $2,450.00  $2,450.00
Individual illuminated channel letters
• 24" letter height
• White acrylic faces with red vinyl
• Black aluminum returns
• LED illuminated with power supply

ACM Backer Panel                                1      $450.00    $450.00
Black ACM with painted edges
• 36" H x 60" W

─────────────────────────────────────────────────────────────────────────
                                                    SUBTOTAL:    $2,900.00
                                          TAX (13% HST):          $377.00
─────────────────────────────────────────────────────────────────────────
                                                       TOTAL:    $3,277.00

                                              AMOUNT PAID:           $0.00
─────────────────────────────────────────────────────────────────────────
                                              BALANCE DUE:       $3,277.00

═══════════════════════════════════════════════════════════════════════

PAYMENT TERMS: Net 30 days

PAYMENT METHODS:
  • E-Transfer: payments@company.com
  • Check: Mail to address above
  • Credit Card: Call (555) 555-5555

NOTES:
Please include invoice number with payment.

Thank you for your business!

─────────────────────────────────────────────────────────────────────────
If you have any questions, please contact us at (555) 555-5555
```

---

## Email Integration

### Phase 1: Manual Email
- All emails sent manually
- Buttons open default email client
- No automated notifications

### Phase 2: Gmail API Integration
- Gmail API via Google Workspace account
- 2,000 emails/day limit (sufficient for current volume)
- OAuth2 authentication
- Automated notifications for status changes

**Note:** If email volume exceeds 2,000/day in future, migrate to SendGrid or AWS SES

---

## API Endpoints

```typescript
// Get invoice for order
GET /api/orders/:orderId/invoice
Response: Invoice

// Update invoice
PUT /api/invoices/:invoiceId
Body: { lineItems, customLineItems, paymentTerms, notes }
Response: { success: boolean, invoice: Invoice }

// Add custom line item
POST /api/invoices/:invoiceId/line-items
Body: InvoiceLineItem
Response: { success: boolean, invoice: Invoice }

// Edit line item
PUT /api/invoices/:invoiceId/line-items/:lineItemId
Body: { itemName, description, quantity, unitPrice }
Response: { success: boolean, invoice: Invoice }

// Delete custom line item
DELETE /api/invoices/:invoiceId/line-items/:lineItemId
Response: { success: boolean, invoice: Invoice }

// Record payment
POST /api/invoices/:invoiceId/payments
Body: Payment
Response: { success: boolean, invoice: Invoice }

// Send invoice to customer
POST /api/invoices/:invoiceId/send
Body: { email: string, message?: string }
Response: { success: boolean, sentDate: Date }

// Export to QuickBooks
POST /api/invoices/:invoiceId/export/quickbooks
Response: { success: boolean, quickBooksId: string }

// Generate invoice PDF
POST /api/invoices/:invoiceId/generate-pdf
Response: { fileUrl: string }
```

---

## Future Enhancements

### Partial Payment Plans
- Support for payment schedules (50% deposit, 50% on delivery)
- Automated reminders for upcoming payments

### QuickBooks Two-Way Sync
- Import payments recorded in QuickBooks
- Sync status updates back to Nexus

### Recurring Invoices
- For maintenance contracts or repeat orders
- Auto-generate based on schedule

### Invoice Templates
- Multiple template designs
- Customer-specific branding

---

## Next Steps

1. ✅ Define invoice structure and workflow (this document)
2. Implement invoice auto-creation on order initiation
3. Build invoice editing UI components
4. Create QuickBooks export functionality
5. Design invoice PDF template
6. Implement payment recording system

---

**Document Status**: Initial Planning - Complete
**Last Updated**: 2025-10-31
**Dependencies**: Nexus_Orders_JobStructure.md, Nexus_Orders_KanbanBoard.md
