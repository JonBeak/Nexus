// File Clean up Finished: 2025-11-21
// Changes (2025-11-21):
//   - Replaced direct customer query with customerRepository.getCustomerById()
// Changes (Nov 14, 2025):
//   - Fixed architecture violation: CustomerContactRepository → CustomerContactService (line 202)
//   - Removed excessive debug logging (14 console statements removed)
//   - Removed PII logging (customer data, contact info)
//   - Extracted createOrderPartsFromPreviewData() to orderPartCreationService.ts
//   - File size reduced from 547 → 288 lines (47% reduction, 212 lines under limit)
// Previous changes:
//   - Removed dead code: validateEstimateForConversion() method (never called by frontend)
//   - Fixed architecture violation: replaced direct SQL with orderRepository.updateOrderPart()
//
// Note on pool usage (Nov 14, 2025):
//   - Uses pool.getConnection() for transaction support (BEGIN/COMMIT/ROLLBACK)
//   - Cannot use query() helper because transactions require dedicated connection
//   - This is the CORRECT and ONLY valid use case for pool in services
//   - connection.execute() calls within transaction are intentional and required

/**
 * Order Conversion Service
 * Business Logic for Converting Estimates to Orders
 *
 * Orchestrates the complete conversion process:
 * 1. Validate estimate (approved status)
 * 2. Check folder name conflicts
 * 3. Generate order number
 * 4. Create order record
 * 5. Copy estimate items to order parts
 * 6. Update estimate status
 * 7. Create status history
 * 8. Create order folder on SMB share
 */

import { pool } from '../config/database';
import { orderRepository } from '../repositories/orderRepository';
import { orderConversionRepository } from '../repositories/orderConversionRepository';
import { customerRepository } from '../repositories/customerRepository';
import {
  ConvertEstimateRequest,
  ConvertEstimateResponse,
  OrderPart,
  CreateOrderPartData,
  EstimatePreviewData,
  EstimateLineItem
} from '../types/orders';
import { orderFolderService } from './orderFolderService';
import { CustomerContactService } from './customerContactService';
import { orderPartCreationService } from './orderPartCreationService';
import { qbEstimateComparisonService } from './qbEstimateComparisonService';
import { QBEstimateLineItem } from '../types/orders';
import { CustomerAccountingEmailRepository } from '../repositories/customerAccountingEmailRepository';
import { broadcastOrderCreated } from '../websocket';

const customerContactService = new CustomerContactService();

export class OrderConversionService {

