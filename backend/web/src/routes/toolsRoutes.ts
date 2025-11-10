import { Router } from 'express';
import { copyFolderOpenerToSMB } from '../controllers/toolsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Copy folder opener tool to SMB share
router.post('/copy-folder-opener', authenticateToken, copyFolderOpenerToSMB);

export default router;
