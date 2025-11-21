/**
 * Order Controllers - Barrel Export
 *
 * Refactored: 2025-11-21
 * Split from single 1037-line orderController.ts into focused modules:
 * - OrderCrudController.ts (~220 lines): Core CRUD operations
 * - OrderStatusController.ts (~120 lines): Status management
 * - OrderTasksController.ts (~240 lines): Task operations
 * - OrderPartsController.ts (~260 lines): Part operations
 * - OrderSnapshotController.ts (~100 lines): Snapshot/versioning
 * - OrderUtilsController.ts (~90 lines): Business day utilities
 *
 * This barrel export maintains backward compatibility with existing imports
 * from '../controllers/orderController'
 */

// Core CRUD Operations
export {
  getOrderIdFromNumber,
  getAllOrders,
  getOrderById,
  getCustomerTax,
  updateOrder,
  deleteOrder,
  validateOrderName,
  getOrderByEstimate
} from './OrderCrudController';

// Status Management
export {
  updateOrderStatus,
  getStatusHistory,
  getOrderProgress
} from './OrderStatusController';

// Task Operations
export {
  getOrderTasks,
  getTasksByPart,
  updateTaskCompletion,
  getTasksByRole,
  batchUpdateTasks,
  addTaskToOrderPart,
  removeTask,
  getTaskTemplates
} from './OrderTasksController';

// Part Operations
export {
  updateOrderParts,
  updateSpecsDisplayName,
  toggleIsParent,
  updatePartSpecsQty,
  reorderParts,
  addPartRow,
  removePartRow
} from './OrderPartsController';

// Snapshot/Versioning Operations
export {
  finalizeOrder,
  getPartLatestSnapshot,
  getPartSnapshotHistory,
  comparePartWithSnapshot
} from './OrderSnapshotController';

// Utility Operations
export {
  calculateDueDate,
  calculateBusinessDays
} from './OrderUtilsController';