  /**
   * Convert an approved estimate to an order
   */
  async convertEstimateToOrder(
    request: ConvertEstimateRequest,
    userId: number
  ): Promise<ConvertEstimateResponse> {
    console.time('[Order Conversion] Total time');

    // Check if estimate has already been converted to an order (fail fast)
    const existingOrder = await orderRepository.getOrderByEstimateId(request.estimateId);
    if (existingOrder) {
      throw new Error(`This estimate has already been converted to order #${existingOrder.order_number}`);
    }

    // Check SMB share health FIRST (7-second timeout) - fail fast if network is down
    console.log('[Order Conversion] Checking SMB share accessibility...');
    const smbHealthy = await orderFolderService.checkSMBHealth(7000);
    if (!smbHealthy) {
      throw new Error('Order folder network share is not accessible. Please check that the network connection is available and try again.');
    }
    console.log('[Order Conversion] ✓ SMB share is accessible, proceeding with order creation...');

    const connection = await pool.getConnection();

    try {
      console.time('[Order Conversion] Begin transaction');
      await connection.beginTransaction();
      console.timeEnd('[Order Conversion] Begin transaction');

      // 1. Fetch and validate estimate
      const estimate = await orderConversionRepository.getEstimateForConversion(request.estimateId, connection);

      if (!estimate) {
        throw new Error(`Estimate ${request.estimateId} not found`);
      }

      // 2. Validate estimate status (allow draft, sent, or approved)
      // Allow draft estimates to be approved without QB estimate (user confirms in modal)
      // Allow sent estimates (from QB) to be approved
      // Allow already approved estimates (shouldn't happen in UI, but safe to allow)
      // Note: 'ordered' status removed - we rely on order existence check above (line 68)
      if (estimate.status !== 'draft' && estimate.status !== 'sent' && estimate.status !== 'approved') {
        if (estimate.status === 'retracted') {
          throw new Error('Cannot convert a retracted estimate to an order.');
        } else {
          throw new Error(`Cannot convert estimate with status '${estimate.status}'. Only draft, sent, or approved estimates can be converted.`);
        }
      }

      // 3. Fetch customer data to auto-fill notes and invoice fields
      const customer = await customerRepository.getCustomerById(estimate.customer_id, connection);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // 4. Check for folder name conflicts (case-insensitive, all orders)
      const folderName = orderFolderService.buildFolderName(request.orderName, customer.company_name);
      const hasConflict = await orderFolderService.checkDatabaseConflict(folderName);
      if (hasConflict) {
        throw new Error(
          `An order with this name already exists for ${customer.company_name}. ` +
          `Please choose a different order name to avoid folder conflicts.`
        );
      }

      // 5. Fetch billing address to auto-fill tax_name (fallback to primary if no billing)
      const [addressRows] = await connection.execute<any[]>(
        `SELECT
          ca.province_state_short,
          pt.tax_name
        FROM customer_addresses ca
        LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short
        WHERE ca.customer_id = ? AND ca.is_active = 1
        ORDER BY ca.is_billing DESC, ca.is_primary DESC
        LIMIT 1`,
        [estimate.customer_id]
      );

      if (!addressRows || addressRows.length === 0 || !addressRows[0]?.tax_name) {
        throw new Error('Customer must have a billing or primary address with valid province/tax information before creating an order');
      }

      const taxName = addressRows[0].tax_name;

      // 5b. Fetch accounting emails for customer (snapshot for order)
      const accountingEmails = await CustomerAccountingEmailRepository.getEmailsForCustomer(estimate.customer_id);
      const accountingEmailsSnapshot = accountingEmails.length > 0
        ? accountingEmails.map(ae => ({
            email: ae.email,
            email_type: ae.email_type,
            label: ae.label
          }))
        : undefined;

      // 6. Get next order number
      const orderNumber = await orderRepository.getNextOrderNumber(connection);

      // 7. Create order record
      const orderData = {
        order_number: orderNumber,
        version_number: 1,
        order_name: request.orderName,
        estimate_id: request.estimateId,
        customer_id: estimate.customer_id,
        customer_po: request.customerPo,
        customer_job_number: request.customerJobNumber,        // Phase 1.5.a.5
        // point_person_email removed - now using order_point_persons table instead
        order_date: new Date(),
        due_date: request.dueDate ? new Date(request.dueDate) : undefined,
        hard_due_date_time: request.hardDueDateTime || undefined,  // Phase 1.5.a.5: TIME format "HH:mm:ss"
        production_notes: request.productionNotes,
        // Combine customer special_instructions with modal special instructions (if provided)
        manufacturing_note: [customer?.special_instructions, request.modalSpecialInstructions]
          .filter(Boolean)
          .join('\n') || undefined,
        internal_note: customer?.comments || null,                   // Auto-fill from customer
        invoice_email: customer?.invoice_email || null,              // Auto-fill from customer
        terms: customer?.payment_terms || null,                      // Auto-fill from customer
        deposit_required: customer?.deposit_required || false,       // Auto-fill from customer
        invoice_notes: customer?.invoice_email_preference || null,   // Auto-fill from customer
        cash: customer?.cash_yes_or_no || false,                     // Auto-fill from customer
        discount: customer?.discount || 0,                           // Auto-fill from customer
        tax_name: taxName,                                           // Auto-fill from billing/primary address
        accounting_emails: accountingEmailsSnapshot,                 // Snapshot from customer accounting emails
        form_version: 1,
        shipping_required: false,
        status: 'job_details_setup' as const,  // Phase 1.5: Start in job details setup
        created_by: userId
      };

      const orderId = await orderRepository.createOrder(orderData, connection);

      // 8. Create order point persons (if provided)
      if (request.pointPersons && request.pointPersons.length > 0) {
        for (let i = 0; i < request.pointPersons.length; i++) {
          const person = request.pointPersons[i];
          let contactId = person.contact_id;

          // If this is a custom contact with saveToDatabase flag, create it in customer_contacts first
          if (person.saveToDatabase && !person.contact_id && person.contact_email) {
            const result = await customerContactService.createContact(
              {
                customer_id: estimate.customer_id,
                contact_name: person.contact_name || person.contact_email, // Use email as fallback name
                contact_email: person.contact_email,
                contact_phone: person.contact_phone || undefined,
                contact_role: person.contact_role || undefined,
                notes: 'Auto-created during order conversion'
              },
              userId
            );
            if (!result.success) {
              throw new Error(`Failed to create contact: ${result.error}`);
            }
            contactId = result.data;
          }

          await orderConversionRepository.createOrderPointPerson(
            {
              order_id: orderId,
              contact_id: contactId,
              contact_email: person.contact_email,
              contact_name: person.contact_name,
              contact_phone: person.contact_phone,
              contact_role: person.contact_role,
              display_order: i
            },
            connection
          );
        }
        console.log(`✅ Created ${request.pointPersons.length} point person(s) for order`);
      }

      // 9. Phase 1.6: Check for QB Estimate integration
      // If the estimate has an associated QB Estimate, fetch and compare structure
      // Use QB values if structure matches (captures description edits made in QB)
      let qbLineItems: QBEstimateLineItem[] | undefined;

      const qbEstimateId = await orderConversionRepository.getEstimateQBId(request.estimateId, connection);
      if (qbEstimateId) {
        console.log(`[Order Conversion] Found QB Estimate ${qbEstimateId} - checking structure...`);
        try {
          const comparison = await qbEstimateComparisonService.fetchAndCompareQBEstimate(
            qbEstimateId,
            request.estimatePreviewData!
          );

          if (comparison.useQBValues && comparison.qbLineItems) {
            qbLineItems = comparison.qbLineItems;
            console.log('✅ Using QB Estimate values for order parts');
          } else {
            console.log(`ℹ️ QB Estimate not used: ${comparison.reason}`);
          }
        } catch (qbError) {
          // Non-blocking: QB errors should never prevent order creation
          console.warn(`⚠️ QB comparison failed (continuing with app values):`, qbError);
        }
      }

      // 10. Create order parts from EstimatePreviewData
      if (!request.estimatePreviewData) {
        throw new Error('EstimatePreviewData is required for order creation');
      }

      console.time('[Order Conversion] Create order parts');
      const parts = await orderPartCreationService.createOrderPartsFromPreviewData(
        request.estimatePreviewData,
        orderId,
        connection,
        estimate.customer_id,  // Pass customerId for customer preferences
        qbLineItems,  // Phase 1.6: Pass QB line items if available
        request.estimateId  // Phase 4.c: Pass estimate ID for custom QB descriptions
      );
      console.timeEnd('[Order Conversion] Create order parts');

      // 11. Mark estimate as approved (order existence is tracked via orders.estimate_id foreign key)
      await orderConversionRepository.updateEstimateStatusAndApproval(request.estimateId, 'approved', true, connection);

      // 12. Create initial status history entry
      await orderRepository.createStatusHistory(
        {
          order_id: orderId,
          status: 'job_details_setup',  // Phase 1.5
          changed_by: userId,
          notes: 'Order created from estimate'
        },
        connection
      );

      // 13. Create order folder on SMB share
      console.time('[Order Conversion] Create order folder');
      try {
        const folderCreated = orderFolderService.createOrderFolder(folderName);

        await orderFolderService.updateFolderTracking(
          orderId,
          folderName,
          folderCreated,
          folderCreated ? 'active' : 'none',
          connection
        );

        console.log(`✅ Order folder ${folderCreated ? 'created' : 'tracking added'}: ${folderName}`);
      } catch (folderError) {
        // Non-blocking: if folder creation fails, continue with order creation
        console.error('⚠️  Folder creation failed (continuing with order):', folderError);

        await orderFolderService.updateFolderTracking(
          orderId,
          folderName,
          false,
          'none',
          connection
        );
      }
      console.timeEnd('[Order Conversion] Create order folder');

      console.time('[Order Conversion] Commit transaction');
      await connection.commit();
      console.timeEnd('[Order Conversion] Commit transaction');
      console.timeEnd('[Order Conversion] Total time');

      // Broadcast order created event for real-time updates
      broadcastOrderCreated(orderId, orderNumber, estimate.customer_id, userId);

      return {
        success: true,
        order_id: orderId,
        order_number: orderNumber
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const orderConversionService = new OrderConversionService();
