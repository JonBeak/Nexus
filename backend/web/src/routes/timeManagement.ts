import { Router } from 'express';

// Import split modules
import timeEntriesRouter from './timeEntries';
import timeAnalyticsRouter from './timeAnalytics';
import timeSchedulingRouter from './timeScheduling';
import timeExportingRouter from './timeExporting';

const router = Router();

// Mount the split routers - maintaining exact same API paths
router.use('/', timeEntriesRouter);
router.use('/', timeAnalyticsRouter);
router.use('/', timeSchedulingRouter);
router.use('/', timeExportingRouter);

export default router;