# Phase 1.b: Backend - Order Conversion & Management

## Overview

This sub-phase implements the core backend functionality for converting estimates to orders and managing order CRUD operations. This is the heart of the Orders system.

**Duration Estimate:** 4-5 days
**Dependencies:** Phase 1.a (Database Foundation must be complete)
**Validates:** Estimate-to-order conversion works, order CRUD operations functional

---

## File Structure

```
/backend/web/src/
├── routes/
│   └── orders.ts                     # Order routes
├── controllers/
│   ├── orderController.ts            # Order CRUD
│   └── orderConversionController.ts  # Estimate → Order
├── services/
│   ├── orderService.ts               # Business logic
│   ├── orderConversionService.ts     # Conversion logic
│   └── orderTaskService.ts           # Task generation
├── repositories/
│   └── orderRepository.ts            # Data access layer
└── types/
    └── orders.ts                     # TypeScript interfaces
```

---

## TypeScript Interfaces

### /backend/web/src/types/orders.ts

```typescript
/**
 * Order system type definitions
 */

// =============================================
// ORDER TYPES
// =============================================

export interface Order {
  order_id: number;
  order_number: number;  // Sequential starting at 200000
  version_number: number;
  order_name: string;
  estimate_id?: number;
  customer_id: number;
  customer_po?: string;
  point_person_email?: string;
  order_date: Date;
  due_date?: Date;
  production_notes?: string;
  sign_image_path?: string;
  form_version: number;
  shipping_required: boolean;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
  created_by: number;
}

export type OrderStatus =
  | 'initiated'
  | 'pending_confirmation'
  | 'pending_production_files_creation'
  | 'pending_production_files_approval'
  | 'production_queue'
  | 'in_production'
  | 'on_hold'
  | 'overdue'
  | 'qc_packing'
  | 'shipping'
  | 'pick_up'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled';

// =============================================
// ORDER PART TYPES
// =============================================

export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  product_type: string;  // Human-readable
  product_type_id: string;  // Machine-readable
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  quantity: number;
  specifications: any;  // JSON
  production_notes?: string;
}

// =============================================
// ORDER TASK TYPES
// =============================================

export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  task_order: number;
  completed: boolean;
  completed_at?: Date;
  completed_by?: number;
}

// =============================================
// ORDER CONVERSION TYPES
// =============================================

export interface ConvertEstimateRequest {
  estimateId: number;
  orderName: string;
  customerPo?: string;
  dueDate?: string;  // ISO date string
  pointPersonEmail?: string;
  productionNotes?: string;
}

export interface ConvertEstimateResponse {
  success: boolean;
  order_id: number;
  order_number: number;
  message?: string;
}

// =============================================
// TASK TEMPLATE TYPES
// =============================================

export interface TaskTemplate {
  task_name: string;
  task_order: number;
}

export interface ProductTypeTaskTemplate {
  product_type_id: string;
  tasks: TaskTemplate[];
}

// =============================================
// ORDER WITH RELATIONS
// =============================================

export interface OrderWithDetails extends Order {
  customer_name?: string;
  parts: OrderPart[];
  tasks: OrderTask[];
  completed_tasks_count: number;
  total_tasks_count: number;
  progress_percent: number;
}
```

---

## Routes Definition

### /backend/web/src/routes/orders.ts

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import * as orderController from '../controllers/orderController';
import * as orderConversionController from '../controllers/orderConversionController';

const router = Router();

// =============================================
// ORDER CONVERSION
// =============================================

// Convert estimate to order (Manager+ only)
router.post(
  '/convert-estimate',
  authenticateToken,
  checkPermission('orders.create'),
  orderConversionController.convertEstimateToOrder
);

// =============================================
// ORDER CRUD
// =============================================

// Get all orders (with optional filters)
router.get(
  '/',
  authenticateToken,
  checkPermission('orders.view'),
  orderController.getAllOrders
);

// Get single order with details
router.get(
  '/:orderId',
  authenticateToken,
  checkPermission('orders.view'),
  orderController.getOrderById
);

// Update order
router.put(
  '/:orderId',
  authenticateToken,
  checkPermission('orders.update'),
  orderController.updateOrder
);

// Delete order (pre-confirmation only, Manager+ only)
router.delete(
  '/:orderId',
  authenticateToken,
  checkPermission('orders.delete'),
  orderController.deleteOrder
);

// =============================================
// ORDER STATUS
// =============================================

// Update order status
router.put(
  '/:orderId/status',
  authenticateToken,
  checkPermission('orders.update'),
  orderController.updateOrderStatus
);

