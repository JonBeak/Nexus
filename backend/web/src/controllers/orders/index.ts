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
  getOrderByEstimate,
  updateOrderPointPersons,
  updateOrderAccountingEmails
} from './OrderCrudController';

// Status Management
export {
  updateOrderStatus,
  getStatusHistory,
  getOrderProgress,
  checkAwaitingPaymentOrders,
  getFolderMismatches,
  retryFolderMove,
  retryAllFolderMoves
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
  removeTasksForPart,
  getTaskTemplates,
  updateTaskNotes,
  // Session management (Manager features)
  startTaskSession,
  stopTaskSessionById,
  getActiveTaskSessions
} from './OrderTasksController';

// Part Operations
export {
  updateOrderParts,
  updateSpecsDisplayName,
  toggleIsParent,
  updatePartSpecsQty,
  reorderParts,
  addPartRow,
  removePartRow,
  duplicatePart,
  importFromEstimate
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

// Parts with Tasks (Phase 2.a - Tasks Table)
export { getPartsWithTasks } from './OrderPartsTasksController';

// Task Metadata (Single Source of Truth)
export { getTaskMetadata } from './TaskMetadataController';

// Kanban Board Optimized Endpoint
export { getKanbanData } from './KanbanController';

// AI File Validation
export {
  listAiFiles,
  validateAiFiles,
  approveAiFiles,
  getExpectedFilesComparison,
} from './AiFileValidationController';
