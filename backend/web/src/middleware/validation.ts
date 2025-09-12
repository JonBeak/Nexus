// Request validation middleware - Phase 3
// Centralizes validation logic and improves security

import { Request, Response, NextFunction } from 'express';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'email' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  values?: any[];
  custom?: (value: any) => boolean | string;
}

export const validate = (rules: ValidationRule[], source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[source];
    const errors: Array<{ field: string; message: string }> = [];

    for (const rule of rules) {
      const value = data[rule.field];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: rule.field, message: `${rule.field} is required` });
        continue;
      }

      // Skip validation for optional empty fields
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type) {
        switch (rule.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push({ field: rule.field, message: `${rule.field} must be a string` });
            }
            break;
          
          case 'number':
            const num = Number(value);
            if (isNaN(num)) {
              errors.push({ field: rule.field, message: `${rule.field} must be a number` });
            }
            break;
          
          case 'date':
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(value) || isNaN(new Date(value).getTime())) {
              errors.push({ field: rule.field, message: `${rule.field} must be a valid date (YYYY-MM-DD)` });
            }
            break;
          
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              errors.push({ field: rule.field, message: `${rule.field} must be a valid email` });
            }
            break;
          
          case 'array':
            if (!Array.isArray(value)) {
              errors.push({ field: rule.field, message: `${rule.field} must be an array` });
            }
            break;
        }
      }

      // Length/range validation
      if (rule.min !== undefined) {
        if (typeof value === 'string' && value.length < rule.min) {
          errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.min} characters` });
        } else if (typeof value === 'number' && value < rule.min) {
          errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.min}` });
        }
      }

      if (rule.max !== undefined) {
        if (typeof value === 'string' && value.length > rule.max) {
          errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.max} characters` });
        } else if (typeof value === 'number' && value > rule.max) {
          errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.max}` });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push({ field: rule.field, message: `${rule.field} has invalid format` });
      }

      // Values validation (enum-like)
      if (rule.values && !rule.values.includes(value)) {
        errors.push({ field: rule.field, message: `${rule.field} must be one of: ${rule.values.join(', ')}` });
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (typeof result === 'string') {
          errors.push({ field: rule.field, message: result });
        } else if (result === false) {
          errors.push({ field: rule.field, message: `${rule.field} is invalid` });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  };
};

// Common validation rules
export const timeEntryValidation = validate([
  { field: 'user_id', required: true, type: 'number', min: 1 },
  { field: 'clock_in', required: true, type: 'string' },
  { field: 'clock_out', type: 'string' },
  { 
    field: 'break_minutes', 
    type: 'number', 
    min: 0, 
    max: 480, // 8 hours max
    custom: (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 480;
    }
  }
]);

export const bulkEditValidation = validate([
  { 
    field: 'entry_ids', 
    required: true, 
    type: 'array',
    custom: (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'At least one entry must be selected';
      }
      if (value.length > 100) {
        return 'Cannot edit more than 100 entries at once';
      }
      return value.every(id => Number.isInteger(Number(id)) && Number(id) > 0) || 'All entry IDs must be positive integers';
    }
  },
  { field: 'clock_in', type: 'string' },
  { field: 'clock_out', type: 'string' },
  { field: 'break_minutes', type: 'number', min: 0, max: 480 }
]);

export const dateRangeValidation = validate([
  { field: 'startDate', required: true, type: 'date' },
  { field: 'endDate', type: 'date' },
  { 
    field: 'dataType', 
    required: true, 
    values: ['entries', 'summary', 'analytics', 'missing'] 
  }
], 'query');

export const exportValidation = validate([
  { field: 'format', required: true, values: ['csv', 'pdf'] },
  { field: 'startDate', required: true, type: 'date' },
  { field: 'endDate', type: 'date' }
], 'query');

// Security validations
export const sanitizeSearchTerm = (req: Request, res: Response, next: NextFunction) => {
  const { search } = req.query;
  
  if (search && typeof search === 'string') {
    // Remove potentially harmful characters
    const sanitized = search
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
    
    if (sanitized.length > 100) {
      return res.status(400).json({ error: 'Search term too long (max 100 characters)' });
    }
    
    req.query.search = sanitized;
  }
  
  next();
};

// Rate limiting for expensive operations
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}-${req.originalUrl}`;
    const now = Date.now();
    
    let rateLimitInfo = rateLimitMap.get(key);
    
    if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
      rateLimitInfo = { count: 0, resetTime: now + windowMs };
      rateLimitMap.set(key, rateLimitInfo);
    }
    
    rateLimitInfo.count++;
    
    if (rateLimitInfo.count > maxRequests) {
      const timeUntilReset = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        retryAfter: timeUntilReset 
      });
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimitInfo.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000));
    
    next();
  };
};

export default validate;