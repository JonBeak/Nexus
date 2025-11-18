/**
 * Orders API Barrel Export
 * Consolidates all order-related API modules for backward compatibility
 *
 * This allows consumers to import all order APIs from a single location:
 * import { ordersApi, orderTasksApi, orderPartsApi } from '@/services/api/orders'
 */

export { ordersApi } from './ordersApi';
export { orderStatusApi } from './orderStatusApi';
export { orderTasksApi } from './orderTasksApi';
export { orderPartsApi } from './orderPartsApi';
export { orderFormsApi } from './orderFormsApi';
export { orderBusinessLogicApi } from './orderBusinessLogicApi';
export { orderPreparationApi } from './orderPreparationApi';

// Re-export all methods as a single consolidated ordersApi object for backward compatibility
import { ordersApi as coreOrders } from './ordersApi';
import { orderStatusApi } from './orderStatusApi';
import { orderTasksApi } from './orderTasksApi';
import { orderPartsApi } from './orderPartsApi';
import { orderFormsApi } from './orderFormsApi';
import { orderBusinessLogicApi } from './orderBusinessLogicApi';
import { orderPreparationApi } from './orderPreparationApi';

/**
 * Consolidated ordersApi object containing all order-related methods
 * This maintains backward compatibility with code that imports { ordersApi } from '@/services/api'
 */
export const ordersApiConsolidated = {
  ...coreOrders,
  ...orderStatusApi,
  ...orderTasksApi,
  ...orderPartsApi,
  ...orderFormsApi,
  ...orderBusinessLogicApi,
  ...orderPreparationApi,
};