// Get status history
router.get(
  '/:orderId/status-history',
  authenticateToken,
  checkPermission('orders.view'),
  orderController.getStatusHistory
);

export default router;
```

---

## Order Conversion Controller

### /backend/web/src/controllers/orderConversionController.ts

```typescript
import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { orderConversionService } from '../services/orderConversionService';
import { ConvertEstimateRequest } from '../types/orders';

/**
 * Convert approved estimate to order
 */
export const convertEstimateToOrder = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const conversionRequest: ConvertEstimateRequest = req.body;

    // Validate required fields
    if (!conversionRequest.estimateId || !conversionRequest.orderName) {
      return res.status(400).json({
        success: false,
        message: 'estimateId and orderName are required'
      });
    }

    // Convert estimate to order
    const result = await orderConversionService.convertEstimateToOrder(
      conversionRequest,
      user.user_id
    );

    res.json({
      success: true,
      data: result,
      message: `Order ${result.order_number} created successfully`
    });
  } catch (error) {
    console.error('Error converting estimate to order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to convert estimate to order'
    });
  }
};
```

---

## Order Conversion Service (Core Logic)

### /backend/web/src/services/orderConversionService.ts

```typescript
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ConvertEstimateRequest, ConvertEstimateResponse, OrderPart } from '../types/orders';
import { orderTaskService } from './orderTaskService';
import { FieldPacket } from 'mysql2';

class OrderConversionService {
  /**
   * Convert an approved estimate to an order
   */
  async convertEstimateToOrder(
    request: ConvertEstimateRequest,
    userId: number
  ): Promise<ConvertEstimateResponse> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Fetch and validate estimate
      const estimate = await this.fetchEstimate(request.estimateId, connection);

      // 2. Validate estimate status (should be approved)
      if (estimate.status !== 'approved') {
        throw new Error('Only approved estimates can be converted to orders');
      }

      // 3. Get next order number
      const orderNumber = await this.getNextOrderNumber(connection);

      // 4. Create order record
      const orderId = await this.createOrderRecord({
        orderNumber,
        orderName: request.orderName,
        estimateId: request.estimateId,
        customerId: estimate.customer_id,
        customerPo: request.customerPo,
        pointPersonEmail: request.pointPersonEmail,
        orderDate: new Date(),
        dueDate: request.dueDate ? new Date(request.dueDate) : undefined,
        productionNotes: request.productionNotes,
        createdBy: userId
      }, connection);

      // 5. Copy estimate items to order_parts
      const parts = await this.copyEstimateItemsToOrderParts(
        request.estimateId,
        orderId,
        connection
      );

      // 6. Generate tasks from templates
      await orderTaskService.generateTasksForOrder(orderId, parts, connection);

      // 7. Update estimate status to 'ordered'
      await this.updateEstimateStatus(request.estimateId, 'ordered', connection);

      // 8. Create initial status history entry
      await this.createStatusHistoryEntry(orderId, 'initiated', userId, 'Order created from estimate', connection);

      await connection.commit();

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

