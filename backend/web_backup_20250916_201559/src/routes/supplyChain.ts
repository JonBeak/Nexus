import express from 'express';
import { authenticateToken } from '../middleware/auth';
import * as materialCategoryController from '../controllers/supplyChain/materialCategoryController';
import * as productStandardController from '../controllers/supplyChain/productStandardController';
import * as inventoryController from '../controllers/supplyChain/inventoryController';
import * as dashboardController from '../controllers/supplyChain/dashboardController';

const router = express.Router();

// All supply chain routes require authentication
router.use(authenticateToken);

// Material Categories Routes
router.get('/categories', materialCategoryController.getCategories);
router.post('/categories', materialCategoryController.createCategory);
router.put('/categories/:id', materialCategoryController.updateCategory);
router.delete('/categories/:id', materialCategoryController.deleteCategory);

// Category Fields Routes
router.get('/categories/:categoryId/fields', materialCategoryController.getCategoryFields);
router.post('/categories/:categoryId/fields', materialCategoryController.createCategoryField);
router.put('/categories/:categoryId/fields/:fieldId', materialCategoryController.updateCategoryField);
router.delete('/categories/:categoryId/fields/:fieldId', materialCategoryController.deleteCategoryField);

// Product Standards Routes
router.get('/product-standards', productStandardController.getProductStandards);
router.get('/product-standards/:id', productStandardController.getProductStandardById);
router.post('/product-standards', productStandardController.createProductStandard);
router.put('/product-standards/:id', productStandardController.updateProductStandard);
router.delete('/product-standards/:id', productStandardController.deleteProductStandard);

// Unified Inventory Routes
router.get('/inventory', inventoryController.getInventory);
router.get('/inventory/availability/:productStandardId', inventoryController.getInventoryAvailability);
router.post('/inventory', inventoryController.createInventoryItem);
router.put('/inventory/:id', inventoryController.updateInventoryItem);
router.delete('/inventory/:id', inventoryController.deleteInventoryItem);

// Low Stock Routes
router.get('/low-stock', dashboardController.getLowStockItems);
router.put('/product-standards/:id/reorder-settings', dashboardController.updateReorderSettings);

// Dashboard and Statistics
router.get('/dashboard-stats', dashboardController.getDashboardStats);

export default router;