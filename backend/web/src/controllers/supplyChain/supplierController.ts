// File Clean up Finished: Nov 14, 2025
import { Request, Response } from 'express';
import { SupplierService } from '../../services/supplyChain/supplierService';

const supplierService = new SupplierService();

/**
 * Get all suppliers
 */
export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, active_only } = req.query;

    const suppliers = await supplierService.getSuppliers({
      search: search as string | undefined,
      active_only: active_only === 'false' ? false : true
    });

    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

/**
 * Get single supplier by ID
 */
export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid supplier ID' });
      return;
    }

    const supplier = await supplierService.getSupplierById(id);
    res.json(supplier);
  } catch (error) {
    if (error instanceof Error && error.message === 'Supplier not found') {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
};

/**
 * Create new supplier
 */
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { name, contact_email, contact_phone, website, notes } = req.body;

    const supplierId = await supplierService.createSupplier(
      { name, contact_email, contact_phone, website, notes },
      user.user_id
    );

    res.json({
      message: 'Supplier created successfully',
      supplier_id: supplierId
    });
  } catch (error) {
    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }

    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

/**
 * Update supplier
 */
export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid supplier ID' });
      return;
    }

    await supplierService.updateSupplier(id, req.body, user.user_id);

    res.json({ message: 'Supplier updated successfully' });
  } catch (error) {
    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes('cannot be empty') || error.message.includes('Invalid')) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error.message === 'Supplier not found') {
        res.status(404).json({ error: 'Supplier not found' });
        return;
      }

      if (error.message === 'No valid fields to update') {
        res.status(400).json({ error: error.message });
        return;
      }
    }

    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

/**
 * Delete supplier
 */
export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid supplier ID' });
      return;
    }

    const result = await supplierService.deleteSupplier(id, user.user_id);

    res.json({ message: result.message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Supplier not found') {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};

/**
 * Get supplier statistics
 */
export const getSupplierStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await supplierService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching supplier statistics:', error);
    res.status(500).json({ error: 'Failed to fetch supplier statistics' });
  }
};