  /**
   * Fetch estimate with validation
   */
  private async fetchEstimate(estimateId: number, connection: any): Promise<any> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM job_estimates WHERE id = ?`,
      [estimateId]
    );

    if (rows.length === 0) {
      throw new Error(`Estimate ${estimateId} not found`);
    }

    return rows[0];
  }

  /**
   * Get next sequential order number (starting at 200000)
   */
  private async getNextOrderNumber(connection: any): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT MAX(order_number) as max_order_number FROM orders`
    );

    const maxOrderNumber = rows[0]?.max_order_number;
    return maxOrderNumber ? maxOrderNumber + 1 : 200000;
  }

  /**
   * Create order record
   */
  private async createOrderRecord(data: any, connection: any): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO orders (
        order_number, version_number, order_name, estimate_id,
        customer_id, customer_po, point_person_email,
        order_date, due_date, production_notes,
        status, form_version, shipping_required, created_by
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'initiated', 1, false, ?)`,
      [
        data.orderNumber,
        data.orderName,
        data.estimateId,
        data.customerId,
        data.customerPo || null,
        data.pointPersonEmail || null,
        data.orderDate,
        data.dueDate || null,
        data.productionNotes || null,
        data.createdBy
      ]
    );

    return result.insertId;
  }

  /**
   * Copy estimate items to order_parts
   */
  private async copyEstimateItemsToOrderParts(
    estimateId: number,
    orderId: number,
    connection: any
  ): Promise<OrderPart[]> {
    // Fetch estimate items
    const [estimateItems] = await connection.execute<RowDataPacket[]>(
      `SELECT
        item_name,
        product_type_id,
        grid_data,
        item_order
      FROM job_estimate_items
      WHERE estimate_id = ?
      ORDER BY item_order`,
      [estimateId]
    );

    const parts: OrderPart[] = [];

    // Insert each item as an order part
    for (let i = 0; i < estimateItems.length; i++) {
      const item = estimateItems[i];

      // Determine product type info
      const productTypeInfo = await this.getProductTypeInfo(item.product_type_id, connection);

      // Determine if this is a channel letter or other product
      const isChannelLetter = productTypeInfo.product_type_id?.startsWith('channel_letters_');

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO order_parts (
          order_id, part_number, product_type, product_type_id,
          channel_letter_type_id, base_product_type_id,
          quantity, specifications
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          i + 1,  // part_number starts at 1
          productTypeInfo.product_type,  // Human-readable
          productTypeInfo.product_type_id,  // Machine-readable
          isChannelLetter ? productTypeInfo.source_id : null,
          !isChannelLetter ? productTypeInfo.source_id : null,
          1,  // Default quantity
          JSON.stringify(item.grid_data || {})
        ]
      );

      parts.push({
        part_id: result.insertId,
        order_id: orderId,
        part_number: i + 1,
        product_type: productTypeInfo.product_type,
        product_type_id: productTypeInfo.product_type_id,
        channel_letter_type_id: isChannelLetter ? productTypeInfo.source_id : undefined,
        base_product_type_id: !isChannelLetter ? productTypeInfo.source_id : undefined,
        quantity: 1,
        specifications: item.grid_data || {}
      });
    }

    return parts;
  }

  /**
   * Get product type information
   */
  private async getProductTypeInfo(productTypeId: number, connection: any): Promise<any> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, name FROM product_types WHERE id = ?`,
      [productTypeId]
    );

    if (rows.length === 0) {
      throw new Error(`Product type ${productTypeId} not found`);
    }

    const productType = rows[0];

    return {
      product_type: productType.name,
      product_type_id: this.generateProductTypeId(productType.name),
      source_id: productType.id
    };
  }

  /**
   * Generate machine-readable product_type_id from name
   */
  private generateProductTypeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  /**
   * Update estimate status
   */
  private async updateEstimateStatus(
    estimateId: number,
    status: string,
    connection: any
  ): Promise<void> {
    await connection.execute(
      `UPDATE job_estimates SET status = ? WHERE id = ?`,
      [status, estimateId]
    );
  }

  /**
   * Create status history entry
   */
  private async createStatusHistoryEntry(
    orderId: number,
    status: string,
    userId: number,
    notes: string,
    connection: any
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES (?, ?, ?, ?)`,
      [orderId, status, userId, notes]
    );
  }
}

export const orderConversionService = new OrderConversionService();
```

---

## Order Task Service (Task Generation)

### /backend/web/src/services/orderTaskService.ts

```typescript
import { OrderPart } from '../types/orders';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { FieldPacket } from 'mysql2';

/**
 * Hard-coded task templates for Phase 1
 * Phase 3 will migrate these to database
 */
const TASK_TEMPLATES: Record<string, string[]> = {
  // Channel Letters
  channel_letters: [
    'Design approval',
    'Cut returns',
    'Cut faces',
    'Weld returns',
    'Apply vinyl to faces',
    'Install LED modules',
    'Wire power supply',
    'Quality check',
    'Package for shipping'
  ],

  // Dimensional Letters
  dimensional_letters: [
    'Design approval',
    'Cut material',
    'Route/finish edges',
    'Paint/finish',
    'Quality check',
    'Package for shipping'
  ],

  // ACM Panels
  acm_panel: [
    'Design approval',
    'Cut ACM to size',
    'Apply vinyl graphics',
    'Quality check',
    'Package for shipping'
  ],

  // Default template for unknown product types
  default: [
    'Design approval',
    'Production',
    'Quality check',
    'Package for shipping'
  ]
};

class OrderTaskService {
  /**
   * Generate tasks for an order based on parts
   */
  async generateTasksForOrder(
    orderId: number,
    parts: OrderPart[],
    connection: any
  ): Promise<void> {
    for (const part of parts) {
      const template = this.getTaskTemplate(part.product_type_id);

      for (let i = 0; i < template.length; i++) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO order_tasks (
            order_id, part_id, task_name, task_order, completed
          ) VALUES (?, ?, ?, ?, false)`,
          [orderId, part.part_id, template[i], i + 1]
        );
      }
    }
  }

  /**
   * Get task template for product type
   */
  private getTaskTemplate(productTypeId: string): string[] {
    // Normalize product type ID
    const normalized = productTypeId.toLowerCase().replace(/_/g, '');

    // Check for matching template
    for (const [key, template] of Object.entries(TASK_TEMPLATES)) {
      if (normalized.includes(key.toLowerCase().replace(/_/g, ''))) {
        return template;
      }
    }

    // Return default template
    return TASK_TEMPLATES.default;
  }
}

