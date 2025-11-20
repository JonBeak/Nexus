# Phase 1.5.a.5: Approve Estimate Modal Enhancements

**Status:** ✅ COMPLETE (2025-11-06)
**Priority:** High
**Actual Effort:** 8-11 hours (1-2 days)
**Dependencies:** Phase 1.5.a (Numbering Fix) - COMPLETE ✅

---

## FINAL DESIGN DECISION (2025-11-06)

**Hard Due Date/Time UI Approach:** **Always-Visible Time Input (Simplest)**
- Single time input field (type="time") **always visible**
- No checkbox or toggle required
- Empty field = no hard deadline (NULL in database)
- If user enters time: combines due_date + time → hard_due_date_time DATETIME
- Clean, simple UX without extra controls

**Rationale:** Simplest implementation, matches "optional" field behavior throughout the modal. Users can easily see and use the feature without extra steps.

---

## Overview

Enhance the Approve Estimate Modal with intelligent date calculations, customer contact management, and optional hard deadline support. This phase implements the final pieces needed for a production-ready order creation workflow.

---

## Requirements Summary

### 1. Auto-Calculate Due Date (Business Days)
- **Default due date** = Today + Customer's `default_turnaround` (business days)
- **Exclude weekends** (Saturday, Sunday)
- **Exclude company holidays** (from `company_holidays` table)
- **User can override** calculated date before submission
- **Visual indicator:** Show when user manually changes the auto-calculated date
- **Business days display:** Show calculation of how many business days the selected due date is from today (e.g., "15 business days from today")
- **Post-acceptance behavior:** Due date will update to acceptance date + turnaround days (manual overrides in modal don't affect this)

### 2. Optional Hard Due Date/Time
- **New field:** Hard Due Date Time (optional time input, HH:MM AM/PM format)
- **UI:** Single time input field (no checkbox)
- **Behavior:** If user enters a time, the due_date + time are combined into `orders.hard_due_date_time` (DATETIME)
- **Storage:** Combine due_date + time into `orders.hard_due_date_time` (DATETIME). If no time entered, field remains NULL.
- **Use case:** Rush orders with specific deadline times (e.g., "Must ship by 2:00 PM Friday")
- **Validation:** Time input only matters if due_date is set

### 3. Customer Contacts Management System
- **New table:** `customer_contacts` (support multiple contacts per customer)
- **Point Person dropdown:** Shows unique emails from customer contacts
- **Add New Contact:** Inline form with "Save for future use" checkbox
- **Fields:** Contact Name, Email, Phone (optional), Role (optional)
- **Future-proof:** Supports multiple point persons per customer

### 4. Additional Fields
- **Customer Job Number:** Optional text field for customer's internal job tracking

---

## Research Findings

### ✅ Database Schema - Ready to Use

#### Orders Table (ALL FIELDS EXIST!)
```sql
CREATE TABLE `orders` (
  `order_id` int NOT NULL AUTO_INCREMENT,
  `order_number` int NOT NULL,
  `order_name` varchar(255) NOT NULL,
  `customer_id` int NOT NULL,
  `customer_po` varchar(100) DEFAULT NULL,           ✅ EXISTS
  `customer_job_number` varchar(100) DEFAULT NULL,   ✅ EXISTS
  `point_person_email` varchar(255) DEFAULT NULL,    ✅ EXISTS
  `due_date` date DEFAULT NULL,                      ✅ EXISTS
  `hard_due_date_time` datetime DEFAULT NULL,        ✅ EXISTS (perfect!)
  -- ... other fields
  PRIMARY KEY (`order_id`)
) ENGINE=InnoDB;
```

**Key Finding:** The `hard_due_date_time` field already exists as DATETIME type - perfect for storing hard deadlines with time!

#### Company Holidays Table (EXISTS - 32 Active Holidays)
```sql
CREATE TABLE `company_holidays` (
  `holiday_id` int NOT NULL AUTO_INCREMENT,
  `holiday_name` varchar(100) DEFAULT NULL,
  `holiday_date` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`holiday_id`)
) ENGINE=InnoDB;
```

**Repository Method Available:**
- `TimeAnalyticsRepository.getHolidaysInRange(dateRange)` - Already implemented!

#### Customers Table (Default Turnaround Available)
```sql
CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `default_turnaround` int DEFAULT '10',  ✅ Business days default (10)
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB;
```

### ❌ What Needs to Be Built

1. **customer_contacts table** - Does not exist, needs creation
2. **Business days calculator** - No existing utility (will leverage holiday system)
3. **Customer contacts API** - New endpoints needed
4. **Modal enhancements** - Significant UI updates required

---

## Implementation Plan

### Phase 1: Database Migration
**Time:** 30 minutes
**File:** `/home/jon/Nexus/database/migrations/2025-11-06_customer_contacts.sql`

#### Create Customer Contacts Table
```sql
CREATE TABLE IF NOT EXISTS customer_contacts (
  contact_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  contact_role VARCHAR(100) COMMENT 'e.g., Project Manager, Owner, Foreman, Admin',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,

  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,

  INDEX idx_customer (customer_id),
  INDEX idx_email (contact_email),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Design Decisions:**
- ✅ Emails CAN be duplicated (same email for multiple contacts)
- ✅ Dropdown shows UNIQUE emails only (`SELECT DISTINCT contact_email`)
- ✅ Soft delete support via `is_active` flag
- ✅ Audit trail with `created_by` and `updated_by`

#### Sample Data (Testing)
```sql
-- Insert sample contacts for first 3 customers
INSERT INTO customer_contacts (customer_id, contact_name, contact_email, contact_phone, contact_role, created_by)
SELECT
  c.customer_id,
  CONCAT(c.contact_first_name, ' ', c.contact_last_name),
  c.email,
  c.phone,
  'Primary Contact',
  1
FROM customers c
WHERE c.customer_id <= 3
LIMIT 3;
```

#### Run Migration
```bash
mysql -u webuser -pwebpass123 sign_manufacturing < /home/jon/Nexus/database/migrations/2025-11-06_customer_contacts.sql
```

---

### Phase 2: Business Days Calculator Utility
**Time:** 1.5 hours
**File:** `/home/jon/Nexus/backend/web/src/utils/businessDaysCalculator.ts` (NEW)

#### Implementation
```typescript
import { TimeAnalyticsRepository } from '../repositories/timeManagement/TimeAnalyticsRepository';

export class BusinessDaysCalculator {
  /**
   * Calculate target date by adding business days (excluding weekends and holidays)
   * @param startDate - Starting date (e.g., today)
   * @param businessDays - Number of business days to add
   * @returns Target date after adding business days
   */
  static async calculateDueDate(startDate: Date, businessDays: number): Promise<Date> {
    if (businessDays <= 0) {
      return new Date(startDate);
    }

    // Get holidays for next 90 days (buffer for calculation)
    const endBuffer = new Date(startDate);
    endBuffer.setDate(endBuffer.getDate() + (businessDays * 2 + 30)); // Buffer for weekends/holidays

    const holidays = await TimeAnalyticsRepository.getHolidaysInRange({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endBuffer)
    });

    const holidaySet = new Set(
      holidays.map(h => this.formatDate(new Date(h.holiday_date)))
    );

    // Add business days
    let currentDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);

      // Skip weekends
      if (this.isWeekend(currentDate)) {
        continue;
      }

      // Skip holidays
      if (this.isHoliday(currentDate, holidaySet)) {
        continue;
      }

      // This is a valid business day
      daysAdded++;
    }

    return currentDate;
  }

  /**
   * Check if date is a weekend (Saturday or Sunday)
   */
  static isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
  }

  /**
   * Check if date is a company holiday
   */
  static isHoliday(date: Date, holidaySet: Set<string>): boolean {
    return holidaySet.has(this.formatDate(date));
  }

  /**
   * Format date as YYYY-MM-DD
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
```

#### Usage Example
```typescript
// Calculate due date: Today + 10 business days
const today = new Date();
const dueDate = await BusinessDaysCalculator.calculateDueDate(today, 10);
console.log(`Due date: ${dueDate.toISOString().split('T')[0]}`);
// Example output: "2025-11-20" (skipped weekends + holidays)
```

---

### Phase 3: Customer Contacts Backend
**Time:** 2 hours

#### 3.1 Type Definitions
**File:** `/home/jon/Nexus/backend/web/src/types/customerContacts.ts` (NEW)

```typescript
export interface CustomerContact {
  contact_id: number;
  customer_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
  is_active: boolean;
  notes?: string;
  created_at: Date;
  created_by?: number;
  updated_at: Date;
  updated_by?: number;
}

export interface CreateCustomerContactData {
  customer_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
  notes?: string;
}

export interface CustomerContactWithDetails extends CustomerContact {
  // For dropdown display: "email (name - role)"
  display_text: string;
}
```

#### 3.2 Repository Layer
**File:** `/home/jon/Nexus/backend/web/src/repositories/customerContactRepository.ts` (NEW)

```typescript
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { CustomerContact, CreateCustomerContactData } from '../types/customerContacts';

export class CustomerContactRepository {
  /**
   * Get unique emails for customer (for dropdown)
   */
  static async getUniqueEmailsForCustomer(customerId: number): Promise<string[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT contact_email
       FROM customer_contacts
       WHERE customer_id = ? AND is_active = TRUE
       ORDER BY contact_email ASC`,
      [customerId]
    );
    return rows.map(r => r.contact_email);
  }

  /**
   * Get all contacts for customer with full details
   */
  static async getContactsForCustomer(customerId: number): Promise<CustomerContact[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM customer_contacts
       WHERE customer_id = ? AND is_active = TRUE
       ORDER BY contact_name ASC`,
      [customerId]
    );
    return rows as CustomerContact[];
  }

  /**
   * Get contact details by email (for populating form)
   */
  static async getContactByEmail(
    customerId: number,
    email: string
  ): Promise<CustomerContact | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM customer_contacts
       WHERE customer_id = ? AND contact_email = ? AND is_active = TRUE
       LIMIT 1`,
      [customerId, email]
    );
    return rows.length > 0 ? (rows[0] as CustomerContact) : null;
  }

  /**
   * Create new customer contact
   */
  static async createContact(
    data: CreateCustomerContactData,
    userId: number
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO customer_contacts
       (customer_id, contact_name, contact_email, contact_phone, contact_role, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.customer_id,
        data.contact_name,
        data.contact_email,
        data.contact_phone || null,
        data.contact_role || null,
        data.notes || null,
        userId
      ]
    );
    return result.insertId;
  }

  /**
   * Check if email already exists for customer
   */
  static async emailExistsForCustomer(
    customerId: number,
    email: string
  ): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM customer_contacts
       WHERE customer_id = ? AND contact_email = ? AND is_active = TRUE`,
      [customerId, email]
    );
    return rows[0].count > 0;
  }
}
```

#### 3.3 Controller Layer
**File:** `/home/jon/Nexus/backend/web/src/controllers/customerContactController.ts` (NEW)

```typescript
import { Request, Response } from 'express';
import { CustomerContactRepository } from '../repositories/customerContactRepository';

