// Phase 4.a: Updated for extended supplier fields + contacts
// Updated: 2025-12-18
import { Request, Response } from 'express';
import { SupplierService } from '../../services/supplyChain/supplierService';
import { SupplierContactService } from '../../services/supplyChain/supplierContactService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

const supplierService = new SupplierService();
const contactService = new SupplierContactService();

// ============================================
// SUPPLIER ENDPOINTS
// ============================================

/**
 * Get all suppliers
 */
export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  const { search, active_only } = req.query;

  const result = await supplierService.getSuppliers({
    search: search as string | undefined,
    active_only: active_only === 'false' ? false : true
  });

  handleServiceResult(res, result);
};

/**
 * Get single supplier by ID
 */
export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier ID', 'VALIDATION_ERROR');
  }

  const result = await supplierService.getSupplierById(id);
  handleServiceResult(res, result);
};

/**
 * Create new supplier
 */
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const {
    name, website, notes, payment_terms, default_lead_days, account_number,
    address_line1, address_line2, city, province, postal_code, country
  } = req.body;

  const result = await supplierService.createSupplier(
    {
      name, website, notes, payment_terms, default_lead_days, account_number,
      address_line1, address_line2, city, province, postal_code, country
    },
    user.user_id
  );

  if (result.success) {
    res.json({
      success: true,
      message: 'Supplier created successfully',
      supplier_id: result.data
    });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Update supplier
 */
export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'supplier ID');

  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier ID', 'VALIDATION_ERROR');
  }

  const result = await supplierService.updateSupplier(id, req.body, user.user_id);

  if (result.success) {
    res.json({ success: true, message: 'Supplier updated successfully' });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Delete supplier
 */
export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'supplier ID');

  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier ID', 'VALIDATION_ERROR');
  }

  const result = await supplierService.deleteSupplier(id, user.user_id);
  handleServiceResult(res, result);
};

/**
 * Get supplier statistics
 */
export const getSupplierStats = async (_req: Request, res: Response): Promise<void> => {
  const result = await supplierService.getStatistics();
  handleServiceResult(res, result);
};

// ============================================
// CONTACT ENDPOINTS
// ============================================

/**
 * Get all contacts for a supplier
 */
export const getSupplierContacts = async (req: Request, res: Response): Promise<void> => {
  const supplierId = parseIntParam(req.params.supplierId, 'Supplier ID');
  if (supplierId === null) {
    return sendErrorResponse(res, 'Invalid supplier ID', 'VALIDATION_ERROR');
  }

  const activeOnly = req.query.active_only !== 'false';
  const result = await contactService.getContactsBySupplier(supplierId, activeOnly);
  handleServiceResult(res, result);
};

/**
 * Get single contact by ID
 */
export const getContactById = async (req: Request, res: Response): Promise<void> => {
  const contactId = parseIntParam(req.params.contactId, 'Contact ID');
  if (contactId === null) {
    return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
  }

  const result = await contactService.getContactById(contactId);
  handleServiceResult(res, result);
};

/**
 * Create new contact
 */
export const createContact = async (req: Request, res: Response): Promise<void> => {
  const supplierId = parseIntParam(req.params.supplierId, 'Supplier ID');
  if (supplierId === null) {
    return sendErrorResponse(res, 'Invalid supplier ID', 'VALIDATION_ERROR');
  }

  const { name, email, phone, role, is_primary, notes } = req.body;

  const result = await contactService.createContact({
    supplier_id: supplierId,
    name,
    email,
    phone,
    role,
    is_primary,
    notes
  });

  if (result.success) {
    res.json({
      success: true,
      message: 'Contact created successfully',
      contact_id: result.data
    });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Update contact
 */
export const updateContact = async (req: Request, res: Response): Promise<void> => {
  const contactId = parseIntParam(req.params.contactId, 'Contact ID');
  if (contactId === null) {
    return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
  }

  const result = await contactService.updateContact(contactId, req.body);

  if (result.success) {
    res.json({ success: true, message: 'Contact updated successfully' });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Delete contact
 */
export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  const contactId = parseIntParam(req.params.contactId, 'Contact ID');
  if (contactId === null) {
    return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
  }

  const result = await contactService.deleteContact(contactId);
  handleServiceResult(res, result);
};

/**
 * Set contact as primary
 */
export const setPrimaryContact = async (req: Request, res: Response): Promise<void> => {
  const contactId = parseIntParam(req.params.contactId, 'Contact ID');
  if (contactId === null) {
    return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
  }

  const result = await contactService.setPrimaryContact(contactId);

  if (result.success) {
    res.json({ success: true, message: 'Primary contact updated successfully' });
  } else {
    handleServiceResult(res, result);
  }
};
