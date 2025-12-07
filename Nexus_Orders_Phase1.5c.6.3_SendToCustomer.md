# Phase 1.5.c.6.3: Send to Customer

**Status:** ✅ COMPLETE
**Priority:** HIGH
**Duration:** 6-10 hours (Actual: ~8 hours)
**Dependencies:** Phase 1.5.c.6.1 + 1.5.c.6.2 (Core + Prepare Steps)
**Completed:** 2025-11-25
**Last Updated:** 2025-11-25

---

## Overview

Phase 1.5.c.6.3 implements the final "Send to Customer" workflow:
1. Point person selection (checkboxes, all selected by default)
2. Email preview with template
3. Email sending (Gmail API placeholder)
4. Status update to `pending_confirmation`
5. Finalization history tracking

---

## Component Implementation

### Task 3.1: SendToCustomerPanel Component (2 hours)

**File:** `/frontend/web/src/components/orders/preparation/SendToCustomerPanel.tsx` (NEW)

```typescript
import React, { useEffect } from 'react';
import { PreparationState } from '@/types/orderPreparation';
import { PointPersonSelector } from './send/PointPersonSelector';
import { EmailPreview } from './send/EmailPreview';
import { ordersApi } from '@/services/api';

interface Props {
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const SendToCustomerPanel: React.FC<Props> = ({
  preparationState,
  onStateChange
}) => {
  // Load point persons on mount
  useEffect(() => {
    loadPointPersons();
  }, []);

  const loadPointPersons = async () => {
    try {
      const pointPersons = await ordersApi.getOrderPointPersons(preparationState.orderNumber);

      // Default all selected
      const pointPersonsWithSelection = pointPersons.map((pp: any) => ({
        id: pp.id,
        name: pp.contact_name,
        email: pp.contact_email,
        selected: true  // Default all selected
      }));

      onStateChange({
        ...preparationState,
        pointPersons: pointPersonsWithSelection
      });
    } catch (error) {
      console.error('Failed to load point persons:', error);
    }
  };

  const handlePersonToggle = (personId: number) => {
    onStateChange({
      ...preparationState,
      pointPersons: preparationState.pointPersons.map(p =>
        p.id === personId ? { ...p, selected: !p.selected } : p
      )
    });
  };

  const selectedPersons = preparationState.pointPersons.filter(p => p.selected);
  const selectedEmails = selectedPersons.map(p => p.email);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Send to Customer
        </h3>
        <p className="text-sm text-gray-600">
          Select recipients and review email before sending.
        </p>
      </div>

      {/* Point Person Selection */}
      <PointPersonSelector
        pointPersons={preparationState.pointPersons}
        onToggle={handlePersonToggle}
      />

      {/* Email Preview */}
      <EmailPreview
        orderNumber={preparationState.orderNumber}
        recipients={selectedEmails}
        orderFormUrl={preparationState.pdfs.orderForm.url}
        qbEstimateUrl={preparationState.pdfs.qbEstimate.url}
        qbEstimateNumber={preparationState.qbEstimate.number}
      />

      {/* Warning if no recipients */}
      {selectedPersons.length === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ No recipients selected. You can skip email sending or select at least one recipient.
          </p>
        </div>
      )}
    </div>
  );
};

export default SendToCustomerPanel;
```

---

### Task 3.2: PointPersonSelector Component (1 hour)

**File:** `/frontend/web/src/components/orders/preparation/send/PointPersonSelector.tsx` (NEW)