export const orderTaskService = new OrderTaskService();
```

---

## Order Controller (CRUD Operations)

### /backend/web/src/controllers/orderController.ts

```typescript
import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { orderService } from '../services/orderService';

/**
 * Get all orders with optional filters
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status, customer_id, search, limit = 50, offset = 0 } = req.query;

    const orders = await orderService.getAllOrders({
      status: status as string,
      customer_id: customer_id ? parseInt(customer_id as string) : undefined,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch orders'
    });
  }
};

/**
 * Get single order with details
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const order = await orderService.getOrderById(orderIdNum);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch order'
    });
  }
};

/**
 * Update order
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    await orderService.updateOrder(orderIdNum, req.body);

    res.json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update order'
    });
  }
};

/**
 * Delete order (pre-confirmation only)
 */
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    await orderService.deleteOrder(orderIdNum);

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete order'
    });
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderId } = req.params;
    const { status, notes } = req.body;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    await orderService.updateOrderStatus(
      orderIdNum,
      status,
      user?.user_id || 0,
      notes
    );

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update order status'
    });
  }
};

/**
 * Get status history for order
 */
export const getStatusHistory = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const history = await orderService.getStatusHistory(orderIdNum);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching status history:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch status history'
    });
  }
};
```

---

## Register Routes in Main Server

### /backend/web/src/server.ts

Add orders routes to the main server file:

```typescript
// ... existing imports ...
import ordersRoutes from './routes/orders';

// ... existing middleware ...

// Register routes
app.use('/api/orders', ordersRoutes);  // ADD THIS LINE
```

---

## Testing Checklist

### Manual Testing

- [ ] **Convert Estimate to Order**
  - Create test estimate with approved status
  - Call POST `/api/orders/convert-estimate`
  - Verify order created with number 200000 (or next sequential)
  - Verify order_parts created with correct data
  - Verify order_tasks generated from templates
  - Verify estimate status updated to 'ordered'
  - Verify status history entry created

- [ ] **Get All Orders**
  - Call GET `/api/orders`
  - Verify returns list of orders
  - Test filtering by status
  - Test filtering by customer_id
  - Test search functionality

- [ ] **Get Order By ID**
  - Call GET `/api/orders/:orderId`
  - Verify returns complete order with parts and tasks
  - Verify progress calculation correct

- [ ] **Update Order**
  - Call PUT `/api/orders/:orderId`
  - Update order_name, due_date, production_notes
  - Verify changes persisted

- [ ] **Update Order Status**
  - Call PUT `/api/orders/:orderId/status`
  - Change status to 'production_queue'
  - Verify status updated
  - Verify status history entry created

- [ ] **Delete Order**
  - Create test order
  - Call DELETE `/api/orders/:orderId`
  - Verify order deleted
  - Verify parts and tasks cascaded delete

### API Testing with curl

```bash
# Convert estimate to order
curl -X POST http://localhost:3001/api/orders/convert-estimate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estimateId": 1,
    "orderName": "Test Order 123",
    "customerPo": "PO-12345",
    "dueDate": "2025-12-01",
    "pointPersonEmail": "john@example.com"
  }'

# Get all orders
curl -X GET "http://localhost:3001/api/orders?status=initiated" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get order by ID
curl -X GET http://localhost:3001/api/orders/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Handling

All endpoints should handle:
- Invalid input (400 Bad Request)
- Authentication errors (401 Unauthorized)
- Permission errors (403 Forbidden)
- Not found errors (404 Not Found)
- Database errors (500 Internal Server Error)

---

## Next Steps

After completing Phase 1.b:

1. ✅ Estimate-to-order conversion working
2. ✅ Order CRUD operations functional
3. → Proceed to **Phase 1.c: Backend - PDF Form Generation**

---

**Sub-Phase Status:** Ready for Implementation
**Estimated Time:** 4-5 days
**Blockers:** None
**Dependencies:** Phase 1.a must be complete