/**
 * Get unique emails for customer (dropdown)
 * GET /api/customers/:customerId/contacts/emails
 */
export const getCustomerContactEmails = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const emails = await CustomerContactRepository.getUniqueEmailsForCustomer(customerId);

    res.json({ success: true, emails });
  } catch (error) {
    console.error('Error fetching customer contact emails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact emails'
    });
  }
};

/**
 * Get all contacts for customer (with full details)
 * GET /api/customers/:customerId/contacts
 */
export const getCustomerContacts = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const contacts = await CustomerContactRepository.getContactsForCustomer(customerId);

    res.json({ success: true, contacts });
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts'
    });
  }
};

/**
 * Create new customer contact
 * POST /api/customers/:customerId/contacts
 */
export const createCustomerContact = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const userId = (req as any).user.userId;

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const { contact_name, contact_phone, contact_email, contact_role, notes } = req.body;

    // Validation
    if (!contact_name || !contact_email) {
      return res.status(400).json({
        success: false,
        message: 'Contact name and email are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const contactId = await CustomerContactRepository.createContact(
      {
        customer_id: customerId,
        contact_name: contact_name.trim(),
        contact_email: contact_email.trim(),
        contact_phone: contact_phone?.trim(),
        contact_role: contact_role?.trim(),
        notes: notes?.trim()
      },
      userId
    );

    res.json({
      success: true,
      contact_id: contactId,
      message: 'Contact created successfully'
    });
  } catch (error) {
    console.error('Error creating customer contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contact'
    });
  }
};
```

#### 3.4 Routes
**File:** `/home/jon/Nexus/backend/web/src/routes/customers.ts` (MODIFY)

Add these imports at the top:
```typescript
import * as customerContactController from '../controllers/customerContactController';
```

Add these routes (in appropriate section after existing customer routes):
```typescript
/**
 * Get unique emails for customer contacts (dropdown)
 * GET /api/customers/:customerId/contacts/emails
 */