```typescript
import React from 'react';
import { Users, Mail } from 'lucide-react';

interface PointPerson {
  id: number;
  name: string;
  email: string;
  selected: boolean;
}

interface Props {
  pointPersons: PointPerson[];
  onToggle: (personId: number) => void;
}

export const PointPersonSelector: React.FC<Props> = ({
  pointPersons,
  onToggle
}) => {
  if (pointPersons.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600">
          No point persons found for this order.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Add point persons in the customer management section.
        </p>
      </div>
    );
  }

  const selectedCount = pointPersons.filter(p => p.selected).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold text-gray-900">Select Recipients</h4>
        </div>
        <span className="text-sm text-gray-600">
          {selectedCount} of {pointPersons.length} selected
        </span>
      </div>

      <div className="space-y-2">
        {pointPersons.map((person) => (
          <label
            key={person.id}
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              person.selected
                ? 'bg-indigo-50 border-indigo-300'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={person.selected}
              onChange={() => onToggle(person.id)}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{person.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 text-gray-500" />
                <p className="text-sm text-gray-600">{person.email}</p>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Select All / Deselect All */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => pointPersons.forEach(p => !p.selected && onToggle(p.id))}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Select All
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => pointPersons.forEach(p => p.selected && onToggle(p.id))}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Deselect All
        </button>
      </div>
    </div>
  );
};

export default PointPersonSelector;
```

---

### Task 3.3: EmailPreview Component (1.5 hours)

**File:** `/frontend/web/src/components/orders/preparation/send/EmailPreview.tsx` (NEW)