router.get(
  '/:customerId/contacts/emails',
  authenticateToken,
  requirePermission('orders.create'),
  customerContactController.getCustomerContactEmails
);

/**
 * Get all contacts for customer
 * GET /api/customers/:customerId/contacts
 */
router.get(
  '/:customerId/contacts',
  authenticateToken,
  requirePermission('customers.view'),
  customerContactController.getCustomerContacts
);

/**
 * Create new customer contact
 * POST /api/customers/:customerId/contacts
 */
router.post(
  '/:customerId/contacts',
  authenticateToken,
  requirePermission('customers.update'),
  customerContactController.createCustomerContact
);
```

---

### Phase 4: Order Conversion Enhancement
**Time:** 1 hour

#### 4.1 Update Type Definitions
**File:** `/home/jon/Nexus/backend/web/src/types/orders.ts` (MODIFY)

Update `ConvertEstimateRequest` interface:
```typescript
export interface ConvertEstimateRequest {
  estimateId: number;
  orderName: string;
  customerPo?: string;
  customerJobNumber?: string;        // NEW - Customer's internal job number
  dueDate?: string;                  // ISO date string (YYYY-MM-DD)
  hardDueDateTime?: string;          // NEW - ISO datetime string (YYYY-MM-DDTHH:MM:SS)
  pointPersonEmail?: string;
  productionNotes?: string;
  estimatePreviewData?: EstimatePreviewData;
}
```

#### 4.2 Update Order Conversion Service
**File:** `/home/jon/Nexus/backend/web/src/services/orderConversionService.ts` (MODIFY)

Find the order creation section and update to include new fields:

```typescript
// Around line 80-120 where order is created
const [orderResult] = await connection.execute<ResultSetHeader>(
  `INSERT INTO orders (
    order_number,
    order_name,
    customer_id,
    customer_po,
    customer_job_number,        -- ADD THIS
    point_person_email,
    order_date,
    due_date,
    hard_due_date_time,         -- ADD THIS
    production_notes,
    status,
    estimate_id,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    orderNumber,
    orderName,
    customerId,
    customerPo || null,
    customerJobNumber || null,                    // ADD THIS
    pointPersonEmail || null,
    new Date(),
    dueDate || null,
    hardDueDateTime || null,                      // ADD THIS
    productionNotes || null,
    'job_details_setup',
    estimateId,
    userId
  ]
);
```

Update function signature to accept new fields:
```typescript
async convertEstimateToOrder(
  estimateId: number,
  orderName: string,
  customerPo: string | undefined,
  customerJobNumber: string | undefined,  // ADD THIS
  dueDate: string | undefined,
  hardDueDateTime: string | undefined,    // ADD THIS
  pointPersonEmail: string | undefined,
  productionNotes: string | undefined,
  estimatePreviewData: EstimatePreviewData | undefined,
  userId: number
): Promise<{ orderId: number; orderNumber: number }> {
  // ... rest of implementation
}
```

Update controller call:
```typescript
// In orderConversionController.ts
const result = await OrderConversionService.convertEstimateToOrder(
  estimateId,
  orderName,
  customerPo,
  customerJobNumber,    // ADD THIS
  dueDate,
  hardDueDateTime,      // ADD THIS
  pointPersonEmail,
  productionNotes,
  estimatePreviewData,
  userId
);
```

---

### Phase 5: Frontend Modal Enhancement
**Time:** 3 hours
**File:** `/home/jon/Nexus/frontend/web/src/components/orders/modals/ApproveEstimateModal.tsx` (MAJOR MODIFY)

#### 5.1 Add New State Variables

Add these to the component state (around line 30-50):
```typescript
// Existing state...
const [customerJobNumber, setCustomerJobNumber] = useState('');

// Due Date Tracking
const [autoCalculatedDate, setAutoCalculatedDate] = useState<string>(''); // Track auto-calculated date
const [dueDateManuallyChanged, setDueDateManuallyChanged] = useState(false);
const [businessDaysFromToday, setBusinessDaysFromToday] = useState<number | null>(null);

// Hard Due Date/Time (optional time input, no checkbox)
const [hardDueTime, setHardDueTime] = useState(''); // Empty = no hard time

// Customer Contacts
const [contactEmails, setContactEmails] = useState<string[]>([]);
const [selectedContactEmail, setSelectedContactEmail] = useState('');
const [isCustomContact, setIsCustomContact] = useState(false);
const [customContactName, setCustomContactName] = useState('');
const [customContactPhone, setCustomContactPhone] = useState('');
const [customContactRole, setCustomContactRole] = useState('');
const [saveCustomContact, setSaveCustomContact] = useState(true);
```

#### 5.2 Add useEffect for Due Date Calculation

```typescript
// Calculate default due date when modal opens
useEffect(() => {
  if (isOpen && estimate && !dueDate) {
    // Fetch customer's default turnaround
    apiClient.get(`/customers/${estimate.customer_id}`)
      .then(response => {
        const customer = response.data.customer;
        const turnaroundDays = customer.default_turnaround || 10;

        // Calculate due date: today + turnaround business days
        const today = new Date();
        apiClient.post('/orders/calculate-due-date', {
          startDate: today.toISOString().split('T')[0],
          turnaroundDays: turnaroundDays
        })
        .then(calcResponse => {
          const calculatedDate = calcResponse.data.dueDate;
          setDueDate(calculatedDate);
          setAutoCalculatedDate(calculatedDate); // Track auto-calculated date
          setBusinessDaysFromToday(turnaroundDays);
          setDueDateManuallyChanged(false); // Reset flag
        })
        .catch(error => {
          console.error('Error calculating due date:', error);
          // Fallback: today + (turnaroundDays * 1.5) calendar days
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + Math.ceil(turnaroundDays * 1.5));
          const fallbackDate = fallback.toISOString().split('T')[0];
          setDueDate(fallbackDate);
          setAutoCalculatedDate(fallbackDate);
        });
      })
      .catch(error => {
        console.error('Error fetching customer:', error);
      });
  }
}, [isOpen, estimate]);
```

#### 5.3 Add useEffect for Business Days Calculation

```typescript
// Calculate business days whenever due date changes (auto-calculated OR manually entered)
useEffect(() => {
  if (dueDate) {
    const today = new Date();
    apiClient.post('/orders/calculate-business-days', {
      startDate: today.toISOString().split('T')[0],
      endDate: dueDate
    })
    .then(response => {
      setBusinessDaysFromToday(response.data.businessDays);
    })
    .catch(error => {
      console.error('Error calculating business days:', error);
      setBusinessDaysFromToday(null);
    });

    // Check if manually changed from auto-calculated value
    if (autoCalculatedDate && dueDate !== autoCalculatedDate) {
      setDueDateManuallyChanged(true);
    } else {
      setDueDateManuallyChanged(false);
    }
  } else {
    setBusinessDaysFromToday(null);
    setDueDateManuallyChanged(false);
  }
}, [dueDate, autoCalculatedDate]);
```

#### 5.4 Add useEffect for Customer Contacts

```typescript
// Fetch customer contact emails when modal opens (sorted alphabetically)
useEffect(() => {
  if (isOpen && estimate) {
    apiClient.get(`/customers/${estimate.customer_id}/contacts/emails`)
      .then(response => {
        setContactEmails(response.data.emails || []); // Backend sorts alphabetically
      })
      .catch(error => {
        console.error('Error fetching contact emails:', error);
        setContactEmails([]);
      });
  }
}, [isOpen, estimate]);
```

#### 5.5 Update JSX - Add New Fields

Replace the existing form fields section with enhanced version:

```typescript
{/* Customer Job Number */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Customer Job Number
  </label>
  <input
    type="text"
    value={customerJobNumber}
    onChange={(e) => setCustomerJobNumber(e.target.value)}
    disabled={loading}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
    placeholder="Customer's internal job reference"
  />
  <p className="mt-1 text-xs text-gray-500">
    Optional: Customer's internal job tracking number
  </p>
</div>

{/* Customer PO */}
{/* ... existing field ... */}

{/* Due Date */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Due Date
  </label>
  <input
    type="date"
    value={dueDate}
    onChange={(e) => setDueDate(e.target.value)}
    disabled={loading}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
  />
  {/* Business Days Display */}
  {businessDaysFromToday !== null && (
    <p className="mt-1 text-xs text-gray-600">
      {businessDaysFromToday} business days from today
      {dueDateManuallyChanged && (
        <span className="ml-2 text-amber-600 font-medium">
          (manually adjusted)
        </span>
      )}
    </p>
  )}
  <p className="mt-1 text-xs text-gray-500">
    Auto-calculated from customer's default turnaround (business days, excluding weekends & holidays)
  </p>
</div>

{/* Hard Due Date Time (optional time input) */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Hard Due Date Time (optional)
  </label>
  <input
    type="time"
    value={hardDueTime}
    onChange={(e) => setHardDueTime(e.target.value)}
    disabled={loading}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
    placeholder="--:--"
  />
  <p className="mt-1 text-xs text-gray-500">
    Optional: Specify exact time for deadline (e.g., 2:00 PM for rush jobs)
  </p>
</div>

{/* Point Person Email - Dropdown with Add New */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Point Person Email
  </label>
  {!isCustomContact ? (
    <select
      value={selectedContactEmail}
      onChange={(e) => {
        if (e.target.value === '__ADD_NEW__') {
          setIsCustomContact(true);
          setSelectedContactEmail('');
          setPointPersonEmail('');
        } else {
          setSelectedContactEmail(e.target.value);
          setPointPersonEmail(e.target.value);
        }
      }}
      disabled={loading}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
    >
      <option value="">Select contact email...</option>
      <option value="__ADD_NEW__">➕ Add New Contact</option>
      {contactEmails.map(email => (
        <option key={email} value={email}>{email}</option>
      ))}
    </select>
  ) : (
    <div className="space-y-2">
      {/* Custom Contact Email */}
      <input
        type="email"
        value={pointPersonEmail}
        onChange={(e) => setPointPersonEmail(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
        placeholder="contact@customer.com"
      />

      {/* Contact Name */}
      <input
        type="text"
        value={customContactName}
        onChange={(e) => setCustomContactName(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
        placeholder="Contact Name (required for new contact)"
      />

      {/* Contact Phone */}
      <input
        type="tel"
        value={customContactPhone}
        onChange={(e) => setCustomContactPhone(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
        placeholder="Contact Phone (optional)"
      />

      {/* Contact Role */}
      <select
        value={customContactRole}
        onChange={(e) => setCustomContactRole(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
      >
        <option value="">Contact Role (optional)</option>
        <option value="Project Manager">Project Manager</option>
        <option value="Owner">Owner</option>
        <option value="Foreman">Foreman</option>
        <option value="Admin">Admin</option>
        <option value="Other">Other</option>
      </select>

      {/* Save Contact Checkbox */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={saveCustomContact}
          onChange={(e) => setSaveCustomContact(e.target.checked)}
          disabled={loading}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        Save this contact for future orders
      </label>

      {/* Back Button */}
      <button
        type="button"
        onClick={() => {
          setIsCustomContact(false);
          setPointPersonEmail('');
          setCustomContactName('');
          setCustomContactPhone('');
          setCustomContactRole('');
        }}
        disabled={loading}
        className="text-sm text-purple-600 hover:text-purple-700"
      >
        ← Back to contact list
      </button>
    </div>
  )}
</div>
```

#### 5.6 Update handleApprove Function

```typescript
const handleApprove = async () => {
  // Existing validation...

  // If custom contact with save checkbox, create contact first
  if (isCustomContact && saveCustomContact && customContactName.trim()) {
    try {
      await apiClient.post(`/customers/${estimate.customer_id}/contacts`, {
        contact_name: customContactName.trim(),
        contact_email: pointPersonEmail.trim(),
        contact_phone: customContactPhone.trim() || undefined,
        contact_role: customContactRole || undefined
      });
      console.log('✅ Custom contact saved successfully');
    } catch (err) {
      console.error('Error saving contact:', err);
      // Don't block order creation if contact save fails
    }
  }

  // Prepare hard due date time (combine date + time if user entered a time)
  let hardDueDateTime = undefined;
  if (dueDate && hardDueTime.trim()) {
    hardDueDateTime = `${dueDate}T${hardDueTime}:00`;
  }

  try {
    setLoading(true);
    setError('');

    // Call order conversion API
    const response = await apiClient.post('/orders/convert-estimate', {
      estimateId: estimate.estimate_id,
      orderName: orderName.trim(),
      customerPo: customerPo.trim() || undefined,
      customerJobNumber: customerJobNumber.trim() || undefined,  // NEW
      dueDate: dueDate || undefined,
      hardDueDateTime: hardDueDateTime,                          // NEW
      pointPersonEmail: pointPersonEmail.trim() || undefined,
      estimatePreviewData
    });

    if (response.data.success) {
      onSuccess(response.data.order_number);
      handleClose();
    } else {
      setError(response.data.message || 'Failed to convert estimate');
    }
  } catch (err: any) {
    console.error('Error converting estimate:', err);
    setError(err.response?.data?.message || 'Failed to convert estimate to order');
  } finally {
    setLoading(false);
  }
};
```

#### 5.7 Update Reset Function

```typescript
const handleClose = () => {
  setOrderName('');
  setCustomerPo('');
  setCustomerJobNumber('');           // NEW
  setDueDate('');
  setAutoCalculatedDate('');          // NEW
  setDueDateManuallyChanged(false);   // NEW
  setBusinessDaysFromToday(null);     // NEW
  setHardDueTime('');                 // NEW (empty = no hard time)
  setPointPersonEmail('');
  setContactEmails([]);               // NEW
  setSelectedContactEmail('');        // NEW
  setIsCustomContact(false);          // NEW
  setCustomContactName('');           // NEW
  setCustomContactPhone('');          // NEW
  setCustomContactRole('');           // NEW
  setSaveCustomContact(true);         // NEW
  setError('');
  setValidationError('');
  onClose();
};
```

---

### Phase 6: Add Backend Endpoint for Due Date Calculation
**Time:** 30 minutes

#### 6.1 Add Controller Method
**File:** `/home/jon/Nexus/backend/web/src/controllers/orderController.ts` (MODIFY)

Add this method:
```typescript
/**
 * Calculate due date based on business days
 * POST /api/orders/calculate-due-date
 */
export const calculateDueDate = async (req: Request, res: Response) => {
  try {
    const { startDate, turnaroundDays } = req.body;

    if (!startDate || !turnaroundDays) {
      return res.status(400).json({
        success: false,
        message: 'startDate and turnaroundDays are required'
      });
    }

    const start = new Date(startDate);
    const days = parseInt(turnaroundDays);

    if (isNaN(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'turnaroundDays must be a positive number'
      });
    }

    const dueDate = await BusinessDaysCalculator.calculateDueDate(start, days);

    res.json({
      success: true,
      dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
      businessDaysCalculated: days
    });
  } catch (error) {
    console.error('Error calculating due date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate due date'
    });
  }
};
```

Add this second method (for calculating business days between two dates):
```typescript
/**
 * Calculate business days between two dates
 * POST /api/orders/calculate-business-days
 */
export const calculateBusinessDays = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.json({
        success: true,
        businessDays: 0
      });
    }

    // Calculate difference in calendar days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Use BusinessDaysCalculator to count business days
    const holidays = await TimeAnalyticsRepository.getHolidaysInRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });

    const holidaySet = new Set(
      holidays.map(h => new Date(h.holiday_date).toISOString().split('T')[0])
    );

    let businessDays = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];

      // Count if not weekend and not holiday
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
        businessDays++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      businessDays
    });
  } catch (error) {
    console.error('Error calculating business days:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate business days'
    });
  }
};
```

Add imports at top:
```typescript
import { BusinessDaysCalculator } from '../utils/businessDaysCalculator';
import { TimeAnalyticsRepository } from '../repositories/timeManagement/TimeAnalyticsRepository';
```

#### 6.2 Add Routes
**File:** `/home/jon/Nexus/backend/web/src/routes/orders.ts` (MODIFY)

```typescript
/**
 * Calculate due date with business days
 * POST /api/orders/calculate-due-date
 */
router.post(
  '/calculate-due-date',
  authenticateToken,
  requirePermission('orders.create'),
  orderController.calculateDueDate
);

/**
 * Calculate business days between two dates
 * POST /api/orders/calculate-business-days
 */
router.post(
  '/calculate-business-days',
  authenticateToken,
  requirePermission('orders.create'),
  orderController.calculateBusinessDays
);
```

---

### Phase 7: Frontend API Client Updates
**Time:** 15 minutes
**File:** `/home/jon/Nexus/frontend/web/src/services/api.ts` (MODIFY)

Add these methods to the appropriate section:
```typescript
// Customer Contacts API
export const customerContactsApi = {
  getEmails: async (customerId: number) => {
    const response = await apiClient.get(`/customers/${customerId}/contacts/emails`);
    return response.data;
  },

  getContacts: async (customerId: number) => {
    const response = await apiClient.get(`/customers/${customerId}/contacts`);
    return response.data;
  },

  createContact: async (customerId: number, contactData: any) => {
    const response = await apiClient.post(`/customers/${customerId}/contacts`, contactData);
    return response.data;
  }
};

// Orders API - Add to existing orders section
export const ordersApi = {
  // ... existing methods ...

  calculateDueDate: async (startDate: string, turnaroundDays: number) => {
    const response = await apiClient.post('/orders/calculate-due-date', {
      startDate,
      turnaroundDays
    });
    return response.data;
  },

  calculateBusinessDays: async (startDate: string, endDate: string) => {
    const response = await apiClient.post('/orders/calculate-business-days', {
      startDate,
      endDate
    });
    return response.data;
  }
};
```

---

## Testing Checklist

### Backend Testing

#### Database Migration
- [ ] Run migration script successfully
- [ ] Verify `customer_contacts` table created
- [ ] Verify foreign key constraints work
- [ ] Insert sample contact data
- [ ] Verify `is_active` flag works (soft delete)

#### Business Days Calculator
- [ ] Test weekend exclusion (Sat/Sun)
- [ ] Test holiday exclusion (Christmas, etc.)
- [ ] Test various turnaround times (5, 10, 15, 20 days)
- [ ] Test edge case: start date is weekend
- [ ] Test edge case: start date is holiday
- [ ] Test calculation spans multiple months

**Test Case Examples:**
```typescript
// Test 1: 10 business days from Nov 6, 2025 (Wed)
// Expected: Nov 20, 2025 (Thu) - skips weekends

// Test 2: 5 business days from Dec 23, 2025 (Tue)
// Expected: Dec 31, 2025 - skips Christmas Day (Dec 25)

// Test 3: Start on Saturday
// Expected: First business day is Monday
```

#### Customer Contacts API
- [ ] GET `/customers/:id/contacts/emails` returns unique emails
- [ ] GET `/customers/:id/contacts` returns all contacts with details
- [ ] POST `/customers/:id/contacts` creates new contact
- [ ] POST validates required fields (name, email)
- [ ] POST validates email format
- [ ] Duplicate emails allowed (different contacts)
- [ ] Test with customer that has no contacts (empty array)

#### Order Conversion
- [ ] Create order with `customer_job_number`
- [ ] Create order with `hard_due_date_time`
- [ ] Create order with both fields NULL (backward compatible)
- [ ] Verify database stores DATETIME correctly
- [ ] Test with various time zones

### Frontend Testing

#### ApproveEstimateModal
- [ ] Modal opens and calculates default due date
- [ ] Due date excludes weekends/holidays
- [ ] User can manually override due date
- [ ] Business days display updates when date changes
- [ ] Manual override indicator shows when date adjusted
- [ ] Customer Job Number field works
- [ ] Hard deadline time input is always visible (no checkbox)
- [ ] Time picker accepts optional time input (empty = no hard deadline)
- [ ] Point Person dropdown populated from contacts
- [ ] "Add New Contact" shows inline form
- [ ] Save contact checkbox checked by default
- [ ] Back button returns to dropdown
- [ ] Submit creates order with all fields
- [ ] Submit saves custom contact if checkbox checked
- [ ] Submit doesn't save contact if checkbox unchecked
- [ ] Form resets on close
- [ ] Existing order name validation still works

#### Integration Tests
- [ ] Create order with existing contact (dropdown)
- [ ] Create order with new contact (save enabled)
- [ ] Create order with new contact (save disabled)
- [ ] Verify saved contact appears in dropdown on next order
- [ ] Test with customer that has 0 contacts
- [ ] Test with customer that has 5+ contacts
- [ ] Verify hard due time combines with due date correctly

### Edge Cases & Validation
- [ ] Empty contact list (no existing contacts)
- [ ] Very long customer job number (test 100 chars)
- [ ] Invalid email format for new contact
- [ ] Missing contact name when save checkbox checked
- [ ] Due date in the past (should warn but allow?)
- [ ] Turnaround = 0 days (same day)
- [ ] Turnaround = 50 days (long calculation)

### Performance Testing
- [ ] Holiday query performance (90 day range)
- [ ] Business days calculation < 100ms
- [ ] Modal opens quickly (< 500ms)
- [ ] Contact dropdown loads quickly
- [ ] No console errors or warnings

---

## Rollback Plan

### If Issues Arise During Implementation

#### Phase 1 (Database) - Rollback
```sql
-- Drop customer_contacts table
DROP TABLE IF EXISTS customer_contacts;
```

#### Phase 2-7 (Backend/Frontend) - Rollback
1. **Revert Git Changes:**
   ```bash
   git checkout HEAD -- backend/web/src/utils/businessDaysCalculator.ts
   git checkout HEAD -- backend/web/src/types/customerContacts.ts
   git checkout HEAD -- backend/web/src/repositories/customerContactRepository.ts
   git checkout HEAD -- backend/web/src/controllers/customerContactController.ts
   git checkout HEAD -- backend/web/src/routes/customers.ts
   git checkout HEAD -- frontend/web/src/components/orders/modals/ApproveEstimateModal.tsx
   ```

2. **Restart Servers:**
   ```bash
   /home/jon/Nexus/infrastructure/scripts/stop-servers.sh
   /home/jon/Nexus/infrastructure/scripts/start-servers.sh
   ```

---

## Success Criteria

✅ **Complete** when ALL of the following are met:

1. ✅ Database migration runs successfully
2. ✅ Business days calculator works (verified with test cases)
3. ✅ Customer contacts API functional (GET, POST endpoints)
4. ✅ ApproveEstimateModal shows all new fields
5. ✅ Due date auto-calculated on modal open
6. ✅ Point person dropdown populated from contacts
7. ✅ "Add New Contact" inline form works
8. ✅ Custom contact saved when checkbox checked
9. ✅ Order created with all new fields (customer_job_number, hard_due_date_time)
10. ✅ No console errors or warnings
11. ✅ All manual test cases pass
12. ✅ Backward compatibility maintained (existing orders unaffected)

---

## Documentation Updates

After implementation, update:
- [ ] `Nexus_Orders_Phase1.5_OVERVIEW.md` - Mark Phase 1.5.a.5 complete
- [ ] `Nexus_OrdersPage_Overview.md` - Document new modal fields
- [ ] API documentation (if exists)

---

## Notes & Decisions

### User Clarifications Received
1. **Expected Ship Date:** Future feature (disabled for now)
2. **Customer Contacts:** Full implementation with `customer_contacts` table
3. **Validation:** Due date auto-fills but is editable (soft validation)
4. **Business Days:** Use existing holiday system from time management

### Technical Decisions Made
1. **Business Days Calculator:** Standalone utility in `/utils` (reusable)
2. **Holiday Integration:** Leverage `TimeAnalyticsRepository.getHolidaysInRange()`
3. **Contact Emails:** Allow duplicates (same email for multiple contacts)
4. **Hard Due Time:** Store as DATETIME (combine date + time)
5. **API Endpoints:** RESTful design under `/customers/:id/contacts`

### Future Enhancements (Out of Scope)
- Expected Ship Date calculation (smart scheduling)
- Contact management UI (edit/delete contacts)
- Contact role dropdown populated from database
- Email validation against known domains
- Conflict detection (hard due date vs. expected ship date)

---

## Related Files

- `Nexus_Orders_Phase1.5_OVERVIEW.md` - Parent phase documentation
- `Nexus_Orders_Phase1.5a_NumberingFix.md` - Previous phase (complete)
- `Nexus_Orders_Phase1h_IntegrationTesting.md` - Testing reference
- `backend/web/src/services/orderConversionService.ts` - Core order creation logic
- `frontend/web/src/components/orders/modals/ApproveEstimateModal.tsx` - Modal component

---

**Document Version:** 1.0
**Last Updated:** 2025-11-06
**Status:** ✅ COMPLETE - All features implemented and tested (2025-11-06)
**Implementation Summary:**
- ✅ Business days calculation with holiday awareness
- ✅ Customer contact management (customer_contacts table created)
- ✅ Hard due date/time support (always-visible time input)
- ✅ Auto-calculated due dates from customer default_turnaround_days
- ✅ Manual override detection with amber warning indicator
- ✅ New contact creation with "save for future" option
- ✅ Backend APIs: /calculate-due-date, /calculate-business-days, /customers/:id/contacts/*
- ✅ BusinessDaysCalculator utility created
- ✅ All features working in ApproveEstimateModal (577 lines)