```typescript
import React from 'react';
import { Mail, Paperclip } from 'lucide-react';

interface Props {
  orderNumber: number;
  recipients: string[];
  orderFormUrl: string | null;
  qbEstimateUrl: string | null;
  qbEstimateNumber: string | null;
}

export const EmailPreview: React.FC<Props> = ({
  orderNumber,
  recipients,
  orderFormUrl,
  qbEstimateUrl,
  qbEstimateNumber
}) => {
  const subject = `Order #${orderNumber} Ready for Approval`;

  const attachments = [
    orderFormUrl && { name: `Order_${orderNumber}_Specs.pdf`, type: 'Order Form' },
    qbEstimateUrl && { name: `QB_Estimate_${qbEstimateNumber}.pdf`, type: 'QuickBooks Estimate' }
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-gray-600" />
        <h4 className="font-semibold text-gray-900">Email Preview</h4>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        {/* Email Header */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-gray-700 w-16">To:</span>
            <div className="flex-1">
              {recipients.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {recipients.map((email, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 bg-indigo-100 text-indigo-800 text-sm rounded"
                    >
                      {email}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-500">No recipients selected</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-gray-700 w-16">Subject:</span>
            <span className="text-sm text-gray-900">{subject}</span>
          </div>

          {attachments.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-gray-700 w-16">
                <Paperclip className="w-4 h-4 inline mr-1" />
                Attached:
              </span>
              <div className="flex-1 space-y-1">
                {attachments.map((att: any, i) => (
                  <div key={i} className="text-sm text-gray-600">
                    📎 {att.name} <span className="text-gray-400">({att.type})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Email Body Preview */}
        <div className="p-4 bg-white">
          <div className="prose prose-sm max-w-none">
            <p>Dear Customer,</p>

            <p>Your order is ready for review and approval:</p>

            <table className="border-collapse my-4">
              <tbody>
                <tr>
                  <td className="pr-4 py-1 font-semibold">Order Number:</td>
                  <td>#{orderNumber}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 font-semibold">Documents Attached:</td>
                  <td>{attachments.length} PDF{attachments.length !== 1 ? 's' : ''}</td>
                </tr>
              </tbody>
            </table>

            <p>
              Please review the attached documents. If you have any questions or need changes,
              please contact us.
            </p>

            <p>Thank you for your business!</p>

            <hr className="my-4 border-gray-200" />

            <p className="text-xs text-gray-500">
              SignHouse Manufacturing<br />
              This is an automated email. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder Notice */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800 font-medium">
          ⚠️ Email Sending Placeholder
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          Gmail API integration pending. Email template shown above will be implemented
          when Gmail API is configured.
        </p>
      </div>
    </div>
  );
};

export default EmailPreview;
```

---

### Task 3.4: Backend Finalization Service (2-3 hours)

**File:** `/backend/web/src/services/orderFinalizationService.ts` (NEW)

```typescript
import { query } from '../config/database';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
// import { gmailService } from './gmailService';  // Placeholder - not implemented yet

export class OrderFinalizationService {
  /**
   * Send order to customer and update status to pending_confirmation
   */
  async sendToCustomerAndFinalize(
    orderNumber: number,
    userId: number,
    options: {
      sendEmail: boolean;
      recipients: string[];
      orderFormPath?: string;
      qbEstimatePath?: string;
    }
  ): Promise<{
    success: boolean;
    emailSent: boolean;
    statusUpdated: boolean;
    message: string;
  }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get order ID
      const [orders] = await connection.execute<RowDataPacket[]>(
        'SELECT order_id, order_name, customer_id FROM orders WHERE order_number = ?',
        [orderNumber]
      );

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];

      let emailSent = false;

      // Send email if requested
      if (options.sendEmail && options.recipients.length > 0) {
        try {
          // PLACEHOLDER: Gmail API integration
          // await gmailService.sendFinalizationEmail({
          //   to: options.recipients,
          //   orderNumber,
          //   orderName: order.order_name,
          //   attachments: [options.orderFormPath, options.qbEstimatePath].filter(Boolean)
          // });

          console.log('[PLACEHOLDER] Email would be sent to:', options.recipients);
          emailSent = true;  // Simulate success
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          // Continue with finalization even if email fails
        }
      }

      // Update order status to pending_confirmation
      await connection.execute(
        `UPDATE orders
         SET status = 'pending_confirmation',
             updated_at = NOW()
         WHERE order_id = ?`,
        [order.order_id]
      );

      // Create status history entry
      const historyNote = options.sendEmail
        ? `Order sent to customer (${options.recipients.length} recipient(s))`
        : 'Order finalized without email (skipped)';

      await connection.execute(
        `INSERT INTO order_status_history
         (order_id, status, changed_by, changed_at, notes)
         VALUES (?, 'pending_confirmation', ?, NOW(), ?)`,
        [order.order_id, userId, historyNote]
      );

      // Record finalization in audit trail (if you have audit system)
      // await this.createAuditLog(order.order_id, userId, 'order_finalized', {
      //   emailSent,
      //   recipients: options.recipients
      // });

      await connection.commit();

      return {
        success: true,
        emailSent,
        statusUpdated: true,
        message: emailSent
          ? `Order finalized and sent to ${options.recipients.length} recipient(s)`
          : 'Order finalized (email skipped)'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get order point persons
   */
  async getOrderPointPersons(orderNumber: number): Promise<Array<{
    id: number;
    contact_name: string;
    contact_email: string;
  }>> {
    const [rows] = await query(
      `SELECT opp.id, opp.contact_name, opp.contact_email
       FROM order_point_persons opp
       JOIN orders o ON opp.order_id = o.order_id
       WHERE o.order_number = ?
       ORDER BY opp.contact_name`,
      [orderNumber]
    ) as RowDataPacket[];

    return rows.map(row => ({
      id: row.id,
      contact_name: row.contact_name,
      contact_email: row.contact_email
    }));
  }

  /**
   * Skip email and just update status
   */
  async skipEmailAndFinalize(
    orderNumber: number,
    userId: number
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.sendToCustomerAndFinalize(orderNumber, userId, {
      sendEmail: false,
      recipients: []
    });
  }
}

export const orderFinalizationService = new OrderFinalizationService();
```

---

### Task 3.5: Gmail Service Placeholder (1 hour)

**File:** `/backend/web/src/services/gmailService.ts` (NEW - PLACEHOLDER)

```typescript
/**
 * Gmail Service - PLACEHOLDER
 *
 * This service will handle email sending via Gmail API.
 * Implementation pending Gmail API setup.
 *
 * Setup Requirements:
 * 1. Create project in Google Cloud Console
 * 2. Enable Gmail API
 * 3. Create OAuth2 credentials
 * 4. Get refresh token (one-time authorization)
 * 5. Store credentials in .env:
 *    - GMAIL_CLIENT_ID
 *    - GMAIL_CLIENT_SECRET
 *    - GMAIL_REDIRECT_URI
 *    - GMAIL_REFRESH_TOKEN
 *    - GMAIL_SENDER_EMAIL
 *
 * See: https://developers.google.com/gmail/api/quickstart/nodejs
 */

interface EmailOptions {
  to: string[];
  subject: string;
  htmlBody: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

export class GmailService {
  /**
   * Send finalization email to customer
   * PLACEHOLDER - Will implement when Gmail API is configured
   */
  async sendFinalizationEmail(options: {
    to: string[];
    orderNumber: number;
    orderName: string;
    attachments: string[];
  }): Promise<boolean> {
    console.log('[PLACEHOLDER] Gmail.sendFinalizationEmail called:');
    console.log('  To:', options.to);
    console.log('  Order:', options.orderNumber, '-', options.orderName);
    console.log('  Attachments:', options.attachments);

    // TODO: Implement Gmail API sending
    // const gmail = google.gmail('v1');
    // const oauth2Client = this.getOAuth2Client();
    // const email = await this.buildEmail(options);
    // const result = await gmail.users.messages.send({
    //   auth: oauth2Client,
    //   userId: 'me',
    //   requestBody: { raw: email }
    // });

    // For now, simulate success
    return true;
  }

  /**
   * Build email HTML template
   */
  private buildEmailTemplate(
    orderNumber: number,
    orderName: string
  ): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #4F46E5;">Order Ready for Approval</h2>

          <p>Dear Customer,</p>

          <p>Your order is ready for review and approval:</p>

          <table style="border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; font-weight: bold;">Order Number:</td>
              <td style="padding: 8px;">#${orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Job Name:</td>
              <td style="padding: 8px;">${orderName}</td>
            </tr>
          </table>

          <p>Please review the attached documents and contact us if you have any questions.</p>

          <p>Thank you for your business!</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;"/>

          <p style="font-size: 12px; color: #666;">
            SignHouse Manufacturing<br/>
            This is an automated email. Please do not reply directly to this message.
          </p>
        </body>
      </html>
    `;
  }
}

export const gmailService = new GmailService();
```

**Note:** Add environment variable placeholders to `.env.example`:

```env
# Gmail API (Placeholder - Not Yet Configured)
# GMAIL_CLIENT_ID=your_gmail_client_id
# GMAIL_CLIENT_SECRET=your_gmail_client_secret
# GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback
# GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
# GMAIL_SENDER_EMAIL=orders@signhouse.com
```

---

### Task 3.6: Backend API Routes (1 hour)

**File:** `/backend/web/src/routes/orderPreparationRoutes.ts` (NEW)

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { orderFinalizationService } from '../services/orderFinalizationService';

const router = Router();

/**
 * GET /api/orders/:orderNumber/point-persons
 * Get point persons for order
 */
router.get('/:orderNumber/point-persons', authenticate, async (req, res) => {
  try {
    const orderNumber = parseInt(req.params.orderNumber);
    const pointPersons = await orderFinalizationService.getOrderPointPersons(orderNumber);

    res.json({
      success: true,
      data: pointPersons
    });
  } catch (error) {
    console.error('Error fetching point persons:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/orders/:orderNumber/send-to-customer
 * Send order to customer and finalize
 */
router.post('/:orderNumber/send-to-customer', authenticate, async (req, res) => {
  try {
    const orderNumber = parseInt(req.params.orderNumber);
    const userId = (req as any).user.user_id;
    const { sendEmail, recipients, orderFormPath, qbEstimatePath } = req.body;

    const result = await orderFinalizationService.sendToCustomerAndFinalize(
      orderNumber,
      userId,
      {
        sendEmail,
        recipients,
        orderFormPath,
        qbEstimatePath
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending to customer:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/orders/:orderNumber/skip-email-and-finalize
 * Skip email and just update status
 */
router.post('/:orderNumber/skip-email-and-finalize', authenticate, async (req, res) => {
  try {
    const orderNumber = parseInt(req.params.orderNumber);
    const userId = (req as any).user.user_id;

    const result = await orderFinalizationService.skipEmailAndFinalize(
      orderNumber,
      userId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error finalizing order:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
});

export default router;
```

**Register routes in main app:**

**File:** `/backend/web/src/app.ts` (MODIFY)

```typescript
import orderPreparationRoutes from './routes/orderPreparationRoutes';

// Add route
app.use('/api/orders', orderPreparationRoutes);
```

---

### Task 3.7: Frontend API Integration (0.5 hours)

**File:** `/frontend/web/src/services/api/orders/orderPreparationApi.ts` (MODIFY)

```typescript
// Add to existing orderPreparationApi

export const orderPreparationApi = {
  // ... existing methods

  /**
   * Get order point persons
   */
  async getOrderPointPersons(orderNumber: number) {
    const response = await apiClient.get(`/orders/${orderNumber}/point-persons`);
    return response.data.data;
  },

  /**
   * Send to customer and finalize
   */
  async sendToCustomerAndFinalize(
    orderNumber: number,
    options: {
      sendEmail: boolean;
      recipients: string[];
      orderFormPath?: string;
      qbEstimatePath?: string;
    }
  ) {
    const response = await apiClient.post(`/orders/${orderNumber}/send-to-customer`, options);
    return response.data.data;
  },

  /**
   * Skip email and just finalize
   */
  async skipEmailAndFinalize(orderNumber: number) {
    const response = await apiClient.post(`/orders/${orderNumber}/skip-email-and-finalize`);
    return response.data.data;
  }
};
```

---

### Task 3.8: Update PrepareOrderModal for Send Phase (1 hour)

**File:** `/frontend/web/src/components/orders/preparation/PrepareOrderModal.tsx` (MODIFY)

Add handlers for send phase:

```typescript
// Add to PrepareOrderModal component

const handleSendAndFinalize = async () => {
  try {
    const selectedRecipients = preparationState.pointPersons
      .filter(p => p.selected)
      .map(p => p.email);

    const sendEmail = selectedRecipients.length > 0;

    const result = await ordersApi.sendToCustomerAndFinalize(
      order.order_number,
      {
        sendEmail,
        recipients: selectedRecipients,
        orderFormPath: preparationState.pdfs.orderForm.url || undefined,
        qbEstimatePath: preparationState.pdfs.qbEstimate.url || undefined
      }
    );

    if (result.success) {
      onComplete();
      onClose();
    }
  } catch (error) {
    console.error('Error finalizing:', error);
    alert('Failed to finalize order: ' + (error as Error).message);
  }
};

const handleSkipEmail = async () => {
  try {
    const result = await ordersApi.skipEmailAndFinalize(order.order_number);

    if (result.success) {
      onComplete();
      onClose();
    }
  } catch (error) {
    console.error('Error finalizing:', error);
    alert('Failed to finalize order: ' + (error as Error).message);
  }
};

// Update footer button handlers
<button
  onClick={handleSkipEmail}
  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
>
  Skip Email
</button>
<button
  onClick={handleSendAndFinalize}
  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
>
  Send Email & Finalize
</button>
```

---

## Testing Checklist

### Pre-Testing
- [ ] Phase 1.5.c.6.1 complete (core infrastructure)
- [ ] Phase 1.5.c.6.2 complete (prepare steps)
- [ ] Order #200000 exists with status `job_details_setup`
- [ ] Order has point persons configured
- [ ] Backend and frontend servers running

### Test 1: Point Person Loading
- [ ] Open Prepare Order modal
- [ ] Complete all prepare steps
- [ ] Click "Next: Send to Customer"
- [ ] Point persons load automatically
- [ ] All point persons checked by default

### Test 2: Point Person Selection
- [ ] Uncheck one point person
- [ ] "N of M selected" count updates
- [ ] Click "Deselect All" → all unchecked
- [ ] Click "Select All" → all checked
- [ ] Selected recipients show in email preview

### Test 3: Email Preview
- [ ] Email preview shows correct:
  - To: field with selected recipients
  - Subject line with order number
  - Attachments (2 PDFs)
  - Email body template
- [ ] Placeholder warning displays

### Test 4: Skip Email
- [ ] Deselect all recipients
- [ ] Click "Skip Email" button
- [ ] Order status updates to `pending_confirmation`
- [ ] Status history created with "skipped" note
- [ ] Modal closes

### Test 5: Send Email & Finalize
- [ ] Select 2 point persons
- [ ] Click "Send Email & Finalize"
- [ ] Console logs show placeholder email sending
- [ ] Order status updates to `pending_confirmation`
- [ ] Status history shows recipient count
- [ ] Modal closes
- [ ] Order page refreshes

### Test 6: Status History
- [ ] Check database:
  ```sql
  SELECT * FROM order_status_history
  WHERE order_id = (SELECT order_id FROM orders WHERE order_number = 200000)
  ORDER BY changed_at DESC LIMIT 1;
  ```
- [ ] Latest entry has status `pending_confirmation`
- [ ] Notes include recipient info or "skipped"

### Test 7: Error Handling
- [ ] Disconnect backend
- [ ] Try to finalize
- [ ] Error message displays
- [ ] Modal stays open
- [ ] Can retry after backend reconnects

### Test 8: Full Workflow
- [ ] Open order #200000 (job_details_setup)
- [ ] Click "Prepare Order"
- [ ] Run all 6 preparation steps
- [ ] Click "Next: Send to Customer"
- [ ] Select recipients
- [ ] Review email preview
- [ ] Click "Send Email & Finalize"
- [ ] Verify order status changed
- [ ] Verify status history created
- [ ] Order page shows new status badge

---

## Success Criteria

Phase 1.5.c.6.3 is COMPLETE when:

1. ✅ SendToCustomerPanel component works
2. ✅ Point person selector loads and toggles correctly
3. ✅ Email preview displays with correct data
4. ✅ "Skip Email" button works (updates status only)
5. ✅ "Send Email & Finalize" button works (placeholder email + status)
6. ✅ Order status changes to `pending_confirmation`
7. ✅ Status history entry created
8. ✅ Modal closes and order page refreshes
9. ✅ Gmail service placeholder is clear and documented
10. ✅ All TypeScript types match
11. ✅ No console errors
12. ✅ All 8 tests pass

---

## Files Summary - Phase 1.5.c.6.3

### New Frontend Files (3 files, ~350 lines)
- SendToCustomerPanel.tsx (~80 lines)
- send/PointPersonSelector.tsx (~100 lines)
- send/EmailPreview.tsx (~120 lines)

### New Backend Files (2 files, ~300 lines)
- services/orderFinalizationService.ts (~150 lines)
- services/gmailService.ts (~100 lines - placeholder)
- routes/orderPreparationRoutes.ts (~100 lines)

### Modified Files (2 files)
- PrepareOrderModal.tsx (+50 lines)
- orderPreparationApi.ts (+30 lines)

**Total New Lines:** ~630 lines
**Complexity:** Medium (mostly UI + database, email is placeholder)

---

## Phase 1.5.c.6 Complete! 🎉

With Phase 1.5.c.6.3 complete, the entire Order Finalization workflow is ready:

✅ **Phase 1.5.c.6.1**: Core infrastructure with modal and step orchestration
✅ **Phase 1.5.c.6.2**: All 6 preparation steps (validation, QB estimate, PDFs, tasks)
✅ **Phase 1.5.c.6.3**: Send to customer with email preview and status update

**Total Implementation:**
- **3 sub-phases** for clearer development
- **~3,500 lines of code**
- **25+ components and services**
- **Manual QB estimate creation** with staleness detection
- **Individual step buttons** with parallel execution
- **Live PDF previews**
- **Point person selection**
- **Gmail API placeholder** (ready for future integration)

---

## Next Steps After Phase 1.5.c.6

1. **Test full workflow** end-to-end
2. **Deploy to staging** for user acceptance testing
3. **Gather feedback** on UX and workflow
4. **Phase 1.5.d**: Implement task generation system
5. **Gmail API**: Configure and implement email sending

---

**Document Status:** ✅ Ready for Implementation
**Dependencies:** Phase 1.5.c.6.1 + 1.5.c.6.2
**Completes:** Phase 1.5.c.6 (Order Finalization)
**Last Updated:** 2025-11-17
